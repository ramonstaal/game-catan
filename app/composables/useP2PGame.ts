import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'
import {
  MAX_SEATS,
  MIN_PLAYERS_TO_START,
  PLAYER_COLORS,
  type GameRecord,
  type PlayerColor,
  type PlayerRecord,
  type RoomStatus,
  type SeatedPlayer,
} from '~/types/p2p'

const CLIENT_ID_KEY = 'catan-client-id'
const SIGNALING_URLS = ['wss://signaling.yjs.dev']

/** Persistent browser identity for seat assignment */
function getClientId(): string {
  if (import.meta.server) return ''
  let id = localStorage.getItem(CLIENT_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(CLIENT_ID_KEY, id)
  }
  return id
}

function readClientMap(entry: Y.Map<unknown>): PlayerRecord | null {
  const id = entry.get('id') as string | undefined
  const name = entry.get('name') as string | undefined
  if (!id || !name) return null
  return {
    id,
    name,
    seatIndex: (entry.get('seatIndex') as number) ?? -1,
    color: (entry.get('color') as PlayerColor | null) ?? null,
    isReady: Boolean(entry.get('isReady')),
    connected: entry.get('connected') !== false,
  }
}

function snapshotClients(clientsMap: Y.Map<Y.Map<unknown>>): PlayerRecord[] {
  const list: PlayerRecord[] = []
  clientsMap.forEach((entry) => {
    const rec = readClientMap(entry)
    if (rec) list.push(rec)
  })
  return list
}

function snapshotGame(gameMap: Y.Map<unknown>): GameRecord {
  return {
    status: (gameMap.get('status') as RoomStatus) ?? 'lobby',
    currentTurnIndex: (gameMap.get('currentTurnIndex') as number) ?? 0,
    hostId: (gameMap.get('hostId') as string | null) ?? null,
  }
}

/** Smallest seat index 0..3 not taken by another seated client */
function nextFreeSeat(
  clientsMap: Y.Map<Y.Map<unknown>>,
  excludeId: string,
): number | null {
  const taken = new Set<number>()
  clientsMap.forEach((entry, key) => {
    if (key === excludeId) return
    const seat = entry.get('seatIndex') as number
    if (seat >= 0 && seat < MAX_SEATS) taken.add(seat)
  })
  for (let i = 0; i < MAX_SEATS; i++) {
    if (!taken.has(i)) return i
  }
  return null
}

/** Reassign host to lowest seated seat if current host is absent or spectating */
function reconcileHost(
  gameMap: Y.Map<unknown>,
  clientsMap: Y.Map<Y.Map<unknown>>,
): void {
  const hostId = gameMap.get('hostId') as string | null
  const seated = snapshotClients(clientsMap)
    .filter((p) => p.seatIndex >= 0 && p.seatIndex < MAX_SEATS)
    .sort((a, b) => a.seatIndex - b.seatIndex)

  if (seated.length === 0) {
    gameMap.set('hostId', null)
    return
  }

  const hostStillValid =
    hostId && seated.some((p) => p.id === hostId)
  if (!hostStillValid) {
    gameMap.set('hostId', seated[0]!.id)
  }
}

/**
 * Assign or refresh this client's seat: seated (0–3) or spectator (-1).
 * Runs inside a Yjs transaction for atomic updates.
 */
function assignPlayerSlot(
  ydoc: Y.Doc,
  clientId: string,
  name: string,
): void {
  const clientsMap = ydoc.getMap<Y.Map<unknown>>('clients')
  const gameMap = ydoc.getMap<unknown>('game')

  let entry = clientsMap.get(clientId)
  if (!entry) {
    entry = new Y.Map<unknown>()
    clientsMap.set(clientId, entry)
  }

  entry.set('id', clientId)
  entry.set('name', name)
  entry.set('connected', true)

  const currentSeat = entry.get('seatIndex') as number | undefined
  let seatIndex = currentSeat ?? -1

  if (seatIndex < 0 || seatIndex >= MAX_SEATS) {
    const free = nextFreeSeat(clientsMap, clientId)
    if (free !== null) {
      seatIndex = free
    } else {
      seatIndex = -1
    }
  }

  entry.set('seatIndex', seatIndex)
  if (seatIndex >= 0 && seatIndex < MAX_SEATS) {
    entry.set('color', PLAYER_COLORS[seatIndex]!)
    if (entry.get('isReady') === undefined) {
      entry.set('isReady', false)
    }
  } else {
    entry.set('color', null)
    entry.set('isReady', false)
  }

  if (!gameMap.has('status')) {
    gameMap.set('status', 'lobby')
  }
  if (!gameMap.has('currentTurnIndex')) {
    gameMap.set('currentTurnIndex', 0)
  }

  reconcileHost(gameMap, clientsMap)
}

// Singleton connection state shared across pages in the same session
const ydocRef = shallowRef<Y.Doc | null>(null)
const providerRef = shallowRef<WebrtcProvider | null>(null)
const roomNameRef = ref<string | null>(null)
const clientIdRef = ref('')
const clientsSnapshot = shallowRef<PlayerRecord[]>([])
const gameSnapshot = shallowRef<GameRecord>({
  status: 'lobby',
  currentTurnIndex: 0,
  hostId: null,
})

