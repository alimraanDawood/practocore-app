import { reactive, ref, watch } from 'vue'

const TAB_ROOTS: Record<string, string> = {
  main: '/main',
  matters: '/main/matters',
  calendar: '/main/calendar',
  vault: '/main/vault',
  lawyers: '/main/lawyers',
  settings: '/main/settings',
  ai: '/main/ai',
}

export function getTabForPath(path: string): string | null {
  if (path.startsWith('/main/matters')) return 'matters'
  if (path.startsWith('/main/calendar')) return 'calendar'
  if (path.startsWith('/main/vault')) return 'vault'
  if (path.startsWith('/main/lawyers')) return 'lawyers'
  if (path.startsWith('/main/settings')) return 'settings'
  if (path.startsWith('/main/ai')) return 'ai'
  if (path === '/main' || path === '/main/') return 'main'
  return null
}

// ── Authoritative navigation model ──────────────────────────────────────────
// This model — not the browser's native history — is the source of truth for
// back navigation inside the tabbed app shell.
//
//  • tabStacks: each tab keeps its OWN page stack, so switching between tabs
//    never linearises one tab's depth into another's. Back inside a tab pops
//    that tab's stack.
//  • tabOrder: the order tabs were entered (most-recent last). When you back
//    out of a tab's root, you return to the previously-active tab — this is
//    what makes "assistant → settings → billing → back → settings → back →
//    assistant" unwind correctly across tabs.
//
// Module-level state so the stacks survive component remounts and are shared by
// every useTabHistory() caller.
const tabStacks = reactive<Record<string, string[]>>({
  main: ['/main'],
  matters: ['/main/matters'],
  calendar: ['/main/calendar'],
  vault: ['/main/vault'],
  lawyers: ['/main/lawyers'],
  settings: ['/main/settings'],
  ai: ['/main/ai'],
})

const tabOrder = ref<string[]>([])

const activeTab = ref<string>('main')

// The route watcher is registered exactly once — the state above is shared, so
// registering it per-caller would double-record every navigation.
let watcherReady = false

export function useTabHistory() {
  const router = useRouter()
  const route = useRoute()

  // Record forward navigation into the model. Programmatic navigations issued
  // by back()/navigateToTab already update the model first, so the guards here
  // (top-of-stack already matches, tab already active) make those a no-op.
  if (!watcherReady) {
    watcherReady = true
    watch(
      () => route.path,
      (newPath) => {
        const tab = getTabForPath(newPath)
        if (!tab) return

        const stack = tabStacks[tab]
        if (stack[stack.length - 1] !== newPath) stack.push(newPath)

        if (activeTab.value !== tab) {
          activeTab.value = tab
          const i = tabOrder.value.indexOf(tab)
          if (i !== -1) tabOrder.value.splice(i, 1)
          tabOrder.value.push(tab)
        } else if (!tabOrder.value.includes(tab)) {
          // First navigation into the initially-active tab.
          tabOrder.value.push(tab)
        }
      },
      { immediate: true }
    )
  }

  // Tap a tab in the bottom nav: jump to where that tab was left off (its
  // stack top), or the tab root if it has never been visited.
  const navigateToTab = (tabName: string) => {
    const stack = tabStacks[tabName]
    const target = stack[stack.length - 1] ?? TAB_ROOTS[tabName]
    router.push(target)
  }

  // Back within the tab model. Returns false only when there is nowhere left
  // to go (the last remaining tab, sitting at its root) — the caller then
  // exits the app or falls back to native history for non-tab routes.
  const back = (): boolean => {
    const tab = getTabForPath(route.path)
    if (!tab) return false

    const stack = tabStacks[tab]

    // 1. Within-tab back: pop to the previous page in this same tab.
    if (stack.length > 1) {
      stack.pop()
      router.push(stack[stack.length - 1])
      return true
    }

    // 2. Cross-tab back: we're at this tab's root. Drop it from the visit
    //    order (and reset its stack so a later re-entry starts clean), then
    //    return to whatever tab was active before it.
    const i = tabOrder.value.lastIndexOf(tab)
    if (i !== -1) tabOrder.value.splice(i, 1)
    tabStacks[tab] = [TAB_ROOTS[tab]]

    const prevTab = tabOrder.value[tabOrder.value.length - 1]
    if (!prevTab) return false

    activeTab.value = prevTab
    const prevStack = tabStacks[prevTab]
    router.push(prevStack[prevStack.length - 1])
    return true
  }

  // Unified back for every caller (hardware back button and on-screen back
  // buttons alike). Tab model first; native history only for orphan routes
  // that live outside the tab shell.
  const goBack = () => {
    if (back()) return
    if (window.history.state?.back) router.back()
    else router.push('/main')
  }

  return { navigateToTab, goBack, back, activeTab, tabStacks, tabOrder }
}
