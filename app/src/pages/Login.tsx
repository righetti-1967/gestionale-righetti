import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { getLogoUrl } from '../lib/logo';

export function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errore, setErrore] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [mostraPassword, setMostraPassword] = useState(false);

  async function handleGoogleLogin() {
    setErrore(null);
    setLoadingGoogle(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      if (error) throw error;
    } catch (e: any) {
      setErrore(e.message || "Errore durante l'accesso con Google");
      setLoadingGoogle(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setErrore(null);
    setLoading(true);

    const { error } = await signIn(email.trim(), password);

    if (error) {
      let msg = error;
      if (error.includes('Invalid login credentials')) msg = 'Email o password non corretti';
      else if (error.includes('Email not confirmed')) msg = 'Email non confermata. Controlla la tua casella di posta.';
      else if (error.includes('Too many requests')) msg = 'Troppi tentativi. Riprova tra qualche minuto.';
      setErrore(msg);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-apple-lightgray px-4 py-8">
      <div className="w-full max-w-md">
        {/* Card Login */}
        <div className="bg-white rounded-apple shadow-apple-lg p-8 sm:p-10 border border-gray-200/60">
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 flex items-center justify-center mb-4">
              <img
                src={getLogoUrl()}
                alt="Righetti Since 1967"
                className="w-20 h-20 object-contain mix-blend-multiply"
              />
            </div>
            <h1 className="text-2xl font-semibold text-apple-darkgray tracking-tight">
              Righetti Since 1967
            </h1>
            <p className="text-sm text-apple-gray mt-1">Gestionale Studio & Salone</p>
          </div>

          {/* Pulsante Google Login */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading || loadingGoogle}
            className="w-full py-2.5 px-4 rounded-apple border border-gray-200/80 bg-white hover:bg-gray-50 text-apple-darkgray text-sm font-medium transition-colors flex items-center justify-center gap-3 shadow-sm disabled:opacity-50 mb-6"
          >
            {loadingGoogle ? (
              <>
                <span className="animate-spin text-base">⏳</span>
                <span>Connessione a Google...</span>
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.27-2.09 3.66-5.17 3.66-9.12z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.13C3.27 21.44 7.35 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.57H1.25C.45 8.16 0 9.97 0 12s.45 3.84 1.25 5.43l4.03-3.14z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.27 2.56 1.25 6.57l4.03 3.14c.95-2.83 3.6-4.96 6.72-4.96z"
                  />
                </svg>
                <span>Continua con Google</span>
              </>
            )}
          </button>

          {/* Separatore */}
          <div className="flex items-center mb-6">
            <div className="flex-1 border-t border-gray-200/60" />
            <span className="px-3 text-xs text-apple-gray uppercase tracking-wider font-medium">oppure</span>
            <div className="flex-1 border-t border-gray-200/60" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-apple-darkgray mb-1.5"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="nome@azienda.it"
                disabled={loading || loadingGoogle}
                className="w-full px-3.5 py-2.5 rounded-apple bg-apple-lightgray border border-transparent text-apple-darkgray placeholder:text-apple-gray text-sm focus:outline-none focus:bg-white focus:border-apple-blue transition-all"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-apple-darkgray mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={mostraPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  disabled={loading || loadingGoogle}
                  className="w-full px-3.5 py-2.5 pr-10 rounded-apple bg-apple-lightgray border border-transparent text-apple-darkgray placeholder:text-apple-gray text-sm focus:outline-none focus:bg-white focus:border-apple-blue transition-all"
                />
                <button
                  type="button"
                  onClick={() => setMostraPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-apple-gray hover:text-apple-darkgray transition-colors text-base"
                  tabIndex={-1}
                  title={mostraPassword ? 'Nascondi password' : 'Mostra password'}
                >
                  {mostraPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Link Password dimenticata */}
            <div className="text-right -mt-1">
              <Link
                to="/forgot-password"
                className="text-xs text-apple-blue hover:underline font-medium"
              >
                Password dimenticata?
              </Link>
            </div>

            {errore && (
              <div className="p-3 rounded-apple bg-red-50 border border-red-200 text-xs text-red-600 flex items-start gap-2">
                <span>⚠️</span>
                <span>{errore}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || loadingGoogle || !email.trim() || !password.trim()}
              className="w-full py-2.5 px-4 rounded-apple bg-apple-blue text-white font-medium text-sm hover:bg-apple-blue/90 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-apple flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="animate-spin text-base">⏳</span>
                  <span>Accesso in corso…</span>
                </>
              ) : (
                'Accedi'
              )}
            </button>
          </form>

          {/* Link Registrazione */}
          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
            <p className="text-xs text-apple-gray">
              Non hai ancora un account?{' '}
              <Link to="/registrati" className="text-apple-blue hover:underline font-medium">
                Registrati gratis
              </Link>
            </p>
            <p className="text-[10px] text-apple-gray mt-1.5">
              Prova 15 giorni gratis · Nessuna carta di credito richiesta
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-apple-gray mt-6">
          Studio Righetti Since 1967
        </p>
      </div>
    </div>
  );
}
