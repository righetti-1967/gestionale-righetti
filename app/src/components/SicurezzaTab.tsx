import { useEffect, useState } from 'react';
import {
  isPasswordImpostata,
  impostaPassword,
  rimuoviPassword,
} from '../lib/sicurezza';
import { inviaCodiceReset, resetPasswordGestionale } from '../lib/resetSicurezza';

export function SicurezzaTab() {
  const [caricando, setCaricando] = useState(true);
  const [passwordImpostata, setPasswordImpostata] = useState(false);

  // Form
  const [vecchiaPassword, setVecchiaPassword] = useState('');
  const [nuovaPassword, setNuovaPassword] = useState('');
  const [confermaPassword, setConfermaPassword] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [successo, setSuccesso] = useState<string | null>(null);

  // Modale rimuovi
  const [showRimuovi, setShowRimuovi] = useState(false);
  const [passwordRimuovi, setPasswordRimuovi] = useState('');
  const [rimuovendo, setRimuovendo] = useState(false);

  // Modale reset via email
  const [showReset, setShowReset] = useState(false);
  const [faseReset, setFaseReset] = useState<'email' | 'codice'>('email');
  const [codiceReset, setCodiceReset] = useState('');
  const [inviandoReset, setInviandoReset] = useState(false);
  const [verificandoReset, setVerificandoReset] = useState(false);
  const [erroreReset, setErroreReset] = useState<string | null>(null);

  useEffect(() => {
    async function carica() {
      try {
        const ok = await isPasswordImpostata();
        setPasswordImpostata(ok);
      } catch (err) {
        console.error(err);
      } finally {
        setCaricando(false);
      }
    }
    carica();
  }, []);

  function resetForm() {
    setVecchiaPassword('');
    setNuovaPassword('');
    setConfermaPassword('');
    setErrore(null);
  }

  async function handleSalva() {
    setErrore(null);
    setSuccesso(null);

    if (nuovaPassword.length < 4) {
      setErrore('La nuova password deve avere almeno 4 caratteri');
      return;
    }
    if (nuovaPassword !== confermaPassword) {
      setErrore('Le password non coincidono');
      return;
    }
    if (passwordImpostata && !vecchiaPassword) {
      setErrore('Inserisci la password attuale');
      return;
    }

    try {
      setSalvando(true);
      await impostaPassword(
        nuovaPassword,
        passwordImpostata ? vecchiaPassword : undefined
      );
      setPasswordImpostata(true);
      setSuccesso(
        passwordImpostata
          ? '✅ Password aggiornata con successo'
          : '✅ Password impostata con successo'
      );
      resetForm();
    } catch (err: any) {
      setErrore(err?.message || 'Errore salvataggio');
    } finally {
      setSalvando(false);
    }
  }

  async function handleInviaCodiceReset() {
    setErroreReset(null);
    try {
      setInviandoReset(true);
      await inviaCodiceReset();
      setFaseReset('codice');
    } catch (err: any) {
      setErroreReset(err?.message || 'Errore invio codice');
    } finally {
      setInviandoReset(false);
    }
  }

  async function handleVerificaReset() {
    setErroreReset(null);
    if (codiceReset.trim().length !== 6) {
      setErroreReset('Il codice deve avere 6 cifre');
      return;
    }
    try {
      setVerificandoReset(true);
      await resetPasswordGestionale(codiceReset.trim());
      setPasswordImpostata(false);
      setShowReset(false);
      setFaseReset('email');
      setCodiceReset('');
      setSuccesso('✅ Password gestionale rimossa. Impostane una nuova.');
    } catch (err: any) {
      setErroreReset(err?.message || 'Errore verifica codice');
    } finally {
      setVerificandoReset(false);
    }
  }

  async function handleRimuovi() {
    setErrore(null);
    try {
      setRimuovendo(true);
      // Verifica password
      const { verificaPassword } = await import('../lib/sicurezza');
      const ok = await verificaPassword(passwordRimuovi);
      if (!ok) {
        setErrore('Password non corretta');
        return;
      }
      await rimuoviPassword();
      setPasswordImpostata(false);
      setShowRimuovi(false);
      setPasswordRimuovi('');
      setSuccesso('✅ Password rimossa');
    } catch (err: any) {
      setErrore(err?.message || 'Errore rimozione');
    } finally {
      setRimuovendo(false);
    }
  }

  if (caricando) {
    return (
      <div className="bg-white rounded-apple shadow-apple p-8 text-center">
        <p className="text-apple-gray text-sm">Caricamento...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-apple shadow-apple p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-apple bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white text-2xl shrink-0">
            🔐
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-apple-darkgray">
              Password Gestionale
            </h2>
            <p className="text-xs text-apple-gray mt-1">
              La password protegge le operazioni critiche: annullo scontrini,
              annullo fatture, storni e altre azioni che modificano documenti fiscali.
            </p>
            <div className="mt-3">
              {passwordImpostata ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                  ✅ Password impostata
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                  ⚠️ Nessuna password impostata
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-apple shadow-apple p-6">
        <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-4">
          {passwordImpostata ? '🔁 Cambia password' : '➕ Imposta password'}
        </h3>

        <div className="space-y-4">
          {passwordImpostata && (
            <div>
              <label className="block text-xs font-medium text-apple-gray mb-1.5">
                Password attuale <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={vecchiaPassword}
                onChange={(e) => setVecchiaPassword(e.target.value)}
                placeholder="Inserisci password attuale"
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-apple text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue/30"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-apple-gray mb-1.5">
              Nuova password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={nuovaPassword}
              onChange={(e) => setNuovaPassword(e.target.value)}
              placeholder="Almeno 4 caratteri"
              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-apple text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue/30"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-apple-gray mb-1.5">
              Conferma nuova password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={confermaPassword}
              onChange={(e) => setConfermaPassword(e.target.value)}
              placeholder="Ripeti la password"
              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-apple text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue/30"
            />
          </div>

          {errore && (
            <div className="bg-red-50 border border-red-200 rounded-apple p-3 text-red-700 text-sm">
              ❌ {errore}
            </div>
          )}
          {successo && (
            <div className="bg-green-50 border border-green-200 rounded-apple p-3 text-green-700 text-sm">
              {successo}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleSalva}
              disabled={salvando || !nuovaPassword || !confermaPassword}
              className="flex-1 px-4 py-2.5 bg-apple-blue text-white rounded-apple font-medium text-sm hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {salvando
                ? '⏳ Salvataggio...'
                : passwordImpostata
                ? '🔁 Aggiorna password'
                : '💾 Imposta password'}
            </button>
          </div>

          {passwordImpostata && (
            <div className="pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowReset(true)}
                className="w-full text-center text-xs text-apple-blue hover:underline font-medium"
              >
                🔐 Password dimenticata? Reimposta via email
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Zona rimozione */}
      {passwordImpostata && (
        <div className="bg-white rounded-apple shadow-apple p-6 border border-red-200/60">
          <h3 className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">
            ⚠️ Zona pericolosa
          </h3>
          <p className="text-xs text-apple-gray mb-3">
            Rimuovendo la password, le operazioni critiche non richiederanno più alcuna conferma.
            Sconsigliato in produzione.
          </p>
          <button
            type="button"
            onClick={() => setShowRimuovi(true)}
            className="px-4 py-2 bg-red-50 text-red-600 rounded-apple font-medium text-sm hover:bg-red-100 transition-colors"
          >
            🔓 Rimuovi password
          </button>
        </div>
      )}

      {/* Modale reset via email */}
      {showReset && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[80]"
          onClick={() => {
            if (!inviandoReset && !verificandoReset) {
              setShowReset(false);
              setFaseReset('email');
              setCodiceReset('');
              setErroreReset(null);
            }
          }}
        >
          <div
            className="bg-white rounded-apple shadow-apple-lg max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-5">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-blue-100 flex items-center justify-center text-2xl">
                {faseReset === 'email' ? '📧' : '🔢'}
              </div>
              <h2 className="text-lg font-bold text-apple-darkgray mb-2">
                {faseReset === 'email'
                  ? 'Reimposta password gestionale'
                  : 'Inserisci il codice'}
              </h2>
              <p className="text-xs text-apple-gray leading-relaxed">
                {faseReset === 'email'
                  ? 'Riceverai un codice a 6 cifre alla tua email account. Il codice scade dopo 10 minuti.'
                  : 'Controlla la tua casella email e inserisci il codice ricevuto.'}
              </p>
            </div>

            {faseReset === 'codice' && (
              <div className="mb-4">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={codiceReset}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setCodiceReset(v);
                  }}
                  placeholder="000000"
                  autoFocus
                  className="w-full px-3 py-3 bg-gray-50 border border-gray-200 rounded-apple text-2xl font-mono tracking-[0.5em] text-center focus:outline-none focus:ring-2 focus:ring-apple-blue/30"
                />
              </div>
            )}

            {erroreReset && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-apple p-3 text-red-700 text-xs">
                ❌ {erroreReset}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowReset(false);
                  setFaseReset('email');
                  setCodiceReset('');
                  setErroreReset(null);
                }}
                disabled={inviandoReset || verificandoReset}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-apple-darkgray rounded-apple font-medium text-sm hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Annulla
              </button>
              {faseReset === 'email' ? (
                <button
                  onClick={handleInviaCodiceReset}
                  disabled={inviandoReset}
                  className="flex-1 px-4 py-2.5 bg-apple-blue text-white rounded-apple font-medium text-sm hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {inviandoReset ? '⏳ Invio...' : '📧 Invia codice'}
                </button>
              ) : (
                <button
                  onClick={handleVerificaReset}
                  disabled={verificandoReset || codiceReset.length !== 6}
                  className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-apple font-medium text-sm hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {verificandoReset ? '⏳ Verifica...' : '✅ Verifica e resetta'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modale rimuovi */}
      {showRimuovi && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[70]"
          onClick={() => setShowRimuovi(false)}
        >
          <div
            className="bg-white rounded-apple shadow-apple-lg max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-5">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-red-100 flex items-center justify-center text-2xl">
                ⚠️
              </div>
              <h2 className="text-lg font-bold text-apple-darkgray mb-2">
                Rimuovere la password?
              </h2>
              <p className="text-xs text-apple-gray mb-4">
                Inserisci la password attuale per confermare.
              </p>
              <input
                type="password"
                value={passwordRimuovi}
                onChange={(e) => setPasswordRimuovi(e.target.value)}
                placeholder="Password attuale"
                autoFocus
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-apple text-sm focus:outline-none focus:ring-2 focus:ring-red-300/40"
              />
              {errore && (
                <p className="text-xs text-red-600 mt-2 text-center">{errore}</p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRimuovi(false);
                  setPasswordRimuovi('');
                  setErrore(null);
                }}
                disabled={rimuovendo}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-apple-darkgray rounded-apple font-medium text-sm hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Annulla
              </button>
              <button
                onClick={handleRimuovi}
                disabled={rimuovendo || !passwordRimuovi}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-apple font-medium text-sm hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {rimuovendo ? '⏳...' : '🔓 Rimuovi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
