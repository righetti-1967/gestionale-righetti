import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getLogoUrl } from '../lib/logo';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [errore, setErrore] = useState<string | null>(null);
  const [successo, setSuccesso] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrore(null);
    if (!email.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSuccesso(true);
    } catch (e: any) {
      const msg = String(e?.message || e || '').trim();
      setErrore(msg || 'Errore durante l\'invio del link di recupero. Riprova.');
      console.error('ForgotPassword errore:', e);
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
              Recupero Password
            </h1>
            <p className="text-sm text-apple-gray mt-1">Reimposta l'accesso al gestionale</p>
          </div>

          {!successo ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-xs text-apple-gray leading-relaxed mb-4">
                Inserisci l'indirizzo email associato al tuo account. Ti invieremo un link sicuro per reimpostare la tua password.
              </p>

              <div>
                <label htmlFor="email" className="block text-xs font-medium text-apple-darkgray mb-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="nome@azienda.it"
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
                disabled={loading || !email.trim()}
                className="w-full py-2.5 px-4 rounded-apple bg-apple-blue text-white font-medium text-sm hover:bg-apple-blue/90 active:scale-[0.99] disabled:opacity-50 transition-all shadow-apple flex items-center justify-center gap-2"
              >
                {loading ? 'Invio in corso…' : 'Invia link di recupero'}
              </button>

              <div className="text-center pt-2">
                <Link to="/login" className="text-xs text-apple-blue hover:underline font-medium">
                  ← Torna al login
                </Link>
              </div>
            </form>
          ) : (
            <div className="text-center py-4 space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center text-3xl mx-auto border border-green-200">
                ✉️
              </div>
              <h2 className="text-lg font-semibold text-apple-darkgray">
                Controlla la tua email
              </h2>
              <p className="text-xs text-apple-gray leading-relaxed">
                Abbiamo inviato le istruzioni di reset a <strong className="text-apple-darkgray">{email}</strong>.
              </p>
              <Link
                to="/login"
                className="inline-block py-2 px-5 rounded-apple bg-apple-blue text-white text-xs font-semibold hover:bg-blue-600 transition-colors shadow-apple"
              >
                Torna al login
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
