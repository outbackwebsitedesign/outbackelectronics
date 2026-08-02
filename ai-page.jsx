import React, { useState, useEffect, useRef } from 'react';

const SITE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8080'
  : `https://outbackelectronics.com.au`;

const PORTAL_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8083'
  : `https://portal.outbackelectronics.com.au`;

// ── Markdown renderer ─────────────────────────────────────────────────────────

function inlineMd(text) {
  text = text.replace(/\\\((.+?)\\\)/g, '$1').replace(/\\\[(.+?)\\\]/g, '$1');
  const parts = [];
  const re = /(`[^`]+`|\*\*(.+?)\*\*|\*([^*\n]+)\*|__(.+?)__|_([^_\n]+)_)/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith('`')) parts.push(<code key={m.index} style={{ background: 'rgba(0,0,0,0.08)', padding: '1px 4px', borderRadius: 3, fontSize: '0.88em', fontFamily: 'monospace' }}>{t.slice(1, -1)}</code>);
    else if (t.startsWith('**') || t.startsWith('__')) parts.push(<strong key={m.index}>{t.slice(2, -2)}</strong>);
    else parts.push(<em key={m.index}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function renderMd(text) {
  const lines = text.split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('```')) {
      const code = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) { code.push(lines[i]); i++; }
      out.push(<pre key={i} style={{ background: '#1f1a14', color: '#f4ede1', borderRadius: 6, padding: '12px 14px', overflowX: 'auto', fontSize: 13, fontFamily: 'monospace', margin: '8px 0' }}><code>{code.join('\n')}</code></pre>);
      i++; continue;
    }
    if (/^[-*] /.test(line)) {
      const items = [];
      while (i < lines.length) {
        if (/^[-*] /.test(lines[i])) { items.push(lines[i].slice(2)); i++; }
        else if (!lines[i].trim() && i + 1 < lines.length && /^[-*] /.test(lines[i + 1])) { i++; }
        else break;
      }
      out.push(<ul key={i} style={{ paddingLeft: 20, margin: '4px 0' }}>{items.map((t, j) => <li key={j} style={{ marginBottom: 3 }}>{inlineMd(t)}</li>)}</ul>);
      continue;
    }
    if (/^\d+\. /.test(line)) {
      const items = [];
      let lastItem = null;
      while (i < lines.length) {
        const l = lines[i];
        if (/^\d+\. /.test(l)) { lastItem = [l.replace(/^\d+\. /, '')]; items.push(lastItem); i++; }
        else if (/^[-*] /.test(l)) { if (lastItem) lastItem.push('• ' + l.slice(2)); i++; }
        else if (!l.trim()) {
          let j = i + 1;
          while (j < lines.length && !lines[j].trim()) j++;
          if (j < lines.length && (/^\d+\. /.test(lines[j]) || /^[-*] /.test(lines[j]))) { i++; }
          else break;
        } else break;
      }
      out.push(<ol key={i} style={{ paddingLeft: 20, margin: '4px 0' }}>{items.map((parts, j) => <li key={j} style={{ marginBottom: 5 }}>{parts.map((t, k) => <div key={k}>{inlineMd(t)}</div>)}</li>)}</ol>);
      continue;
    }
    if (/^#{1,3} /.test(line)) {
      const level = line.match(/^(#{1,3}) /)[1].length;
      const Tag = `h${level + 2}`;
      out.push(<Tag key={i} style={{ margin: '10px 0 4px', fontSize: level === 1 ? 17 : 15 }}>{inlineMd(line.replace(/^#{1,3} /, ''))}</Tag>);
      i++; continue;
    }
    if (!line.trim()) { out.push(<div key={i} style={{ height: 6 }} />); i++; continue; }
    out.push(<p key={i} style={{ margin: '2px 0', lineHeight: 1.6 }}>{inlineMd(line)}</p>);
    i++;
  }
  return out;
}

// ── Chat ──────────────────────────────────────────────────────────────────────

const GREETING = "G'day! I'm the Outback Electronics AI assistant, running locally on our own hardware, no cloud involved. Ask me anything about electronics repair, troubleshooting, components, or soldering. You can also upload a photo of a board for diagnosis.";

function ChatView({ session }) {
  const [messages, setMessages] = useState([{ role: 'assistant', content: GREETING }]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState('');
  const [queue, setQueue] = useState([]);
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const messagesRef = useRef(messages);
  const fileRef = useRef(null);
  messagesRef.current = messages;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 100) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!streaming && queue.length > 0) {
      const [next, ...rest] = queue;
      setQueue(rest);
      doSend(next.text, next.image, messagesRef.current);
    }
  }, [streaming]);

  async function doSend(text, img, currentMessages) {
    setError('');
    const userMsg = { role: 'user', content: text, image: img ? imagePreview : null };
    const history = [...currentMessages, userMsg];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setStreaming(true);

    try {
      const endpoint = img ? '/api/vision' : '/api/chat';
      const body = img
        ? { image: img, prompt: text || undefined }
        : { messages: history.filter(m => !m.image).map(m => ({ role: m.role, content: m.content })) };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'AI service error');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n'); buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') break;
          try {
            const { token } = JSON.parse(data);
            setMessages(prev => {
              const next = [...prev];
              next[next.length - 1] = { role: 'assistant', content: next[next.length - 1].content + token };
              return next;
            });
          } catch { }
        }
      }
    } catch (e) {
      setError(e.message || 'Something went wrong. Please try again.');
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setStreaming(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }

  function send() {
    const text = input.trim();
    if (!text && !image) return;
    setInput('');
    const img = image;
    setImage(null); setImagePreview(null);
    if (streaming) {
      setQueue(q => [...q, { text, image: img }]);
    } else {
      doSend(text, img, messagesRef.current);
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { setError('Image must be under 8MB'); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      setImagePreview(ev.target.result);
      setImage(ev.target.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function clearChat() {
    setMessages([{ role: 'assistant', content: GREETING }]);
    setInput(''); setError(''); setImage(null); setImagePreview(null); setQueue([]);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div style={{ borderBottom: '1px solid var(--line)', padding: '10px 0' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4caf50', display: 'inline-block' }} />
            <span style={{ fontSize: 13, color: 'var(--ink-2)', fontFamily: 'monospace' }}>AI online · on-prem</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {queue.length > 0 && <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{queue.length} queued</span>}
            <button className="btn btn-ghost btn-sm" onClick={clearChat} disabled={streaming}>Clear chat</button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 0' }} ref={scrollRef}>
        <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '82%',
                padding: '10px 14px',
                borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: m.role === 'user' ? 'var(--rust)' : 'var(--paper)',
                border: m.role === 'user' ? 'none' : '1px solid var(--line)',
                color: m.role === 'user' ? '#fff' : 'var(--ink)',
                fontSize: 14, lineHeight: 1.6, wordBreak: 'break-word',
              }}>
                {m.image && <img src={m.image} alt="uploaded" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 4, marginBottom: 8, display: 'block' }} />}
                {m.role === 'assistant'
                  ? (m.content ? renderMd(m.content) : (streaming && i === messages.length - 1 ? <span style={{ opacity: 0.4 }}>▌</span> : ''))
                  : m.content}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--line)', background: 'var(--bg-elev)', padding: '12px 0' }}>
        <div className="container">
          {error && <div className="alert alert-error" style={{ marginBottom: 10 }}>{error}</div>}
          {imagePreview && (
            <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <img src={imagePreview} alt="preview" style={{ height: 48, borderRadius: 4, border: '1px solid var(--line)' }} />
              <button className="btn btn-ghost btn-sm" onClick={() => { setImage(null); setImagePreview(null); }}>Remove</button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <button className="btn btn-ghost btn-sm" style={{ flexShrink: 0, height: 44, padding: '0 12px', fontSize: 18 }} onClick={() => fileRef.current?.click()} title="Upload board photo for diagnosis">📷</button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFile} />
            <textarea
              ref={textareaRef}
              className="input textarea"
              rows={2}
              style={{ flex: 1, resize: 'none', fontSize: 14 }}
              placeholder={streaming ? 'Type your next message… (queues until AI finishes)' : 'Ask about a repair, component, or circuit - or upload a board photo… (Enter to send)'}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
              <button className="btn btn-rust" style={{ height: 56, minWidth: 72 }} onClick={send} disabled={!input.trim() && !image}>
                {streaming ? 'Queue' : 'Send'}
              </button>
            </div>
          </div>
          <p style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>
            AI responses may not always be accurate. For complex repairs, <a href={SITE_URL + '/services'} style={{ color: 'var(--rust)' }}>book a service</a>.
          </p>
        </div>
      </div>
    </div>
  );
}

function LoginPrompt() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 400, width: '100%', background: 'var(--paper)', border: '1px solid var(--line)', padding: 40, boxShadow: 'var(--shadow)' }}>
        <div style={{ marginBottom: 24 }}>
          <span className="eyebrow">Access required</span>
          <h2 className="serif" style={{ fontSize: 32, marginTop: 8 }}>Sign in to use the AI assistant.</h2>
          <p style={{ marginTop: 12, color: 'var(--ink-2)', fontSize: 14 }}>A free portal account gives you access to the AI assistant, order tracking, repair status, and more.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <a href={PORTAL_URL} className="btn btn-rust" style={{ justifyContent: 'center' }}>Sign in to Portal →</a>
          <a href={PORTAL_URL + '?tab=register'} className="btn btn-ghost" style={{ justifyContent: 'center' }}>Create free account</a>
        </div>
      </div>
    </div>
  );
}

