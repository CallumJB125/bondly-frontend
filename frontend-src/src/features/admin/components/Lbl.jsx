// Lbl — tiny uppercase form-label used across admin forms/drawers.
// Extracted from Admin.jsx so tab components can import it without a circular ref.
export default function Lbl({ children, style }) {
  return <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: 4, ...style }}>{children}</div>;
}
