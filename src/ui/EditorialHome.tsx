export function EditorialHome({ ready, reduced, onEnter, onQuick, onMotion }: { ready: boolean; reduced: boolean; onEnter: () => void; onQuick: () => void; onMotion: () => void }) {
  return <main className="intro street-intro" id="main-content" tabIndex={-1}>
    <div className="arrival-line"><span>मुंबई</span><span>MUMBAI / AFTER HOURS</span><i /></div>
    <p className="eyebrow">WELCOME TO</p><h1>HARSH’S<br /><em>MUMBAI.</em></h1>
    <p className="arrival-description">A portfolio you walk through.<br />Step off the platform. Follow the light.</p>
    <div className="home-actions"><button className="primary-button" onClick={onEnter}>ENTER CITY <span>→</span></button><button className="text-button" onClick={onQuick}>QUICK VIEW <span>↗</span></button></div>
    <footer className="arrival-footer"><span>{ready ? 'CST → FORT / EVENING WALK' : 'LIGHTING THE STREET…'}</span><button onClick={onMotion}>{reduced ? 'MOTION: REDUCED' : 'REDUCE MOTION'} ◐</button></footer>
  </main>;
}
export function EntryTransition() { return <div className="street-entry" aria-hidden="true"><span>मुंबई</span><small>CST / ARRIVAL</small></div>; }
