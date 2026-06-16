import { useEffect, useRef, useState } from 'react';

/**
 * EditableField — click-to-edit a single customer field in place.
 * Enter saves, Escape cancels. PATCHes /api/admin/customers/:id with
 * just the changed key, so allowlist + audit are enforced server-side.
 *
 * Visual: shows the value as plain text with a subtle dotted underline on
 * hover so the admin knows it's interactive. Click → input. Save calls
 * onChange(value) so the parent can update its local state without
 * refetching the whole customer record.
 */
export default function EditableField({
  userId,
  field,
  value,
  type = 'text',
  placeholder = '—',
  onChange,
  showToast,
}) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(value ?? '');
  const [saving,  setSaving]  = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { setDraft(value ?? ''); }, [value]);
  useEffect(() => { if (editing) setTimeout(() => inputRef.current?.focus(), 10); }, [editing]);

  async function commit() {
    const next = String(draft).trim();
    if (next === (value ?? '')) { setEditing(false); return; }
    setSaving(true);
    try {
      const r = await fetch('/api/admin/customers/' + userId, {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer ' + (localStorage.getItem('bondly_token') || ''),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [field]: type === 'number' ? Number(next) || 0 : next }),
      }).then(r => r.json());
      if (!r?.success) throw new Error(r?.error || 'Could not save');
      onChange?.(r.data?.customer?.[field] ?? next);
      showToast?.(`Saved ${field}`, 'success');
      setEditing(false);
    } catch (e) {
      showToast?.(e.message || 'Could not save', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <span
        className="adm-edit-field"
        onClick={() => setEditing(true)}
        title="Click to edit"
      >
        {value || <span style={{ color: 'var(--text-secondary)' }}>{placeholder}</span>}
        <span className="adm-edit-field__hint">✎</span>
      </span>
    );
  }
  return (
    <input
      ref={inputRef}
      type={type}
      value={draft}
      disabled={saving}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter')  { e.preventDefault(); commit(); }
        if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false); }
      }}
      className="adm-edit-field__input"
    />
  );
}
