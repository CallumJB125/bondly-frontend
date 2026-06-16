/**
 * EmptyState — single component every admin tab uses when it has no rows.
 * Avoids the drift of "No customers match", "Empty", "No data yet", "—" that
 * makes the admin feel half-built. Heading + sub copy + optional CTA.
 *
 * Visual: outlined card with a muted icon, deliberately understated so it
 * doesn't shout when the surrounding chrome is busy.
 */
export default function EmptyState({
  icon,
  title = 'Nothing here yet',
  sub,
  cta,
  small = false,
}) {
  return (
    <div className={'adm-empty ' + (small ? 'adm-empty--small' : '')} role="status">
      <div className="adm-empty__icon" aria-hidden="true">{icon || defaultIcon}</div>
      <div className="adm-empty__title">{title}</div>
      {sub && <div className="adm-empty__sub">{sub}</div>}
      {cta && <div className="adm-empty__cta">{cta}</div>}
    </div>
  );
}

const defaultIcon = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 9h18" />
    <path d="M8 14h8" />
  </svg>
);
