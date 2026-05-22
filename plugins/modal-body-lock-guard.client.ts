/**
 * Global safety net for the "page is unclickable after closing a dialog" bug.
 *
 * reka-ui (Dialog/Sheet/AlertDialog/DropdownMenu/Popover/Select) and vaul-vue
 * (Drawer) both lock the page while a modal is open by setting
 * `document.body.style.pointerEvents = 'none'`, then restore it on close.
 * When two of these layers from *different* libraries are nested, their
 * save/restore of the body style race and the lock can be left behind —
 * leaving the whole app unresponsive even though nothing is visibly open.
 *
 * Rather than refactor every nested-modal site by hand, this guard watches the
 * body lock and releases it whenever it is set but NO modal layer is actually
 * open. It keys off the stable `data-slot="*-content"` markers our shadcn-vue
 * components emit together with reka-ui's `data-state="open|closed"`.
 *
 * This is a backstop, not a license to nest modals carelessly — see the
 * nested-dialog guidance in the AI Chat component / CLAUDE.md.
 */

// Content slots whose open layer legitimately locks the body. Non-modal
// surfaces (tooltip, hover-card, accordion, tabs, sidebar, …) are excluded on
// purpose: they never set `pointer-events: none`, so an open one must not keep
// us from releasing a stuck lock.
const MODAL_OPEN_SELECTOR = [
  'dialog-content',
  'alert-dialog-content',
  'sheet-content',
  'drawer-content',
  'dropdown-menu-content',
  'dropdown-menu-sub-content',
  'context-menu-content',
  'context-menu-sub-content',
  'menubar-content',
  'menubar-sub-content',
  'popover-content',
  'select-content',
]
  .map(slot => `[data-slot="${slot}"][data-state="open"]`)
  .join(',');
// vaul-vue marks its drawer content with the `vaul-drawer` attribute.
const VAUL_OPEN_SELECTOR = '[vaul-drawer][data-state="open"]';

export default defineNuxtPlugin(() => {
  const body = document.body;
  let scheduled = false;

  function reconcile() {
    scheduled = false;
    // Only act on the stuck-lock symptom.
    if (body.style.pointerEvents !== 'none') return;
    // A modal is genuinely open — the lock is legitimate, leave it alone.
    if (document.querySelector(MODAL_OPEN_SELECTOR) || document.querySelector(VAUL_OPEN_SELECTOR)) return;
    // Nothing is open but the body is still locked → release it.
    body.style.removeProperty('pointer-events');
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(reconcile);
  }

  // React both to the lock being applied (body style) and to modals closing
  // (data-state flipping to "closed" anywhere in the tree).
  const observer = new MutationObserver(schedule);
  observer.observe(body, { attributes: true, attributeFilter: ['style'] });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-state'],
    subtree: true,
  });
});
