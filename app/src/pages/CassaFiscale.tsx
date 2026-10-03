import { useEffect, useState, useMemo } from 'react';
import { getProdotti, type Prodotto } from '../lib/prodotti';
import { getServizi, type Servizio } from '../lib/servizi';
import { getClienti, type Cliente } from '../lib/clienti';
import { formatEuro } from '../lib/fatture';
import {
  creaScontrino,
  getScontrini,
  calcolaTotaliDaListino,
  dataOggi,
  oraAdesso,
  IVA_DEFAULT,
  type RigaScontrino,
  type MetodoPagamento,
  type ModalitaCassa,
  type Scontrino,
} from '../lib/scontrini';
import { getTuttiPercorsi, type Percorso } from '../lib/percorsi';
import {
  calcolaResiduo,
  type ResiduoPercorso,
} from '../lib/percorsi-helper';
import { getRigheRiscattateDaFigli } from '../lib/scontrini-figli';
import { aggiornaAppuntamento } from '../lib/appuntamenti';
import { useDatiAziendali } from '../lib/useDatiAziendali';
import { Toast, type ToastTipo } from '../components/Toast';
import { StampaScontrino } from '../components/StampaScontrino';
import { FormRiscattaPercorso } from '../components/FormRiscattaPercorso';
import { FormNuovoPercorso } from '../components/FormNuovoPercorso';

interface RigaCarrello {
  id: string;
  tipo: 'prodotto' | 'servizio';
  prodotto_id: number | null;
  servizio_id: number | null;
  nome: string;
  prezzo_unitario_lordo: number;
  quantita: number;
  sconto_tipo: 'percentuale' | 'importo';
  sconto_valore: number;
}

type TabPagina = 'cassa' | 'archivio' | 'riscatta';
type FiltroTipo = 'tutti' | 'fisico' | 'digitale';
type ScontoTipo = 'percentuale' | 'importo';

interface PercorsoConResiduo {
  percorso: Percorso;
  cliente: Cliente | null;
  residuo: ResiduoPercorso | null;
}

// Calcola prezzo unitario lordo dopo sconto riga
function calcolaPrezzoScontato(r: RigaCarrello): number {
  if (!r.sconto_valore || r.sconto_valore <= 0) return r.prezzo_unitario_lordo;
  if (r.sconto_tipo === 'percentuale') {
    return Number((r.prezzo_unitario_lordo * (1 - r.sconto_valore / 100)).toFixed(2));
  }
  return Number(Math.max(0, r.prezzo_unitario_lordo - r.sconto_valore).toFixed(2));
}

