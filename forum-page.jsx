import React, { useState, useEffect, useRef } from 'react';

// ── Helpers ──────────────────────────────────────────────────────────────────
const CAT_COLORS = [
  '#e45735','#0088cc','#3ab54a','#9b59b6','#e8a838',
  '#dd5b75','#0ea5e9','#22c55e','#f97316','#6366f1',
];
function catColor(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return CAT_COLORS[Math.abs(h) % CAT_COLORS.length];
}
function avatarColor(str) {
  const colors = ['#0088cc','#e45735','#3ab54a','#9b59b6','#e8a838','#dd5b75','#0ea5e9'];
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return colors[Math.abs(h) % colors.length];
}
function fmtAge(hours) {
  if (hours < 1) return 'just now';
  if (hours < 24) return `${Math.round(hours)}h`;
  if (hours < 24 * 30) return `${Math.round(hours / 24)}d`;
  if (hours < 24 * 365) return `${Math.round(hours / 24 / 30)}mo`;
  return `${Math.round(hours / 24 / 365)}y`;
}
function fmtCount(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ── Router helpers ────────────────────────────────────────────────────────────
function parsePath() {
  const path = window.location.pathname;
  const qs = window.location.search;
  const parts = path.split('/').filter(Boolean);
  const params = {};
  if (qs) new URLSearchParams(qs).forEach((v, k) => { params[k] = v; });

  if (!parts.length || parts[0] === 'categories') return { view: 'categories', params };
  if (parts[0] === 'latest') return { view: 'latest', params, sort: params.sort || 'latest' };
  if (parts[0] === 'c' && parts[1]) return { view: 'category', categoryId: parts[1], params };
  if (parts[0] === 't' && parts[1]) return { view: 'thread', threadId: parts[1], params };
  return { view: 'categories', params };
}
function navigate(path) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const IconSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>
  </svg>
);
const IconBell = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);
const IconBurger = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
);
const IconPlus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M12 5v14M5 12h14"/>
  </svg>
);
const IconHome = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);
const IconLatest = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const IconTop = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15"/>
  </svg>
);
const IconTag = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
  </svg>
);
const IconPin = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z"/>
  </svg>
);
const IconChevron = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);
const IconLock = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

// ── CSRF helper ───────────────────────────────────────────────────────────────
function getCsrf() {
  return document.cookie.split(';').reduce((v, c) => {
    const [k, val] = c.trim().split('=');
    return k === '_csrf' ? decodeURIComponent(val || '') : v;
  }, '');
}
let _csrfReady = null;
function ensureCsrf() {
  if (!_csrfReady) _csrfReady = fetch('/api/csrf-token', { credentials: 'include' }).catch(() => {});
  return _csrfReady;
}
function csrfHeaders() { return { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrf() }; }

// ── useAuth hook ──────────────────────────────────────────────────────────────
function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ensureCsrf().then(() =>
      fetch('/api/forum/auth/me', { credentials: 'include' })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          setUser(data && data.user ? data.user : (data && data.username ? data : null));
        })
        .catch(() => setUser(null))
        .finally(() => setLoading(false))
    );
  }, []);

  return { user, loading, setUser };
}