// ── Top nav ───────────────────────────────────────────────────────────────────

function TopNav({ session }) {
  return (
    <nav className="topnav">
      <div className="container inner">
        <a href={SITE_URL} className="logo">
          <div className="logo-mark"><img src="/favicon.png" alt="OE" /></div>
          <div className="logo-text">
            <div className="name">Outback Electronics</div>
            <div className="sub">AI Assistant</div>
          </div>
        </a>
        <div className="nav-right">
          <span className="ai-badge">ON-PREM AI</span>
          {session
            ? <span style={{ fontSize: 13 }}>Hi, {session.displayName || session.username}</span>
            : <a href={PORTAL_URL} style={{ color: 'var(--sand-dim)', fontSize: 13 }}>Sign in →</a>}
        </div>
      </div>
    </nav>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function AIApp() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/session', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.id) setSession(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <TopNav session={session} />
      {loading
        ? <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-2)' }}>Loading…</div>
        : session ? <ChatView session={session} /> : <LoginPrompt />}
      <footer className="footer">
        <div className="container inner">
          <span>© {new Date().getFullYear()} Outback Electronics</span>
          <div style={{ display: 'flex', gap: 20 }}>
            <a href={SITE_URL}>Main site</a>
            <a href={PORTAL_URL}>Portal</a>
            <a href={SITE_URL + '/contact'}>Contact</a>
          </div>
        </div>
      </footer>
    </>
  );
}
