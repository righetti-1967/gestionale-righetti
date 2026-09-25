import { useState } from 'react';
import { FormScaricoSeduta } from './FormScaricoSeduta';
import { MenuSceltaPdf } from './MenuSceltaPdf';
import { FormModificaPercorso } from './FormModificaPercorso';
import type { ScaricoSeduta } from '../lib/scarichi';
import {
  formatEuro,
  type RigaPercorso,
  type ResiduoPercorso,
} from '../lib/percorsi-helper';
import type { Percorso, StatoPercorso } from '../lib/percorsi';
import type { Cliente } from '../lib/clienti';
import {
  eliminaPercorso,
  bloccaPercorso,
  sbloccaPercorso,
  terminaPercorso,
  riapriPercorso,
  prorogaPercorso,
} from '../lib/percorsi';

interface DettaglioPercorsoProps {
  percorso: Percorso;
  cliente: Cliente | null;
  residuo: ResiduoPercorso;
  fatturaIncassata: boolean;
  stato: StatoPercorso;
  onClose: () => void;
  onUpdated: () => void;
  onModifica?: () => void;
  onFattura: () => void;
}

// Calcola i mesi totali tra data inizio e data fine
function calcolaMesiDurata(dataInit: string, dataFine: string): number {
  if (!dataInit || !dataFine) return 0;
  const d1 = new Date(dataInit);
  const d2 = new Date(dataFine);
  const diffMs = d2.getTime() - d1.getTime();
  if (diffMs <= 0) return 0;
  return Math.round(diffMs / (30.4375 * 24 * 60 * 60 * 1000));
}

