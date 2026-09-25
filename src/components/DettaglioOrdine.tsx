import { useState } from 'react';
import {
  eliminaOrdine,
  aggiornaStatoOrdine,
  type OrdineConFornitore,
} from '../lib/ordini';
import { generaPdfOrdine } from '../lib/pdfOrdine';
import { creaMovimento } from '../lib/magazzino';
import { formatEuro } from '../lib/fatture';
import type { ToastTipo } from './Toast';
import {
  AnteprimaPdf,
  IntestazionePdf,
  BandaBluPdf,
  FooterPdf,
} from './AnteprimaPdf';
import { useDatiAziendali } from '../lib/useDatiAziendali';
import { formatSede } from '../lib/studio';

interface DettaglioOrdineProps {
  ordine: OrdineConFornitore;
  onClose: () => void;
  onUpdated: () => void;
  onToast: (msg: string, tipo: ToastTipo) => void;
}

export function DettaglioOrdine({
  ordine,
  onClose,
  onUpdated,
  onToast,
}: DettaglioOrdineProps) {
  const { dati: azienda } = useDatiAziendali();
  const [salvando, setSalvando] = useState(false);
  const [showConfermaElimina, setShowConfermaElimina] = useState(false);
  const [showConfermaRicevi, setShowConfermaRicevi] = useState(false);
  const [showAnteprima, setShowAnteprima] = useState(false);
  const [quantitaEffettive, setQuantitaEffettive] = useState<Record<number, number>>({});

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

  async function handleScaricaPdf() {
    try {
      await generaPdfOrdine(ordine);
      onToast('PDF generato', 'success');
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : 'Errore nella generazione PDF',
        'error'
      );
    }
  }

  async function handleInvia(canale: 'email' | 'whatsapp') {
    try {
      const campo =
        canale === 'email' ? 'inviato_email_at' : 'inviato_whatsapp_at';
      const dataISO = new Date().toISOString();

      // Se l'ordine è già "ricevuto" o "annullato", NON cambiare lo stato
      // (altrimenti lo riporteresti indietro)
      if (ordine.stato === 'ricevuto' || ordine.stato === 'annullato') {
        // Aggiorno solo il timestamp di invio
        const { supabase } = await import('../lib/supabase');
        await supabase
          .from('ordini_fornitore')
          .update({ [campo]: dataISO })
          .eq('id', ordine.id);
      } else {
        // Altrimenti porto a "inviato"
        await aggiornaStatoOrdine(ordine.id, 'inviato', {
          [campo]: dataISO,
        } as Partial<OrdineConFornitore>);
      }

      const label = canale === 'email' ? 'Email' : 'WhatsApp';
      onToast(`📧 Invio ${label} in arrivo`, 'info');
      onUpdated();
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : 'Errore',
        'error'
      );
    }
  }

  async function handleRicevi() {
    try {
      setSalvando(true);

      // 1) Crea un movimento di carico per ogni riga con la quantità EFFETTIVA
      let righeCaricate = 0;
      for (const riga of ordine.righe || []) {
        const quantita = quantitaEffettive[riga.id] ?? riga.quantita;
        if (quantita <= 0) continue; // Salta righe con 0

        await creaMovimento({
          prodotto_id: riga.prodotto_id,
          tipo: 'carico',
          quantita,
          motivo: `Riordino ${ordine.numero_ordine}`,
          note: `Ricevuto ordine per ${ordine.fornitore?.ragione_sociale || ''}`,
          data_movimento: new Date().toISOString().split('T')[0],
        });
        righeCaricate += 1;
      }

      // 2) Segna l'ordine come ricevuto
      await aggiornaStatoOrdine(ordine.id, 'ricevuto', {
        ricevuto_at: new Date().toISOString(),
      } as Partial<OrdineConFornitore>);

      onToast(
        `Ordine ricevuto! ${righeCaricate} prodotti caricati a magazzino`,
        'success'
      );
      onUpdated();
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : 'Errore nel carico',
        'error'
      );
      setSalvando(false);
      setShowConfermaRicevi(false);
    }
  }

  async function handleElimina() {
    try {
      setSalvando(true);
      await eliminaOrdine(ordine.id);
      onToast('Ordine eliminato', 'success');
      onUpdated();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Errore', 'error');
      setSalvando(false);
      setShowConfermaElimina(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-apple shadow-apple-lg max-w-2xl w-full my-8 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-apple bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-2xl">
              📦
            </div>
            <div>
              <h2 className="text-xl font-bold text-apple-darkgray">
                {ordine.numero_ordine}
              </h2>
              <p className="text-xs text-apple-gray">
                {ordine.fornitore?.ragione_sociale || '—'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-apple-gray transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Stato attuale */}
        <div className="mb-6">
          <span
            className={`inline-flex text-sm font-semibold px-3 py-1.5 rounded-full ${
              ordine.stato === 'bozza'
                ? 'bg-gray-100 text-apple-darkgray'
                : ordine.stato === 'inviato'
                ? 'bg-blue-100 text-apple-blue'
                : ordine.stato === 'ricevuto'
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {ordine.stato === 'bozza' && '📝 Bozza'}
            {ordine.stato === 'inviato' && '📤 Inviato'}
            {ordine.stato === 'ricevuto' && '✓ Ricevuto'}
            {ordine.stato === 'annullato' && '✕ Annullato'}
          </span>
        </div>

        {/* Date */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-gray-50 rounded-apple p-3">
            <p className="text-xs text-apple-gray mb-1">📅 Data ordine</p>
            <p className="text-sm font-semibold text-apple-darkgray">
              {formatData(ordine.data_ordine)}
            </p>
          </div>
          <div className="bg-gray-50 rounded-apple p-3">
            <p className="text-xs text-apple-gray mb-1">🚚 Consegna prevista</p>
            <p className="text-sm font-semibold text-apple-darkgray">
              {formatData(ordine.data_consegna_prevista)}
            </p>
          </div>
        </div>

        {/* Righe */}
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-3">
            📦 Prodotti ({ordine.righe?.length || 0})
          </h3>
          <div className="bg-gray-50 rounded-apple overflow-hidden">
            <div className="divide-y divide-gray-200">
              {(ordine.righe || []).map((r) => (
                <div key={r.id} className="flex items-center justify-between px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-apple-darkgray truncate">
                      {r.nome_prodotto}
                    </p>
                    {r.nome_originale_fornitore && (
                      <p className="text-xs text-apple-gray italic truncate">
                        {r.nome_originale_fornitore}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-semibold text-apple-darkgray">
                      × {r.quantita}
                    </span>
                    <span className="text-sm font-bold text-apple-darkgray w-20 text-right">
                      {formatEuro(r.quantita * r.prezzo_scontato_lordo)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Totali */}
        <div className="bg-blue-50 border border-blue-200 rounded-apple p-4 space-y-2 mb-6">
          <div className="flex items-center justify-between text-sm">
            <span className="text-apple-gray">Netto imponibile</span>
            <span className="font-semibold text-apple-darkgray">
              {formatEuro(Number(ordine.totale_netto))}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-apple-gray">IVA 22%</span>
            <span className="text-apple-darkgray">
              {formatEuro(Number(ordine.totale_iva))}
            </span>
          </div>
          <div className="flex items-center justify-between text-base pt-2 border-t border-blue-200">
            <span className="font-bold text-apple-darkgray">Totale</span>
            <span className="font-bold text-apple-blue">
              {formatEuro(Number(ordine.totale_lordo))}
            </span>
          </div>
        </div>

        {/* Note */}
        {ordine.note && (
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-2">
              📝 Note
            </h3>
            <p className="text-xs text-apple-gray italic bg-gray-50 rounded-apple p-3 whitespace-pre-wrap">
              {ordine.note}
            </p>
          </div>
        )}

        {/* Pannello conferma ricezione */}
        {showConfermaRicevi && (
          <div className="bg-green-50 border-2 border-green-300 rounded-apple p-4 mb-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-xl shrink-0">
                ✓
              </div>
              <div>
                <p className="text-sm font-bold text-green-800 mb-1">
                  Confermi ricezione dell'ordine?
                </p>
                <p className="text-xs text-green-700 leading-relaxed">
                  Verifica le <strong>quantità effettivamente ricevute</strong>.
                  Puoi modificarle se il fornitore ha spedito meno.
                </p>
              </div>
            </div>

            {/* Tabella quantità modificabili */}
            <div className="bg-white rounded-apple overflow-hidden mb-4">
              <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-semibold text-apple-gray uppercase border-b border-gray-200 bg-gray-50">
                <div className="col-span-7">Prodotto</div>
                <div className="col-span-2 text-center">Ordinata</div>
                <div className="col-span-3 text-center">Ricevuta</div>
              </div>
              <div className="divide-y divide-gray-200 max-h-60 overflow-y-auto">
                {(ordine.righe || []).map((r) => {
                  const quantitaAttuale = quantitaEffettive[r.id] ?? r.quantita;
                  const modificata = quantitaAttuale !== r.quantita;
                  return (
                    <div
                      key={r.id}
                      className={`grid grid-cols-12 gap-2 px-3 py-2 items-center ${
                        modificata ? 'bg-amber-50' : ''
                      }`}
                    >
                      <div className="col-span-7 min-w-0">
                        <p className="text-sm text-apple-darkgray truncate">
                          {r.nome_prodotto}
                        </p>
                        {r.nome_originale_fornitore && (
                          <p className="text-xs text-apple-gray italic truncate">
                            {r.nome_originale_fornitore}
                          </p>
                        )}
                      </div>
                      <div className="col-span-2 text-center">
                        <p className="text-sm text-apple-gray">{r.quantita}</p>
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={quantitaAttuale}
                          onChange={(e) =>
                            setQuantitaEffettive((prev) => ({
                              ...prev,
                              [r.id]: parseInt(e.target.value, 10) || 0,
                            }))
                          }
                          className={`w-full px-2 py-1.5 border rounded-apple text-sm text-center focus:outline-none focus:ring-2 focus:ring-apple-blue/30 ${
                            modificata
                              ? 'bg-amber-50 border-amber-300 font-bold text-amber-800'
                              : 'bg-white border-gray-200 text-apple-darkgray'
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Riepilogo modifiche */}
            {(() => {
              const modificate = (ordine.righe || []).filter(
                (r) => (quantitaEffettive[r.id] ?? r.quantita) !== r.quantita
              ).length;
              return modificate > 0 ? (
                <p className="text-xs text-amber-700 font-semibold mb-3">
                  ⚠️ {modificate} {modificate === 1 ? 'riga modificata' : 'righe modificate'}
                </p>
              ) : null;
            })()}

            <div className="flex gap-2">
              <button
                onClick={handleRicevi}
                disabled={salvando}
                className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-apple font-medium text-sm hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {salvando ? 'Carico in corso...' : '✓ Carica magazzino'}
              </button>
              <button
                onClick={() => {
                  setShowConfermaRicevi(false);
                  setQuantitaEffettive({});
                }}
                disabled={salvando}
                className="px-4 py-2.5 bg-white text-apple-darkgray rounded-apple font-medium text-sm hover:bg-gray-100 transition-colors"
              >
                Annulla
              </button>
            </div>
          </div>
        )}

        {/* Pannello conferma eliminazione */}
        {showConfermaElimina && (
          <div className="bg-red-50 border-2 border-red-300 rounded-apple p-4 mb-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-xl shrink-0">
                ⚠️
              </div>
              <div>
                <p className="text-sm font-bold text-red-800 mb-1">
                  Eliminare questo ordine?
                </p>
                <p className="text-xs text-red-700 leading-relaxed">
                  L'azione è irreversibile. Le righe verranno eliminate in cascata.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleElimina}
                disabled={salvando}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-apple font-medium text-sm hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {salvando ? 'Eliminazione...' : 'Sì, elimina'}
              </button>
              <button
                onClick={() => setShowConfermaElimina(false)}
                disabled={salvando}
                className="px-4 py-2.5 bg-white text-apple-darkgray rounded-apple font-medium text-sm hover:bg-gray-100 transition-colors"
              >
                Annulla
              </button>
            </div>
          </div>
        )}

        {/* Azioni */}
        {!showConfermaRicevi && !showConfermaElimina && (
          <div className="pt-6 border-t border-gray-200/60 flex flex-wrap gap-2">
            {ordine.stato !== 'ricevuto' && ordine.stato !== 'annullato' && (
              <button
                onClick={() => setShowConfermaRicevi(true)}
                disabled={salvando}
                className="flex-1 min-w-[150px] px-4 py-2.5 bg-green-600 text-white rounded-apple font-medium text-sm hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                ✓ Segna come Ricevuto
              </button>
            )}
            <button
              onClick={() => setShowAnteprima(true)}
              className="flex-1 min-w-[120px] px-4 py-2.5 bg-apple-darkgray text-white rounded-apple font-medium text-sm hover:bg-gray-800 transition-colors"
            >
              👁️ Anteprima
            </button>
            <button
              onClick={handleScaricaPdf}
              className="flex-1 min-w-[120px] px-4 py-2.5 bg-gray-100 text-apple-darkgray rounded-apple font-medium text-sm hover:bg-gray-200 transition-colors"
            >
              📄 Scarica PDF
            </button>
            <button
              onClick={() => handleInvia('email')}
              className={`flex-1 min-w-[110px] px-4 py-2.5 rounded-apple font-medium text-sm transition-colors ${
                ordine.inviato_email_at
                  ? 'bg-green-50 text-green-700 hover:bg-green-100'
                  : 'bg-blue-50 text-apple-blue hover:bg-blue-100'
              }`}
            >
              📧 {ordine.inviato_email_at ? 'Reinvia' : 'Email'}
            </button>
            <button
              onClick={() => handleInvia('whatsapp')}
              className={`flex-1 min-w-[110px] px-4 py-2.5 rounded-apple font-medium text-sm transition-colors ${
                ordine.inviato_whatsapp_at
                  ? 'bg-green-50 text-green-700 hover:bg-green-100'
                  : 'bg-green-50 text-green-600 hover:bg-green-100'
              }`}
            >
              💬 {ordine.inviato_whatsapp_at ? 'Reinvia' : 'WhatsApp'}
            </button>
            <button
              onClick={() => setShowConfermaElimina(true)}
              disabled={salvando}
              className="px-4 py-2.5 bg-red-50 text-red-600 rounded-apple font-medium text-sm hover:bg-red-100 transition-colors disabled:opacity-50"
              title="Elimina ordine"
            >
              🗑️
            </button>
          </div>
        )}
      </div>

      {/* Modale anteprima PDF */}
      {showAnteprima && (
        <AnteprimaPdf
          titolo="Anteprima Ordine"
          sottotitolo={`${ordine.numero_ordine} - ${ordine.fornitore?.ragione_sociale || ''}`}
          onScarica={async () => {
            setShowAnteprima(false);
            await handleScaricaPdf();
          }}
          labelScarica="📄 Scarica PDF Ordine"
          onClose={() => setShowAnteprima(false)}
        >
          <IntestazionePdf />
          <BandaBluPdf
            testo={`ORDINE N. ${ordine.numero_ordine}`}
            anno={new Date(ordine.data_ordine).getFullYear()}
          />

          {/* Destinatario + Riferimenti */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase mb-1">
                DESTINATARIO
              </p>
              <p className="text-sm font-bold">
                {ordine.fornitore?.ragione_sociale || '—'}
              </p>
              {ordine.fornitore?.indirizzo && (
                <p className="text-sm">
                  {ordine.fornitore.indirizzo}
                  {ordine.fornitore.cap && `, ${ordine.fornitore.cap}`}
                  {ordine.fornitore.citta && ` ${ordine.fornitore.citta}`}
                  {ordine.fornitore.provincia && ` (${ordine.fornitore.provincia})`}
                </p>
              )}
              {ordine.fornitore?.partita_iva && (
                <p className="text-sm">P.IVA: {ordine.fornitore.partita_iva}</p>
              )}
              {ordine.fornitore?.codice_fiscale && (
                <p className="text-sm">C.F.: {ordine.fornitore.codice_fiscale}</p>
              )}
              {ordine.fornitore?.telefono && (
                <p className="text-sm">Tel: {ordine.fornitore.telefono}</p>
              )}
              {ordine.fornitore?.email && (
                <p className="text-sm">Email: {ordine.fornitore.email}</p>
              )}
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase mb-1">
                RIFERIMENTI
              </p>
              <p className="text-sm">
                Data ordine: {formatData(ordine.data_ordine)}
              </p>
              {ordine.data_consegna_prevista && (
                <p className="text-sm">
                  Consegna prevista: {formatData(ordine.data_consegna_prevista)}
                </p>
              )}
              {ordine.fornitore?.giorni_consegna && (
                <p className="text-sm font-bold">
                  Consegna solo di: {ordine.fornitore.giorni_consegna}
                </p>
              )}
              <p className="text-sm font-bold mt-2">Indirizzo di consegna:</p>
              <p className="text-sm">{formatSede(azienda.sedeOperativa)}</p>
            </div>
          </div>

          {/* Tabella prodotti */}
          <p className="text-xs font-bold text-gray-500 uppercase mb-2">
            PRODOTTI ORDINATI
          </p>
          <table className="w-full mb-6 text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="text-left px-2 py-2 font-semibold text-gray-700">
                  Descrizione
                </th>
                <th className="text-center px-2 py-2 font-semibold text-gray-700 w-14">
                  Qta
                </th>
                <th className="text-right px-2 py-2 font-semibold text-gray-700 w-20">
                  Prezzo
                </th>
                <th className="text-right px-2 py-2 font-semibold text-gray-700 w-16">
                  Sc.
                </th>
                <th className="text-right px-2 py-2 font-semibold text-gray-700 w-24">
                  Totale
                </th>
              </tr>
            </thead>
            <tbody>
              {(ordine.righe || []).map((r) => {
                const totale = r.quantita * r.prezzo_scontato_lordo;
                return (
                  <tr key={r.id} className="border-b border-gray-100">
                    <td className="px-2 py-2">
                      <p>{r.nome_prodotto}</p>
                      {r.nome_originale_fornitore && (
                        <p className="text-xs italic text-gray-500">
                          {r.nome_originale_fornitore}
                        </p>
                      )}
                    </td>
                    <td className="text-center px-2 py-2">{r.quantita}</td>
                    <td className="text-right px-2 py-2">
                      {formatEuro(r.prezzo_acquisto_lordo)}
                    </td>
                    <td className="text-right px-2 py-2">
                      {r.sconto_percentuale > 0 ? `${r.sconto_percentuale}%` : '—'}
                    </td>
                    <td className="text-right px-2 py-2 font-semibold">
                      {formatEuro(totale)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Totali */}
          <div className="flex justify-end mb-6">
            <div className="space-y-1 min-w-[220px]">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Netto imponibile</span>
                <span className="font-semibold">
                  {formatEuro(Number(ordine.totale_netto))}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">IVA 22%</span>
                <span className="font-semibold">
                  {formatEuro(Number(ordine.totale_iva))}
                </span>
              </div>
              <div className="flex justify-between text-base font-bold border-t-2 border-gray-300 pt-1">
                <span>Totale</span>
                <span>{formatEuro(Number(ordine.totale_lordo))}</span>
              </div>
            </div>
          </div>

          {/* Note */}
          {ordine.note && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <p className="text-xs font-bold text-gray-500 uppercase mb-1">
                NOTE
              </p>
              <p className="text-xs text-gray-700 whitespace-pre-wrap">
                {ordine.note}
              </p>
            </div>
          )}

          {/* Riquadro consegna evidenziato */}
          <div className="mt-6 border-2 border-orange-400 bg-orange-50 rounded p-3">
            <p className="text-sm font-bold text-orange-700">
              ⚠️ CONSEGNA SOLO DI: {ordine.fornitore?.giorni_consegna || 'Giovedì e Venerdì'}
            </p>
            <p className="text-xs font-bold text-orange-800 mt-2">
              Indirizzo di consegna:
            </p>
            <p className="text-xs text-orange-900">
              RIGHETTI CONSULTING SRL (Righetti Since 1967)
            </p>
            <p className="text-xs text-orange-900">{formatSede(azienda.sedeOperativa)}</p>
          </div>

          <FooterPdf />
        </AnteprimaPdf>
      )}
    </div>
  );
}
