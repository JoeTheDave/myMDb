interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
}

const sizeMap = {
  sm: { mdb: 20, badge: '4px 8px', radius: 4 },
  md: { mdb: 28, badge: '5px 10px', radius: 5 },
  lg: { mdb: 40, badge: '7px 14px', radius: 7 },
} as const

export function Logo({ size = 'md' }: LogoProps) {
  const { mdb, badge, radius } = sizeMap[size]
  const my = Math.round(mdb * 0.6)

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        backgroundColor: '#F5C518',
        color: '#000000',
        padding: badge,
        borderRadius: radius,
        lineHeight: 1,
        fontFamily: 'sans-serif',
        userSelect: 'none',
      }}
    >
      <span
        style={{
          fontSize: my,
          fontWeight: 600,
          fontStyle: 'italic',
          marginRight: 1,
        }}
      >
        my
      </span>
      <span
        style={{
          fontSize: mdb,
          fontWeight: 900,
        }}
      >
        MDb
      </span>
    </span>
  )
}
