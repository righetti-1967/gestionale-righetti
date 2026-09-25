import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getLogoUrl } from '../lib/logo';

export function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [conferma, setConferma] = useState('');
  const [errore, setErrore] = useState<string | null>(null);
  const [successo, setSuccesso] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mostraPassword, setMostraPassword] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrore(null);

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
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccesso(true);
      setTimeout(() => navigate('/'), 3000);
    } catch (e: any) {
      setErrore(e.message || 'Errore durante l\'aggiornamento della password');
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
              Nuova Password
            </h1>
            <p className="text-sm text-apple-gray mt-1">Imposta la tua nuova password</p>
          </div>

          {!successo ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-apple-darkgray mb-1">
                  Nuova password (almeno 8 caratteri)
                </label>
                <div className="relative">
                  <input
                    type={mostraPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    disabled={loading}
                    className="w-full px-3.5 py-2.5 pr-10 rounded-apple bg-apple-lightgray border border-transparent text-apple-darkgray placeholder:text-apple-gray text-sm focus:outline-none focus:bg-white focus:border-apple-blue transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setMostraPassword(!mostraPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-apple-gray hover:text-apple-darkgray text-base"
                    tabIndex={-1}
                  >
                    {mostraPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-apple-darkgray mb-1">
                  Conferma nuova password
                </label>
                <input
                  type={mostraPassword ? 'text' : 'password'}
                  value={conferma}
                  onChange={(e) => setConferma(e.target.value)}
                  required
                  placeholder="Ripeti la password"
                  disabled={loading}
                  className="w-full px-3.5 py-2.5 rounded-apple bg-apple-lightgray border border-transparent text-apple-darkgray placeholder:text-apple-gray text-sm focus:outline-none focus:bg-white focus:border-apple-blue transition-all"
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
                disabled={loading || !password || !conferma}
                className="w-full py-2.5 px-4 rounded-apple bg-apple-blue text-white font-medium text-sm hover:bg-apple-blue/90 active:scale-[0.99] disabled:opacity-50 transition-all shadow-apple"
              >
                {loading ? 'Salvataggio…' : 'Salva nuova password'}
              </button>
            </form>
          ) : (
            <div className="text-center py-4 space-y-3">
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center text-3xl mx-auto border border-green-200">
                ✅
              </div>
              <h2 className="text-lg font-semibold text-apple-darkgray">
                Password aggiornata!
              </h2>
              <p className="text-xs text-apple-gray">
                Reindirizzamento al gestionale in corso...
              </p>
              <Link
                to="/"
                className="inline-block py-2 px-5 rounded-apple bg-apple-blue text-white text-xs font-semibold hover:bg-blue-600 transition-colors shadow-apple"
              >
                Vai al gestionale
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
