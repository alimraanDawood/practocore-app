<template>
    <div class="flex flex-col w-full items-center overflow-hidden h-full">
        <div class="flex flex-col w-full relative lg:w-fit h-full">
            <div class="flex flex-row xs:hidden w-full items-center justify-between p-3 border-b">
                <Button @click="$router.go(-1)" size="icon" variant="ghost">
                    <ArrowLeft />
                </Button>
                
                <div class="flex flex-row relative w-full">
                    <marquee class="text-lg font-semibold ibm-plex-serif">{{ template?.name }}</marquee>
                    <div class="h-full w-5 absolute right-0 top-0 bg-gradient-to-l from-background to-transparent"></div>
                </div>
    
                <div class="flex flex-row gap-2 items-center">
                    <SharedDarkModeSwitch />
                    <Button size="icon" variant="secondary">
                        <Bell />
                    </Button>
                </div>
            </div>
    
            <div class="flex flex-col w-full h-full overflow-y-scroll p-3">
                <div class="flex flex-col gap-2">
                    <span class="text-xl ibm-plex-serif">{{ template?.name }}</span>
    
                    <div class="flex flex-row w-full">
                        <div class="flex flex-row text-sm font-semibold items-center gap-1">
                            <CalendarIcon class="size-4" />
    
                            {{(() => { const d = new Date(template?.created); return `${String(d.getFullYear()).slice(-2)}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2,'0')}` })() }}
                        </div>
                    </div>
    
                    <span>Created By: <b class="ibm-plex-serif font-semibold">{{ template?.organisation === '' ? template?.author === '' ? 'PractoCore Team' : template?.authorName : template?.organisation  }}</b></span>

                    <div class="flex flex-row gap-1">
                        <SharedMattersCreateMatter :template="template">
                            <Button size="sm">Use Template</Button>
                        </SharedMattersCreateMatter>

                        <NuxtLink :to="`/main/templates/template/${template?.id}/editor`">
                          <Button size="sm" variant="outline">Edit Template</Button>
                        </NuxtLink>
                    </div>
                </div>

    
                <div class="prose prose-pink dark:prose-invert mt-5 prose-code:bg-muted prose-code:p-3 prose-code:flex prose-code:flex-col prose-code:text-muted-foreground prose-code:border prose-code:rounded-lg" v-html="template?.description"></div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ArrowLeft, Bell, CalendarIcon } from 'lucide-vue-next';
import { getTemplate } from '~/services/templates';

definePageMeta({
    layout: 'no-mobile-nav'
});

const template = ref(null);

onMounted(async () => {
    template.value = await getTemplate(useRoute().params.templateId);
})
</script>