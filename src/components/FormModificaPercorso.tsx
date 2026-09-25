import { useEffect, useState } from 'react';
import type { Cliente } from '../lib/clienti';
import { getServizi, type Servizio } from '../lib/servizi';
import { getProdotti, type Prodotto } from '../lib/prodotti';
import { aggiornaPercorso, type Percorso } from '../lib/percorsi';
import { aggiornaFattura } from '../lib/fatture';
import { calcolaPercorso, formatEuro, type RigaPercorso } from '../lib/percorsi-helper';

interface FormModificaPercorsoProps {
  percorso: Percorso;
  cliente: Cliente | null;
  proformaIncassata: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface RigaBase {
  tipo: 'servizio' | 'prodotto';
  servizio_id: number | null;
  prodotto_id: number | null;
  nome: string;
  quantita: number;
  prezzo_listino_lordo: number;
}

export function FormModificaPercorso({
  percorso,
  cliente,
  proformaIncassata,
  onClose,
  onSuccess,
}: FormModificaPercorsoProps) {
  const [servizi, setServizi] = useState<Servizio[]>([]);
  const [prodotti, setProdotti] = useState<Prodotto[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const [nome, setNome] = useState(percorso.nome);
  const [dataInizio, setDataInizio] = useState(percorso.data_inizio);
  const [dataFine, setDataFine] = useState(percorso.data_fine);
  const [righeBase, setRigheBase] = useState<RigaBase[]>(
    (percorso.righe || []).map((r) => ({
      tipo: r.tipo,
      servizio_id: r.servizio_id,
      prodotto_id: r.prodotto_id,
      nome: r.nome,
      quantita: r.quantita,
      prezzo_listino_lordo: Number(r.prezzo_listino_lordo) || 0,
    }))
  );
  const [totaleFinale, setTotaleFinale] = useState<string>(
    String(percorso.totale_finale)
  );
  const [note, setNote] = useState(percorso.note || '');

  const [showServiziPicker, setShowServiziPicker] = useState(false);
  const [showProdottiPicker, setShowProdottiPicker] = useState(false);

  const soloNote = proformaIncassata;

  useEffect(() => {
    async function carica() {
      try {
        setLoading(true);
        const [s, p] = await Promise.all([getServizi(), getProdotti()]);
        setServizi(s);
        setProdotti(p);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setErrore(msg);
      } finally {
        setLoading(false);
      }
    }
    carica();
  }, []);

  function aggiungiServiziMultipli(ids: number[]) {
    setRigheBase((prev) => {
      const nuove = [...prev];
      for (const id of ids) {
        const s = servizi.find((x) => x.id === id);
        if (!s) continue;
        const esistente = nuove.findIndex(
          (r) => r.tipo === 'servizio' && r.servizio_id === s.id
        );
        if (esistente >= 0) {
          nuove[esistente].quantita += 1;
        } else {
          nuove.push({
            tipo: 'servizio',
            servizio_id: s.id,
            prodotto_id: null,
            nome: s.nome,
            quantita: 1,
            prezzo_listino_lordo: Number(s.prezzo_lordo) || 0,
          });
        }
      }
      return nuove;
    });
    setShowServiziPicker(false);
  }

  function aggiungiProdottiMultipli(ids: number[]) {
    setRigheBase((prev) => {
      const nuove = [...prev];
      for (const id of ids) {
        const p = prodotti.find((x) => x.id === id);
        if (!p) continue;
        const esistente = nuove.findIndex(
          (r) => r.tipo === 'prodotto' && r.prodotto_id === p.id
        );
        if (esistente >= 0) {
          nuove[esistente].quantita += 1;
        } else {
          nuove.push({
            tipo: 'prodotto',
            servizio_id: null,
            prodotto_id: p.id,
            nome: p.nome,
            quantita: 1,
            prezzo_listino_lordo: Number(p.prezzo_lordo) || 0,
          });
        }
      }
      return nuove;
    });
    setShowProdottiPicker(false);
  }

  function rimuoviRiga(index: number) {
    setRigheBase((prev) => prev.filter((_, i) => i !== index));
  }

  function aggiornaQuantita(index: number, quantita: number) {
    if (quantita < 1) return;
    setRigheBase((prev) => {
      const nuove = [...prev];
      nuove[index].quantita = quantita;
      return nuove;
    });
  }

  function aggiornaPrezzoUnitario(index: number, prezzo: number) {
    setRigheBase((prev) => {
      const nuove = [...prev];
      nuove[index].prezzo_listino_lordo = Math.max(0, prezzo);
      return nuove;
    });
  }

  const totaleListino = righeBase.reduce(
    (sum, r) => sum + r.quantita * r.prezzo_listino_lordo,
    0
  );
  const totaleFinaleNum = parseFloat(totaleFinale) || 0;
  const scontoPercentuale =
    totaleListino > 0
      ? Number((((totaleListino - totaleFinaleNum) / totaleListino) * 100).toFixed(2))
      : 0;

  async function handleSubmit() {
    if (soloNote) {
      try {
        setSalvando(true);
        setErrore(null);
        await aggiornaPercorso(percorso.id, { note: note.trim() || null });
        onSuccess();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setErrore(msg || 'Errore nel salvataggio');
      } finally {
        setSalvando(false);
      }
      return;
    }

    if (!nome.trim()) {
      setErrore('Inserisci un nome per il percorso');
      return;
    }
    if (!dataInizio || !dataFine) {
      setErrore('Inserisci data inizio e data fine');
      return;
    }
    if (righeBase.length === 0) {
      setErrore('Aggiungi almeno un servizio o prodotto');
      return;
    }
    if (totaleFinaleNum <= 0) {
      setErrore('Inserisci il prezzo finale del percorso');
      return;
    }
    if (totaleFinaleNum > totaleListino) {
      setErrore('Il prezzo finale non può essere maggiore del totale di listino');
      return;
    }

    try {
      setSalvando(true);
      setErrore(null);

      const calcolato = calcolaPercorso(righeBase, totaleFinaleNum);

      // 1) Aggiorna il percorso
      await aggiornaPercorso(percorso.id, {
        nome: nome.trim(),
        data_inizio: dataInizio,
        data_fine: dataFine,
        righe: calcolato.righe,
        totale_listino: calcolato.totale_listino,
        totale_finale: calcolato.totale_finale,
        sconto_percentuale: calcolato.sconto_percentuale,
        note: note.trim() || null,
      });

      // 2) Se esiste una proforma collegata (non ancora incassata) aggiorna anche lei
      if (percorso.fattura_id) {
        const lordo = calcolato.totale_finale;
        const netto = Number((lordo / 1.22).toFixed(2));
        const iva = Number((lordo - netto).toFixed(2));

        const righeFattura = calcolato.righe.map((r: RigaPercorso) => ({
          tipo: r.tipo,
          servizio_id: r.servizio_id,
          prodotto_id: r.prodotto_id,
          percorso_id: percorso.id,
          nome: r.nome,
          quantita: r.quantita,
          prezzo_unitario_lordo: r.prezzo_scontato_lordo,
        }));

        await aggiornaFattura(percorso.fattura_id, {
          righe: righeFattura,
          lordo_ivato: lordo,
          netto_imponibile: netto,
          iva_importo: iva,
          data_inizio: dataInizio,
          data_fine: dataFine,
        });
      }

      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrore(msg || 'Errore nel salvataggio');
    } finally {
      setSalvando(false);
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-apple shadow-apple-lg p-8">
          <div className="text-apple-gray text-sm">Caricamento dati...</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white sm:rounded-apple rounded-t-3xl shadow-apple-lg w-full sm:max-w-3xl max-h-[95vh] sm:my-8 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-200/60 shrink-0">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-apple-darkgray">
              Modifica Percorso
            </h2>
            <p className="text-xs text-apple-gray">
              {cliente?.nome_cognome || '—'} • ID {percorso.id}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-apple-gray transition-colors shrink-0"
            aria-label="Chiudi"
          >
            ✕
          </button>
        </div>

        {/* Corpo */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6"
        >
          {soloNote && (
            <div className="bg-amber-50 border border-amber-200 rounded-apple p-3">
              <p className="text-xs text-amber-800 leading-relaxed">
                ⚠️ <strong>Modifica limitata</strong>: la fattura collegata è già stata
                incassata, quindi il percorso è fiscalmente "congelato". Puoi modificare
                <strong> solo le note</strong>.
              </p>
            </div>
          )}

          {/* Info base */}
          <div>
            <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-3">
              Informazioni Base
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label>Cliente</Label>
                <div className="w-full px-4 py-3 sm:py-2.5 bg-gray-50 border border-gray-200 rounded-apple text-sm text-apple-gray">
                  {cliente?.nome_cognome || '—'} <span className="text-xs">(non modificabile)</span>
                </div>
              </div>
              <div className="sm:col-span-2">
                <Label required>Nome Percorso</Label>
                <Input
                  value={nome}
                  onChange={setNome}
                  placeholder="es. Percorso Tricologico 6 Mesi"
                  disabled={soloNote}
                />
              </div>
              <div>
                <Label required>Data Inizio</Label>
                <Input type="date" value={dataInizio} onChange={setDataInizio} disabled={soloNote} />
              </div>
              <div>
                <Label required>Data Fine</Label>
                <Input type="date" value={dataFine} onChange={setDataFine} disabled={soloNote} />
              </div>
            </div>
          </div>

          {/* Servizi */}
          {!soloNote && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide">
                  🛠️ Servizi Inclusi ({righeBase.filter((r) => r.tipo === 'servizio').length})
                </h3>
                <button
                  type="button"
                  onClick={() => setShowServiziPicker(true)}
                  className="text-xs text-apple-blue hover:underline font-medium"
                >
                  + Aggiungi Servizi
                </button>
              </div>
              <div className="bg-gray-50 rounded-apple overflow-hidden">
                {righeBase.filter((r) => r.tipo === 'servizio').length === 0 ? (
                  <p className="px-4 py-6 text-center text-xs text-apple-gray">
                    Nessun servizio. Clicca "+ Aggiungi Servizi"
                  </p>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {righeBase.map((r, i) =>
                      r.tipo === 'servizio' ? (
                        <RigaItem
                          key={i}
                          riga={r}
                          onQuantita={(q) => aggiornaQuantita(i, q)}
                          onPrezzo={(p) => aggiornaPrezzoUnitario(i, p)}
                          onRimuovi={() => rimuoviRiga(i)}
                        />
                      ) : null
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Prodotti */}
          {!soloNote && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide">
                  📦 Prodotti Inclusi ({righeBase.filter((r) => r.tipo === 'prodotto').length})
                </h3>
                <button
                  type="button"
                  onClick={() => setShowProdottiPicker(true)}
                  className="text-xs text-apple-blue hover:underline font-medium"
                >
                  + Aggiungi Prodotti
                </button>
              </div>
              <div className="bg-gray-50 rounded-apple overflow-hidden">
                {righeBase.filter((r) => r.tipo === 'prodotto').length === 0 ? (
                  <p className="px-4 py-6 text-center text-xs text-apple-gray">
                    Nessun prodotto. Clicca "+ Aggiungi Prodotti"
                  </p>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {righeBase.map((r, i) =>
                      r.tipo === 'prodotto' ? (
                        <RigaItem
                          key={i}
                          riga={r}
                          onQuantita={(q) => aggiornaQuantita(i, q)}
                          onPrezzo={(p) => aggiornaPrezzoUnitario(i, p)}
                          onRimuovi={() => rimuoviRiga(i)}
                        />
                      ) : null
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Riepilogo */}
          {!soloNote && (
            <div className="bg-blue-50 border border-blue-200 rounded-apple p-4 space-y-3">
              <h3 className="text-xs font-semibold text-apple-blue uppercase tracking-wide">
                💰 Riepilogo Economico
              </h3>
              <div className="flex items-center justify-between text-sm">
                <span className="text-apple-gray">Totale di listino</span>
                <span className="font-semibold text-apple-darkgray">
                  {formatEuro(totaleListino)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-apple-gray">Prezzo finale concordato</span>
                <input
                  type="number"
                  value={totaleFinale}
                  onChange={(e) => setTotaleFinale(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="w-40 px-3 py-2 bg-white border border-gray-200 rounded-apple text-sm font-bold text-apple-darkgray text-right focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
                />
              </div>
              {totaleFinaleNum > 0 && (
                <div className="flex items-center justify-between text-sm pt-2 border-t border-blue-200">
                  <span className="text-apple-gray">Sconto applicato</span>
                  <span className="font-bold text-apple-blue">
                    {scontoPercentuale.toFixed(2)} %
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Note */}
          <div>
            <Label>Note interne (opzionali)</Label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note private sul percorso..."
              rows={3}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all resize-none"
            />
          </div>

          {errore && (
            <div className="bg-red-50 border border-red-200 rounded-apple p-3 text-red-700 text-sm">
              ❌ {errore}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex gap-3 px-5 sm:px-6 py-4 border-t border-gray-200/60 bg-gray-50/50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-3 sm:py-2.5 bg-gray-100 text-apple-darkgray rounded-apple font-medium text-sm hover:bg-gray-200 transition-colors"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={salvando}
            className="flex-1 px-4 py-3 sm:py-2.5 bg-apple-blue text-white rounded-apple font-medium text-sm hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {salvando ? 'Salvataggio...' : 'Salva Modifiche'}
          </button>
        </div>

        {/* Picker Servizi */}
        {showServiziPicker && (
          <PickerMultiplo
            titolo="Aggiungi Servizi"
            elementi={servizi.map((s) => ({
              id: s.id,
              nome: s.nome,
              prezzo: s.prezzo_lordo,
              info: `${s.durata_minuti} min`,
            }))}
            onConfirm={aggiungiServiziMultipli}
            onClose={() => setShowServiziPicker(false)}
          />
        )}

        {/* Picker Prodotti */}
        {showProdottiPicker && (
          <PickerMultiplo
            titolo="Aggiungi Prodotti"
            elementi={prodotti.map((p) => ({
              id: p.id,
              nome: p.nome,
              prezzo: p.prezzo_lordo,
              info: `Giacenza: ${p.giacenza}`,
            }))}
            onConfirm={aggiungiProdottiMultipli}
            onClose={() => setShowProdottiPicker(false)}
          />
        )}
      </div>
    </div>
  );
}

// === Componenti helper ===

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-medium text-apple-gray mb-1.5">
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={`w-full px-4 py-3 sm:py-2.5 border border-gray-200 rounded-apple text-sm placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all ${
        disabled
          ? 'bg-gray-50 text-apple-gray cursor-not-allowed'
          : 'bg-white text-apple-darkgray'
      }`}
    />
  );
}

function RigaItem({
  riga,
  onQuantita,
  onPrezzo,
  onRimuovi,
}: {
  riga: RigaBase;
  onQuantita: (q: number) => void;
  onPrezzo: (p: number) => void;
  onRimuovi: () => void;
}) {
  const totale = riga.quantita * riga.prezzo_listino_lordo;
  return (
    <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white hover:bg-blue-50/30 transition-colors">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-apple-darkgray truncate">{riga.nome}</p>
        <span className="text-[10px] font-bold uppercase text-apple-gray">
          {riga.tipo === 'servizio' ? '🛠️ Servizio' : '📦 Prodotto'}
        </span>
      </div>

      <div className="flex items-center gap-3 self-end sm:self-center">
        {/* Prezzo Unitario Modificabile */}
        <div className="flex items-center gap-1">
          <input
            type="number"
            step="0.01"
            min="0"
            value={riga.prezzo_listino_lordo}
            onChange={(e) => onPrezzo(parseFloat(e.target.value) || 0)}
            className="w-20 px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-apple text-xs font-bold text-apple-darkgray text-right focus:outline-none focus:ring-2 focus:ring-apple-blue/30"
            title="Prezzo unitario lordo di listino"
          />
          <span className="text-xs text-apple-gray">€ cad.</span>
        </div>

        {/* Quantità (Digitabile + Pulsanti - e +) */}
        <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-apple">
          <button
            type="button"
            onClick={() => onQuantita(Math.max(1, riga.quantita - 1))}
            className="w-6 h-6 rounded-md bg-white hover:bg-gray-200 flex items-center justify-center text-apple-darkgray text-xs font-bold transition-colors"
          >
            −
          </button>
          <input
            type="number"
            min="1"
            value={riga.quantita}
            onChange={(e) => onQuantita(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-10 px-1 py-0.5 bg-transparent text-xs text-center font-bold text-apple-darkgray focus:outline-none"
            title="Quantità"
          />
          <button
            type="button"
            onClick={() => onQuantita(riga.quantita + 1)}
            className="w-6 h-6 rounded-md bg-white hover:bg-gray-200 flex items-center justify-center text-apple-darkgray text-xs font-bold transition-colors"
          >
            +
          </button>
        </div>

        {/* Totale riga */}
        <div className="w-24 text-right text-sm font-bold text-apple-darkgray">
          {formatEuro(totale)}
        </div>

        {/* Elimina */}
        <button
          type="button"
          onClick={onRimuovi}
          className="w-7 h-7 rounded-full bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-500 text-xs transition-colors shrink-0"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}

function PickerMultiplo({
  titolo,
  elementi,
  onConfirm,
  onClose,
}: {
  titolo: string;
  elementi: { id: number; nome: string; prezzo: number; info: string }[];
  onConfirm: (ids: number[]) => void;
  onClose: () => void;
}) {
  const [ricerca, setRicerca] = useState('');
  const [selezionati, setSelezionati] = useState<Set<number>>(new Set());

  const filtrati = elementi.filter((e) =>
    e.nome.toLowerCase().includes(ricerca.toLowerCase())
  );

  function toggle(id: number) {
    setSelezionati((prev) => {
      const nuove = new Set(prev);
      if (nuove.has(id)) nuove.delete(id);
      else nuove.add(id);
      return nuove;
    });
  }

  function selezionaTutti() {
    setSelezionati(new Set(filtrati.map((e) => e.id)));
  }

  function deselezionaTutti() {
    setSelezionati(new Set());
  }

  function conferma() {
    if (selezionati.size === 0) {
      onClose();
      return;
    }
    onConfirm(Array.from(selezionati));
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[60]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-apple shadow-apple-lg max-w-md w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-200/60">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-apple-darkgray">{titolo}</h3>
            <span className="text-xs text-apple-gray">
              {selezionati.size} selezionati
            </span>
          </div>
          <input
            type="text"
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
            placeholder="Cerca..."
            autoFocus
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 transition-all"
          />
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={selezionaTutti}
              className="text-xs text-apple-blue hover:underline font-medium"
            >
              Seleziona tutti
            </button>
            <span className="text-xs text-apple-gray">·</span>
            <button
              type="button"
              onClick={deselezionaTutti}
              className="text-xs text-apple-gray hover:underline"
            >
              Deseleziona
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {filtrati.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-apple-gray">
              Nessun risultato
            </p>
          ) : (
            filtrati.map((e) => {
              const isSelezionato = selezionati.has(e.id);
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => toggle(e.id)}
                  className={`w-full px-5 py-3 flex items-center gap-3 transition-colors text-left ${
                    isSelezionato ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                      isSelezionato
                        ? 'bg-apple-blue border-apple-blue'
                        : 'border-gray-300'
                    }`}
                  >
                    {isSelezionato && (
                      <span className="text-white text-xs font-bold">✓</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-apple-darkgray truncate">
                      {e.nome}
                    </p>
                    <p className="text-xs text-apple-gray">{e.info}</p>
                  </div>
                  <span className="text-sm font-semibold text-apple-blue shrink-0">
                    {formatEuro(e.prezzo)}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-200/60 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-gray-100 text-apple-darkgray rounded-apple font-medium text-sm hover:bg-gray-200 transition-colors"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={conferma}
            disabled={selezionati.size === 0}
            className="flex-1 px-4 py-2.5 bg-apple-blue text-white rounded-apple font-medium text-sm hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {selezionati.size === 0
              ? 'Seleziona almeno 1'
              : `Aggiungi ${selezionati.size}`}
          </button>
        </div>
      </div>
    </div>
  );
}
