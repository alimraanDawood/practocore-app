<template>
  <div class="flex flex-col w-full h-full">
    {{ status }}
    <div class="flex flex-col gap-5 border-b border-foreground/40 p-5">
      <div class="flex flex-row gap-1">
        <span class="gold text-xl font-semibold">Your Projects</span>
      </div>

      <div class="flex flex-col gap-2">
        <CreateProject>
          <Button class="w-full">
            <Plus />

            New Project
          </Button>
        </CreateProject>

        <Button variant="secondary">
          <FileText />

          Templates
        </Button>
      </div>
    </div>
    <div class="flex flex-col w-full">
      <div class="flex flex-row justify-between last:border-b-0 border-b border-foreground/40 px-5 py-2">
        <button v-wave class="flex text-left w-full flex-row gap-3 items-center" @click="toggleArchived">
          <ChevronDown class="transition-all duration-300 ease-in-out" :class="{ 'rotate-180' : state.topExpanded === 'ARCHIVED' }" />

          <span class="gold font-semibold">Archived</span>
        </button>

        <div class="flex flex-row gap-2 items-center">
          <Button size="icon" variant="ghost">
            <Ellipsis />
          </Button>

          <Button size="icon" variant="ghost">
            <Plus />
          </Button>
        </div>
      </div>

      <div class="flex flex-col last:border-b-0 border-b border-foreground/40">
        <div class="flex flex-row justify-between w-full px-5 py-2">
          <button v-wave class="flex text-left w-full flex-row gap-3 items-center" @click="toggleProjects">
            <ChevronDown class="transition-all duration-300 ease-in-out" :class="{ 'rotate-180' : state.topExpanded === 'PROJECTS' }" />

            <span class="gold font-semibold">Projects</span>
          </button>

          <div class="flex flex-row gap-2 items-center">
            <Button size="icon" variant="ghost">
              <Ellipsis />
            </Button>

            <Button size="icon" variant="ghost">
              <Plus />
            </Button>
          </div>
        </div>

        <div class="flex flex-col w-full overflow-hidden transition-all duration-500 ease-in-out max-h-0" :class="{ 'max-h-96': state.topExpanded === 'PROJECTS' }">
          <div v-for="(project, index) in state?.projects?.items" class="flex flex-col">
            <div class="flex flex-row px-6 py-2 items-center" :class="{
                       '!bg-accent-success/10': index % 4 === 0 && state.projectSelected === index,
                       '!bg-accent-warning/10': index % 4 === 1 && state.projectSelected === index,
                       '!bg-accent-info/10': index % 4 === 2 && state.projectSelected === index,
                       '!bg-accent-error/10': index % 4 === 3 && state.projectSelected === index
                      }">
              <button @click="toggleProject(project.id)" class="flex flex-row items-center text-left w-full overflow-hidden gap-3"
              >
                <Folder :class="{
                 'stroke-accent-success fill-accent-success/20': index % 4 === 0,
                 'stroke-accent-warning fill-accent-warning/20': index % 4 === 1,
                 'stroke-accent-info fill-accent-info/20': index % 4 === 2,
                 'stroke-accent-error fill-accent-error/20': index % 4 === 3
                }" />

                <div class="w-full overflow-hidden">
                  <span class="whitespace-nowrap text-sm font-semibold">{{ project.name }}</span>
                </div>

                <ChevronDown class="transition-all duration-300 ease-in-out" :class="{ 'rotate-180' : state.projectExpanded === project.id }" />
              </button>
              <div class="shrink-0">
                <Button size="icon" class="size-7" variant="ghost">
                  <Plus />
                </Button>
              </div>
            </div>
            <div class="flex flex-col w-full overflow-hidden transition-all duration-500 ease-in-out max-h-0" :class="{ 'max-h-96' : state.projectExpanded === project.id }">
              <button @click="state.milestoneSelected = m_index; state.projectSelected = index" v-for="(milestone, m_index) in project?.milestones" class="flex text-left flex-row w-full group px-5 gap-3 relative group items-center" :class="{ 'font-semibold': state.milestoneSelected === m_index && state.projectSelected === index  }">
                <img src="@/assets/img/misc/tree_branches/left_branch.svg" class="h-8 group-last:hidden" />
                <img src="@/assets/img/misc/tree_branches/last_branch.svg" class="h-8 not-group-last:hidden" />

                <div class="flex flex-row w-full overflow-hidden">
                  <span class="text-xs whitespace-nowrap">{{ milestone.name }}</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import CreateProject from "~/components/PageComponents/Home/Projects/CreateProject/CreateProject.vue";
import {FileText, Plus, ChevronDown, Ellipsis, Folder} from "lucide-vue-next";
import { useProjectSideBarStore } from "~/stores/sidebars/projects";
import { getProjects } from "~/services/projects";

const archived = [];

const state = useProjectSideBarStore();

onMounted(async () => {
  if(state.projects === null) {
    state.projects = await getProjects();
  }
});


const toggleArchived = () => {
  if (state.topExpanded === 'ARCHIVED') {
    state.topExpanded = 'NONE';
    return;
  }

  state.topExpanded = 'ARCHIVED';
}

const toggleProjects = () => {
  if (state.topExpanded === 'PROJECTS') {
    state.topExpanded = 'NONE';
    return;
  }

  state.topExpanded = 'PROJECTS';
}

const toggleProject = (index : string) => {
  if(state.projectExpanded === index) {
    state.projectExpanded = null;
    return;
  }

  state.projectExpanded = index;
}
</script>