import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'
import './index.css'

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