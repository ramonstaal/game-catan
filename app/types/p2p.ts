/** Catan player colors in seat order */
export const PLAYER_COLORS = ['Red', 'Blue', 'White', 'Orange'] as const
export type PlayerColor = (typeof PLAYER_COLORS)[number]

export type RoomStatus = 'lobby' | 'playing'

/** Shared game map fields in Y.Doc */
export interface GameRecord {
  status: RoomStatus
  currentTurnIndex: number
  hostId: string | null
}

/** Per-client record in Y.Map clients */
export interface PlayerRecord {
  id: string
  name: string
  seatIndex: number
  color: PlayerColor | null
  isReady: boolean
  connected: boolean
}

/** View model for seated players (derived from PlayerRecord) */
export interface SeatedPlayer extends PlayerRecord {
  seatIndex: number
  color: PlayerColor
}

export const MAX_SEATS = 4
export const MIN_PLAYERS_TO_START = 2

/** Canonical P2P room id (shared by everyone who types the same room code). */
export function normalizeRoomId(room: string): string {
  const slug = room
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `catan-${slug || 'lobby'}`
}
