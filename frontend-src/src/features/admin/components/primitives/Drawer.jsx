import { useEffect } from 'react';
import './primitives.css';

/**
 * Drawer — right-side overlay panel for detail views (e.g. a customer record)
 * so a list can use the full width instead of a cramped master–detail split.
 *
 * Props:
 *  - open:     boolean
 *  - onClose:  fn — called on backdrop click or Escape
 *  - title:    optional header text
 *  - width:    px width of the panel (default 720)
 *  - children: panel body
 */
export default function Drawer({ open, onClose, title, width = 720, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="adm-drawer__backdrop" onClick={onClose}>
      <div
        className="adm-drawer"
        style={{ width: `min(${width}px, 100vw)` }}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Detail'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="adm-drawer__head">
          <span className="adm-drawer__title">{title}</span>
          <button className="adm-drawer__close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="adm-drawer__body">{children}</div>
      </div>
    </div>
  );
}
