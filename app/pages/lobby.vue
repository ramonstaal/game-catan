<script setup lang="ts">
import { MIN_PLAYERS_TO_START, BOARD_SIZE_LABELS, type BoardSize } from '~/types/p2p'

const route = useRoute()
const roomQuery = computed(() => String(route.query.room ?? '').trim())
const nameQuery = computed(() => String(route.query.name ?? '').trim())

const {
  connectRoom,
  joinRoom,
  setReady,
  startGame,
  seatedPlayers,
  spectators,
  me,
  isHost,
  canStart,
  readyCount,
  gameStatus,
  isConnected,
  peerCount,
  hostId,
  connectionError,
} = useP2PGame()

const isInviteJoin = computed(() => Boolean(roomQuery.value && !nameQuery.value))

const localReady = computed({
  get: () => me.value?.isReady ?? false,
  set: (v: boolean) => setReady(v),
})

const joinName = ref('')
const selectedBoardSize = ref<BoardSize>('standard')

function enterLobbyWithName() {
  const n = joinName.value.trim()
  if (!n || !roomQuery.value) return
  joinRoom(roomQuery.value, n)
  navigateTo({
    path: '/lobby',
    query: { room: roomQuery.value, name: n },
  })
}

function connectForRoute() {
  const room = roomQuery.value
  const name = nameQuery.value
  if (!room) return
  if (name) {
    connectRoom(room, name)
  } else {
    connectRoom(room, '')
  }
}

onMounted(connectForRoute)

watch(
  () => [roomQuery.value, nameQuery.value] as const,
  connectForRoute,
)

watch([gameStatus, isConnected], ([status, connected]) => {
  if (!connected || status !== 'playing' || !roomQuery.value) return
  navigateTo({
    path: '/game',
    query: { room: roomQuery.value, name: nameQuery.value },
  })
})

function colorVar(color: string | null): string {
  const map: Record<string, string> = {
    Red: 'var(--red)',
    Blue: 'var(--blue)',
    White: 'var(--white)',
    Orange: 'var(--orange)',
  }
  return color ? (map[color] ?? 'var(--muted)') : 'var(--muted)'
}
</script>

<template>
  <main class="lobby">
    <header>
      <h1>Game lobby</h1>
      <p v-if="roomQuery" class="room">
        Room: <strong>{{ roomQuery }}</strong>
        <span v-if="isConnected" class="badge connected">
          Online
          <template v-if="peerCount > 0"> · {{ peerCount }} WebRTC peer(s)</template>
        </span>
        <span v-else class="badge">Connecting…</span>
      </p>
      <p v-else class="warn">
        Missing room. <NuxtLink to="/">Go home</NuxtLink>
      </p>
    </header>

    <section v-if="isInviteJoin" class="panel invite-panel">
      <h2>You're invited</h2>
      <p class="join-hint">
        Join room <strong class="room-code">{{ roomQuery }}</strong>
        — enter your name below.
      </p>

      <div class="room-locked">
        <span class="room-locked-label">Room</span>
        <span class="room-locked-value">{{ roomQuery }}</span>
      </div>

      <RoomRoster
        :seated-players="seatedPlayers"
        :spectators="spectators"
        :host-id="hostId"
      />

      <p v-if="connectionError" class="sync-error">
        {{ connectionError }}
      </p>
      <p v-else-if="!isConnected" class="sync-hint">
        Connecting to room…
      </p>
      <p
        v-else-if="seatedPlayers.length === 0 && spectators.length === 0"
        class="sync-hint"
      >
        Connected — waiting for the host to join this room.
      </p>

      <label class="join-label">
        Your name
        <input
          v-model="joinName"
          type="text"
          placeholder="Player name"
          autofocus
          @keyup.enter="enterLobbyWithName"
        />
      </label>
      <button
        type="button"
        class="start"
        :disabled="!joinName.trim()"
        @click="enterLobbyWithName"
      >
        Join lobby
      </button>
    </section>

    <section v-else-if="roomQuery" class="panel">
      <h2>Players ({{ seatedPlayers.length }} / 4)</h2>
      <ul class="player-list">
        <li
          v-for="player in seatedPlayers"
          :key="player.id"
          class="player-row"
        >
          <span
            class="color-dot"
            :style="{ background: colorVar(player.color) }"
          />
          <span class="name">
            {{ player.name }}
            <span v-if="player.id === me?.id" class="you">(you)</span>
            <span v-if="player.id === hostId" class="host-tag">Host</span>
          </span>
          <span v-if="player.isReady" class="ready">Ready</span>
          <span v-else class="not-ready">Not ready</span>
        </li>
        <li v-if="seatedPlayers.length === 0" class="empty">
          Waiting for players…
        </li>
      </ul>

      <div v-if="me && me.seatIndex >= 0" class="ready-toggle">
        <label>
          <input v-model="localReady" type="checkbox" />
          I'm ready
        </label>
      </div>

      <p class="hint">
        Need at least {{ MIN_PLAYERS_TO_START }} players ready to start.
        ({{ readyCount }} / {{ MIN_PLAYERS_TO_START }} ready)
      </p>

      <div v-if="isHost" class="board-size-picker">
        <p class="picker-label">Board size</p>
        <div class="size-buttons">
          <button
            v-for="(label, key) in BOARD_SIZE_LABELS"
            :key="key"
            type="button"
            class="size-btn"
            :class="{ active: selectedBoardSize === key }"
            @click="selectedBoardSize = key as BoardSize"
          >
            {{ label }}
          </button>
        </div>
      </div>

      <button
        v-if="isHost"
        type="button"
        class="start"
        :disabled="!canStart"
        @click="startGame(selectedBoardSize)"
      >
        Start game
      </button>
      <p v-else-if="me?.seatIndex !== undefined && me.seatIndex >= 0" class="wait-host">
        Waiting for host to start…
      </p>

      <InviteLink :room="roomQuery" />
    </section>

    <section v-if="spectators.length" class="panel">
      <h2>Spectators</h2>
      <ul class="player-list">
        <li v-for="s in spectators" :key="s.id" class="player-row spectator">
          <span class="color-dot spectator-dot" />
          <span class="name">
            {{ s.name }}
            <span v-if="s.id === me?.id" class="you">(you)</span>
          </span>
          <span class="spectator-label">Spectator</span>
        </li>
      </ul>
      <p v-if="me && me.seatIndex < 0" class="spectator-note">
        All seats are full. You can watch the game but cannot play.
      </p>
    </section>
  </main>
