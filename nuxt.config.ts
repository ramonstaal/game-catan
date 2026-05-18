// https://nuxt.com/docs/api/configuration/nuxt-config
import { existsSync, writeFileSync } from 'node:fs'
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
      // Set after deploying sync-server (see README). demos.yjs.dev is often down (504).
      yjsWsUrl: process.env.NUXT_PUBLIC_YJS_WS_URL || '',
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
      // Guard with existsSync so `nuxt prepare` (run during postinstall) doesn't fail
      // when the output directory hasn't been created yet.
      nitro.hooks.hook('close', () => {
        const publicDir = nitro.options.output.publicDir
        if (publicDir && existsSync(publicDir)) {
          writeFileSync(resolve(publicDir, '.nojekyll'), '')
        }
      })
    },
  },
})
