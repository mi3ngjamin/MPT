import type { EmailOtpType } from '@supabase/supabase-js';
import { supabase } from './supabase';

/**
 * Pull Supabase tokens out of the URL before HashRouter claims the hash.
 * Implicit magic links arrive as #access_token. PKCE uses ?code. A token-hash
 * template uses ?token_hash&type.
 */
export async function bootstrapAuthFromUrl(): Promise<void> {
  const url = new URL(window.location.href);
  const hash = url.hash.startsWith('#') ? url.hash.slice(1) : '';
  const hashParams = new URLSearchParams(hash);
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');
  const hashError = hashParams.get('error_description') || hashParams.get('error');

  if (accessToken || hashError) {
    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) rememberAuthError(error.message);
    } else if (hashError) {
      rememberAuthError(hashError);
    }
    const error = sessionStorage.getItem('mpt-auth-error');
    const search = error ? `?auth_error=${encodeURIComponent(error)}` : '';
    window.history.replaceState(null, '', `${url.pathname}${search}#/`);
    return;
  }

  const code = url.searchParams.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    url.searchParams.delete('code');
    if (error) url.searchParams.set('auth_error', error.message);
    const search = url.searchParams.toString();
    window.history.replaceState(null, '', `${url.pathname}${search ? `?${search}` : ''}#/`);
    return;
  }

  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });
    url.searchParams.delete('token_hash');
    url.searchParams.delete('type');
    if (error) url.searchParams.set('auth_error', error.message);
    const search = url.searchParams.toString();
    window.history.replaceState(null, '', `${url.pathname}${search ? `?${search}` : ''}#/`);
  }
}

function rememberAuthError(message: string) {
  sessionStorage.setItem('mpt-auth-error', message);
}
