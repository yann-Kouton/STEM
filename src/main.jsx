import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'
import './index.css'

// IMPORTANT : on capture beforeinstallprompt ici, tout en haut du fichier,
// AVANT le rendu de React. Cet évènement peut se déclencher très tôt (parfois
// avant que le composant React qui l'écoute soit monté), et Chrome ne le
// redonne jamais une seconde fois s'il est raté. On le stocke donc sur `window`
// et on prévient l'app via un CustomEvent dès qu'il arrive.
window.__deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__deferredInstallPrompt = e;
  window.dispatchEvent(new CustomEvent('pwa-install-available'));
});
window.addEventListener('appinstalled', () => {
  window.__deferredInstallPrompt = null;
  window.dispatchEvent(new CustomEvent('pwa-install-installed'));
});

// Enregistre le service worker généré par vite-plugin-pwa.
// - onNeedRefresh : une nouvelle version est déployée pendant que l'app tourne
// - onOfflineReady : les fichiers nécessaires sont en cache, l'app peut se lancer sans réseau
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    if (window.confirm('Une nouvelle version de l\'application est disponible. Recharger maintenant ?')) {
      updateSW(true)
    }
  },
  onOfflineReady() {
    console.log('Application prête à fonctionner hors-ligne.')
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)