import type { ClassValue } from "clsx"
import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Updater } from "@tanstack/vue-table"
import type { Ref } from "vue"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function valueUpdater<T extends Updater<any>>(updaterOrValue: T, ref: Ref) {
  ref.value = typeof updaterOrValue === 'function'
    ? updaterOrValue(ref.value)
    : updaterOrValue
}

/**
 * Truncate in the MIDDLE, keeping both ends. Use for filenames: vault documents
 * are routinely long and sometimes a bare content hash, and end-truncation
 * throws away the extension — the only part besides the opening characters that
 * a reader can still use to tell one from another.
 */
export function middleTruncate(text: string, max: number): string {
  if (!text || text.length <= max) return text || ''
  const head = Math.ceil((max - 1) / 2)
  const tail = Math.floor((max - 1) / 2)
  return text.slice(0, head) + '…' + text.slice(text.length - tail)
}
