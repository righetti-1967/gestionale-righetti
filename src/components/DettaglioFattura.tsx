import { useState } from 'react';
import { generaPdfFattura } from '../lib/pdfFattura';
import { FirmaFatturaQR } from './FirmaFatturaQR';
import {
  AnteprimaPdf,
  IntestazionePdf,
  BandaBluPdf,
  FooterPdf,
} from './AnteprimaPdf';
import {
  formatEuro,
  formatData,
  isPagata,
  rimuoviFirmaFattura,
  registraIncasso,
  annullaIncasso,
  aggiornaFattura,
  eliminaFattura,
  type FatturaConCliente,
} from '../lib/fatture';

interface DettaglioFatturaProps {
  fattura: FatturaConCliente;
  onClose: () => void;
  onUpdate: () => void;
}

export function DettaglioFattura({ fattura, onClose, onUpdate }: DettaglioFatturaProps) {
  const pagata = isPagata(fattura);

  const [showIncasso, setShowIncasso] = useState(false);
  const [dataIncasso, setDataIncasso] = useState(new Date().toISOString().split('T')[0]);
  const [metodoPagamento, setMetodoPagamento] = useState<string>('');
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const [showModifica, setShowModifica] = useState(false);
  const [dicituraLegale, setDicituraLegale] = useState(fattura.dicitura_legale || '');
  const [noteInterne, setNoteInterne] = useState(fattura.note_interne || '');

  const [showElimina, setShowElimina] = useState(false);
  const [showFirmaQR, setShowFirmaQR] = useState(false);
  const [rimuovendoFirma, setRimuovendoFirma] = useState(false);
  const [showAvvisoIncasso, setShowAvvisoIncasso] = useState(false);
  const [showAnteprima, setShowAnteprima] = useState(false);
  const [toastInvia, setToastInvia] = useState<string | null>(null);

  async function handleRegistraIncasso() {
    if (!metodoPagamento) {
      setErrore('Seleziona obbligatoriamente il metodo di pagamento');
      return;
    }

    try {
      setSalvando(true);
      setErrore(null);

      const fatturaAggiornata = await registraIncasso(fattura.id, dataIncasso, metodoPagamento);

      try {
        const fatturaCompleta = {
          ...fattura,
          ...fatturaAggiornata,
          cliente: fattura.cliente,
        };
        await generaPdfFattura(fatturaCompleta);
      } catch (err) {
        console.error('Errore generazione PDF dopo incasso:', err);
      }

      onUpdate();
    } catch (err: any) {
      const msg = err?.message || err?.details || String(err);
      setErrore(msg || 'Errore nel salvataggio');
    } finally {
      setSalvando(false);
    }
  }

  async function handleAnnullaIncasso() {
    if (!confirm('Vuoi davvero annullare l\'incasso di questa fattura?')) return;
    try {
      setSalvando(true);
      setErrore(null);
      await annullaIncasso(fattura.id);
      onUpdate();
    } catch (err: any) {
      const msg = err?.message || err?.details || String(err);
      setErrore(msg || 'Errore nell\'annullamento');
    } finally {
      setSalvando(false);
    }
  }

  async function handleSalvaModifica() {
    try {
      setSalvando(true);
      setErrore(null);
      await aggiornaFattura(fattura.id, {
        dicitura_legale: dicituraLegale.trim() || null,
        note_interne: noteInterne.trim() || null,
      });
      onUpdate();
    } catch (err: any) {
      const msg = err?.message || err?.details || String(err);
      setErrore(msg || 'Errore nel salvataggio');
    } finally {
      setSalvando(false);
    }
  }

  function handleAnnullaModifica() {
    setDicituraLegale(fattura.dicitura_legale || '');
    setNoteInterne(fattura.note_interne || '');
    setShowModifica(false);
  }

  function handleInvia(canale: 'email' | 'whatsapp') {
    const canaleLabel = canale === 'email' ? 'Email' : 'WhatsApp';
    setToastInvia(`📧 Invio ${canaleLabel} di ${fattura.numero_fattura} in arrivo`);
    setTimeout(() => setToastInvia(null), 4000);
  }

  async function handleRimuoviFirma() {
    if (!confirm('Vuoi rimuovere la firma esistente? Potrai rifirmare.')) return;
    try {
      setRimuovendoFirma(true);
      setErrore(null);
      await rimuoviFirmaFattura(fattura.id);
      onUpdate();
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrore(msg || 'Errore nella rimozione della firma');
    } finally {
      setRimuovendoFirma(false);
    }
  }

  async function handleElimina() {
    try {
      setSalvando(true);
      setErrore(null);
      await eliminaFattura(fattura.id);
      onUpdate();
    } catch (err: any) {
      const msg = err?.message || err?.details || (typeof err === 'object' ? JSON.stringify(err) : String(err));
      setErrore(msg || 'Errore nell\'eliminazione');
      setSalvando(false);
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
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-apple bg-gradient-to-br from-apple-blue to-blue-600 flex items-center justify-center text-white text-2xl">
              📄
            </div>
            <div>
              <h2 className="text-xl font-bold text-apple-darkgray">
                Fattura {fattura.numero_fattura}
              </h2>
              <p className="text-xs text-apple-gray">
                ID: {fattura.id}
                {fattura.cliente && ` • ${fattura.cliente.nome_cognome}`}
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

        <div
          className={`mb-6 p-4 rounded-apple ${
            pagata ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-apple-gray mb-1">
                Totale
              </p>
              <p className="text-3xl font-bold text-apple-darkgray">
                {formatEuro(Number(fattura.lordo_ivato))}
              </p>
            </div>
            {pagata ? (
              <span className="text-sm font-semibold px-3 py-1.5 rounded-full bg-green-100 text-green-700">
                ✓ Pagata e Registrata
              </span>
            ) : (
              <span className="text-sm font-semibold px-3 py-1.5 rounded-full bg-orange-100 text-orange-700">
                📄 Proforma
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <InfoBox label="Netto imponibile" value={formatEuro(Number(fattura.netto_imponibile))} />
          <InfoBox label="IVA" value={formatEuro(Number(fattura.iva_importo))} />
        </div>

        <div className="space-y-3 mb-6">
          <InfoRow label="📅 Data inizio" value={formatData(fattura.data_inizio)} />
          <InfoRow label="📅 Data fine" value={formatData(fattura.data_fine)} />
          <InfoRow label="💰 Data incasso" value={formatData(fattura.data_incasso)} />
          {pagata && fattura.metodo_pagamento && (
            <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 bg-blue-50/50 px-3 rounded-apple">
              <span className="text-sm font-semibold text-apple-blue">💳 Metodo di pagamento</span>
              <span className="text-sm font-bold text-apple-blue uppercase">{fattura.metodo_pagamento}</span>
            </div>
          )}
        </div>

        {/* Righe fattura nel dettaglio */}
        {fattura.righe && fattura.righe.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-3">
              Righe fattura ({fattura.righe.length})
            </h3>
            <div className="bg-gray-50 rounded-apple overflow-hidden">
              <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-semibold text-apple-gray uppercase border-b border-gray-200">
                <div className="col-span-6">Descrizione</div>
                <div className="col-span-2 text-center">Qtà</div>
                <div className="col-span-2 text-right">Prezzo</div>
                <div className="col-span-2 text-right">Totale</div>
              </div>
              <div className="divide-y divide-gray-200">
                {fattura.righe.map((riga, i) => {
                  const nomePulito = (riga.nome || '').replace(/\s*\(Valore listino:.*?\)/g, '').trim();
                  const isCheckupGratis =
                    nomePulito.toLowerCase().includes('gratuito') ||
                    (nomePulito.toLowerCase().includes('check') && Number(riga.prezzo_unitario_lordo) === 0);

                  return (
                    <div key={i} className="grid grid-cols-12 gap-2 px-4 py-2.5 text-sm items-center">
                      <div className="col-span-6 text-apple-darkgray">
                        <p className="font-medium">{nomePulito || 'Voce fattura'}</p>
                        {isCheckupGratis && (
                          <p className="text-[11px] text-gray-500 italic mt-0.5">
                            Valore di listino: 225,00 EUR | Sconto 100%
                          </p>
                        )}
                      </div>
                      <div className="col-span-2 text-center text-apple-gray">
                        {riga.quantita}
                      </div>
                      <div className="col-span-2 text-right text-apple-gray">
                        {formatEuro(riga.prezzo_unitario_lordo)}
                      </div>
                      <div className="col-span-2 text-right font-semibold text-apple-darkgray">
                        {formatEuro(riga.quantita * riga.prezzo_unitario_lordo)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {!showModifica && fattura.dicitura_legale && (
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-2">
              Note documento
            </h3>
            <p className="text-xs text-apple-darkgray bg-gray-50 rounded-apple p-3 leading-relaxed">
              {fattura.dicitura_legale}
            </p>
          </div>
        )}

        {!showModifica && fattura.note_interne && (
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-2">
              Note interne
            </h3>
            <p className="text-xs text-apple-gray italic bg-gray-50 rounded-apple p-3">
              {fattura.note_interne}
            </p>
          </div>
        )}

        <div className="flex gap-2 mb-6">
          {fattura.inviato_sdi && (
            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-100 text-blue-700">
              ✓ Inviata SDI
            </span>
          )}
          {fattura.firmato && (
            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-purple-100 text-purple-700">
              ✍️ Firmata
            </span>
          )}
        </div>

        {errore && (
          <div className="bg-red-50 border border-red-200 rounded-apple p-3 text-red-700 text-sm mb-4">
            ❌ {errore}
          </div>
        )}

        {showIncasso && (
          <div className="bg-blue-50 border-2 border-apple-blue/40 rounded-apple p-4 mb-6 space-y-4 shadow-sm">
            <div>
              <p className="text-xs font-bold text-apple-blue uppercase tracking-wide">
                💵 Registrazione Pagamento e Chiusura Fattura
              </p>
              <p className="text-xs text-apple-gray mt-0.5">
                Inserisci la data e la modalità di incasso per registrare la fattura.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-apple-darkgray mb-1">
                  Data incasso <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={dataIncasso}
                  onChange={(e) => setDataIncasso(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-apple-darkgray mb-1">
                  Metodo di pagamento <span className="text-red-500">*</span>
                </label>
                <select
                  value={metodoPagamento}
                  onChange={(e) => setMetodoPagamento(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray font-medium focus:outline-none focus:ring-2 focus:ring-apple-blue/30"
                >
                  <option value="">— Seleziona metodo —</option>
                  <option value="Bonifico">🏦 Bonifico</option>
                  <option value="Carta">💳 Carta</option>
                  <option value="Bancomat">💳 Bancomat</option>
                  <option value="Contanti">💵 Contanti</option>
                  <option value="Non richiesto">🚫 Non richiesto</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t border-blue-200/60">
              <button
                onClick={() => {
                  setShowIncasso(false);
                  setMetodoPagamento('');
                }}
                disabled={salvando}
                className="px-4 py-2 bg-white text-apple-darkgray rounded-apple font-medium text-sm hover:bg-gray-100 transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleRegistraIncasso}
                disabled={salvando || !dataIncasso || !metodoPagamento}
                className="px-5 py-2 bg-apple-blue text-white rounded-apple font-semibold text-sm hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {salvando ? 'Salvataggio...' : '✓ Conferma Pagamento'}
              </button>
            </div>
          </div>
        )}

        {showModifica && (
          <div className="bg-amber-50 border border-amber-200 rounded-apple p-4 mb-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-amber-800 uppercase tracking-wide mb-2">
                Note documento
              </label>
              <textarea
                value={dicituraLegale}
                onChange={(e) => setDicituraLegale(e.target.value)}
                rows={3}
                placeholder="Note documento..."
                className="w-full px-3 py-2 bg-white border border-amber-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-amber-800 uppercase tracking-wide mb-2">
                Note interne
              </label>
              <textarea
                value={noteInterne}
                onChange={(e) => setNoteInterne(e.target.value)}
                rows={3}
                placeholder="Note private..."
                className="w-full px-3 py-2 bg-white border border-amber-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSalvaModifica}
                disabled={salvando}
                className="flex-1 px-4 py-2.5 bg-apple-blue text-white rounded-apple font-medium text-sm hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {salvando ? 'Salvataggio...' : 'Salva'}
              </button>
              <button
                onClick={handleAnnullaModifica}
                disabled={salvando}
                className="px-4 py-2.5 bg-white text-apple-darkgray rounded-apple font-medium text-sm hover:bg-gray-100 transition-colors"
              >
                Annulla
              </button>
            </div>
          </div>
        )}

        {showElimina && (
          <div className="bg-red-50 border-2 border-red-300 rounded-apple p-4 mb-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-xl shrink-0">
                ⚠️
              </div>
              <div>
                <p className="text-sm font-bold text-red-800 mb-1">
                  Eliminare definitivamente questa fattura?
                </p>
                <p className="text-xs text-red-700 leading-relaxed">
                  L'azione è <strong>irreversibile</strong>. Eventuali percorsi collegati torneranno
                  automaticamente disponibili per essere fatturati.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleElimina}
                disabled={salvando}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-apple font-medium text-sm hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {salvando ? 'Eliminazione...' : 'Sì, elimina definitivamente'}
              </button>
              <button
                onClick={() => setShowElimina(false)}
                disabled={salvando}
                className="px-4 py-2.5 bg-white text-apple-darkgray rounded-apple font-medium text-sm hover:bg-gray-100 transition-colors"
              >
                Annulla
              </button>
            </div>
          </div>
        )}

        {showAvvisoIncasso && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[80]"
            onClick={() => setShowAvvisoIncasso(false)}
          >
            <div
              className="bg-white rounded-apple shadow-apple-lg max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center text-2xl">
                  ⚠️
                </div>
                <h2 className="text-lg font-bold text-apple-darkgray mb-2">
                  Proforma non firmata
                </h2>
                <p className="text-sm text-apple-gray">
                  La proforma <strong>NON</strong> è stata firmata dal cliente.
                </p>
                <p className="text-xs text-apple-gray mt-3 bg-amber-50 border border-amber-200 rounded-apple p-3">
                  Registrando l'incasso, diventerà una <strong>fattura vera</strong> e{' '}
                  <strong>immutabile</strong>.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAvvisoIncasso(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-apple-darkgray rounded-apple font-medium text-sm hover:bg-gray-200 transition-colors"
                >
                  Annulla
                </button>
                <button
                  onClick={() => {
                    setShowAvvisoIncasso(false);
                    setShowIncasso(true);
                  }}
                  className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-apple font-medium text-sm hover:bg-green-700 transition-colors"
                >
                  Procedi comunque
                </button>
              </div>
            </div>
          </div>
        )}

        {fattura.firmato && fattura.firma_immagine && (
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-2">
              ✍️ Firma del cliente
            </h3>
            <div className="bg-gray-50 rounded-apple p-3">
              <img
                src={fattura.firma_immagine}
                alt="Firma cliente"
                className="max-w-full h-auto"
                style={{ maxHeight: '100px' }}
              />
              {fattura.data_firma && (
                <p className="text-xs text-apple-gray mt-2 italic">
                  Firmata il {new Date(fattura.data_firma).toLocaleString('it-IT')}
                </p>
              )}
            </div>
          </div>
        )}

        {showFirmaQR && (
          <FirmaFatturaQR
            fattura={fattura}
            cliente={null}
            onClose={() => setShowFirmaQR(false)}
            onSuccess={() => {
              setShowFirmaQR(false);
              onUpdate();
            }}
          />
        )}

        <div className="pt-6 border-t border-gray-200/60 flex flex-wrap gap-2">
          {!pagata && !showIncasso && !showElimina && (
            <button
              onClick={() => {
                if (!fattura.firmato) {
                  setShowAvvisoIncasso(true);
                } else {
                  setShowIncasso(true);
                }
              }}
              className="flex-1 min-w-[140px] px-4 py-2.5 bg-green-600 text-white rounded-apple font-medium text-sm hover:bg-green-700 transition-colors shadow-sm"
            >
              💵 Registra incasso
            </button>
          )}
          {pagata && !showElimina && (
            <button
              onClick={handleAnnullaIncasso}
              disabled={salvando}
              className="flex-1 min-w-[140px] px-4 py-2.5 bg-amber-50 text-amber-700 rounded-apple font-medium text-sm hover:bg-amber-100 transition-colors disabled:opacity-50"
            >
              ↩️ Annulla incasso
            </button>
          )}

          <button
            onClick={() => setShowAnteprima(true)}
            className="flex-1 min-w-[120px] px-4 py-2.5 bg-apple-darkgray text-white rounded-apple font-medium text-sm hover:bg-gray-800 transition-colors"
          >
            👁️ Anteprima
          </button>

          {!pagata && !fattura.firmato && !showFirmaQR && !showElimina && (
            <button
              onClick={() => setShowFirmaQR(true)}
              className="flex-1 min-w-[140px] px-4 py-2.5 bg-purple-600 text-white rounded-apple font-medium text-sm hover:bg-purple-700 transition-colors"
            >
              ✍️ Firma per accettazione
            </button>
          )}

          {!pagata && fattura.firmato && !showElimina && (
            <button
              onClick={handleRimuoviFirma}
              disabled={rimuovendoFirma}
              className="flex-1 min-w-[140px] px-4 py-2.5 bg-purple-50 text-purple-700 rounded-apple font-medium text-sm hover:bg-purple-100 transition-colors disabled:opacity-50"
            >
              {rimuovendoFirma ? '...' : '🗑️ Rimuovi firma'}
            </button>
          )}

          {!showModifica && !showElimina && (
            <button
              onClick={() => setShowModifica(true)}
              className="flex-1 min-w-[120px] px-4 py-2.5 bg-apple-blue text-white rounded-apple font-medium text-sm hover:bg-blue-600 transition-colors"
            >
              ✏️ Modifica note
            </button>
          )}

          <button
            onClick={() => handleInvia('email')}
            className={`flex-1 min-w-[110px] px-4 py-2.5 rounded-apple font-medium text-sm transition-colors ${
              fattura.inviata_email_at
                ? 'bg-green-50 text-green-700 hover:bg-green-100'
                : 'bg-blue-50 text-apple-blue hover:bg-blue-100'
            }`}
          >
            📧 {fattura.inviata_email_at ? 'Reinvia' : 'Email'}
          </button>

          <button
            onClick={() => handleInvia('whatsapp')}
            className={`flex-1 min-w-[110px] px-4 py-2.5 rounded-apple font-medium text-sm transition-colors ${
              fattura.inviata_whatsapp_at
                ? 'bg-green-50 text-green-700 hover:bg-green-100'
                : 'bg-green-50 text-green-600 hover:bg-green-100'
            }`}
          >
            💬 {fattura.inviata_whatsapp_at ? 'Reinvia' : 'WhatsApp'}
          </button>

          <button
            onClick={async () => {
              try {
                setErrore(null);
                await generaPdfFattura(fattura);
              } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                setErrore(msg || 'Errore nella generazione del PDF');
              }
            }}
            className="flex-1 min-w-[120px] px-4 py-2.5 bg-gray-100 text-apple-darkgray rounded-apple font-medium text-sm hover:bg-gray-200 transition-colors"
          >
            📄 Scarica PDF
          </button>

          {!showElimina && (
            <button
              onClick={() => setShowElimina(true)}
              disabled={salvando}
              className="px-4 py-2.5 bg-red-50 text-red-600 rounded-apple font-medium text-sm hover:bg-red-100 transition-colors disabled:opacity-50"
              aria-label="Elimina fattura"
            >
              🗑️
            </button>
          )}
        </div>
      </div>

      {showAnteprima && (
        <AnteprimaPdf
          titolo={pagata ? 'Anteprima Fattura' : 'Anteprima Proforma'}
          sottotitolo={`${fattura.numero_fattura} - ${fattura.cliente?.nome_cognome || ''}`}
          onScarica={async () => {
            setShowAnteprima(false);
            try {
              setErrore(null);
              await generaPdfFattura(fattura);
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              setErrore(msg || 'Errore nella generazione del PDF');
            }
          }}
          labelScarica="📄 Scarica PDF"
          onClose={() => setShowAnteprima(false)}
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
              <p className="text-sm font-bold">{fattura.cliente?.nome_cognome || '—'}</p>
              {fattura.cliente?.indirizzo_residenza && (
                <p className="text-sm">
                  {fattura.cliente.indirizzo_residenza}
                  {fattura.cliente.cap_residenza && `, ${fattura.cliente.cap_residenza}`}
                  {fattura.cliente.citta_residenza && ` ${fattura.cliente.citta_residenza}`}
                </p>
              )}
              {fattura.cliente?.codice_fiscale && (
                <p className="text-sm">C.F.: {fattura.cliente.codice_fiscale.toUpperCase()}</p>
              )}
              {fattura.cliente?.partita_iva && (
                <p className="text-sm">P.IVA: {fattura.cliente.partita_iva}</p>
              )}
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
                fattura.righe.map((riga, i) => {
                  const nomePulito = (riga.nome || '').replace(/\s*\(Valore listino:.*?\)/g, '').trim();
                  const isCheckupGratis =
                    nomePulito.toLowerCase().includes('gratuito') ||
                    (nomePulito.toLowerCase().includes('check') && Number(riga.prezzo_unitario_lordo) === 0);

                  return (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="px-2 py-2">
                        <p className="font-medium text-gray-900">
                          {nomePulito || (riga.tipo === 'percorso' ? 'Percorso' : 'Voce fattura')}
                        </p>

                        {riga.data_inizio && riga.data_fine && (
                          <div className="text-xs italic text-gray-500 mt-0.5">
                            Attivazione: {formatData(riga.data_inizio)} | Scadenza: {formatData(riga.data_fine)}
                          </div>
                        )}

                        {isCheckupGratis && (
                          <div className="text-xs italic text-gray-500 mt-0.5">
                            Valore di listino: 225,00 EUR | Sconto 100%
                          </div>
                        )}
                      </td>
                      <td className="text-center px-2 py-2">{riga.quantita}</td>
                      <td className="text-right px-2 py-2">{formatEuro(riga.prezzo_unitario_lordo)}</td>
                      <td className="text-right px-2 py-2 font-semibold">
                        {formatEuro(riga.quantita * riga.prezzo_unitario_lordo)}
                      </td>
                    </tr>
                  );
                })
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

          {fattura.firmato && fattura.firma_immagine && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="font-bold text-sm mb-3">FIRMA DEL CLIENTE PER ACCETTAZIONE</p>
              <img
                src={fattura.firma_immagine}
                alt="Firma cliente"
                className="h-16 mb-2"
              />
              {fattura.data_firma && (
                <p className="text-xs italic text-gray-600">
                  Firmato digitalmente il {formatData(fattura.data_firma)}
                </p>
              )}
            </div>
          )}

          <FooterPdf />
        </AnteprimaPdf>
      )}

      {toastInvia && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100]">
          <div className="bg-apple-darkgray text-white px-5 py-3 rounded-apple shadow-apple-lg text-sm font-medium">
            {toastInvia}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-apple-gray">{label}</span>
      <span className="text-sm text-apple-darkgray font-medium">{value}</span>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-apple p-3">
      <p className="text-xs text-apple-gray mb-1">{label}</p>
      <p className="text-lg font-bold text-apple-darkgray">{value}</p>
    </div>
  );
}
