import { useEffect, useState } from 'react';
import {
  LABEL_PUSH,
  getNotifichePushConfig,
  setNotificaPushToggle,
  setDryRunGlobale,
  type ChiavePushAppuntamento,
} from '../lib/notifichePushConfig';
import { Toast, type ToastTipo } from './Toast';

const CHIAVI: ChiavePushAppuntamento[] = [
  'appuntamento_nuovo',
  'appuntamento_confermato',
  'appuntamento_cancellato',
  'appuntamento_spostato',
  'appuntamento_pending',
];

export function NotifichePushAppuntamenti() {
  const [notifiche, setNotifiche] = useState<Record<ChiavePushAppuntamento, boolean> | null>(null);
  const [dryRun, setDryRun] = useState<boolean>(true);
  const [salvando, setSalvando] = useState<ChiavePushAppuntamento | '_global' | null>(null);
  const [toast, setToast] = useState<{ message: string; tipo: ToastTipo } | null>(null);

  useEffect(() => {
    async function carica() {
      try {
        const cfg = await getNotifichePushConfig();
        setNotifiche(cfg.notifiche);
        setDryRun(cfg.dry_run_globale);
      } catch (e: any) {
        setToast({ message: '❌ ' + (e.message || 'Errore caricamento'), tipo: 'error' });
      }
    }
    carica();
  }, []);

  async function toggleNotifica(chiave: ChiavePushAppuntamento, nuovo: boolean) {
    if (!notifiche) return;
    const precedente = notifiche[chiave];
    setNotifiche({ ...notifiche, [chiave]: nuovo });
    setSalvando(chiave);
    try {
      await setNotificaPushToggle(chiave, nuovo);
      setToast({ message: `✅ ${LABEL_PUSH[chiave].label} ${nuovo ? 'attivata' : 'disattivata'}`, tipo: 'success' });
    } catch (e: any) {
      setNotifiche({ ...notifiche, [chiave]: precedente });
      setToast({ message: '❌ ' + (e.message || 'Errore salvataggio'), tipo: 'error' });
    } finally {
      setSalvando(null);
    }
  }

  async function toggleDryRun(nuovo: boolean) {
    const precedente = dryRun;
    setDryRun(nuovo);
    setSalvando('_global');
    try {
      await setDryRunGlobale(nuovo);
      setToast({
        message: nuovo ? '🧪 Dry-run attivato — nessun invio reale' : '⚠️ Dry-run disattivato — invio REALE',
        tipo: nuovo ? 'success' : 'error',
      });
    } catch (e: any) {
      setDryRun(precedente);
      setToast({ message: '❌ ' + (e.message || 'Errore salvataggio'), tipo: 'error' });
    } finally {
      setSalvando(null);
    }
  }

  if (!notifiche) {
    return (
      <div className="bg-white rounded-apple shadow-apple p-6 text-center text-apple-gray text-sm">
        Caricamento notifiche push...
      </div>
    );
  }

  return (
    <>
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-apple p-5 shadow-apple">
        <div className="flex items-start gap-3 mb-4">
          <span className="text-2xl">🔔</span>
          <div>
            <h3 className="text-sm font-bold text-apple-darkgray">
              Notifiche Push Appuntamenti
            </h3>
            <p className="text-xs text-apple-gray mt-1 leading-relaxed">
              Configura quali eventi sugli appuntamenti generano notifiche push al cliente
              nella sua <strong>App Cliente</strong>.
            </p>
          </div>
        </div>

        {/* Dry-run globale */}
        <div className={`rounded-apple p-3 mb-4 border-2 ${dryRun ? 'bg-purple-50 border-purple-300' : 'bg-amber-50 border-amber-300'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-lg">🧪</span>
                <span className="text-sm font-bold text-apple-darkgray">Modalità Dry-Run globale</span>
              </div>
              <p className="text-[11px] text-apple-gray mt-1 leading-relaxed">
                {dryRun
                  ? '✅ Attiva: le notifiche vengono registrate nei log ma NON inviate al cliente. Perfetto per testare.'
                  : '⚠️ Disattiva: le notifiche vengono inviate DAVVERO al cliente. Verifica prima in dry-run!'}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => toggleDryRun(e.target.checked)}
                disabled={salvando === '_global'}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border after:border-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>
        </div>

        {/* Toggle 5 eventi */}
        <div className="bg-white rounded-apple p-3 space-y-1">
          {CHIAVI.map((chiave) => {
            const info = LABEL_PUSH[chiave];
            const enabled = notifiche[chiave];
            return (
              <label
                key={chiave}
                className="flex items-start justify-between gap-3 py-2.5 px-2 rounded-apple hover:bg-gray-50 cursor-pointer"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{info.icona}</span>
                    <span className="text-sm font-medium text-apple-darkgray">{info.label}</span>
                  </div>
                  <p className="text-[11px] text-apple-gray mt-0.5 ml-7">{info.descrizione}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {salvando === chiave && <span className="text-xs text-apple-gray animate-pulse">💾</span>}
                  <button
                    type="button"
                    onClick={() => toggleNotifica(chiave, !enabled)}
                    disabled={salvando === chiave}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      enabled ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          tipo={toast.tipo}
          onComplete={() => setToast(null)}
        />
      )}
    </>
  );
}
