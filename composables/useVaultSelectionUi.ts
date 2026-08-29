/**
 * The selection state a vault screen publishes so the frame around it can react:
 * the shell swaps its header for a selection header, and the add FAB gets out of
 * the way of the action bar.
 *
 * It is a module singleton rather than provide/inject because the components that
 * need it are not descendants of the one that would provide it — Explorer, FlatList
 * and AddFab are all passed to Shell as slot content, so their parent instance is
 * the *page*, and Shell's provide would never reach them. Only one vault screen is
 * mounted at a time, so a single slot is enough; whoever owns a live selection
 * registers, and clears on unmount.
 */
export interface VaultSelectionUi {
  count: number;
  /** How many rows are on screen — the shell's "All" toggle needs the total. */
  total: number;
  allSelected: boolean;
  clear: () => void;
  toggleAll: () => void;
}

const state = ref<VaultSelectionUi | null>(null);

/** Read-only view, for the shell header and the FAB. */
export function useVaultSelectionUi() {
  return computed(() => state.value);
}

/**
 * Publish a screen's selection. `get` is re-read reactively, so callers hand over
 * computeds rather than snapshots.
 *
 * A live selection also registers on the overlay stack, which is what the Android
 * hardware/gesture back consults first (see `useBackButton`): back clears the
 * selection instead of leaving the folder, the way every phone file manager
 * behaves. It sits on the same stack as dialogs and menus, so an open menu is
 * still dismissed before the selection underneath it.
 *
 * A pending MOVE is deliberately not registered: back is how you walk up folders
 * while carrying items, so making it cancel the move would take away the
 * navigation the move exists to use.
 */
export function provideVaultSelectionUi(get: () => VaultSelectionUi | null) {
  const overlays = useOverlayStack();
  let handle: number | null = null;

  const release = () => {
    if (handle !== null) { overlays.unregister(handle); handle = null; }
  };

  watchEffect(() => {
    state.value = get();
    const live = !!state.value;
    if (live && handle === null) {
      handle = overlays.register(() => state.value?.clear());
    } else if (!live) {
      release();
    }
  });

  onScopeDispose(() => { state.value = null; release(); });
}
