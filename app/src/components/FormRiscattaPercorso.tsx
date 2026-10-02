import { useEffect, useMemo, useState } from 'react';
import type { Percorso } from '../lib/percorsi';
import type { Cliente } from '../lib/clienti';
import {
  calcolaResiduo,
  formatEuro,
  type ResiduoPercorso,
} from '../lib/percorsi-helper';
import { getProdotti, type Prodotto } from '../lib/prodotti';
import { getServizi, type Servizio } from '../lib/servizi';
import { creaScontrinoFiglio, getRigheRiscattateDaFigli } from '../lib/scontrini-figli';
import { Toast, type ToastTipo } from './Toast';

interface VociIniziale {
  tipo: 'servizio' | 'prodotto';
  servizio_id: number | null;
  prodotto_id: number | null;
  quantita: number;
}

interface FormRiscattaPercorsoProps {
  percorso: Percorso;
  cliente: Cliente | null;
  vociIniziali?: VociIniziale[];
  onClose: () => void;
  onSuccess: () => void;
}

interface QuantitaState {
  [chiave: string]: number;
}

function chiaveRiga(r: { tipo: 'servizio' | 'prodotto'; servizio_id: number | null; prodotto_id: number | null }): string {
  return r.tipo === 'servizio' ? `S-${r.servizio_id}` : `P-${r.prodotto_id}`;
}

