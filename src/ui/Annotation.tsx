type Mark = 'arrow' | 'circle' | 'star' | 'underline';

/** Original deliberately imperfect strokes, reused as marginal notes. */
export function Annotation({ children, mark = 'arrow', className = '' }: { children?: React.ReactNode; mark?: Mark; className?: string }) {
  const paths: Record<Mark, string[]> = {
    arrow: ['M8 14 C55 1 81 17 73 42 C68 57 50 57 55 69 C60 83 97 83 126 50', 'M105 51 L128 47 L120 71'],
    circle: ['M134 35 C151 72 108 91 49 85 C9 79 1 62 15 32 C30 8 112 1 141 24 C162 43 141 77 113 84'],
    star: ['M68 8 L73 42 L108 29 L88 57 L114 79 L78 73 L65 108 L56 73 L20 87 L40 57 L16 32 L51 41 Z'],
    underline: ['M4 40 C33 35 76 45 129 37', 'M12 48 C46 44 76 52 113 46'],
  };
  return <span className={`annotation annotation-${mark} ${className}`}>
    {children && <span>{children}</span>}
    <svg viewBox={mark === 'star' ? '0 0 130 120' : mark === 'underline' ? '0 30 160 30' : '0 0 160 100'} fill="none" aria-hidden="true">
      {paths[mark].map((d, i) => <path d={d} key={i} stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" pathLength="1" />)}
    </svg>
  </span>;
}
