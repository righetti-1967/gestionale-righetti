import { useEffect, useState } from 'react';
import { getClienti, type Cliente } from '../lib/clienti';
import { getPercorsiCliente, aggiornaPercorso, type Percorso } from '../lib/percorsi';
import { getProdotti, type Prodotto } from '../lib/prodotti';
import { getServizi, type Servizio } from '../lib/servizi';
import {
  getProssimoNumeroFattura,
  creaFattura,
  calcolaIvaDa,
  formatEuro,
  type RigaFattura,
} from '../lib/fatture';

interface FormNuovaFatturaProps {
  clienteIniziale?: Cliente | null;
  percorsoIniziale?: Percorso | null;
  checkupIniziale?: boolean | null;
  vociIniziali?: Array<{
    tipo: 'servizio' | 'prodotto';
    servizio_id?: number | null;
    prodotto_id?: number | null;
    nome?: string;
    quantita: number;
  }> | null;
  onClose: () => void;
  onSuccess: (fatturaId: number) => void;
}

const DICITURA_PERCORSO =
  'Percorso Tricologico Personalizzato | Protocollo Righetti Since 1967 | Rif. Contratto Interno';

const DICITURA_GENERICO =
  'Studio Tricologico | Righetti Since 1967 | Rif. Appuntamento Agenda';

const NOME_CHECKUP_ESATTO = 'righetti check-up gratuito';

interface RigaItem {
  id: string;
  tipo: 'servizio' | 'prodotto' | 'libera';
  item_id: number | null;
  nome: string;
  quantita: number;
  prezzo_listino_lordo: number;
  sconto_percentuale: number;
  prezzo_unitario_lordo: number;
}

function trovaServizioGratuitoCatalogo(lista: Servizio[]): Servizio | undefined {
  return (
    lista.find((s) => s.nome.trim().toLowerCase() === NOME_CHECKUP_ESATTO) ||
    lista.find((s) => s.nome.toLowerCase().includes('gratuito'))
  );
}

