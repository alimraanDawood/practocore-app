import { invoke } from '@tauri-apps/api/core';

export interface ResearchBrowserState {
  url: string;
  title: string;
  selection: string;
  text?: string;
  truncated?: boolean;
}

export interface ResearchPageResolution {
  mode: 'iframe' | 'reader' | 'pdf' | 'external';
  url: string;
  contentType: string;
  body?: string;
  bytes?: number[];
  reason?: string;
}

export function normalizeResearchUrl(value: string): string {
  const input = value.trim();
  if (!input) return '';
  if (/^https?:\/\//i.test(input)) return input;
  if (/^[\w.-]+(?::\d+)?(?:\/.*)?$/i.test(input) && (input.includes('.') || input.startsWith('localhost'))) {
    return `https://${input}`;
  }
  return `https://www.google.com/search?q=${encodeURIComponent(input)}`;
}

export function resolveResearchPage(url: string, forceReader = false): Promise<ResearchPageResolution> {
  return invoke('research_page_resolve', { url, forceReader });
}
