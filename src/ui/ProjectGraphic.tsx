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
    </> : project.id === 'meeting-intelligence-service' ? <>
      {[100,125,150,175,200].map((y,i) => <path key={y} d={`M55 ${y}h${[210,285,245,275,155][i]}`} stroke="currentColor" strokeWidth="6" />)}<circle cx="316" cy="208" r="30" stroke="currentColor" strokeWidth="2" /><path d="m305 210 9 10 20-22" stroke="currentColor" strokeWidth="3" /><text x="55" y="65">TRANSCRIPT → EVIDENCE</text>
    </> : <>
      <path d="M50 236 C310 245 63 30 348 53" stroke="currentColor" strokeWidth="12" /><path d="M50 236 C310 245 63 30 348 53" stroke="var(--paper, #f2efe7)" strokeWidth="1.5" strokeDasharray="9 8" /><circle cx="50" cy="236" r="14" fill="currentColor" /><circle cx="348" cy="53" r="14" fill="currentColor" /><text x="202" y="263">PLAN / RANK / SIMULATE</text>
    </>}
  </svg>;
}
