// Servidor online de Conferência dos Vilões.
// Rodar na pasta do projeto:  node server/server.mjs
// Para testar com menos jogadores (mínimo 3): MIN_PLAYERS=3 node server/server.mjs

import { randomBytes } from 'node:crypto'
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { dirname, extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'
import { buildLib } from './build-lib.mjs'

// Converte a lógica TypeScript (src/) para JavaScript antes de carregar a partida
buildLib()
const { createMatch, handleAction, viewFor } = await import('./match.mjs')
const { pickFree, isValidProfile, isTaken } = await import('./lib/profile.mjs')

// Hospedagens definem a porta pela variável PORT
const PORT = Number(process.env.PORT) || 3001
// A eleição e a indicação precisam de pelo menos 3 jogadores.
const MIN = Math.max(3, Number(process.env.MIN_PLAYERS) || 5)
const MAX = 15
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

// Tempo que um jogador desconectado no lobby é mantido antes de ser removido
const LOBBY_GRACE_MS = 30 * 1000
// Tempo que uma partida sem ninguém conectado é mantida
const IDLE_ROOM_MS = 10 * 60 * 1000

const rooms = new Map()
let nextId = 1

function makeCode() {
  for (;;) {
    let code = ''
    for (let i = 0; i < 4; i++) {
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
    }
    if (!rooms.has(code)) return code
  }
}

function view(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    started: room.started,
    min: MIN,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      icon: p.icon,
      color: p.color,
      frame: p.frame,
      connected: p.connected,
    })),
  }
}

function send(ws, msg) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg))
}

function broadcast(room, msg) {
  for (const p of room.players) send(p.ws, msg)
}

// Cada jogador recebe somente a sua própria visão da partida
function pushViews(room) {
  if (!room.match) return
  room.match.connected = room.players.map((p) => p.connected)
  for (const p of room.players) {
    if (p.ws) send(p.ws, { type: 'view', view: viewFor(room.match, p.id) })
  }
}

function cleanName(value) {
  return String(value ?? '').trim().slice(0, 16)
}

function addPlayer(room, ws, name, wanted) {
  const profile = pickFree(room.players, wanted)
  const player = {
    id: nextId++,
    token: randomBytes(12).toString('hex'),
    name,
    icon: profile.icon,
    color: profile.color,
    frame: profile.frame,
    ws,
    connected: true,
    timer: null,
  }
  room.players.push(player)
  ws.room = room
  ws.player = player
  return player
}

// Remove de vez um jogador do lobby (só antes do início)
function removePlayer(room, player) {
  if (player.timer) clearTimeout(player.timer)
  room.players = room.players.filter((p) => p.id !== player.id)

  if (room.players.length === 0) {
    rooms.delete(room.code)
    return
  }

  // Host saiu: o próximo jogador pela ordem de entrada vira Host.
  if (room.hostId === player.id) room.hostId = room.players[0].id

  broadcast(room, { type: 'room', room: view(room) })
}

// Conexão caiu (celular dormiu, aba fechada...). O jogador pode voltar com o token.
function disconnect(ws) {
  const room = ws.room
  const player = ws.player
  if (!room || !player) return

  ws.room = null
  ws.player = null
  if (player.ws !== ws) return // já foi substituída por uma reconexão

  player.connected = false
  player.ws = null

  if (!room.started) {
    player.timer = setTimeout(() => removePlayer(room, player), LOBBY_GRACE_MS)
  } else if (room.players.every((p) => !p.connected)) {
    room.idleTimer = setTimeout(() => rooms.delete(room.code), IDLE_ROOM_MS)
  }

  broadcast(room, { type: 'room', room: view(room) })
  pushViews(room)
}

function joined(ws, room, player) {
  send(ws, {
    type: 'joined',
    you: player.id,
    token: player.token,
    room: view(room),
  })
}

