import './Card.css';

export default function Card({ children, className = '', onClick, ...props }) {
  const cls = ['card', onClick ? 'card--clickable' : '', className].filter(Boolean).join(' ');
  return (
    <div className={cls} onClick={onClick} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }) {
  return <div className={`card__header ${className}`}>{children}</div>;
}

export function CardBody({ children, className = '' }) {
  return <div className={`card__body ${className}`}>{children}</div>;
}

export function StatCard({ label, value, sub, accent }) {
  return (
    <div className="stat-card">
      <div className="stat-card__value" style={accent ? { color: accent } : {}}>{value}</div>
      <div className="stat-card__label">{label}</div>
      {sub && <div className="stat-card__sub">{sub}</div>}
    </div>
  );
}
