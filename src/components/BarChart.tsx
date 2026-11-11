// Gráfica de barras de una sola serie (SVG, sin librerías). Barras finas,
// esquina redondeada arriba, rejilla discreta y el valor al pasar el mouse.
import { useState } from 'react'

export interface Bar { label: string, value: number | null, hint?: string }

export function BarChart ({ data, height = 140, max, unit = '', color = 'var(--color-brand)', ariaLabel }: {
  data: Bar[], height?: number, max?: number, unit?: string, color?: string, ariaLabel: string,
}) {
  const [hover, setHover] = useState<number | null>(null)
  if (!data.length) return <p className='py-8 text-center text-sm text-slate-400'>Sin datos todavía</p>
  const top = max ?? Math.max(1, ...data.map(d => d.value ?? 0))
  const w = 600
  const slot = w / data.length
  const bar = Math.max(2, Math.min(18, slot * 0.6))
  const pad = 18
  const h = height
  const y = (v: number) => pad + (h - pad * 2) * (1 - v / top)
  const ticks = [0, top / 2, top]
  const fmt = (v: number) => (Number.isInteger(v) ? v : v.toFixed(1)) + unit

  return (
    <div className='relative'>
      <svg viewBox={`0 0 ${w} ${h}`} className='w-full' role='img' aria-label={ariaLabel}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={0} x2={w} y1={y(t)} y2={y(t)} stroke='#e2e8f0' strokeWidth={1} />
            <text x={2} y={y(t) - 3} fontSize={10} fill='#94a3b8'>{fmt(Math.round(t * 10) / 10)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = i * slot + (slot - bar) / 2
          const v = d.value ?? 0
          const top_ = y(v)
          const r = Math.min(4, bar / 2, (h - pad - top_))
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {/* área sensible más grande que la barra */}
              <rect x={i * slot} y={0} width={slot} height={h} fill='transparent' />
              {d.value != null && v > 0 && (
                <path
                  d={`M${x},${h - pad} V${top_ + r} Q${x},${top_} ${x + r},${top_} H${x + bar - r} Q${x + bar},${top_} ${x + bar},${top_ + r} V${h - pad} Z`}
                  fill={color} opacity={hover === null || hover === i ? 1 : 0.55}
                />
              )}
            </g>
          )
        })}
        <line x1={0} x2={w} y1={h - pad} y2={h - pad} stroke='#cbd5e1' strokeWidth={1} />
        {[0, Math.floor(data.length / 2), data.length - 1].filter((v, i, a) => a.indexOf(v) === i).map(i => (
          <text key={i} x={i * slot + slot / 2} y={h - 4} fontSize={10} fill='#64748b' textAnchor='middle'>{data[i].label}</text>
        ))}
      </svg>
      {hover !== null && (
        <div className='pointer-events-none absolute -top-2 rounded-md bg-slate-900 px-2 py-1 text-xs text-white shadow'
          style={{ left: `${Math.min(85, (hover + 0.5) / data.length * 100)}%`, transform: 'translateX(-50%)' }}>
          <b>{data[hover].label}</b>: {data[hover].value == null ? 'sin dato' : fmt(data[hover].value!)}
          {data[hover].hint && <div className='text-slate-300'>{data[hover].hint}</div>}
        </div>
      )}
    </div>
  )
}
