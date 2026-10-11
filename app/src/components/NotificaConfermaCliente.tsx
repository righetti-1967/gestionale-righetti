import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface AppuntamentoConfermato {
  id: number;
  cliente_id: number;
  cliente_nome?: string;
  data: string;
  ora_inizio: string;
  operatore: string;
  confermato_da_cliente_at: string;
}

export function NotificaConfermaCliente() {
  const [notifiche, setNotifiche] = useState<AppuntamentoConfermato[]>([]);

  useEffect(() => {
    // Ascolta UPDATE su appuntamenti
    const channel = supabase
      .channel('notifica_conferma_cliente_gestionale')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'appuntamenti',
        },
        async (payload) => {
          const newRow = payload.new as any;
          const oldRow = payload.old as any;

          // Solo se:
          // 1) stato passa a 'confermato'
          // 2) confermato_da_cliente_at è valorizzato (conferma cliente, non studio)
          // 3) old.stato era diverso (transizione reale)
          if (
            newRow.stato === 'confermato' &&
            newRow.confermato_da_cliente_at &&
            oldRow.stato !== 'confermato'
          ) {
            // Recupera il nome cliente
            let clienteNome = '';
            try {
              const { data: cliente } = await supabase
                .from('clienti')
                .select('nome_cognome')
                .eq('id', newRow.cliente_id)
                .maybeSingle();
              clienteNome = cliente?.nome_cognome || '';
            } catch (e) {
              console.warn('Errore recupero nome cliente:', e);
            }

            const notifica: AppuntamentoConfermato = {
              id: newRow.id,
              cliente_id: newRow.cliente_id,
              cliente_nome: clienteNome,
              data: newRow.data,
              ora_inizio: newRow.ora_inizio,
              operatore: newRow.operatore,
              confermato_da_cliente_at: newRow.confermato_da_cliente_at,
            };

            setNotifiche((prev) => {
              // Evita duplicati
              if (prev.find((n) => n.id === notifica.id)) return prev;
              return [...prev, notifica];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  function apriInAgenda(n: AppuntamentoConfermato) {
    localStorage.setItem('agenda_data_iniziale', n.data);
    setNotifiche((prev) => prev.filter((x) => x.id !== n.id));

    // 1) Cambia pagina
    window.dispatchEvent(
      new CustomEvent('navigate-to-page', { detail: { page: 'agenda' } })
    );

    // 2) Dopo 150ms invia la data (per Agenda già montata)
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('agenda-vai-a-data', { detail: { data: n.data } })
      );
    }, 150);
  }

  function chiudi(id: number) {
    setNotifiche((prev) => prev.filter((n) => n.id !== id));
  }

  if (notifiche.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-3 pointer-events-none max-w-[500px] w-[calc(100%-2rem)]">
      {notifiche.map((n) => {
        const dataFmt = new Date(n.data + 'T00:00:00').toLocaleDateString('it-IT', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        });
        const oraFmt = n.ora_inizio.slice(0, 5);
        const nomeMostrato = n.cliente_nome || `Cliente #${n.cliente_id}`;

        return (
          <div
            key={n.id}
            className="bg-white rounded-apple shadow-apple-lg border-2 border-green-400 p-4 pointer-events-auto animate-in slide-in-from-top duration-300"
          >
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-2xl shrink-0">
                ✅
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-apple-darkgray">
                  {nomeMostrato} ha confermato!
                </p>
                <p className="text-xs text-apple-gray mt-1">
                  📅 {dataFmt} alle {oraFmt}
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => apriInAgenda(n)}
                    className="px-3 py-1.5 bg-apple-blue text-white rounded-apple text-xs font-semibold hover:bg-blue-600 transition-colors"
                  >
                    👁️ Vedi in Agenda
                  </button>
                  <button
                    onClick={() => chiudi(n.id)}
                    className="px-3 py-1.5 bg-gray-100 text-apple-darkgray rounded-apple text-xs font-medium hover:bg-gray-200 transition-colors"
                  >
                    Chiudi
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
