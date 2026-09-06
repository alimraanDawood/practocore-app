import { describe, expect, test } from 'bun:test';
import { normalizeResearchUrl } from './research-browser';

describe('normalizeResearchUrl', () => {
  test('keeps explicit web addresses', () => {
    expect(normalizeResearchUrl('https://ulii.org/')).toBe('https://ulii.org/');
    expect(normalizeResearchUrl('http://localhost:4173/case')).toBe('http://localhost:4173/case');
  });

  test('adds https to host-like input', () => {
    expect(normalizeResearchUrl('ulii.org/cases')).toBe('https://ulii.org/cases');
  });

  test('turns ordinary text into a search', () => {
    expect(normalizeResearchUrl('Uganda Evidence Act'))
      .toBe('https://www.google.com/search?q=Uganda%20Evidence%20Act');
  });
});
