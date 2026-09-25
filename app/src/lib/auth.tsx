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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (session?.user) {
          invalidaCacheAgendaConfig();
          caricaAgendaConfig().then((config) => {
            aggiornaCostantiAgenda(config);
          });
          caricaDatiAziendali();
          // Inizializza path logo multi-tenant
          initLogoPath();
        }
      }
      if (event === 'SIGNED_OUT') {
        invalidaCacheDatiAziendali();
        invalidaCacheAgendaConfig();
        resetLogoPath();
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
    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
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
