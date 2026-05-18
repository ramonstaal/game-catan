import * as Y from 'yjs'
import { Awareness } from 'y-protocols/awareness'
import { WebrtcProvider } from 'y-webrtc'
import { WebsocketProvider } from 'y-websocket'
import {
  MAX_SEATS,
  MIN_PLAYERS_TO_START,
  normalizeRoomId,
  PLAYER_COLORS,
  type GameRecord,
  type PlayerColor,
  type PlayerRecord,
  type RoomStatus,
  type SeatedPlayer,
} from '~/types/p2p'

const CLIENT_ID_KEY = 'catan-client-id'

const SIGNALING_URLS = [
  'wss://signaling.yjs.dev',
  'wss://y-webrtc-eu.fly.dev',
]

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
]

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
    seatIndex = free !== null ? free : -1
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

const ydocRef = shallowRef<Y.Doc | null>(null)
const webrtcProviderRef = shallowRef<WebrtcProvider | null>(null)
const wsProviderRef = shallowRef<WebsocketProvider | null>(null)
const roomNameRef = ref<string | null>(null)
const displayNameRef = ref('')
const clientIdRef = ref('')
const peerCountRef = ref(0)
const wsReadyRef = ref(false)
const webrtcReadyRef = ref(false)
const connectionErrorRef = ref<string | null>(null)
const clientsSnapshot = shallowRef<PlayerRecord[]>([])
const gameSnapshot = shallowRef<GameRecord>({
  status: 'lobby',
  currentTurnIndex: 0,
  hostId: null,
})

let cleanupObservers: (() => void) | null = null
let cleanupProviderListeners: (() => void) | null = null
let syncPollTimer: ReturnType<typeof setInterval> | null = null
let syncPollTimeout: ReturnType<typeof setTimeout> | null = null

function clearSyncPoll() {
  if (syncPollTimer) clearInterval(syncPollTimer)
  if (syncPollTimeout) clearTimeout(syncPollTimeout)
  syncPollTimer = null
  syncPollTimeout = null
}

function updateNetworkReady() {
  const ws = wsProviderRef.value
  wsReadyRef.value = Boolean(ws?.wsconnected && ws.synced)
  const rtc = webrtcProviderRef.value
  webrtcReadyRef.value = Boolean(rtc?.connected)
}

function hasRemotePlayers(): boolean {
  return clientsSnapshot.value.some((p) => p.id !== clientIdRef.value)
}

function attachObservers(ydoc: Y.Doc) {
  cleanupObservers?.()

  const clientsMap = ydoc.getMap<Y.Map<unknown>>('clients')
  const gameMap = ydoc.getMap<unknown>('game')

  const refreshClients = () => {
    clientsSnapshot.value = snapshotClients(clientsMap)
    if (hasRemotePlayers()) {
      connectionErrorRef.value = null
    }
  }
  const refreshGame = () => {
    gameSnapshot.value = snapshotGame(gameMap)
  }

  clientsMap.observeDeep(refreshClients)
  gameMap.observe(refreshGame)
  refreshClients()
  refreshGame()

  cleanupObservers = () => {
    clientsMap.unobserveDeep(refreshClients)
    gameMap.unobserve(refreshGame)
  }
}

function ensureJoined() {
  const ydoc = ydocRef.value
  const clientId = clientIdRef.value
  const name = displayNameRef.value.trim()
  if (!ydoc || !clientId || !name) return

  ydoc.transact(() => {
    assignPlayerSlot(ydoc, clientId, name)
  })
}

function disconnect() {
  clearSyncPoll()
  cleanupProviderListeners?.()
  cleanupProviderListeners = null
  cleanupObservers?.()
  cleanupObservers = null

  webrtcProviderRef.value?.destroy()
  webrtcProviderRef.value = null
  wsProviderRef.value?.destroy()
  wsProviderRef.value = null
  ydocRef.value?.destroy()
  ydocRef.value = null
  roomNameRef.value = null
  displayNameRef.value = ''
  peerCountRef.value = 0
  wsReadyRef.value = false
  webrtcReadyRef.value = false
  connectionErrorRef.value = null
  clientsSnapshot.value = []
  gameSnapshot.value = {
    status: 'lobby',
    currentTurnIndex: 0,
    hostId: null,
  }
}

