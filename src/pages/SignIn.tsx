import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function SignIn() {
  const { sendMagicLink, signInWithPassword, verifyCode } = useAuth();
  const { theme, setTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(() => new URLSearchParams(window.location.search).get('auth_error'));
  const [busy, setBusy] = useState(false);

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="card w-full max-w-md p-6 sm:p-8">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-3xl font-semibold tracking-tight">MPT</p>
            <p className="mt-1 text-sm text-muted">Personal finance for one owner.</p>
          </div>
          <button type="button" className="btn-ghost" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>
        <form
          className="mt-8 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            setBusy(true);
            void sendMagicLink(email.trim()).then((error) => {
              setBusy(false);
              setMessage(error ?? 'Check your email for a sign-in link.');
            });
          }}
        >
          <label>
            <span className="label">Email</span>
            <input className="field" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            Email me a link
          </button>
        </form>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setBusy(true);
            void verifyCode(email.trim(), code.trim()).then((error) => {
              setBusy(false);
              setMessage(error ?? null);
            });
          }}
        >
          <label className="flex-1">
            <span className="sr-only">Email code</span>
            <input className="field" inputMode="numeric" placeholder="Email code" value={code} onChange={(event) => setCode(event.target.value)} aria-label="Email code" />
          </label>
          <button type="submit" className="btn-ghost" disabled={busy}>
            Use code
          </button>
        </form>
        <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wide text-muted">
          <span className="h-px flex-1 bg-line" />
          or password
          <span className="h-px flex-1 bg-line" />
        </div>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            setBusy(true);
            void signInWithPassword(email.trim(), password).then((error) => {
              setBusy(false);
              setMessage(error);
            });
          }}
        >
          <label>
            <span className="label">Password</span>
            <input className="field" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          <button type="submit" className="btn-ghost w-full" disabled={busy}>
            Sign in
          </button>
        </form>
        {message ? <p className="mt-4 text-sm text-muted">{message}</p> : null}
        <p className="mt-6 text-xs text-muted">New accounts are not created here. Ask the project owner to add the email in Supabase first.</p>
      </div>
    </div>
  );
}
