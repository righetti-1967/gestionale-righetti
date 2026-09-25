import { useState, useEffect } from 'react';
import type { Percorso } from '../lib/percorsi';
import type { Cliente } from '../lib/clienti';
import type { ResiduoPercorso } from '../lib/percorsi-helper';
import { creaScarico, type RigaScarico, type ScaricoSeduta } from '../lib/scarichi';
import { getProdotti, type Prodotto } from '../lib/prodotti';
import { getServizi, type Servizio } from '../lib/servizi';
import { creaMovimento } from '../lib/magazzino';

interface FormScaricoSedutaProps {
  percorso: Percorso;
  cliente: Cliente | null;
  residuo: ResiduoPercorso;
  fatturaIncassata: boolean;
  vociIniziali?: Array<{
    tipo: 'servizio' | 'prodotto';
    servizio_id: number | null;
    prodotto_id: number | null;
    quantita: number;
  }>;
  onClose: () => void;
  onSuccess: (scarico: ScaricoSeduta) => void;
}

interface ScomposizioneProdotto {
  prodottoIdReale: number;
  quantita: number;
}

interface VoceExtra {
  id: string;
  tipo: 'prodotto' | 'servizio';
  itemId: number;
  quantita: number;
}

const IVA = 0.22;

function isProdottoCute(nome: string): boolean {
  return nome.toLowerCase().includes('prodotto cute');
}

