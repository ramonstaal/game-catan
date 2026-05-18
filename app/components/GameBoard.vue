<script setup lang="ts">
import type { SeatedPlayer } from '~/types/p2p'

const props = defineProps<{
  players: SeatedPlayer[]
  currentTurnIndex: number
}>()

const emit = defineEmits<{
  advanceTurn: []
}>()

/** Hex tile types for demo board */
const tiles = [
  { id: 0, type: 'forest', number: 4 },
  { id: 1, type: 'pasture', number: 5 },
  { id: 2, type: 'fields', number: 6 },
  { id: 3, type: 'hills', number: 8 },
  { id: 4, type: 'mountains', number: 9 },
  { id: 5, type: 'desert', number: null },
  { id: 6, type: 'forest', number: 10 },
]

const tileColors: Record<string, string> = {
  forest: '#2d6a4f',
  pasture: '#95d5b2',
  fields: '#f4d35e',
  hills: '#bc6c25',
  mountains: '#6c757d',
  desert: '#e9c46a',
}

/** Axial-ish layout for 7 hexes (simplified Catan island) */
const hexPositions = [
  { x: 200, y: 80 },
  { x: 290, y: 130 },
  { x: 290, y: 230 },
  { x: 200, y: 280 },
  { x: 110, y: 230 },
  { x: 110, y: 130 },
  { x: 200, y: 180 },
]

function colorCss(color: string): string {
  const map: Record<string, string> = {
    Red: 'var(--red)',
    Blue: 'var(--blue)',
    White: 'var(--white)',
    Orange: 'var(--orange)',
  }
  return map[color] ?? 'var(--muted)'
}

/** Demo resources per player (display scaffold; game logic can sync later) */
const demoResources = computed(() =>
  props.players.map((p, i) => ({
    player: p,
    wood: 2 + i,
    brick: 1 + (i % 2),
    sheep: 2,
    wheat: 1,
    ore: i,
    vp: 2 + (i % 3),
  })),
)

const panelColumns = computed(() =>
  props.players.length === 3 ? '1fr 1fr 1fr' : '1fr 1fr 1fr 1fr',
)
</script>

<template>
  <div class="game-board">
    <aside class="sidebar">
      <h2>Players</h2>
      <div
        class="scorecards"
        :style="{ gridTemplateColumns: panelColumns }"
      >
        <div
          v-for="(row, index) in demoResources"
          :key="row.player.id"
          class="scorecard"
          :class="{ active: index === currentTurnIndex }"
        >
          <div class="score-header">
            <span
              class="pip"
              :style="{ background: colorCss(row.player.color) }"
            />
            <strong>{{ row.player.name }}</strong>
          </div>
          <span v-if="index === currentTurnIndex" class="turn-badge">Turn</span>
          <dl class="resources">
            <div><dt>Wood</dt><dd>{{ row.wood }}</dd></div>
            <div><dt>Brick</dt><dd>{{ row.brick }}</dd></div>
            <div><dt>Sheep</dt><dd>{{ row.sheep }}</dd></div>
            <div><dt>Wheat</dt><dd>{{ row.wheat }}</dd></div>
            <div><dt>Ore</dt><dd>{{ row.ore }}</dd></div>
            <div><dt>VP</dt><dd>{{ row.vp }}</dd></div>
          </dl>
        </div>
      </div>

      <button
        v-if="players.length > 0"
        type="button"
        class="next-turn"
        @click="emit('advanceTurn')"
      >
        Next turn
      </button>

      <p class="player-count">
        {{ players.length }} player{{ players.length === 1 ? '' : 's' }} in game
      </p>
    </aside>

    <div class="board-wrap">
      <svg
        viewBox="0 0 400 360"
        class="board-svg"
        role="img"
        aria-label="Catan board"
      >
        <defs>
          <polygon
            id="hex"
            points="0,-36 31,-18 31,18 0,36 -31,18 -31,-18"
          />
        </defs>
        <g
          v-for="(tile, i) in tiles"
          :key="tile.id"
          :transform="`translate(${hexPositions[i]!.x}, ${hexPositions[i]!.y})`"
        >
          <use
            href="#hex"
            :fill="tileColors[tile.type]"
            stroke="#1a2332"
            stroke-width="2"
          />
          <text
            v-if="tile.number !== null"
            text-anchor="middle"
            dy="0.35em"
            font-size="14"
            font-weight="700"
            fill="#1a2332"
          >
            {{ tile.number }}
          </text>
        </g>
        <circle
          v-for="(player, i) in players"
          :key="player.id"
          :cx="60 + i * (280 / Math.max(players.length - 1, 1))"
          :cy="340"
          r="10"
          :fill="colorCss(player.color)"
          stroke="#fff"
          stroke-width="2"
        />
      </svg>
    </div>
  </div>
</template>

<style scoped>
.game-board {
  display: grid;
  grid-template-columns: minmax(220px, 280px) 1fr;
  gap: 1.5rem;
  min-height: calc(100vh - 4rem);
  padding: 1.5rem;
}

@media (max-width: 768px) {
  .game-board {
    grid-template-columns: 1fr;
  }
}

.sidebar h2 {
  margin: 0 0 1rem;
  font-size: 1.1rem;
}

.scorecards {
  display: grid;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.scorecard {
  padding: 0.75rem;
  background: var(--surface);
  border: 2px solid var(--border);
  border-radius: 10px;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.scorecard.active {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

.score-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.35rem;
}

.pip {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.turn-badge {
  display: inline-block;
  margin-bottom: 0.5rem;
  padding: 0.1rem 0.4rem;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  background: var(--accent);
  color: #1a2332;
  border-radius: 4px;
}

.resources {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.25rem 0.5rem;
  margin: 0;
  font-size: 0.8rem;
}

.resources div {
  display: flex;
  justify-content: space-between;
}

.resources dt {
  color: var(--muted);
}

.resources dd {
  margin: 0;
  font-weight: 600;
}

.next-turn {
  width: 100%;
  padding: 0.6rem;
  margin-bottom: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
}

.next-turn:hover {
  border-color: var(--accent);
}

.player-count {
  font-size: 0.85rem;
  color: var(--muted);
  margin: 0;
}

.board-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1rem;
}

.board-svg {
  width: 100%;
  max-width: 520px;
  height: auto;
}
</style>
