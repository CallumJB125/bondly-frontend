import { useState } from 'react';
import DOMPurify from 'dompurify';
import { admin } from '../../../lib/api.js';
import Button from '../../../components/Button.jsx';
import Input, { Select } from '../../../components/Input.jsx';
import Card, { CardHeader, CardBody } from '../../../components/Card.jsx';

function Lbl({ children, style }) {
  return <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: 4, ...style }}>{children}</div>;
}

const SEGMENT_OPTIONS = [
  { value: 'all',           label: 'All verified users' },
  { value: 'no_loan',       label: 'No bond on file' },
  { value: 'has_loan',      label: 'Has active bond' },
  { value: 'yellow_zone',   label: 'Affordability: Yellow zone' },
  { value: 'red_zone',      label: 'Affordability: Red zone' },
  { value: 'green_zone',    label: 'Affordability: Green zone' },
  { value: 'no_swap',       label: 'No swap application yet' },
  { value: 'has_swap',      label: 'Has swap application' },
  { value: 'stale_fitness', label: 'No Financial Fitness upload (30+ days)' },
];

export default function BulkEmailTab({ showToast }) {
  const [segment, setSegment]     = useState('all');
  const [subject, setSubject]     = useState('');
  const [body, setBody]           = useState('');
  const [dryResult, setDryResult] = useState(null);
  const [result, setResult]       = useState(null);
  const [loading, setLoading]     = useState(false);
  const [preview, setPreview]     = useState(false);

  async function runDry() {
    if (!subject.trim() || !body.trim()) { showToast('Subject and body required', 'error'); return; }
    setLoading(true); setDryResult(null); setResult(null);
    try {
      const res = await admin.bulkEmail({ segment, subject, body, dryRun: true });
      setDryResult(res);
    } catch (err) { showToast(err.message || 'Dry run failed', 'error'); }
    finally { setLoading(false); }
  }

  async function send() {
    if (!dryResult) { showToast('Run a dry-run first to confirm recipients', 'error'); return; }
    if (!window.confirm(`Send to ${dryResult.recipientCount} recipients? This cannot be undone.`)) return;
    setLoading(true); setResult(null);
    try {
      const res = await admin.bulkEmail({ segment, subject, body, dryRun: false });
      setResult(res);
      showToast(`Sent to ${res.sent} recipients`, 'success');
    } catch (err) { showToast(err.message || 'Send failed', 'error'); }
    finally { setLoading(false); }
  }

  const segLabel = SEGMENT_OPTIONS.find(s => s.value === segment)?.label || segment;

  return (
    <div className="fade-in" style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Card>
        <CardHeader>Bulk Email</CardHeader>
        <CardBody>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 20 }}>
            Send a templated email to a user segment. Use <code style={{ background: 'var(--bg-page)', padding: '1px 4px', borderRadius: 3, fontSize: '0.8rem' }}>{'{{name}}'}</code> and <code style={{ background: 'var(--bg-page)', padding: '1px 4px', borderRadius: 3, fontSize: '0.8rem' }}>{'{{email}}'}</code> as merge tags.
            A POPIA unsubscribe footer is appended automatically.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Select
              label="Segment"
              id="be-segment"
              value={segment}
              onChange={e => { setSegment(e.target.value); setDryResult(null); setResult(null); }}
            >
              {SEGMENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>

            <Input
              label="Subject"
              id="be-subject"
              placeholder="e.g. Your bond could be saving you more"
              value={subject}
              onChange={e => setSubject(e.target.value)}
            />

            <div>
              <Lbl>Body (HTML supported)</Lbl>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={12}
                placeholder={`Hi {{name}},\n\nWe noticed your bond could be working harder for you...\n\n<a href="https://bondly.co.za">Log in to see your options</a>`}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '10px 12px', fontSize: '0.875rem', fontFamily: 'monospace',
                  border: '1px solid var(--border-color)', borderRadius: 6,
                  background: 'var(--bg-page)', color: 'var(--text-primary)',
                  resize: 'vertical', lineHeight: 1.6,
                }}
              />
            </div>

            {body.trim() && (
              <div>
                <button
                  onClick={() => setPreview(p => !p)}
                  style={{ fontSize: '0.8125rem', color: 'var(--mint)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                >{preview ? 'Hide preview' : 'Preview rendered HTML'}</button>
                {preview && (
                  <div style={{ marginTop: 10, padding: 16, border: '1px solid var(--border-color)', borderRadius: 6, background: '#fff', color: '#111' }}
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(body.replace(/\{\{name\}\}/g, 'Jane').replace(/\{\{email\}\}/g, 'jane@example.com')) }}
                  />
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Button variant="ghost" onClick={runDry} loading={loading} disabled={!subject.trim() || !body.trim()}>
                Dry run — count recipients
              </Button>
              <Button variant="forest" onClick={send} loading={loading} disabled={!dryResult}>
                Send to {dryResult ? `${dryResult.recipientCount} users` : 'segment'}
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {dryResult && !result && (
        <Card>
          <CardHeader>Dry Run Result</CardHeader>
          <CardBody>
            <p style={{ marginBottom: 12 }}>
              <strong>{dryResult.recipientCount}</strong> recipients in segment <em>{segLabel}</em>
            </p>
            {dryResult.sample && dryResult.sample.length > 0 && (
              <>
                <Lbl>First {dryResult.sample.length} recipients</Lbl>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {dryResult.sample.map((r, i) => (
                    <div key={i} style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                      {r.name} &lt;{r.email}&gt;
                    </div>
                  ))}
                </div>
                {dryResult.recipientCount > dryResult.sample.length && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 8 }}>
                    + {dryResult.recipientCount - dryResult.sample.length} more…
                  </p>
                )}
              </>
            )}
          </CardBody>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>Send Result</CardHeader>
          <CardBody>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: result.errors?.length ? 12 : 0 }}>
              <div><Lbl>Sent</Lbl><span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--mint)' }}>{result.sent}</span></div>
              {result.failed > 0 && <div><Lbl>Failed</Lbl><span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-error)' }}>{result.failed}</span></div>}
            </div>
            {result.errors?.length > 0 && (
              <>
                <Lbl style={{ marginTop: 8 }}>Errors</Lbl>
                {result.errors.map((e, i) => (
                  <div key={i} style={{ fontSize: '0.8rem', color: 'var(--color-error)', fontFamily: 'monospace' }}>{e}</div>
                ))}
              </>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
