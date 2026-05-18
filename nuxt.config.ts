// https://nuxt.com/docs/api/configuration/nuxt-config
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

export default defineNuxtConfig({
  compatibilityDate: '2025-05-18',
  srcDir: 'app',
  ssr: false,
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  app: {
    baseURL: process.env.NUXT_APP_BASE_URL || '/',
    head: {
      title: 'Settlers of Catan',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
    },
  },
  runtimeConfig: {
    public: {
      yjsWsUrl: process.env.NUXT_PUBLIC_YJS_WS_URL || 'wss://demos.yjs.dev/ws',
    },
  },
  vite: {
    optimizeDeps: {
      include: ['yjs', 'y-webrtc', 'y-websocket', 'y-protocols/awareness'],
    },
  },
  nitro: {
    preset: 'static',
    prerender: {
      routes: ['/lobby', '/game'],
    },
  },
  hooks: {
    'nitro:init'(nitro) {
      // GitHub Pages runs Jekyll; without this, `_nuxt/` assets are stripped (blank page).
      nitro.hooks.hook('close', () => {
        const publicDir = nitro.options.output.publicDir
        if (publicDir) {
          writeFileSync(resolve(publicDir, '.nojekyll'), '')
        }
      })
    },
  },
})
