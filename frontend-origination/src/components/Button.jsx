import './Button.css';

export default function Button({
  children,
  variant = 'forest',  // forest | lime | ghost | danger | outline
  size = 'md',         // sm | md | lg
  full = false,
  loading = false,
  disabled = false,
  type = 'button',
  onClick,
  className = '',
  ...props
}) {
  const cls = [
    'btn',
    `btn--${variant}`,
    `btn--${size}`,
    full ? 'btn--full' : '',
    loading ? 'btn--loading' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      type={type}
      className={cls}
      onClick={onClick}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <span className="spinner" /> : null}
      {children}
    </button>
  );
}
