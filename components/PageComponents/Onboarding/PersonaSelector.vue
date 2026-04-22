<script setup lang="ts">
import {BriefcaseBusiness} from "lucide-vue-next";

type Persona = 'SOLO' | 'JOIN' | 'ORG';

const props = defineProps<{
  modelValue?: Persona;
}>();

const emits = defineEmits<{
  (e: 'update:modelValue', value: Persona): void;
}>();

const registerAs = computed(() => props.modelValue || 'SOLO');

const selectPersona = (persona: Persona) => {
  emits('update:modelValue', persona);
};
</script>

<template>
  <div class="flex flex-col items-center text-center gap-5">
    <span class="font-semibold ibm-plex-serif text-xl">Hi! How are you setting up PractoCore today?</span>

    <div class="flex flex-col gap-2 max-w-lg">
      <button @click="selectPersona('SOLO')" class="flex gap-4 disabled:opacity-50 flex-row items-start text-left p-3 border-2 rounded-lg ring-transparent" :class="{ '!ring-tertiary bg-tertiary/5 border-tertiary': registerAs === 'SOLO' }">
        <div class="flex flex-col w-full">
          <span class="text-lg font-semibold">Join PractoCore Solo</span>
          <span class="text-sm text-muted-foreground">I'm a solo litigator setting up my own practice</span>
        </div>

        <div class="size-4 ring-2 ring-muted-foreground/20 rounded-full bg-muted shrink-0 grid place-items-center my-auto" :class="{ 'ring-tertiary': registerAs === 'SOLO' }">
          <div class="size-3 bg-transparent rounded-full" :class="{ '!bg-tertiary': registerAs === 'SOLO' }"></div>
        </div>
      </button>

      <button @click="selectPersona('JOIN')" class="flex gap-4 disabled:opacity-50 flex-row items-start text-left p-3 border-2 rounded-lg ring-transparent" :class="{ '!ring-tertiary bg-tertiary/5 border-tertiary': registerAs === 'JOIN' }">
        <div class="flex flex-col w-full">
          <span class="text-lg font-semibold">Join my law firm</span>
          <span class="text-sm text-muted-foreground">I've been invited to join my firm's workspace (this option is pre-selected if they arrived via an invite link)</span>
        </div>

        <div class="size-4 ring-2 ring-muted-foreground/20 rounded-full bg-muted shrink-0 grid place-items-center my-auto" :class="{ 'ring-tertiary': registerAs === 'JOIN' }">
          <div class="size-3 bg-transparent rounded-full" :class="{ '!bg-tertiary': registerAs === 'JOIN' }"></div>
        </div>
      </button>

      <button @click="selectPersona('ORG')" class="flex gap-4 disabled:opacity-50 flex-row items-start text-left p-3 border-2 rounded-lg ring-transparent" :class="{ '!ring-tertiary bg-tertiary/5 border-tertiary': registerAs === 'ORG' }">
        <div class="flex flex-col w-full">
          <span class="text-lg font-semibold">Register my law firm</span>
          <span class="text-sm text-muted-foreground">I'm setting up PractoCore for my law firm</span>
        </div>

        <div class="size-4 ring-2 ring-muted-foreground/20 rounded-full bg-muted shrink-0 grid place-items-center my-auto" :class="{ 'ring-tertiary': registerAs === 'ORG' }">
          <div class="size-3 bg-transparent rounded-full" :class="{ '!bg-tertiary': registerAs === 'ORG' }"></div>
        </div>
      </button>
    </div>
  </div>
</template>