/**
 * Continuous scroll or one page at a time, remembered per browser.
 *
 * Shared by every in-app document reader (PDF and Word) and stored under the key
 * the citation reader has always used, so the choice follows a person across
 * surfaces rather than each viewer having its own idea of how they like to read.
 */
export type DocViewMode = 'scroll' | 'paged';

const MODE_KEY = 'practoai_citation_pdf_mode';

export function useDocViewMode() {
  // Continuous scroll is the default: it is how every PDF reader behaves, and
  // paging is the deliberate choice.
  const mode = ref<DocViewMode>('scroll');
  if (import.meta.client) {
    try {
      const saved = localStorage.getItem(MODE_KEY);
      if (saved === 'scroll' || saved === 'paged') mode.value = saved;
    } catch { /* private mode */ }
  }

  function setMode(next: DocViewMode) {
    if (mode.value === next) return;
    mode.value = next;
    try { localStorage.setItem(MODE_KEY, next); } catch { /* private mode */ }
  }

  return { mode, setMode };
}
