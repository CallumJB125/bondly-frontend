import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import PropertySearchCTA from './PropertySearchCTA.jsx';
import './ChatWidget.css';

async function apiFetch(path, opts = {}) {
  const token = localStorage.getItem('bondly_token');
  const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...opts.headers };
  const res = await fetch(path, { ...opts, headers });
  const j = await res.json();
  if (!j.success) throw new Error(j.error || 'Request failed');
  return j.data;
}

// Render markdown-style **bold** and bullet lists
function MessageText({ text }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        // Convert \n to line breaks
        return part.split('\n').map((line, j) => (
          <span key={j}>
            {j > 0 && <br />}
            {line}
          </span>
        ));
      })}
    </span>
  );
}

const QUICK_PROMPTS = [
  "What's my current rate?",
  "How much could I save?",
  "What documents do I need?",
  "How long does switching take?",
];

export default function ChatWidget() {
  const { isLoggedIn } = useAuth();
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [unread, setUnread]     = useState(0);
  const [hasLoaded, setHasLoaded] = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    if (!isLoggedIn || hasLoaded) return;
    apiFetch('/api/chat').then(msgs => {
      if (msgs && msgs.length) {
        setMessages(msgs);
        // Count unread advisor messages
        const unreadAdvisor = msgs.filter(m => m.role === 'advisor' && !m.read).length;
        setUnread(unreadAdvisor);
      } else {
        // Welcome message
        setMessages([{ id: 'welcome', role: 'bot', text: "Hi there! 👋 I'm Bondly's assistant. Ask me anything about your bond, rates, or switching banks — or type **advisor** to speak with a human.", at: new Date().toISOString() }]);
      }
      setHasLoaded(true);
    }).catch(() => {
      setMessages([{ id: 'welcome', role: 'bot', text: "Hi! I'm Bondly's assistant. How can I help you today?", at: new Date().toISOString() }]);
      setHasLoaded(true);
    });
  }, [isLoggedIn, hasLoaded]);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      inputRef.current?.focus();
      setUnread(0);
    }
  }, [open, messages]);

  async function send(text) {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput('');
    const userMsg = { id: Date.now() + 'u', role: 'user', text: msg, at: new Date().toISOString() };
    setMessages(m => [...m, userMsg]);
    setLoading(true);
    try {
      const { reply, maxBond } = await apiFetch('/api/chat', { method: 'POST', body: JSON.stringify({ message: msg }) });
      setMessages(m => [...m, { id: Date.now() + 'b', role: 'bot', text: reply, maxBond: maxBond || undefined, at: new Date().toISOString() }]);
    } catch {
      setMessages(m => [...m, { id: Date.now() + 'e', role: 'bot', text: "Sorry, something went wrong. Please try again or email hello@bondly.co.za.", at: new Date().toISOString() }]);
    } finally {
      setLoading(false);
    }
  }

  if (!isLoggedIn) return null;

  return (
    <>
      {/* Floating button */}
      <button className={`chat-fab ${open ? 'chat-fab--open' : ''}`} onClick={() => setOpen(o => !o)} aria-label="Chat support">
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        )}
        {!open && unread > 0 && <span className="chat-fab__badge">{unread}</span>}
      </button>

      {/* Panel */}
      {open && (
        <div className="chat-panel fade-in">
          {/* Header */}
          <div className="chat-panel__header">
            <div className="chat-panel__avatar">B</div>
            <div>
              <div className="chat-panel__name">Bondly Assistant</div>
              <div className="chat-panel__status">
                <span className="chat-online-dot" />
                Online · usually replies instantly
              </div>
            </div>
            <button className="chat-panel__close" onClick={() => setOpen(false)}>✕</button>
          </div>

          {/* Messages */}
          <div className="chat-messages">
            {messages.map(m => (
              <div key={m.id} className={`chat-msg chat-msg--${m.role}`}>
                {m.role !== 'user' && (
                  <div className="chat-msg__avatar">
                    {m.role === 'advisor' ? '👤' : 'B'}
                  </div>
                )}
                <div className="chat-msg__bubble">
                  <MessageText text={m.text} />
                  {m.role === 'advisor' && <div className="chat-msg__tag">Advisor</div>}
                  {m.maxBond > 0 && (
                    <PropertySearchCTA maxBond={m.maxBond} compact />
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="chat-msg chat-msg--bot">
                <div className="chat-msg__avatar">B</div>
                <div className="chat-msg__bubble chat-typing">
                  <span /><span /><span />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick prompts (only if few messages) */}
          {messages.length <= 2 && (
            <div className="chat-quick-prompts">
              {QUICK_PROMPTS.map(q => (
                <button key={q} className="chat-quick-btn" onClick={() => send(q)}>{q}</button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="chat-input-row">
            <input
              ref={inputRef}
              className="chat-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Ask anything about your bond…"
              disabled={loading}
            />
            <button className="chat-send-btn" onClick={() => send()} disabled={!input.trim() || loading}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
