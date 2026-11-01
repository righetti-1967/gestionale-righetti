import { useEffect, useState } from 'react';
import {
  caricaEconomia,
  salvaEconomia,
  calcolaCostoMensile,
  calcolaCostoOrario,
  ECONOMIA_DEFAULT,
  type ConfigEconomia,
  type EconomiaOperatore,
} from '../lib/economia';
import { caricaAgendaConfig, type OperatoreConfig } from '../lib/agenda-config';
import { Toast, type ToastTipo } from './Toast';

interface EconomiaTabProps {
  registraSalva: (fn: () => void, salvando: boolean) => void;
}

const CATEGORIE_DISPONIBILI = [
  'Affitto', 'Mutuo', 'Utenze', 'Stipendi', 'Contributi', 'Tasse',
  'Assicurazioni', 'Consulenze', 'Software', 'Manutenzione',
];

export function EconomiaTab({ registraSalva }: EconomiaTabProps) {
  const [config, setConfig] = useState<ConfigEconomia>(ECONOMIA_DEFAULT);
  const [operatoriAgenda, setOperatoriAgenda] = useState<OperatoreConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; tipo: ToastTipo } | null>(null);

  useEffect(() => {
    async function carica() {
      setLoading(true);
      try {
        const [eco, agenda] = await Promise.all([
          caricaEconomia(),
          caricaAgendaConfig(),
        ]);
        // Inizializza operatori da agenda-config
        const operatoriEsistenti = new Map(eco.operatori.map((o) => [o.operatore_id, o]));
        const operatoriAllineati: EconomiaOperatore[] = (agenda.operatori || []).map((op) => {
          return operatoriEsistenti.get(op.id) || {
            operatore_id: op.id,
            tipo: 'dipendente' as const,
            busta_paga_lorda: 0,
            busta_paga_netta: 0,
            contributi_pct: 30,
            contributi_fissi_mensili: 0,
            tfr_pct: 7,
            ore_settimanali: 40,
            giorni_settimanali: 5,
            note: '',
          };
        });
        setOperatoriAgenda(agenda.operatori || []);
        setConfig({ ...eco, operatori: operatoriAllineati });
      } catch (e: any) {
        setToast({ message: '❌ ' + (e?.message || 'Errore'), tipo: 'error' });
      } finally {
        setLoading(false);
      }
    }
    carica();
  }, []);

  async function handleSalva() {
    try {
      await salvaEconomia(config);
      setToast({ message: '✅ Configurazione economia salvata', tipo: 'success' });
    } catch (e: any) {
      setToast({ message: '❌ ' + (e?.message || 'Errore'), tipo: 'error' });
    }
  }

  useEffect(() => {
    registraSalva(handleSalva, false);
  }, [config]);

  function aggiornaOperatore(id: string, patch: Partial<EconomiaOperatore>) {
    setConfig((prev) => ({
      ...prev,
      operatori: prev.operatori.map((o) =>
        o.operatore_id === id ? { ...o, ...patch } : o
      ),
    }));
  }

  function toggleCategoriaFissa(cat: string) {
    setConfig((prev) => {
      const set = new Set(prev.costi_fissi.categorie_fisse);
      if (set.has(cat)) set.delete(cat);
      else set.add(cat);
      return {
        ...prev,
        costi_fissi: { ...prev.costi_fissi, categorie_fisse: Array.from(set) },
      };
    });
  }

  if (loading) {
    return <div className="p-8 text-center text-sm text-apple-gray">Caricamento…</div>;
  }

  return (
    <div className="space-y-4">
      {/* Sezione Operatori */}
      <div className="bg-white rounded-apple shadow-apple p-4 sm:p-6">
        <h3 className="text-sm font-bold text-apple-darkgray mb-4">
          👥 Costi Operatori
        </h3>
        <p className="text-xs text-apple-gray mb-4">
          Configura busta paga, contributi e orari per ogni operatore. Il costo orario viene calcolato automaticamente.
        </p>

        {config.operatori.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-apple p-4 text-xs text-amber-800">
            ⚠️ Nessun operatore configurato. Vai in <strong>Impostazioni → Agenda</strong> per aggiungere operatori.
          </div>
        ) : (
          <div className="space-y-4">
            {config.operatori.map((op) => {
              const opConfig = operatoriAgenda.find((o) => o.id === op.operatore_id);
              const label = opConfig?.label || op.operatore_id;
              const costoMensile = calcolaCostoMensile(op);
              const costoOrario = calcolaCostoOrario(op);

              return (
                <div key={op.operatore_id} className="border border-gray-200 rounded-apple p-4">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <h4 className="text-sm font-bold text-apple-darkgray">👤 {label}</h4>
                    <div className="text-xs text-apple-gray">
                      Costo mensile: <span className="font-bold text-red-600">€{costoMensile.toFixed(2)}</span>
                      {' · '}
                      Costo orario: <span className="font-bold text-red-600">€{costoOrario.toFixed(2)}/h</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-apple-gray uppercase mb-1">Tipo</label>
                      <select
                        value={op.tipo}
                        onChange={(e) => aggiornaOperatore(op.operatore_id, { tipo: e.target.value as any })}
                        className="w-full px-3 py-2 rounded-apple bg-gray-50 border border-gray-200 text-sm"
                      >
                        <option value="dipendente">Dipendente</option>
                        <option value="titolare">Titolare</option>
                        <option value="collaboratore">Collaboratore</option>
                      </select>
                    </div>

                    {op.tipo === 'titolare' ? (
                      <>
                        <div>
                          <label className="block text-[10px] font-semibold text-apple-gray uppercase mb-1">Netto mensile (€)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={op.busta_paga_netta || ''}
                            onChange={(e) => aggiornaOperatore(op.operatore_id, { busta_paga_netta: parseFloat(e.target.value) || 0 })}
                            className="w-full px-3 py-2 rounded-apple bg-gray-50 border border-gray-200 text-sm"
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-apple-gray uppercase mb-1">Contributi fissi mensili (€)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={op.contributi_fissi_mensili || ''}
                            onChange={(e) => aggiornaOperatore(op.operatore_id, { contributi_fissi_mensili: parseFloat(e.target.value) || 0 })}
                            className="w-full px-3 py-2 rounded-apple bg-gray-50 border border-gray-200 text-sm"
                            placeholder="0.00"
                          />
                          <p className="text-[9px] text-apple-gray mt-0.5 italic">
                            ℹ️ Quota INPS fissa mensile (artigiani/commercianti)
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="block text-[10px] font-semibold text-apple-gray uppercase mb-1">Busta paga lorda (€/mese)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={op.busta_paga_lorda || ''}
                            onChange={(e) => aggiornaOperatore(op.operatore_id, { busta_paga_lorda: parseFloat(e.target.value) || 0 })}
                            className="w-full px-3 py-2 rounded-apple bg-gray-50 border border-gray-200 text-sm"
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-apple-gray uppercase mb-1">Busta paga netta (€/mese)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={op.busta_paga_netta || ''}
                            onChange={(e) => aggiornaOperatore(op.operatore_id, { busta_paga_netta: parseFloat(e.target.value) || 0 })}
                            className="w-full px-3 py-2 rounded-apple bg-gray-50 border border-gray-200 text-sm"
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-apple-gray uppercase mb-1">
                            Contributi INPS (%)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={op.contributi_pct || ''}
                            onChange={(e) => aggiornaOperatore(op.operatore_id, { contributi_pct: parseFloat(e.target.value) || 0 })}
                            className="w-full px-3 py-2 rounded-apple bg-gray-50 border border-gray-200 text-sm"
                            placeholder={op.tipo === 'collaboratore' ? '35' : '30'}
                          />
                          <p className="text-[9px] text-apple-gray mt-0.5 italic">
                            {op.tipo === 'collaboratore'
                              ? 'ℹ️ Gestione separata: 35% (o 24% se pensionato)'
                              : 'ℹ️ Contributi a carico azienda: ~30%'}
                          </p>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-apple-gray uppercase mb-1">TFR (%)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={op.tfr_pct || ''}
                            onChange={(e) => aggiornaOperatore(op.operatore_id, { tfr_pct: parseFloat(e.target.value) || 0 })}
                            className="w-full px-3 py-2 rounded-apple bg-gray-50 border border-gray-200 text-sm"
                            placeholder="7"
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <label className="block text-[10px] font-semibold text-apple-gray uppercase mb-1">Ore settimanali</label>
                      <input
                        type="number"
                        step="0.5"
                        value={op.ore_settimanali || ''}
                        onChange={(e) => aggiornaOperatore(op.operatore_id, { ore_settimanali: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 rounded-apple bg-gray-50 border border-gray-200 text-sm"
                        placeholder="40"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-apple-gray uppercase mb-1">Giorni settimanali</label>
                      <input
                        type="number"
                        step="0.5"
                        value={op.giorni_settimanali || ''}
                        onChange={(e) => aggiornaOperatore(op.operatore_id, { giorni_settimanali: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 rounded-apple bg-gray-50 border border-gray-200 text-sm"
                        placeholder="5"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-semibold text-apple-gray uppercase mb-1">Note</label>
                      <input
                        type="text"
                        value={op.note || ''}
                        onChange={(e) => aggiornaOperatore(op.operatore_id, { note: e.target.value })}
                        className="w-full px-3 py-2 rounded-apple bg-gray-50 border border-gray-200 text-sm"
                        placeholder="Es. Contratto a tempo indeterminato"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sezione Costi Fissi */}
      <div className="bg-white rounded-apple shadow-apple p-4 sm:p-6">
        <h3 className="text-sm font-bold text-apple-darkgray mb-2">
          🏢 Costi Fissi Azienda
        </h3>
        <p className="text-xs text-apple-gray mb-4">
          Seleziona le categorie di spesa che consideri FISSE (affitto, utenze, stipendi, ecc.).
          Queste verranno usate per calcolare il Break-Even.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
          {CATEGORIE_DISPONIBILI.map((cat) => {
            const isFissa = config.costi_fissi.categorie_fisse.includes(cat);
            return (
              <label
                key={cat}
                className={`flex items-center gap-2 px-3 py-2 rounded-apple border cursor-pointer transition-colors text-xs ${
                  isFissa
                    ? 'bg-blue-50 border-blue-300 text-blue-900 font-semibold'
                    : 'bg-white border-gray-200 text-apple-darkgray hover:bg-gray-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isFissa}
                  onChange={() => toggleCategoriaFissa(cat)}
                  className="w-3.5 h-3.5"
                />
                {cat}
              </label>
            );
          })}
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-apple-gray uppercase mb-1">
            Aliquota contributiva titolare (%)
          </label>
          <input
            type="number"
            step="0.1"
            value={config.costi_fissi.aliquota_titolare_pct || ''}
            onChange={(e) =>
              setConfig((prev) => ({
                ...prev,
                costi_fissi: { ...prev.costi_fissi, aliquota_titolare_pct: parseFloat(e.target.value) || 0 },
              }))
            }
            className="w-32 px-3 py-2 rounded-apple bg-gray-50 border border-gray-200 text-sm"
            placeholder="26"
          />
          <p className="text-[10px] text-apple-gray mt-1 italic">
            ℹ️ Percentuale contributi che il titolare versa (es. 26% per artigiani/commercianti)
          </p>
        </div>
      </div>

      {toast && <Toast message={toast.message} tipo={toast.tipo} onComplete={() => setToast(null)} />}
    </div>
  );
}
