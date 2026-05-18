<script setup lang="ts">
const route = useRoute()
const roomQuery = computed(() => String(route.query.room ?? '').trim())
const nameQuery = computed(() => String(route.query.name ?? '').trim())

const {
  connectRoom,
  seatedPlayers,
  spectators,
  gameStatus,
  currentTurnIndex,
  advanceTurn,
  me,
  isConnected,
  boardSize,
  boardSeed,
} = useP2PGame()

onMounted(() => {
  if (roomQuery.value && nameQuery.value) {
    connectRoom(roomQuery.value, nameQuery.value)
  }
})

watch(
  () => [roomQuery.value, nameQuery.value] as const,
  ([room, name]) => {
    if (room && name) connectRoom(room, name)
  },
)

watch([gameStatus, isConnected], ([status, connected]) => {
  if (!connected || status !== 'lobby' || !roomQuery.value) return
  navigateTo({
    path: '/lobby',
    query: { room: roomQuery.value, name: nameQuery.value },
  })
})
</script>

<template>
  <div v-if="!roomQuery || !nameQuery" class="gate">
    <p>Missing room or name.</p>
    <NuxtLink to="/">Back home</NuxtLink>
  </div>

  <template v-else-if="gameStatus === 'playing'">
    <header class="game-header">
      <span>Room: <strong>{{ roomQuery }}</strong></span>
      <span v-if="me?.seatIndex !== undefined && me.seatIndex < 0" class="spectator">
        Spectating
      </span>
      <NuxtLink
        class="lobby-link"
        :to="{ path: '/lobby', query: { room: roomQuery, name: nameQuery } }"
      >
        Lobby
      </NuxtLink>
    </header>

    <GameBoard
      :players="seatedPlayers"
      :current-turn-index="currentTurnIndex"
      :board-size="boardSize"
      :board-seed="boardSeed"
      @advance-turn="advanceTurn"
    />

    <aside v-if="spectators.length" class="spectators-bar">
      <span>Spectators:</span>
      {{ spectators.map((s) => s.name).join(', ') }}
    </aside>
  </template>

  <div v-else class="gate">
    <p>Connecting to game…</p>
  </div>
</template>

<style scoped>
.gate {
  padding: 3rem 1.5rem;
  text-align: center;
  color: var(--muted);
}

.game-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1.5rem;
  border-bottom: 1px solid var(--border);
  font-size: 0.9rem;
  color: var(--muted);
}

.game-header strong {
  color: var(--text);
}

.spectator {
  padding: 0.2rem 0.5rem;
  background: var(--surface);
  border-radius: 4px;
  font-size: 0.8rem;
}

.lobby-link {
  margin-left: auto;
  color: var(--accent);
  text-decoration: none;
}

.lobby-link:hover {
  text-decoration: underline;
}

.spectators-bar {
  padding: 0.5rem 1.5rem;
  font-size: 0.85rem;
  color: var(--muted);
  border-top: 1px solid var(--border);
}
</style>
