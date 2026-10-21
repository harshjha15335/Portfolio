import type { Project } from '../data/projects';

export function ProjectGraphic({ project, className = '' }: { project: Project; className?: string }) {
  return <svg className={`project-graphic graphic-${project.id} ${className}`} viewBox="0 0 400 300" fill="none" aria-hidden="true">
    {project.id === 'ffprime' ? <>
      {[70, 110, 145].map(r => <ellipse key={r} cx="200" cy="150" rx={r} ry={r * .52} stroke="currentColor" strokeWidth="1.3" transform={`rotate(${r - 90} 200 150)`} />)}
      <path d="M112 196 195 118 286 179M195 118l18 113" stroke="currentColor" strokeWidth="2" />
      {[[112,196],[195,118],[286,179],[213,231]].map(([x,y]) => <circle key={x} cx={x} cy={y} r={x === 195 ? 20 : 11} fill="currentColor" />)}
      <path d="M26 27v35M9 44h35M336 253h44" stroke="currentColor" /><text x="30" y="270">φ(r) = q/r + μ·r/r³ + …</text>
    </> : project.id === 'northstar' ? <>
      <path d="M35 230H365M45 40V240M47 190l42-10 25-42 28 19 39-71 41 24 35-60 31 51 29-25 42-39" stroke="currentColor" strokeWidth="3" />
      {[80, 130, 180, 230].map(y => <path key={y} d={`M47 ${y}H365`} stroke="currentColor" opacity=".25" />)}
      <text x="78" y="271">EVIDENCE → RISK → PAPER</text><text x="275" y="40" fontSize="36">N/S</text>
    </> : project.id === 'reco' ? <>
      <path d="M20 150h360" stroke="currentColor" strokeWidth="2" />
      {[60,150,240,330].map((x,i) => <g key={x}><rect x={x-25} y={116+(i%2)*-16} width="50" height="50" stroke="currentColor" strokeWidth="3" transform={`rotate(${i%2 ? 5 : -5} ${x} 150)`} /><text x={x-20} y="206">{['CASE','DECIDE','GUARD','AUDIT'][i]}</text></g>)}
      <path d="m107 140 12 10-12 10m83-20 12 10-12 10m83-20 12 10-12 10" stroke="currentColor" strokeWidth="2" /><text x="47" y="73">MODEL OUTPUT ≠ TOOL ACCESS</text>
    </> : project.id === 'moneymetrics' ? <>
      <circle cx="124" cy="137" r="73" stroke="currentColor" strokeWidth="24" opacity=".3" /><path d="M124 64a73 73 0 0 1 58 117" stroke="currentColor" strokeWidth="24" />
      {[60,100,145,175].map((h,i) => <rect key={h} x={228+i*31} y={222-h} width="19" height={h} fill="currentColor" opacity={.45+i*.18} />)}
      <text x="48" y="268">INCOME / EXPENSES / WHAT IF?</text>
    </> : project.id === 'repolens' ? <>
      {[0,1,2].map(c => [0,1,2,3].map(r => <rect key={`${c}${r}`} x={48+c*112} y={78+r*36} width="86" height="22" stroke="currentColor" strokeWidth="2" opacity={1-r*.2} fill={r===0 ? 'currentColor' : 'none'} />))}
      <path d="M134 89h26M246 89h26" stroke="currentColor" strokeWidth="2" /><text x="48" y="60">BM25 + DENSE → RRF</text><text x="48" y="250">[calculator.py:34-41]</text>
    </> : project.id === 'compilerlab' ? <>
      {[['A', 70], ['B', 160], ['C', 250], ['D', 340]].map(([s, x], i) => <g key={s}><circle cx={x} cy="150" r="26" stroke="currentColor" strokeWidth="3" />{i === 3 && <circle cx={x} cy="150" r="20" stroke="currentColor" strokeWidth="2" />}<text x={Number(x) - 5} y="155" fontSize="16">{s}</text></g>)}
      <path d="M96 150h38M186 150h38M276 150h38M20 150h24" stroke="currentColor" strokeWidth="2" /><path d="M340 124C300 60 110 60 70 124" stroke="currentColor" strokeWidth="1.5" strokeDasharray="5 5" />
      <text x="110" y="142">a</text><text x="200" y="142">b</text><text x="290" y="142">b</text><text x="48" y="250">(a|b)*abb# → followpos → DFA</text>
    </> : <>
      <path d="M50 236 C310 245 63 30 348 53" stroke="currentColor" strokeWidth="12" /><path d="M50 236 C310 245 63 30 348 53" stroke="var(--paper, #f2efe7)" strokeWidth="1.5" strokeDasharray="9 8" /><circle cx="50" cy="236" r="14" fill="currentColor" /><circle cx="348" cy="53" r="14" fill="currentColor" /><text x="202" y="263">PLAN / RANK / SIMULATE</text>
    </>}
  </svg>;
}
