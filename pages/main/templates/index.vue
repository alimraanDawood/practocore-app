<template>
    <div class="flex flex-col w-full items-center h-full overflow-hidden">
        <div class="flex flex-col w-full lg:w-[90vw] h-full">
            <div class="flex flex-col">
                <div class="flex flex-row w-full justify-between p-3">
                    <span class="ibm-plex-serif text-lg font-semibold">Templates</span>
                    <Button size="sm">
                        <Plus />
                        Create Template
                    </Button>
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
                <div xyz="fade left" v-if="activeTab === 'community'" class="flex flex-col w-full">
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
    
                        <div v-else class="p-3 flex flex-col lg:grid lg:grid-cols-3 space-y-3 shrink-0 h-full">
                            <div class="flex flex-col p-3 gap-3 overflow-hidden aspect-video border shrink-0 w-full rounded-lg bg-muted" v-for="template in templates?.items">
                                <span class="text-lg font-semibold ibm-plex-serif">{{ template.name }}</span>
                                <div class="flex flex-col w-full overflow-hidden relative">
                                    <span class="text-sm w-full">
                                        Lorem ipsum dolor sit amet consectetur adipisicing elit. Vitae exercitationem obcaecati inventore, officiis voluptas sint veritatis modi blanditiis nihil esse nobis aliquam praesentium, accusantium alias in facilis temporibus ducimus numquam placeat aliquid. Aspernatur, magnam quia quidem deleniti molestias libero sint placeat qui rem aperiam modi. Assumenda, aliquam aliquid quis ullam dolorem voluptas autem, blanditiis distinctio ipsum, magnam tempora! Ut ullam voluptatem nemo, quasi natus voluptas odio quidem amet? Atque recusandae dolorem molestias explicabo minus a error porro laborum. Suscipit delectus magni molestiae quas officiis. Officia accusamus culpa ut rem ad id cumque distinctio eos mollitia! At debitis omnis, sequi officiis ducimus, assumenda aliquid a nemo animi ipsum nulla sint voluptatibus ex. Atque ullam amet repudiandae quisquam tempora totam nemo ipsam quidem illum animi aliquid aspernatur iste aperiam consequatur, ex dolorum reprehenderit dolores corporis. Laboriosam asperiores culpa fugiat possimus corrupti incidunt, maxime a dolorum voluptatibus dicta non id consequatur magni dignissimos.
                                    </span>

                                    <div class="absolute h-5 bottom-0 left-0 w-full bg-gradient-to-t from-muted to-transparent"></div>
                                </div>
                                <div class="flex flex-row items-center justify-between gap-3">
                                    <div class="flex flex-row gap-2">
                                        <div class="flex flex-row text-sm font-semibold items-center gap-1">
                                            <CalendarIcon class="size-4" />
    
                                            {{ (() => { const d = new Date(template.created); return `${String(d.getFullYear()).slice(-2)}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })() }}
                                        </div>

                                    </div>

                                    <Button class="" size="sm" variant="outline">Use Template</Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
    
                <!-- Your Templates -->
                <div xyz="fade right" v-else class="flex flex-col w-full p-3">
                    <!-- replace with actual user templates list -->
                    <p class="text-sm text-muted-foreground">Your templates will appear here.</p>
                </div>
            </XyzTransition>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue';
import { CalendarIcon, Plus } from 'lucide-vue-next';
import { getTemplates } from '~/services/templates';

definePageMeta({
    layout: 'no-mobile-top-bar'
});

const templates = ref(null);
const loading = ref(false);

onMounted(async () => {
    loading.value = true;
    templates.value = await getTemplates(1, 10, {});
    loading.value = false;
});

const activeTab = ref('community');
const categories = ['Litigation', 'Corporate', 'Employment', 'IP', 'Real Estate'];

function setTab(tab) {
    activeTab.value = tab;
}
</script>