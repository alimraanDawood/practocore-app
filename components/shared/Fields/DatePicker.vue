<script lang="ts" setup>
// One date control for the whole app: a shadcn Calendar in a popover, bound to a
// plain 'YYYY-MM-DD' string.
//
// It replaces <input type="date">, which renders differently in every browser and
// in the Tauri and Capacitor webviews, and whose dd/mm/yyyy spinner is the wrong
// affordance for a date months back — which is most of what a litigation date is.
// The stored value is unchanged, so nothing downstream sees a difference.
import { CalendarIcon } from 'lucide-vue-next';
import { DateFormatter, getLocalTimeZone, parseDate } from '@internationalized/date';

const props = withDefaults(defineProps<{
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Compact form for inline rows (a milestone line, a table cell). */
  size?: 'default' | 'sm';
  /** Offer a "Clear" action. Off by default — most callers want a required date. */
  clearable?: boolean;
  /** Side the popover opens on. */
  align?: 'start' | 'center' | 'end';
  /** Earliest selectable date, 'YYYY-MM-DD'. Days before it are disabled. */
  min?: string;
  /** Latest selectable date, 'YYYY-MM-DD'. */
  max?: string;
}>(), {
  placeholder: 'Pick a date',
  size: 'default',
  clearable: false,
  align: 'start',
});

const model = defineModel<string | undefined>();

const df = new DateFormatter('en-GB', { dateStyle: 'long' });
const dfShort = new DateFormatter('en-GB', { dateStyle: 'medium' });
const open = ref(false);

const value = computed(() => {
  const raw = String(model.value ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  // A well-formed but impossible date ('2026-02-31') still throws.
  try { return parseDate(raw); } catch { return undefined; }
});

// Bounds are optional and, like the value, tolerate junk: a malformed limit
// disables nothing rather than throwing inside the calendar.
function bound(raw?: string) {
  const value = String(raw ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  try { return parseDate(value); } catch { return undefined; }
}

const minValue = computed(() => bound(props.min));
const maxValue = computed(() => bound(props.max));

const label = computed(() => {
  if (!value.value) return props.placeholder;
  const d = value.value.toDate(getLocalTimeZone());
  return props.size === 'sm' ? dfShort.format(d) : df.format(d);
});

function set(v: any) {
  model.value = v ? v.toString() : '';
  open.value = false;
}

function clear() {
  model.value = '';
  open.value = false;
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        :id="id"
        variant="outline"
        :disabled="disabled"
        class="justify-start px-3 font-normal"
        :class="[
          size === 'sm' ? 'h-8 gap-1.5 text-xs' : 'w-full',
          !value && 'text-muted-foreground',
        ]"
      >
        <span class="truncate">{{ label }}</span>
        <CalendarIcon :class="size === 'sm' ? 'size-3.5 opacity-50' : 'ms-auto size-4 opacity-50'" />
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-auto p-0" :align="align">
      <Calendar
        :model-value="value"
        :min-value="minValue"
        :max-value="maxValue"
        initial-focus
        @update:model-value="set"
      />
      <div v-if="clearable && value" class="border-t p-2">
        <Button variant="ghost" size="sm" class="w-full" @click="clear">Clear</Button>
      </div>
    </PopoverContent>
  </Popover>
</template>