// ── LoginModal ────────────────────────────────────────────────────────────────
function LoginModal({ onClose, onLogin }) {
  const [tab, setTab] = useState('login'); // 'login' | 'signup' | 'forgot'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function switchTab(t) {
    setTab(t);
    setError('');
    setForgotMsg(null);
    setUsername('');
    setPassword('');
    setDisplayName('');
    setConfirmPassword('');
    setForgotEmail('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!username.trim()) { setError('Please enter a username.'); return; }
    if (!password) { setError('Please enter a password.'); return; }
    if (tab === 'signup') {
      if (!displayName.trim()) { setError('Please enter a display name.'); return; }
      if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    }
    setSaving(true);
    try {
      const endpoint = tab === 'login' ? '/api/forum/auth/login' : '/api/forum/auth/register';
      const body = tab === 'login'
        ? { username: username.trim(), password }
        : { username: username.trim(), password, displayName: displayName.trim() };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: csrfHeaders(),
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Something went wrong.'); return; }
      onLogin(data.user || data);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleForgot(e) {
    e.preventDefault();
    setSaving(true);
    await fetch('/api/forum/auth/forgot-password', {
      method: 'POST',
      headers: csrfHeaders(),
      credentials: 'include',
      body: JSON.stringify({ username: username.trim(), email: forgotEmail.trim().toLowerCase() }),
    });
    setSaving(false);
    setForgotMsg('If that username and email match an account, you\'ll receive a reset link shortly.');
  }

  const inputStyle = {
    width: '100%', padding: '9px 12px', border: '1px solid #d6d9dc',
    borderRadius: 4, fontSize: 15, fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box',
  };
  const labelStyle = { display: 'block', marginBottom: 14 };
  const labelSpanStyle = {
    display: 'block', fontSize: 12, fontWeight: 700, letterSpacing: '0.05em',
    textTransform: 'uppercase', color: '#787878', marginBottom: 6,
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={onClose} />
      <div style={{
        position: 'relative', background: '#fff', borderRadius: 8, width: '100%', maxWidth: 420,
        margin: '0 16px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid #e0e0e0' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {tab !== 'forgot'
              ? <>
                  <button
                    onClick={() => switchTab('login')}
                    style={{
                      padding: '6px 16px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                      background: tab === 'login' ? '#0088cc' : 'transparent',
                      color: tab === 'login' ? '#fff' : '#555',
                    }}
                  >Log in</button>
                  <button
                    onClick={() => switchTab('signup')}
                    style={{
                      padding: '6px 16px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                      background: tab === 'signup' ? '#0088cc' : 'transparent',
                      color: tab === 'signup' ? '#fff' : '#555',
                    }}
                  >Sign up</button>
                </>
              : <span style={{ fontSize: 15, fontWeight: 600, color: '#333', padding: '6px 4px' }}>Reset password</span>
            }
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#787878', lineHeight: 1, padding: '0 4px' }}>&times;</button>
        </div>

        {tab === 'forgot'
          ? <div style={{ padding: '20px' }}>
              {forgotMsg
                ? <>
                    <div style={{ background: '#e6f4ea', border: '1px solid #a8d5b0', borderRadius: 4, padding: '10px 14px', marginBottom: 16, fontSize: 14, color: '#1a6630' }}>
                      {forgotMsg}
                    </div>
                    <button onClick={() => switchTab('login')} style={{ background: 'none', border: 'none', color: '#0088cc', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', padding: 0 }}>
                      ← Back to log in
                    </button>
                  </>
                : <>
                    <p style={{ fontSize: 14, color: '#555', marginBottom: 16, marginTop: 0 }}>Enter your username and the email address on your account. We'll send you a link to reset your password.</p>
                    <form onSubmit={handleForgot}>
                      <label style={labelStyle}>
                        <span style={labelSpanStyle}>Username</span>
                        <input autoFocus type="text" value={username} onChange={e => setUsername(e.target.value)} required style={inputStyle}
                          onFocus={e => e.target.style.borderColor = '#0088cc'} onBlur={e => e.target.style.borderColor = '#d6d9dc'} />
                      </label>
                      <label style={{ ...labelStyle, marginBottom: 20 }}>
                        <span style={labelSpanStyle}>Email address</span>
                        <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required style={inputStyle}
                          onFocus={e => e.target.style.borderColor = '#0088cc'} onBlur={e => e.target.style.borderColor = '#d6d9dc'} />
                      </label>
                      <button type="submit" disabled={saving} style={{ width: '100%', padding: '10px', borderRadius: 4, border: 'none', background: saving ? '#80b8e6' : '#0088cc', color: '#fff', fontSize: 15, fontWeight: 600, cursor: saving ? 'default' : 'pointer' }}>
                        {saving ? 'Sending…' : 'Send reset link'}
                      </button>
                    </form>
                    <div style={{ marginTop: 14, textAlign: 'center' }}>
                      <button onClick={() => switchTab('login')} style={{ background: 'none', border: 'none', color: '#0088cc', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', padding: 0 }}>
                        ← Back to log in
                      </button>
                    </div>
                  </>
              }
            </div>
          : <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
              {error && (
                <div style={{ background: '#fde8e4', border: '1px solid #f5b5a8', borderRadius: 4, padding: '10px 14px', marginBottom: 16, fontSize: 14, color: '#a02010' }}>
                  {error}
                </div>
              )}
              <label style={labelStyle}>
                <span style={labelSpanStyle}>Username</span>
                <input
                  autoFocus
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  maxLength={50}
                  placeholder="username"
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = '#0088cc'}
                  onBlur={e => e.target.style.borderColor = '#d6d9dc'}
                />
              </label>
              {tab === 'signup' && (
                <label style={labelStyle}>
                  <span style={labelSpanStyle}>Display Name</span>
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    maxLength={60}
                    placeholder="How you appear in the forum"
                    style={inputStyle}
                    onFocus={e => e.target.style.borderColor = '#0088cc'}
                    onBlur={e => e.target.style.borderColor = '#d6d9dc'}
                  />
                </label>
              )}
              <label style={labelStyle}>
                <span style={labelSpanStyle}>Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = '#0088cc'}
                  onBlur={e => e.target.style.borderColor = '#d6d9dc'}
                />
              </label>
              {tab === 'signup' && (
                <label style={{ ...labelStyle, marginBottom: 20 }}>
                  <span style={labelSpanStyle}>Confirm Password</span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    style={inputStyle}
                    onFocus={e => e.target.style.borderColor = '#0088cc'}
                    onBlur={e => e.target.style.borderColor = '#d6d9dc'}
                  />
                </label>
              )}
              <button
                type="submit"
                disabled={saving}
                style={{
                  width: '100%', padding: '10px', borderRadius: 4, border: 'none',
                  background: saving ? '#80b8e6' : '#0088cc', color: '#fff',
                  fontSize: 15, fontWeight: 600, cursor: saving ? 'default' : 'pointer',
                }}
              >
                {saving
                  ? (tab === 'login' ? 'Logging in…' : 'Creating account…')
                  : (tab === 'login' ? 'Log in' : 'Create account')}
              </button>
              {tab === 'login' && (
                <div style={{ marginTop: 12, textAlign: 'center' }}>
                  <button type="button" onClick={() => switchTab('forgot')} style={{ background: 'none', border: 'none', color: '#787878', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', padding: 0 }}>
                    Forgot password?
                  </button>
                </div>
              )}
            </form>
        }
      </div>
    </div>
  );
}

// ── ResetPasswordModal ────────────────────────────────────────────────────────
function ResetPasswordModal({ token, onClose }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  const inputStyle = {
    width: '100%', padding: '9px 12px', border: '1px solid #d6d9dc',
    borderRadius: 4, fontSize: 15, fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box',
  };
  const labelStyle = { display: 'block', marginBottom: 14 };
  const labelSpanStyle = {
    display: 'block', fontSize: 12, fontWeight: 700, letterSpacing: '0.05em',
    textTransform: 'uppercase', color: '#787878', marginBottom: 6,
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setError(''); setSaving(true);
    try {
      const res = await fetch('/api/forum/auth/reset-password', {
        method: 'POST',
        headers: csrfHeaders(),
        credentials: 'include',
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg('Your password has been reset. You can now log in.');
        window.history.replaceState({}, '', window.location.pathname);
      } else {
        setError(data.message || 'This reset link is invalid or has expired.');
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={onClose} />
      <div style={{
        position: 'relative', background: '#fff', borderRadius: 8, width: '100%', maxWidth: 420,
        margin: '0 16px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid #e0e0e0' }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#333' }}>Choose new password</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#787878', lineHeight: 1, padding: '0 4px' }}>&times;</button>
        </div>
        <div style={{ padding: '20px' }}>
          {msg
            ? <>
                <div style={{ background: '#e6f4ea', border: '1px solid #a8d5b0', borderRadius: 4, padding: '10px 14px', marginBottom: 16, fontSize: 14, color: '#1a6630' }}>
                  {msg}
                </div>
                <button onClick={onClose} style={{ width: '100%', padding: '10px', borderRadius: 4, border: 'none', background: '#0088cc', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
                  Log in
                </button>
              </>
            : <>
                {error && (
                  <div style={{ background: '#fde8e4', border: '1px solid #f5b5a8', borderRadius: 4, padding: '10px 14px', marginBottom: 16, fontSize: 14, color: '#a02010' }}>
                    {error}
                  </div>
                )}
                <form onSubmit={handleSubmit}>
                  <label style={labelStyle}>
                    <span style={labelSpanStyle}>New password</span>
                    <input autoFocus type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="new-password" style={inputStyle}
                      onFocus={e => e.target.style.borderColor = '#0088cc'} onBlur={e => e.target.style.borderColor = '#d6d9dc'} />
                  </label>
                  <label style={{ ...labelStyle, marginBottom: 20 }}>
                    <span style={labelSpanStyle}>Confirm password</span>
                    <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required autoComplete="new-password" style={inputStyle}
                      onFocus={e => e.target.style.borderColor = '#0088cc'} onBlur={e => e.target.style.borderColor = '#d6d9dc'} />
                  </label>
                  <button type="submit" disabled={saving} style={{ width: '100%', padding: '10px', borderRadius: 4, border: 'none', background: saving ? '#80b8e6' : '#0088cc', color: '#fff', fontSize: 15, fontWeight: 600, cursor: saving ? 'default' : 'pointer' }}>
                    {saving ? 'Saving…' : 'Set new password'}
                  </button>
                </form>
              </>
          }
        </div>
      </div>
    </div>
  );
}

// ── UserSettingsModal ─────────────────────────────────────────────────────────
function UserSettingsModal({ user, onClose, onUserUpdate }) {
  const [displayName, setDisplayName] = useState(user.displayName || user.display_name || '');
  const [email, setEmail] = useState(user.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setSuccess('');

    const patch = {};
    const trimmedDisplayName = displayName.trim();
    if (trimmedDisplayName && trimmedDisplayName !== (user.displayName || user.display_name || '')) {
      patch.displayName = trimmedDisplayName;
    }
    const trimmedEmail = email.trim().toLowerCase();
    if (trimmedEmail !== (user.email || '').toLowerCase()) {
      patch.email = trimmedEmail;
    }
    if (newPassword) {
      if (!currentPassword) { setError('Please enter your current password to change it.'); return; }
      if (newPassword !== confirmNewPassword) { setError('New passwords do not match.'); return; }
      patch.currentPassword = currentPassword;
      patch.newPassword = newPassword;
    }
    if (Object.keys(patch).length === 0) { setError('No changes to save.'); return; }

    setSaving(true);
    try {
      const res = await fetch('/api/forum/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Something went wrong.'); return; }
      onUserUpdate(data.user || data);
      setSuccess('Settings saved.');
      setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword('');
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    width: '100%', padding: '9px 12px', border: '1px solid #d6d9dc',
    borderRadius: 4, fontSize: 15, fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box',
  };
  const labelStyle = { display: 'block', marginBottom: 14 };
  const labelSpanStyle = {
    display: 'block', fontSize: 12, fontWeight: 700, letterSpacing: '0.05em',
    textTransform: 'uppercase', color: '#787878', marginBottom: 6,
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={onClose} />
      <div style={{
        position: 'relative', background: '#fff', borderRadius: 8, width: '100%', maxWidth: 440,
        margin: '0 16px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid #e0e0e0', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Account Settings</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#787878', lineHeight: 1, padding: '0 4px' }}>&times;</button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          {error && (
            <div style={{ background: '#fde8e4', border: '1px solid #f5b5a8', borderRadius: 4, padding: '10px 14px', marginBottom: 16, fontSize: 14, color: '#a02010' }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 4, padding: '10px 14px', marginBottom: 16, fontSize: 14, color: '#2e7d32' }}>
              {success}
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#444', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid #f0f0f0' }}>Profile</div>
            <label style={labelStyle}>
              <span style={labelSpanStyle}>Display Name</span>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                maxLength={60}
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#0088cc'}
                onBlur={e => e.target.style.borderColor = '#d6d9dc'}
              />
            </label>
            <label style={labelStyle}>
              <span style={labelSpanStyle}>Email address (for password reset)</span>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#0088cc'}
                onBlur={e => e.target.style.borderColor = '#d6d9dc'}
              />
            </label>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#444', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid #f0f0f0' }}>Change Password</div>
            <label style={labelStyle}>
              <span style={labelSpanStyle}>Current Password</span>
              <input
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Required to change password"
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#0088cc'}
                onBlur={e => e.target.style.borderColor = '#d6d9dc'}
              />
            </label>
            <label style={labelStyle}>
              <span style={labelSpanStyle}>New Password</span>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Leave blank to keep current"
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#0088cc'}
                onBlur={e => e.target.style.borderColor = '#d6d9dc'}
              />
            </label>
            <label style={{ ...labelStyle, marginBottom: 0 }}>
              <span style={labelSpanStyle}>Confirm New Password</span>
              <input
                type="password"
                value={confirmNewPassword}
                onChange={e => setConfirmNewPassword(e.target.value)}
                placeholder="••••••••"
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#0088cc'}
                onBlur={e => e.target.style.borderColor = '#d6d9dc'}
              />
            </label>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '9px 18px', borderRadius: 4, border: '1px solid #d6d9dc', background: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', color: '#555' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} style={{ padding: '9px 20px', borderRadius: 4, border: 'none', background: saving ? '#80b8e6' : '#0088cc', color: '#fff', fontSize: 14, fontWeight: 600, cursor: saving ? 'default' : 'pointer' }}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── UserMenu ──────────────────────────────────────────────────────────────────
function UserMenu({ user, onClose, onOpenSettings, onLogout }) {
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const displayName = user.displayName || user.display_name || user.username || 'User';

  return (
    <div
      ref={menuRef}
      style={{
        position: 'absolute', top: '100%', right: 0, marginTop: 8,
        background: '#fff', border: '1px solid #e0e0e0', borderRadius: 6,
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 180, zIndex: 1500,
      }}
    >
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#222' }}>{displayName}</div>
        <div style={{ fontSize: 12, color: '#787878', marginTop: 2 }}>@{user.username}</div>
      </div>
      <button
        onClick={() => { onOpenSettings(); onClose(); }}
        style={{
          display: 'block', width: '100%', padding: '10px 16px', border: 'none',
          background: 'none', textAlign: 'left', fontSize: 14, cursor: 'pointer', color: '#333',
        }}
        onMouseEnter={e => e.currentTarget.style.background = '#f5f5f5'}
        onMouseLeave={e => e.currentTarget.style.background = 'none'}
      >
        Settings
      </button>
      <button
        onClick={() => { onLogout(); onClose(); }}
        style={{
          display: 'block', width: '100%', padding: '10px 16px', border: 'none',
          background: 'none', textAlign: 'left', fontSize: 14, cursor: 'pointer',
          color: '#c0392b', borderTop: '1px solid #f0f0f0',
        }}
        onMouseEnter={e => e.currentTarget.style.background = '#fde8e4'}
        onMouseLeave={e => e.currentTarget.style.background = 'none'}
      >
        Log out
      </button>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonRows() {
  return (
    <>
      {[80, 55, 70, 90, 60].map((w, i) => (
        <div key={i} className="skeleton-row">
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            <div className="skeleton skeleton-line" style={{width:`${w}%`}} />
            <div className="skeleton skeleton-line" style={{width:'40%',height:11}} />
          </div>
          <div className="skeleton skeleton-line" style={{width:30,margin:'0 auto'}} />
          <div className="skeleton skeleton-line" style={{width:35,margin:'0 auto'}} />
          <div className="skeleton skeleton-line" style={{width:45,margin:'0 auto'}} />
        </div>
      ))}
    </>
  );
}

function SkeletonPost() {
  return (
    <div className="post-card">
      <div className="post-avatar-col">
        <div className="skeleton" style={{width:40,height:40,borderRadius:'50%'}} />
      </div>
      <div className="post-body-col">
        <div className="skeleton skeleton-line" style={{width:'30%',marginBottom:12}} />
        <div className="skeleton skeleton-line" style={{width:'90%',marginBottom:8}} />
        <div className="skeleton skeleton-line" style={{width:'75%',marginBottom:8}} />
        <div className="skeleton skeleton-line" style={{width:'50%'}} />
      </div>
    </div>
  );
}

// ── NewTopicModal ─────────────────────────────────────────────────────────────
function NewTopicModal({ cats, defaultCat, onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [cat, setCat] = useState(defaultCat || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) { setError('Please enter a topic title.'); return; }
    if (!body.trim() || body.trim().length < 20) { setError('Body must be at least 20 characters.'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/forum/threads', {
        method: 'POST',
        headers: csrfHeaders(),
        credentials: 'include',
        body: JSON.stringify({ title: title.trim(), body: body.trim(), cat }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Something went wrong.'); return; }
      onCreated(data.thread);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    width:'100%', padding:'9px 12px', border:'1px solid #d6d9dc',
    borderRadius:4, fontSize:15, fontFamily:'inherit', outline:'none',
  };
  const labelStyle = { display:'block', marginBottom:16 };
  const labelSpanStyle = {
    display:'block', fontSize:12, fontWeight:700, letterSpacing:'0.05em',
    textTransform:'uppercase', color:'#787878', marginBottom:6,
  };

  return (
    <div style={{position:'fixed',inset:0,zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.5)'}} onClick={onClose} />
      <div style={{
        position:'relative', background:'#fff', borderRadius:8, width:'100%', maxWidth:560,
        margin:'0 16px', boxShadow:'0 20px 60px rgba(0,0,0,0.25)', maxHeight:'90vh', overflowY:'auto',
      }}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'18px 20px',borderBottom:'1px solid #e0e0e0',position:'sticky',top:0,background:'#fff',zIndex:1}}>
          <h2 style={{fontSize:17,fontWeight:700,margin:0}}>Create a new topic</h2>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:'#787878',lineHeight:1,padding:'0 4px'}}>&times;</button>
        </div>
        <form onSubmit={handleSubmit} style={{padding:'20px'}}>
          {error && (
            <div style={{background:'#fde8e4',border:'1px solid #f5b5a8',borderRadius:4,padding:'10px 14px',marginBottom:16,fontSize:14,color:'#a02010'}}>
              {error}
            </div>
          )}
          <label style={labelStyle}>
            <span style={labelSpanStyle}>Title</span>
            <input autoFocus type="text" value={title} onChange={e => setTitle(e.target.value)}
              maxLength={200} placeholder="What's your topic about?"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor='#0088cc'}
              onBlur={e => e.target.style.borderColor='#d6d9dc'}
            />
          </label>
          <label style={labelStyle}>
            <span style={labelSpanStyle}>Body</span>
            <textarea value={body} onChange={e => setBody(e.target.value)}
              placeholder="Describe your topic in detail… (min. 20 characters)"
              rows={6}
              style={{...inputStyle, resize:'vertical', lineHeight:1.6}}
              onFocus={e => e.target.style.borderColor='#0088cc'}
              onBlur={e => e.target.style.borderColor='#d6d9dc'}
            />
          </label>
          <label style={{...labelStyle, marginBottom:20}}>
            <span style={labelSpanStyle}>Category</span>
            <select value={cat} onChange={e => setCat(e.target.value)}
              style={{...inputStyle, background:'#fff'}}>
              <option value="">— No category —</option>
              {cats.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
            <button type="button" onClick={onClose} style={{padding:'9px 18px',borderRadius:4,border:'1px solid #d6d9dc',background:'#fff',fontSize:14,fontWeight:500,cursor:'pointer',color:'#555'}}>
              Cancel
            </button>
            <button type="submit" disabled={saving} style={{padding:'9px 20px',borderRadius:4,border:'none',background:saving?'#80b8e6':'#0088cc',color:'#fff',fontSize:14,fontWeight:600,cursor:saving?'default':'pointer'}}>
              {saving ? 'Posting…' : 'Create topic'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── ForumHeader ───────────────────────────────────────────────────────────────
function NotificationsPanel({ onClose }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);
  return (
    <div ref={ref} style={{
      position:'absolute', top:'calc(100% + 8px)', right:0, width:320,
      background:'var(--secondary-background-color, #fff)', border:'1px solid var(--primary-medium, #ccc)',
      boxShadow:'0 4px 16px rgba(0,0,0,.15)', borderRadius:4, zIndex:500,
    }}>
      <div style={{padding:'12px 16px', borderBottom:'1px solid var(--primary-medium, #ccc)', fontWeight:600, fontSize:14}}>
        Notifications
      </div>
      <div style={{padding:'24px 16px', textAlign:'center', color:'var(--primary-medium-low, #aaa)', fontSize:13}}>
        You're all caught up — no new notifications.
      </div>
    </div>
  );
}

function ForumHeader({ siteUrl, query, onQueryChange, onNewTopic, onMenuToggle, user, authLoading, onLoginClick, onLogout, onOpenSettings }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const displayName = user ? (user.displayName || user.display_name || user.username || 'User') : '';
  const initial = displayName ? displayName.slice(0, 1).toUpperCase() : '';
  const bgColor = user ? avatarColor(user.username || displayName) : '#aaa';

  return (
    <div id="d-header">
      <button className="header-btn hamburger-btn" aria-label="Menu" onClick={onMenuToggle}><IconBurger /></button>
      <a className="site-logo" href={siteUrl || '/'}>
        <img src="assets/logo.webp" alt="Outback Electronics" />
        <div>
          <div className="site-name">Outback Electronics</div>
          <div className="site-tagline">Community Forum</div>
        </div>
      </a>
      <div className="header-spacer" />
      <div className="search-bar">
        <IconSearch />
        <input
          type="search"
          placeholder="Search…"
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          aria-label="Search topics"
        />
      </div>
      <div className="header-right">
        <div style={{position:'relative'}}>
          <button className="header-btn" aria-label="Notifications" onClick={() => setNotifOpen(o => !o)}><IconBell /></button>
          {notifOpen && <NotificationsPanel onClose={() => setNotifOpen(false)} />}
        </div>
        {!authLoading && (
          user ? (
            <div style={{ position: 'relative' }}>
              <div
                className="user-avatar"
                title={displayName}
                style={{ background: bgColor, cursor: 'pointer' }}
                onClick={() => setMenuOpen(o => !o)}
              >
                {initial}
              </div>
              {menuOpen && (
                <UserMenu
                  user={user}
                  onClose={() => setMenuOpen(false)}
                  onOpenSettings={onOpenSettings}
                  onLogout={onLogout}
                />
              )}
            </div>
          ) : (
            <button
              onClick={onLoginClick}
              style={{
                padding: '6px 14px', borderRadius: 4, border: '1px solid #0088cc',
                background: 'transparent', color: '#0088cc', fontSize: 14,
                fontWeight: 600, cursor: 'pointer',
              }}
            >
              Log in
            </button>
          )
        )}
        <button className="btn-new-topic" onClick={onNewTopic}>
          <IconPlus /><span>New Topic</span>
        </button>
      </div>
    </div>
  );
}

// ── ForumSidebar ──────────────────────────────────────────────────────────────
function ForumSidebar({ cats, threads, conduct, route, sidebarOpen, onCloseSidebar }) {
  const { view, categoryId, params } = route;
  const sort = params && params.sort;

  function isActive(v, catId, s) {
    if (v === 'categories' && view === 'categories') return true;
    if (v === 'latest' && view === 'latest' && !s && !sort) return true;
    if (v === 'latest' && view === 'latest' && s && sort === s) return true;
    if (v === 'category' && view === 'category' && catId === categoryId) return true;
    return false;
  }

  function navLink(href, icon, label, active, count) {
    return (
      <a
        key={href}
        className={`sidebar-link${active ? ' active' : ''}`}
        href={href}
        onClick={e => { e.preventDefault(); navigate(href); if (onCloseSidebar) onCloseSidebar(); }}
      >
        {icon}
        {label}
        {count != null && <span className="link-count">{count}</span>}
      </a>
    );
  }

  const catCounts = cats.reduce((acc, c) => {
    acc[c.id] = threads.filter(t => t.cat === c.id).length;
    return acc;
  }, {});

  return (
    <>
      <div className={`sidebar-overlay${sidebarOpen ? ' open' : ''}`} onClick={onCloseSidebar} />
      <nav id="sidebar">
        <div className="sidebar-section">
          <div className="sidebar-section-title">Navigation</div>
          {navLink('/categories', <IconHome />, 'Categories', isActive('categories'), null)}
          {navLink('/latest', <IconLatest />, 'Latest', isActive('latest', null, null), threads.length)}
          {navLink('/latest?sort=top', <IconTop />, 'Top', isActive('latest', null, 'top'), null)}
          {navLink('/latest?sort=unanswered', <IconTag />, 'Unanswered', isActive('latest', null, 'unanswered'), null)}
        </div>
        {cats.length > 0 && (
          <div className="sidebar-section">
            <div className="sidebar-section-title">Categories</div>
            {cats.map(c => (
              <a
                key={c.id}
                className={`sidebar-link${isActive('category', c.id) ? ' active' : ''}`}
                href={`/c/${c.id}`}
                onClick={e => { e.preventDefault(); navigate(`/c/${c.id}`); if (onCloseSidebar) onCloseSidebar(); }}
              >
                <span className="cat-dot" style={{background: catColor(c.id)}} />
                {c.label}
                <span className="link-count">{catCounts[c.id] || 0}</span>
              </a>
            ))}
          </div>
        )}
        {conduct && (
          <div style={{fontSize:12,color:'var(--text-muted)',padding:'0 8px',lineHeight:1.6}}>
            {conduct}
          </div>
        )}
      </nav>
    </>
  );
}

// ── CategoriesView ────────────────────────────────────────────────────────────
function CategoriesView({ cats, threads, onNewTopic }) {
  const catCounts = cats.reduce((acc, c) => {
    acc[c.id] = threads.filter(t => t.cat === c.id).length;
    return acc;
  }, {});

  const recentByCat = cats.reduce((acc, c) => {
    acc[c.id] = threads
      .filter(t => t.cat === c.id)
      .sort((a, b) => a.activityHours - b.activityHours)
      .slice(0, 2);
    return acc;
  }, {});

  return (
    <div id="main-content">
      <h1 className="page-title">Categories</h1>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:16,marginBottom:24}}>
        {cats.map(c => {
          const color = catColor(c.id);
          const recent = recentByCat[c.id] || [];
          return (
            <div key={c.id} className="cat-card">
              <div className="cat-card-bar" style={{background: color}} />
              <div className="cat-card-body">
                <div style={{marginBottom:6}}>
                  <a href={`/c/${c.id}`} style={{fontWeight:700,fontSize:15,color:'var(--text)',textDecoration:'none'}} onClick={e => { e.preventDefault(); navigate(`/c/${c.id}`); }}>
                    {c.label}
                  </a>
                </div>
                {c.desc && (
                  <div style={{fontSize:13,color:'var(--text-muted)',marginBottom:8,lineHeight:1.5}}>{c.desc}</div>
                )}
                <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:8}}>
                  {catCounts[c.id] || 0} topic{catCounts[c.id] !== 1 ? 's' : ''}
                </div>
                {recent.length > 0 && (
                  <div style={{borderTop:'1px solid #f0f0f0',paddingTop:8,display:'flex',flexDirection:'column',gap:4}}>
                    {recent.map(t => (
                      <a key={t.id} href={`/t/${t.id}`}
                        style={{fontSize:13,color:'var(--link)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',display:'block'}}
                        onClick={e => { e.preventDefault(); navigate(`/t/${t.id}`); }}>
                        {t.title}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <button className="btn-new-topic" onClick={onNewTopic} style={{display:'inline-flex'}}>
        <IconPlus /><span>New Topic</span>
      </button>
    </div>
  );
}

// ── TopicListView ─────────────────────────────────────────────────────────────
const PAGE_SIZE = 30;

function TopicListView({ cats, threads, route, query, onNewTopic }) {
  const { view, categoryId, params } = route;
  const [page, setPage] = useState(0);
  const sort = (params && params.sort) || 'latest';

  useEffect(() => { setPage(0); }, [view, categoryId, sort, query]);

  const catObj = categoryId ? cats.find(c => c.id === categoryId) : null;
  const headingLabel = catObj ? catObj.label : 'Latest topics';

  let list = threads;
  if (view === 'category' && categoryId) {
    list = threads.filter(t => t.cat === categoryId);
  }
  if (query.trim()) {
    const q = query.toLowerCase();
    list = list.filter(t => t.title.toLowerCase().includes(q));
  }
  if (sort === 'unanswered') {
    list = list.filter(t => t.replies === 0);
  }

  list = [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (sort === 'top') return b.likes - a.likes;
    if (sort === 'unanswered') return a.activityHours - b.activityHours;
    return a.activityHours - b.activityHours;
  });

  const totalPages = Math.ceil(list.length / PAGE_SIZE);
  const pageItems = list.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const currentSort = sort === 'top' ? 'top' : sort === 'unanswered' ? 'unanswered' : 'latest';
  const baseHash = view === 'category' ? `/c/${categoryId}` : '/latest';

  return (
    <div id="main-content">
      <div className="list-controls">
        <div>
          <h2>{headingLabel}</h2>
          <div className="topic-count">{list.length} topic{list.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      <div className="nav-pills">
        {[
          { key: 'latest', label: 'Latest' },
          { key: 'top', label: 'Top' },
          { key: 'unanswered', label: 'Unanswered' },
        ].map(tab => (
          <a
            key={tab.key}
            className={`nav-pill${currentSort === tab.key ? ' active' : ''}`}
            href={`${baseHash}${tab.key !== 'latest' ? `?sort=${tab.key}` : ''}`}
            onClick={e => { e.preventDefault(); navigate(`${baseHash}${tab.key !== 'latest' ? `?sort=${tab.key}` : ''}`); }}
          >
            {tab.label}
          </a>
        ))}
      </div>

      <div className="topic-list-container">
        <div className="topic-list-header">
          <div>Topic</div>
          <div style={{textAlign:'center'}}>Replies</div>
          <div style={{textAlign:'center'}}>Views</div>
          <div style={{textAlign:'right'}}>Activity</div>
        </div>

        {pageItems.length === 0 ? (
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <p>No topics found{query ? ` for "${query}"` : ''}.</p>
          </div>
        ) : (
          pageItems.map(t => {
            const color = t.cat ? catColor(t.cat) : '#aaa';
            const catLabel = cats.find(c => c.id === t.cat)?.label;
            const posters = t.lastReplier
              ? [t.author, t.lastReplier].filter((v, i, a) => a.indexOf(v) === i).slice(0, 3)
              : [t.author];
            return (
              <div key={t.id} className="topic-row" onClick={() => navigate(`/t/${t.id}`)} style={{cursor:'pointer'}}>
                <div className="topic-main">
                  <div className="topic-meta">
                    {catLabel && (
                      <a className="topic-cat-badge" href={`/c/${t.cat}`} onClick={e => { e.preventDefault(); e.stopPropagation(); navigate(`/c/${t.cat}`); }}>
                        <span className="dot" style={{background: color}} />
                        {catLabel}
                      </a>
                    )}
                    {t.pinned && <span style={{color:'var(--text-muted)',fontSize:12,display:'inline-flex',alignItems:'center',gap:3}}><IconPin />pinned</span>}
                    {t.staff && <span className="topic-tag">staff</span>}
                    {t.hot && <span className="topic-tag" style={{background:'#fde8e4',color:'#c03311'}}>hot</span>}
                    {t.locked && <span style={{color:'var(--text-muted)',fontSize:12,display:'inline-flex',alignItems:'center',gap:3}}><IconLock />locked</span>}
                    {t.solved && <span className="topic-tag" style={{background:'#e8f5e9',color:'#2e7d32'}}>solved</span>}
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <div className="topic-title">{t.title}</div>
                    <div className="topic-posters">
                      {posters.map((name, i) => (
                        <div key={i} className="poster-avatar" title={name} style={{background: avatarColor(name)}}>
                          {name.slice(0,1).toUpperCase()}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="topic-stat">
                  <div className={`num${t.replies > 50 ? ' hot' : ''}`}>{fmtCount(t.replies)}</div>
                </div>
                <div className="topic-stat">
                  <div className="num">{fmtCount(t.views)}</div>
                </div>
                <div className="topic-activity" style={{textAlign:'right'}}>
                  {fmtAge(t.activityHours)}
                </div>
              </div>
            );
          })
        )}
      </div>

      {totalPages > 1 && (
        <div style={{display:'flex',gap:8,justifyContent:'center',marginTop:16,alignItems:'center'}}>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{padding:'6px 14px',borderRadius:4,border:'1px solid #d6d9dc',background:'#fff',cursor:page===0?'default':'pointer',color:page===0?'#aaa':'var(--text)',fontSize:14}}
          >
            ← Prev
          </button>
          <span style={{fontSize:13,color:'var(--text-muted)'}}>Page {page+1} of {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages-1, p+1))}
            disabled={page === totalPages - 1}
            style={{padding:'6px 14px',borderRadius:4,border:'1px solid #d6d9dc',background:'#fff',cursor:page===totalPages-1?'default':'pointer',color:page===totalPages-1?'#aaa':'var(--text)',fontSize:14}}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

// ── ThreadView ────────────────────────────────────────────────────────────────
function ThreadView({ threadId, cats, threads, onThreadUpdate, fromCategory, user, onLoginPrompt }) {
  const [thread, setThread] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyBody, setReplyBody] = useState('');
  const [replying, setReplying] = useState(false);
  const [replyError, setReplyError] = useState('');
  const replyRef = useRef(null);

  const [liked, setLiked] = useState(() => {
    try { return JSON.parse(localStorage.getItem('oe_liked') || '{}'); } catch { return {}; }
  });

  useEffect(() => {
    setLoading(true);
    setThread(null);
    setPosts([]);
    fetch(`/api/forum/threads/${threadId}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        const t = data.thread || data;
        setThread(t);
        setPosts(Array.isArray(data.posts) ? data.posts : (Array.isArray(t.posts) ? t.posts : []));
      })
      .catch(() => {
        const local = threads.find(t => String(t.id) === String(threadId));
        if (local) {
          setThread(local);
          setPosts(Array.isArray(local.posts) ? local.posts : []);
        }
      })
      .finally(() => setLoading(false));
  }, [threadId]);

  async function toggleLike(postId) {
    const key = String(postId);
    const isLiked = !!liked[key];
    const newLiked = { ...liked, [key]: !isLiked };
    setLiked(newLiked);
    try { localStorage.setItem('oe_liked', JSON.stringify(newLiked)); } catch {}
    setPosts(prev => prev.map(p =>
      String(p.id) === key
        ? { ...p, likes: (Number(p.likes) || 0) + (isLiked ? -1 : 1) }
        : p
    ));
    try {
      const res = await fetch(`/api/forum/posts/${postId}/like`, {
        method: 'POST',
        headers: csrfHeaders(),
        credentials: 'include',
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        setPosts(prev => prev.map(p => String(p.id) === key ? { ...p, likes: data.likes } : p));
      }
    } catch {}
  }

  function handleQuote(post) {
    const quoted = `@${post.author}: "${post.body}"\n\n`;
    setReplyBody(prev => quoted + prev);
    replyRef.current && replyRef.current.focus();
  }

  async function toggleSolution(post) {
    const isCurrentSolution = post.solution;
    setPosts(prev => prev.map(p => ({ ...p, solution: !isCurrentSolution && String(p.id) === String(post.id) })));
    setThread(prev => ({ ...prev, solved: !isCurrentSolution }));
    try {
      const res = await fetch(`/api/forum/threads/${threadId}/solve`, {
        method: 'POST',
        headers: csrfHeaders(),
        credentials: 'include',
        body: JSON.stringify({ postId: post.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setThread(prev => ({ ...prev, solved: data.solved, solvedPostId: data.solvedPostId }));
        setPosts(prev => prev.map(p => ({ ...p, solution: String(p.id) === String(data.solvedPostId) })));
      }
    } catch {}
  }

  async function handleReply(e) {
    e.preventDefault();
    if (!replyBody.trim()) { setReplyError('Please enter a reply.'); return; }
    setReplying(true); setReplyError('');
    try {
      const res = await fetch(`/api/forum/threads/${threadId}/posts`, {
        method: 'POST',
        headers: csrfHeaders(),
        credentials: 'include',
        body: JSON.stringify({ body: replyBody.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setReplyError(data.message || 'Something went wrong.'); return; }
      const authorName = user ? (user.displayName || user.display_name || user.username) : 'Unknown';
      const newPost = data.post || { id: `p-${Date.now()}`, author: authorName, body: replyBody.trim(), likes: 0 };
      setPosts(prev => [...prev, newPost]);
      setReplyBody('');
    } catch {
      const authorName = user ? (user.displayName || user.display_name || user.username) : 'Unknown';
      const newPost = { id: `p-${Date.now()}`, author: authorName, body: replyBody.trim(), likes: 0, createdHours: 0 };
      setPosts(prev => [...prev, newPost]);
      setReplyBody('');
    } finally {
      setReplying(false);
    }
  }

  const backHref = fromCategory ? `/c/${fromCategory}` : '/latest';
  const catObj = thread ? cats.find(c => c.id === thread.cat) : null;

  if (loading) {
    return (
      <div id="main-content">
        <div className="breadcrumb" style={{marginBottom:16}}>
          <a href="/latest" style={{color:'var(--text-muted)'}} onClick={e => { e.preventDefault(); navigate('/latest'); }}>Forum</a>
          <IconChevron />
          <div className="skeleton skeleton-line" style={{width:80,height:12}} />
          <IconChevron />
          <div className="skeleton skeleton-line" style={{width:160,height:12}} />
        </div>
        <div className="skeleton skeleton-line" style={{width:'60%',height:28,marginBottom:24}} />
        {[1,2,3].map(i => <SkeletonPost key={i} />)}
      </div>
    );
  }

  if (!thread) {
    return (
      <div id="main-content">
        <div className="empty-state">
          <p>Thread not found.</p>
          <a href="/latest" style={{color:'var(--link)'}} onClick={e => { e.preventDefault(); navigate('/latest'); }}>← Back to latest</a>
        </div>
      </div>
    );
  }

  return (
    <div id="main-content">
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <a href="/latest" style={{color:'var(--text-muted)'}} onClick={e => { e.preventDefault(); navigate('/latest'); }}>Forum</a>
        <IconChevron />
        {catObj
          ? <a href={`/c/${catObj.id}`} style={{color:'var(--text-muted)'}} onClick={e => { e.preventDefault(); navigate(`/c/${catObj.id}`); }}>{catObj.label}</a>
          : <span>General</span>
        }
        <IconChevron />
        <span style={{color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:300}}>
          {thread.title}
        </span>
      </div>

      {/* Thread title */}
      <div style={{marginBottom:20}}>
        <h1 style={{fontSize:22,fontWeight:700,lineHeight:1.3,display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
          {thread.pinned && <span title="Pinned" style={{fontSize:16}}>📌</span>}
          {thread.title}
          {thread.solved && <span className="solved-badge">✓ Solved</span>}
          {thread.locked && (
            <span style={{display:'inline-flex',alignItems:'center',gap:4,background:'#f5f5f5',color:'#787878',borderRadius:4,padding:'2px 8px',fontSize:13,fontWeight:600}}>
              <IconLock />Locked
            </span>
          )}
        </h1>
      </div>

      {/* Posts */}
      <div style={{border:'1px solid #ebebeb',borderRadius:6,overflow:'hidden',marginBottom:8}}>
        {posts.map((post, idx) => {
          const postKey = String(post.id || idx);
          const isLiked = !!liked[postKey];
          const isOP = idx === 0;
          return (
            <div key={postKey} className="post-card">
              <div className="post-avatar-col">
                <div style={{
                  width:40, height:40, borderRadius:'50%',
                  background: avatarColor(post.author || 'Unknown'),
                  display:'grid', placeItems:'center',
                  color:'#fff', fontWeight:700, fontSize:16, flexShrink:0,
                }}>
                  {(post.author || '?').slice(0,1).toUpperCase()}
                </div>
                <div style={{fontSize:11,color:'var(--text-muted)',fontWeight:600}}>#{idx+1}</div>
              </div>
              <div className="post-body-col">
                <div className="post-meta">
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span className="post-author">{post.author || 'Unknown'}</span>
                    {isOP && (
                      <span style={{fontSize:11,background:'#e8f0f8',color:'#0066bb',borderRadius:3,padding:'1px 6px',fontWeight:600}}>
                        Original Poster
                      </span>
                    )}
                    {post.solution && <span className="solved-badge">✓ Solution</span>}
                  </div>
                  <span style={{fontSize:12,color:'var(--text-muted)'}}>
                    {fmtAge(Number(post.createdHours) || 0)} ago
                  </span>
                </div>
                <div className="post-body">{post.body || ''}</div>
                <div className="post-actions">
                  <button
                    className={`action-btn${isLiked ? ' liked' : ''}`}
                    onClick={() => toggleLike(post.id)}
                    title={isLiked ? 'Unlike' : 'Like'}
                  >
                    ♥ {Number(post.likes) || 0}
                  </button>
                  <button
                    className="action-btn"
                    onClick={() => handleQuote(post)}
                    title="Quote in reply"
                  >
                    ❝ Quote
                  </button>
                  {!isOP && !thread.solved && (
                    <button
                      className="action-btn solved-btn"
                      onClick={() => toggleSolution(post)}
                      title="Mark as solution"
                    >
                      ✓ Mark as Solution
                    </button>
                  )}
                  {post.solution && thread.solved && (
                    <button
                      className="action-btn"
                      onClick={() => toggleSolution(post)}
                      title="Unmark solution"
                      style={{color:'#3ab54a'}}
                    >
                      ✓ Unsolve
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {posts.length === 0 && (
          <div style={{padding:'40px 20px',textAlign:'center',color:'var(--text-muted)'}}>No posts yet.</div>
        )}
      </div>

      {/* Reply / locked / login gate */}
      {thread.locked ? (
        <div className="locked-notice">
          <strong><IconLock /> This topic is locked.</strong> No new replies can be posted.
        </div>
      ) : user ? (
        <div className="reply-box">
          <h3 style={{fontSize:15,fontWeight:700,marginBottom:16}}>Reply to this topic</h3>
          {replyError && (
            <div style={{background:'#fde8e4',border:'1px solid #f5b5a8',borderRadius:4,padding:'10px 14px',marginBottom:14,fontSize:14,color:'#a02010'}}>
              {replyError}
            </div>
          )}
          <form onSubmit={handleReply}>
            <textarea
              ref={replyRef}
              placeholder="Write your reply…"
              value={replyBody}
              onChange={e => setReplyBody(e.target.value)}
              rows={5}
              style={{width:'100%',padding:'8px 12px',border:'1px solid #d6d9dc',borderRadius:4,fontSize:14,fontFamily:'inherit',outline:'none',resize:'vertical',lineHeight:1.6,marginBottom:12,boxSizing:'border-box'}}
              onFocus={e => e.target.style.borderColor='#0088cc'}
              onBlur={e => e.target.style.borderColor='#d6d9dc'}
            />
            <div style={{display:'flex',justifyContent:'flex-end'}}>
              <button
                type="submit"
                disabled={replying}
                style={{padding:'9px 22px',borderRadius:4,border:'none',background:replying?'#80b8e6':'#0088cc',color:'#fff',fontSize:14,fontWeight:600,cursor:replying?'default':'pointer'}}
              >
                {replying ? 'Posting…' : 'Post Reply'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="reply-box" style={{textAlign:'center',padding:'24px 20px'}}>
          <p style={{marginBottom:12,color:'var(--text-muted)',fontSize:14}}>You must be logged in to reply.</p>
          <button
            onClick={onLoginPrompt}
            style={{padding:'8px 20px',borderRadius:4,border:'none',background:'#0088cc',color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer'}}
          >
            Log in to reply
          </button>
        </div>
      )}

      <div style={{marginTop:16}}>
        <a href={backHref} style={{fontSize:13,color:'var(--text-muted)'}}>← Back</a>
      </div>
    </div>
  );
}

// ── ForumPage ─────────────────────────────────────────────────────────────────
function ForumPage({ siteUrl }) {
  const { user, loading: authLoading, setUser } = useAuth();
  const [route, setRoute] = useState(parsePath);
  const [query, setQuery] = useState('');
  const [forumData, setForumData] = useState({ categories: [], threads: [], conduct: '' });
  const [loading, setLoading] = useState(true);
  const [showNewTopic, setShowNewTopic] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [resetToken, setResetToken] = useState(() => new URLSearchParams(window.location.search).get('reset') || null);
  const prevCategoryRef = useRef(null);

  useEffect(() => {
    function onHashChange() {
      const newRoute = parsePath();
      setRoute(newRoute);
      if (newRoute.view === 'thread') setQuery('');
    }
    window.addEventListener('popstate', onHashChange);
    return () => window.removeEventListener('popstate', onHashChange);
  }, []);

  useEffect(() => {
    if (route.view === 'category') prevCategoryRef.current = route.categoryId;
    if (route.view === 'categories' || route.view === 'latest') prevCategoryRef.current = null;
  }, [route]);

  useEffect(() => {
    document.body.classList.toggle('sidebar-open', sidebarOpen);
    return () => document.body.classList.remove('sidebar-open');
  }, [sidebarOpen]);

  useEffect(() => {
    let active = true;
    fetch('/api/forum', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (!active) return;
        setForumData({
          categories: Array.isArray(data.categories) ? data.categories : [],
          threads: Array.isArray(data.threads) ? data.threads : [],
          conduct: typeof data.conduct === 'string' ? data.conduct : '',
        });
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function handleLogout() {
    try {
      await fetch('/api/forum/auth/logout', { method: 'POST', headers: csrfHeaders(), credentials: 'include' });
    } catch {}
    setUser(null);
  }

  function handleNewTopicClick() {
    if (!user) { setShowLogin(true); return; }
    setShowNewTopic(true);
  }

  const cats = forumData.categories.map((cat, i) => {
    if (typeof cat === 'string') return { id: `cat-${i}`, label: cat, desc: '' };
    return {
      id: cat.id || `cat-${i}`,
      label: cat.label || cat.name || `Category ${i + 1}`,
      desc: cat.desc || cat.description || '',
    };
  });

  const threads = forumData.threads.map((t, i) => ({
    id: t.id || `t-${i}`,
    title: t.title || `Untitled topic ${i + 1}`,
    cat: t.cat || t.categoryId || t.category || '',
    author: t.author || t.user || 'Unknown',
    lastReplier: t.lastReplier || t.last_replier || null,
    replies: Number(t.replies || 0),
    views: Number(t.views || 0),
    likes: Number(t.likes || 0),
    activityHours: Number(t.activityHours || 0),
    pinned: Boolean(t.pinned),
    hot: Boolean(t.hot),
    staff: Boolean(t.staff),
    locked: Boolean(t.locked),
    solved: Boolean(t.solved),
    posts: Array.isArray(t.posts) ? t.posts : [],
  }));

  function handleThreadCreated(thread) {
    setForumData(prev => ({ ...prev, threads: [thread, ...prev.threads] }));
    if (thread && thread.id) navigate(`/t/${thread.id}`);
  }

  const defaultCat = route.view === 'category' ? route.categoryId : '';

  return (
    <>
      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onLogin={u => { setUser(u); setShowLogin(false); }}
        />
      )}

      {showSettings && user && (
        <UserSettingsModal
          user={user}
          onClose={() => setShowSettings(false)}
          onUserUpdate={u => setUser(u)}
        />
      )}

      {showNewTopic && user && (
        <NewTopicModal
          cats={cats}
          defaultCat={defaultCat}
          onClose={() => setShowNewTopic(false)}
          onCreated={handleThreadCreated}
        />
      )}

      {resetToken && (
        <ResetPasswordModal
          token={resetToken}
          onClose={() => setResetToken(null)}
        />
      )}

      <ForumHeader
        siteUrl={siteUrl}
        query={query}
        onQueryChange={setQuery}
        onNewTopic={handleNewTopicClick}
        onMenuToggle={() => setSidebarOpen(o => !o)}
        user={user}
        authLoading={authLoading}
        onLoginClick={() => setShowLogin(true)}
        onLogout={handleLogout}
        onOpenSettings={() => setShowSettings(true)}
      />

      <div id="main-outlet">
        <ForumSidebar
          cats={cats}
          threads={threads}
          conduct={forumData.conduct}
          route={route}
          sidebarOpen={sidebarOpen}
          onCloseSidebar={() => setSidebarOpen(false)}
        />

        {loading ? (
          <div id="main-content">
            <SkeletonRows />
          </div>
        ) : route.view === 'categories' ? (
          <CategoriesView
            cats={cats}
            threads={threads}
            onNewTopic={handleNewTopicClick}
          />
        ) : route.view === 'thread' ? (
          <ThreadView
            threadId={route.threadId}
            cats={cats}
            threads={threads}
            onThreadUpdate={() => {}}
            fromCategory={prevCategoryRef.current}
            user={user}
            onLoginPrompt={() => setShowLogin(true)}
          />
        ) : (
          <TopicListView
            cats={cats}
            threads={threads}
            route={route}
            query={query}
            onNewTopic={handleNewTopicClick}
          />
        )}
      </div>
    </>
  );
}

export default ForumPage;
