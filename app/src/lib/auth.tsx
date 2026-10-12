import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { caricaDatiAziendali, invalidaCacheDatiAziendali } from './datiAziendali';
import { caricaAgendaConfig, invalidaCacheAgendaConfig } from './agenda-config';
import { aggiornaCostantiAgenda } from './appuntamenti';
import { initLogoPath, resetLogoPath } from './logo';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  cambiaPassword: (attuale: string, nuova: string) => Promise<{ error: string | null }>;
  esciDaTutti: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Controlla se l'utente e' bloccato/eliminato e in tal caso lo disconnette
  async function controllaBlocco(u: User | null): Promise<boolean> {
    if (!u) return false;
    if (u.user_metadata?.bloccato || u.user_metadata?.eliminato) {
      try { await supabase.auth.signOut(); } catch (e) { console.error(e); }
      setUser(null);
      setSession(null);
      // Salva messaggio per la pagina /login
      const motivo = u.user_metadata?.motivo_blocco;
      const msg = u.user_metadata?.eliminato
        ? 'Account eliminato. Per assistenza contatta luca.trainer@icloud.com'
        : `Account bloccato${motivo ? ': ' + motivo : ''}. Per assistenza contatta luca.trainer@icloud.com`;
      try { sessionStorage.setItem('tricolab_login_error', msg); } catch {}
      return true;
    }
    return false;
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const bloccato = await controllaBlocco(session.user);
        if (bloccato) {
          setLoading(false);
          return;
        }
      }
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const bloccato = await controllaBlocco(session.user);
        if (bloccato) {
          setLoading(false);
          return;
        }
      }
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (session?.user) {
          // Ogni chiamata wrappata in try/catch: se una fallisce, NON blocca il login
          try {
            invalidaCacheAgendaConfig();
            caricaAgendaConfig()
              .then((config) => {
                try { aggiornaCostantiAgenda(config); } catch (e) { console.error('aggiornaCostantiAgenda:', e); }
              })
              .catch((e) => console.error('caricaAgendaConfig:', e));
          } catch (e) {
            console.error('cache agenda:', e);
          }

          try {
            caricaDatiAziendali().catch((e) => console.error('caricaDatiAziendali:', e));
          } catch (e) {
            console.error('caricaDatiAziendali sync:', e);
          }

          try {
            initLogoPath().catch((e) => console.error('initLogoPath:', e));
          } catch (e) {
            console.error('initLogoPath sync:', e);
          }
        }
      }
      if (event === 'SIGNED_OUT') {
        try { invalidaCacheDatiAziendali(); } catch (e) { console.error(e); }
        try { invalidaCacheAgendaConfig(); } catch (e) { console.error(e); }
        try { resetLogoPath(); } catch (e) { console.error(e); }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      let messaggio = error.message;
      if (error.message.includes('Invalid login credentials')) {
        messaggio = 'Email o password non corretti.';
      } else if (error.message.includes('Email not confirmed')) {
        messaggio = 'Email non ancora confermata. Contatta l\'amministratore.';
      } else if (error.message.includes('Too many requests')) {
        messaggio = 'Troppi tentativi. Riprova tra qualche minuto.';
      }
      return { error: messaggio };
    }

    // Controlla se l'utente e' bloccato o eliminato
    const { data: { user: u } } = await supabase.auth.getUser();
    if (u?.user_metadata?.bloccato || u?.user_metadata?.eliminato) {
      try { await supabase.auth.signOut(); } catch (e) { console.error(e); }
      const motivo = u.user_metadata?.motivo_blocco;
      const msg = u.user_metadata?.eliminato
        ? 'Account eliminato. Per assistenza contatta luca.trainer@icloud.com'
        : `Account bloccato${motivo ? ': ' + motivo : ''}. Per assistenza contatta luca.trainer@icloud.com`;
      return { error: msg };
    }

    return { error: null };
  }

  async function signOut() {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('signOut error:', e);
    }
    // NB: NON cancellare localStorage/sessionStorage manualmente.
    // Supabase gestisce già la pulizia internamente.
    // Cancellare le chiavi sb-* rompe il flusso di login successivo.
  }

  /**
   * Cambia la password dell'utente loggato.
   * Verifica prima la password attuale (per evitare session hijack),
   * poi aggiorna con quella nuova.
   */
  async function cambiaPassword(attuale: string, nuova: string): Promise<{ error: string | null }> {
    if (!user?.email) {
      return { error: 'Utente non loggato.' };
    }

    if (nuova.length < 8) {
      return { error: 'La nuova password deve avere almeno 8 caratteri.' };
    }

    // 1. Verifica la password attuale
    const { error: errVerifica } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: attuale,
    });
    if (errVerifica) {
      return { error: 'Password attuale non corretta.' };
    }

    // 2. Aggiorna la password
    const { error: errUpdate } = await supabase.auth.updateUser({ password: nuova });
    if (errUpdate) {
      let messaggio = errUpdate.message;
      if (errUpdate.message.includes('should be different')) {
        messaggio = 'La nuova password deve essere diversa da quella attuale.';
      } else if (errUpdate.message.includes('Password should be')) {
        messaggio = 'La password non soddisfa i requisiti minimi.';
      }
      return { error: messaggio };
    }

    return { error: null };
  }

  /** Esci da tutti i dispositivi (invalida tutte le sessioni attive). */
  async function esciDaTutti() {
    await supabase.auth.signOut({ scope: 'global' });
  }

  return (
    <AuthContext.Provider
      value={{ user, session, loading, signIn, signOut, cambiaPassword, esciDaTutti }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve essere usato dentro <AuthProvider>');
  }
  return ctx;
}
