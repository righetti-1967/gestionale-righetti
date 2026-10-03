import { useEffect, useState } from 'react';
import {
  type RegimeFiscale,
  type ProviderFiscale,
  type ConfigFPT,
  type ConfigAdeDiretto,
  type ConfigRCH,
  type ConfigEpson,
  configVuota,
  getConfigFiscale,
  salvaConfigFiscale,
  eliminaConfigFiscale,
  verificaConfigProvider,
  labelRegime,
  labelProvider,
} from '../lib/configFiscale';
import { useDatiAziendali } from '../lib/useDatiAziendali';
import { Toast, type ToastTipo } from './Toast';

interface ModaleConfigFiscaleProps {
  regime: RegimeFiscale;
  onClose: () => void;
  onSaved?: () => void;
}

export function ModaleConfigFiscale({
  regime,
  onClose,
  onSaved,
}: ModaleConfigFiscaleProps) {
  const { dati: azienda } = useDatiAziendali();

  // Provider selezionato (default in base al regime)
  const providerDefault: ProviderFiscale =
    regime === 'scontrini_fisico' ? 'rch' : 'fpt';
  const [provider, setProvider] = useState<ProviderFiscale>(providerDefault);
  const [config, setConfig] = useState<Record<string, any>>(configVuota(providerDefault));
  const [configEsistente, setConfigEsistente] = useState(false);
  const [caricando, setCaricando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [esito, setEsito] = useState<{ ok: boolean; msg: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; tipo: ToastTipo } | null>(null);

  // Carica configurazione esistente
  useEffect(() => {
    let annullato = false;
    async function carica() {
      try {
        setCaricando(true);
        const cfg = await getConfigFiscale(regime);
        if (annullato) return;

        if (cfg) {
          setProvider(cfg.provider);
          setConfig({ ...configVuota(cfg.provider), ...cfg.config });
          setConfigEsistente(true);
        } else {
          // Pre-compila con dati aziendali se FPT
          const vuota = configVuota(providerDefault);
          if (providerDefault === 'fpt') {
            (vuota as ConfigFPT).ragione_sociale = azienda.ragioneSociale || '';
            (vuota as ConfigFPT).partita_iva = azienda.partitaIva || '';
          }
          setConfig(vuota);
        }
      } catch (err) {
        console.warn('Errore caricamento config fiscale:', err);
      } finally {
        if (!annullato) setCaricando(false);
      }
    }
    carica();
    return () => {
      annullato = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regime]);

  // Quando cambio provider, resetto i campi
  function cambiaProvider(nuovoProvider: ProviderFiscale) {
    setProvider(nuovoProvider);
    const vuota = configVuota(nuovoProvider);
    if (nuovoProvider === 'fpt') {
      (vuota as ConfigFPT).ragione_sociale = azienda.ragioneSociale || '';
      (vuota as ConfigFPT).partita_iva = azienda.partitaIva || '';
    }
    setConfig(vuota);
    setEsito(null);
  }

  function aggiorna<K extends string>(campo: K, valore: any) {
    setConfig((prev) => ({ ...prev, [campo]: valore }));
    setEsito(null);
  }

  async function handleVerifica() {
    setEsito(null);
    try {
      setVerificando(true);
      const res = await verificaConfigProvider({ provider, config });
      setEsito({ ok: res.ok, msg: res.messaggio });
    } catch (err: any) {
      setEsito({ ok: false, msg: err?.message || 'Errore verifica' });
    } finally {
      setVerificando(false);
    }
  }

  async function handleSalva() {
    try {
      setSalvando(true);
      await salvaConfigFiscale({
        regime,
        provider,
        config,
        attivo: false,
      });
      setConfigEsistente(true);
      setToast({ message: '✅ Configurazione salvata', tipo: 'success' });
      setTimeout(() => {
        onSaved?.();
        onClose();
      }, 800);
    } catch (err: any) {
      setToast({
        message: '❌ ' + (err?.message || 'Errore salvataggio'),
        tipo: 'error',
      });
    } finally {
      setSalvando(false);
    }
  }

  async function handleElimina() {
    if (!confirm('Eliminare la configurazione fiscale per questo regime?')) return;
    try {
      await eliminaConfigFiscale(regime);
      setConfigEsistente(false);
      const vuota = configVuota(providerDefault);
      if (providerDefault === 'fpt') {
        (vuota as ConfigFPT).ragione_sociale = azienda.ragioneSociale || '';
        (vuota as ConfigFPT).partita_iva = azienda.partitaIva || '';
      }
      setProvider(providerDefault);
      setConfig(vuota);
      setEsito(null);
      setToast({ message: '🗑️ Configurazione eliminata', tipo: 'success' });
    } catch (err: any) {
      setToast({
        message: '❌ ' + (err?.message || 'Errore eliminazione'),
        tipo: 'error',
      });
    }
  }

  function providersDisponibili(): Array<{ id: ProviderFiscale; label: string; icona: string; desc: string }> {
    if (regime === 'fatture' || regime === 'scontrini_digitale') {
      return [
        {
          id: 'fpt',
          label: 'Fatture Per Tutti (FPT)',
          icona: '🟢',
          desc: 'Invio automatico allo SDI tramite API FPT',
        },
        {
          id: 'ade_diretto',
          label: 'ADE Diretto (SDI)',
          icona: '🔵',
          desc: 'Genera XML, invio manuale via PEC o portale ADE',
        },
      ];
    }
    // scontrini_fisico
    return [
      {
        id: 'rch',
        label: 'RCH Registratore',
        icona: '🖨️',
        desc: 'Registratore telematico RCH (es. RCH 100, RCH 500)',
      },
      {
        id: 'epson',
        label: 'Epson 80mm',
        icona: '🖨️',
        desc: 'Stampante fiscale Epson (TM-T88, TM-m30)',
      },
    ];
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[80] overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-apple shadow-apple-lg w-full max-w-2xl my-8 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/60 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-apple-darkgray">
              ⚙️ Configurazione Fiscale
            </h2>
            <p className="text-xs text-apple-gray mt-0.5">
              {labelRegime(regime)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-apple-gray transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {caricando ? (
            <div className="py-12 text-center text-apple-gray text-sm">
              Caricamento...
            </div>
          ) : (
            <>
              {/* Step 1 — Provider */}
              <div>
                <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-3">
                  1️⃣ Scegli provider
                </h3>
                <div className="space-y-2">
                  {providersDisponibili().map((p) => (
                    <button
                      key={p.id}
                      onClick={() => cambiaProvider(p.id)}
                      className={`w-full text-left px-4 py-3 rounded-apple border-2 transition-all ${
                        provider === p.id
                          ? 'bg-blue-50 border-apple-blue shadow-sm'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-2xl shrink-0">{p.icona}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-apple-darkgray">
                              {p.label}
                            </p>
                            <p className="text-xs text-apple-gray mt-0.5">
                              {p.desc}
                            </p>
                          </div>
                        </div>
                        {provider === p.id && (
                          <span className="text-apple-blue text-xl shrink-0">✓</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 2 — Configurazione provider */}
              <div>
                <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-3">
                  2️⃣ Configura {labelProvider(provider)}
                </h3>

                {provider === 'fpt' && (
                  <FptConfig config={config as ConfigFPT} onChange={aggiorna} />
                )}
                {provider === 'ade_diretto' && (
                  <AdeDirettoConfig config={config as ConfigAdeDiretto} onChange={aggiorna} />
                )}
                {provider === 'rch' && (
                  <RCHConfig config={config as ConfigRCH} onChange={aggiorna} />
                )}
                {provider === 'epson' && (
                  <EpsonConfig config={config as ConfigEpson} onChange={aggiorna} />
                )}
              </div>

              {/* Esito verifica */}
              {esito && (
                <div
                  className={`rounded-apple p-3 text-sm flex items-start gap-2 ${
                    esito.ok
                      ? 'bg-green-50 text-green-800 border border-green-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}
                >
                  <span className="shrink-0">{esito.ok ? '✅' : '⚠️'}</span>
                  <span>{esito.msg}</span>
                </div>
              )}

              <p className="text-[11px] text-apple-gray italic bg-amber-50 border border-amber-200 rounded-apple p-3">
                💡 <strong>Nota:</strong> al momento le verifiche e gli invii sono in modalità
                <strong> MOCK</strong> (nessuna chiamata reale ai provider). L'integrazione
                vera verrà attivata in futuro tramite backend.
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap gap-2 px-6 py-4 border-t border-gray-200/60 bg-gray-50/50 shrink-0">
          {configEsistente && (
            <button
              onClick={handleElimina}
              disabled={salvando || verificando}
              className="px-4 py-2.5 bg-red-500 text-white rounded-apple font-semibold text-sm hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              🗑️ Elimina
            </button>
          )}
          <button
            onClick={handleVerifica}
            disabled={salvando || verificando}
            className="px-4 py-2.5 bg-white border border-apple-blue text-apple-blue rounded-apple font-semibold text-sm hover:bg-blue-50 transition-colors disabled:opacity-50"
          >
            {verificando ? '⏳ Verifica...' : '🔍 Verifica'}
          </button>
          <button
            onClick={onClose}
            disabled={salvando}
            className="px-4 py-2.5 bg-gray-100 text-apple-darkgray rounded-apple font-medium text-sm hover:bg-gray-200 transition-colors ml-auto"
          >
            Annulla
          </button>
          <button
            onClick={handleSalva}
            disabled={salvando}
            className="px-4 py-2.5 bg-apple-blue text-white rounded-apple font-semibold text-sm hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {salvando ? '⏳...' : '💾 Salva configurazione'}
          </button>
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          tipo={toast.tipo}
          onComplete={() => setToast(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// CONFIG FORMS PER PROVIDER
// ============================================================

function FptConfig({
  config,
  onChange,
}: {
  config: ConfigFPT;
  onChange: (campo: string, valore: any) => void;
}) {
  return (
    <div className="space-y-3">
      <Campo
        label="Ragione sociale"
        value={config.ragione_sociale || ''}
        onChange={(v) => onChange('ragione_sociale', v)}
      />
      <Campo
        label="Partita IVA"
        value={config.partita_iva || ''}
        onChange={(v) => onChange('partita_iva', v)}
      />
      <Campo
        label="Api key"
        value={config.api_key || ''}
        onChange={(v) => onChange('api_key', v)}
        monospace
      />
      <Campo
        label="Password"
        type="password"
        value={config.password || ''}
        onChange={(v) => onChange('password', v)}
        monospace
      />
      <div>
        <label className="block text-xs font-medium text-apple-gray mb-1.5">
          Ambiente
        </label>
        <select
          value={config.ambiente || 'test'}
          onChange={(e) => onChange('ambiente', e.target.value)}
          className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-apple text-sm text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/30"
        >
          <option value="test">🧪 Test (sandbox)</option>
          <option value="produzione">🚀 Produzione</option>
        </select>
      </div>
    </div>
  );
}

function AdeDirettoConfig({
  config,
  onChange,
}: {
  config: ConfigAdeDiretto;
  onChange: (campo: string, valore: any) => void;
}) {
  return (
    <div className="space-y-3">
      <Campo
        label="Codice SDI (destinatario)"
        value={config.codice_sdi || ''}
        onChange={(v) => onChange('codice_sdi', v.toUpperCase())}
        placeholder="es. 0000000 o M5UXCR1"
        monospace
        help="Codice a 7 caratteri. Usa 0000000 se non hai codice SDI."
      />
      <Campo
        label="PEC (alternativa a Codice SDI)"
        value={config.pec || ''}
        onChange={(v) => onChange('pec', v)}
        placeholder="es. azienda@pec.it"
        monospace
      />
      <div>
        <label className="block text-xs font-medium text-apple-gray mb-1.5">
          Regime fiscale
        </label>
        <select
          value={config.regime_fiscale || 'ordinario'}
          onChange={(e) => onChange('regime_fiscale', e.target.value)}
          className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-apple text-sm text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/30"
        >
          <option value="ordinario">Ordinario</option>
          <option value="forfettario">Forfettario</option>
        </select>
      </div>
    </div>
  );
}

function RCHConfig({
  config,
  onChange,
}: {
  config: ConfigRCH;
  onChange: (campo: string, valore: any) => void;
}) {
  return (
    <div className="space-y-3">
      <Campo
        label="Modello RCH"
        value={config.modello || ''}
        onChange={(v) => onChange('modello', v)}
        placeholder="es. RCH 500, RCH 100"
      />
      <Campo
        label="IP stampante"
        value={config.ip || ''}
        onChange={(v) => onChange('ip', v)}
        placeholder="es. 192.168.1.50"
        monospace
      />
      <Campo
        label="Porta"
        type="number"
        value={String(config.porta || 9100)}
        onChange={(v) => onChange('porta', parseInt(v) || 9100)}
        monospace
        help="Default: 9100 (porta standard stampanti di rete)"
      />
      <Campo
        label="Matricola RT (per ADE)"
        value={config.matricola_rt || ''}
        onChange={(v) => onChange('matricola_rt', v)}
        monospace
      />
      <Campo
        label="Numero seriale"
        value={config.seriale || ''}
        onChange={(v) => onChange('seriale', v)}
        monospace
      />
    </div>
  );
}

function EpsonConfig({
  config,
  onChange,
}: {
  config: ConfigEpson;
  onChange: (campo: string, valore: any) => void;
}) {
  return (
    <div className="space-y-3">
      <Campo
        label="Modello Epson"
        value={config.modello || ''}
        onChange={(v) => onChange('modello', v)}
        placeholder="es. TM-T88VI, TM-m30"
      />
      <Campo
        label="IP stampante"
        value={config.ip || ''}
        onChange={(v) => onChange('ip', v)}
        placeholder="es. 192.168.1.60"
        monospace
      />
      <Campo
        label="Porta"
        type="number"
        value={String(config.porta || 9100)}
        onChange={(v) => onChange('porta', parseInt(v) || 9100)}
        monospace
        help="Default: 9100"
      />
      <Campo
        label="Matricola RT (per ADE)"
        value={config.matricola_rt || ''}
        onChange={(v) => onChange('matricola_rt', v)}
        monospace
      />
      <Campo
        label="Numero seriale"
        value={config.seriale || ''}
        onChange={(v) => onChange('seriale', v)}
        monospace
      />
    </div>
  );
}

// ============================================================
// HELPER
// ============================================================

function Campo({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  monospace,
  help,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  monospace?: boolean;
  help?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-apple-gray mb-1.5">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all ${
          monospace ? 'font-mono' : ''
        }`}
      />
      {help && <p className="text-[10px] text-apple-gray mt-1">{help}</p>}
    </div>
  );
}
