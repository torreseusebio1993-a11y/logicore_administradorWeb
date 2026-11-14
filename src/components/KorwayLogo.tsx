/** Logo de Korway: la "K" sobre Volt Lime con un punto de ruta. */
export default function KorwayLogo ({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox='0 0 64 64' role='img' aria-label='Korway'>
      <rect width='64' height='64' rx='18' fill='#D1FF42' />
      <text x='29' y='47' textAnchor='middle' fontFamily='Inter, system-ui, sans-serif'
        fontSize='42' fontWeight='900' fill='#0251B0'>K</text>
      <circle cx='49' cy='15' r='6' fill='#0251B0' stroke='#D1FF42' strokeWidth='2' />
    </svg>
  )
}
