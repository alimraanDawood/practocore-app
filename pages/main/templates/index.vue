<template>
  <div class="flex flex-col w-full items-center h-full overflow-hidden">
    <div class="flex flex-col w-full lg:w-[90vw] h-full">
      <div class="flex flex-col">
        <div class="flex flex-row w-full justify-between p-3">
          <span class="ibm-plex-serif text-lg font-semibold">Templates</span>

          <SharedTemplatesCreateTemplate>
            <Button size="sm">
              <Plus/>
              Create Template
            </Button>
          </SharedTemplatesCreateTemplate>
        </div>

        <div class="flex flex-row border-b p-3 pb-0 gap-3" role="tablist" aria-label="Templates tabs">
          <button
              role="tab"
              :aria-selected="activeTab === 'community'"
              :class="['text-sm pb-1 border-b-4', activeTab === 'community' ? 'font-semibold border-primary' : 'border-transparent']"
              @click="setTab('community')"
          >
            Community
          </button>
          <button
              v-if="getSignedInUser()?.organisation"
              role="tab"
              :aria-selected="activeTab === 'organisation'"
              :class="['text-sm pb-1 border-b-4', activeTab === 'organisation' ? 'font-semibold border-primary' : 'border-transparent']"
              @click="setTab('organisation')"
          >
            Organisation
          </button>
          <button
              role="tab"
              :aria-selected="activeTab === 'your-templates'"
              :class="['text-sm pb-1 border-b-4', activeTab === 'your-templates' ? 'font-semibold border-primary' : 'border-transparent']"
              @click="setTab('your-templates')"
          >
            Your Templates
          </button>
        </div>
      </div>

      <XyzTransition mode="out-in" class="flex flex-col w-full h-full overflow-hidden">
        <!-- Community -->
        <div :xyz="$viewport.isGreaterOrEquals('customxs') ? 'fade' : 'fade left'" v-if="activeTab === 'community'"
             class="flex flex-col w-full">
          <div class="flex flex-row shrink-0 w-full no-scrollbar overflow-x-scroll p-3 gap-3">
            <Button size="sm" variant="secondary">All</Button>

            <Button
                v-for="category in categories"
                :key="category"
                size="sm"
                variant="ghost"
            >
              {{ category }}
            </Button>
          </div>

          <!-- community content placeholder -->
          <div class="flex flex-col w-full h-full overflow-y-scroll">
            <div v-if="loading" class="p-3 grid grid-cols-1 lg:grid-cols-3 gap-3 h-full">
              <div class="border aspect-video w-full rounded-lg bg-muted animate-pulse" v-for="i in 9"></div>
            </div>

            <div v-else-if="templates?.items?.length > 0" class="p-3 flex flex-col lg:grid lg:grid-cols-3 gap-3 shrink-0 h-full">
              <NuxtLink :to="`/main/templates/template/${template.id}`" v-for="template in templates?.items">
                <button
                    class="flex text-left flex-col p-3 gap-3 overflow-hidden aspect-video border shrink-0 w-full rounded-lg bg-muted">
                  <span class="text-lg font-semibold ibm-plex-serif">{{ template.name }}</span>
                  <div class="flex flex-col w-full h-full overflow-hidden relative">
                    <div
                        class="text-sm w-full prose text-foreground prose-headings:text-foreground prose-h1:text-foreground prose-h1:ibm-plex-serif prose-headings:ibm-plex-serif"
                        v-html="template.description">

                    </div>

                    <div class="absolute h-5 bottom-0 left-0 w-full bg-gradient-to-t from-muted to-transparent"></div>
                  </div>
                  <div class="flex flex-row items-center justify-between gap-3">
                    <div class="flex flex-row gap-2">
                      <div class="flex flex-row text-sm font-semibold items-center gap-1">
                        <CalendarIcon class="size-4"/>

                        {{
                          (() => {
                            const d = new Date(template.created);
                            return `${String(d.getFullYear()).slice(-2)}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                          })()
                        }}
                      </div>

                    </div>

                    <Button class="" size="sm" variant="outline">Use Template</Button>
                  </div>
                </button>
              </NuxtLink>
            </div>

            <div v-else class="flex flex-col w-full gap-1 h-full items-center justify-center p-3">
              <CircleX class="size-10 mb-3" />
              <span class="text-xl font-semibold ibm-plex-serif">No Templates Found</span>
              <span class="text-muted-foreground">We were unable to find any templates.</span>
              <SharedTemplatesCreateTemplate>
                <Button size="sm">Create Template</Button>
              </SharedTemplatesCreateTemplate>
            </div>
          </div>
        </div>

        <!-- Your Templates -->
        <div :xyz="$viewport.isGreaterOrEquals('customxs') ? 'fade' : 'fade right'" v-else-if="activeTab === 'your-templates'"
             class="flex flex-col w-full p-3 overflow-y-scroll">
          <!-- replace with actual user templates list -->
          <div v-if="loading" class="p-3 grid grid-cols-1 lg:grid-cols-3 gap-3 h-full">
            <div class="border aspect-video w-full rounded-lg bg-muted animate-pulse" v-for="i in 9"></div>
          </div>

          <div v-else-if="templates?.items?.length > 0" class="flex flex-col lg:grid lg:grid-cols-3 gap-3 shrink-0 h-full">
            <NuxtLink :to="`/main/templates/template/${template.id}`" v-for="template in templates?.items">
              <button
                  class="flex text-left flex-col p-3 gap-3 overflow-hidden aspect-video border shrink-0 w-full rounded-lg bg-muted">
                <span class="text-lg font-semibold ibm-plex-serif">{{ template.name }}</span>
                <div class="flex flex-col w-full h-full overflow-hidden relative">
                  <div
                      class="text-sm w-full prose text-foreground prose-headings:text-foreground prose-h1:text-foreground prose-h1:ibm-plex-serif prose-headings:ibm-plex-serif"
                      v-html="template.description">

                  </div>

                  <div class="absolute h-5 bottom-0 left-0 w-full bg-gradient-to-t from-muted to-transparent"></div>
                </div>
                <div class="flex flex-row items-center justify-between gap-3">
                  <div class="flex flex-row gap-2">
                    <div class="flex flex-row text-sm font-semibold items-center gap-1">
                      <CalendarIcon class="size-4"/>

                      {{
                        (() => {
                          const d = new Date(template.created);
                          return `${String(d.getFullYear()).slice(-2)}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                        })()
                      }}
                    </div>

                  </div>

                  <Button class="" size="sm" variant="outline">Use Template</Button>
                </div>
              </button>
            </NuxtLink>
          </div>

          <div v-else class="flex flex-col w-full gap-1 h-full items-center justify-center p-3">
            <CircleX class="size-10 mb-3" />
            <span class="text-xl font-semibold ibm-plex-serif">No Templates Found</span>
            <span class="text-muted-foreground">We were unable to find any templates.</span>
            <SharedTemplatesCreateTemplate>
              <Button size="sm">Create Template</Button>
            </SharedTemplatesCreateTemplate>
          </div>
        </div>

        <div :xyz="$viewport.isGreaterOrEquals('customxs') ? 'fade' : 'fade'" v-else-if="activeTab === 'organisation'"
             class="flex flex-col w-full p-3 overflow-y-scroll">
          <!-- replace with actual user templates list -->
          <div v-if="loading" class="p-3 grid grid-cols-1 lg:grid-cols-3 gap-3 h-full">
            <div class="border aspect-video w-full rounded-lg bg-muted animate-pulse" v-for="i in 9"></div>
          </div>

          <div v-else-if="templates?.items?.length > 0" class="flex flex-col lg:grid lg:grid-cols-3 gap-3 shrink-0 h-full">
            <NuxtLink :to="`/main/templates/template/${template.id}`" v-for="template in templates?.items">
              <button
                  class="flex text-left flex-col p-3 gap-3 overflow-hidden aspect-video border shrink-0 w-full rounded-lg bg-muted">
                <span class="text-lg font-semibold ibm-plex-serif">{{ template.name }}</span>
                <div class="flex flex-col w-full h-full overflow-hidden relative">
                  <div
                      class="text-sm w-full prose text-foreground prose-headings:text-foreground prose-h1:text-foreground prose-h1:ibm-plex-serif prose-headings:ibm-plex-serif"
                      v-html="template.description">

                  </div>

                  <div class="absolute h-5 bottom-0 left-0 w-full bg-gradient-to-t from-muted to-transparent"></div>
                </div>
                <div class="flex flex-row items-center justify-between gap-3">
                  <div class="flex flex-row gap-2">
                    <div class="flex flex-row text-sm font-semibold items-center gap-1">
                      <CalendarIcon class="size-4"/>

                      {{
                        (() => {
                          const d = new Date(template.created);
                          return `${String(d.getFullYear()).slice(-2)}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                        })()
                      }}
                    </div>

                  </div>

                  <Button class="" size="sm" variant="outline">Use Template</Button>
                </div>
              </button>
            </NuxtLink>
          </div>

          <div v-else class="flex flex-col w-full gap-1 h-full items-center justify-center p-3">
            <CircleX class="size-10 mb-3" />
            <span class="text-xl font-semibold ibm-plex-serif">No Templates Found</span>
            <span class="text-muted-foreground">We were unable to find any templates.</span>
            <SharedTemplatesCreateTemplate>
              <Button size="sm">Create Template</Button>
            </SharedTemplatesCreateTemplate>
          </div>
        </div>
      </XyzTransition>
    </div>
  </div>
</template>

<script setup>
import {ref} from 'vue';
import {CalendarCheck, CircleX, CalendarIcon, Plus} from 'lucide-vue-next';
import {getTemplates, subscribeToTemplates} from '~/services/templates';
import {getSignedInUser} from "~/services/auth/index.js";

definePageMeta({
  layout: 'no-mobile-top-bar'
});

const templates = ref(null);
const loading = ref(false);

onMounted(async () => {
  await loadTemplates();

  subscribeToTemplates(loadTemplates);
});

const activeTab = ref('community');
const categories = ['Litigation', 'Corporate', 'Employment', 'IP', 'Real Estate'];

watch(activeTab, () => {
  loadTemplates();
});


const loadTemplates = async () => {
  loading.value = true;
  let filter = ''
  switch(activeTab.value) {
    case 'community':
      filter = 'isPublic = true';
      break;
    case 'your-templates':
      filter = `author = '${getSignedInUser()?.id}'`;
      break;
    case 'organisation':
      filter = `organisation = '${getSignedInUser()?.organisation}'`;
      break;
    default:
      filter = '';
      break;
  }
  templates.value = await getTemplates(1, 10, { filter: filter, expand: 'author'  });
  loading.value = false;
}

function setTab(tab) {
  activeTab.value = tab;
}
</script>