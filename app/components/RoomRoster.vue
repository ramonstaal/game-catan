<script setup lang="ts">
import type { PlayerRecord, SeatedPlayer } from '~/types/p2p'

defineProps<{
  seatedPlayers: SeatedPlayer[]
  spectators: PlayerRecord[]
  hostId?: string | null
  meId?: string | null
  showReady?: boolean
}>()

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
  <div class="roster">
    <h3 v-if="seatedPlayers.length" class="roster-title">
      In this room ({{ seatedPlayers.length }} / 4)
    </h3>
    <ul v-if="seatedPlayers.length" class="player-list">
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
          <span v-if="player.id === meId" class="you">(you)</span>
          <span v-if="player.id === hostId" class="host-tag">Host</span>
        </span>
        <span v-if="showReady && player.isReady" class="ready">Ready</span>
        <span v-else-if="showReady" class="not-ready">Not ready</span>
      </li>
    </ul>
    <p v-else class="empty">No players in the lobby yet.</p>

    <template v-if="spectators.length">
      <h3 class="roster-title spectators-title">Spectators</h3>
      <ul class="player-list">
        <li
          v-for="s in spectators"
          :key="s.id"
          class="player-row"
        >
          <span class="color-dot spectator-dot" />
          <span class="name">{{ s.name }}</span>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.roster-title {
  margin: 0 0 0.75rem;
  font-size: 0.9rem;
  font-weight: 600;
}

.spectators-title {
  margin-top: 1rem;
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
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--border);
}

.player-row:last-child {
  border-bottom: none;
}

.color-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
  border: 2px solid rgba(255, 255, 255, 0.25);
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

.empty {
  margin: 0;
  font-size: 0.9rem;
  color: var(--muted);
}
</style>
