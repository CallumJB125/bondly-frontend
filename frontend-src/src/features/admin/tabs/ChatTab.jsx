// ChatTab — customer support inbox with advisor replies.
// Standardized (Phase C cont.): self-fetches via useAdminChats (shared cache with the
// nav "escalated" badge + dashboard card); sending a reply mutates the cache directly.
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { admin } from '../../../lib/api.js';
import { useAdminChats } from '../hooks/useAdminQueries.js';
import { fmtDate } from '@bondly/ui/lib/format.js';
import Button from '@bondly/ui/components/Button.jsx';
import Card, { CardBody } from '@bondly/ui/components/Card.jsx';

const CHATS_KEY = ['admin', 'chats'];

export default function ChatTab({ showToast }) {
  const qc = useQueryClient();
  const { data: chats = [] } = useAdminChats();
  const [chatReply, setChatReply] = useState({});

  async function send(userId) {
    const text = chatReply[userId]?.trim();
    if (!text) return;
    try {
      await admin.replyChat(userId, chatReply[userId]);
      setChatReply(r => ({ ...r, [userId]: '' }));
      qc.setQueryData(CHATS_KEY, cs => (cs || []).map(c => c.userId === userId ? { ...c, escalated: false } : c));
      showToast('Reply sent', 'success');
    } catch { showToast('Failed to send', 'error'); }
  }

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)' }}>Chat Inbox ({chats.length})</h2>
        {chats.filter(c => c.escalated).length > 0 && (
          <span style={{ color: '#ef4444', fontWeight: 700 }}>⚠ {chats.filter(c => c.escalated).length} escalated</span>
        )}
      </div>
      {chats.length === 0 ? (
        <Card><CardBody><p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 'var(--space-8)' }}>No chat conversations yet</p></CardBody></Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {chats.map(convo => (
            <Card key={convo.userId}>
              <CardBody>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{convo.userName}</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{convo.userEmail} · {convo.messages.length} messages · Last: {fmtDate(convo.updatedAt)}</div>
                  </div>
                  {convo.escalated && <span style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 6, padding: '3px 10px', fontSize: '0.75rem', fontWeight: 700 }}>Needs human</span>}
                </div>
                <div style={{ background: 'var(--bg-page)', borderRadius: 8, padding: 'var(--space-3)', marginBottom: 'var(--space-3)', maxHeight: 160, overflowY: 'auto', fontSize: '0.8125rem' }}>
                  {convo.messages.slice(-6).map(m => (
                    <div key={m.id} style={{ marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, color: m.role === 'user' ? 'var(--forest)' : m.role === 'advisor' ? '#6366f1' : 'var(--text-secondary)', marginRight: 6 }}>
                        {m.role === 'user' ? convo.userName?.split(' ')[0] : m.role === 'advisor' ? 'Advisor' : 'Bot'}:
                      </span>
                      <span>{m.text.slice(0, 120)}{m.text.length > 120 ? '…' : ''}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <input type="text" placeholder="Reply as advisor…" value={chatReply[convo.userId] || ''}
                    onChange={e => setChatReply(r => ({ ...r, [convo.userId]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') send(convo.userId); }}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: '0.875rem', background: 'var(--bg-card)' }}
                  />
                  <Button variant="forest" size="sm" onClick={() => send(convo.userId)}>Send</Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
