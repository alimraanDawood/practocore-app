//! Safe, read-only fallback for pages that refuse iframe embedding.
//!
//! The command probes framing headers without exposing a general-purpose native
//! HTTP client to remote content. Reader downloads are limited to public network
//! addresses, HTTP(S), a small redirect count, and bounded response bodies.

use futures_util::StreamExt;
use reqwest::{header, redirect::Policy, Client, StatusCode};
use serde::Serialize;
use std::{
    net::{IpAddr, SocketAddr},
    time::Duration,
};

const MAX_REDIRECTS: usize = 5;
const MAX_TEXT_BYTES: usize = 5 * 1024 * 1024;
const MAX_PDF_BYTES: usize = 20 * 1024 * 1024;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResearchPageResolution {
    mode: &'static str,
    url: String,
    content_type: String,
    body: Option<String>,
    bytes: Option<Vec<u8>>,
    reason: Option<String>,
}

fn external_url(raw: &str) -> Result<tauri::Url, String> {
    let url = tauri::Url::parse(raw.trim()).map_err(|_| "enter a valid web address")?;
    if !matches!(url.scheme(), "http" | "https") || url.host_str().is_none() {
        return Err("only http and https web addresses can be opened".into());
    }
    Ok(url)
}

fn is_public_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => {
            let octets = ip.octets();
            !(ip.is_private()
                || ip.is_loopback()
                || ip.is_link_local()
                || ip.is_multicast()
                || ip.is_unspecified()
                || octets[0] == 0
                || octets[0] >= 224
                || (octets[0] == 100 && (64..=127).contains(&octets[1]))
                || (octets[0] == 192 && octets[1] == 0 && octets[2] == 0)
                || (octets[0] == 198 && matches!(octets[1], 18 | 19)))
        }
        IpAddr::V6(ip) => {
            if let Some(mapped) = ip.to_ipv4_mapped() {
                return is_public_ip(IpAddr::V4(mapped));
            }
            let first = ip.segments()[0];
            !(ip.is_loopback()
                || ip.is_multicast()
                || ip.is_unspecified()
                || (first & 0xfe00) == 0xfc00
                || (first & 0xffc0) == 0xfe80)
        }
    }
}

async fn public_addresses(url: &tauri::Url) -> Result<Vec<SocketAddr>, String> {
    let host = url.host_str().ok_or("web address has no host")?;
    if host.eq_ignore_ascii_case("localhost")
        || host.ends_with(".localhost")
        || host.ends_with(".local")
    {
        return Err("reader mode cannot access local network addresses".into());
    }
    let port = url
        .port_or_known_default()
        .ok_or("web address has no port")?;
    let addresses: Vec<_> = tokio::net::lookup_host((host, port))
        .await
        .map_err(|_| "could not resolve that web address")?
        .collect();
    if addresses.is_empty() || addresses.iter().any(|address| !is_public_ip(address.ip())) {
        return Err("reader mode cannot access local or reserved network addresses".into());
    }
    Ok(addresses)
}

fn framing_block_reason(headers: &header::HeaderMap) -> Option<String> {
    if let Some(value) = headers
        .get(header::X_FRAME_OPTIONS)
        .and_then(|v| v.to_str().ok())
    {
        let value = value.to_ascii_lowercase();
        if value.contains("deny") || value.contains("sameorigin") {
            return Some("This site does not allow iframe embedding.".into());
        }
    }

    for value in headers.get_all(header::CONTENT_SECURITY_POLICY) {
        let Ok(policy) = value.to_str() else { continue };
        for directive in policy.split(';').map(str::trim) {
            let lower = directive.to_ascii_lowercase();
            if lower.starts_with("frame-ancestors")
                && !lower.split_whitespace().skip(1).any(|source| source == "*")
            {
                return Some(
                    "This site's content policy does not allow PractoCore to embed it.".into(),
                );
            }
        }
    }
    None
}

