import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Clienti } from './pages/Clienti';
import { Fatture } from './pages/Fatture';
import { Servizi } from './pages/Servizi';
import { DDT } from './pages/DDT';
import { Magazzino } from './pages/Magazzino';
import { Ordini } from './pages/Ordini';
import { Agenda } from './pages/Agenda';
import { Prodotti } from './pages/Prodotti';
import { Percorsi } from './pages/Percorsi';
import { Impostazioni } from './pages/Impostazioni';
import { PaginaFirmaiPad } from './components/PaginaFirmaiPad';
import { PaginaFirmaDdtIPad } from './components/PaginaFirmaDdtIPad';
import { PaginaFirmaFatturaIPad } from './components/PaginaFirmaFatturaIPad';
import { AuthProvider, useAuth } from './lib/auth';
import { Login } from './pages/Login';
import { Registrati } from './pages/Registrati';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { getDemoStatus } from './lib/demo';

function AppGestionale() {
  const { user } = useAuth();
  const demoStatus = getDemoStatus(user);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-apple-lightgray">
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between px-4 lg:px-6 py-3 bg-apple-lightgray border-b border-gray-200/60 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden w-10 h-10 rounded-apple bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-apple-darkgray transition-colors"
              aria-label="Apri menu"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

          </div>

          {/* Badge Demo con conto alla rovescia (solo per utenti in prova 15gg) */}
          {demoStatus.isDemo && !demoStatus.isScaduto && (
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                  demoStatus.giorniRimasti <= 3
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-blue-50 text-apple-blue border-blue-100'
                }`}
                title={`Periodo di prova valido fino al ${demoStatus.dataScadenza?.toLocaleDateString('it-IT') ?? ''}`}
              >
                <span>{demoStatus.giorniRimasti <= 3 ? '⚠️' : '⏳'}</span>
                <span>
                  Demo: <strong>{demoStatus.giorniRimasti} {demoStatus.giorniRimasti === 1 ? 'giorno' : 'giorni'} rimasti</strong>
                </span>
              </span>
            </div>
          )}
        </header>

        <main className="flex-1 overflow-y-auto p-3 lg:p-4">
          {currentPage === 'dashboard' && <Dashboard onNavigate={setCurrentPage} />}
          {currentPage === 'agenda' && <Agenda />}
          {currentPage === 'clienti' && <Clienti onNavigate={setCurrentPage} />}
          {currentPage === 'fatture' && <Fatture />}
          {currentPage === 'ddt' && <DDT />}
          {currentPage === 'magazzino' && <Magazzino />}
          {currentPage === 'ordini' && <Ordini />}
          {currentPage === 'servizi' && <Servizi />}
          {currentPage === 'prodotti' && <Prodotti />}
          {currentPage === 'percorsi' && <Percorsi />}
          {currentPage === 'impostazioni' && <Impostazioni />}
        </main>
      </div>
    </div>
  );
}

function PaginaFirmaWrapper() {
  const token = window.location.pathname.split('/firma/')[1];
  return <PaginaFirmaiPad token={token} />;
}

function PaginaFirmaDdtWrapper() {
  const token = window.location.pathname.split('/firma-ddt/')[1];
  return <PaginaFirmaDdtIPad token={token} />;
}

function PaginaFirmaFatturaWrapper() {
  const token = window.location.pathname.split('/firma-fattura/')[1];
  return <PaginaFirmaFatturaIPad token={token} />;
}

function SchermataBloccoDemo({ user, signOut }: { user: any; signOut: () => Promise<void> }) {
  return (
    <div className="min-h-screen bg-apple-lightgray flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-apple shadow-apple-lg p-8 sm:p-10 text-center border border-gray-200/60">
        <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center text-3xl mx-auto mb-4 border border-amber-200/60">
          🔒
        </div>

        <h1 className="text-xl font-bold text-apple-darkgray tracking-tight mb-2">
          Periodo di Prova Terminato
        </h1>

        <p className="text-xs text-apple-gray leading-relaxed mb-6">
          I tuoi <span className="font-semibold text-apple-darkgray">15 giorni di prova gratuita</span> del Gestionale sono giunti al termine.
          Tutti i tuoi dati, clienti e configurazioni sono custoditi al sicuro nel database.
        </p>

        <div className="p-4 rounded-apple bg-gray-50 border border-gray-200/70 text-left mb-6 space-y-1.5 text-xs">
          <div className="flex justify-between text-apple-gray">
            <span>Account:</span>
            <span className="font-medium text-apple-darkgray truncate max-w-[200px]">{user.email}</span>
          </div>
          {user.user_metadata?.azienda && (
            <div className="flex justify-between text-apple-gray">
              <span>Studio / Salone:</span>
              <span className="font-medium text-apple-darkgray">{user.user_metadata.azienda}</span>
            </div>
          )}
          <div className="flex justify-between text-apple-gray">
            <span>Stato licenza:</span>
            <span className="font-semibold text-amber-600">Demo Scaduta</span>
          </div>
        </div>

        <div className="space-y-3">
          <a
            href="mailto:righetti@righetti.club?subject=Attivazione%20Licenza%20Completa%20Gestionale&body=Salve%2C%20desidero%20attivare%20la%20licenza%20completa%20per%20il%20mio%20account%20del%20Gestionale%20con%20email%3A%20"
            className="w-full block py-2.5 px-4 rounded-apple bg-apple-blue text-white text-sm font-semibold hover:bg-apple-blue/90 transition-colors shadow-apple text-center"
          >
            ✉️ Richiedi Attivazione Licenza
          </a>

          <button
            type="button"
            onClick={() => signOut()}
            className="w-full py-2.5 px-4 rounded-apple bg-gray-100 text-apple-darkgray text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            Disconnetti
          </button>
        </div>

        <p className="text-[11px] text-apple-gray mt-6">
          Studio Righetti Since 1967
        </p>
      </div>
    </div>
  );
}

function AuthGate() {
  const { user, loading, signOut } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-apple-lightgray">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-apple-blue border-t-transparent animate-spin" />
          <p className="text-sm text-apple-gray">Caricamento…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Controllo licenza Demo 15 giorni
  const demoStatus = getDemoStatus(user);
  if (demoStatus.isScaduto) {
    return <SchermataBloccoDemo user={user} signOut={signOut} />;
  }

  return <AppGestionale />;
}

function App() {
  // Listener per reset password (type=recovery)
  useEffect(() => {
    const hash = window.location.hash;
    const search = window.location.search;

    if (hash.includes('type=recovery') || search.includes('type=recovery')) {
      if (window.location.pathname !== '/reset-password') {
        window.location.replace('/reset-password' + hash + search);
      }
    }
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/firma/:token" element={<PaginaFirmaWrapper />} />
          <Route path="/firma-ddt/:token" element={<PaginaFirmaDdtWrapper />} />
          <Route path="/firma-fattura/:token" element={<PaginaFirmaFatturaWrapper />} />
          <Route path="/login" element={<Login />} />
          <Route path="/registrati" element={<Registrati />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/*" element={<AuthGate />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
