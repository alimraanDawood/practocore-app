<script setup lang="ts">
import { CheckIcon, ChevronsUpDownIcon } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {getCourts} from "~/services/matters";
import type { RecordModel } from "pocketbase";

const courts = ref<RecordModel[]>([]);

const props = defineProps(['modelValue']);
const emits = defineEmits(['update:modelValue']);

const open = ref(false)
const value = computed({
  get: () => props.modelValue,
  set: (value) => {
    emits('update:modelValue', value);
  }
})



onMounted(async () => {
  courts.value = (await getCourts(1, 1000, {}))?.items;
});

const selectedCourt = computed(() =>
    courts.value.find(court => court.id === value.value),
)

function selectCourt(selectedValue: string) {
  value.value = selectedValue === value.value ? '' : selectedValue
  open.value = false
}
</script>

<template>
  <Popover class="w-full" v-model:open="open">
    <PopoverTrigger as-child>
      <Button
          variant="outline"
          role="combobox"
          :aria-expanded="open"
          class="w-full border border-muted-foreground/60 justify-between"
      >
        {{ selectedCourt?.name || "Select Court..." }}
        <ChevronsUpDownIcon class="opacity-50" />
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-full p-0">
      <Command>
        <CommandInput class="h-9" placeholder="Search courts..." />
        <CommandList>
          <CommandEmpty>No court found.</CommandEmpty>
          <CommandGroup>
            <CommandItem
                v-for="court in courts"
                :key="court.id"
                :value="court.id"
                @select="(ev) => {
                selectCourt(ev.detail.value as string)
              }"
            >
              {{ court?.name }}
              <CheckIcon
                  :class="cn(
                  'ml-auto',
                  value === court.id ? 'opacity-100' : 'opacity-0',
                )"
              />
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>
