// https://nuxt.com/docs/api/configuration/nuxt-config

import {existsSync, readFileSync} from 'node:fs'
import {homedir} from 'node:os'
import {resolve} from 'node:path'
import tailwindcss from '@tailwindcss/vite'

// HTTPS dev server for the Word add-in. Office requires the task-pane SourceLocation
// to be served over HTTPS (http://localhost is rejected by the manifest validator and
// Word-on-the-web). Opt in with `DEV_HTTPS=1 npm run dev`; reuses the trusted
// office-addin-dev-certs (run `npx office-addin-dev-certs install` once). Plain
// `npm run dev` is unaffected.
const certDir = resolve(homedir(), '.office-addin-dev-certs')
const certPath = resolve(certDir, 'localhost.crt')
const keyPath = resolve(certDir, 'localhost.key')
const devHttps = process.env.DEV_HTTPS === '1' && existsSync(certPath) && existsSync(keyPath)

export default defineNuxtConfig({
    compatibilityDate: '2025-05-15',
    devtools: {enabled: true},
    css: ['~/assets/css/fonts.css', '~/assets/css/tailwind.css'],

    ssr: false,

    ...(devHttps
        ? {
            devServer: {
                https: {
                    cert: readFileSync(certPath, 'utf8'),
                    key: readFileSync(keyPath, 'utf8'),
                },
            },
        }
        : {}),

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

    // iOS Universal Links: the file itself lives at public/.well-known/apple-app-site-association
    // (no extension, so Nitro can't infer a mime type) — force the content-type Apple's
    // AASA fetcher expects. No-op if app.practocore.com isn't served by this Nitro instance.
    routeRules: {
        '/.well-known/apple-app-site-association': {
            headers: { 'content-type': 'application/json' },
        },
    },

    vite: {
        plugins: [
            tailwindcss(),
        ],
        server: {
            watch: {
                ignored: ['**/src-tauri/target/**', '**/src-tauri/gen/**'],
            },
        },
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
            // Default host is the first-party reverse proxy (portal.practocore.com),
            // which forwards to EU ingestion — keeps analytics same-origin and
            // resilient to ad/tracker blockers. ui_host stays eu.posthog.com.
            posthogKey: process.env.NUXT_PUBLIC_POSTHOG_KEY || '',
            posthogHost: process.env.NUXT_PUBLIC_POSTHOG_HOST || 'https://portal.practocore.com',
            // Session replay — BETA ONLY. Off unless explicitly enabled. To turn
            // it off for production, simply do NOT set this var in the prod env.
            // Replays capture on-screen text (matter/client names); typed input
            // values are masked. Keep the PostHog replay audience tight.
            posthogSessionReplay: process.env.NUXT_PUBLIC_POSTHOG_SESSION_REPLAY === 'true',
            // Native Google Sign-In (Capacitor). The idToken minted by the
            // native plugin carries `aud = webClientId`, so the SAME web client
            // id must also be listed in the backend's GOOGLE_OAUTH_CLIENT_IDS.
            // iOS additionally needs its own OAuth client id. Both are safe to
            // ship in the client bundle (they are not secrets).
            googleWebClientId: process.env.NUXT_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
            googleIosClientId: process.env.NUXT_PUBLIC_GOOGLE_IOS_CLIENT_ID || '',
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