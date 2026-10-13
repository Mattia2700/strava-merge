// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    stravaClientSecret: '',
    /** Full callback URL override, e.g. https://nas.example.com/api/strava/callback */
    stravaRedirectUri: '',
    public: {
      stravaClientId: '',
    },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'Strava Merge',
      meta: [
        {
          name: 'description',
          content:
            'Merge phone and watch GPX/FIT recordings with quality scores for Strava.',
        },
        { name: 'theme-color', content: '#102018' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
      ],
    },
  },
  vite: {
    optimizeDeps: {
      include: ['@garmin/fitsdk', 'leaflet'],
    },
  },
})
