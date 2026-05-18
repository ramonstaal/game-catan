# Settlers of Catan (P2P)

Serverless multiplayer Catan prototype using **Nuxt**, **Yjs**, **WebRTC**, and an optional **WebSocket sync server**.

## Live site

**https://ramonstaal.github.io/game-catan/**

## Why you need a sync server

The public Yjs demo server (`demos.yjs.dev`) is **often down** (504). GitHub Pages can only host static files, so **room state must sync through a small WebSocket server** you deploy once (free on Render).

Without it, players usually **cannot see each other** across phones/networks.

## 1. Deploy sync server (one-time, ~5 min)

### Option A — Render (recommended, free)

1. Push this repo to GitHub.
2. Open [Render Blueprint](https://render.com/docs/blueprint-spec) → **New Blueprint** → connect repo.
3. Render deploys `sync-server` from [`render.yaml`](render.yaml).
4. Copy your service URL, e.g. `https://game-catan-sync.onrender.com`.

### Option B — Local (testing)

```bash
npm run sync-server
# runs on ws://localhost:1234
```

## 2. Build the game with your sync URL

```bash
NUXT_PUBLIC_YJS_WS_URL=wss://YOUR-SYNC-HOST.onrender.com npm run generate
```

Deploy `.output/public` to GitHub Pages (or push to `main` if CI is wired).

For local dev:

```bash
NUXT_PUBLIC_YJS_WS_URL=ws://localhost:1234 npm run dev
```

## Develop

```bash
npm install
NUXT_PUBLIC_YJS_WS_URL=ws://localhost:1234 npm run dev   # terminal 1
npm run sync-server                                     # terminal 2
```

Nuxt is pinned to **3.21.2** (see [nuxt/nuxt#34957](https://github.com/nuxt/nuxt/issues/34957)).

## Flow

1. **Home** — create room + name, or open invite link.
2. **Lobby** — invite links go to `/lobby?room=CODE` (room fixed, enter name only).
3. **Game** — host starts when ≥2 players are ready.

## Invite links

Share from the lobby; links look like:

`https://ramonstaal.github.io/game-catan/lobby?room=your-code`
