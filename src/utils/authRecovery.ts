type RecoveryCredentials = { access_token: string; refresh_token: string };
let recovery: RecoveryCredentials | null = null;

// Run before Supabase initializes its persistent browser session. The recovery
// grant stays in memory and is used only by the password reset page.
export function captureRecoveryLink() {
  const fields = new URLSearchParams(window.location.hash.slice(1));
  if (fields.get('type') !== 'recovery') return;
  const access_token = fields.get('access_token');
  const refresh_token = fields.get('refresh_token');
  recovery = access_token && refresh_token ? { access_token, refresh_token } : null;
  window.history.replaceState(null, '', '#/recuperar');
}

export function takeRecoveryCredentials() {
  const credentials = recovery;
  recovery = null;
  return credentials;
}

export function hasRecoveryCredentials() {
  return recovery !== null;
}

captureRecoveryLink();
