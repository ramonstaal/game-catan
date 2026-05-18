export type TileType = 'forest' | 'pasture' | 'fields' | 'hills' | 'mountains' | 'desert'
export type BoardSize = 'small' | 'standard' | 'large'

export interface HexTile {
  id: number
  q: number
  r: number
  type: TileType
  number: number | null
  x: number
  y: number
}

export interface BoardConfig {
  tiles: HexTile[]
  hexSize: number
  viewBox: string
}

/** Map our tile type names to the filenames in the GitHub asset repo */
const TILE_IMAGE_NAMES: Record<TileType, string> = {
  forest: 'forest',
  pasture: 'pasture',
  fields: 'field',
  hills: 'hill',
  mountains: 'mountain',
  desert: 'desert',
}

const HEX_ASSET_BASE =
  'https://raw.githubusercontent.com/BryantCabrera/Settlers-of-Catan/master/resources/imgs/hexes/150dpi%20masked/'

export function tileImageUrl(type: TileType): string {
  return `${HEX_ASSET_BASE}${TILE_IMAGE_NAMES[type]}.png`
}

/**
 * Returns the SVG polygon points string for a flat-top hexagon
 * centered at (cx, cy) with circumradius `size`.
 */
export function hexPolygonPoints(cx: number, cy: number, size: number): string {
  const h = size * Math.sqrt(3) / 2
  return [
    [cx + size, cy],
    [cx + size / 2, cy + h],
    [cx - size / 2, cy + h],
    [cx - size, cy],
    [cx - size / 2, cy - h],
    [cx + size / 2, cy - h],
  ]
    .map(([x, y]) => `${(x as number).toFixed(2)},${(y as number).toFixed(2)}`)
    .join(' ')
}

/** Simple seeded LCG so every client generates the identical board layout */
function seededRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = Math.imul(s, 1664525) + 1013904223
    return (s >>> 0) / 0x100000000
  }
}

function seededShuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

/** Generate flat-top axial hex grid positions within a given radius */
function hexesInRadius(radius: number): Array<{ q: number; r: number }> {
  const hexes: Array<{ q: number; r: number }> = []
  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius)
    const r2 = Math.min(radius, -q + radius)
    for (let r = r1; r <= r2; r++) {
      hexes.push({ q, r })
    }
  }
  return hexes
}

/** Flat-top axial to pixel conversion */
function hexToPixel(
  q: number,
  r: number,
  size: number,
): { x: number; y: number } {
  return {
    x: size * (1.5 * q),
    y: size * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r),
  }
}

// ─── Tile and number distributions ───────────────────────────────────────────

const SMALL_TILES: TileType[] = [
  'forest', 'forest',
  'pasture', 'pasture',
  'fields',
  'hills',
  'desert',
]
const SMALL_NUMBERS = [5, 6, 4, 3, 9, 10] // 6 numbers (desert gets none)

const STANDARD_TILES: TileType[] = [
  ...Array<TileType>(4).fill('forest'),
  ...Array<TileType>(4).fill('pasture'),
  ...Array<TileType>(4).fill('fields'),
  ...Array<TileType>(3).fill('hills'),
  ...Array<TileType>(3).fill('mountains'),
  'desert',
]
// Standard Catan numbers (18 tokens, excluding desert)
const STANDARD_NUMBERS = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12]

const LARGE_TILES: TileType[] = [
  ...Array<TileType>(7).fill('forest'),
  ...Array<TileType>(7).fill('pasture'),
  ...Array<TileType>(7).fill('fields'),
  ...Array<TileType>(6).fill('hills'),
  ...Array<TileType>(6).fill('mountains'),
  ...Array<TileType>(4).fill('desert'), // 37 total
]
// 33 numbers for 37−4 non-desert hexes
const LARGE_NUMBERS = [
  2, 2,
  3, 3, 3, 3,
  4, 4, 4, 4,
  5, 5, 5, 5,
  6, 6, 6,
  8, 8, 8,
  9, 9, 9, 9,
  10, 10, 10, 10,
  11, 11, 11,
  12, 12,
]

const BOARD_DEFS = {
  small:    { radius: 1, tiles: SMALL_TILES,    numbers: SMALL_NUMBERS,    hexSize: 80 },
  standard: { radius: 2, tiles: STANDARD_TILES, numbers: STANDARD_NUMBERS, hexSize: 60 },
  large:    { radius: 3, tiles: LARGE_TILES,     numbers: LARGE_NUMBERS,    hexSize: 44 },
} as const

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a board layout deterministically from a seed.
 * All connected clients with the same seed produce the same board.
 */
export function generateBoard(size: BoardSize, seed: number): BoardConfig {
  const def = BOARD_DEFS[size]
  const rng = seededRng(seed)
  const positions = hexesInRadius(def.radius)
  const tiles = seededShuffle([...def.tiles], rng)
  const numbers = seededShuffle([...def.numbers], rng)

  let numIdx = 0
  const hexTiles: HexTile[] = positions.map((pos, i) => {
    const type = tiles[i] ?? 'desert'
    const { x, y } = hexToPixel(pos.q, pos.r, def.hexSize)
    const number = type === 'desert' ? null : (numbers[numIdx++] ?? null)
    return { id: i, q: pos.q, r: pos.r, type, number, x, y }
  })

  // Bounding box with padding
  const xs = hexTiles.map((t) => t.x)
  const ys = hexTiles.map((t) => t.y)
  const pad = def.hexSize * 1.15
  const minX = Math.min(...xs) - pad
  const maxX = Math.max(...xs) + pad
  const minY = Math.min(...ys) - pad * 0.9
  const maxY = Math.max(...ys) + pad * 0.9

  return {
    tiles: hexTiles,
    hexSize: def.hexSize,
    viewBox: `${minX.toFixed(1)} ${minY.toFixed(1)} ${(maxX - minX).toFixed(1)} ${(maxY - minY).toFixed(1)}`,
  }
}
