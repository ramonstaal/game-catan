<script setup lang="ts">
const route = useRoute()
const room = ref('')
const name = ref('')

const inviteRoom = computed(() => String(route.query.room ?? '').trim())
const isInviteRedirect = computed(() => Boolean(inviteRoom.value))

watch(
  inviteRoom,
  (code) => {
    if (code) {
      navigateTo({ path: '/lobby', query: { room: code } })
    }
  },
  { immediate: true },
)

function joinLobby() {
  const r = room.value.trim()
  const n = name.value.trim()
  if (!r || !n) return
  navigateTo({
    path: '/lobby',
    query: { room: r, name: n },
  })
}

function randomRoom() {
  room.value = Math.random().toString(36).slice(2, 8)
}
</script>

<template>
  <main v-if="!isInviteRedirect" class="home">
    <h1>Settlers of Catan</h1>
    <p class="subtitle">Serverless P2P multiplayer via WebRTC</p>

    <form class="card" @submit.prevent="joinLobby">
      <label>
        Your name
        <input v-model="name" type="text" placeholder="Player name" required />
      </label>
      <label>
        Room code
        <input
          v-model="room"
          type="text"
          placeholder="e.g. island42"
          required
        />
        <button type="button" class="link" @click="randomRoom">
          Generate room code
        </button>
      </label>
      <button type="submit" class="primary" :disabled="!name.trim() || !room.trim()">
        Join lobby
      </button>

      <InviteLink v-if="room.trim()" :room="room.trim()" />
    </form>
  </main>
</template>

<style scoped>
.home {
  max-width: 420px;
  margin: 0 auto;
  padding: 3rem 1.5rem;
}

h1 {
  margin: 0 0 0.5rem;
  font-size: 1.75rem;
}

.subtitle {
  color: var(--muted);
  margin: 0 0 2rem;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.5rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.875rem;
  color: var(--muted);
}

input {
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
}

.link {
  align-self: flex-start;
  margin-top: 0.25rem;
  padding: 0;
  border: none;
  background: none;
  color: var(--accent);
  font-size: 0.8rem;
  text-decoration: underline;
}

.primary {
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 8px;
  background: var(--accent);
  color: #1a2332;
  font-weight: 600;
}

.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