export function DettaglioPercorso({
  percorso,
  cliente,
  residuo,
  fatturaIncassata,
  stato,
  onClose,
  onUpdated,
  onModifica: _onModifica,
  onFattura,
}: DettaglioPercorsoProps) {
  const [salvando, setSalvando] = useState(false);
  const [showConfermaElimina, setShowConfermaElimina] = useState(false);
  const [showBlocca, setShowBlocca] = useState(false);
  const [showProroga, setShowProroga] = useState(false);
  const [showScarico, setShowScarico] = useState(false);
  const [scaricoPerPdf, setScaricoPerPdf] = useState<ScaricoSeduta | null>(null);
  const [showModifica, setShowModifica] = useState(false);
  const [motivoBlocco, setMotivoBlocco] = useState('');
  const [nuovaDataFine, setNuovaDataFine] = useState(percorso.data_fine);

  const oggi = new Date();
  const dataFine = new Date(percorso.data_fine);
  const giorniAllaScadenza = Math.ceil(
    (dataFine.getTime() - oggi.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Mesi totali concordati
  const mesiDurata = calcolaMesiDurata(percorso.data_inizio, percorso.data_fine);

  const STATO_CONFIG_DETTAGLIO: Record<
    StatoPercorso,
    { label: string; colore: string }
  > = {
    attivo: { label: '🟢 Attivo', colore: 'bg-green-100 text-green-700' },
    'in-scadenza': { label: '🟡 In scadenza', colore: 'bg-amber-100 text-amber-700' },
    'da-incassare': { label: '🟠 Da incassare', colore: 'bg-orange-100 text-orange-700' },
    'da-fatturare': { label: '🟡 Da fatturare', colore: 'bg-yellow-100 text-yellow-700' },
    completato: { label: '🔵 Completato', colore: 'bg-blue-100 text-blue-700' },
    scaduto: { label: '🔴 Scaduto', colore: 'bg-red-100 text-red-700' },
    bloccato: { label: '🔴 Bloccato', colore: 'bg-red-100 text-red-700' },
    terminato: { label: '⚫ Terminato', colore: 'bg-gray-200 text-gray-700' },
  };

  const cfg = STATO_CONFIG_DETTAGLIO[stato];
  const statoBadge = cfg.label;
  const statoColore = cfg.colore;

  const serviziPercorso = (percorso.righe || []).filter((r) => r.tipo === 'servizio');
  const prodottiPercorso = (percorso.righe || []).filter((r) => r.tipo === 'prodotto');

  async function handleElimina() {
    try {
      setSalvando(true);
      await eliminaPercorso(percorso.id);
      onUpdated();
    } catch (err: any) {
      alert('Errore: ' + err.message);
    } finally {
      setSalvando(false);
    }
  }

  async function handleBlocca() {
    try {
      setSalvando(true);
      await bloccaPercorso(percorso.id, motivoBlocco);
      onUpdated();
    } catch (err: any) {
      alert('Errore: ' + err.message);
    } finally {
      setSalvando(false);
    }
  }

  async function handleSblocca() {
    try {
      setSalvando(true);
      await sbloccaPercorso(percorso.id);
      onUpdated();
    } catch (err: any) {
      alert('Errore: ' + err.message);
    } finally {
      setSalvando(false);
    }
  }

  async function handleTermina() {
    if (!confirm('Vuoi terminare questo percorso?')) return;
    try {
      setSalvando(true);
      await terminaPercorso(percorso.id);
      onUpdated();
    } catch (err: any) {
      alert('Errore: ' + err.message);
    } finally {
      setSalvando(false);
    }
  }

  async function handleRiapri() {
    if (!confirm('Vuoi riaprire questo percorso?')) return;
    try {
      setSalvando(true);
      await riapriPercorso(percorso.id);
      onUpdated();
    } catch (err: any) {
      alert('Errore: ' + err.message);
    } finally {
      setSalvando(false);
    }
  }

  async function handleProroga() {
    try {
      setSalvando(true);
      await prorogaPercorso(percorso.id, nuovaDataFine);
      onUpdated();
    } catch (err: any) {
      alert('Errore: ' + err.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 overflow-y-auto"
        onClick={onClose}
      >
        <div
          className="bg-white sm:rounded-apple rounded-t-3xl shadow-apple-lg w-full sm:max-w-3xl max-h-[95vh] sm:my-8 flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between px-5 sm:px-6 py-4 border-b border-gray-200/60 shrink-0">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-apple bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white text-2xl shrink-0">
                🎯
              </div>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-bold text-apple-darkgray truncate">
                  {percorso.nome}
                </h2>
                <p className="text-xs text-apple-gray truncate">
                  {cliente?.nome_cognome || '—'} • ID {percorso.id}
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

          {/* Motivo blocco */}
          {percorso.bloccato && percorso.motivo_blocco && (
            <div className="bg-red-50 border-b border-red-200 px-5 sm:px-6 py-3 shrink-0">
              <p className="text-xs font-semibold text-red-700 uppercase mb-1">
                🔒 Motivo Blocco
              </p>
              <p className="text-sm text-red-800">{percorso.motivo_blocco}</p>
            </div>
          )}

          {/* Corpo */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
            {/* Stato + Durata + Date */}
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-xs font-semibold px-3 py-1.5 rounded-full ${statoColore}`}
              >
                {statoBadge}
              </span>

              {/* Mesi totali in evidenza */}
              {mesiDurata > 0 && (
                <span className="text-xs font-bold text-apple-darkgray bg-gray-100 px-2.5 py-1 rounded-apple border border-gray-200/60">
                  ⏱️ Percorso di {mesiDurata} {mesiDurata === 1 ? 'mese' : 'mesi'}
                </span>
              )}

              <span className="text-xs text-apple-gray">
                📅 {formatData(percorso.data_inizio)} → {formatData(percorso.data_fine)}
              </span>

              {giorniAllaScadenza > 0 && !percorso.terminato && !percorso.bloccato && (
                <span className="text-xs text-apple-gray">
                  ({giorniAllaScadenza} giorni residui)
                </span>
              )}

              <button
                onClick={() => setShowProroga(true)}
                className="ml-auto text-xs text-apple-blue hover:underline font-medium"
              >
                📅 Proroga scadenza
              </button>
            </div>

            {/* Riepilogo economico */}
            <div className="bg-blue-50 border border-blue-200 rounded-apple p-4 space-y-3">
              <h3 className="text-xs font-semibold text-apple-blue uppercase tracking-wide">
                💰 Riepilogo
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <InfoBox
                  label="Totale listino"
                  value={formatEuro(percorso.totale_listino)}
                  strikethrough
                />
                <InfoBox
                  label="Prezzo finale"
                  value={formatEuro(percorso.totale_finale)}
                  bold
                />
                <InfoBox
                  label="Sconto"
                  value={`${percorso.sconto_percentuale.toFixed(2)} %`}
                  blue
                />
                <InfoBox
                  label="Residuo"
                  value={formatEuro(residuo.valore_residuo_lordo)}
                  bold
                />
              </div>

              <div className="pt-2">
                <div className="flex items-center justify-between text-xs text-apple-gray mb-1.5">
                  <span>Progresso</span>
                  <span>{residuo.percentuale_consumata.toFixed(1)}% consumato</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-apple-blue rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.max(0, residuo.percentuale_consumata))}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Servizi */}
            <div>
              <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-3">
                🛠️ Servizi ({serviziPercorso.length})
              </h3>
              {serviziPercorso.length === 0 ? (
                <p className="text-xs text-apple-gray bg-gray-50 rounded-apple p-3 text-center">
                  Nessun servizio incluso
                </p>
              ) : (
                <div className="bg-gray-50 rounded-apple overflow-hidden">
                  <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-semibold text-apple-gray uppercase border-b border-gray-200">
                    <div className="col-span-6">Servizio</div>
                    <div className="col-span-3 text-right">Residuo</div>
                    <div className="col-span-3 text-right">Prezzo sc.</div>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {serviziPercorso.map((r, i) => {
                      const info = residuo.righe_residue.find(
                        (rr) => rr.tipo === 'servizio' && rr.servizio_id === r.servizio_id
                      );
                      return (
                        <RigaDettaglio
                          key={i}
                          riga={r}
                          quantitaResidua={info?.quantita_residua ?? r.quantita}
                          quantitaTotale={r.quantita}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Prodotti */}
            <div>
              <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-3">
                📦 Prodotti ({prodottiPercorso.length})
              </h3>
              {prodottiPercorso.length === 0 ? (
                <p className="text-xs text-apple-gray bg-gray-50 rounded-apple p-3 text-center">
                  Nessun prodotto incluso
                </p>
              ) : (
                <div className="bg-gray-50 rounded-apple overflow-hidden">
                  <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-semibold text-apple-gray uppercase border-b border-gray-200">
                    <div className="col-span-6">Prodotto</div>
                    <div className="col-span-3 text-right">Residuo</div>
                    <div className="col-span-3 text-right">Prezzo sc.</div>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {prodottiPercorso.map((r, i) => {
                      const info = residuo.righe_residue.find(
                        (rr) => rr.tipo === 'prodotto' && rr.prodotto_id === r.prodotto_id
                      );
                      return (
                        <RigaDettaglio
                          key={i}
                          riga={r}
                          quantitaResidua={info?.quantita_residua ?? r.quantita}
                          quantitaTotale={r.quantita}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Note */}
            {percorso.note && (
              <div>
                <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-2">
                  📝 Note interne
                </h3>
                <p className="text-xs text-apple-gray italic bg-gray-50 rounded-apple p-3 whitespace-pre-wrap">
                  {percorso.note}
                </p>
              </div>
            )}

            {/* Azioni amministrative */}
            <div className="pt-4 border-t border-gray-200/60">
              <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-3">
                ⚙️ Azioni
              </h3>
              <div className="flex flex-wrap gap-2">
                {percorso.bloccato ? (
                  <button
                    type="button"
                    onClick={handleSblocca}
                    disabled={salvando}
                    className="px-4 py-2 bg-green-50 text-green-700 rounded-apple font-medium text-sm hover:bg-green-100 transition-colors disabled:opacity-50"
                  >
                    🔓 Riapri (Sblocca)
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowBlocca(true)}
                    disabled={salvando}
                    className="px-4 py-2 bg-red-50 text-red-600 rounded-apple font-medium text-sm hover:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    🔒 Blocca Percorso
                  </button>
                )}

                {percorso.terminato ? (
                  <button
                    type="button"
                    onClick={handleRiapri}
                    disabled={salvando}
                    className="px-4 py-2 bg-blue-50 text-apple-blue rounded-apple font-medium text-sm hover:bg-blue-100 transition-colors disabled:opacity-50"
                  >
                    🔄 Riapri Percorso
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleTermina}
                    disabled={salvando}
                    className="px-4 py-2 bg-gray-100 text-apple-darkgray rounded-apple font-medium text-sm hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    ⚫ Termina Percorso
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-2 px-5 sm:px-6 py-4 border-t border-gray-200/60 bg-gray-50/50 shrink-0">
            <button
              type="button"
              onClick={() => setShowConfermaElimina(true)}
              disabled={salvando}
              className="px-4 py-2.5 bg-red-50 text-red-600 rounded-apple font-medium text-sm hover:bg-red-100 transition-colors disabled:opacity-50"
              title="Elimina percorso"
            >
              🗑️
            </button>
            {!percorso.fattura_id && (
              <button
                type="button"
                onClick={onFattura}
                disabled={salvando}
                className="flex-1 px-4 py-2.5 bg-amber-500 text-white rounded-apple font-medium text-sm hover:bg-amber-600 transition-colors disabled:opacity-50"
              >
                💵 Fattura proforma
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowModifica(true)}
              className="flex-1 px-4 py-2.5 bg-apple-blue text-white rounded-apple font-medium text-sm hover:bg-blue-600 transition-colors"
            >
              ✏️ Modifica
            </button>
            {fatturaIncassata && (
              <button
                type="button"
                onClick={() => setShowScarico(true)}
                disabled={salvando}
                className="flex-1 px-4 py-2.5 bg-green-500 text-white rounded-apple font-medium text-sm hover:bg-green-600 transition-colors disabled:opacity-50"
              >
                📋 Scarico Seduta
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modale Conferma Elimina */}
      {showConfermaElimina && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[60]"
          onClick={() => setShowConfermaElimina(false)}
        >
          <div
            className="bg-white rounded-apple shadow-apple-lg max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center text-2xl">
                🗑️
              </div>
              <h2 className="text-lg font-bold text-apple-darkgray mb-2">
                Eliminare questo percorso?
              </h2>
              <p className="text-sm text-apple-gray">
                Stai per eliminare <strong>{percorso.nome}</strong>. Questa azione non può essere
                annullata.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfermaElimina(false)}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-apple-darkgray rounded-apple font-medium text-sm hover:bg-gray-200 transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleElimina}
                disabled={salvando}
                className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-apple font-medium text-sm hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {salvando ? 'Elimino...' : 'Elimina'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale Blocca */}
      {showBlocca && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[60]"
          onClick={() => setShowBlocca(false)}
        >
          <div
            className="bg-white rounded-apple shadow-apple-lg max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center text-2xl">
                🔒
              </div>
              <h2 className="text-lg font-bold text-apple-darkgray mb-2">
                Bloccare il percorso?
              </h2>
              <p className="text-sm text-apple-gray mb-4">
                Il cliente non potrà più fare nuove sedute finché non sblocchi.
              </p>
              <textarea
                value={motivoBlocco}
                onChange={(e) => setMotivoBlocco(e.target.value)}
                placeholder="Motivo del blocco..."
                rows={3}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-red-300/30 focus:border-red-400 transition-all resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowBlocca(false)}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-apple-darkgray rounded-apple font-medium text-sm hover:bg-gray-200 transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleBlocca}
                disabled={salvando}
                className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-apple font-medium text-sm hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {salvando ? 'Blocco...' : '🔒 Blocca'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale Scarico Seduta */}
      {showScarico && (
        <FormScaricoSeduta
          percorso={percorso}
          cliente={cliente}
          residuo={residuo}
          fatturaIncassata={fatturaIncassata}
          onClose={() => setShowScarico(false)}
          onSuccess={(scaricoCreato) => {
            setShowScarico(false);
            setScaricoPerPdf(scaricoCreato);
          }}
        />
      )}

      {showModifica && (
        <FormModificaPercorso
          percorso={percorso}
          cliente={cliente}
          proformaIncassata={fatturaIncassata}
          onClose={() => setShowModifica(false)}
          onSuccess={() => {
            setShowModifica(false);
            onUpdated();
          }}
        />
      )}

      {scaricoPerPdf && (
        <MenuSceltaPdf
          scarico={scaricoPerPdf}
          percorso={percorso}
          cliente={cliente}
          onClose={() => {
            setScaricoPerPdf(null);
            onUpdated();
          }}
        />
      )}

      {/* Modale Proroga */}
      {showProroga && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[60]"
          onClick={() => setShowProroga(false)}
        >
          <div
            className="bg-white rounded-apple shadow-apple-lg max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center text-2xl">
                📅
              </div>
              <h2 className="text-lg font-bold text-apple-darkgray mb-2">
                Proroga scadenza
              </h2>
              <p className="text-sm text-apple-gray mb-4">
                Attuale: <strong>{formatData(percorso.data_fine)}</strong>
              </p>
              <input
                type="date"
                value={nuovaDataFine}
                onChange={(e) => setNuovaDataFine(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-apple text-sm text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowProroga(false)}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-apple-darkgray rounded-apple font-medium text-sm hover:bg-gray-200 transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleProroga}
                disabled={salvando || nuovaDataFine === percorso.data_fine}
                className="flex-1 px-4 py-2.5 bg-apple-blue text-white rounded-apple font-medium text-sm hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {salvando ? 'Salvo...' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function InfoBox({
  label,
  value,
  strikethrough,
  bold,
  blue,
}: {
  label: string;
  value: string;
  strikethrough?: boolean;
  bold?: boolean;
  blue?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-apple-gray mb-0.5">{label}</p>
      <p
        className={`text-sm ${
          blue
            ? 'text-apple-blue font-bold'
            : bold
            ? 'text-apple-darkgray font-bold'
            : strikethrough
            ? 'text-apple-gray line-through'
            : 'text-apple-darkgray font-medium'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function RigaDettaglio({
  riga,
  quantitaResidua,
  quantitaTotale,
}: {
  riga: RigaPercorso;
  quantitaResidua: number;
  quantitaTotale: number;
}) {
  const scaricati = quantitaTotale - quantitaResidua;
  const completa = quantitaResidua === 0;

  return (
    <div className="grid grid-cols-12 gap-2 px-4 py-2.5 text-sm items-center">
      <div className="col-span-6 min-w-0">
        <p
          className={`truncate ${
            completa ? 'text-apple-gray line-through' : 'text-apple-darkgray'
          }`}
        >
          {riga.nome}
        </p>
        <p className="text-xs text-apple-gray">
          {scaricati} / {quantitaTotale} scaricati
        </p>
      </div>
      <div className="col-span-3 text-right">
        <span
          className={`text-sm font-semibold ${
            completa ? 'text-apple-gray' : 'text-apple-darkgray'
          }`}
        >
          {quantitaResidua}
        </span>
        <span className="text-xs text-apple-gray"> / {quantitaTotale}</span>
      </div>
      <div className="col-span-3 text-right text-xs text-apple-gray">
        {formatEuro(riga.prezzo_scontato_lordo)}
      </div>
    </div>
  );
}

function formatData(data: string | null): string {
  if (!data) return '—';
  try {
    const d = new Date(data);
    return d.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}