export function FormScaricoSeduta({
  percorso,
  cliente,
  residuo,
  fatturaIncassata,
  vociIniziali,
  onClose,
  onSuccess,
}: FormScaricoSedutaProps) {
  const [quantitaDaScaricare, setQuantitaDaScaricare] = useState<Record<string, number>>({});
  const [flaconiSelezionati, setFlaconiSelezionati] = useState<Record<string, number[]>>({});
  const [prodottiCatalogo, setProdottiCatalogo] = useState<Prodotto[]>([]);
  const [serviziCatalogo, setServiziCatalogo] = useState<Servizio[]>([]);
  const [vociExtra, setVociExtra] = useState<VoceExtra[]>([]);
  const [dataSeduta, setDataSeduta] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getProdotti(), getServizi()])
      .then(([prod, serv]) => {
        setProdottiCatalogo(prod);
        setServiziCatalogo(serv);

        // Se arrivano voci dall'Agenda, le precompila automaticamente nel form!
        if (vociIniziali && vociIniziali.length > 0) {
          const precompilate: Record<string, number> = {};
          for (const v of vociIniziali) {
            const chiave = v.tipo === 'servizio' ? `S-${v.servizio_id}` : `P-${v.prodotto_id}`;
            const rigaRes = residuo.righe_residue.find(
              (r) => r.tipo === v.tipo && (r.servizio_id === v.servizio_id || r.prodotto_id === v.prodotto_id)
            );
            if (rigaRes && rigaRes.quantita_residua > 0) {
              precompilate[chiave] = Math.min(v.quantita, rigaRes.quantita_residua);
            }
          }
          setQuantitaDaScaricare(precompilate);
        }
      })
      .catch((err) => console.error('Errore caricamento cataloghi:', err));
  }, [vociIniziali, residuo]);

  const prodottiShampoo = prodottiCatalogo.filter((p) =>
    p.nome.trim().toUpperCase().startsWith('SH')
  );
  const listaProdottiOpzioni = prodottiShampoo.length > 0 ? prodottiShampoo : prodottiCatalogo;

  if (!fatturaIncassata) {
    return (
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-apple shadow-apple-lg max-w-md w-full p-6 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center text-2xl">
            🔒
          </div>
          <h2 className="text-lg font-bold text-apple-darkgray mb-2">
            Scarico non consentito
          </h2>
          <p className="text-sm text-apple-gray mb-6">
            Puoi scaricare solo da percorsi la cui fattura è stata{' '}
            <strong>pagata e registrata</strong>. Registra prima l'incasso della proforma.
          </p>
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-gray-100 text-apple-darkgray rounded-apple font-medium text-sm hover:bg-gray-200 transition-colors"
          >
            Chiudi
          </button>
        </div>
      </div>
    );
  }

  const righeDisponibili = residuo.righe_residue.filter((r) => r.quantita_residua > 0);

  function chiaveRiga(r: { tipo: 'servizio' | 'prodotto'; servizio_id: number | null; prodotto_id: number | null }): string {
    return r.tipo === 'servizio' ? `S-${r.servizio_id}` : `P-${r.prodotto_id}`;
  }

  function aggiornaQuantita(chiave: string, valore: string, max: number, riga: typeof righeDisponibili[0]) {
    const n = parseInt(valore, 10);
    const q = isNaN(n) || n < 0 ? 0 : Math.min(n, max);

    setQuantitaDaScaricare((prev) => ({ ...prev, [chiave]: q }));

    if (riga.tipo === 'prodotto' && isProdottoCute(riga.nome)) {
      setFlaconiSelezionati((prev) => {
        const arrAttuale = prev[chiave] || [];
        if (q === 0) {
          const copia = { ...prev };
          delete copia[chiave];
          return copia;
        }
        if (q > arrAttuale.length) {
          const nuoveCaselle = Array(q - arrAttuale.length).fill(0);
          return { ...prev, [chiave]: [...arrAttuale, ...nuoveCaselle] };
        } else {
          return { ...prev, [chiave]: arrAttuale.slice(0, q) };
        }
      });
    }
  }

  function impostaShampooSlot(chiave: string, slotIndex: number, prodottoId: number) {
    setFlaconiSelezionati((prev) => {
      const arr = [...(prev[chiave] || [])];
      arr[slotIndex] = prodottoId;
      return { ...prev, [chiave]: arr };
    });
  }

  function aggiungiVoceExtra(tipo: 'prodotto' | 'servizio') {
    const primoId = tipo === 'prodotto' ? prodottiCatalogo[0]?.id ?? 0 : serviziCatalogo[0]?.id ?? 0;
    setVociExtra((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(7),
        tipo,
        itemId: primoId,
        quantita: 1,
      },
    ]);
  }

  function modificaVoceExtra(id: string, campo: 'itemId' | 'quantita', valore: number) {
    setVociExtra((prev) =>
      prev.map((v) => (v.id === id ? { ...v, [campo]: valore } : v))
    );
  }

  function rimuoviVoceExtra(id: string) {
    setVociExtra((prev) => prev.filter((v) => v.id !== id));
  }

  const qualcosaDaScaricare =
    Object.values(quantitaDaScaricare).some((q) => q > 0) || vociExtra.length > 0;

  async function handleSubmit() {
    if (!percorso.fattura_id) {
      setErrore('Percorso non fatturato');
      return;
    }
    if (!dataSeduta) {
      setErrore('Inserisci la data della seduta');
      return;
    }
    if (!qualcosaDaScaricare) {
      setErrore('Inserisci almeno una voce da scaricare o una voce extra');
      return;
    }

    for (const r of righeDisponibili) {
      if (r.tipo === 'prodotto' && isProdottoCute(r.nome)) {
        const chiave = chiaveRiga(r);
        const qTotale = quantitaDaScaricare[chiave] || 0;
        if (qTotale > 0) {
          const slots = flaconiSelezionati[chiave] || [];
          const tuttiScelti = slots.length === qTotale && slots.every((id) => id > 0);
          if (!tuttiScelti) {
            setErrore(`Seleziona lo shampoo per ciascuno dei ${qTotale} flaconi di "${r.nome}".`);
            return;
          }
        }
      }
    }

    try {
      setSalvando(true);
      setErrore(null);

      const righe: RigaScarico[] = [];
      const scontoPercorso = percorso.sconto_percentuale || 0;

      for (const r of righeDisponibili) {
        const chiave = chiaveRiga(r);
        const quantita = quantitaDaScaricare[chiave] || 0;
        if (quantita <= 0) continue;

        const rigaOriginale = (percorso.righe || []).find((rp) => {
          if (rp.tipo !== r.tipo) return false;
          if (rp.tipo === 'servizio') return rp.servizio_id === r.servizio_id;
          return rp.prodotto_id === r.prodotto_id;
        });

        if (r.tipo === 'servizio') {
          righe.push({
            tipo: 'servizio',
            servizio_id: r.servizio_id,
            prodotto_id: null,
            nome: r.nome,
            quantita,
            prezzo_listino_lordo: rigaOriginale?.prezzo_listino_lordo || 0,
            prezzo_scontato_lordo: rigaOriginale?.prezzo_scontato_lordo || 0,
            netto_iva_scontato: rigaOriginale?.netto_iva_scontato || 0,
          });
        } else if (isProdottoCute(r.nome)) {
          const slots = flaconiSelezionati[chiave] || [];
          const conteggi = new Map<number, number>();
          for (const pId of slots) {
            conteggi.set(pId, (conteggi.get(pId) || 0) + 1);
          }

          for (const [prodIdReale, quantitaScelta] of conteggi.entries()) {
            const prodReale = prodottiCatalogo.find((p) => p.id === prodIdReale);
            const nomeReale = prodReale ? prodReale.nome : r.nome;

            const prezzoListinoReale =
              rigaOriginale?.prezzo_listino_lordo && rigaOriginale.prezzo_listino_lordo > 0
                ? Number(rigaOriginale.prezzo_listino_lordo)
                : Number(prodReale?.prezzo_lordo || 0);

            const prezzoScontatoReale = Number(
              (prezzoListinoReale * (1 - scontoPercorso / 100)).toFixed(2)
            );
            const nettoIvaReale = Number((prezzoScontatoReale / (1 + IVA)).toFixed(2));

            righe.push({
              tipo: 'prodotto',
              servizio_id: null,
              prodotto_id: prodIdReale,
              prodotto_percorso_id: r.prodotto_id,
              nome: nomeReale,
              quantita: quantitaScelta,
              prezzo_listino_lordo: prezzoListinoReale,
              prezzo_scontato_lordo: prezzoScontatoReale,
              netto_iva_scontato: nettoIvaReale,
            });
          }
        } else {
          const prezzoListino = Number(rigaOriginale?.prezzo_listino_lordo || 0);
          const prezzoScontato = Number(rigaOriginale?.prezzo_scontato_lordo || 0);
          const nettoIva = Number(rigaOriginale?.netto_iva_scontato || 0);

          righe.push({
            tipo: 'prodotto',
            servizio_id: null,
            prodotto_id: r.prodotto_id,
            prodotto_percorso_id: r.prodotto_id,
            nome: r.nome,
            quantita,
            prezzo_listino_lordo: prezzoListino,
            prezzo_scontato_lordo: prezzoScontato,
            netto_iva_scontato: nettoIva,
          });
        }
      }

      for (const extra of vociExtra) {
        if (extra.quantita <= 0) continue;
        if (extra.tipo === 'prodotto') {
          const prod = prodottiCatalogo.find((p) => p.id === extra.itemId);
          const nomeBase = prod ? prod.nome : 'Prodotto Extra';
          const listino = Number(prod?.prezzo_lordo || 0);

          righe.push({
            tipo: 'prodotto',
            servizio_id: null,
            prodotto_id: extra.itemId,
            prodotto_percorso_id: null,
            nome: `${nomeBase} (EXTRA Percorso)`,
            quantita: extra.quantita,
            prezzo_listino_lordo: listino,
            prezzo_scontato_lordo: 0,
            netto_iva_scontato: 0,
          });
        } else {
          const serv = serviziCatalogo.find((s) => s.id === extra.itemId);
          const nomeBase = serv ? serv.nome : 'Servizio Extra';
          const listino = Number(serv?.prezzo_lordo || 0);

          righe.push({
            tipo: 'servizio',
            servizio_id: extra.itemId,
            prodotto_id: null,
            prodotto_percorso_id: null,
            nome: `${nomeBase} (EXTRA Percorso)`,
            quantita: extra.quantita,
            prezzo_listino_lordo: listino,
            prezzo_scontato_lordo: 0,
            netto_iva_scontato: 0,
          });
        }
      }

      const totaleLordo = righe.reduce((sum, r) => sum + r.quantita * r.prezzo_scontato_lordo, 0);
      const totaleNetto = righe.reduce((sum, r) => sum + r.quantita * r.netto_iva_scontato, 0);

      const nuovoScarico = await creaScarico({
        fattura_madre_id: percorso.fattura_id,
        cliente_id: percorso.cliente_id,
        data_seduta: dataSeduta,
        righe,
        totale_lordo_scontato: Number(totaleLordo.toFixed(2)),
        totale_netto_iva: Number(totaleNetto.toFixed(2)),
        note: note.trim() || null,
      });

      for (const riga of righe) {
        if (riga.tipo === 'prodotto' && riga.prodotto_id) {
          try {
            await creaMovimento({
              prodotto_id: riga.prodotto_id,
              tipo: 'scarico',
              quantita: riga.quantita,
              motivo: `DDT n.${nuovoScarico.numero_ddt} • ${cliente?.nome_cognome || 'Cliente'}`,
              note: `Scarico: ${riga.nome}`,
              data_movimento: dataSeduta,
            });
          } catch (errMag) {
            console.error('Errore aggiornamento magazzino:', errMag);
          }
        }
      }

      onSuccess(nuovoScarico);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrore(msg || 'Errore nel salvataggio');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-[60] overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white sm:rounded-apple rounded-t-3xl shadow-apple-lg w-full sm:max-w-2xl max-h-[95vh] sm:my-8 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-200/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-apple bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white text-xl shrink-0">
              📋
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-apple-darkgray">
                Scarico Seduta
              </h2>
              <p className="text-xs text-apple-gray truncate">
                {percorso.nome} {cliente && `• ${cliente.nome_cognome}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-apple-gray transition-colors shrink-0"
            aria-label="Chiudi"
          >
            ✕
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6"
        >
          <div>
            <label className="block text-xs font-semibold text-apple-gray uppercase tracking-wide mb-1.5">
              Data seduta <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={dataSeduta}
              onChange={(e) => setDataSeduta(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/30 transition-all"
            />
          </div>

          <div>
            <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-3">
              🛠️📦 Voci del Percorso da Scaricare
            </h3>

            {righeDisponibili.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-apple p-4 text-xs text-amber-700">
                Tutte le voci del percorso sono state completamente scaricate.
              </div>
            ) : (
              <div className="space-y-3">
                {righeDisponibili.map((r) => {
                  const chiave = chiaveRiga(r);
                  const qScaricare = quantitaDaScaricare[chiave] || 0;
                  const slots = flaconiSelezionati[chiave] || [];
                  const rigaCute = r.tipo === 'prodotto' && isProdottoCute(r.nome);
                  const residuoDinamico = Math.max(0, r.quantita_residua - qScaricare);

                  return (
                    <div
                      key={chiave}
                      className="p-3 bg-gray-50 rounded-apple border border-gray-200 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-apple-darkgray truncate">
                            {r.tipo === 'servizio' ? '🛠️' : '📦'} {r.nome}
                          </p>

                          <p className="text-xs text-apple-gray mt-0.5">
                            {qScaricare > 0 ? (
                              <span className="inline-flex items-center gap-1.5 text-apple-blue font-semibold">
                                Rimarranno: <strong className="text-apple-darkgray font-bold text-sm">{residuoDinamico}</strong> di {r.quantita_totale}
                                <span className="text-[10px] bg-blue-100 text-apple-blue px-1.5 py-0.5 rounded-full font-bold">
                                  −{qScaricare}
                                </span>
                              </span>
                            ) : (
                              <span>
                                Disponibili: <strong>{r.quantita_residua}</strong> di {r.quantita_totale}
                              </span>
                            )}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <label className="text-xs font-medium text-apple-gray">Scarica:</label>
                          <input
                            type="number"
                            min="0"
                            max={r.quantita_residua}
                            step="1"
                            value={qScaricare || ''}
                            placeholder="0"
                            onChange={(e) =>
                              aggiornaQuantita(chiave, e.target.value, r.quantita_residua, r)
                            }
                            className="w-16 px-2 py-1.5 bg-white border border-gray-200 rounded-apple text-sm text-center font-bold text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/30"
                          />
                        </div>
                      </div>

                      {rigaCute && qScaricare > 0 && (
                        <div className="pt-2 border-t border-gray-200/80 space-y-2.5">
                          <p className="text-[11px] font-bold text-apple-blue uppercase tracking-wide">
                            🧴 Seleziona i {qScaricare} flaconi di shampoo da consegnare:
                          </p>

                          <div className="space-y-2">
                            {Array.from({ length: qScaricare }).map((_, idx) => {
                              const selectedId = slots[idx] || 0;
                              return (
                                <div key={idx} className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-apple-gray w-20 shrink-0">
                                    Flacone {idx + 1}:
                                  </span>
                                  <select
                                    value={selectedId || ''}
                                    onChange={(e) =>
                                      impostaShampooSlot(chiave, idx, Number(e.target.value) || 0)
                                    }
                                    className={`flex-1 px-3 py-2 bg-white border rounded-apple text-xs font-medium transition-all ${
                                      !selectedId
                                        ? 'border-amber-300 text-amber-700 bg-amber-50/30 focus:ring-amber-300'
                                        : 'border-gray-200 text-apple-darkgray focus:ring-apple-blue/30'
                                    }`}
                                  >
                                    <option value="">— Seleziona Shampoo —</option>
                                    {listaProdottiOpzioni.map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.nome} (€ {Number(p.prezzo_lordo).toFixed(2)} - Giacenza: {p.giacenza})
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              );
                            })}
                          </div>

                          {slots.some((id) => !id || id === 0) && (
                            <p className="text-[11px] text-amber-600 font-medium">
                              ⚠️ Seleziona uno shampoo per ciascuno dei {qScaricare} flaconi prima di salvare.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-amber-800 uppercase tracking-wide">
                  🎁 Voci EXTRA Percorso (Fuori Contratto)
                </h3>
                <p className="text-[11px] text-apple-gray">
                  Voci concesse in più: scaricano il magazzino reale e non appaiono nel Documento di Competenza.
                </p>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => aggiungiVoceExtra('prodotto')}
                  className="px-2.5 py-1.5 bg-amber-50 text-amber-800 hover:bg-amber-100 rounded-apple text-xs font-semibold transition-colors"
                >
                  + Prodotto Extra
                </button>
                <button
                  type="button"
                  onClick={() => aggiungiVoceExtra('servizio')}
                  className="px-2.5 py-1.5 bg-purple-50 text-purple-800 hover:bg-purple-100 rounded-apple text-xs font-semibold transition-colors"
                >
                  + Servizio Extra
                </button>
              </div>
            </div>

            {vociExtra.length > 0 && (
              <div className="space-y-2">
                {vociExtra.map((extra) => (
                  <div
                    key={extra.id}
                    className="p-2.5 bg-amber-50/60 rounded-apple border border-amber-200/80 flex items-center gap-2"
                  >
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 shrink-0">
                      EXTRA {extra.tipo}
                    </span>

                    <div className="flex-1 min-w-0">
                      {extra.tipo === 'prodotto' ? (
                        <select
                          value={extra.itemId}
                          onChange={(e) => modificaVoceExtra(extra.id, 'itemId', Number(e.target.value))}
                          className="w-full px-2 py-1.5 bg-white border border-amber-200 rounded-apple text-xs font-medium text-apple-darkgray"
                        >
                          {prodottiCatalogo.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nome} (Giacenza: {p.giacenza})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <select
                          value={extra.itemId}
                          onChange={(e) => modificaVoceExtra(extra.id, 'itemId', Number(e.target.value))}
                          className="w-full px-2 py-1.5 bg-white border border-amber-200 rounded-apple text-xs font-medium text-apple-darkgray"
                        >
                          {serviziCatalogo.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.nome}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="w-16 shrink-0">
                      <input
                        type="number"
                        min="1"
                        value={extra.quantita}
                        onChange={(e) =>
                          modificaVoceExtra(extra.id, 'quantita', Math.max(1, parseInt(e.target.value) || 1))
                        }
                        className="w-full px-2 py-1.5 bg-white border border-amber-200 rounded-apple text-xs font-bold text-center"
                        title="Quantità concessa"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => rimuoviVoceExtra(extra.id)}
                      className="w-7 h-7 rounded-full text-red-500 hover:bg-red-50 flex items-center justify-center shrink-0 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-apple-gray uppercase tracking-wide mb-1.5">
              Note (opzionali)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note sulla seduta o sulle concessioni extra..."
              rows={2}
              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/30 resize-none"
            />
          </div>

          {errore && (
            <div className="bg-red-50 border border-red-200 rounded-apple p-3 text-red-700 text-sm">
              ❌ {errore}
            </div>
          )}
        </form>

        <div className="flex gap-3 px-5 sm:px-6 py-4 border-t border-gray-200/60 bg-gray-50/50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-gray-100 text-apple-darkgray rounded-apple font-medium text-sm hover:bg-gray-200 transition-colors"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={salvando || !qualcosaDaScaricare || (righeDisponibili.length === 0 && vociExtra.length === 0)}
            className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-apple font-medium text-sm hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {salvando ? 'Salvataggio...' : 'Registra Scarico'}
          </button>
        </div>
      </div>
    </div>
  );
}
