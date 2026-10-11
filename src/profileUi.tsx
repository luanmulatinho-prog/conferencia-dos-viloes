import type { CSSProperties } from 'react'
import './profile.css'
import { COLORS, FRAMES, SYMBOLS, colorHex, isTaken, isValidProfile, pickFree } from './profile'

export type Look = { icon: string; color: string; frame: string }

// Símbolo sempre como texto (nunca vira emoji colorido)
export function Sym({ icon }: { icon: string }) {
  return <span className="sym">{icon + '︎'}</span>
}

export function PAvatar({ p }: { p: Look }) {
  return (
    <div
      className="avatar pavatar"
      style={{ '--pc': colorHex(p.color) } as CSSProperties}
    >
      <Sym icon={p.icon} />
    </div>
  )
}

// Crachá com símbolo, nome e moldura
export function PlayerTag({
  p,
  name,
  suffix,
}: {
  p: Look
  name: string
  suffix?: string
}) {
  return (
    <span
      className={`ptag f-${p.frame}`}
      style={{ '--pc': colorHex(p.color) } as CSSProperties}
    >
      <b className="ptag-sym">
        <Sym icon={p.icon} />
      </b>
      <b className="ptag-name">
        {name}
        {suffix ?? ''}
      </b>
    </span>
  )
}

const STORE = 'viloes-profile'

// Perfil e nome lembrados neste aparelho (sem quebrar se o navegador bloquear)
export function loadProfile(): { look: Look; name: string } {
  let saved: { icon?: string; color?: string; frame?: string; name?: string } = {}
  try {
    saved = JSON.parse(localStorage.getItem(STORE) ?? '{}') ?? {}
  } catch {
    saved = {}
  }
  const look = isValidProfile(saved) ? (saved as Look) : pickFree([], null)
  return { look, name: typeof saved.name === 'string' ? saved.name : '' }
}

export function saveProfile(look: Look, name: string) {
  try {
    localStorage.setItem(STORE, JSON.stringify({ ...look, name }))
  } catch {
    // sem armazenamento: tudo bem
  }
}

// Editor de símbolo, cor e moldura.
// "others" são os outros jogadores já na sala (para marcar o que está em uso).
export function ProfileEditor({
  value,
  onChange,
  others,
  name,
}: {
  value: Look
  onChange: (v: Look) => void
  others: { icon: string; color: string }[]
  name: string
}) {
  const pc = colorHex(value.color)
  const usedIcon = (i: string) => others.some((o) => o.icon === i)

  return (
    <div className="pe" style={{ '--pc': pc } as CSSProperties}>
      <span className="pe-title">SÍMBOLO</span>
      <div className="pe-grid">
        {SYMBOLS.map((i) => (
          <button
            key={i}
            type="button"
            className={`pe-sym${value.icon === i ? ' on' : ''}`}
            onClick={() => onChange(pickFree(others, { ...value, icon: i }))}
          >
            <Sym icon={i} />
            {usedIcon(i) && <span className="used">em uso</span>}
          </button>
        ))}
      </div>

      <span className="pe-title">COR</span>
      <div className="pe-grid">
        {COLORS.map((c) => {
          const blocked = isTaken(others, value.icon, c.id)
          return (
            <button
              key={c.id}
              type="button"
              title={c.name}
              aria-label={c.name}
              disabled={blocked}
              className={`pe-color${value.color === c.id ? ' on' : ''}`}
              style={{ '--pc': c.hex } as CSSProperties}
              onClick={() => onChange({ ...value, color: c.id })}
            />
          )
        })}
      </div>

      <span className="pe-title">MOLDURA</span>
      <div className="pe-grid">
        {FRAMES.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`pe-frame${value.frame === f.id ? ' on' : ''}`}
            onClick={() => onChange({ ...value, frame: f.id })}
          >
            {f.id === 'none' ? (
              <span className="ptag">
                <b className="ptag-name">{f.name}</b>
              </span>
            ) : (
              <PlayerTag
                p={{ icon: value.icon, color: value.color, frame: f.id }}
                name={f.name}
              />
            )}
          </button>
        ))}
      </div>

      <div className="pe-preview">
        <PlayerTag p={value} name={name.trim() || 'Seu nome'} />
      </div>
    </div>
  )
}
