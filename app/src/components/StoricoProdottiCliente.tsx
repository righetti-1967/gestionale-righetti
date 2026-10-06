import { useEffect, useState, useMemo } from 'react';
import { getScarichiCliente, type ScaricoSeduta } from '../lib/scarichi';
import type { ScaricoConCliente } from '../lib/scarichi';
import { AnteprimaPdf, IntestazionePdf, BandaBluPdf, FooterPdf } from './AnteprimaPdf';
import { generaPdfDdtCliente } from '../lib/pdfDdt';
import { generaPdfFattura } from '../lib/pdfFattura';
import type { Percorso } from '../lib/percorsi';
import { StampaScontrino } from './StampaScontrino';
import type { Cliente } from '../lib/clienti';
import { useDatiAziendali } from '../lib/useDatiAziendali';
import { getScontrini, type Scontrino } from '../lib/scontrini';
import { getFattureCliente, type Fattura } from '../lib/fatture';

interface StoricoProdottiProps {
  clienteId: number;
}

type TabFiltro = 'tutti' | 'prodotti' | 'servizi' | 'extra' | 'fatture';

interface VoceStorico {
  id: string;
  tipo: 'prodotto' | 'servizio' | 'fattura';
  data: string;
  numeroDdt: number | null;
  numeroFattura: string | null;
  numeroScontrino: string | null;
  anno: number;
  nome: string;
  quantita: number;
  isExtra: boolean;
  importo: number | null;
  pagata: boolean;
  scarico: ScaricoSeduta | null;
  fattura: Fattura | null;
  scontrino: Scontrino | null;
}

