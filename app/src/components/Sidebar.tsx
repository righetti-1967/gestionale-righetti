import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { getLogoUrl } from '../lib/logo';
import { getDemoStatus } from '../lib/demo';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
  { id: 'clienti', label: 'Clienti', icon: '👥' },
  { id: 'percorsi', label: 'Percorsi', icon: '🎯' },
  { id: 'fatture', label: 'Fatture', icon: '📄' },
  { id: 'ddt', label: 'DDT', icon: '📋' },
  { id: 'prodotti', label: 'Prodotti', icon: '📦' },
  { id: 'servizi', label: 'Servizi', icon: '🛠️' },
  { id: 'agenda', label: 'Agenda', icon: '📅' },
  { id: 'magazzino', label: 'Magazzino', icon: '🏪' },
  { id: 'ordini', label: 'Ordini', icon: '🛒' },
];

export function Sidebar({ currentPage, onNavigate, mobileOpen, onCloseMobile }: SidebarProps) {
  const { user, signOut } = useAuth();
  const [confermaLogout, setConfermaLogout] = useState(false);
  const demoStatus = getDemoStatus(user);

  function handleNavigate(page: string) {
    if (page === 'analisi') {
      window.open('https://trico.righetti.club', '_blank');
      return;
    }
    onNavigate(page);
    onCloseMobile();
  }

  async function handleLogout() {
    await signOut();
  }

  const iniziale = user?.email?.charAt(0).toUpperCase() ?? '?';

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`
          fixed lg:static top-0 left-0 h-screen z-50
          bg-apple-lightgray
          border-r border-gray-200/60
          flex flex-col group
          transition-all duration-300 ease-out
          w-64 lg:w-16 lg:hover:w-64
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="px-3 lg:px-2 py-6 border-b border-gray-200/60 h-[100px] flex items-center shrink-0">
          <div className="flex items-center gap-3 w-full">
            <div className="w-14 h-14 shrink-0 flex items-center justify-center">
              <img
                src={getLogoUrl()}
                alt="Righetti 1967"
                className="w-14 h-14 object-contain mix-blend-multiply"
              />
            </div>
            <div className="min-w-0 overflow-hidden lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200">
              <h1 className="text-base font-semibold text-apple-darkgray whitespace-nowrap">
                Righetti 1967
              </h1>
              <p className="text-xs text-apple-gray whitespace-nowrap">Gestionale</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
          {menuItems.map((item) => {
            const attivo = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-apple text-sm font-medium
                  transition-all duration-200
                  ${attivo
                    ? 'bg-apple-blue text-white shadow-apple'
                    : 'text-apple-darkgray hover:bg-white/60'
                  }
                `}
                title={item.label}
              >
                <span className="text-lg shrink-0 w-6 flex items-center justify-center">
                  {item.icon}
                </span>
                <span
                  className={`
                    whitespace-nowrap overflow-hidden
                    lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200
                  `}
                >
                  {item.label}
                </span>
              </button>
            );
          })}

          {(demoStatus.isReale || demoStatus.isRighetti) && (
            <>
              <div className="my-3 border-t border-gray-200/60" />

              <button
                onClick={() => handleNavigate('analisi')}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-apple text-sm font-medium transition-all duration-200 text-apple-blue hover:bg-white/60"
                title="TricoAI"
              >
                <span className="text-lg shrink-0 w-6 flex items-center justify-center">🧬</span>
                <span className="flex-1 text-left whitespace-nowrap overflow-hidden lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200">
                  TricoAI
                </span>
                <span className="text-xs opacity-60 lg:opacity-0 lg:group-hover:opacity-60 transition-opacity duration-200">
                  ↗
                </span>
              </button>
            </>
          )}
        </nav>

        <div className="shrink-0 px-2 pb-3 pt-2 border-t border-gray-200/60 space-y-1">
          <button
            onClick={() => handleNavigate('impostazioni')}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-apple text-sm font-medium
              transition-all duration-200
              ${currentPage === 'impostazioni'
                ? 'bg-apple-blue text-white shadow-apple'
                : 'text-apple-darkgray hover:bg-white/60'
              }
            `}
            title="Impostazioni"
          >
            <span className="text-lg shrink-0 w-6 flex items-center justify-center">⚙️</span>
            <span
              className={`
                whitespace-nowrap overflow-hidden
                lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200
              `}
            >
              Impostazioni
            </span>
          </button>

          <div className="pt-1">
            {!confermaLogout ? (
              <div
                className={`
                  flex items-center gap-3 px-3 py-2 rounded-apple
                  lg:justify-center lg:group-hover:justify-start
                  transition-all duration-200
                `}
              >
                <div className="w-8 h-8 shrink-0 rounded-full bg-apple-blue text-white flex items-center justify-center text-sm font-semibold shadow-apple">
                  {iniziale}
                </div>
                <div className="flex-1 min-w-0 overflow-hidden lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200">
                  <p className="text-xs text-apple-gray truncate" title={user?.email ?? ''}>
                    {user?.email ?? 'Utente'}
                  </p>
                </div>
                <button
                  onClick={() => setConfermaLogout(true)}
                  className="shrink-0 w-7 h-7 rounded-apple flex items-center justify-center text-apple-gray hover:text-red-500 hover:bg-red-50 transition-colors lg:opacity-0 lg:group-hover:opacity-100"
                  title="Esci"
                  aria-label="Logout"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="px-3 py-2 rounded-apple bg-red-50 border border-red-100 space-y-2">
                <p className="text-xs text-red-600 font-medium text-center">
                  Uscire dall'account?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfermaLogout(false)}
                    className="flex-1 py-1.5 text-xs font-medium rounded-apple bg-white text-apple-darkgray hover:bg-gray-50 transition-colors"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex-1 py-1.5 text-xs font-medium rounded-apple bg-red-500 text-white hover:bg-red-600 transition-colors"
                  >
                    Esci
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
