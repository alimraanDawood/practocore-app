import { defineStore } from 'pinia';

export const useProjectSideBarStore = defineStore('projectSideBar', {
    state: () => ({
        topExpanded: 'NONE' as string, // NONE | ARCHIVED | PROJECTS,
        projectExpanded: null as null | number, // null | number
        projectSelected: null as null | number,
        milestoneSelected: null as null | number,
        projects: null as any
    })
})