</template>

<style scoped>
.lobby {
  max-width: 520px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

header h1 {
  margin: 0 0 0.5rem;
}

.room {
  color: var(--muted);
  margin: 0 0 1.5rem;
}

.badge {
  margin-left: 0.5rem;
  padding: 0.15rem 0.5rem;
  font-size: 0.75rem;
  border-radius: 4px;
  background: var(--surface);
  border: 1px solid var(--border);
}

.badge.connected {
  border-color: #27ae60;
  color: #2ecc71;
}

.warn {
  color: var(--orange);
}

.panel {
  margin-bottom: 1.5rem;
  padding: 1.25rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
}

.panel h2 {
  margin: 0 0 1rem;
  font-size: 1rem;
}

.player-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.player-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0;
  border-bottom: 1px solid var(--border);
}

.player-row:last-child {
  border-bottom: none;
}

.color-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  flex-shrink: 0;
  border: 2px solid rgba(255, 255, 255, 0.3);
}

.spectator-dot {
  background: var(--muted) !important;
}

.name {
  flex: 1;
}

.you,
.host-tag {
  font-size: 0.8rem;
  color: var(--muted);
  margin-left: 0.35rem;
}

.host-tag {
  color: var(--accent);
}

.ready {
  color: #2ecc71;
  font-size: 0.85rem;
}

.not-ready {
  color: var(--muted);
  font-size: 0.85rem;
}

.spectator-label {
  font-size: 0.85rem;
  color: var(--muted);
}

.empty {
  color: var(--muted);
  padding: 0.5rem 0;
}

.ready-toggle {
  margin: 1rem 0;
}

.ready-toggle label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.hint {
  font-size: 0.85rem;
  color: var(--muted);
  margin: 0 0 1rem;
}

.start {
  width: 100%;
  padding: 0.75rem;
  border: none;
  border-radius: 8px;
  background: var(--accent);
  color: #1a2332;
  font-weight: 600;
}

.start:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.wait-host,
.spectator-note {
  font-size: 0.9rem;
  color: var(--muted);
  margin: 0.5rem 0 0;
}

.join-hint {
  font-size: 0.9rem;
  color: var(--muted);
  margin: 0 0 1rem;
}

.join-label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 1rem;
  font-size: 0.875rem;
  color: var(--muted);
}

.join-label input {
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  font: inherit;
}

.room-code {
  color: var(--text);
}

.room-locked {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
  padding: 0.65rem 0.85rem;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
}

.room-locked-label {
  font-size: 0.8rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.room-locked-value {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--accent);
}

.sync-hint {
  margin: 0 0 1rem;
  font-size: 0.85rem;
  color: var(--muted);
}

.sync-error {
  margin: 0 0 1rem;
  padding: 0.65rem 0.75rem;
  font-size: 0.85rem;
  line-height: 1.4;
  color: #ffb4a2;
  background: rgba(192, 57, 43, 0.15);
  border: 1px solid rgba(192, 57, 43, 0.4);
  border-radius: 8px;
}

.invite-panel .roster {
  margin-bottom: 1rem;
}

.board-size-picker {
  margin-bottom: 1rem;
}

.picker-label {
  font-size: 0.8rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 0.5rem;
}

.size-buttons {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.size-btn {
  flex: 1;
  padding: 0.45rem 0.5rem;
  font-size: 0.8rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--muted);
  transition: border-color 0.15s, color 0.15s;
}

.size-btn.active {
  border-color: var(--accent);
  color: var(--accent);
  font-weight: 600;
}

.size-btn:hover:not(.active) {
  border-color: var(--text);
  color: var(--text);
}
</style>