function handle(ws, msg) {
  // Batimento de coração dos clientes (mantém a conexão e a hospedagem ativas)
  if (msg.type === 'ping') return send(ws, { type: 'pong' })

  if (msg.type === 'create') {
    if (ws.room) return
    const name = cleanName(msg.name)
    if (!name) return send(ws, { type: 'error', message: 'Digite um nome.' })

    const room = {
      code: makeCode(),
      hostId: 0,
      started: false,
      players: [],
      match: null,
      idleTimer: null,
    }
    const player = addPlayer(room, ws, name, msg.profile)
    room.hostId = player.id
    rooms.set(room.code, room)

    return joined(ws, room, player)
  }

  if (msg.type === 'join') {
    if (ws.room) return
    const name = cleanName(msg.name)
    if (!name) return send(ws, { type: 'error', message: 'Digite um nome.' })

    const code = String(msg.code ?? '').trim().toUpperCase()
    const room = rooms.get(code)

    if (!room) return send(ws, { type: 'error', message: 'Sala não encontrada.' })
    if (room.started) {
      return send(ws, { type: 'error', message: 'A partida já começou.' })
    }
    if (room.players.length >= MAX) {
      return send(ws, { type: 'error', message: 'A sala está cheia.' })
    }
    if (room.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      return send(ws, {
        type: 'error',
        message: 'Já existe um jogador com esse nome na sala.',
      })
    }

    const player = addPlayer(room, ws, name, msg.profile)
    joined(ws, room, player)
    broadcast(room, { type: 'room', room: view(room) })
    return
  }

  // Volta para a sala depois de uma queda de conexão
  if (msg.type === 'rejoin') {
    if (ws.room) return

    const room = rooms.get(String(msg.code ?? '').trim().toUpperCase())
    const player = room?.players.find((p) => p.token === msg.token)

    if (!room || !player) {
      return send(ws, {
        type: 'error',
        code: 'rejoin-failed',
        message: 'Não foi possível voltar para a sala.',
      })
    }

    if (player.timer) {
      clearTimeout(player.timer)
      player.timer = null
    }
    if (room.idleTimer) {
      clearTimeout(room.idleTimer)
      room.idleTimer = null
    }

    // Se ainda existe uma conexão antiga desse jogador, ela é derrubada.
    if (player.ws && player.ws !== ws) {
      const old = player.ws
      old.room = null
      old.player = null
      old.close()
    }

    player.ws = ws
    player.connected = true
    ws.room = room
    ws.player = player

    joined(ws, room, player)
    broadcast(room, { type: 'room', room: view(room) })
    pushViews(room)
    return
  }

  // Troca de símbolo/cor/moldura (só no lobby)
  if (msg.type === 'profile') {
    const room = ws.room
    const player = ws.player
    if (!room || !player || room.started) return

    const p = msg.profile
    if (!isValidProfile(p)) return
    const others = room.players.filter((o) => o.id !== player.id)
    if (isTaken(others, p.icon, p.color)) {
      send(ws, {
        type: 'error',
        message: 'Outro jogador já usa esse símbolo com essa cor.',
      })
      return send(ws, { type: 'room', room: view(room) })
    }
    player.icon = p.icon
    player.color = p.color
    player.frame = p.frame
    return broadcast(room, { type: 'room', room: view(room) })
  }

  if (msg.type === 'start') {
    const room = ws.room
    if (!room || room.started) return

    if (room.hostId !== ws.player.id) {
      return send(ws, { type: 'error', message: 'Só o Host pode iniciar.' })
    }
    if (room.players.length < MIN || room.players.length > MAX) {
      return send(ws, {
        type: 'error',
        message: `A partida precisa de ${MIN} a ${MAX} jogadores.`,
      })
    }
    if (room.players.some((p) => !p.connected)) {
      return send(ws, {
        type: 'error',
        message: 'Há jogador desconectado. Espere ele voltar.',
      })
    }

    room.started = true
    room.match = createMatch(room.players)
    console.log(
      `Partida iniciada na sala ${room.code} com ${room.players.length} jogadores`
    )
    broadcast(room, { type: 'started', room: view(room) })
    pushViews(room)
    return
  }

  if (msg.type === 'action') {
    const room = ws.room
    if (!room || !room.match || !ws.player) return

    room.match.connected = room.players.map((p) => p.connected)
    const error = handleAction(room.match, ws.player.id, msg.action ?? {})
    if (error) send(ws, { type: 'error', message: error })

    // Mesmo quando a ação é recusada o estado pode ter mudado (ofertas que
    // venceram, fase que terminou...), então todos recebem a visão atualizada.
    pushViews(room)
    return
  }

  // Sair de propósito
  if (msg.type === 'leave') {
    const room = ws.room
    const player = ws.player
    if (!room || !player) return

    ws.room = null
    ws.player = null

    if (!room.started) {
      removePlayer(room, player)
    } else {
      player.connected = false
      player.ws = null
      broadcast(room, { type: 'room', room: view(room) })
      pushViews(room)
    }
  }
}

// ---------------------------------------------------------------------
// Site (pasta dist, gerada por "npx vite build") + WebSocket na mesma porta
// ---------------------------------------------------------------------

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
}

const httpServer = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost')

    if (url.pathname === '/health') {
      res.writeHead(200, { 'content-type': 'text/plain' })
      return res.end('ok')
    }

    let file = normalize(join(DIST, decodeURIComponent(url.pathname)))
    if (file !== DIST && !file.startsWith(DIST + sep)) {
      res.writeHead(403)
      return res.end('Acesso negado')
    }

    let info = await stat(file).catch(() => null)
    if (info && info.isDirectory()) {
      file = join(file, 'index.html')
      info = await stat(file).catch(() => null)
    }

    // Qualquer endereço desconhecido abre a página inicial do jogo
    if (!info) {
      file = join(DIST, 'index.html')
      info = await stat(file).catch(() => null)
    }

    if (!info) {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' })
      return res.end('O site ainda não foi construído. Rode: npx vite build')
    }

    const body = await readFile(file)
    const cache = file.includes(`${sep}assets${sep}`)
      ? 'public, max-age=31536000, immutable'
      : 'no-cache'

    res.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      'cache-control': cache,
    })
    res.end(body)
  } catch {
    res.writeHead(500)
    res.end('Erro no servidor')
  }
})

const wss = new WebSocketServer({ server: httpServer })

wss.on('connection', (ws) => {
  ws.room = null
  ws.player = null

  ws.on('message', (raw) => {
    let msg
    try {
      msg = JSON.parse(String(raw))
    } catch {
      return
    }
    try {
      handle(ws, msg)
    } catch (err) {
      console.error('Erro ao processar mensagem:', err)
      send(ws, { type: 'error', message: 'Erro no servidor. Veja o terminal.' })
    }
  })

  ws.on('close', () => disconnect(ws))
})

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${PORT} (mínimo de jogadores: ${MIN})`)
  console.log(`Site: http://localhost:${PORT}`)
})
