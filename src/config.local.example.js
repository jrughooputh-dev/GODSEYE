// ═══════════════════════════════════════════════════════════
//  GODS EYE — LOCAL CONFIG (SENSITIVE — DO NOT COMMIT)
//  Copy this file to: src/config.local.js
//  Add src/config.local.js to your .gitignore
//  This file stays on your machine only.
// ═══════════════════════════════════════════════════════════

// To generate SHA-256 hashes for new credentials, run in browser console:
//   crypto.subtle.digest('SHA-256', new TextEncoder().encode('yourvalue'))
//     .then(h => Array.from(new Uint8Array(h)).map(b=>b.toString(16).padStart(2,'0')).join(''))

window.GODS_EYE_LOCAL = {
  auth: {
    usernameHash: 'PASTE_SHA256_OF_USERNAME_HERE',
    passwordHash:  'PASTE_SHA256_OF_PASSWORD_HERE',
  },
  aviationstack: {
    apiKey: 'PASTE_YOUR_AVIATIONSTACK_KEY_HERE',
  },
};
