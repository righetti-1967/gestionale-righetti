import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getClienti, type Cliente } from '../lib/clienti';
import {
  getAppuntamentiCliente,
  type Appuntamento,
} from '../lib/appuntamenti';

interface RicercaClienteAgendaProps {
  onVaiAAppuntamento: (data: string, appuntamentoId: number) => void;
}

function normalizza(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function formattaData(dataISO: string): string {
  const d = new Date(dataISO + 'T00:00:00');
  return d.toLocaleDateString('it-IT', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function isFuturo(dataISO: string): boolean {
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  const d = new Date(dataISO + 'T00:00:00');
  return d >= oggi;
}

export function RicercaClienteAgenda({ onVaiAAppuntamento }: RicercaClienteAgendaProps) {
  const [query, setQuery] = useState('');
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [loadingClienti, setLoadingClienti] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [popoverAperto, setPopoverAperto] = useState(false);

  const [clienteSelezionato, setClienteSelezionato] = useState<Cliente | null>(null);
  const [appuntamenti, setAppuntamenti] = useState<Appuntamento[]>([]);
  const [loadingAppuntamenti, setLoadingAppuntamenti] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Carica tutti i clienti una volta
  useEffect(() => {
    (async () => {
      try {
        setLoadingClienti(true);
        const c = await getClienti();
        setClienti(c);
      } catch (err) {
        console.error('Errore caricamento clienti:', err);
      } finally {
        setLoadingClienti(false);
      }
    })();
  }, []);

  // Chiudi popover + dropdown quando click fuori
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setPopoverAperto(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ESC per chiudere
  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setPopoverAperto(false);
        setShowDropdown(false);
        setQuery('');
      }
    }
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, []);

  const clientiFiltrati = useMemo(() => {
    const q = normalizza(query);
    if (!q) return [];

    const parole = q.split(/\s+/);

    return clienti
      .filter((c) => {
        const nome = normalizza(c.nome_cognome || '');
        const cell = (c.cellulare || '').toLowerCase().replace(/\s/g, '');
        const email = (c.email || '').toLowerCase();

        const matchNome = parole.every((p) => nome.includes(p));
        const matchCell = cell.includes(q.replace(/\s/g, ''));
        const matchEmail = email.includes(q);

        return matchNome || matchCell || matchEmail;
      })
      .slice(0, 10);
  }, [clienti, query]);

  async function apriCliente(c: Cliente) {
    setClienteSelezionato(c);
    setShowDropdown(false);
    setLoadingAppuntamenti(true);
    try {
      const apps = await getAppuntamentiCliente(c.id);
      // Ordina: futuri prima (crescente), poi passati (decrescente)
      const oggi = new Date();
      oggi.setHours(0, 0, 0, 0);
      apps.sort((a, b) => {
        const aFut = new Date(a.data + 'T00:00:00') >= oggi;
        const bFut = new Date(b.data + 'T00:00:00') >= oggi;
        if (aFut && !bFut) return -1;
        if (!aFut && bFut) return 1;
        if (aFut && bFut) return a.data.localeCompare(b.data);
        return b.data.localeCompare(a.data);
      });
      setAppuntamenti(apps);
    } catch (err) {
      console.error('Errore caricamento appuntamenti:', err);
    } finally {
      setLoadingAppuntamenti(false);
    }
  }

  function handleClickAppuntamento(app: Appuntamento) {
    onVaiAAppuntamento(app.data, app.id);
    setClienteSelezionato(null);
    setQuery('');
    setAppuntamenti([]);
  }

  return (
    <>
      {/* Bottone Cerca cliente + Popover */}
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setPopoverAperto((v) => !v)}
          className={`px-4 py-2.5 rounded-apple font-medium text-sm transition-colors flex items-center justify-center gap-2 shadow-apple ${
            popoverAperto
              ? 'bg-apple-blue text-white'
              : 'bg-white text-apple-darkgray hover:bg-gray-50'
          }`}
        >
          <span>🔍</span>
          <span>Cerca cliente</span>
        </button>

        {popoverAperto && (
          <div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-apple shadow-apple-lg border border-gray-200/60 z-40 overflow-hidden">
            {/* Input ricerca */}
            <div className="p-3 border-b border-gray-100">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-apple-gray text-sm">
                  🔍
                </span>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setShowDropdown(true);
                  }}
                  autoFocus
                  placeholder="Cerca per nome, cellulare, email..."
                  className="w-full pl-9 pr-8 py-2.5 bg-gray-50 border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      setShowDropdown(false);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-apple-gray text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Risultati */}
            <div className="max-h-72 overflow-y-auto">
              {!query.trim() ? (
                <p className="px-4 py-6 text-center text-xs text-apple-gray">
                  Digita per cercare un cliente
                </p>
              ) : loadingClienti ? (
                <p className="px-4 py-6 text-center text-xs text-apple-gray">
                  Caricamento...
                </p>
              ) : clientiFiltrati.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-apple-gray">
                  Nessun cliente trovato
                </p>
              ) : (
                clientiFiltrati.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      apriCliente(c);
                      setPopoverAperto(false);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-0"
                  >
                    <p className="text-sm font-medium text-apple-darkgray truncate">
                      {c.nome_cognome}
                    </p>
                    <div className="flex gap-2 text-xs text-apple-gray">
                      {c.cellulare && <span>📞 {c.cellulare}</span>}
                      {c.email && <span className="truncate">✉️ {c.email}</span>}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modale appuntamenti cliente */}
      {clienteSelezionato && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[80]"
          onClick={() => {
            setClienteSelezionato(null);
            setQuery('');
            setAppuntamenti([]);
          }}
        >
          <div
            className="bg-white rounded-apple shadow-apple-lg max-w-lg w-full max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-200/60 flex items-start justify-between">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-apple-darkgray truncate">
                  👤 {clienteSelezionato.nome_cognome}
                </h3>
                <div className="flex gap-3 text-xs text-apple-gray mt-0.5">
                  {clienteSelezionato.cellulare && (
                    <span>📞 {clienteSelezionato.cellulare}</span>
                  )}
                  {clienteSelezionato.email && (
                    <span className="truncate">✉️ {clienteSelezionato.email}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setClienteSelezionato(null);
                  setQuery('');
                  setAppuntamenti([]);
                }}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-apple-gray transition-colors shrink-0 ml-3"
              >
                ✕
              </button>
            </div>

            {/* Lista appuntamenti */}
            <div className="flex-1 overflow-y-auto">
              {loadingAppuntamenti ? (
                <p className="px-5 py-8 text-center text-xs text-apple-gray">
                  Caricamento appuntamenti...
                </p>
              ) : appuntamenti.length === 0 ? (
                <p className="px-5 py-8 text-center text-xs text-apple-gray">
                  📭 Nessun appuntamento trovato
                </p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {appuntamenti.map((app) => {
                    const futuro = isFuturo(app.data);
                    return (
                      <button
                        key={app.id}
                        type="button"
                        onClick={() => handleClickAppuntamento(app)}
                        className={`w-full text-left px-5 py-3 transition-colors ${
                          futuro
                            ? 'bg-blue-50/40 hover:bg-blue-100'
                            : 'bg-gray-50/60 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p
                              className={`text-sm font-semibold ${
                                futuro ? 'text-apple-blue' : 'text-apple-gray'
                              }`}
                            >
                              {formattaData(app.data)} · {app.ora_inizio.slice(0, 5)}
                            </p>
                            <p
                              className={`text-xs truncate ${
                                futuro ? 'text-apple-darkgray' : 'text-apple-gray'
                              }`}
                            >
                              {app.titolo || 'Appuntamento'}
                              {app.operatore && ` · ${app.operatore}`}
                            </p>
                          </div>
                          <span
                            className={`text-lg shrink-0 ${
                              futuro ? 'text-apple-blue' : 'text-apple-gray/60'
                            }`}
                          >
                            →
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-200/60 bg-gray-50/50 text-center">
              <p className="text-[10px] text-apple-gray">
                Clicca su un appuntamento per andare alla data in agenda
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
