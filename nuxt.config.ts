// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      meta: [
        {
          name: 'description',
          content:
            'Merge phone and watch GPX/FIT recordings with quality scores for Strava.',
        },
      ],
    },
  },
  vite: {
    optimizeDeps: {
      include: ['@garmin/fitsdk', 'leaflet'],
    },
  },
})
