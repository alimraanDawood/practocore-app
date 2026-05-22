<script lang="ts">
import { defineComponent, onUnmounted, watch } from 'vue'

/**
 * Renderless helper that keeps a single overlay registered in the global
 * `useOverlayStack` while it is open. Dropped into each shadcn modal root
 * wrapper (Dialog, Sheet, Drawer, AlertDialog, Popover, DropdownMenu) via the
 * root's `v-slot`, so every overlay automatically participates in Android
 * back-button handling.
 *
 * `dismiss` should close the overlay through its own state — e.g. the reka-ui
 * root slot's `close()`, or `emit('update:open', false)` for controlled ones.
 */
export default defineComponent({
  name: 'OverlayBackTracker',
  props: {
    open: { type: Boolean, default: false },
    dismiss: { type: Function, required: true },
  },
  setup(props) {
    const { register, unregister } = useOverlayStack()
    let id: number | null = null

    const add = () => {
      if (id === null) id = register(() => (props.dismiss as () => void)())
    }
    const remove = () => {
      if (id !== null) {
        unregister(id)
        id = null
      }
    }

    watch(
      () => props.open,
      isOpen => (isOpen ? add() : remove()),
      { immediate: true },
    )

    // Safety net: if the overlay unmounts while still "open" (e.g. closed by a
    // route change), make sure we don't leave a stale entry behind.
    onUnmounted(remove)

    return () => null
  },
})
</script>
