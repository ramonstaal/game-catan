<script setup lang="ts">
import type { SeatedPlayer } from '~/types/p2p'
import type { BoardSize } from '~/utils/boardGenerator'
import { generateBoard, hexPolygonPoints, tileImageUrl } from '~/utils/boardGenerator'

const props = defineProps<{
  players: SeatedPlayer[]
  currentTurnIndex: number
  boardSize: BoardSize
  boardSeed: number
}>()

const emit = defineEmits<{
  advanceTurn: []
}>()

const board = computed(() => generateBoard(props.boardSize, props.boardSeed))

/** Number tokens with colour: 6 and 8 are red (high probability) */
function tokenColor(n: number): string {
  return n === 6 || n === 8 ? '#c0392b' : '#1a2332'
}

function tokenDots(n: number): string {
  const pips: Record<number, number> = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 }
  return '•'.repeat(pips[n] ?? 0)
}

function colorCss(color: string): string {
  const map: Record<string, string> = {
    Red: 'var(--red)',
    Blue: 'var(--blue)',
    White: 'var(--white)',
    Orange: 'var(--orange)',
  }
  return map[color] ?? 'var(--muted)'
}

const panelColumns = computed(() =>
  props.players.length <= 2 ? '1fr 1fr' : props.players.length === 3 ? '1fr 1fr 1fr' : '1fr 1fr 1fr 1fr',
)
</script>

<template>
  <div class="game-board">
    <aside class="sidebar">
      <h2>Players</h2>

      <div class="scorecards" :style="{ gridTemplateColumns: panelColumns }">
        <div
          v-for="(player, index) in players"
          :key="player.id"
          class="scorecard"
          :class="{ active: index === currentTurnIndex }"
        >
          <div class="score-header">
            <span class="pip" :style="{ background: colorCss(player.color) }" />
            <strong class="player-name">{{ player.name }}</strong>
          </div>
          <span v-if="index === currentTurnIndex" class="turn-badge">Turn</span>
        </div>
      </div>

      <button
        v-if="players.length > 0"
        type="button"
        class="next-turn"
        @click="emit('advanceTurn')"
      >
        End turn
      </button>

      <p class="player-count">
        {{ players.length }} player{{ players.length === 1 ? '' : 's' }} in game
      </p>

      <div class="legend">
        <h3>Terrain</h3>
        <ul class="legend-list">
          <li><span class="legend-swatch forest" />Forest — Lumber</li>
          <li><span class="legend-swatch pasture" />Pasture — Wool</li>
          <li><span class="legend-swatch fields" />Fields — Grain</li>
          <li><span class="legend-swatch hills" />Hills — Brick</li>
          <li><span class="legend-swatch mountains" />Mountains — Ore</li>
          <li><span class="legend-swatch desert" />Desert</li>
        </ul>
      </div>
    </aside>

    <div class="board-wrap">
      <svg
        :viewBox="board.viewBox"
        class="board-svg"
        role="img"
        aria-label="Catan board"
      >
        <!-- Clip paths — one per hex tile -->
        <defs>
          <clipPath
            v-for="tile in board.tiles"
            :id="`clip-${tile.id}`"
            :key="`cp-${tile.id}`"
          >
            <polygon :points="hexPolygonPoints(tile.x, tile.y, board.hexSize)" />
          </clipPath>
        </defs>

        <!-- Tile images (clipped to hex shape) -->
        <image
          v-for="tile in board.tiles"
          :key="`img-${tile.id}`"
          :href="tileImageUrl(tile.type)"
          :x="tile.x - board.hexSize"
          :y="tile.y - board.hexSize * 0.866"
          :width="board.hexSize * 2"
          :height="board.hexSize * 1.732"
          :clip-path="`url(#clip-${tile.id})`"
          preserveAspectRatio="xMidYMid slice"
        />

        <!-- Hex borders -->
        <polygon
          v-for="tile in board.tiles"
          :key="`border-${tile.id}`"
          :points="hexPolygonPoints(tile.x, tile.y, board.hexSize)"
          fill="none"
          stroke="rgba(0,0,0,0.35)"
          :stroke-width="board.hexSize * 0.04"
        />

        <!-- Number tokens -->
        <g
          v-for="tile in board.tiles.filter(t => t.number !== null)"
          :key="`token-${tile.id}`"
        >
          <!-- Token circle -->
          <circle
            :cx="tile.x"
            :cy="tile.y"
            :r="board.hexSize * 0.28"
            fill="#f5efe0"
            stroke="#8b7355"
            :stroke-width="board.hexSize * 0.03"
          />
          <!-- Number -->
          <text
            :x="tile.x"
            :y="tile.y - board.hexSize * 0.04"
            text-anchor="middle"
            dominant-baseline="middle"
            :font-size="board.hexSize * 0.24"
            font-weight="700"
            :fill="tokenColor(tile.number!)"
          >
            {{ tile.number }}
          </text>
          <!-- Probability dots -->
          <text
            :x="tile.x"
            :y="tile.y + board.hexSize * 0.14"
            text-anchor="middle"
            dominant-baseline="middle"
            :font-size="board.hexSize * 0.1"
            :fill="tokenColor(tile.number!)"
            opacity="0.8"
          >
            {{ tokenDots(tile.number!) }}
          </text>
        </g>
      </svg>
    </div>
  </div>
</template>

<style scoped>
.game-board {
  display: grid;
  grid-template-columns: minmax(200px, 260px) 1fr;
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
  gap: 0.6rem;
  margin-bottom: 1rem;
}

.scorecard {
  padding: 0.65rem 0.75rem;
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
  margin-bottom: 0.25rem;
}

.pip {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.player-name {
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.turn-badge {
  display: inline-block;
  padding: 0.1rem 0.4rem;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  background: var(--accent);
  color: #1a2332;
  border-radius: 4px;
}

.next-turn {
  width: 100%;
  padding: 0.6rem;
  margin-bottom: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  transition: border-color 0.15s;
}

.next-turn:hover {
  border-color: var(--accent);
}

.player-count {
  font-size: 0.8rem;
  color: var(--muted);
  margin: 0 0 1.25rem;
}

.legend {
  border-top: 1px solid var(--border);
  padding-top: 1rem;
}

.legend h3 {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
  margin: 0 0 0.6rem;
}

.legend-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.8rem;
  color: var(--muted);
}

.legend-list li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.legend-swatch {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 3px;
  flex-shrink: 0;
}

.legend-swatch.forest    { background: #2d6a4f; }
.legend-swatch.pasture   { background: #95d5b2; }
.legend-swatch.fields    { background: #f4d35e; }
.legend-swatch.hills     { background: #bc6c25; }
.legend-swatch.mountains { background: #6c757d; }
.legend-swatch.desert    { background: #e9c46a; }

.board-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1b6ca8;
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 1rem;
  min-height: 400px;
}

.board-svg {
  width: 100%;
  max-width: 680px;
  height: auto;
  filter: drop-shadow(0 4px 12px rgba(0,0,0,0.4));
}
</style>
