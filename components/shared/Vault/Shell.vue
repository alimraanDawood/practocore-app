<script lang="ts" setup>
import { ChevronLeft, Lock, Loader2, X, Check } from 'lucide-vue-next';
import { getEntitlements } from '~/services/vault';

// The frame every vault screen sits in: the entitlement gate and the header,
// which becomes a selection header while a selection is live. Each vault screen
// is its own route, so this is a component rather than a layout — but it is the
// same frame around each of them.
const props = withDefaults(defineProps<{
  title: string;
  /** Show the phone back arrow (every screen except the vault home). */
  back?: boolean;
  /**
   * This screen renders its own band directly below the header — the library's
   * path bar. The header then becomes the top half of one muted block instead of
   * a bar of its own: no closing border, and no title, because the path below
   * already ends in the folder the title would have named. Saying it twice, once
   * truncated, is the clutter this removes.
   */
  band?: boolean;
  /**
   * Something below the header continues its band — the library's path bar — so
   * the header must not close itself off with a border. Without this a `band`
   * header still draws one, which is what the search screen wants.
   */
  flush?: boolean;
}>(), { back: false });

// Cached across vault screens: the answer cannot change between two clicks, and
// a fresh check per navigation makes every screen flash its loading state.
const checked = useState('vault-entitlement-checked', () => false);
const enabled = useState('vault-entitlement', () => false);
const checking = ref(!checked.value);

onMounted(async () => {
  if (checked.value) { checking.value = false; return; }
  try { enabled.value = (await getEntitlements()).vaults; } catch { enabled.value = false; }
  checked.value = true;
  checking.value = false;
});

const { back: goBack } = useTabHistory();

// While a selection is live the header stops being a place and becomes the
// selection itself — count, select-all, and the way out. That is the phone
// file-manager idiom, and it beats a floating bar carrying all three: the
// count sits where the title was, so nothing overlaps the list.
const selection = useVaultSelectionUi();
</script>

<template>
  <!-- `min-w-0` + `overflow-hidden`: the app shell's <SidebarInset> is a flex item
       with the default `min-width: auto`, so its min-content floor is whatever is
       inside it — and anything here that is intrinsically wide (a shelf of cards,
       a grid) would push the whole panel past the viewport and get clipped rather
       than scroll. Capping the contribution at zero here means the vault fits the
       space it is given, whatever it puts in it. -->
  <div class="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden border-x">
    <!-- ── Header ───────────────────────────────────────────────────────────
         Below lg it is the phone's navigation bar; from lg up the rail is always
         on screen, so the arrow would be a second way to do what the rail
         already does and is left out. -->
    <header
      v-if="selection"
      class="flex shrink-0 items-center gap-3 border-b p-3 sm:px-4"
      :class="band ? 'bg-muted/50 lg:bg-transparent' : ''">
      <!-- Select-all, in the corner the navigation usually occupies. Tapping it
           when everything is already selected clears — one control, both ways,
           which is why it is a checkbox and not a button labelled "Select all". -->
      <button
        class="flex shrink-0 items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-xs font-medium transition-colors"
        :class="selection.allSelected
          ? 'border-primary/40 bg-primary/10 text-foreground'
          : 'border-border text-muted-foreground hover:bg-accent'"
        :aria-pressed="selection.allSelected"
        :aria-label="selection.allSelected ? 'Deselect all' : 'Select all'"
        title="Select all"
        @click="selection.toggleAll()">
        <span
          class="grid size-4 place-items-center rounded-full transition-colors"
          :class="selection.allSelected
            ? 'bg-primary text-primary-foreground'
            : 'text-transparent ring-1 ring-muted-foreground/50'">
          <Check class="size-2.5" stroke-width="4" />
        </span>
        All
      </button>

      <h1 class="min-w-0 flex-1 truncate text-lg font-semibold">
        {{ selection.count }} selected
      </h1>

      <button
        class="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent"
        title="Clear selection"
        @click="selection.clear()">
        <X class="size-5" />
      </button>
    </header>

    <header
      v-else
      class="flex shrink-0 items-center gap-2 p-3 sm:px-4"
      :class="[
        band ? 'bg-muted/50 lg:bg-transparent' : '',
        band && flush ? 'lg:border-b' : 'border-b',
      ]">
      <SidebarTrigger v-if="!back" class="lg:hidden" />
      <!-- At every width, not just on a phone. With the desktop rail gone there
           was no way back out of a library except the path bar's small root
           button, and a header with a title and no way to leave it is a dead
           end. It walks the app's tab history, so from a folder it steps up one
           level and from a library root it lands back on the vault home — the
           same thing the phone's arrow and its hardware back already do. -->
      <button
        v-else
        class="-ml-1 rounded-md p-1.5 text-muted-foreground hover:bg-accent"
        title="Back"
        @click="goBack()">
        <ChevronLeft class="size-5" />
      </button>

      <!-- A screen may put a control where its title would be — the search box.
           It then owns the whole middle of the header. -->
      <div v-if="$slots.title" class="min-w-0 flex-1">
        <slot name="title" />
      </div>
      <template v-else>
        <h1
          class="ibm-plex-serif min-w-0 flex-1 truncate text-xl font-semibold"
          :class="band ? 'hidden lg:block' : ''">
          {{ title }}
        </h1>
        <!-- Without a title there is nothing to push the actions right. -->
        <span v-if="band" class="flex-1 lg:hidden" />
      </template>

      <!-- Screen-specific header actions (upload, new folder, search). -->
      <slot name="actions" />
    </header>

    <div v-if="checking" class="p-3">
      <div class="flex w-full items-center gap-2 rounded-xl border px-4 py-6 text-sm text-muted-foreground">
        <Loader2 class="size-4 animate-spin" /> Loading your vault…
      </div>
    </div>

    <div v-else-if="!enabled" class="p-3">
      <div class="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
        <div class="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <Lock class="size-6" />
        </div>
        <p class="text-sm font-semibold">Vault isn't enabled yet</p>
        <p class="max-w-sm text-xs text-muted-foreground">
          The Vault turns your case files into AI-searchable knowledge. It isn't enabled on this
          account — if you're on a firm plan, ask your organisation admin to enable it.
        </p>
      </div>
    </div>

    <!-- No second sidebar on desktop. The rail listed the categories and the
         libraries, which is exactly what the vault home already shows as cards,
         and inside a library the path bar navigates the folders — so it spent a
         permanent 16rem of width restating the panel beside it. -->
    <main v-else class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <slot />
    </main>
  </div>
</template>
