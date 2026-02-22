import { useRuntimeConfig } from '#imports';
import * as Sentry from '@sentry/nuxt';

Sentry.init({
    // If set up, you can use your runtime config here
    dsn: "https://4407ab46349448b096d050cb10720d20@telemetry.practocore.com/1",
    integrations: [
        Sentry.browserTracingIntegration({ router: useNuxtApp().$router }),
    ],
    tracesSampleRate: 0.01,
    environment: "dev",
    release: "practocore-app@v0.1.0"
});
