// https://nuxt.com/docs/api/configuration/nuxt-config

import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
    compatibilityDate: '2025-05-15',
    devtools: {enabled: true},
    css: ['~/assets/css/fonts.css', '~/assets/css/tailwind.css'],

    ssr: false,

    app: {
        baseURL: './',
        buildAssetsDir: 'assets',
        head: {
            meta: [
                {
                    name: 'viewport',
                    content: 'initial-scale=1, width=device-width, height=device-height, viewport-fit=cover, user-scalable=no'
                },
                {name: 'format-detection', content: 'telephone=no'},
                {name: 'msapplication-tap-highlight', content: 'no'}
            ],
        },
    },

    router: {
        options: {
            // hashMode: true
        }
    },

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
        // 'nuxt-electron'
        '@sentry/nuxt/module',
        'nuxt-umami',
        '@nuxtjs/ionic'
    ],

    colorMode: {
        classSuffix: '',
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
            // Override at deploy time by setting NUXT_PUBLIC_POCKETBASE_URL
            pocketbaseUrl: process.env.NUXT_PUBLIC_POCKETBASE_URL || process.env.POCKETBASE_URL || 'http://127.0.0.1:8090',
            // PostHog product analytics. Leave the key empty to disable entirely
            // (e.g. local dev). EU ingestion only — never point posthogHost at US.
            posthogKey: process.env.NUXT_PUBLIC_POSTHOG_KEY || '',
            posthogHost: process.env.NUXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com',
            // Session replay — BETA ONLY. Off unless explicitly enabled. To turn
            // it off for production, simply do NOT set this var in the prod env.
            // Replays capture on-screen text (matter/client names); typed input
            // values are masked. Keep the PostHog replay audience tight.
            posthogSessionReplay: process.env.NUXT_PUBLIC_POSTHOG_SESSION_REPLAY === 'true',
        }
    },
    plugins: [
        '~/plugins/network.client',
        '~/plugins/animxyz',
        '~/plugins/pocketbase.client',
        '~/plugins/posthog.client',
    ],

    umami: {
        id: '58731ff6-4a2f-47c3-86ed-2a459ffe76f2',
        host: 'https://analytics.practocore.com',
        autoTrack: true,
        // proxy: 'cloak',
        // useDirective: true,
        ignoreLocalhost: true,
        // excludeQueryParams: false,
        // domains: ['cool-site.app', 'my-space.site'],
        // customEndpoint: '/my-custom-endpoint',
        // enabled: false,
        // logErrors: true,
    },
    ionic: {
        css: {
            core: false,
            basic: false
        }
    }

})