export function FormRiscattaPercorso({
  percorso,
  cliente,
  vociIniziali,
  onClose,
  onSuccess,
}: FormRiscattaPercorsoProps) {
  const [quantita, setQuantita] = useState<QuantitaState>({});
  const [residuo, setResiduo] = useState<ResiduoPercorso | null>(null);
  const [prodotti, setProdotti] = useState<Prodotto[]>([]);
  const [servizi, setServizi] = useState<Servizio[]>([]);
  const [caricando, setCaricando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tipo: ToastTipo } | null>(null);

  useEffect(() => {
    async function carica() {
      try {
        setCaricando(true);

        let righeRiscattate: Awaited<ReturnType<typeof getRigheRiscattateDaFigli>> = [];
        if (percorso.scontrino_madre_id) {
          righeRiscattate = await getRigheRiscattateDaFigli(percorso.scontrino_madre_id);
        }

        const r = calcolaResiduo(percorso.righe || [], righeRiscattate);
        setResiduo(r);

        // Pre-compila le quantità dalle vociIniziali (se passate)
        if (vociIniziali && vociIniziali.length > 0) {
          const precompilate: QuantitaState = {};
          for (const v of vociIniziali) {
            const chiave = v.tipo === 'servizio' ? `S-${v.servizio_id}` : `P-${v.prodotto_id}`;
            const rigaResidua = r.righe_residue.find(
              (rr) =>
                rr.tipo === v.tipo &&
                ((v.tipo === 'servizio' && rr.servizio_id === v.servizio_id) ||
                  (v.tipo === 'prodotto' && rr.prodotto_id === v.prodotto_id))
            );
            if (rigaResidua && rigaResidua.quantita_residua > 0) {
              precompilate[chiave] = Math.min(v.quantita, rigaResidua.quantita_residua);
            }
          }
          setQuantita(precompilate);
        }

        const [p, s] = await Promise.all([getProdotti(), getServizi()]);
        setProdotti(p);
        setServizi(s);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setErrore(msg || 'Errore caricamento dati percorso');
      } finally {
        setCaricando(false);
      }
    }
    carica();
  }, [percorso, vociIniziali]);

  const righeDisponibili = useMemo(() => {
    if (!residuo) return [];
    return residuo.righe_residue.filter((r) => r.quantita_residua > 0);
  }, [residuo]);

  function aggiornaQuantita(chiave: string, valore: string, max: number) {
    const n = parseInt(valore, 10);
    const q = isNaN(n) || n < 0 ? 0 : Math.min(n, max);
    setQuantita((prev) => ({ ...prev, [chiave]: q }));
  }

  const qualcosaDaRiscattare = Object.values(quantita).some((q) => q > 0);

  function trovaPrezzoScontato(riga: ResiduoPercorso['righe_residue'][0]): number {
    const rigaPercorso = (percorso.righe || []).find((rp) => {
      if (rp.tipo !== riga.tipo) return false;
      if (rp.tipo === 'servizio') return rp.servizio_id === riga.servizio_id;
      return rp.prodotto_id === riga.prodotto_id;
    });

    if (rigaPercorso) return rigaPercorso.prezzo_scontato_lordo;

    if (riga.tipo === 'prodotto' && riga.prodotto_id) {
      const prod = prodotti.find((p) => p.id === riga.prodotto_id);
      return Number(prod?.prezzo_lordo || 0);
    }
    if (riga.tipo === 'servizio' && riga.servizio_id) {
      const serv = servizi.find((s) => s.id === riga.servizio_id);
      return Number(serv?.prezzo_lordo || 0);
    }
    return 0;
  }

  const totalePreview = useMemo(() => {
    if (!residuo) return 0;
    let tot = 0;
    for (const riga of righeDisponibili) {
      const k = chiaveRiga(riga);
      const q = quantita[k] || 0;
      if (q <= 0) continue;
      tot += q * trovaPrezzoScontato(riga);
    }
    return tot;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quantita, righeDisponibili, residuo, prodotti, servizi]);

  async function handleSubmit() {
    if (!percorso.scontrino_madre_id) {
      setErrore('Percorso senza scontrino madre collegato');
      return;
    }
    if (!cliente) {
      setErrore('Cliente mancante');
      return;
    }
    if (!qualcosaDaRiscattare) {
      setErrore('Seleziona almeno una voce da riscattare');
      return;
    }

    try {
      setSalvando(true);
      setErrore(null);

      const righeDaRiscattare = righeDisponibili
        .map((riga) => {
          const k = chiaveRiga(riga);
          const q = quantita[k] || 0;
          if (q <= 0) return null;

          const prezzoScontato = trovaPrezzoScontato(riga);

          return {
            tipo: riga.tipo,
            servizio_id: riga.servizio_id,
            prodotto_id: riga.prodotto_id,
            prodotto_percorso_id: riga.prodotto_id,
            nome: riga.nome,
            quantita: q,
            prezzo_unitario_lordo: prezzoScontato,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      await creaScontrinoFiglio({
        madreId: percorso.scontrino_madre_id,
        clienteId: cliente.id,
        righeRiscattate: righeDaRiscattare,
        metodo_pagamento: 'Non richiesto',
        modalita_cassa: 'digitale',
      });

      setToast({ message: '✅ Scontrino figlio emesso', tipo: 'success' });
      setTimeout(() => {
        onSuccess();
      }, 800);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrore(msg || 'Errore emissione figlio');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-[70] overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white sm:rounded-apple rounded-t-3xl shadow-apple-lg w-full sm:max-w-2xl max-h-[95vh] sm:my-8 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-200/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-apple bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white text-xl shrink-0">
              🎫
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-apple-darkgray">
                Scarica voci dal Percorso
              </h2>
              <p className="text-xs text-apple-gray truncate">
                {percorso.nome} {cliente && `• ${cliente.nome_cognome}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-apple-gray transition-colors shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {caricando ? (
            <div className="text-center py-12 text-apple-gray text-sm">
              Caricamento residuo percorso...
            </div>
          ) : !residuo ? (
            <div className="bg-red-50 border border-red-200 rounded-apple p-4 text-red-700 text-sm">
              ❌ Impossibile calcolare il residuo
            </div>
          ) : righeDisponibili.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-apple p-4 text-amber-700 text-sm">
              ⚠️ Questo percorso è completamente esaurito.
            </div>
          ) : (
            <>
              {vociIniziali && vociIniziali.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-apple p-3 text-xs text-amber-900">
                  💡 Le quantità sono state pre-compilate dalle voci presenti nel carrello.
                </div>
              )}

              <div>
                <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-3">
                  🎯 Voci da scaricare oggi (prezzi scontati)
                </h3>

                <div className="space-y-2">
                  {righeDisponibili.map((riga) => {
                    const k = chiaveRiga(riga);
                    const q = quantita[k] || 0;
                    const prezzoScontato = trovaPrezzoScontato(riga);

                    return (
                      <div
                        key={k}
                        className={`p-3 rounded-apple border flex items-center gap-3 ${
                          q > 0 ? 'bg-amber-50 border-amber-300' : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-apple-darkgray truncate">
                            {riga.tipo === 'servizio' ? '🛠️' : '📦'} {riga.nome}
                          </p>
                          <p className="text-xs text-apple-gray mt-0.5">
                            Residuo:{' '}
                            <strong className="text-apple-darkgray">
                              {riga.quantita_residua}
                            </strong>{' '}
                            di {riga.quantita_totale}
                            {' • '}
                            {formatEuro(prezzoScontato)} cad.
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <label className="text-xs font-medium text-apple-gray">
                            Oggi:
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={riga.quantita_residua}
                            step="1"
                            value={q || ''}
                            placeholder="0"
                            onChange={(e) =>
                              aggiornaQuantita(k, e.target.value, riga.quantita_residua)
                            }
                            className="w-16 px-2 py-1.5 bg-white border border-gray-200 rounded-apple text-sm text-center font-bold text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-amber-300/40"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-gray-100 rounded-apple p-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-apple-gray uppercase tracking-wide">
                    Valore scaricato (scontato)
                  </p>
                  <p className="text-xl font-bold text-amber-700">
                    {formatEuro(totalePreview)}
                  </p>
                </div>
                <p className="text-xs text-apple-gray">
                  Verrà emesso scontrino figlio con <strong>totale 0,00 €</strong> e{' '}
                  <strong>IVA 0,00 €</strong>, con riga di storno compensativa.
                  Le voci scaricate verranno <strong>rimosse dal carrello</strong>.
                </p>
              </div>
            </>
          )}

          {errore && (
            <div className="bg-red-50 border border-red-200 rounded-apple p-3 text-red-700 text-sm">
              ❌ {errore}
            </div>
          )}
        </div>

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
            disabled={salvando || !qualcosaDaRiscattare}
            className="flex-1 px-4 py-2.5 bg-amber-500 text-white rounded-apple font-medium text-sm hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {salvando ? 'Emissione...' : '🎫 Scarica e Emetti Figlio (0,00 €)'}
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
