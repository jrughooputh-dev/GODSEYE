// ═══════════════════════════════════════════════════════════
//  GODS EYE — AUTH MODULE
//  Client-side authentication with SHA-256 hashing
//  Credentials loaded from src/config.local.js (gitignored)
// ═══════════════════════════════════════════════════════════

const Auth = (() => {
  async function sha256(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function getSession() {
    try {
      const raw = localStorage.getItem(CONFIG.auth.sessionKey);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (Date.now() > session.expires) {
        localStorage.removeItem(CONFIG.auth.sessionKey);
        return null;
      }
      return session;
    } catch (e) {
      return null;
    }
  }

  function setSession(username) {
    const session = {
      user: username,
      expires: Date.now() + CONFIG.auth.sessionDuration,
      created: Date.now(),
    };
    localStorage.setItem(CONFIG.auth.sessionKey, JSON.stringify(session));
  }

  function clearSession() {
    localStorage.removeItem(CONFIG.auth.sessionKey);
  }

  async function login(username, password) {
    const creds = CONFIG.auth.credentials;

    // If no local config found, auth is disabled — allow through with warning
    if (!creds) {
      console.warn('[GODS EYE] No credentials found in config.local.js — auth bypassed.');
      setSession(username || 'OPERATOR');
      return { success: true };
    }

    const userHash = await sha256(username.toLowerCase().trim());
    const passHash = await sha256(password);

    if (userHash === creds.usernameHash && passHash === creds.passwordHash) {
      setSession(username);
      return { success: true };
    }
    return { success: false, error: 'AUTHENTICATION FAILED — INVALID CREDENTIALS' };
  }

  function isAuthenticated() {
    if (!CONFIG.auth.enabled) return true;
    // If no credentials configured, auth is bypassed
    if (!CONFIG.auth.credentials) return true;
    return getSession() !== null;
  }

  function logout() {
    clearSession();
    window.location.reload();
  }

  function getUser() {
    const session = getSession();
    return session ? session.user : null;
  }

  return { login, isAuthenticated, logout, getUser, sha256 };
})();
