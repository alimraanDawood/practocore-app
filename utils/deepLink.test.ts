/**
 * Run with: bun test
 *
 * Deep links are untrusted input — any app can fire our custom scheme and an
 * App Link intent can carry an arbitrary URL — so the reject cases matter as
 * much as the happy paths.
 */
import { describe, expect, test } from 'bun:test';
import { resolveDeepLinkPath } from './deepLink';

describe('resolveDeepLinkPath', () => {
  test('custom scheme collapses to a relative path', () => {
    expect(resolveDeepLinkPath('practocore://main/matters/matter/abc123'))
      .toBe('/main/matters/matter/abc123');
  });

  test('custom scheme preserves query and hash', () => {
    expect(resolveDeepLinkPath('practocore://main/settings?tab=billing'))
      .toBe('/main/settings?tab=billing');
    expect(resolveDeepLinkPath('practocore://main/matters/matter/M1?org=O1#deadline-D1'))
      .toBe('/main/matters/matter/M1?org=O1#deadline-D1');
  });

  test('custom scheme tolerates the triple-slash (empty host) form', () => {
    expect(resolveDeepLinkPath('practocore:///main/dashboard'))
      .toBe('/main/dashboard');
  });

  test('custom scheme is case-insensitive on the scheme itself', () => {
    expect(resolveDeepLinkPath('PractoCore://main/dashboard'))
      .toBe('/main/dashboard');
  });

  test('https App Link on an app host collapses to a relative path', () => {
    expect(resolveDeepLinkPath('https://app.practocore.com/main/matters/matter/abc123'))
      .toBe('/main/matters/matter/abc123');
    expect(resolveDeepLinkPath('https://app.practocore.com/main/settings?tab=billing'))
      .toBe('/main/settings?tab=billing');
  });

  test('rejects an https URL on a foreign host', () => {
    expect(resolveDeepLinkPath('https://evil.com/main/matters')).toBeNull();
  });

  test('rejects a protocol-relative custom-scheme escape', () => {
    expect(resolveDeepLinkPath('practocore:////evil.com/steal')).toBeNull();
  });

  test('rejects a non-http protocol', () => {
    expect(resolveDeepLinkPath('javascript://alert(1)')).toBeNull();
    expect(resolveDeepLinkPath('file:///etc/passwd')).toBeNull();
  });

  test('rejects empty and non-string input', () => {
    expect(resolveDeepLinkPath('')).toBeNull();
    expect(resolveDeepLinkPath(null)).toBeNull();
    expect(resolveDeepLinkPath(undefined)).toBeNull();
    expect(resolveDeepLinkPath(42)).toBeNull();
  });
});
