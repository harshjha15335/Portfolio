import { useEffect, useRef, useState } from 'react';
import type { Project } from '../data/projects';

function FieldDemo() {
  const [order, setOrder] = useState(0);
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!; const ctx = canvas.getContext('2d')!;
    const w = 600, h = 240; canvas.width = w; canvas.height = h;
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = (x - w / 2) / 65, dy = (y - h / 2) / 65;
      const r = Math.sqrt(dx * dx + dy * dy + 0.18);
      const potential = 1 / r + (order > 0 ? 1.3 * dx / (r ** 3) : 0) + (order > 1 ? 1.1 * (3 * dy * dy - r * r) / (r ** 5) : 0);
      const t = Math.min(1, Math.abs(potential) * 0.55);
      const contour = Math.abs((potential * 8) % 1) < 0.04;
      const i = (y * w + x) * 4;
      const target = potential > 0 ? [49, 85, 255] : [8, 8, 8];
      img.data[i] = contour ? 8 : 242 + t * (target[0] - 242);
      img.data[i + 1] = contour ? 8 : 239 + t * (target[1] - 239);
      img.data[i + 2] = contour ? 8 : 231 + t * (target[2] - 231);
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    ctx.beginPath(); ctx.arc(w / 2, h / 2, 9, 0, Math.PI * 2); ctx.fillStyle = '#f0eee8'; ctx.fill();
  }, [order]);
  return <><div className="demo-tabs">{['Monopole', '+ Dipole', '+ Quadrupole'].map((label, i) => <button key={label} aria-pressed={order === i} onClick={() => setOrder(i)}>{label}</button>)}</div><canvas ref={ref} className="field-canvas" role="img" aria-label={`${['Monopole', 'Monopole and dipole', 'Monopole, dipole and quadrupole'][order]} potential contour visualization`} /><p className="caption">EXPLANATORY MODEL · softened point multipoles, arbitrary units. Blue: positive potential; ink: negative. Not a scientific benchmark.</p></>;
}

export function ProjectDemo({ project }: { project: Project }) {
  const [selected, setSelected] = useState(0);
  const [income, setIncome] = useState(60000);
  const [expenses, setExpenses] = useState(38000);
  if (project.id === 'ffprime') return <section className="demo"><span className="eyebrow">01 / Explore the expansion</span><FieldDemo /></section>;
  if (project.id === 'moneymetrics') return <section className="demo"><span className="eyebrow">04 / Explore a monthly balance</span><div className="finance-demo"><label>Monthly income <strong>₹{income.toLocaleString('en-IN')}</strong><input type="range" min="10000" max="150000" step="1000" value={income} onChange={e => setIncome(+e.target.value)} /></label><label>Monthly expenses <strong>₹{expenses.toLocaleString('en-IN')}</strong><input type="range" min="5000" max="150000" step="1000" value={expenses} onChange={e => setExpenses(+e.target.value)} /></label><div className="balance"><span>Available balance</span><strong>₹{(income - expenses).toLocaleString('en-IN')}</strong><div className="balance-track"><i style={{ width: `${Math.min(100, expenses / income * 100)}%`, background: expenses > income ? '#d89470' : '#335cff' }} /></div></div></div><p className="caption">Illustrative calculator · local inputs only. No investment advice or connected bank data.</p></section>;
  const steps = project.architecture;
  return <section className="demo"><span className="eyebrow">{project.id === 'northstar' ? '02 / Inspect the architecture' : '03 / Trace the recovery pipeline'}</span><div className="pipeline">{steps.map((step, i) => <button key={step} onClick={() => setSelected(i)} onMouseEnter={() => setSelected(i)} onFocus={() => setSelected(i)} className={selected === i ? 'active' : ''}><span>{String(i + 1).padStart(2, '0')}</span>{step}<span>↓</span></button>)}</div><p className="pipeline-note"><strong>{steps[selected]}</strong> · {project.id === 'northstar' ? 'AI analysis remains separate from deterministic risk checks and paper execution.' : 'Structured recommendations pass through deterministic guardrails before an action can execute.'}</p></section>;
}
