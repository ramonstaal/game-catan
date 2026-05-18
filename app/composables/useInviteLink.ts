/** Build shareable URLs for a room (respects GitHub Pages baseURL). */
export function useInviteLink() {
  const config = useRuntimeConfig()

  function buildInviteUrl(room: string): string {
    const code = room.trim()
    if (!code) return ''

    if (import.meta.server) {
      const base = config.app.baseURL || '/'
      return `${base}?room=${encodeURIComponent(code)}`
    }

    const base = config.app.baseURL || '/'
    const path = base.endsWith('/') ? base : `${base}/`
    const url = new URL(path, window.location.origin)
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
