<template>
  <DefineTemplate>
    <ProjectsSideBar />
  </DefineTemplate>

  <div class="block xs:hidden" v-if="!block">
    <Sheet v-model:bind="_open">
      <SheetTrigger>
        <slot />
      </SheetTrigger>

      <SheetContent class="w-[85vw]" side="left">
        <ReuseTemplate />
      </SheetContent>
    </Sheet>
  </div>

  <div @click="togglePageSideBar" v-if="!block" class="hidden xs:block">
    <slot />
  </div>

  <XyzTransition>
    <div v-if="_open && block !== true" class="xyz-nested hidden xs:flex flex-col fixed top-0 z-20 left-20 w-full h-[100dvh]">
      <button @click="_open = false" xyz="fade" class="xyz-nested bg-black/70 w-full h-full fixed top-0 left-20"></button>
      <div xyz="left-100%" class="xyz-nested flex flex-col bg-background w-[50vw] h-full z-25 border-l">
        <ReuseTemplate />
      </div>
    </div>
  </XyzTransition>

  <ReuseTemplate v-if="block" />

</template>

<script setup>
import { Plus, FileText } from 'lucide-vue-next';
import ProjectsSideBar from "~/components/shared/PageSideBar/SideBars/ProjectsSideBar/ProjectsSideBar.vue";
const [DefineTemplate, ReuseTemplate] = createReusableTemplate();
const _open = ref(false);

const props = defineProps(['block']);

const togglePageSideBar = () => {
  _open.value = !_open.value;
}
</script>