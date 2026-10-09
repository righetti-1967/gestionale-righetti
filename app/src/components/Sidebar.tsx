import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { caricaDatiAziendali } from '../lib/datiAziendali';
import type { DatiAziendali } from '../lib/studio';
import { getLogoUrl } from '../lib/logo';
import { getDemoStatus } from '../lib/demo';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  soloRegime?: 'fatture' | 'scontrini';
}

const menuItems: MenuItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
  { id: 'clienti', label: 'Clienti', icon: '👥' },
  { id: 'percorsi', label: 'Percorsi', icon: '🎯' },
  { id: 'fatture', label: 'Fatture', icon: '📄', soloRegime: 'fatture' },
  { id: 'ddt', label: 'DDT', icon: '📋', soloRegime: 'fatture' },
  { id: 'cassa_fiscale', label: 'Cassa Fiscale', icon: '🧾', soloRegime: 'scontrini' },
  { id: 'analytics', label: 'Analytics', icon: '📊' },
  { id: 'prodotti', label: 'Prodotti', icon: '📦' },
  { id: 'servizi', label: 'Servizi', icon: '🛠️' },
  { id: 'agenda', label: 'Agenda', icon: '📅' },
  { id: 'magazzino', label: 'Magazzino', icon: '🏪' },
  { id: 'ordini', label: 'Ordini', icon: '🛒' },
];

