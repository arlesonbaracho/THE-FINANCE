interface TFMarkProps {
  size?: number
  main?: string
  accent?: string
}

export function TFMark({ size = 40, main = '#2D6A4F', accent = '#52b788' }: TFMarkProps) {
  const s = size / 72
  const r = (v: number) => v * s
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" fill="none">
      <rect x={r(10)} y={r(10)} width={r(52)} height={r(11)} fill={main} />
      <rect x={r(30)} y={r(10)} width={r(11)} height={r(52)} fill={main} />
      <rect x={r(41)} y={r(34)} width={r(21)} height={r(9)}  fill={accent} />
    </svg>
  )
}
