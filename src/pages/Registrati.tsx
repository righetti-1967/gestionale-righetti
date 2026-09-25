import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getLogoUrl } from '../lib/logo';

export function Registrati() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [conferma, setConferma] = useState('');
  const [nome, setNome] = useState('');
  const [azienda, setAzienda] = useState('');
  const [mostraPassword, setMostraPassword] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [successo, setSuccesso] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  async function handleGoogleSignUp() {
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
      setErrore(e.message || 'Errore durante la registrazione con Google');
      setLoadingGoogle(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrore(null);

    const emailTrim = email.trim().toLowerCase();
    if (!emailTrim || !password || !conferma || !nome.trim() || !azienda.trim()) {
      setErrore('Compila tutti i campi obbligatori');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrim)) {
      setErrore('Email non valida');
      return;
    }

    if (password.length < 8) {
      setErrore('La password deve avere almeno 8 caratteri');
      return;
    }

    if (password !== conferma) {
      setErrore('Le due password non coincidono');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: emailTrim,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: nome.trim(),
            azienda: azienda.trim(),
            ruolo: 'demo',
            demo_scadenza: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
          },
        },
      });

      if (error) {
        let msg = error.message;
        if (error.message.includes('already registered')) msg = 'Questa email è già registrata';
        else if (error.message.includes('rate limit')) msg = 'Troppi tentativi. Riprova tra qualche minuto.';
        else if (error.message.includes('invalid')) msg = 'Email non valida';
        setErrore(msg);
      } else {
        setSuccesso(true);
      }
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-apple-lightgray px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-apple shadow-apple-lg p-8 sm:p-10 border border-gray-200/60">
          <div className="flex flex-col items-center mb-6">
            <div className="w-20 h-20 flex items-center justify-center mb-3">
              <img
                src={getLogoUrl()}
                alt="Righetti Since 1967"
                className="w-20 h-20 object-contain mix-blend-multiply"
              />
            </div>
            <h1 className="text-2xl font-semibold text-apple-darkgray tracking-tight">
              Righetti Since 1967
            </h1>
            <p className="text-sm text-apple-gray mt-1">Crea il tuo account</p>
          </div>

          {!successo ? (
            <>
              {/* Pulsante Google SignUp */}
              <button
                type="button"
                onClick={handleGoogleSignUp}
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
                    <span>Registrati con Google</span>
                  </>
                )}
              </button>

              <div className="flex items-center mb-6">
                <div className="flex-1 border-t border-gray-200/60" />
                <span className="px-3 text-xs text-apple-gray uppercase tracking-wider font-medium">oppure con email</span>
                <div className="flex-1 border-t border-gray-200/60" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-apple-darkgray mb-1">
                    Nome completo *
                  </label>
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                    placeholder="Es. Mario Rossi"
                    disabled={loading || loadingGoogle}
                    className="w-full px-3.5 py-2 rounded-apple bg-apple-lightgray border border-transparent text-apple-darkgray placeholder:text-apple-gray text-sm focus:outline-none focus:bg-white focus:border-apple-blue transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-apple-darkgray mb-1">
                    Nome salone / studio *
                  </label>
                  <input
                    type="text"
                    value={azienda}
                    onChange={(e) => setAzienda(e.target.value)}
                    required
                    placeholder="Es. Salone Bellessere"
                    disabled={loading || loadingGoogle}
                    className="w-full px-3.5 py-2 rounded-apple bg-apple-lightgray border border-transparent text-apple-darkgray placeholder:text-apple-gray text-sm focus:outline-none focus:bg-white focus:border-apple-blue transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-apple-darkgray mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="nome@azienda.it"
                    disabled={loading || loadingGoogle}
                    className="w-full px-3.5 py-2 rounded-apple bg-apple-lightgray border border-transparent text-apple-darkgray placeholder:text-apple-gray text-sm focus:outline-none focus:bg-white focus:border-apple-blue transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-apple-darkgray mb-1">
                    Password * (almeno 8 caratteri)
                  </label>
                  <div className="relative">
                    <input
                      type={mostraPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      placeholder="••••••••"
                      disabled={loading || loadingGoogle}
                      className="w-full px-3.5 py-2 pr-10 rounded-apple bg-apple-lightgray border border-transparent text-apple-darkgray placeholder:text-apple-gray text-sm focus:outline-none focus:bg-white focus:border-apple-blue transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setMostraPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-apple-gray hover:text-apple-darkgray transition-colors text-base"
                      tabIndex={-1}
                      title={mostraPassword ? 'Nascondi' : 'Mostra'}
                    >
                      {mostraPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-apple-darkgray mb-1">
                    Conferma password *
                  </label>
                  <input
                    type={mostraPassword ? 'text' : 'password'}
                    value={conferma}
                    onChange={(e) => setConferma(e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder="Ripeti la password"
                    disabled={loading || loadingGoogle}
                    className="w-full px-3.5 py-2 rounded-apple bg-apple-lightgray border border-transparent text-apple-darkgray placeholder:text-apple-gray text-sm focus:outline-none focus:bg-white focus:border-apple-blue transition-all"
                  />
                </div>

                {errore && (
                  <div className="p-3 rounded-apple bg-red-50 border border-red-200 text-xs text-red-600 flex items-start gap-2">
                    <span>⚠️</span>
                    <span>{errore}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || loadingGoogle}
                  className="w-full py-2.5 px-4 rounded-apple bg-apple-blue text-white font-medium text-sm hover:bg-apple-blue/90 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-apple flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? (
                    <>
                      <span className="animate-spin text-base">⏳</span>
                      <span>Registrazione in corso…</span>
                    </>
                  ) : (
                    'Inizia la prova di 15 giorni'
                  )}
                </button>
              </form>

              <div className="mt-5 pt-5 border-t border-gray-100 text-center">
                <p className="text-xs text-apple-gray">
                  Hai già un account?{' '}
                  <Link to="/login" className="text-apple-blue hover:underline font-medium">
                    Accedi
                  </Link>
                </p>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center text-3xl mx-auto mb-4 border border-green-200">
                ✉️
              </div>
              <h2 className="text-xl font-bold text-apple-darkgray mb-2">
                Controlla la tua email
              </h2>
              <p className="text-xs text-apple-gray leading-relaxed mb-6">
                Abbiamo inviato un link di conferma a <strong className="text-apple-darkgray">{email}</strong>.<br />
                Clicca sul link per attivare la tua prova gratuita di 15 giorni.
              </p>
              <Link
                to="/login"
                className="inline-block py-2.5 px-6 rounded-apple bg-apple-blue text-white text-xs font-semibold hover:bg-blue-600 transition-colors shadow-apple"
              >
                Vai al login
              </Link>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-apple-gray mt-6">
          Studio Righetti Since 1967
        </p>
      </div>
    </div>
  );
}
