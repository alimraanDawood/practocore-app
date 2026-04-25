import { reactive, ref, watch } from 'vue'

const TAB_ROOTS: Record<string, string> = {
  main: '/main',
  matters: '/main/matters',
  calendar: '/main/calendar',
  lawyers: '/main/lawyers',
  settings: '/main/settings',
}

function getTabForPath(path: string): string | null {
  if (path.startsWith('/main/matters')) return 'matters'
  if (path.startsWith('/main/calendar')) return 'calendar'
  if (path.startsWith('/main/lawyers')) return 'lawyers'
  if (path.startsWith('/main/settings')) return 'settings'
  if (path === '/main' || path === '/main/') return 'main'
  return null
}

// Module-level state so stacks survive component remounts
const tabStacks = reactive<Record<string, string[]>>({
  main: ['/main'],
  matters: ['/main/matters'],
  calendar: ['/main/calendar'],
  lawyers: ['/main/lawyers'],
  settings: ['/main/settings'],
})

const activeTab = ref<string>('main')

export function useTabHistory() {
  const router = useRouter()
  const route = useRoute()

  watch(
    () => route.path,
    (newPath) => {
      const tab = getTabForPath(newPath)
      if (!tab) return
      activeTab.value = tab
      const stack = tabStacks[tab]
      if (stack[stack.length - 1] !== newPath) {
        stack.push(newPath)
      }
    },
    { immediate: true }
  )

  const navigateToTab = (tabName: string) => {
    const stack = tabStacks[tabName]
    const target = stack[stack.length - 1] ?? TAB_ROOTS[tabName]
    router.push(target)
  }

  const goBackInTab = (): boolean => {
    const tab = getTabForPath(route.path)
    if (!tab) return false
    const stack = tabStacks[tab]
    if (stack.length <= 1) return false
    stack.pop()
    router.push(stack[stack.length - 1])
    return true
  }

  return { navigateToTab, goBackInTab, activeTab, tabStacks }
}