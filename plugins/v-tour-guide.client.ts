import { TourGuideManager, TourGuideTooltip } from 'v-tour-guide'

export default defineNuxtPlugin((nuxtApp) => {
    nuxtApp.vueApp.component('TourGuideManager', TourGuideManager)
    nuxtApp.vueApp.component('TourGuideTooltip', TourGuideTooltip)
})