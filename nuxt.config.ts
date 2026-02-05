// https://nuxt.com/docs/api/configuration/nuxt-config

import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
    compatibilityDate: '2025-05-15',
    devtools: {enabled: true},
    css: ['~/assets/css/fonts.css', '~/assets/css/tailwind.css'],

    ssr: false,

    vite: {
        plugins: [
            tailwindcss(),
        ],
    },

    modules: [
        'shadcn-nuxt',
        '@hypernym/nuxt-gsap',
        '@nuxt/icon',
        '@pinia/nuxt',
        '@hypernym/nuxt-gsap',
        '@vueuse/nuxt',
        'nuxt-viewport',
        'v-wave/nuxt',
        // '@nuxtjs/tailwindcss',
        '@nuxtjs/color-mode',
        'nuxt-tiptap-editor',
        'nuxt-electron'
    ],

    colorMode: {
        classSuffix: '',
    },

    electron: {
        disableDefaultOptions: true,
        build: [
            {
                entry: 'electron/main.ts'
            },
            {
                entry: 'electron/preload.ts',
            }
        ]
    },

    shadcn: {
        /**
         * Prefix for all the imported component
         */
        prefix: '',
        /**
         * Directory that the component lives in.
         * @default "./components/ui"
         */
        componentDir: './components/ui'
    },

    gsap: {
        clubPlugins: {
            scrollSmoother: true,
            splitText: true
        }
    },

    viewport: {
        breakpoints: {
            desktop: 1024,
            desktopMedium: 1280,
            desktopWide: 1600,

            mobile: 320,
            mobileMedium: 375,
            mobileWide: 425,

            tablet: 800,
            customxs: 480
        },

        cookie: {
            expires: 365, // 365 days
            name: 'viewport',
            path: '/',
            sameSite: 'Strict',
            secure: true
        },

        defaultBreakpoints: {
            desktop: 'desktop',
            mobile: 'mobile',
            tablet: 'tablet',
        },

        fallbackBreakpoint: 'desktop',

        feature: 'minWidth',
    },
    runtimeConfig: {
        public: {
            pocketbaseUrl: process.env.POCKETBASE_URL || 'http://localhost:8090'
        }
    },
    plugins: [
        '~/plugins/animxyz',
        '~/plugins/pocketbase.client',
    ]
})