import { useEffect, useState } from 'react';
import {
  isPasswordImpostata,
  impostaPassword,
  rimuoviPassword,
} from '../lib/sicurezza';
import { inviaCodiceReset, resetPasswordGestionale } from '../lib/resetSicurezza';
import { Button } from './Button';

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
      <div className="bg-white rounded-apple shadow-apple p-6 sm:p-8 text-center">
        <p className="text-apple-gray text-sm">Caricamento...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-apple shadow-apple p-4 sm:p-6">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-apple bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white text-xl sm:text-2xl shrink-0">
            🔐
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-apple-darkgray">
              Password Gestionale
            </h2>
            <p className="text-xs text-apple-gray mt-1 leading-relaxed">
              La password protegge le operazioni critiche: annullo scontrini,
              annullo fatture, storni e altre azioni che modificano documenti fiscali.
            </p>
            <div className="mt-3">
              {passwordImpostata ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 text-green-700 text-[11px] sm:text-xs font-semibold">
                  ✅ Password impostata
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-[11px] sm:text-xs font-semibold">
                  ⚠️ Nessuna password impostata
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-apple shadow-apple p-4 sm:p-6">
        <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-3 sm:mb-4">
          {passwordImpostata ? '🔁 Cambia password' : '➕ Imposta password'}
        </h3>

        <div className="space-y-3 sm:space-y-4">
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
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white border border-gray-200 rounded-apple text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue/30"
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
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white border border-gray-200 rounded-apple text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue/30"
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
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white border border-gray-200 rounded-apple text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue/30"
            />
          </div>

          {errore && (
            <div className="bg-red-50 border border-red-200 rounded-apple p-3 text-red-700 text-xs sm:text-sm">
              ❌ {errore}
            </div>
          )}
          {successo && (
            <div className="bg-green-50 border border-green-200 rounded-apple p-3 text-green-700 text-xs sm:text-sm">
              {successo}
            </div>
          )}

          <div className="pt-2">
            <Button
              variant="primary"
              size="md"
              onClick={handleSalva}
              disabled={salvando || !nuovaPassword || !confermaPassword}
              className="w-full sm:w-auto"
            >
              {salvando
                ? '⏳ Salvataggio...'
                : passwordImpostata
                ? '🔁 Aggiorna password'
                : '💾 Imposta password'}
            </Button>
          </div>

          {passwordImpostata && (
            <div className="pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowReset(true)}
                className="text-xs text-apple-blue hover:underline font-medium"
              >
                🔐 Password dimenticata? Reimposta via email
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Zona rimozione */}
      {passwordImpostata && (
        <div className="bg-white rounded-apple shadow-apple p-4 sm:p-6 border border-red-200/60">
          <h3 className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">
            ⚠️ Zona pericolosa
          </h3>
          <p className="text-xs text-apple-gray mb-3">
            Rimuovendo la password, le operazioni critiche non richiederanno più alcuna conferma.
            Sconsigliato in produzione.
          </p>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setShowRimuovi(true)}
            className="!bg-red-50 !text-red-600 hover:!bg-red-100 !shadow-none !border !border-red-200"
          >
            🔓 Rimuovi password
          </Button>
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
            className="bg-white rounded-apple shadow-apple-lg max-w-sm w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-5">
              <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto mb-3 rounded-full bg-blue-100 flex items-center justify-center text-xl sm:text-2xl">
                {faseReset === 'email' ? '📧' : '🔢'}
              </div>
              <h2 className="text-base sm:text-lg font-bold text-apple-darkgray mb-2">
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
                  className="w-full px-3 py-3 bg-gray-50 border border-gray-200 rounded-apple text-xl sm:text-2xl font-mono tracking-[0.4em] sm:tracking-[0.5em] text-center focus:outline-none focus:ring-2 focus:ring-apple-blue/30"
                />
              </div>
            )}

            {erroreReset && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-apple p-3 text-red-700 text-xs">
                ❌ {erroreReset}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Button
                variant="secondary"
                size="md"
                fullWidth
                onClick={() => {
                  setShowReset(false);
                  setFaseReset('email');
                  setCodiceReset('');
                  setErroreReset(null);
                }}
                disabled={inviandoReset || verificandoReset}
              >
                Annulla
              </Button>
              {faseReset === 'email' ? (
                <Button
                  variant="primary"
                  size="md"
                  fullWidth
                  onClick={handleInviaCodiceReset}
                  disabled={inviandoReset}
                >
                  {inviandoReset ? '⏳ Invio...' : '📧 Invia codice'}
                </Button>
              ) : (
                <Button
                  variant="success"
                  size="md"
                  fullWidth
                  onClick={handleVerificaReset}
                  disabled={verificandoReset || codiceReset.length !== 6}
                >
                  {verificandoReset ? '⏳ Verifica...' : '✅ Verifica e resetta'}
                </Button>
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
            className="bg-white rounded-apple shadow-apple-lg max-w-sm w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-5">
              <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto mb-3 rounded-full bg-red-100 flex items-center justify-center text-xl sm:text-2xl">
                ⚠️
              </div>
              <h2 className="text-base sm:text-lg font-bold text-apple-darkgray mb-2">
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
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Button
                variant="secondary"
                size="md"
                fullWidth
                onClick={() => {
                  setShowRimuovi(false);
                  setPasswordRimuovi('');
                  setErrore(null);
                }}
                disabled={rimuovendo}
              >
                Annulla
              </Button>
              <Button
                variant="danger"
                size="md"
                fullWidth
                onClick={handleRimuovi}
                disabled={rimuovendo || !passwordRimuovi}
              >
                {rimuovendo ? '⏳...' : '🔓 Rimuovi'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
