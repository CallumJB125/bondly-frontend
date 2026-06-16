import { useState } from 'react';
import './Input.css';

export default function Input({
  label,
  id,
  error,
  prefix,     // e.g. "R"
  suffix,     // e.g. "%"
  dark = false, // dark variant for use on dark-background sections
  className = '',
  ...props
}) {
  const errorId = id ? `${id}-error` : undefined;
  return (
    <div className={`field ${dark ? 'field--dark' : ''} ${className}`}>
      {label && <label className="field__label" htmlFor={id}>{label}</label>}
      <div className={`field__wrap ${prefix ? 'field__wrap--prefix' : ''} ${suffix ? 'field__wrap--suffix' : ''}`}>
        {prefix && <span className="field__affix field__affix--pre" aria-hidden="true">{prefix}</span>}
        <input
          id={id}
          className={`field__input ${dark ? 'field__input--dark' : ''} ${error ? 'field__input--error' : ''}`}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error && errorId ? errorId : undefined}
          {...props}
        />
        {suffix && <span className="field__affix field__affix--suf" aria-hidden="true">{suffix}</span>}
      </div>
      {error && <span id={errorId} className="field__error" role="alert">{error}</span>}
    </div>
  );
}

export function Select({ label, id, error, children, className = '', ...props }) {
  const errorId = id ? `${id}-error` : undefined;
  return (
    <div className={`field ${className}`}>
      {label && <label className="field__label" htmlFor={id}>{label}</label>}
      <select
        id={id}
        className={`field__input ${error ? 'field__input--error' : ''}`}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error && errorId ? errorId : undefined}
        {...props}
      >
        {children}
      </select>
      {error && <span id={errorId} className="field__error" role="alert">{error}</span>}
    </div>
  );
}

// SA-style currency input: shows "1 200 000" when blurred, raw digits when focused
// value: raw number string (e.g. "1200000") — same contract as a regular input
export function CurrencyInput({ label, id, error, value = '', onChange, placeholder = '0', className = '', disabled, onBlur: onBlurProp, dark: _dark, ...props }) {
  const [focused, setFocused] = useState(false);

  function fmtDisplay(raw) {
    if (!raw && raw !== 0) return '';
    const n = parseFloat(String(raw).replace(/[^\d.]/g, ''));
    if (isNaN(n) || n === 0) return '';
    const parts = n.toFixed(2).split('.');
    const intFmt = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0'); // non-breaking space
    return parts[1] === '00' ? intFmt : `${intFmt}.${parts[1]}`;
  }

  function handleChange(e) {
    let raw = e.target.value.replace(/[^\d.]/g, '');
    const pts = raw.split('.');
    if (pts.length > 2) raw = pts[0] + '.' + pts.slice(1).join('');
    onChange({ target: { value: raw } });
  }

  const errorId = id ? `${id}-error` : undefined;
  return (
    <div className={`field ${className}`}>
      {label && <label className="field__label" htmlFor={id}>{label}</label>}
      <div className="field__wrap field__wrap--prefix">
        <span className="field__affix field__affix--pre" aria-hidden="true">R</span>
        <input
          id={id}
          className={`field__input ${error ? 'field__input--error' : ''}`}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error && errorId ? errorId : undefined}
          value={focused ? (value || '') : fmtDisplay(value)}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); onBlurProp && onBlurProp(); }}
          inputMode="decimal"
          placeholder={placeholder}
          disabled={disabled}
          {...props}
        />
      </div>
      {error && <span id={errorId} className="field__error" role="alert">{error}</span>}
    </div>
  );
}
