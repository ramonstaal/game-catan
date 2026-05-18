#!/usr/bin/env node
/**
 * Minimal Yjs WebSocket server for Catan room sync.
 * Deploy to Render/Fly/Railway and set NUXT_PUBLIC_YJS_WS_URL to this host.
 */
const http = require('http')
const WebSocket = require('ws')
const { setupWSConnection } = require('y-websocket/bin/utils')

const host = process.env.HOST || '0.0.0.0'
const port = Number(process.env.PORT || 1234)

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('catan yjs sync server\n')
})

const wss = new WebSocket.Server({ noServer: true })

wss.on('connection', (ws, req) => {
  setupWSConnection(ws, req, { gc: true })
})

server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request)
  })
})

server.listen(port, host, () => {
  console.log(`Catan sync server listening on ${host}:${port}`)
})
