import { useEffect, useRef, useState } from 'react';

/**
 * MentionInput — drop-in textarea replacement that pops a staff picker when
 * the user types `@`. Inserts `@email` on selection. Returns the raw text
 * (with @email markers intact) via onChange so the caller can persist as-is.
 *
 * Designed for note-taking, not full markdown — we only handle `@`. Anyone
 * needing richer mention semantics can swap this for a tiptap or similar
 * later, the props stay the same.
 */
export default function MentionInput({ value, onChange, staff = [], placeholder, rows = 3, disabled }) {
  const taRef = useRef(null);
  const [pickerAt,  setPickerAt]  = useState(null); // cursor position where @ started
  const [pickerQ,   setPickerQ]   = useState('');
  const [cursor,    setCursor]    = useState(0);

  useEffect(() => {
    function onKey(e) {
      if (pickerAt == null) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(filtered().length - 1, c + 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(0, c - 1)); }
      if (e.key === 'Enter')     { e.preventDefault(); pick(filtered()[cursor]); }
      if (e.key === 'Escape')    { setPickerAt(null); }
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  function filtered() {
    const q = pickerQ.toLowerCase();
    return (staff || []).filter(s =>
      (s.email || '').toLowerCase().includes(q) ||
      (s.name  || '').toLowerCase().includes(q)
    ).slice(0, 6);
  }
  function pick(s) {
    if (!s) return;
    const ta = taRef.current; if (!ta) return;
    const before = value.slice(0, pickerAt);
    const after  = value.slice(ta.selectionStart);
    const next   = before + '@' + s.email + ' ' + after;
    onChange(next);
    setPickerAt(null);
    setPickerQ('');
    setCursor(0);
    setTimeout(() => {
      ta.focus();
      const at = (before + '@' + s.email + ' ').length;
      try { ta.setSelectionRange(at, at); } catch {}
    }, 0);
  }

  function handleChange(e) {
    const v = e.target.value;
    onChange(v);
    const pos = e.target.selectionStart;
    // Look back for an unclosed `@` token
    const back = v.slice(0, pos);
    const at   = back.lastIndexOf('@');
    if (at < 0) { setPickerAt(null); return; }
    // Ignore if there's whitespace or another @ in between (avoids matching emails)
    const between = back.slice(at + 1);
    if (/[\s@]/.test(between)) { setPickerAt(null); return; }
    setPickerAt(at);
    setPickerQ(between);
    setCursor(0);
  }

  return (
    <div style={{ position: 'relative' }}>
      <textarea
        ref={taRef}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        style={{ width: '100%' }}
      />
      {pickerAt != null && filtered().length > 0 && (
        <div className="adm-mention-picker">
          {filtered().map((s, i) => (
            <div
              key={s.email || s.id}
              className={'adm-mention-picker__item ' + (i === cursor ? 'is-active' : '')}
              onMouseEnter={() => setCursor(i)}
              onClick={() => pick(s)}
            >
              <span style={{ fontWeight: 700 }}>{s.name || s.email}</span>
              {s.name && s.email && <span style={{ color: 'var(--text-secondary)', marginLeft: 8, fontSize: '0.8125rem' }}>{s.email}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * renderWithMentions — turn `Hi @admin@bondly.co.za, please review` into a
 * React fragment with the mention rendered as a styled chip.
 */
export function renderWithMentions(text) {
  if (!text) return null;
  const re = /@([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
  const out = [];
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      <span key={m.index} className="adm-mention-chip">@{m[1]}</span>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
