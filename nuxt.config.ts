// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'Tomato — MapleLegends Guild',
      meta: [
        { name: 'description', content: 'Tomato is a guild on the MapleLegends private server. Browse our roster, track member progress and stats.' },
        { name: 'theme-color', content: '#e23d28' }
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        {
          rel: 'preconnect',
          href: 'https://fonts.googleapis.com'
        },
        {
          rel: 'preconnect',
          href: 'https://fonts.gstatic.com',
          crossorigin: ''
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Nunito:wght@400;600;700;800;900&display=swap'
        }
      ]
    }
  },
  runtimeConfig: {
    supabaseUrl: '',
    supabaseServiceRoleKey: '',
    syncSecret: '',
    public: {
      supabaseUrl: '',
      supabaseAnonKey: ''
    }
  },
  nitro: {
    prerender: {
      routes: ['/']
    }
  }
})