export function FormNuovaFattura({
  clienteIniziale,
  percorsoIniziale,
  checkupIniziale = false,
  vociIniziali,
  onClose,
  onSuccess,
}: FormNuovaFatturaProps) {
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [percorsiCliente, setPercorsiCliente] = useState<Percorso[]>([]);
  const [prodotti, setProdotti] = useState<Prodotto[]>([]);
  const [servizi, setServizi] = useState<Servizio[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const [tipoFattura, setTipoFattura] = useState<'percorso' | 'libera'>(
    checkupIniziale || (vociIniziali && vociIniziali.length > 0)
      ? 'libera'
      : percorsoIniziale
      ? 'percorso'
      : 'libera'
  );

  const [numero, setNumero] = useState<{
    numero_progressivo: number;
    numero_fattura: string;
    anno: number;
  } | null>(null);

  const [clienteId, setClienteId] = useState<number | null>(clienteIniziale?.id || null);
  const [percorsoId, setPercorsoId] = useState<number | null>(percorsoIniziale?.id || null);
  const [dataInizio, setDataInizio] = useState(new Date().toISOString().split('T')[0]);

  // Se arriva da appuntamento generico (vociIniziali presenti ma non checkup) usa DICITURA_GENERICO
  const isGenericoDaAgenda = Boolean(vociIniziali && vociIniziali.length > 0 && !checkupIniziale);

  const [dicituraLegale, setDicituraLegale] = useState(
    checkupIniziale
      ? 'Valutazione Tricologica Iniziale con Check-up Gratuito | Protocollo Righetti Since 1967'
      : isGenericoDaAgenda
      ? DICITURA_GENERICO
      : DICITURA_PERCORSO
  );

  const [noteInterne, setNoteInterne] = useState(
    checkupIniziale ? 'Check-up Iniziale Gratuito Nuovo Cliente (Valore listino: 225,00 EUR)' : ''
  );

  const [righeLibere, setRigheLibere] = useState<RigaItem[]>([]);
  const [importoManuale, setImportoManuale] = useState<string>('');

  useEffect(() => {
    async function carica() {
      try {
        setLoading(true);
        const [c, num, prod, serv] = await Promise.all([
          getClienti(),
          getProssimoNumeroFattura(),
          getProdotti(),
          getServizi(),
        ]);
        setClienti(c);
        setNumero(num);
        setProdotti(prod);
        setServizi(serv);

        if (vociIniziali && vociIniziali.length > 0) {
          const righeMappate: RigaItem[] = vociIniziali.map((v, idx) => {
            let srvCorrispondente: Servizio | undefined;
            let prodCorrispondente: Prodotto | undefined;
            let listino = 0;

            if (v.tipo === 'servizio') {
              srvCorrispondente = v.servizio_id
                ? serv.find((x) => x.id === v.servizio_id)
                : serv.find((x) => x.nome.trim().toLowerCase() === (v.nome || '').trim().toLowerCase());
              
              listino = Number(srvCorrispondente?.prezzo_lordo || 0);
            } else {
              prodCorrispondente = v.prodotto_id
                ? prod.find((x) => x.id === v.prodotto_id)
                : prod.find((x) => x.nome.trim().toLowerCase() === (v.nome || '').trim().toLowerCase());

              listino = Number(prodCorrispondente?.prezzo_lordo || 0);
            }

            const nomeVoce = srvCorrispondente?.nome || prodCorrispondente?.nome || v.nome || '';
            const itemId = srvCorrispondente?.id || prodCorrispondente?.id || v.servizio_id || v.prodotto_id || null;

            const isCheckup =
              Boolean(checkupIniziale && idx === 0) ||
              nomeVoce.trim().toLowerCase() === NOME_CHECKUP_ESATTO ||
              nomeVoce.toLowerCase().includes('gratuito');

            if (isCheckup && listino === 0) listino = 225;

            const sconto = isCheckup ? 100 : 0;
            const prezzoScontato = Number((listino * (1 - sconto / 100)).toFixed(2));

            return {
              id: `v-init-${idx}`,
              tipo: v.tipo,
              item_id: itemId,
              nome: isCheckup ? 'Righetti Check-Up Gratuito' : nomeVoce,
              quantita: v.quantita || 1,
              prezzo_listino_lordo: listino,
              sconto_percentuale: sconto,
              prezzo_unitario_lordo: prezzoScontato,
            };
          });

          setRigheLibere(righeMappate);
          setTipoFattura('libera');
        } else if (checkupIniziale) {
          const srvCheckup = trovaServizioGratuitoCatalogo(serv);
          const listino = Number(srvCheckup?.prezzo_lordo || 225);

          setRigheLibere([
            {
              id: 'checkup-init-single',
              tipo: 'servizio',
              item_id: srvCheckup?.id || 2,
              nome: 'Righetti Check-Up Gratuito',
              quantita: 1,
              prezzo_listino_lordo: listino,
              sconto_percentuale: 100,
              prezzo_unitario_lordo: 0,
            },
          ]);
          setTipoFattura('libera');
        }
      } catch (err: unknown) {
        setErrore(err instanceof Error ? err.message : String(err) || 'Errore nel caricamento');
      } finally {
        setLoading(false);
      }
    }
    carica();
  }, [checkupIniziale, vociIniziali]);

  useEffect(() => {
    async function caricaPercorsi() {
      if (!clienteId) {
        setPercorsiCliente([]);
        setPercorsoId(null);
        return;
      }
      try {
        const p = await getPercorsiCliente(clienteId);
        const nonFatturati = p.filter((x) => !x.fattura_id);
        setPercorsiCliente(nonFatturati);

        if (!checkupIniziale && (!vociIniziali || vociIniziali.length === 0)) {
          if (percorsoIniziale && percorsoIniziale.cliente_id === clienteId) {
            setPercorsoId(percorsoIniziale.id);
            setTipoFattura('percorso');
          } else if (nonFatturati.length > 0 && !percorsoId) {
            setPercorsoId(nonFatturati[0].id);
            setTipoFattura('percorso');
          }
        }
      } catch (err: unknown) {
        setErrore(
          err instanceof Error ? err.message : String(err) || 'Errore nel caricamento percorsi'
        );
      }
    }
    caricaPercorsi();
  }, [clienteId, percorsoIniziale, checkupIniziale, vociIniziali]);

  function aggiungiRigaProdotto() {
    if (prodotti.length === 0) return;
    const primo = prodotti[0];
    const listino = Number(primo.prezzo_lordo) || 0;
    setRigheLibere((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(7),
        tipo: 'prodotto',
        item_id: primo.id,
        nome: primo.nome,
        quantita: 1,
        prezzo_listino_lordo: listino,
        sconto_percentuale: 0,
        prezzo_unitario_lordo: listino,
      },
    ]);
  }

  function aggiungiRigaServizio() {
    if (servizi.length === 0) return;
    const primo = servizi[0];
    const isCheckup = primo.nome.toLowerCase().includes('gratuito');
    const listino = Number(primo.prezzo_lordo) || 0;
    const sconto = isCheckup ? 100 : 0;
    const prezzo = Number((listino * (1 - sconto / 100)).toFixed(2));

    setRigheLibere((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(7),
        tipo: 'servizio',
        item_id: primo.id,
        nome: primo.nome,
        quantita: 1,
        prezzo_listino_lordo: listino,
        sconto_percentuale: sconto,
        prezzo_unitario_lordo: prezzo,
      },
    ]);
  }

  function aggiungiRigaLiberaManuale() {
    setRigheLibere((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(7),
        tipo: 'libera',
        item_id: null,
        nome: '',
        quantita: 1,
        prezzo_listino_lordo: 0,
        sconto_percentuale: 0,
        prezzo_unitario_lordo: 0,
      },
    ]);
  }

  function cambiaItemRiga(index: number, itemId: number, tipo: 'prodotto' | 'servizio') {
    setRigheLibere((prev) => {
      const copy = [...prev];
      if (tipo === 'prodotto') {
        const prod = prodotti.find((p) => p.id === itemId);
        if (prod) {
          const listino = Number(prod.prezzo_lordo) || 0;
          const sconto = copy[index].sconto_percentuale || 0;
          copy[index] = {
            ...copy[index],
            item_id: prod.id,
            nome: prod.nome,
            prezzo_listino_lordo: listino,
            prezzo_unitario_lordo: Number((listino * (1 - sconto / 100)).toFixed(2)),
          };
        }
      } else {
        const srv = servizi.find((s) => s.id === itemId);
        if (srv) {
          const isCheckup = srv.nome.toLowerCase().includes('gratuito');
          const listino = Number(srv.prezzo_lordo) || 0;
          const sconto = isCheckup ? 100 : copy[index].sconto_percentuale || 0;
          copy[index] = {
            ...copy[index],
            item_id: srv.id,
            nome: srv.nome,
            prezzo_listino_lordo: listino,
            sconto_percentuale: sconto,
            prezzo_unitario_lordo: Number((listino * (1 - sconto / 100)).toFixed(2)),
          };
        }
      }
      return copy;
    });
  }

  function aggiornaScontoRiga(index: number, sconto: number) {
    const s = Math.max(0, Math.min(100, sconto));
    setRigheLibere((prev) => {
      const copy = [...prev];
      const listino = copy[index].prezzo_listino_lordo;
      const prezzoScontato = Number((listino * (1 - s / 100)).toFixed(2));
      copy[index] = {
        ...copy[index],
        sconto_percentuale: s,
        prezzo_unitario_lordo: prezzoScontato,
      };
      return copy;
    });
  }

  function aggiornaListinoRiga(index: number, listino: number) {
    const l = Math.max(0, listino);
    setRigheLibere((prev) => {
      const copy = [...prev];
      const sconto = copy[index].sconto_percentuale || 0;
      const prezzoScontato = Number((l * (1 - sconto / 100)).toFixed(2));
      copy[index] = {
        ...copy[index],
        prezzo_listino_lordo: l,
        prezzo_unitario_lordo: prezzoScontato,
      };
      return copy;
    });
  }

  function aggiornaRiga(index: number, campo: keyof RigaItem, valore: any) {
    setRigheLibere((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [campo]: valore };
      return copy;
    });
  }

  function rimuoviRiga(index: number) {
    setRigheLibere((prev) => prev.filter((_, i) => i !== index));
  }

  const percorsoSelezionato = percorsiCliente.find((p) => p.id === percorsoId) || null;

  let importoLordo = 0;
  if (tipoFattura === 'percorso') {
    importoLordo = percorsoSelezionato
      ? percorsoSelezionato.totale_finale
      : parseFloat(importoManuale) || 0;
  } else {
    importoLordo = righeLibere.reduce(
      (sum, r) => sum + Number(r.quantita || 0) * Number(r.prezzo_unitario_lordo || 0),
      0
    );
  }

  const importi = calcolaIvaDa(importoLordo);

  const valoreListinoTotale = righeLibere.reduce(
    (sum, r) => sum + Number(r.quantita || 0) * Number(r.prezzo_listino_lordo || 0),
    0
  );
  const valoreScontato = valoreListinoTotale - importoLordo;

  async function handleSubmit() {
    if (!clienteId) {
      setErrore('Seleziona un cliente');
      return;
    }

    if (tipoFattura === 'percorso' && !percorsoSelezionato && importoLordo <= 0) {
      setErrore('Seleziona un percorso o inserisci un importo');
      return;
    }

    if (tipoFattura === 'libera') {
      if (righeLibere.length === 0) {
        setErrore('Aggiungi almeno una voce');
        return;
      }
      if (!checkupIniziale && importoLordo <= 0 && valoreScontato <= 0) {
        setErrore('Aggiungi almeno un prodotto o servizio con prezzo valido');
        return;
      }
    }

    if (!numero) {
      setErrore('Errore nel calcolo del numero fattura');
      return;
    }

    try {
      setSalvando(true);
      setErrore(null);

      let righe: RigaFattura[] = [];

      if (tipoFattura === 'percorso') {
        righe = percorsoSelezionato
          ? [
              {
                tipo: 'percorso',
                servizio_id: null,
                prodotto_id: null,
                percorso_id: percorsoSelezionato.id,
                nome: percorsoSelezionato.nome,
                quantita: 1,
                prezzo_unitario_lordo: percorsoSelezionato.totale_finale,
                data_inizio: percorsoSelezionato.data_inizio,
                data_fine: percorsoSelezionato.data_fine,
              },
            ]
          : [
              {
                tipo: 'libera',
                servizio_id: null,
                prodotto_id: null,
                nome: 'Voce fattura generica',
                quantita: 1,
                prezzo_unitario_lordo: importoLordo,
              },
            ];
      } else {
        righe = righeLibere.map((r) => {
          const isCheckup = r.sconto_percentuale === 100 || r.nome.toLowerCase().includes('gratuito');
          const nomeFattura = isCheckup
            ? `${r.nome} (Valore listino: ${formatEuro(r.prezzo_listino_lordo)} - Sconto 100%)`
            : r.nome || (r.tipo === 'prodotto' ? 'Prodotto' : 'Servizio');

          return {
            tipo: r.tipo,
            servizio_id: r.tipo === 'servizio' ? r.item_id : null,
            prodotto_id: r.tipo === 'prodotto' ? r.item_id : null,
            nome: nomeFattura,
            quantita: Number(r.quantita) || 1,
            prezzo_unitario_lordo: Number(r.prezzo_unitario_lordo) || 0,
          };
        });
      }

      const nuovaFattura = await creaFattura({
        numero_fattura: numero.numero_fattura,
        numero_progressivo: numero.numero_progressivo,
        anno: numero.anno,
        numero_scontrino_madre: null,
        cliente_id: clienteId,
        data_inizio: dataInizio,
        data_fine: percorsoSelezionato?.data_fine || null,
        data_incasso: null,
        data_firma: null,
        lordo_ivato: importi.lordo,
        netto_imponibile: importi.netto,
        iva_importo: importi.iva,
        righe,
        dicitura_legale: dicituraLegale.trim() || null,
        note_interne: noteInterne.trim() || null,
        inviato_sdi: false,
        firmato: false,
        firma_immagine: null,
        pacchetto_scelto_id: null,
        inviata_email_at: null,
        inviata_whatsapp_at: null,
      });

      if (tipoFattura === 'percorso' && percorsoSelezionato) {
        await aggiornaPercorso(percorsoSelezionato.id, {
          fattura_id: nuovaFattura.id,
        });
      }

      onSuccess(nuovaFattura.id);
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
          <div className="text-apple-gray text-sm">Caricamento in corso...</div>
        </div>
      </div>
    );
  }

  const bottoneDisabilitato =
    salvando ||
    !clienteId ||
    (tipoFattura === 'percorso' && !percorsoSelezionato && importoLordo <= 0) ||
    (tipoFattura === 'libera' && righeLibere.length === 0) ||
    (tipoFattura === 'libera' && !checkupIniziale && !isGenericoDaAgenda && importoLordo <= 0);

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white sm:rounded-apple rounded-t-3xl shadow-apple-lg w-full sm:max-w-3xl max-h-[95vh] sm:my-8 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-200/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-apple bg-gradient-to-br from-apple-blue to-blue-600 flex items-center justify-center text-white text-xl shrink-0">
              📄
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-apple-darkgray">
                {checkupIniziale ? 'Proforma Check-Up Gratuito' : 'Nuova Fattura Proforma'}
              </h2>
              <p className="text-xs text-apple-gray">
                {numero ? `Numero: ${numero.numero_fattura}` : 'Caricamento...'}
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
            <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-3">
              📄 Dati Base
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>Numero Fattura</Label>
                <div className="w-full px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-apple text-sm font-bold text-apple-blue">
                  {numero?.numero_fattura || '—'}
                </div>
              </div>
              <div>
                <Label>Anno</Label>
                <div className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-apple text-sm text-apple-darkgray">
                  {numero?.anno || '—'}
                </div>
              </div>
              <div>
                <Label required>Data Emissione</Label>
                <Input type="date" value={dataInizio} onChange={setDataInizio} />
              </div>
            </div>
          </div>

          <div>
            <Label required>Cliente</Label>
            <select
              value={clienteId || ''}
              onChange={(e) => setClienteId(Number(e.target.value) || null)}
              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
            >
              <option value="">— Seleziona cliente —</option>
              {clienti.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome_cognome}
                </option>
              ))}
            </select>
          </div>

          {clienteId && (
            <div>
              <Label>Tipologia Contenuto</Label>
              <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-apple">
                <button
                  type="button"
                  onClick={() => setTipoFattura('libera')}
                  className={`py-2 text-xs sm:text-sm font-semibold rounded-apple transition-all ${
                    tipoFattura === 'libera'
                      ? 'bg-white text-apple-darkgray shadow-sm'
                      : 'text-apple-gray hover:text-apple-darkgray'
                  }`}
                >
                  📦 Prodotti & Servizi
                </button>
                <button
                  type="button"
                  onClick={() => setTipoFattura('percorso')}
                  className={`py-2 text-xs sm:text-sm font-semibold rounded-apple transition-all ${
                    tipoFattura === 'percorso'
                      ? 'bg-white text-apple-darkgray shadow-sm'
                      : 'text-apple-gray hover:text-apple-darkgray'
                  }`}
                >
                  🎯 Da Percorso
                </button>
              </div>
            </div>
          )}

          {clienteId && tipoFattura === 'percorso' && (
            <div>
              <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-3">
                🎯 Seleziona Percorso da Fatturare
              </h3>
              {percorsiCliente.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-apple p-4 text-xs text-amber-700">
                  ⚠️ Nessun percorso attivo non ancora fatturato. Passa a "Prodotti & Servizi".
                </div>
              ) : (
                <div className="space-y-2">
                  {percorsiCliente.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPercorsoId(p.id === percorsoId ? null : p.id)}
                      className={`w-full text-left px-4 py-3 rounded-apple border-2 transition-colors ${
                        percorsoId === p.id
                          ? 'bg-blue-50 border-apple-blue'
                          : 'bg-gray-50 border-transparent hover:bg-blue-50/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-apple-darkgray truncate">{p.nome}</p>
                          <p className="text-xs text-apple-gray">
                            {new Date(p.data_inizio).toLocaleDateString('it-IT')} →{' '}
                            {new Date(p.data_fine).toLocaleDateString('it-IT')}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-apple-darkgray">
                            {formatEuro(p.totale_finale)}
                          </p>
                          {percorsoId === p.id && (
                            <span className="text-xs text-apple-blue font-semibold">✓ Selezionato</span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {!percorsoSelezionato && (
                <div className="mt-3">
                  <Label>Oppure importo forfettario manuale</Label>
                  <Input
                    type="number"
                    value={importoManuale}
                    onChange={setImportoManuale}
                    placeholder="0.00"
                  />
                </div>
              )}
            </div>
          )}

          {clienteId && tipoFattura === 'libera' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide">
                  📦 Righe Fattura (Prodotti e Servizi)
                </h3>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={aggiungiRigaProdotto}
                    className="px-2.5 py-1.5 bg-blue-50 text-apple-blue hover:bg-blue-100 rounded-apple text-xs font-semibold transition-colors"
                  >
                    + Prodotto
                  </button>
                  <button
                    type="button"
                    onClick={aggiungiRigaServizio}
                    className="px-2.5 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-apple text-xs font-semibold transition-colors"
                  >
                    + Servizio
                  </button>
                  <button
                    type="button"
                    onClick={aggiungiRigaLiberaManuale}
                    className="px-2.5 py-1.5 bg-gray-100 text-apple-darkgray hover:bg-gray-200 rounded-apple text-xs font-semibold transition-colors"
                  >
                    + Riga Libera
                  </button>
                </div>
              </div>

              {righeLibere.length === 0 ? (
                <div className="bg-gray-50 border border-dashed border-gray-300 rounded-apple p-6 text-center">
                  <p className="text-sm text-apple-gray mb-1">Nessun articolo inserito</p>
                  <p className="text-xs text-apple-gray/70">
                    Clicca sui pulsanti in alto a destra per aggiungere Prodotti dal magazzino o Servizi
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {righeLibere.map((riga, index) => {
                    const isCheckup =
                      riga.sconto_percentuale === 100 ||
                      riga.nome.toLowerCase().includes('gratuito');

                    return (
                      <div
                        key={riga.id}
                        className="p-3 bg-gray-50 rounded-apple border border-gray-200 flex flex-col gap-2"
                      >
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0 ${
                              riga.tipo === 'prodotto'
                                ? 'bg-blue-100 text-apple-blue'
                                : riga.tipo === 'servizio'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-gray-200 text-gray-700'
                            }`}
                          >
                            {riga.tipo}
                          </span>

                          <div className="flex-1 w-full min-w-[140px]">
                            {riga.tipo === 'prodotto' ? (
                              <select
                                value={riga.item_id || ''}
                                onChange={(e) =>
                                  cambiaItemRiga(index, Number(e.target.value), 'prodotto')
                                }
                                className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-apple text-xs font-medium text-apple-darkgray"
                              >
                                {prodotti.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.nome} ({formatEuro(p.prezzo_lordo)})
                                  </option>
                                ))}
                              </select>
                            ) : riga.tipo === 'servizio' ? (
                              <select
                                value={riga.item_id || ''}
                                onChange={(e) =>
                                  cambiaItemRiga(index, Number(e.target.value), 'servizio')
                                }
                                className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-apple text-xs font-medium text-apple-darkgray"
                              >
                                {servizi.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.nome} ({formatEuro(s.prezzo_lordo)})
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="text"
                                placeholder="Descrizione riga..."
                                value={riga.nome}
                                onChange={(e) => aggiornaRiga(index, 'nome', e.target.value)}
                                className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-apple text-xs font-medium text-apple-darkgray"
                              />
                            )}
                          </div>

                          <div className="w-16 shrink-0">
                            <input
                              type="number"
                              min="1"
                              value={riga.quantita}
                              onChange={(e) =>
                                aggiornaRiga(index, 'quantita', Math.max(1, parseInt(e.target.value) || 1))
                              }
                              className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-apple text-xs text-center font-medium"
                              title="Quantità"
                            />
                          </div>

                          <div className="w-28 shrink-0">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={riga.prezzo_listino_lordo}
                              onChange={(e) =>
                                aggiornaListinoRiga(index, parseFloat(e.target.value) || 0)
                              }
                              className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-apple text-xs text-right font-medium"
                              title="Prezzo unitario lordo"
                            />
                          </div>

                          <div className="w-20 shrink-0">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="1"
                              value={riga.sconto_percentuale}
                              onChange={(e) =>
                                aggiornaScontoRiga(index, parseInt(e.target.value, 10) || 0)
                              }
                              className={`w-full px-2 py-1.5 border rounded-apple text-xs text-center font-bold ${
                                riga.sconto_percentuale === 100
                                  ? 'bg-green-50 border-green-300 text-green-700'
                                  : 'bg-white border-gray-200 text-apple-darkgray'
                              }`}
                              title="Sconto percentuale"
                            />
                          </div>

                          <div className="w-24 text-right text-xs font-bold text-apple-darkgray shrink-0">
                            {formatEuro(riga.quantita * riga.prezzo_unitario_lordo)}
                          </div>

                          <button
                            type="button"
                            onClick={() => rimuoviRiga(index)}
                            className="w-7 h-7 rounded-full text-red-500 hover:bg-red-50 flex items-center justify-center shrink-0 transition-colors"
                          >
                            ✕
                          </button>
                        </div>

                        {isCheckup && (
                          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-200/60 text-xs">
                            <span className="text-gray-400 line-through">
                              {formatEuro(riga.prezzo_listino_lordo)}
                            </span>
                            <span className="text-[11px] font-bold text-green-700 bg-green-100 border border-green-200 px-2 py-0.5 rounded-full">
                              Sconto 100%
                            </span>
                            <span className="text-apple-darkgray font-semibold">
                              Valore di listino: {formatEuro(riga.prezzo_listino_lordo)} | Righetti Check-Up Gratuito
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div>
            <Label>Note documento</Label>
            <textarea
              value={dicituraLegale}
              onChange={(e) => setDicituraLegale(e.target.value)}
              placeholder="Note documento..."
              rows={2}
              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/30 resize-none"
            />
          </div>

          {(importoLordo > 0 || checkupIniziale) && (
            <div className="bg-green-50 border border-green-200 rounded-apple p-4 space-y-2">
              <h3 className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">
                💰 Riepilogo Importi
              </h3>
              <div className="flex items-center justify-between text-sm">
                <span className="text-apple-gray">Totale Lordo (IVA inclusa)</span>
                <span className="font-bold text-apple-darkgray">
                  {formatEuro(importi.lordo)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-apple-gray">Netto Imponibile</span>
                <span className="text-apple-darkgray">{formatEuro(importi.netto)}</span>
              </div>
              <div className="flex items-center justify-between text-sm pt-2 border-t border-green-200">
                <span className="text-apple-gray">IVA 22%</span>
                <span className="font-semibold text-green-700">
                  {formatEuro(importi.iva)}
                </span>
              </div>
            </div>
          )}

          <div>
            <Label>Note interne (opzionali)</Label>
            <textarea
              value={noteInterne}
              onChange={(e) => setNoteInterne(e.target.value)}
              placeholder="Note private..."
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
            disabled={salvando || !clienteId || (tipoFattura === 'libera' && righeLibere.length === 0)}
            className="flex-1 px-4 py-2.5 bg-apple-blue text-white rounded-apple font-medium text-sm hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {salvando ? 'Salvataggio...' : `Salva Fattura ${numero?.numero_fattura || ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

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
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      step={type === 'number' ? '0.01' : undefined}
      min={type === 'number' ? '0' : undefined}
      className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
    />
  );
}
