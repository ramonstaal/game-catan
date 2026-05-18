# Settlers of Catan (P2P)

Serverless multiplayer Catan prototype using **Nuxt 4** (SPA / static), **Yjs**, and **y-webrtc** with `wss://signaling.yjs.dev`.

## Develop

```bash
npm install
npm run dev
```

Nuxt is pinned to **3.21.2** because 3.21.3+ breaks `npm run dev` with `ssr: false` (vite-node IPC error; see [nuxt/nuxt#34957](https://github.com/nuxt/nuxt/issues/34957)). Remove the pin once you upgrade to a Nuxt release that includes the fix.

## Live site

**https://ramonstaal.github.io/game-catan/**

Pushes to `main` deploy automatically via GitHub Actions (`.github/workflows/deploy.yml`).

## Static build (GitHub Pages)

```bash
NUXT_APP_BASE_URL=/game-catan/ npm run generate
```

Deploy the `.output/public` folder, or push to `main` and let CI deploy.

## Flow

1. **Home** — enter name and room code.
2. **Lobby** — up to 4 seated players (colors assigned in order); extra joins are spectators. Host starts when ≥3 players are ready.
3. **Game** — board and scorecards for 3–4 seated players; turn index synced via Yjs.