export function CassaFiscale() {
  const { dati: azienda } = useDatiAziendali();

  const [prodotti, setProdotti] = useState<Prodotto[]>([]);
  const [servizi, setServizi] = useState<Servizio[]>([]);
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);

  const [tab, setTab] = useState<TabPagina>('cassa');
  const [ricerca, setRicerca] = useState('');
  const [tabCatalogo, setTabCatalogo] = useState<'servizi' | 'prodotti'>('servizi');
  const [carrello, setCarrello] = useState<RigaCarrello[]>([]);
  const [clienteSelezionato, setClienteSelezionato] = useState<Cliente | null>(null);
  const [metodoPagamento, setMetodoPagamento] = useState<MetodoPagamento>('Contanti');
  const [note, setNote] = useState('');
  const [emettendo, setEmettendo] = useState(false);
  const [toast, setToast] = useState<{ message: string; tipo: ToastTipo } | null>(null);
  const [showSelettoreCliente, setShowSelettoreCliente] = useState(false);
  const [ricercaCliente, setRicercaCliente] = useState('');

  // Sconto totale carrello
  const [scontoTotaleTipo, setScontoTotaleTipo] = useState<ScontoTipo>('percentuale');
  const [scontoTotaleValore, setScontoTotaleValore] = useState<number>(0);

  // Archivio
  const [scontrini, setScontrini] = useState<Scontrino[]>([]);
  const [caricandoArchivio, setCaricandoArchivio] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('tutti');
  const [scontrinoAperto, setScontrinoAperto] = useState<Scontrino | null>(null);

  // Riscatta
  const [percorsiConResiduo, setPercorsiConResiduo] = useState<PercorsoConResiduo[]>([]);
  const [caricandoPercorsi, setCaricandoPercorsi] = useState(false);
  const [ricercaPercorso, setRicercaPercorso] = useState('');
  const [percorsoSelezionato, setPercorsoSelezionato] = useState<PercorsoConResiduo | null>(null);
  const [showNuovoPercorso, setShowNuovoPercorso] = useState(false);

  // Voci da pre-selezionare (da Agenda/Clienti via localStorage)
  const [vociDaPreselezionare, setVociDaPreselezionare] = useState<
    Array<{
      tipo: 'servizio' | 'prodotto';
      servizio_id: number | null;
      prodotto_id: number | null;
      nome?: string;
      quantita: number;
    }> | null
  >(null);

  // Percorsi attivi del cliente selezionato in Cassa
  const [percorsiClienteCorrente, setPercorsiClienteCorrente] = useState<PercorsoConResiduo[]>([]);
  const [percorsoDaRiscattare, setPercorsoDaRiscattare] = useState<PercorsoConResiduo | null>(null);

  // Overlap tra carrello e percorsi attivi
  const [overlapInfo, setOverlapInfo] = useState<{
    percorso: PercorsoConResiduo;
    righe: RigaCarrello[];
  } | null>(null);

  const modalitaCassa: ModalitaCassa = azienda.cassaModalita || 'digitale';

  useEffect(() => {
    async function carica() {
      try {
        setLoading(true);
        setErrore(null);
        const [p, s, c] = await Promise.all([getProdotti(), getServizi(), getClienti()]);
        setProdotti(p);
        setServizi(s);
        setClienti(c);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setErrore(msg || 'Errore nel caricamento');
      } finally {
        setLoading(false);
      }
    }
    carica();
  }, []);

  // Legge cliente + voci pre-selezionate da localStorage (da Clienti o Agenda)
  useEffect(() => {
    const salvatoCliente = localStorage.getItem('cassa_cliente_preselezionato');
    const salvatoVoci = localStorage.getItem('cassa_voci_preselezionate');

    if (salvatoCliente) {
      try {
        const cliente = JSON.parse(salvatoCliente);
        setClienteSelezionato(cliente);
        localStorage.removeItem('cassa_cliente_preselezionato');
      } catch (err) {
        console.warn('Errore parse cliente pre-selezionato:', err);
      }
    }

    if (salvatoVoci) {
      try {
        const voci = JSON.parse(salvatoVoci);
        if (Array.isArray(voci) && voci.length > 0) {
          setVociDaPreselezionare(voci);
        }
        localStorage.removeItem('cassa_voci_preselezionate');
      } catch (err) {
        console.warn('Errore parse voci pre-selezionate:', err);
      }
    }
  }, []);

  // Quando prodotti + servizi sono caricati, popola il carrello con le voci pre-selezionate
  useEffect(() => {
    if (!vociDaPreselezionare || vociDaPreselezionare.length === 0) return;
    if (prodotti.length === 0 && servizi.length === 0) return;

    setCarrello((prev) => {
      const nuove = [...prev];
      for (const v of vociDaPreselezionare) {
        if (v.tipo === 'servizio' && v.servizio_id) {
          const s = servizi.find((x) => x.id === v.servizio_id);
          if (s) {
            const esistente = nuove.findIndex(
              (r) => r.tipo === 'servizio' && r.servizio_id === s.id
            );
            if (esistente >= 0) {
              nuove[esistente].quantita += v.quantita || 1;
            } else {
              nuove.push({
                id: Math.random().toString(36).substring(7),
                tipo: 'servizio',
                prodotto_id: null,
                servizio_id: s.id,
                nome: s.nome,
                prezzo_unitario_lordo: Number(s.prezzo_lordo) || 0,
                quantita: v.quantita || 1,
                sconto_tipo: 'percentuale',
                sconto_valore: 0,
              });
            }
          }
        } else if (v.tipo === 'prodotto' && v.prodotto_id) {
          const p = prodotti.find((x) => x.id === v.prodotto_id);
          if (p) {
            const esistente = nuove.findIndex(
              (r) => r.tipo === 'prodotto' && r.prodotto_id === p.id
            );
            if (esistente >= 0) {
              nuove[esistente].quantita += v.quantita || 1;
            } else {
              nuove.push({
                id: Math.random().toString(36).substring(7),
                tipo: 'prodotto',
                prodotto_id: p.id,
                servizio_id: null,
                nome: p.nome,
                prezzo_unitario_lordo: Number(p.prezzo_lordo) || 0,
                quantita: v.quantita || 1,
                sconto_tipo: 'percentuale',
                sconto_valore: 0,
              });
            }
          }
        }
      }
      return nuove;
    });

    setVociDaPreselezionare(null);
  }, [vociDaPreselezionare, prodotti, servizi]);

  useEffect(() => {
    if (tab !== 'archivio') return;
    async function caricaArchivio() {
      try {
        setCaricandoArchivio(true);
        const lista = await getScontrini();
        setScontrini(lista);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setToast({ message: msg || 'Errore caricamento archivio', tipo: 'error' });
      } finally {
        setCaricandoArchivio(false);
      }
    }
    caricaArchivio();
  }, [tab]);

  // Funzione riutilizzabile per ricaricare i percorsi del cliente corrente
  async function ricaricaPercorsiClienteCorrente(cliente: Cliente | null) {
    if (!cliente) {
      setPercorsiClienteCorrente([]);
      return;
    }
    try {
      const [tuttiPercorsi, tuttiClienti] = await Promise.all([
        getTuttiPercorsi(),
        getClienti(),
      ]);
      const clientiById = new Map(tuttiClienti.map((c) => [c.id, c]));

      const risultati: PercorsoConResiduo[] = [];
      for (const p of tuttiPercorsi) {
        if (p.cliente_id !== cliente.id) continue;
        if (!p.scontrino_madre_id) continue;
        if (p.terminato) continue;

        let residuo: ResiduoPercorso | null = null;
        try {
          const righeRiscattate = await getRigheRiscattateDaFigli(p.scontrino_madre_id);
          residuo = calcolaResiduo(p.righe || [], righeRiscattate);
        } catch (err) {
          console.error('Errore calcolo residuo percorso cliente', p.id, err);
        }

        if (residuo && residuo.valore_residuo_lordo > 0) {
          risultati.push({
            percorso: p,
            cliente: clientiById.get(p.cliente_id) || null,
            residuo,
          });
        }
      }
      setPercorsiClienteCorrente(risultati);
    } catch (err) {
      console.error('Errore caricamento percorsi cliente:', err);
      setPercorsiClienteCorrente([]);
    }
  }

  useEffect(() => {
    ricaricaPercorsiClienteCorrente(clienteSelezionato);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteSelezionato]);

  // Calcola overlap tra carrello e percorsi del cliente
  useEffect(() => {
    if (carrello.length === 0 || percorsiClienteCorrente.length === 0) {
      setOverlapInfo(null);
      return;
    }
    for (const p of percorsiClienteCorrente) {
      const righePercorso = p.residuo?.righe_residue || [];
      const overlap = carrello.filter((r) =>
        righePercorso.some((rp) => {
          if (rp.tipo !== r.tipo) return false;
          if (rp.tipo === 'servizio') return rp.servizio_id === r.servizio_id;
          return rp.prodotto_id === r.prodotto_id;
        })
      );
      if (overlap.length > 0) {
        setOverlapInfo({ percorso: p, righe: overlap });
        return;
      }
    }
    setOverlapInfo(null);
  }, [carrello, percorsiClienteCorrente]);

  function apriRiscattoConVociCarrello() {
    if (!overlapInfo) return;
    setPercorsoDaRiscattare(overlapInfo.percorso);
  }

  useEffect(() => {
    if (tab !== 'riscatta') return;
    async function caricaPercorsi() {
      try {
        setCaricandoPercorsi(true);
        const [tuttiPercorsi, tuttiClienti] = await Promise.all([
          getTuttiPercorsi(),
          getClienti(),
        ]);
        const clientiById = new Map(tuttiClienti.map((c) => [c.id, c]));

        const risultati: PercorsoConResiduo[] = [];
        for (const p of tuttiPercorsi) {
          if (!p.scontrino_madre_id) continue;
          if (p.terminato) continue;

          let residuo: ResiduoPercorso | null = null;
          try {
            const righeRiscattate = await getRigheRiscattateDaFigli(p.scontrino_madre_id);
            residuo = calcolaResiduo(p.righe || [], righeRiscattate);
          } catch (err) {
            console.error('Errore calcolo residuo percorso', p.id, err);
          }

          if (residuo && residuo.valore_residuo_lordo > 0) {
            risultati.push({
              percorso: p,
              cliente: clientiById.get(p.cliente_id) || null,
              residuo,
            });
          }
        }
        setPercorsiConResiduo(risultati);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setToast({ message: msg || 'Errore caricamento percorsi', tipo: 'error' });
      } finally {
        setCaricandoPercorsi(false);
      }
    }
    caricaPercorsi();
  }, [tab]);

  // Totali con sconti
  const totali = useMemo(() => {
    // 1. Subtotale al netto degli sconti riga
    let subtotale = 0;
    for (const r of carrello) {
      const prezzoScontato = calcolaPrezzoScontato(r);
      subtotale += prezzoScontato * r.quantita;
    }
    subtotale = Number(subtotale.toFixed(2));

    // 2. Sconto totale
    let scontoTotale = 0;
    if (scontoTotaleValore > 0) {
      if (scontoTotaleTipo === 'percentuale') {
        scontoTotale = Number((subtotale * (scontoTotaleValore / 100)).toFixed(2));
      } else {
        scontoTotale = Number(Math.min(subtotale, scontoTotaleValore).toFixed(2));
      }
    }

    const totaleFinale = Number((subtotale - scontoTotale).toFixed(2));
    const nettoFinale = Number((totaleFinale / (1 + IVA_DEFAULT / 100)).toFixed(2));
    const ivaFinale = Number((totaleFinale - nettoFinale).toFixed(2));

    return {
      subtotale,
      scontoTotale,
      totaleFinale,
      nettoFinale,
      ivaFinale,
    };
  }, [carrello, scontoTotaleTipo, scontoTotaleValore]);

  const numeroVoci = carrello.reduce((sum, r) => sum + r.quantita, 0);

  const serviziFiltrati = useMemo(() => {
    if (!ricerca.trim()) return servizi;
    const q = ricerca.toLowerCase();
    return servizi.filter((s) => s.nome.toLowerCase().includes(q));
  }, [servizi, ricerca]);

  const prodottiFiltrati = useMemo(() => {
    if (!ricerca.trim()) return prodotti;
    const q = ricerca.toLowerCase();
    return prodotti.filter((p) => p.nome.toLowerCase().includes(q));
  }, [prodotti, ricerca]);

  const clientiFiltrati = useMemo(() => {
    if (!ricercaCliente.trim()) return clienti;
    const q = ricercaCliente.toLowerCase();
    return clienti.filter((c) => c.nome_cognome.toLowerCase().includes(q));
  }, [clienti, ricercaCliente]);

  const scontriniFiltrati = useMemo(() => {
    if (filtroTipo === 'tutti') return scontrini;
    return scontrini.filter((s) => s.modalita_cassa === filtroTipo);
  }, [scontrini, filtroTipo]);

  const contatoriArchivio = useMemo(() => {
    return {
      totale: scontrini.length,
      fisico: scontrini.filter((s) => s.modalita_cassa === 'fisico').length,
      digitale: scontrini.filter((s) => s.modalita_cassa === 'digitale').length,
    };
  }, [scontrini]);

  const percorsiFiltrati = useMemo(() => {
    if (!ricercaPercorso.trim()) return percorsiConResiduo;
    const q = ricercaPercorso.toLowerCase();
    return percorsiConResiduo.filter((p) => {
      const nomeCliente = p.cliente?.nome_cognome.toLowerCase() || '';
      const nomePercorso = p.percorso.nome.toLowerCase();
      return nomeCliente.includes(q) || nomePercorso.includes(q);
    });
  }, [percorsiConResiduo, ricercaPercorso]);

  // === Azioni carrello ===
  function aggiungiProdotto(p: Prodotto) {
    setCarrello((prev) => {
      const esistente = prev.find((r) => r.tipo === 'prodotto' && r.prodotto_id === p.id && r.sconto_valore === 0);
      if (esistente) {
        return prev.map((r) =>
          r.id === esistente.id ? { ...r, quantita: r.quantita + 1 } : r
        );
      }
      return [
        ...prev,
        {
          id: Math.random().toString(36).substring(7),
          tipo: 'prodotto',
          prodotto_id: p.id,
          servizio_id: null,
          nome: p.nome,
          prezzo_unitario_lordo: Number(p.prezzo_lordo) || 0,
          quantita: 1,
          sconto_tipo: 'percentuale',
          sconto_valore: 0,
        },
      ];
    });
  }

  function aggiungiServizio(s: Servizio) {
    setCarrello((prev) => {
      const esistente = prev.find((r) => r.tipo === 'servizio' && r.servizio_id === s.id && r.sconto_valore === 0);
      if (esistente) {
        return prev.map((r) =>
          r.id === esistente.id ? { ...r, quantita: r.quantita + 1 } : r
        );
      }
      return [
        ...prev,
        {
          id: Math.random().toString(36).substring(7),
          tipo: 'servizio',
          prodotto_id: null,
          servizio_id: s.id,
          nome: s.nome,
          prezzo_unitario_lordo: Number(s.prezzo_lordo) || 0,
          quantita: 1,
          sconto_tipo: 'percentuale',
          sconto_valore: 0,
        },
      ];
    });
  }

  function cambiaQuantita(id: string, nuova: number) {
    if (nuova <= 0) {
      setCarrello((prev) => prev.filter((r) => r.id !== id));
      return;
    }
    setCarrello((prev) => prev.map((r) => (r.id === id ? { ...r, quantita: nuova } : r)));
  }

  function rimuoviRiga(id: string) {
    setCarrello((prev) => prev.filter((r) => r.id !== id));
  }

  function aggiornaScontoRiga(id: string, tipo: 'percentuale' | 'importo', valore: number) {
    setCarrello((prev) =>
      prev.map((r) => (r.id === id ? { ...r, sconto_tipo: tipo, sconto_valore: valore } : r))
    );
  }

  function svuotaCarrello() {
    if (carrello.length === 0) return;
    if (!confirm('Svuotare il carrello?')) return;
    setCarrello([]);
    setClienteSelezionato(null);
    setNote('');
    setScontoTotaleValore(0);
  }

  async function emettiScontrino() {
    if (carrello.length === 0) {
      setToast({ message: 'Carrello vuoto', tipo: 'error' });
      return;
    }

    try {
      setEmettendo(true);

      const righe: RigaScontrino[] = carrello.map((r) => {
        const prezzoScontato = calcolaPrezzoScontato(r);
        const haSconto = r.sconto_valore > 0;

        return {
          tipo: r.tipo,
          prodotto_id: r.prodotto_id,
          servizio_id: r.servizio_id,
          nome: r.nome,
          quantita: r.quantita,
          prezzo_unitario_lordo: prezzoScontato,
          iva_percentuale: IVA_DEFAULT,
          sconto_tipo: haSconto ? r.sconto_tipo : null,
          sconto_valore: haSconto ? r.sconto_valore : null,
        };
      });

      await creaScontrino({
        data_emissione: dataOggi(),
        ora_emissione: oraAdesso(),
        cliente_id: clienteSelezionato?.id ?? null,
        totale_lordo: totali.totaleFinale,
        totale_netto: totali.nettoFinale,
        iva_importo: totali.ivaFinale,
        metodo_pagamento: metodoPagamento,
        tipo: 'madre',
        note: note.trim() || null,
        modalita_cassa: modalitaCassa,
        sconto_totale_tipo: scontoTotaleValore > 0 ? scontoTotaleTipo : null,
        sconto_totale_valore: scontoTotaleValore > 0 ? scontoTotaleValore : null,
        righe,
      });

      // Se lo scontrino viene da un appuntamento, marca come completato
      const appuntamentoId = localStorage.getItem('cassa_appuntamento_id');
      if (appuntamentoId) {
        try {
          await aggiornaAppuntamento(Number(appuntamentoId), {
            stato: 'completato',
          });
          localStorage.removeItem('cassa_appuntamento_id');
        } catch (errApp) {
          console.warn('⚠️ Errore aggiornamento appuntamento:', errApp);
        }
      }

      setToast({
        message: `✅ Scontrino emesso (${formatEuro(totali.totaleFinale)})`,
        tipo: 'success',
      });
      setCarrello([]);
      setClienteSelezionato(null);
      setNote('');
      setScontoTotaleValore(0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setToast({ message: msg || 'Errore emissione', tipo: 'error' });
    } finally {
      setEmettendo(false);
    }
  }

  return (
    <div className="p-3 sm:p-6 lg:p-8">
      <div className="mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-apple-darkgray">
              🧾 Cassa Fiscale
            </h1>
            <p className="text-xs text-apple-gray mt-0.5">
              {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              {' • '}IVA {IVA_DEFAULT}%
              {' • '}Modalità: <strong>{modalitaCassa}</strong>
            </p>
          </div>
          {tab === 'cassa' && (
            <button
              onClick={svuotaCarrello}
              disabled={carrello.length === 0}
              className="px-4 py-2.5 bg-gray-100 text-apple-darkgray rounded-apple font-medium text-sm hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              🗑️ Svuota
            </button>
          )}
        </div>

        <div className="inline-flex bg-gray-100 rounded-apple p-1 flex-wrap">
          <button
            onClick={() => setTab('cassa')}
            className={`px-4 sm:px-5 py-2 rounded-apple text-xs sm:text-sm font-semibold transition-all ${
              tab === 'cassa' ? 'bg-white text-apple-darkgray shadow-apple' : 'text-apple-gray hover:text-apple-darkgray'
            }`}
          >
            🧾 Cassa
          </button>
          <button
            onClick={() => setTab('archivio')}
            className={`px-4 sm:px-5 py-2 rounded-apple text-xs sm:text-sm font-semibold transition-all ${
              tab === 'archivio' ? 'bg-white text-apple-darkgray shadow-apple' : 'text-apple-gray hover:text-apple-darkgray'
            }`}
          >
            📚 Archivio ({contatoriArchivio.totale})
          </button>
          <button
            onClick={() => setTab('riscatta')}
            className={`px-4 sm:px-5 py-2 rounded-apple text-xs sm:text-sm font-semibold transition-all ${
              tab === 'riscatta' ? 'bg-white text-purple-700 shadow-apple' : 'text-apple-gray hover:text-purple-700'
            }`}
          >
            🎫 Riscatta Percorso
          </button>
        </div>
      </div>

      {errore && (
        <div className="bg-red-50 border border-red-200 rounded-apple p-4 text-red-700 text-sm mb-4">
          ❌ {errore}
        </div>
      )}

      {/* === TAB CASSA === */}
      {tab === 'cassa' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 space-y-3">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-apple-gray">🔍</span>
              <input
                type="text"
                placeholder="Cerca prodotto o servizio..."
                value={ricerca}
                onChange={(e) => setRicerca(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white rounded-apple shadow-apple text-sm placeholder:text-apple-gray focus:outline-none focus:ring-2 focus:ring-apple-blue/30"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setTabCatalogo('servizi')}
                className={`flex-1 px-4 py-2.5 rounded-apple text-sm font-semibold transition-all ${
                  tabCatalogo === 'servizi'
                    ? 'bg-apple-blue text-white shadow-apple'
                    : 'bg-white text-apple-darkgray hover:bg-gray-50 border border-gray-200'
                }`}
              >
                🛠️ Servizi ({servizi.length})
              </button>
              <button
                onClick={() => setTabCatalogo('prodotti')}
                className={`flex-1 px-4 py-2.5 rounded-apple text-sm font-semibold transition-all ${
                  tabCatalogo === 'prodotti'
                    ? 'bg-apple-blue text-white shadow-apple'
                    : 'bg-white text-apple-darkgray hover:bg-gray-50 border border-gray-200'
                }`}
              >
                📦 Prodotti ({prodotti.length})
              </button>
            </div>

            {loading ? (
              <div className="bg-white rounded-apple shadow-apple p-12 text-center text-apple-gray text-sm">
                Caricamento...
              </div>
            ) : tabCatalogo === 'servizi' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {serviziFiltrati.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => aggiungiServizio(s)}
                    className="bg-white rounded-apple shadow-apple p-3 text-left hover:bg-blue-50/60 active:scale-95 transition-all"
                  >
                    <p className="text-xs font-semibold text-apple-darkgray line-clamp-2 min-h-[2rem]">
                      {s.nome}
                    </p>
                    <p className="text-sm font-bold text-apple-blue mt-1">
                      {formatEuro(Number(s.prezzo_lordo))}
                    </p>
                  </button>
                ))}
                {serviziFiltrati.length === 0 && (
                  <div className="col-span-full bg-white rounded-apple shadow-apple p-8 text-center text-apple-gray text-sm">
                    Nessun servizio trovato
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {prodottiFiltrati.map((p) => {
                  const sottoScorta = p.giacenza <= p.scorta_minima;
                  return (
                    <button
                      key={p.id}
                      onClick={() => aggiungiProdotto(p)}
                      disabled={p.giacenza <= 0}
                      className="bg-white rounded-apple shadow-apple p-3 text-left hover:bg-blue-50/60 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <p className="text-xs font-semibold text-apple-darkgray line-clamp-2 min-h-[2rem]">
                        {p.nome}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-sm font-bold text-apple-blue">
                          {formatEuro(Number(p.prezzo_lordo))}
                        </p>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${sottoScorta ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-apple-gray'}`}>
                          {p.giacenza}
                        </span>
                      </div>
                    </button>
                  );
                })}
                {prodottiFiltrati.length === 0 && (
                  <div className="col-span-full bg-white rounded-apple shadow-apple p-8 text-center text-apple-gray text-sm">
                    Nessun prodotto trovato
                  </div>
                )}
              </div>
            )}
          </div>

          {/* CARRELLO */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-apple shadow-apple-lg sticky top-4 flex flex-col max-h-[calc(100vh-2rem)]">
              <div className="px-4 py-3 border-b border-gray-200/60 flex items-center justify-between shrink-0">
                <p className="text-xs font-bold text-apple-gray uppercase tracking-wide">
                  🛒 Scontrino
                </p>
                <span className="text-xs font-semibold text-apple-blue bg-blue-50 px-2 py-0.5 rounded-full">
                  {numeroVoci} {numeroVoci === 1 ? 'voce' : 'voci'}
                </span>
              </div>

              <div className="px-4 py-2.5 border-b border-gray-200/60 shrink-0">
                {clienteSelezionato ? (
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-apple-gray">Cliente</p>
                      <p className="text-sm font-semibold text-apple-darkgray truncate">
                        {clienteSelezionato.nome_cognome}
                      </p>
                    </div>
                    <button
                      onClick={() => setClienteSelezionato(null)}
                      className="text-xs text-apple-blue hover:underline shrink-0"
                    >
                      Cambia
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowSelettoreCliente(true)}
                    className="w-full text-left px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-apple text-xs text-apple-gray transition-colors"
                  >
                    + Aggiungi cliente (opzionale)
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-[120px]">
                {carrello.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-center">
                    <p className="text-4xl mb-2 opacity-30">🛒</p>
                    <p className="text-xs text-apple-gray">
                      Tocca prodotti o servizi per aggiungerli
                    </p>
                  </div>
                ) : (
                  carrello.map((r) => {
                    const prezzoScontato = calcolaPrezzoScontato(r);
                    const importoRiga = prezzoScontato * r.quantita;
                    const haSconto = r.sconto_valore > 0;

                    return (
                      <div
                        key={r.id}
                        className="p-2 bg-gray-50 rounded-apple space-y-1.5"
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-apple-darkgray truncate">
                              {r.nome}
                            </p>
                            <p className="text-[11px] text-apple-gray">
                              {haSconto && (
                                <span className="line-through mr-1">{formatEuro(r.prezzo_unitario_lordo)}</span>
                              )}
                              {formatEuro(prezzoScontato)} cad.
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => cambiaQuantita(r.id, r.quantita - 1)}
                              className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center text-apple-darkgray text-xs font-bold hover:bg-gray-100"
                            >
                              −
                            </button>
                            <span className="w-6 text-center text-xs font-bold text-apple-darkgray">
                              {r.quantita}
                            </span>
                            <button
                              onClick={() => cambiaQuantita(r.id, r.quantita + 1)}
                              className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center text-apple-darkgray text-xs font-bold hover:bg-gray-100"
                            >
                              +
                            </button>
                            <button
                              onClick={() => rimuoviRiga(r.id)}
                              className="w-6 h-6 rounded-full text-red-500 hover:bg-red-50 flex items-center justify-center text-xs ml-1"
                            >
                              ✕
                            </button>
                          </div>
                          <span className="text-xs font-bold text-apple-darkgray shrink-0 w-16 text-right">
                            {formatEuro(importoRiga)}
                          </span>
                        </div>

                        {/* Sconto riga */}
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-apple-gray">🏷️ Sconto</span>
                          <input
                            type="number"
                            min="0"
                            step={r.sconto_tipo === 'percentuale' ? '1' : '0.01'}
                            value={r.sconto_valore || ''}
                            placeholder="0"
                            onChange={(e) =>
                              aggiornaScontoRiga(
                                r.id,
                                r.sconto_tipo,
                                Math.max(0, parseFloat(e.target.value) || 0)
                              )
                            }
                            className="w-14 px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px] text-center font-bold text-apple-darkgray focus:outline-none focus:ring-1 focus:ring-apple-blue/30"
                          />
                          <div className="flex bg-white border border-gray-200 rounded overflow-hidden">
                            <button
                              onClick={() => aggiornaScontoRiga(r.id, 'percentuale', r.sconto_valore)}
                              className={`px-1.5 py-0.5 text-[10px] font-bold ${
                                r.sconto_tipo === 'percentuale'
                                  ? 'bg-apple-blue text-white'
                                  : 'text-apple-gray hover:bg-gray-50'
                              }`}
                            >
                              %
                            </button>
                            <button
                              onClick={() => aggiornaScontoRiga(r.id, 'importo', r.sconto_valore)}
                              className={`px-1.5 py-0.5 text-[10px] font-bold ${
                                r.sconto_tipo === 'importo'
                                  ? 'bg-apple-blue text-white'
                                  : 'text-apple-gray hover:bg-gray-50'
                              }`}
                            >
                              €
                            </button>
                          </div>
                          {haSconto && (
                            <button
                              onClick={() => aggiornaScontoRiga(r.id, r.sconto_tipo, 0)}
                              className="text-[10px] text-red-500 hover:underline ml-auto"
                            >
                              ✕ rimuovi
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {carrello.length > 0 && (
                <>
                  <div className="px-4 py-2 border-t border-gray-200/60 space-y-1 shrink-0">
                    <div className="flex justify-between text-xs text-apple-gray">
                      <span>Subtotale</span>
                      <span>{formatEuro(totali.subtotale)}</span>
                    </div>

                    {/* Sconto totale */}
                    <div className="flex items-center justify-between gap-2 py-0.5">
                      <span className="text-xs text-apple-gray">🏷️ Sconto totale</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          step={scontoTotaleTipo === 'percentuale' ? '1' : '0.01'}
                          value={scontoTotaleValore || ''}
                          placeholder="0"
                          onChange={(e) =>
                            setScontoTotaleValore(Math.max(0, parseFloat(e.target.value) || 0))
                          }
                          className="w-14 px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px] text-center font-bold text-apple-darkgray focus:outline-none focus:ring-1 focus:ring-apple-blue/30"
                        />
                        <div className="flex bg-white border border-gray-200 rounded overflow-hidden">
                          <button
                            onClick={() => setScontoTotaleTipo('percentuale')}
                            className={`px-1.5 py-0.5 text-[10px] font-bold ${
                              scontoTotaleTipo === 'percentuale'
                                ? 'bg-apple-blue text-white'
                                : 'text-apple-gray hover:bg-gray-50'
                            }`}
                          >
                            %
                          </button>
                          <button
                            onClick={() => setScontoTotaleTipo('importo')}
                            className={`px-1.5 py-0.5 text-[10px] font-bold ${
                              scontoTotaleTipo === 'importo'
                                ? 'bg-apple-blue text-white'
                                : 'text-apple-gray hover:bg-gray-50'
                            }`}
                          >
                            €
                          </button>
                        </div>
                      </div>
                    </div>

                    {totali.scontoTotale > 0 && (
                      <div className="flex justify-between text-xs text-red-600 font-semibold">
                        <span>Sconto applicato</span>
                        <span>-{formatEuro(totali.scontoTotale)}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-xs text-apple-gray">
                      <span>Netto (IVA esclusa)</span>
                      <span>{formatEuro(totali.nettoFinale)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-apple-gray">
                      <span>IVA {IVA_DEFAULT}%</span>
                      <span>{formatEuro(totali.ivaFinale)}</span>
                    </div>
                    <div className="flex justify-between text-base font-bold text-apple-darkgray pt-1 border-t border-gray-200/60">
                      <span>TOTALE</span>
                      <span>{formatEuro(totali.totaleFinale)}</span>
                    </div>
                  </div>

                  <div className="px-4 pb-3 shrink-0">
                    <p className="text-[11px] font-semibold text-apple-gray uppercase mb-1.5">
                      Metodo pagamento
                    </p>
                    <div className="grid grid-cols-5 gap-1">
                      {(['Contanti', 'Carta', 'Bancomat', 'Bonifico', 'Altro'] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => setMetodoPagamento(m)}
                          className={`py-2 rounded-apple text-[10px] font-bold transition-all ${
                            metodoPagamento === m
                              ? 'bg-apple-blue text-white shadow-apple'
                              : 'bg-gray-100 text-apple-darkgray hover:bg-gray-200'
                          }`}
                        >
                          {m === 'Contanti' && '💵'}
                          {m === 'Carta' && '💳'}
                          {m === 'Bancomat' && '📱'}
                          {m === 'Bonifico' && '🏦'}
                          {m === 'Altro' && '➕'}
                          <br />
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="px-4 pb-3 shrink-0">
                    <input
                      type="text"
                      placeholder="Note (opzionale)"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-apple text-xs text-apple-darkgray placeholder:text-apple-gray focus:outline-none focus:ring-2 focus:ring-apple-blue/30"
                    />
                  </div>

                  <div className="px-4 pb-4 shrink-0 space-y-2">
                    {overlapInfo ? (
                      <button
                        onClick={apriRiscattoConVociCarrello}
                        className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-apple font-bold text-sm shadow-apple transition-all active:scale-[0.98]"
                      >
                        🎫 Scarica voci Percorso | Emetti Figlio
                      </button>
                    ) : (
                      <button
                        onClick={emettiScontrino}
                        disabled={emettendo || carrello.length === 0}
                        className="w-full py-3.5 bg-green-600 hover:bg-green-700 text-white rounded-apple font-bold text-sm shadow-apple disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                      >
                        {emettendo ? '⏳ Emissione...' : `✅ EMETTI SCONTRINO (${formatEuro(totali.totaleFinale)})`}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* === TAB ARCHIVIO === */}
      {tab === 'archivio' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFiltroTipo('tutti')}
              className={`px-4 py-2 rounded-apple text-sm font-semibold transition-all ${
                filtroTipo === 'tutti'
                  ? 'bg-apple-blue text-white shadow-apple'
                  : 'bg-white text-apple-darkgray border border-gray-200 hover:bg-gray-50'
              }`}
            >
              Tutti ({contatoriArchivio.totale})
            </button>
            <button
              onClick={() => setFiltroTipo('fisico')}
              className={`px-4 py-2 rounded-apple text-sm font-semibold transition-all ${
                filtroTipo === 'fisico'
                  ? 'bg-amber-500 text-white shadow-apple'
                  : 'bg-white text-apple-darkgray border border-gray-200 hover:bg-gray-50'
              }`}
            >
              🖨️ Fisici ({contatoriArchivio.fisico})
            </button>
            <button
              onClick={() => setFiltroTipo('digitale')}
              className={`px-4 py-2 rounded-apple text-sm font-semibold transition-all ${
                filtroTipo === 'digitale'
                  ? 'bg-blue-500 text-white shadow-apple'
                  : 'bg-white text-apple-darkgray border border-gray-200 hover:bg-gray-50'
              }`}
            >
              📱 Digitali ({contatoriArchivio.digitale})
            </button>
          </div>

          {caricandoArchivio ? (
            <div className="bg-white rounded-apple shadow-apple p-12 text-center text-apple-gray text-sm">
              Caricamento archivio...
            </div>
          ) : scontriniFiltrati.length === 0 ? (
            <div className="bg-white rounded-apple shadow-apple p-12 text-center">
              <p className="text-4xl mb-3 opacity-30">📚</p>
              <p className="text-sm text-apple-gray">
                Nessuno scontrino {filtroTipo !== 'tutti' ? filtroTipo : ''} trovato
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-apple shadow-apple overflow-hidden divide-y divide-gray-100">
              {scontriniFiltrati.map((s) => {
                const isFisico = s.modalita_cassa === 'fisico';
                const dataIt = new Date(s.data_emissione).toLocaleDateString('it-IT', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                });
                return (
                  <button
                    key={s.id}
                    onClick={() => setScontrinoAperto(s)}
                    className="w-full text-left px-4 py-3 hover:bg-blue-50/40 transition-colors flex items-center gap-3"
                  >
                    <div className={`shrink-0 w-10 h-10 rounded-apple flex items-center justify-center text-lg ${
                      isFisico ? 'bg-amber-100' : 'bg-blue-100'
                    }`}>
                      {isFisico ? '🖨️' : '📱'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-apple-darkgray truncate">
                          {s.numero_scontrino}
                        </p>
                        {s.tipo === 'figlio' && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                            FIGLIO
                          </span>
                        )}
                        {s.annullato && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                            ANNULLATO
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-apple-gray mt-0.5">
                        {dataIt} • {s.ora_emissione}
                        {s.cliente && ` • ${s.cliente.nome_cognome}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-apple-darkgray">
                        {formatEuro(s.totale_lordo)}
                      </p>
                      <p className="text-[10px] text-apple-gray uppercase">
                        {s.metodo_pagamento || '—'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* === TAB RISCATTA === */}
      {tab === 'riscatta' && (
        <div className="space-y-4">
          <div className="flex gap-2 items-stretch">
            <div className="relative flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-apple-gray">🔍</span>
              <input
                type="text"
                placeholder="Cerca per cliente o nome percorso..."
                value={ricercaPercorso}
                onChange={(e) => setRicercaPercorso(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white rounded-apple shadow-apple text-sm placeholder:text-apple-gray focus:outline-none focus:ring-2 focus:ring-purple-300/40"
              />
            </div>
            <button
              onClick={() => setShowNuovoPercorso(true)}
              className="px-4 py-3 bg-purple-600 text-white rounded-apple shadow-apple font-semibold text-sm hover:bg-purple-700 transition-colors whitespace-nowrap"
            >
              ➕ Nuovo Percorso
            </button>
          </div>

          {caricandoPercorsi ? (
            <div className="bg-white rounded-apple shadow-apple p-12 text-center text-apple-gray text-sm">
              Caricamento percorsi attivi...
            </div>
          ) : percorsiFiltrati.length === 0 ? (
            <div className="bg-white rounded-apple shadow-apple p-12 text-center">
              <p className="text-4xl mb-3 opacity-30">🎫</p>
              <p className="text-sm text-apple-gray">
                Nessun percorso attivo con residuo da riscattare
              </p>
              <p className="text-xs text-apple-gray mt-2">
                I percorsi appaiono qui solo se collegati a uno scontrino madre
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-apple shadow-apple overflow-hidden divide-y divide-gray-100">
              {percorsiFiltrati.map((p) => (
                <button
                  key={p.percorso.id}
                  onClick={() => setPercorsoSelezionato(p)}
                  className="w-full text-left px-4 py-3 hover:bg-purple-50/40 transition-colors flex items-center gap-3"
                >
                  <div className="shrink-0 w-10 h-10 rounded-apple bg-purple-100 flex items-center justify-center text-lg">
                    🎫
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-apple-darkgray truncate">
                      {p.percorso.nome}
                    </p>
                    <p className="text-xs text-apple-gray mt-0.5">
                      {p.cliente?.nome_cognome || '—'} • Scade{' '}
                      {new Date(p.percorso.data_fine).toLocaleDateString('it-IT')}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-apple-gray uppercase">Residuo</p>
                    <p className="text-sm font-bold text-purple-700">
                      {p.residuo ? formatEuro(p.residuo.valore_residuo_lordo) : '—'}
                    </p>
                    {p.residuo && (
                      <p className="text-[10px] text-apple-gray">
                        di {formatEuro(p.residuo.valore_totale_lordo)}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modale selettore cliente */}
      {showSelettoreCliente && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50"
          onClick={() => setShowSelettoreCliente(false)}
        >
          <div
            className="bg-white sm:rounded-apple rounded-t-3xl shadow-apple-lg w-full sm:max-w-md max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-200/60 flex items-center justify-between shrink-0">
              <h3 className="text-base font-bold text-apple-darkgray">Seleziona cliente</h3>
              <button
                onClick={() => setShowSelettoreCliente(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-apple-gray"
              >
                ✕
              </button>
            </div>
            <div className="p-4 border-b border-gray-200/60 shrink-0">
              <input
                type="text"
                placeholder="Cerca cliente..."
                value={ricercaCliente}
                onChange={(e) => setRicercaCliente(e.target.value)}
                autoFocus
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-apple text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue/30"
              />
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {clientiFiltrati.slice(0, 50).map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setClienteSelezionato(c);
                    setShowSelettoreCliente(false);
                    setRicercaCliente('');
                  }}
                  className="w-full text-left px-5 py-3 hover:bg-blue-50 transition-colors"
                >
                  <p className="text-sm font-semibold text-apple-darkgray">{c.nome_cognome}</p>
                  {c.cellulare && (
                    <p className="text-xs text-apple-gray mt-0.5">{c.cellulare}</p>
                  )}
                </button>
              ))}
              {clientiFiltrati.length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-apple-gray">
                  Nessun cliente trovato
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {scontrinoAperto && (
        <StampaScontrino
          scontrino={scontrinoAperto}
          onClose={() => setScontrinoAperto(null)}
        />
      )}

      {percorsoSelezionato && (
        <FormRiscattaPercorso
          percorso={percorsoSelezionato.percorso}
          cliente={percorsoSelezionato.cliente}
          onClose={() => setPercorsoSelezionato(null)}
          onSuccess={async () => {
            setPercorsoSelezionato(null);
            await ricaricaPercorsiClienteCorrente(clienteSelezionato);
            setTab('riscatta');
            setToast({ message: '✅ Scontrino figlio emesso', tipo: 'success' });
          }}
        />
      )}

      {percorsoDaRiscattare && (
        <FormRiscattaPercorso
          percorso={percorsoDaRiscattare.percorso}
          cliente={percorsoDaRiscattare.cliente}
          vociIniziali={overlapInfo && overlapInfo.percorso.percorso.id === percorsoDaRiscattare.percorso.id
            ? overlapInfo.righe.map((r) => ({
                tipo: r.tipo,
                servizio_id: r.servizio_id,
                prodotto_id: r.prodotto_id,
                quantita: r.quantita,
              }))
            : undefined}
          onClose={() => setPercorsoDaRiscattare(null)}
          onSuccess={async () => {
            setPercorsoDaRiscattare(null);
            // Rimuovi dal carrello le righe che erano in overlap
            if (overlapInfo) {
              const idsDaRimuovere = new Set(overlapInfo.righe.map((r) => r.id));
              setCarrello((prev) => prev.filter((r) => !idsDaRimuovere.has(r.id)));
            }
            // Ricarica percorsi del cliente (aggiorna residuo)
            await ricaricaPercorsiClienteCorrente(clienteSelezionato);
            setToast({ message: '✅ Scontrino figlio emesso · Voci rimosse dal carrello', tipo: 'success' });
          }}
        />
      )}

      {showNuovoPercorso && (
        <FormNuovoPercorso
          regime="scontrini"
          onClose={() => setShowNuovoPercorso(false)}
          onSuccess={(percorsoId) => {
            setShowNuovoPercorso(false);
            setTab('cassa');
            setTimeout(() => setTab('riscatta'), 100);
            setToast({ message: `✅ Percorso creato (ID ${percorsoId}) + Scontrino madre emesso`, tipo: 'success' });
          }}
        />
      )}

      {toast && (
        <Toast message={toast.message} tipo={toast.tipo} onComplete={() => setToast(null)} />
      )}
    </div>
  );
}
