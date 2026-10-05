import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// ============================================================
// PWA Auto-Update — controllo periodico nuove versioni
// ============================================================
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  // 1. Controlla aggiornamenti ogni 60 secondi
  navigator.serviceWorker.ready.then((registration) => {
    setInterval(() => {
      registration.update().catch(() => {});
    }, 60 * 1000);
  });

  // 2. Aggiorna quando la finestra riceve il focus (utente torna sull'app)
  window.addEventListener('focus', () => {
    navigator.serviceWorker.ready
      .then((registration) => registration.update())
      .catch(() => {});
  });

  // 3. Aggiorna quando torna online
  window.addEventListener('online', () => {
    navigator.serviceWorker.ready
      .then((registration) => registration.update())
      .catch(() => {});
  });

  // 4. Quando il nuovo Service Worker è pronto → ricarica la pagina
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Evita loop di reload
    const flag = 'gestionale_reloaded_for_update';
    if (sessionStorage.getItem(flag)) return;
    sessionStorage.setItem(flag, '1');
    // Rimuove il flag dopo 10s (per il prossimo aggiornamento)
    setTimeout(() => sessionStorage.removeItem(flag), 10000);
    window.location.reload();
  });
}