export function StoricoProdottiCliente({ clienteId }: StoricoProdottiProps) {
  const { dati: azienda } = useDatiAziendali();
  const regime = azienda.regimeDocumenti || 'fatture';

  const [scarichi, setScarichi] = useState<ScaricoSeduta[]>([]);
  const [fatture, setFatture] = useState<Fattura[]>([]);
  const [scontrini, setScontrini] = useState<Scontrino[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabFiltro>('tutti');
  const [ricerca, setRicerca] = useState('');
  const [ddtAperto, setDdtAperto] = useState<ScaricoSeduta | null>(null);
  const [fatturaAperta, setFatturaAperta] = useState<Fattura | null>(null);
  const [scontrinoAperto, setScontrinoAperto] = useState<Scontrino | null>(null);

  useEffect(() => {
    async function carica() {
      try {
        setLoading(true);

        // Carica SEMPRE tutte e 3 le fonti (indipendentemente dal regime)
        const [tuttiScontrini, dataScarichi, dataFatture] = await Promise.all([
          getScontrini().catch(() => []),
          getScarichiCliente(clienteId).catch(() => []),
          getFattureCliente(clienteId).catch(() => []),
        ]);

        // Filtra scontrini: figli + madre del cliente, non annullati
        const scontriniCliente = tuttiScontrini.filter(
          (s) =>
            s.cliente_id === clienteId &&
            (s.tipo === 'figlio' || s.tipo === 'madre') &&
            !s.annullato
        );

        setScontrini(scontriniCliente);
        setScarichi(dataScarichi);
        setFatture(dataFatture);
      } catch (err) {
        console.error('Errore nel recupero storico cliente:', err);
      } finally {
        setLoading(false);
      }
    }
    carica();
  }, [clienteId]);

  // Estrae sia PRODOTTI che SERVIZI da tutti i DDT del cliente
  const tutteVoci: VoceStorico[] = useMemo(() => {
    const list: VoceStorico[] = [];
    for (const s of scarichi) {
      const anno = new Date(s.data_seduta).getFullYear();
      for (const r of s.righe || []) {
        const isExtra = r.nome.includes('(EXTRA Percorso)');
        const nomePulito = r.nome.replace(' (EXTRA Percorso)', '').trim();

        list.push({
          id: `${s.id}-${r.tipo}-${r.prodotto_id || r.servizio_id}-${Math.random()}`,
          tipo: r.tipo,
          data: s.data_seduta,
          numeroDdt: s.numero_ddt,
          numeroFattura: null,
          numeroScontrino: null,
          anno,
          nome: nomePulito,
          quantita: r.quantita,
          isExtra,
          importo: null,
          pagata: false,
          scarico: s,
          fattura: null,
          scontrino: null,
        });
      }
    }

    // === Regime scontrini: voci dagli scontrini ===
    for (const sc of scontrini) {
      const anno = new Date(sc.data_emissione).getFullYear();
      for (const r of sc.righe || []) {
        // Salta righe di storno e negative
        if (r.quantita <= 0) continue;
        if (r.nome.startsWith('Storno percorso')) continue;

        // Rileva EXTRA Percorso (come per i DDT)
        const isExtra = r.nome.includes('(EXTRA Percorso)');
        const nomePulito = isExtra ? r.nome.replace(' (EXTRA Percorso)', '').trim() : r.nome;

        list.push({
          id: `sc-${sc.id}-${r.tipo}-${r.prodotto_id || r.servizio_id}-${Math.random()}`,
          tipo: r.tipo,
          data: sc.data_emissione,
          numeroDdt: null,
          numeroFattura: null,
          numeroScontrino: sc.numero_scontrino,
          anno,
          nome: nomePulito,
          quantita: r.quantita,
          isExtra,
          importo: null,
          pagata: false,
          scarico: null,
          fattura: null,
          scontrino: sc,
        });
      }
    }

    // === Regime fatture: voci dai DDT ===
    for (const s of scarichi) {
      const anno = new Date(s.data_seduta).getFullYear();
      for (const r of s.righe || []) {
        const isExtra = r.nome.includes('(EXTRA Percorso)');
        const nomePulito = r.nome.replace(' (EXTRA Percorso)', '').trim();

        list.push({
          id: `${s.id}-${r.tipo}-${r.prodotto_id || r.servizio_id}-${Math.random()}`,
          tipo: r.tipo,
          data: s.data_seduta,
          numeroDdt: s.numero_ddt,
          numeroFattura: null,
          numeroScontrino: null,
          anno,
          nome: nomePulito,
          quantita: r.quantita,
          isExtra,
          importo: null,
          pagata: false,
          scarico: s,
          fattura: null,
          scontrino: null,
        });
      }
    }

    // Aggiungi FATTURE (una voce per fattura)
    for (const fatt of fatture) {
      const dataRif = fatt.data_fine || fatt.data_inizio || fatt.created_at;
      const anno = fatt.anno ?? new Date(dataRif).getFullYear();
      list.push({
        id: `fattura-${fatt.id}`,
        tipo: 'fattura',
        data: dataRif,
        numeroDdt: null,
        numeroFattura: fatt.numero_fattura,
        numeroScontrino: null,
        anno,
        nome: `Fattura ${fatt.numero_fattura}`,
        quantita: 1,
        isExtra: false,
        importo: fatt.lordo_ivato,
        pagata: !!fatt.data_incasso,
        scarico: null,
        fattura: fatt,
        scontrino: null,
      });
    }

    // Ordina per data più recente
    return list.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }, [scarichi, fatture, scontrini]);

  // Totale spesa (solo scontrini madre + fatture) + fiches
  const totaleSpesa = useMemo(() => {
    const scontriniMadre = scontrini.filter((s) => s.tipo === 'madre');

    const totScontrini = scontriniMadre.reduce(
      (sum, s) => sum + Number(s.totale_lordo || 0),
      0
    );

    const totFatture = fatture.reduce(
      (sum, f) => sum + Number(f.lordo_ivato || 0),
      0
    );

    const totaleGenerale = totScontrini + totFatture;

    // Conta le fiches: numero di voci (servizi+prodotti) negli scontrini madre + nelle fatture
    let numFiches = 0;

    for (const s of scontriniMadre) {
      for (const r of s.righe || []) {
        numFiches += Number(r.quantita || 0);
      }
    }

    for (const f of fatture) {
      const righeFatt = (f.righe as any[]) || [];
      for (const r of righeFatt) {
        numFiches += Number(r.quantita || 0);
      }
    }

    const fichesMedia = numFiches > 0 ? totaleGenerale / numFiches : 0;
    const numeroDocumenti = scontriniMadre.length + fatture.length;
    const scontrinoMedio =
      numeroDocumenti > 0 ? totaleGenerale / numeroDocumenti : 0;

    return {
      scontrini: Number(totScontrini.toFixed(2)),
      fatture: Number(totFatture.toFixed(2)),
      totale: Number(totaleGenerale.toFixed(2)),
      numFiches,
      fichesMedia: Number(fichesMedia.toFixed(2)),
      numeroDocumenti,
      scontrinoMedio: Number(scontrinoMedio.toFixed(2)),
    };
  }, [scontrini, fatture]);

  // Conteggi
  const totaleProdotti = tutteVoci
    .filter((v) => v.tipo === 'prodotto')
    .reduce((sum, v) => sum + v.quantita, 0);

  const totaleServizi = tutteVoci
    .filter((v) => v.tipo === 'servizio')
    .reduce((sum, v) => sum + v.quantita, 0);

  const totaleExtra = tutteVoci.filter((v) => v.isExtra).length;
  // Conta documenti: fatture + scontrini MADRE (univoci)
  const totaleFatture = useMemo(() => {
    const fattureIds = new Set<string>();
    const scontriniIds = new Set<number>();
    for (const v of tutteVoci) {
      if (v.tipo === 'fattura' && v.fattura) {
        fattureIds.add(`f-${v.fattura.id}`);
      }
      if (v.scontrino && v.scontrino.tipo === 'madre') {
        scontriniIds.add(v.scontrino.id);
      }
    }
    return fattureIds.size + scontriniIds.size;
  }, [tutteVoci]);

  // Filtra per tab e per ricerca
  const vociFiltrate = useMemo(() => {
    return tutteVoci.filter((v) => {
      // Tab 'fatture' = documenti (fatture + scontrini)
      const isDocumento = v.tipo === 'fattura' || v.scontrino !== null;

      if (tab === 'prodotti' && v.tipo !== 'prodotto') return false;
      if (tab === 'servizi' && v.tipo !== 'servizio') return false;
      if (tab === 'extra' && !v.isExtra) return false;
      if (tab !== 'extra' && v.isExtra && tab !== 'tutti' && tab !== 'fatture') return false;
      if (tab === 'fatture' && !isDocumento) return false;
      if (tab !== 'fatture' && isDocumento && tab !== 'tutti') return false;

      if (ricerca.trim()) {
        const q = ricerca.toLowerCase();
        return (
          v.nome.toLowerCase().includes(q) ||
          String(v.numeroDdt).includes(q) ||
          v.data.includes(q)
        );
      }
      return true;
    });
  }, [tutteVoci, tab, ricerca]);

  function formatData(data: string | null): string {
    if (!data) return '—';
    try {
      return new Date(data).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return '—';
    }
  }

  return (
    <div className="bg-white rounded-apple border border-gray-200/80 p-4 space-y-3 shadow-sm">
      {/* Header con titolo e ricerca */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold text-apple-darkgray uppercase tracking-wide flex items-center gap-1.5">
            📋 Storico Sedute & Consegne
          </h3>
          <p className="text-[11px] text-apple-gray mt-0.5">
            Tutti i trattamenti eseguiti e i prodotti ritirati con i relativi DDT.
          </p>
        </div>

        {tutteVoci.length > 3 && (
          <input
            type="text"
            placeholder="Cerca voce o DDT..."
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
            className="px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-apple text-apple-darkgray placeholder:text-apple-gray focus:outline-none focus:ring-2 focus:ring-apple-blue/30 w-full sm:w-48"
          />
        )}
      </div>

      {/* Segmented control stile Apple per passare da Tutti / Prodotti / Servizi */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-apple w-fit">
        <button
          type="button"
          onClick={() => setTab('tutti')}
          className={`px-3 py-1 rounded-apple text-xs font-semibold transition-all ${
            tab === 'tutti'
              ? 'bg-white text-apple-darkgray shadow-sm'
              : 'text-apple-gray hover:text-apple-darkgray'
          }`}
        >
          Tutti ({tutteVoci.length})
        </button>

        <button
          type="button"
          onClick={() => setTab('prodotti')}
          className={`px-3 py-1 rounded-apple text-xs font-semibold transition-all ${
            tab === 'prodotti'
              ? 'bg-white text-apple-darkgray shadow-sm'
              : 'text-apple-gray hover:text-apple-darkgray'
          }`}
        >
          📦 Prodotti ({totaleProdotti})
        </button>

        <button
          type="button"
          onClick={() => setTab('servizi')}
          className={`px-3 py-1 rounded-apple text-xs font-semibold transition-all ${
            tab === 'servizi'
              ? 'bg-white text-apple-darkgray shadow-sm'
              : 'text-apple-gray hover:text-apple-darkgray'
          }`}
        >
          🛠️ Servizi ({totaleServizi})
        </button>

        {totaleExtra > 0 && (
          <button
            type="button"
            onClick={() => setTab('extra')}
            className={`px-3 py-1 rounded-apple text-xs font-semibold transition-all ${
              tab === 'extra'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-amber-700 hover:text-amber-900'
            }`}
          >
            ⭐ EXTRA ({totaleExtra})
          </button>
        )}

        {totaleFatture > 0 && (
          <button
            type="button"
            onClick={() => setTab('fatture')}
            className={`px-3 py-1 rounded-apple text-xs font-semibold transition-all ${
              tab === 'fatture'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-blue-700 hover:text-blue-900'
            }`}
          >
            📄 Fatture & Scontrini ({totaleFatture})
          </button>
        )}
      </div>

      {/* Lista risultati */}
      {loading ? (
        <p className="text-xs text-apple-gray py-4 text-center">Caricamento storico...</p>
      ) : tutteVoci.length === 0 ? (
        <div className="bg-gray-50 rounded-apple p-4 text-center">
          <p className="text-xs text-apple-gray">
            Nessuna seduta o prodotto ancora registrato per questo cliente.
          </p>
        </div>
      ) : vociFiltrate.length === 0 ? (
        <p className="text-xs text-apple-gray py-3 text-center">
          Nessuna voce trovata per questa categoria o ricerca.
        </p>
      ) : (
        <div className="bg-gray-50 rounded-apple overflow-hidden divide-y divide-gray-200/80 max-h-64 overflow-y-auto border border-gray-200/60">
          {vociFiltrate.map((item, idx) => {
            const numDdtFormattato = `DDT-${String(item.numeroDdt).padStart(3, '0')}-${item.anno}`;
            return (
              <div
                key={idx}
                className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-blue-50/40 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm shrink-0">
                      {item.tipo === 'servizio' ? '🛠️' : '📦'}
                    </span>
                    <p className="font-semibold text-apple-darkgray truncate">
                      {item.nome}
                    </p>
                    {item.isExtra && (
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                        EXTRA
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-apple-gray mt-0.5">
                    📅 {formatData(item.data)} •{' '}
                    {item.tipo === 'fattura' && item.fattura ? (
                      <button
                        type="button"
                        onClick={() => setFatturaAperta(item.fattura)}
                        className="font-medium text-apple-blue hover:underline"
                        title="Apri fattura"
                      >
                        📄 {item.numeroFattura}
                      </button>
                    ) : item.scontrino ? (
                      <button
                        type="button"
                        onClick={() => setScontrinoAperto(item.scontrino)}
                        className="font-medium text-apple-blue hover:underline"
                        title="Apri scontrino"
                      >
                        🧾 {item.numeroScontrino}
                      </button>
                    ) : item.scarico ? (
                      <button
                        type="button"
                        onClick={() => setDdtAperto(item.scarico)}
                        className="font-medium text-apple-blue hover:underline"
                        title="Apri DDT"
                      >
                        {numDdtFormattato}
                      </button>
                    ) : (
                      <span className="font-medium text-apple-blue">{numDdtFormattato}</span>
                    )}
                  </p>
                </div>

                <div className="shrink-0 text-right flex items-center gap-2">
                  {item.tipo === 'fattura' && item.importo != null && (
                    <>
                      <span className="text-xs font-bold text-apple-darkgray">
                        € {item.importo.toFixed(2)}
                      </span>
                      {item.pagata && (
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
                          Pagata
                        </span>
                      )}
                    </>
                  )}
                  {item.tipo !== 'fattura' && (
                    <span className="font-bold text-xs bg-white px-2.5 py-1 rounded-apple border border-gray-200 text-apple-darkgray shadow-sm">
                      {item.tipo === 'servizio'
                        ? `${item.quantita} seduta`
                        : `× ${item.quantita}`}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* Modale Anteprima DDT */}
      {ddtAperto && (
        <AnteprimaDdtMinimale
          scarico={ddtAperto}
          onClose={() => setDdtAperto(null)}
        />
      )}

      {/* Modale Anteprima Fattura */}
      {fatturaAperta && (
        <AnteprimaFatturaMinimale
          fattura={fatturaAperta}
          onClose={() => setFatturaAperta(null)}
        />
      )}

      {/* Modale Stampa Scontrino */}
      {scontrinoAperto && (
        <StampaScontrino
          scontrino={scontrinoAperto}
          onClose={() => setScontrinoAperto(null)}
          onAnnullato={() => {
            setScontrinoAperto(null);
            // Ricarica per aggiornare lo storico
            window.location.reload();
          }}
        />
      )}

    </div>
  );
}


// ============================================================
// MODALE ANTEPRIMA DDT (minimale: anteprima + scarica + chiudi)
// ============================================================
function AnteprimaDdtMinimale({
  scarico,
  onClose,
}: {
  scarico: ScaricoSeduta;
  onClose: () => void;
}) {
  const anno = new Date(scarico.data_seduta).getFullYear();
  const numeroFormattato = `DDT-${String(scarico.numero_ddt).padStart(3, '0')}-${anno}`;
  const cliente = (scarico as unknown as { cliente?: Cliente }).cliente;
  const dataFormattata = new Date(scarico.data_seduta).toLocaleDateString('it-IT');

  function formatEuro(n: number): string {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
  }

  async function handleScarica() {
    try {
      // Scarico "fittizio" — il PDF viene generato dallo scarico + cliente
      const percorsoFittizio = {
        id: 0,
        cliente_id: scarico.cliente_id,
        fattura_id: scarico.fattura_madre_id,
        nome: '',
        data_inizio: '',
        data_fine: '',
        righe: [],
        totale_listino: 0,
        totale_finale: 0,
        sconto_percentuale: 0,
        terminato: false,
        terminato_manualmente: false,
        bloccato: false,
        motivo_blocco: null,
        note: null,
        created_at: '',
      } as unknown as Percorso;

      const clientePerPdf = cliente as unknown as Cliente;
      await generaPdfDdtCliente(scarico as unknown as ScaricoConCliente, percorsoFittizio, clientePerPdf);
      onClose();
    } catch (err) {
      window.alert('Errore generazione PDF: ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  return (
    <AnteprimaPdf
      titolo={`Anteprima DDT`}
      sottotitolo={`${numeroFormattato} · ${cliente?.nome_cognome || ''}`}
      onScarica={handleScarica}
      labelScarica="📄 Scarica PDF"
      onClose={onClose}
    >
      <IntestazionePdf />
      <BandaBluPdf testo={`SEDUTA IN STUDIO | ${numeroFormattato}`} anno={anno} />

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase mb-1">DATI DDT</p>
          <p className="text-sm">Data seduta: {dataFormattata}</p>
        </div>
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase mb-1">CLIENTE</p>
          <p className="text-sm font-bold">{cliente?.nome_cognome || '—'}</p>
        </div>
      </div>

      <p className="text-xs font-bold text-gray-500 uppercase mb-2">VOCI</p>
      <table className="w-full mb-6 text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="text-left px-2 py-2 font-semibold text-gray-700">Descrizione</th>
            <th className="text-center px-2 py-2 font-semibold text-gray-700 w-16">Qta</th>
          </tr>
        </thead>
        <tbody>
          {(scarico.righe || []).length > 0 ? (
            (scarico.righe || []).map((r, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="px-2 py-2">{r.nome}</td>
                <td className="text-center px-2 py-2">{r.quantita}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={2} className="px-2 py-4 text-center text-gray-400 italic">
                (nessuna voce)
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <FooterPdf />
    </AnteprimaPdf>
  );
}

// ============================================================
// MODALE ANTEPRIMA FATTURA (minimale: anteprima + scarica + chiudi)
// ============================================================
function AnteprimaFatturaMinimale({
  fattura,
  onClose,
}: {
  fattura: Fattura;
  onClose: () => void;
}) {
  const cliente = (fattura as unknown as { cliente?: Cliente }).cliente;
  const pagata = !!fattura.data_incasso;

  function formatEuro(n: number): string {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
  }

  function formatData(d: string | null): string {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString('it-IT');
    } catch {
      return '—';
    }
  }

  async function handleScarica() {
    try {
      await generaPdfFattura(fattura as unknown as Parameters<typeof generaPdfFattura>[0]);
      onClose();
    } catch (err) {
      window.alert('Errore generazione PDF: ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  return (
    <AnteprimaPdf
      titolo={pagata ? 'Anteprima Fattura' : 'Anteprima Proforma'}
      sottotitolo={`${fattura.numero_fattura} · ${cliente?.nome_cognome || ''}`}
      onScarica={handleScarica}
      labelScarica="📄 Scarica PDF"
      onClose={onClose}
    >
      <IntestazionePdf />

      {!pagata && (
        <div className="text-right text-orange-600 font-bold text-base -mt-4 mb-2">
          PROFORMA
        </div>
      )}

      <BandaBluPdf
        testo={`FATTURA N. ${fattura.numero_fattura}`}
        anno={fattura.anno || new Date().getFullYear()}
      />

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase mb-1">DATI FATTURA</p>
          <p className="text-sm">Data fattura: {formatData(fattura.data_inizio)}</p>
          <p className="text-sm">Data incasso: {formatData(fattura.data_incasso)}</p>
          {fattura.metodo_pagamento && (
            <p className="text-sm font-semibold text-apple-blue">
              Pagamento: {fattura.metodo_pagamento}
            </p>
          )}
        </div>
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase mb-1">CLIENTE</p>
          <p className="text-sm font-bold">{cliente?.nome_cognome || '—'}</p>
        </div>
      </div>

      <p className="text-xs font-bold text-gray-500 uppercase mb-2">RIGHE FATTURA</p>
      <table className="w-full mb-6 text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="text-left px-2 py-2 font-semibold text-gray-700">Descrizione</th>
            <th className="text-center px-2 py-2 font-semibold text-gray-700 w-16">Qta</th>
            <th className="text-right px-2 py-2 font-semibold text-gray-700 w-24">Prezzo</th>
            <th className="text-right px-2 py-2 font-semibold text-gray-700 w-24">Totale</th>
          </tr>
        </thead>
        <tbody>
          {fattura.righe && fattura.righe.length > 0 ? (
            fattura.righe.map((riga, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="px-2 py-2">{riga.nome}</td>
                <td className="text-center px-2 py-2">{riga.quantita}</td>
                <td className="text-right px-2 py-2">{formatEuro(riga.prezzo_unitario_lordo)}</td>
                <td className="text-right px-2 py-2 font-semibold">
                  {formatEuro(riga.quantita * riga.prezzo_unitario_lordo)}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={4} className="px-2 py-4 text-center text-gray-400 italic">
                (nessuna riga)
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="flex justify-end mb-6">
        <div className="space-y-1 min-w-[220px]">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Netto imponibile</span>
            <span className="font-semibold">{formatEuro(Number(fattura.netto_imponibile))}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">IVA 22%</span>
            <span className="font-semibold">{formatEuro(Number(fattura.iva_importo))}</span>
          </div>
          <div className="flex justify-between text-base font-bold border-t-2 border-gray-300 pt-1">
            <span>Totale</span>
            <span>{formatEuro(Number(fattura.lordo_ivato))}</span>
          </div>
        </div>
      </div>

      {fattura.dicitura_legale && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-xs font-bold text-gray-500 uppercase mb-1">NOTE DOCUMENTO</p>
          <p className="text-xs text-gray-700">{fattura.dicitura_legale}</p>
        </div>
      )}

      <FooterPdf />
    </AnteprimaPdf>
  );
}
