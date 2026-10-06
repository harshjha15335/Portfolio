import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
const CloseContext = createContext<(() => void) | null>(null);
export const useModalClose = (fallback: () => void) => useContext(CloseContext) ?? fallback;
export function Modal({ title, children, onClose, className = '' }: { title: string; children: ReactNode; onClose: () => void; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const closeTimer = useRef<number | undefined>(undefined);
  const requestClose = () => {
    if (closingRef.current) return;
    if (document.documentElement.dataset.motion === 'reduced') { onClose(); return; }
    closingRef.current = true; setClosing(true);
    closeTimer.current = window.setTimeout(onClose, 240);
  };
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement;
    dialog.showModal();
    dialog.querySelector<HTMLInputElement>('input')?.focus();
    return () => { clearTimeout(closeTimer.current); dialog.close(); previous?.focus(); };
  }, []);
  return <dialog ref={ref} className={`modal ${className} ${closing ? 'is-closing' : ''}`} aria-label={title} onCancel={e => { e.preventDefault(); requestClose(); }} onClick={e => { if (e.target === ref.current) requestClose(); }}>
    <div className="modal-top"><span className="eyebrow">{title}</span><button className="icon-button" aria-label={`Close ${title}`} onClick={requestClose}>✕</button></div>
    <CloseContext.Provider value={requestClose}>{children}</CloseContext.Provider>
  </dialog>;
}
