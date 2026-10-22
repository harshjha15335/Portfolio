export function EditorialHome({ ready, reduced, fallback, onEnter, onMotion }: { ready: boolean; reduced: boolean; fallback: boolean; onEnter: () => void; onMotion: () => void }) {
  return <main className="intro street-intro" id="main-content" tabIndex={-1}>
    <div className="arrival-line"><span>मुंबई</span><span>MUMBAI / AFTER HOURS</span><i /></div>
    <p className="eyebrow">WELCOME TO</p><h1>HARSH’S<br /><em>MUMBAI.</em></h1>
    <p className="arrival-description">A portfolio you walk through.<br />Step off the platform. Follow the light.</p>
    <div className="home-actions"><button className="primary-button" onClick={onEnter}>{fallback ? 'OPEN THE CITY DIRECTORY' : 'ENTER CITY'} <span>→</span></button></div>
    <footer className="arrival-footer"><span>{ready ? 'CST → FORT / EVENING WALK' : 'LIGHTING THE STREET…'}</span><button onClick={onMotion}>{reduced ? 'MOTION: REDUCED' : 'REDUCE MOTION'} ◐</button></footer>
  </main>;
}
export function EntryTransition() { return <div className="street-entry" aria-hidden="true"><span>मुंबई</span><small>CST / ARRIVAL</small></div>; }