function wireProviders(webrtc: WebrtcProvider, ws: WebsocketProvider | null) {
  cleanupProviderListeners?.()

  const onWebrtcSynced = () => updateNetworkReady()

  const onPeers = ({
    added,
    webrtcPeers,
  }: {
    added: string[]
    webrtcPeers: string[]
  }) => {
    peerCountRef.value = webrtcPeers.length
    if (added.length > 0 && displayNameRef.value.trim()) ensureJoined()
    updateNetworkReady()
  }

  const onWebrtcStatus = ({ connected }: { connected: boolean }) => {
    if (!connected) peerCountRef.value = 0
    updateNetworkReady()
  }

  const onWsStatus = ({
    status,
  }: {
    status: 'connected' | 'disconnected' | 'connecting'
  }) => {
    if (status === 'connected') {
      connectionErrorRef.value = null
    }
    updateNetworkReady()
  }

  const onWsSync = (isSynced: boolean) => {
    if (isSynced) connectionErrorRef.value = null
    updateNetworkReady()
  }

  const onWsError = () => {
    connectionErrorRef.value =
      'Could not reach the game sync server. Deploy sync-server (see README) or use WebRTC-only on the same network.'
  }

  webrtc.on('synced', onWebrtcSynced)
  webrtc.on('peers', onPeers)
  webrtc.on('status', onWebrtcStatus)

  if (ws) {
    ws.on('status', onWsStatus)
    ws.on('sync', onWsSync)
    ws.on('connection-error', onWsError)
  }

  cleanupProviderListeners = () => {
    webrtc.off('synced', onWebrtcSynced)
    webrtc.off('peers', onPeers)
    webrtc.off('status', onWebrtcStatus)
    if (ws) {
      ws.off('status', onWsStatus)
      ws.off('sync', onWsSync)
      ws.off('connection-error', onWsError)
    }
  }
}

export function useP2PGame() {
  const config = useRuntimeConfig()

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

  const isConnected = computed(
    () =>
      wsReadyRef.value ||
      webrtcReadyRef.value ||
      hasRemotePlayers() ||
      peerCountRef.value > 0,
  )

  const peerCount = computed(() => peerCountRef.value)
  const hasJoined = computed(() => Boolean(displayNameRef.value.trim()))
  const connectionError = computed(() => connectionErrorRef.value)

  function connectRoom(roomName: string, displayName = '') {
    if (import.meta.server) return

    const trimmedRoom = roomName.trim()
    const trimmedName = displayName.trim()
    if (!trimmedRoom) return

    const p2pRoomId = normalizeRoomId(trimmedRoom)

    if (
      roomNameRef.value === p2pRoomId &&
      ydocRef.value &&
      webrtcProviderRef.value
    ) {
      displayNameRef.value = trimmedName
      webrtcProviderRef.value.awareness.setLocalStateField(
        'name',
        trimmedName || undefined,
      )
      if (trimmedName) ensureJoined()
      return
    }

    disconnect()

    clientIdRef.value = getClientId()
    roomNameRef.value = p2pRoomId
    displayNameRef.value = trimmedName
    connectionErrorRef.value = null

    const ydoc = new Y.Doc()
    ydocRef.value = ydoc
    const awareness = new Awareness(ydoc)

    const wsUrl = (config.public.yjsWsUrl as string)?.trim()
    let ws: WebsocketProvider | null = null
    if (wsUrl) {
      ws = new WebsocketProvider(wsUrl, p2pRoomId, ydoc, { awareness })
      wsProviderRef.value = ws
    } else {
      wsProviderRef.value = null
      connectionErrorRef.value =
        'No sync server configured — trying peer-to-peer only. For reliable play across phones, deploy sync-server (see README).'
    }

    const webrtc = new WebrtcProvider(p2pRoomId, ydoc, {
      awareness,
      signaling: SIGNALING_URLS,
      password: p2pRoomId,
      maxConns: 4,
      peerOpts: {
        config: { iceServers: ICE_SERVERS },
      },
    })
    webrtcProviderRef.value = webrtc

    awareness.setLocalStateField('clientId', clientIdRef.value)
    awareness.setLocalStateField('name', trimmedName || undefined)
    awareness.setLocalStateField('room', trimmedRoom)

    wireProviders(webrtc, ws)
    attachObservers(ydoc)
    if (trimmedName) ensureJoined()

    clearSyncPoll()
    syncPollTimer = setInterval(updateNetworkReady, 500)
    syncPollTimeout = setTimeout(() => {
      updateNetworkReady()
      if (
        !wsReadyRef.value &&
        !webrtcReadyRef.value &&
        !hasRemotePlayers() &&
        peerCountRef.value === 0
      ) {
        if (ws && !ws.wsconnected) {
          connectionErrorRef.value =
            'Sync server unreachable. Deploy sync-server on Render and set NUXT_PUBLIC_YJS_WS_URL when building.'
        }
      }
      clearSyncPoll()
    }, 12000)
  }

  function joinRoom(roomName: string, displayName: string) {
    connectRoom(roomName, displayName)
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

  onBeforeUnmount(() => {})

  return {
    connectRoom,
    joinRoom,
    disconnect,
    setReady,
    startGame,
    setCurrentTurnIndex,
    advanceTurn,
    clientId: computed(() => clientIdRef.value),
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
    isConnected,
    peerCount,
    hasJoined,
    connectionError,
  }
}
