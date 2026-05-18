/** Build shareable URLs for a room (respects GitHub Pages baseURL). */
export function useInviteLink() {
  const config = useRuntimeConfig()

  function buildInviteUrl(room: string): string {
    const code = room.trim()
    if (!code) return ''

    const base = config.app.baseURL || '/'
    const lobbyPath = `${base.endsWith('/') ? base : `${base}/`}lobby`

    if (import.meta.server) {
      return `${lobbyPath}?room=${encodeURIComponent(code)}`
    }

    const url = new URL(lobbyPath, window.location.origin)
    url.searchParams.set('room', code)
    return url.href
  }

  function whatsAppShareUrl(room: string): string {
    const link = buildInviteUrl(room)
    const text = `Join my Settlers of Catan game! Room: ${room.trim()}\n${link}`
    return `https://wa.me/?text=${encodeURIComponent(text)}`
  }

  return { buildInviteUrl, whatsAppShareUrl }
}
