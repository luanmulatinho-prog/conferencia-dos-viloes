import { useEffect, useRef, useState } from 'react'
import './App.css'
import LocalGame from './LocalGame'
import OnlineMatch, { type MatchView } from './OnlineMatch'

type RoomPlayer = {
  id: number
  name: string
  icon: string
  connected: boolean
}

type RoomState = {
  code: string
  hostId: number
  started: boolean
  min: number
  players: RoomPlayer[]
}

type Screen = 'home' | 'join' | 'lobby' | 'started' | 'local'

const ICONS = ['♛', '♚', '♞', '♜', '☠', '⚔', '⚜', '☥']

// Endereço do servidor: no modo de desenvolvimento (Vite) o WebSocket fica na
// porta 3001; no site publicado ele usa o mesmo endereço da página.
function socketUrl() {
  if (import.meta.env.DEV) return `ws://${window.location.hostname}:3001`

  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${window.location.host}/ws`
}

// Guarda a sala e o token do jogador nesta aba, para poder voltar se a conexão cair
const KEY = 'viloes-session'

function Corners() {
  return (
    <>
      <div className="corner-decoration top-left">✦</div>
      <div className="corner-decoration top-right">✦</div>
      <div className="corner-decoration bottom-left">✦</div>
      <div className="corner-decoration bottom-right">✦</div>
    </>
  )
}

function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [name, setName] = useState('')
  const [icon, setIcon] = useState(ICONS[0])
  const [joinCode, setJoinCode] = useState('')
  const [room, setRoom] = useState<RoomState | null>(null)
  const [myId, setMyId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [view, setView] = useState<MatchView | null>(null)
  const [reconnecting, setReconnecting] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const retryRef = useRef<number | null>(null)
  const startedRef = useRef(false)

  const nameOk = name.trim().length > 0

  function onMessage(msg: {
    type: string
    room?: RoomState
    you?: number
    message?: string
    view?: MatchView
    token?: string
    code?: string
  }) {
    if (msg.type === 'joined' && msg.room) {
      if (msg.token) {
        sessionStorage.setItem(
          KEY,
          JSON.stringify({ code: msg.room.code, token: msg.token })
        )
      }
      setReconnecting(false)
      setRoom(msg.room)
      setMyId(msg.you ?? null)
      setScreen(msg.room.started ? 'started' : 'lobby')
    } else if (msg.type === 'room' && msg.room) {
      setRoom(msg.room)
    } else if (msg.type === 'started' && msg.room) {
      setRoom(msg.room)
      setScreen('started')
    } else if (msg.type === 'view' && msg.view) {
      setView(msg.view)
    } else if (msg.type === 'error') {
      if (msg.code === 'rejoin-failed') {
        sessionStorage.removeItem(KEY)
        setReconnecting(false)
        setRoom(null)
        setView(null)
        setMyId(null)
        setScreen('home')
      }
      setError(msg.message ?? 'Erro.')
    }
  }

  function openSocket(): Promise<WebSocket> {
    const current = wsRef.current
    if (current && current.readyState === WebSocket.OPEN) {
      return Promise.resolve(current)
    }

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(socketUrl())

      ws.onopen = () => {
        wsRef.current = ws

        // Mensagem periódica: evita que proxies derrubem a conexão ociosa e
        // que a hospedagem gratuita "durma" enquanto alguém estiver na sala.
        const timer = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }))
          }
        }, 25000)
        ws.addEventListener('close', () => window.clearInterval(timer))

        resolve(ws)
      }
      ws.onerror = () => reject(new Error('conexão'))
      ws.onmessage = (ev) => onMessage(JSON.parse(ev.data))
      ws.onclose = () => {
        if (wsRef.current !== ws) return
        wsRef.current = null

        if (sessionStorage.getItem(KEY)) {
          // Estava numa sala: tenta voltar sozinho
          setReconnecting(true)
          scheduleReconnect()
        } else {
          setRoom(null)
          setView(null)
          setScreen('home')
          setError('A conexão com o servidor foi perdida.')
        }
      }
    })
  }

  function tryRejoin() {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return

    const session = JSON.parse(raw) as { code: string; token: string }
    openSocket()
      .then((ws) => ws.send(JSON.stringify({ type: 'rejoin', ...session })))
      .catch(() => scheduleReconnect())
  }

  function scheduleReconnect() {
    if (retryRef.current !== null) return

    retryRef.current = window.setTimeout(() => {
      retryRef.current = null
      if (!wsRef.current && sessionStorage.getItem(KEY)) tryRejoin()
    }, 2000)
  }

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    // Ao abrir a página (ou recarregar), volta para a sala se houver uma salva
    if (sessionStorage.getItem(KEY)) {
      setReconnecting(true)
      tryRejoin()
    }

    // Ao voltar para o aplicativo (celular acordou), reconecta se precisar
    function onVisible() {
      if (
        document.visibilityState === 'visible' &&
        sessionStorage.getItem(KEY) &&
        !wsRef.current
      ) {
        setReconnecting(true)
        tryRejoin()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
  }, [])

  async function request(msg: object) {
    setError('')
    try {
      const ws = await openSocket()
      ws.send(JSON.stringify(msg))
    } catch {
      setError('Não foi possível conectar ao servidor. Ele está rodando?')
    }
  }

  function leaveRoom() {
    sessionStorage.removeItem(KEY)
    setReconnecting(false)

    const ws = wsRef.current
    wsRef.current = null
    if (ws) {
      ws.send(JSON.stringify({ type: 'leave' }))
      ws.close()
    }
    setRoom(null)
    setView(null)
    setMyId(null)
    setScreen('home')
  }

  function copyCode() {
    if (room && navigator.clipboard) {
      navigator.clipboard.writeText(room.code)
    }
  }

  const banner = reconnecting ? (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        padding: 8,
        textAlign: 'center',
        background: '#8b5e25',
        color: '#fff4d6',
        fontSize: 13,
      }}
    >
      Reconectando ao servidor...
    </div>
  ) : null

  // ---------- Modo local de teste ----------
  if (screen === 'local') {
    return <LocalGame onExit={() => setScreen('home')} />
  }

  // ---------- Início ----------
  if (screen === 'home') {
    return (
      <main className="app">
        <Corners />
        {banner}

        <section className="home-content">
          <div className="eyebrow">A GRANDE</div>

          <div className="title-decoration">
            <span />
            <strong>CONFERÊNCIA</strong>
            <span />
          </div>

          <h1>DOS VILÕES</h1>

          <div className="subtitle">
            <span>◆</span>
            <p>INFLUÊNCIA • PODER • CONSPIRAÇÃO</p>
            <span>◆</span>
          </div>

          <div className="home-card">
            <div className="card-decoration">
              <span>✦</span>
              <span>✦</span>
              <span>✦</span>
            </div>

            <div className="room-label">ESCOLHA SEU ÍCONE</div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: 8,
                margin: '12px 0 4px',
              }}
            >
              {ICONS.map((i) => (
                <button
                  key={i}
                  className="copy-button"
                  onClick={() => setIcon(i)}
                  style={
                    icon === i
                      ? {
                          borderColor: '#f1d28a',
                          color: '#f1d28a',
                          background: 'rgba(100, 61, 27, 0.5)',
                          fontSize: 18,
                        }
                      : { fontSize: 18 }
                  }
                >
                  {i}
                </button>
              ))}
            </div>

            <input
              className="room-input"
              style={{ fontSize: 16, letterSpacing: 1, textTransform: 'none' }}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
              maxLength={16}
              autoComplete="off"
            />

            {error && (
              <p className="preparation-text" style={{ color: '#e0a080' }}>
                {error}
              </p>
            )}

            <button
              className="primary-button"
              style={{ marginTop: 18 }}
              disabled={!nameOk}
              onClick={() => request({ type: 'create', name, icon })}
            >
              <span className="button-crown">♛</span>
              CRIAR PARTIDA
            </button>

            <button
              className="secondary-button"
              disabled={!nameOk}
              onClick={() => {
                setError('')
                setJoinCode('')
                setScreen('join')
              }}
            >
              ENTRAR EM UMA PARTIDA
            </button>

            <button
              className="secondary-button"
              onClick={() => setScreen('local')}
              style={{ opacity: 0.7 }}
            >
              MODO LOCAL DE TESTE
            </button>

            <div className="card-footer">
              <span />
              <p>5 — 15 JOGADORES</p>
              <span />
            </div>
          </div>
        </section>

        <footer>UMA DISPUTA PELO PODER</footer>
      </main>
    )
  }

  // ---------- Entrar na sala ----------
  if (screen === 'join') {
    return (
      <main className="app">
        <Corners />
        {banner}

        <section className="lobby">
          <header className="lobby-title">
            <div className="eyebrow">ENTRAR NA SALA</div>
            <h1>CONFERÊNCIA DOS VILÕES</h1>
            <p>Digite o código de 4 caracteres fornecido pelo Host.</p>
          </header>

          <section className="home-card join-card">
            <label className="room-label" htmlFor="room-code">
              CÓDIGO DA PARTIDA
            </label>

            <input
              id="room-code"
              className="room-input"
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="A7K2"
              maxLength={4}
              autoComplete="off"
            />

            {error && (
              <p className="preparation-text" style={{ color: '#e0a080' }}>
                {error}
              </p>
            )}

            <button
              className="primary-button"
              style={{ marginTop: 18 }}
              disabled={joinCode.trim().length !== 4}
              onClick={() =>
                request({ type: 'join', code: joinCode, name, icon })
              }
            >
              ENTRAR NA PARTIDA
            </button>

            <button
              className="secondary-button"
              onClick={() => {
                setError('')
                setScreen('home')
              }}
            >
              VOLTAR
            </button>
          </section>
        </section>

        <footer>O PODER ESTÁ NAS SUAS MÃOS</footer>
      </main>
    )
  }

  // ---------- Partida online em andamento ----------
  if (screen === 'started' && view) {
    return (
      <>
        {banner}
        <OnlineMatch
          view={view}
          error={error}
          onAction={(action) => request({ type: 'action', action })}
          onLeave={leaveRoom}
        />
      </>
    )
  }

  // ---------- Lobby e partida iniciada ----------
  if (room && (screen === 'lobby' || screen === 'started')) {
    const isHost = room.hostId === myId
    const canStart = room.players.length >= room.min && room.players.length <= 15

    return (
      <main className="app">
        <Corners />
        {banner}

        <section className="lobby">
          <header className="lobby-title">
            <div className="eyebrow">
              {screen === 'started' ? 'PARTIDA INICIADA' : 'SALA DE JOGO'}
            </div>
            <h1>CONFERÊNCIA DOS VILÕES</h1>
            <p>
              {screen === 'started'
                ? 'A partida começou.'
                : 'Aguardando os participantes...'}
            </p>
          </header>

          <section className="room-card">
            <div className="room-label">CÓDIGO DA PARTIDA</div>
            <div className="room-code-row">
              <strong>{room.code}</strong>
              <button className="copy-button" onClick={copyCode}>
                COPIAR
              </button>
            </div>
          </section>

          <section className="players-card">
            <header className="players-header">
              <div>
                <span className="section-label">PARTICIPANTES</span>
                <h2>Jogadores na sala</h2>
              </div>
              <div className="player-count">
                <strong>{room.players.length}</strong>
                <span>/ 15</span>
              </div>
            </header>

            <div className="players-list">
              {room.players.map((p, index) => (
                <div
                  className="player"
                  key={p.id}
                  style={p.connected ? undefined : { opacity: 0.45 }}
                >
                  <span className="player-number">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="avatar">{p.icon}</div>
                  <div className="player-name">
                    <strong>
                      {p.name}
                      {p.id === myId ? ' (você)' : ''}
                    </strong>
                    {p.id === room.hostId && <span>HOST</span>}
                    {!p.connected && <span>DESCONECTADO</span>}
                  </div>
                  {p.id === room.hostId && (
                    <span className="player-crown">♛</span>
                  )}
                </div>
              ))}
            </div>

            {screen === 'lobby' && (
              <div className="waiting">
                <span>✦</span>
                <p>
                  A partida poderá começar com
                  <strong> {room.min} a 15 jogadores.</strong>
                </p>
                <span>✦</span>
              </div>
            )}

            {screen === 'started' && (
              <div className="waiting">
                <span>✦</span>
                <p>
                  Carregando a partida... Se esta mensagem não sumir, o
                  servidor está desatualizado: pare-o com Ctrl+C e rode de
                  novo.
                </p>
                <span>✦</span>
              </div>
            )}
          </section>

          {error && (
            <p className="preparation-text" style={{ color: '#e0a080' }}>
              {error}
            </p>
          )}

          <section className="lobby-actions">
            {screen === 'lobby' && isHost && (
              <button
                className="primary-button"
                disabled={!canStart}
                onClick={() => request({ type: 'start' })}
              >
                <span className="button-crown">♛</span>
                INICIAR PARTIDA
              </button>
            )}

            {screen === 'lobby' && !isHost && (
              <p className="preparation-text" style={{ textAlign: 'center' }}>
                Aguardando o Host iniciar a partida.
              </p>
            )}

            <button className="secondary-button" onClick={leaveRoom}>
              SAIR DA SALA
            </button>
          </section>
        </section>

        <footer>O PODER ESTÁ NAS SUAS MÃOS</footer>
      </main>
    )
  }

  return null
}

export default App
