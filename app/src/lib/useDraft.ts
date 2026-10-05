/**
 * useDraft — Hook React per salvataggio automatico bozze multi-device.
 * Porting da TricoAI v2.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

const DEBOUNCE_MS = 1500;

export type StatoSalvataggio = 'salvato' | 'salvando' | 'errore' | 'iniziale';

export function useDraft<T>(
  chiaveDraft: string,
  initialState: T,
  options?: { enabled?: boolean }
) {
  const enabled = options?.enabled ?? true;
  const [state, setStateInternal] = useState<T>(initialState);
  const [loading, setLoading] = useState(enabled);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [statoSalvataggio, setStatoSalvataggio] = useState<StatoSalvataggio>('iniziale');
  const [errore, setErrore] = useState<string | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const caricatoRef = useRef(false);
  const isDirtyRef = useRef(false);
  const stateRef = useRef(state);

  const isSavingRef = useRef(false);
  const savePendingAfterCurrentRef = useRef(false);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // 1. Carica bozza iniziale
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    caricatoRef.current = false;
    isDirtyRef.current = false;
    setStatoSalvataggio('iniziale');
    setLastSavedAt(null);

    async function caricaBozza() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) {
          if (!cancelled && mountedRef.current) setLoading(false);
          return;
        }
        userIdRef.current = user.id;

        const { data, error } = await supabase
          .from('bozze')
          .select('payload, updated_at')
          .eq('user_id', user.id)
          .eq('chiave_draft', chiaveDraft)
          .maybeSingle();

        if (error) {
          console.warn('Errore caricamento bozza:', error);
        } else if (data?.payload && !cancelled && mountedRef.current) {
          setStateInternal({ ...initialState, ...(data.payload as T) });
          setLastSavedAt(new Date(data.updated_at));
          setStatoSalvataggio('salvato');
        } else if (!cancelled && mountedRef.current) {
          setStateInternal(initialState);
          setLastSavedAt(null);
          setStatoSalvataggio('iniziale');
        }
      } catch (e) {
        console.warn('Errore caricamento bozza:', e);
      } finally {
        if (!cancelled && mountedRef.current) {
          setLoading(false);
          caricatoRef.current = true;
        }
      }
    }

    caricaBozza();

    return () => {
      cancelled = true;
    };
  }, [chiaveDraft, enabled]);

  // Reset timer al cambio chiave
  useEffect(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
  }, [chiaveDraft]);

  // 2. Salvataggio
  const eseguiSalvataggio = useCallback(async () => {
    if (!enabled || !caricatoRef.current || !isDirtyRef.current) return;

    if (isSavingRef.current) {
      savePendingAfterCurrentRef.current = true;
      return;
    }

    isSavingRef.current = true;
    if (mountedRef.current) setStatoSalvataggio('salvando');

    try {
      let uid = userIdRef.current;
      if (!uid) {
        const { data: { session } } = await supabase.auth.getSession();
        uid = session?.user?.id ?? null;
        userIdRef.current = uid;
      }

      if (!uid) {
        if (mountedRef.current) setStatoSalvataggio('errore');
        return;
      }

      const payloadDaSalvare = stateRef.current;
      isDirtyRef.current = false;

      const { error } = await supabase
        .from('bozze')
        .upsert(
          {
            user_id: uid,
            chiave_draft: chiaveDraft,
            payload: payloadDaSalvare as unknown as Record<string, unknown>,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,chiave_draft' }
        );

      if (error) {
        console.warn('Errore salvataggio bozza:', error);
        isDirtyRef.current = true;
        if (mountedRef.current) {
          setErrore(error.message);
          setStatoSalvataggio('errore');
        }
      } else {
        if (mountedRef.current) {
          setLastSavedAt(new Date());
          setErrore(null);
          setStatoSalvataggio('salvato');
        }
      }
    } catch (e: any) {
      console.warn('Errore salvataggio bozza:', e);
      isDirtyRef.current = true;
      if (mountedRef.current) setStatoSalvataggio('errore');
    } finally {
      isSavingRef.current = false;
      if (savePendingAfterCurrentRef.current) {
        savePendingAfterCurrentRef.current = false;
        eseguiSalvataggio();
      }
    }
  }, [chiaveDraft, enabled]);

  // Trigger con debounce
  useEffect(() => {
    if (!enabled || loading || !caricatoRef.current) return;

    if (!isDirtyRef.current) {
      setStatoSalvataggio((prev) => (prev === 'salvando' ? 'iniziale' : prev));
      return;
    }

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      eseguiSalvataggio();
    }, DEBOUNCE_MS);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state, chiaveDraft, enabled, loading, eseguiSalvataggio]);

  // 3. Realtime
  useEffect(() => {
    if (!enabled || !chiaveDraft) return;

    const channel = supabase
      .channel(`realtime_bozze_${chiaveDraft}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bozze' },
        (payload: any) => {
          const nuovo = payload.new as any;
          if (nuovo && nuovo.chiave_draft === chiaveDraft) {
            if (!isDirtyRef.current && !isSavingRef.current && mountedRef.current && nuovo.payload) {
              setStateInternal(nuovo.payload as T);
              if (nuovo.updated_at) {
                setLastSavedAt(new Date(nuovo.updated_at));
              }
              setStatoSalvataggio('salvato');
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chiaveDraft, enabled]);

  // 4. Salvataggio su chiusura / cambio pagina
  useEffect(() => {
    if (!enabled) return;

    function salvaOra() {
      if (!caricatoRef.current || !isDirtyRef.current || !userIdRef.current) return;
      eseguiSalvataggio();
    }

    function onVisibility() {
      if (document.visibilityState === 'hidden') {
        salvaOra();
      }
    }

    window.addEventListener('beforeunload', salvaOra);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('beforeunload', salvaOra);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [chiaveDraft, enabled, eseguiSalvataggio]);

  function setState(updater: T | ((prev: T) => T)) {
    isDirtyRef.current = true;
    setStateInternal(updater);
  }

  function resetDraft(newInitial?: T) {
    isDirtyRef.current = false;
    setStateInternal(newInitial ?? initialState);
  }

  async function eliminaDraft() {
    try {
      const uid = userIdRef.current;
      if (!uid) return;

      await supabase
        .from('bozze')
        .delete()
        .eq('user_id', uid)
        .eq('chiave_draft', chiaveDraft);

      setLastSavedAt(null);
      setStatoSalvataggio('iniziale');
      isDirtyRef.current = false;
    } catch (e) {
      console.warn('Errore eliminazione bozza:', e);
    }
  }

  return {
    state,
    setState,
    resetDraft,
    eliminaDraft,
    loading,
    lastSavedAt,
    statoSalvataggio,
    errore,
  };
}