let observersAttached = false

function attachObservers(ydoc: Y.Doc) {
  if (observersAttached) return
  observersAttached = true

  const clientsMap = ydoc.getMap<Y.Map<unknown>>('clients')
  const gameMap = ydoc.getMap<unknown>('game')

  const refreshClients = () => {
    clientsSnapshot.value = snapshotClients(clientsMap)
  }
  const refreshGame = () => {
    gameSnapshot.value = snapshotGame(gameMap)
  }

  clientsMap.observeDeep(refreshClients)
  gameMap.observe(refreshGame)
  refreshClients()
  refreshGame()
}

function disconnect() {
  providerRef.value?.destroy()
  providerRef.value = null
  ydocRef.value?.destroy()
  ydocRef.value = null
  roomNameRef.value = null
  observersAttached = false
  clientsSnapshot.value = []
  gameSnapshot.value = {
    status: 'lobby',
    currentTurnIndex: 0,
    hostId: null,
  }
}

export function useP2PGame() {
  const clientId = computed(() => clientIdRef.value)

  const seatedPlayers = computed((): SeatedPlayer[] =>
    clientsSnapshot.value
      .filter(
        (p): p is SeatedPlayer =>
          p.seatIndex >= 0 &&
          p.seatIndex < MAX_SEATS &&
          p.color !== null,
      )
      .sort((a, b) => a.seatIndex - b.seatIndex),
  )

  const spectators = computed(() =>
    clientsSnapshot.value.filter((p) => p.seatIndex < 0),
  )

  const me = computed(() =>
    clientsSnapshot.value.find((p) => p.id === clientIdRef.value) ?? null,
  )

  const isHost = computed(
    () => gameSnapshot.value.hostId === clientIdRef.value,
  )

  const readyCount = computed(
    () => seatedPlayers.value.filter((p) => p.isReady).length,
  )

  const canStart = computed(
    () =>
      isHost.value &&
      gameSnapshot.value.status === 'lobby' &&
      seatedPlayers.value.length >= MIN_PLAYERS_TO_START &&
      readyCount.value >= MIN_PLAYERS_TO_START,
  )

  const gameStatus = computed(() => gameSnapshot.value.status)
  const hostId = computed(() => gameSnapshot.value.hostId)
  const currentTurnIndex = computed(
    () => gameSnapshot.value.currentTurnIndex,
  )

  function connectRoom(roomName: string, displayName: string) {
    if (import.meta.server) return

    const trimmedRoom = roomName.trim()
    const trimmedName = displayName.trim()
    if (!trimmedRoom || !trimmedName) return

    if (roomNameRef.value === trimmedRoom && ydocRef.value) {
      assignPlayerSlot(ydocRef.value, clientIdRef.value, trimmedName)
      return
    }

    disconnect()

    clientIdRef.value = getClientId()
    roomNameRef.value = trimmedRoom

    const ydoc = new Y.Doc()
    ydocRef.value = ydoc

    const provider = new WebrtcProvider(trimmedRoom, ydoc, {
      signaling: SIGNALING_URLS,
    })
    providerRef.value = provider

    const awareness = provider.awareness
    awareness.setLocalStateField('clientId', clientIdRef.value)
    awareness.setLocalStateField('name', trimmedName)

    attachObservers(ydoc)

    ydoc.transact(() => {
      assignPlayerSlot(ydoc, clientIdRef.value, trimmedName)
    })
  }

  function setReady(ready: boolean) {
    const ydoc = ydocRef.value
    if (!ydoc || !clientIdRef.value) return

    ydoc.transact(() => {
      const clientsMap = ydoc.getMap<Y.Map<unknown>>('clients')
      const entry = clientsMap.get(clientIdRef.value)
      if (!entry) return
      const seat = entry.get('seatIndex') as number
      if (seat < 0 || seat >= MAX_SEATS) return
      entry.set('isReady', ready)
    })
  }

  function startGame() {
    const ydoc = ydocRef.value
    if (!ydoc || !canStart.value) return

    ydoc.transact(() => {
      const gameMap = ydoc.getMap<unknown>('game')
      gameMap.set('status', 'playing')
      gameMap.set('currentTurnIndex', 0)
    })
  }

  function setCurrentTurnIndex(index: number) {
    const ydoc = ydocRef.value
    if (!ydoc) return
    const count = seatedPlayers.value.length
    if (count === 0) return

    ydoc.transact(() => {
      const gameMap = ydoc.getMap<unknown>('game')
      gameMap.set('currentTurnIndex', ((index % count) + count) % count)
    })
  }

  function advanceTurn() {
    setCurrentTurnIndex(currentTurnIndex.value + 1)
  }

  onBeforeUnmount(() => {
    // Keep connection alive when navigating lobby <-> game
  })

  return {
    connectRoom,
    disconnect,
    setReady,
    startGame,
    setCurrentTurnIndex,
    advanceTurn,
    clientId,
    roomName: readonly(roomNameRef),
    seatedPlayers,
    spectators,
    me,
    isHost,
    canStart,
    readyCount,
    gameStatus,
    hostId,
    currentTurnIndex,
    isConnected: computed(() => Boolean(ydocRef.value)),
  }
}