export function Sidebar({ currentPage, onNavigate, mobileOpen, onCloseMobile }: SidebarProps) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [confermaLogout, setConfermaLogout] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [datiAziendali, setDatiAziendali] = useState<DatiAziendali | null>(null);
  const demoStatus = getDemoStatus(user);

  useEffect(() => {
    caricaDatiAziendali()
      .then((d) => {
        setLogoUrl(d.logo_url ?? '');
        setDatiAziendali(d);
      })
      .catch(console.error);

    // 🔔 Ascolta cambi dati aziendali (es. cambio regime documenti)
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setDatiAziendali(customEvent.detail);
        setLogoUrl(customEvent.detail.logo_url ?? '');
      }
    };
    window.addEventListener('datiAziendali-aggiornati', handler);
    return () => window.removeEventListener('datiAziendali-aggiornati', handler);
  }, []);

  const currentPageId = currentPage;
  const isUserDemo = getDemoStatus(user).isDemo;

  // Filtro menu in base al regime documenti
  const regimeDocumenti = datiAziendali?.regimeDocumenti ?? 'fatture';
  const menuFiltrato = menuItems.filter((item) => {
    if (!item.soloRegime) return true; // voci sempre visibili
    return item.soloRegime === regimeDocumenti;
  });

  function handleNavigate(id: string) {
    if (id === 'tricoai') {
      if (!isUserDemo) {
        window.open('https://trico.righetti.club', '_blank');
      }
      return;
    }
    onNavigate(id);
    onCloseMobile();
  }

  async function handleLogout() {
    await signOut();
  }

  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? 'Utente';
  const avatarColor = (user?.user_metadata?.avatar_color as string | undefined) ?? '#007AFF';
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const iniziale = fullName.trim().charAt(0).toUpperCase() || (user?.email?.charAt(0).toUpperCase() ?? '?');

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden" onClick={onCloseMobile} />
      )}

      <aside
        className={`fixed lg:static top-0 left-0 h-screen z-50 overflow-y-auto bg-apple-lightgray border-r border-gray-200/60 flex flex-col group transition-all duration-300 ease-out w-64 lg:w-16 lg:hover:w-64 ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="px-3 lg:px-2 py-3 sm:py-6 border-b border-gray-200/60 flex items-center">
          <div className="flex items-center gap-3 w-full">
            <div className="w-14 h-14 shrink-0 flex items-center justify-center">
              {isUserDemo && !logoUrl ? (
                <div className="w-14 h-14 rounded-apple bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-2xl font-bold shadow-sm">
                  🏢
                </div>
              ) : (
                <img
                  src={logoUrl || '/logo.png'}
                  alt={isUserDemo ? 'Studio' : 'Gestionale'}
                  className="w-14 h-14 object-contain mix-blend-multiply"
                  onError={(e) => {
                    const el = e.currentTarget as HTMLImageElement;
                    el.style.display = 'none';
                    el.nextElementSibling?.classList.remove('hidden');
                  }}
                />
              )}
              <div className="hidden w-14 h-14 rounded-apple bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-2xl font-bold">
                🏢
              </div>
            </div>
            <div className="min-w-0 overflow-hidden lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200">
              <h1 className="text-base font-semibold text-apple-darkgray whitespace-nowrap">
                {isUserDemo && !logoUrl ? 'Studio' : 'Gestionale Studio'}
              </h1>
            </div>
          </div>
        </div>

        <nav className="px-2 py-4 space-y-1">
          {menuFiltrato.map((item) => (
            <button key={item.id} onClick={() => handleNavigate(item.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-apple text-sm font-medium transition-all ${currentPageId === item.id ? 'bg-apple-blue text-white shadow-apple' : 'text-apple-darkgray hover:bg-white/60'}`}>
              <span className="text-lg w-6 flex items-center justify-center">{item.icon}</span>
              <span className="whitespace-nowrap overflow-hidden lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">{item.label}</span>
            </button>
          ))}
          <div className="my-3 border-t border-gray-200/60" />
          {isUserDemo ? (
            <div className="relative group/trico">
              <div 
                onClick={() => alert('Sei in modalità DEMO.\n\nPer provare il software di Analisi Tricologica, registrati su: https://trico.righetti.club/registrati')}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-apple text-sm font-medium text-apple-gray/70 bg-gray-100/60 hover:bg-gray-200/50 cursor-pointer select-none transition-colors border border-gray-200/40"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg w-6 flex items-center justify-center opacity-60">🧬</span>
                  <span className="whitespace-nowrap overflow-hidden lg:opacity-0 lg:group-hover:opacity-100 transition-opacity font-semibold">TricoAI</span>
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                  🔒 Pro
                </span>
              </div>
            </div>
          ) : (
            <button onClick={() => handleNavigate('tricoai')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-apple text-sm font-medium text-apple-blue hover:bg-white/60 transition-all">
              <span className="text-lg w-6 flex items-center justify-center">🧬</span>
              <span className="whitespace-nowrap overflow-hidden lg:opacity-0 lg:group-hover:opacity-100 transition-opacity font-semibold">TricoAI</span>
            </button>
          )}
        </nav>

        <div className="mt-auto px-2 pb-3 pt-2 border-t border-gray-200/60">
          <button onClick={() => handleNavigate('impostazioni')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-apple text-sm font-medium transition-all ${currentPageId === 'impostazioni' ? 'bg-apple-blue text-white shadow-apple' : 'text-apple-darkgray hover:bg-white/60'}`}>
            <span className="text-lg w-6 flex items-center justify-center">⚙️</span>
            <span className="whitespace-nowrap overflow-hidden lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">Impostazioni</span>
          </button>

          <div className="pt-1">
            {!confermaLogout ? (
              <div className="flex items-center px-2 py-2 rounded-apple justify-center lg:gap-0 lg:group-hover:gap-3 lg:group-hover:justify-start lg:group-hover:px-3 transition-all duration-200">
                {avatarUrl ? (
                  <div className="w-10 h-10 shrink-0 rounded-full overflow-hidden border border-gray-200 shadow-apple">
                    <img src={avatarUrl} alt={fullName} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-10 h-10 shrink-0 rounded-full text-white flex items-center justify-center text-sm font-bold shadow-apple" style={{ background: avatarColor }}>
                    {iniziale}
                  </div>
                )}
                <div className="hidden lg:block lg:opacity-0 lg:group-hover:opacity-100 flex-1 min-w-0 overflow-hidden transition-opacity duration-200">
                  <p className="text-xs font-semibold text-apple-darkgray truncate">{fullName}</p>
                  <p className="text-[10px] text-apple-gray truncate">{user?.email}</p>
                </div>
                <button onClick={() => setConfermaLogout(true)} className="hidden lg:flex lg:opacity-0 lg:group-hover:opacity-100 shrink-0 w-7 h-7 rounded-apple items-center justify-center text-apple-gray hover:text-red-500 hover:bg-red-50 transition-colors" title="Esci">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                </button>
              </div>
            ) : (
              <div className="px-3 py-2 rounded-apple bg-red-50 border border-red-100 space-y-2">
                <p className="text-xs text-red-600 font-medium text-center">Uscire dall'account?</p>
                <div className="flex gap-2">
                  <button onClick={() => setConfermaLogout(false)} className="flex-1 py-1.5 text-xs font-medium rounded-apple bg-white text-apple-darkgray hover:bg-gray-50">Annulla</button>
                  <button onClick={handleLogout} className="flex-1 py-1.5 text-xs font-medium rounded-apple bg-red-500 text-white hover:bg-red-600">Esci</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