async fn bounded_body(response: reqwest::Response, limit: usize) -> Result<Vec<u8>, String> {
    if response
        .content_length()
        .is_some_and(|length| length > limit as u64)
    {
        return Err("the page is too large for reader mode".into());
    }
    let mut bytes = Vec::new();
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|_| "the page download was interrupted")?;
        if bytes.len() + chunk.len() > limit {
            return Err("the page is too large for reader mode".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(bytes)
}

fn client_for(host: &str, addresses: &[SocketAddr]) -> Result<Client, String> {
    Client::builder()
        .redirect(Policy::none())
        .connect_timeout(Duration::from_secs(8))
        .timeout(Duration::from_secs(20))
        .user_agent("PractoCore Research Reader/1.0")
        .resolve_to_addrs(host, addresses)
        .build()
        .map_err(|_| "could not initialize the page reader".into())
}

#[tauri::command]
pub async fn research_page_resolve(
    url: String,
    force_reader: bool,
) -> Result<ResearchPageResolution, String> {
    let mut current = external_url(&url)?;

    for redirect in 0..=MAX_REDIRECTS {
        let addresses = public_addresses(&current).await?;
        let host = current
            .host_str()
            .ok_or("web address has no host")?
            .to_string();
        let response = client_for(&host, &addresses)?
            .get(current.clone())
            .header(
                header::ACCEPT,
                "text/html,application/xhtml+xml,application/pdf;q=0.9,text/plain;q=0.8,*/*;q=0.1",
            )
            .send()
            .await
            .map_err(|e| format!("could not fetch the page: {e}"))?;

        if response.status().is_redirection() {
            if redirect == MAX_REDIRECTS {
                return Err("the page redirected too many times".into());
            }
            let location = response
                .headers()
                .get(header::LOCATION)
                .and_then(|value| value.to_str().ok())
                .ok_or("the page returned an invalid redirect")?;
            current = current
                .join(location)
                .map_err(|_| "the page returned an invalid redirect")?;
            external_url(current.as_str())?;
            continue;
        }

        if !response.status().is_success() {
            let status = response.status();
            let reason = if status == StatusCode::UNAUTHORIZED || status == StatusCode::FORBIDDEN {
                "This page requires access that reader mode does not have."
            } else {
                "The page could not be loaded in reader mode."
            };
            return Ok(ResearchPageResolution {
                mode: "external",
                url: current.to_string(),
                content_type: String::new(),
                body: None,
                bytes: None,
                reason: Some(reason.into()),
            });
        }

        let content_type = response
            .headers()
            .get(header::CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .unwrap_or("")
            .to_ascii_lowercase();
        let blocked = framing_block_reason(response.headers());
        if !force_reader && blocked.is_none() {
            return Ok(ResearchPageResolution {
                mode: "iframe",
                url: current.to_string(),
                content_type,
                body: None,
                bytes: None,
                reason: None,
            });
        }

        if content_type.contains("application/pdf") {
            match bounded_body(response, MAX_PDF_BYTES).await {
                Ok(bytes) => {
                    return Ok(ResearchPageResolution {
                        mode: "pdf",
                        url: current.to_string(),
                        content_type,
                        body: None,
                        bytes: Some(bytes),
                        reason: blocked,
                    })
                }
                Err(reason) => {
                    return Ok(ResearchPageResolution {
                        mode: "external",
                        url: current.to_string(),
                        content_type,
                        body: None,
                        bytes: None,
                        reason: Some(reason),
                    })
                }
            }
        }

        if !(content_type.contains("text/html")
            || content_type.contains("application/xhtml+xml")
            || content_type.starts_with("text/"))
        {
            return Ok(ResearchPageResolution {
                mode: "external",
                url: current.to_string(),
                content_type,
                body: None,
                bytes: None,
                reason: Some("This file type is not supported by reader mode.".into()),
            });
        }

        return match bounded_body(response, MAX_TEXT_BYTES).await {
            Ok(bytes) => Ok(ResearchPageResolution {
                mode: "reader",
                url: current.to_string(),
                content_type,
                body: Some(String::from_utf8_lossy(&bytes).into_owned()),
                bytes: None,
                reason: blocked,
            }),
            Err(reason) => Ok(ResearchPageResolution {
                mode: "external",
                url: current.to_string(),
                content_type,
                body: None,
                bytes: None,
                reason: Some(reason),
            }),
        };
    }
    unreachable!()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_private_and_reserved_addresses() {
        for value in [
            "127.0.0.1",
            "10.0.0.1",
            "169.254.1.1",
            "192.168.1.1",
            "100.64.0.1",
            "::1",
            "::ffff:127.0.0.1",
            "fc00::1",
            "fe80::1",
        ] {
            assert!(
                !is_public_ip(value.parse().unwrap()),
                "{value} should be private"
            );
        }
        assert!(is_public_ip("1.1.1.1".parse().unwrap()));
        assert!(is_public_ip("2606:4700:4700::1111".parse().unwrap()));
    }

    #[test]
    fn recognizes_frame_denial_headers() {
        let mut headers = header::HeaderMap::new();
        headers.insert(header::X_FRAME_OPTIONS, "SAMEORIGIN".parse().unwrap());
        assert!(framing_block_reason(&headers).is_some());
        headers.remove(header::X_FRAME_OPTIONS);
        headers.insert(
            header::CONTENT_SECURITY_POLICY,
            "default-src 'self'; frame-ancestors 'none'"
                .parse()
                .unwrap(),
        );
        assert!(framing_block_reason(&headers).is_some());
    }
}
