import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect, useMemo, useRef, useCallback, createContext, useContext } from 'react';
import { create } from 'zustand';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { AuthProvider, useAuth } from './context/AuthContext';
import {
  EnvelopeIcon, LockClosedIcon, ArrowLeftOnRectangleIcon, CheckBadgeIcon, XMarkIcon,
  UserPlusIcon, MagnifyingGlassIcon, PencilSquareIcon, TrashIcon, UserCircleIcon,
  PhoneIcon, HomeIcon, UsersIcon, ChatBubbleLeftRightIcon, ChartBarIcon, PhotoIcon,
  ClipboardDocumentListIcon, MoonIcon, SunIcon, CommandLineIcon, BellAlertIcon,
  ArchiveBoxIcon, ClockIcon, ChevronRightIcon, PlusIcon, BeakerIcon, ScaleIcon,
  ShieldExclamationIcon, CheckCircleIcon, InformationCircleIcon, ExclamationTriangleIcon,
  CalendarDaysIcon, Bars3Icon, SparklesIcon, ArrowPathIcon, TagIcon
} from '@heroicons/react/24/outline';
import { sendPasswordResetEmail, sendEmailVerification } from 'firebase/auth';
import { auth, db, storage } from './firebase/config';
import {
  collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query,
  orderBy, serverTimestamp, where, arrayUnion
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

/* ============================================================
   PALETTE — identité "officine" : encre teal, papier ivoire,
   ambre pour les alertes, argile pour le danger.
   ============================================================ */
const C = {
  ink: '#0B2B26',
  inkSoft: '#12433C',
  teal: '#146C5E',
  tealLight: '#1E8C77',
  paper: '#F6F3EC',
  paperDark: '#0A1F1C',
  card: '#FFFFFF',
  cardDark: '#0F2E29',
  amber: '#C77B2C',
  clay: '#B84C3D',
  sage: '#6E9C82',
};

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
      .font-display { font-family: 'Fraunces', serif; font-optical-sizing: auto; }
      .font-body { font-family: 'Inter', sans-serif; }
      .font-mono { font-family: 'JetBrains Mono', monospace; }
      body { font-family: 'Inter', sans-serif; }
      ::selection { background: ${C.amber}33; }
      .label-perforation {
        background-image: radial-gradient(circle, currentColor 1.5px, transparent 1.5px);
        background-size: 10px 10px;
      }
      .scrollbar-thin::-webkit-scrollbar { width: 6px; height: 6px; }
      .scrollbar-thin::-webkit-scrollbar-thumb { background: #14806c55; border-radius: 4px; }
    `}</style>
  );
}

/* ============================================================
   STORES — Zustand : thème, palette de commandes, notifications
   ============================================================ */
const useUIStore = create((set) => ({
  dark: typeof window !== 'undefined' && localStorage.getItem('smm-theme') === 'dark',
  toggleDark: () => set((s) => {
    const next = !s.dark;
    localStorage.setItem('smm-theme', next ? 'dark' : 'light');
    return { dark: next };
  }),
  paletteOpen: false,
  setPaletteOpen: (v) => set({ paletteOpen: v }),
}));

let toastId = 0;
const useToastStore = create((set) => ({
  toasts: [],
  push: (message, type = 'info') => set((s) => {
    const id = ++toastId;
    setTimeout(() => {
      set((s2) => ({ toasts: s2.toasts.filter((t) => t.id !== id) }));
    }, 4200);
    return { toasts: [...s.toasts, { id, message, type }] };
  }),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

const toastIcons = {
  success: CheckCircleIcon,
  error: XCircleIconFallback,
  info: InformationCircleIcon,
};
// Petite icône de secours pour éviter une dépendance supplémentaire
function XCircleIconFallback(props) {
  return <ExclamationTriangleIcon {...props} />;
}

function ToastStack() {
  const { toasts, dismiss } = useToastStore();
  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2 w-full max-w-sm px-4 sm:px-0">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = toastIcons[t.type] || InformationCircleIcon;
          const tone = t.type === 'success' ? 'border-emerald-500 text-emerald-700' :
                       t.type === 'error' ? 'border-red-500 text-red-700' :
                       'border-indigo-500 text-indigo-700';
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              className={`bg-white border-l-4 ${tone} shadow-lg rounded-lg px-4 py-3 flex items-start gap-2`}
            >
              <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-gray-700 flex-1">{t.message}</p>
              <button onClick={() => dismiss(t.id)} className="text-gray-300 hover:text-gray-500">
                <XMarkIcon className="h-4 w-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/* ============================================================
   DONNÉES MÉTIER — base locale de référence pharmaceutique
   (outil d'aide à la décision, ne remplace pas le jugement clinique)
   ============================================================ */
const INTERACTIONS = [
  { a: 'Warfarine', b: 'Aspirine', niveau: 'majeure', detail: "Risque hémorragique fortement augmenté par effet antiagrégant additionné à l'anticoagulant." },
  { a: 'Warfarine', b: 'Paracétamol', niveau: 'moderee', detail: "Un usage prolongé à forte dose peut potentialiser l'effet anticoagulant : surveiller l'INR." },
  { a: 'Aspirine', b: 'Ibuprofène', niveau: 'moderee', detail: "L'ibuprofène peut réduire l'effet cardioprotecteur de l'aspirine à faible dose." },
  { a: 'Enalapril', b: 'Spironolactone', niveau: 'majeure', detail: "Association à risque d'hyperkaliémie ; surveillance du potassium recommandée." },
  { a: 'Metformine', b: 'Produit de contraste iodé', niveau: 'majeure', detail: "Risque d'acidose lactique : interrompre la metformine avant un examen avec produit de contraste." },
  { a: 'Tramadol', b: 'Fluoxétine', niveau: 'majeure', detail: "Risque de syndrome sérotoninergique lors de l'association de deux agents sérotoninergiques." },
  { a: 'Simvastatine', b: 'Erythromycine', niveau: 'majeure', detail: "Inhibition du métabolisme de la statine : risque accru de rhabdomyolyse." },
  { a: 'Ciprofloxacine', b: 'Antiacide (Al/Mg)', niveau: 'moderee', detail: "Chélation réduisant l'absorption digestive de la quinolone : espacer les prises de 2 à 4 h." },
  { a: 'Digoxine', b: 'Furosémide', niveau: 'moderee', detail: "L'hypokaliémie induite par le diurétique augmente le risque de toxicité digitalique." },
  { a: 'Amoxicilline', b: 'Contraceptif oral', niveau: 'mineure', detail: "Diminution possible mais rare de l'efficacité contraceptive : conseiller une méthode barrière additionnelle." },
];
const MOLECULES = Array.from(new Set(INTERACTIONS.flatMap((i) => [i.a, i.b]))).sort();

const POSOLOGIES_PEDIATRIQUES = [
  { nom: 'Paracétamol', mgParKg: 15, maxParJour: 60, unite: 'mg/kg/prise (max 4 prises/j)' },
  { nom: 'Ibuprofène', mgParKg: 7.5, maxParJour: 30, unite: 'mg/kg/prise (max 3 à 4 prises/j)' },
  { nom: 'Amoxicilline', mgParKg: 25, maxParJour: 80, unite: 'mg/kg/j en 2 à 3 prises' },
  { nom: 'Azithromycine', mgParKg: 10, maxParJour: 10, unite: 'mg/kg/j en 1 prise (J1), 5mg/kg J2-J5' },
];

/* ============================================================
   UTILITAIRES
   ============================================================ */
function toDate(v) {
  if (!v) return null;
  return v.toDate ? v.toDate() : new Date(v);
}
function daysUntil(dateVal) {
  const d = toDate(dateVal);
  if (!d) return null;
  return Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24));
}
function formatDate(dateVal) {
  const d = toDate(dateVal);
  if (!d) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}
function normalizePhoneForWhatsApp(telephone) {
  const clean = telephone.replace(/\s/g, '').replace(/^0/, '225');
  return clean;
}

/* ============================================================
   ROUTE PRIVÉE
   ============================================================ */
function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  const dark = useUIStore((s) => s.dark);
  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${dark ? 'bg-[#0A1F1C] text-white' : 'bg-[#F6F3EC]'}`}>
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-current border-t-transparent rounded-full animate-spin opacity-60" />
          <p className="text-sm opacity-60 font-body">Chargement…</p>
        </div>
      </div>
    );
  }
  return user ? children : <Navigate to="/login" replace />;
}

/* ============================================================
   PAGE : Connexion / Inscription
   ============================================================ */
function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const { login, register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      if (isRegister) {
        const userCredential = await register(email, password);
        await sendEmailVerification(userCredential.user);
        setSuccess('Un email de vérification vous a été envoyé. Veuillez le confirmer avant de vous connecter.');
      } else {
        await login(email, password);
        navigate('/dashboard');
      }
    } catch (err) {
      let message = err.message;
      if (err.code === 'auth/user-not-found') message = 'Aucun compte associé à cet email.';
      else if (err.code === 'auth/wrong-password') message = 'Mot de passe incorrect.';
      else if (err.code === 'auth/too-many-requests') message = 'Trop de tentatives. Veuillez réessayer plus tard.';
      else if (err.code === 'auth/email-already-in-use') message = 'Cet email est déjà utilisé. Connectez-vous ou réinitialisez votre mot de passe.';
      else if (err.code === 'auth/user-disabled') message = 'Ce compte a été désactivé. Contactez le support.';
      else if (err.code === 'auth/operation-not-allowed') message = 'Cette méthode de connexion est désactivée.';
      else if (err.code === 'auth/network-request-failed') message = 'Problème de réseau. Vérifiez votre connexion.';
      setError(message);
    }
  };

  const handleGoogle = async () => {
    setError('');
    try {
      await loginWithGoogle();
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setSuccess('Un email de réinitialisation a été envoyé à ' + resetEmail);
      setResetEmail('');
      setTimeout(() => setShowReset(false), 3000);
    } catch (err) {
      let message = err.message;
      if (err.code === 'auth/user-not-found') message = 'Aucun compte associé à cet email.';
      else if (err.code === 'auth/invalid-email') message = 'Email invalide.';
      setError(message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: `radial-gradient(circle at 20% 20%, ${C.tealLight}22, transparent 45%), radial-gradient(circle at 80% 80%, ${C.amber}22, transparent 45%), ${C.paper}` }}>
      <GlobalStyle />
      <div className="absolute inset-0 label-perforation opacity-[0.04]" style={{ color: C.ink }} />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative w-full max-w-md"
      >
        <div className="rounded-3xl shadow-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.ink}14` }}>
          <div className="px-8 pt-8 pb-6 text-center" style={{ background: `linear-gradient(135deg, ${C.ink}, ${C.teal})` }}>
            <div className="mx-auto h-12 w-12 rounded-full flex items-center justify-center mb-3" style={{ background: `${C.amber}` }}>
              <BeakerIcon className="h-6 w-6 text-white" />
            </div>
            <h1 className="font-display text-2xl text-white tracking-tight">Pharmacie Sainte Marie Majeure</h1>
            <p className="text-white/60 text-xs mt-1 font-mono uppercase tracking-widest">Plateforme officine</p>
          </div>

          <div className="px-8 pb-8 pt-6">
            {success && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg flex items-start gap-2">
                <CheckBadgeIcon className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span>{success}</span>
              </div>
            )}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg flex items-start gap-2">
                <XMarkIcon className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {showReset ? (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email du compte</label>
                  <div className="relative mt-1">
                    <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)}
                      className="pl-10 w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 outline-none transition-shadow"
                      style={{ '--tw-ring-color': C.teal }}
                      placeholder="votre@email.com" required
                    />
                  </div>
                </div>
                <button type="submit" className="w-full text-white font-semibold py-2.5 rounded-xl transition-transform hover:scale-[1.01]" style={{ background: C.amber }}>
                  Envoyer le lien de réinitialisation
                </button>
                <button type="button" onClick={() => setShowReset(false)} className="w-full text-sm text-gray-500 hover:text-gray-700">
                  Retour à la connexion
                </button>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <div className="relative mt-1">
                    <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 outline-none"
                      placeholder="pharmacien@email.com" required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Mot de passe</label>
                  <div className="relative mt-1">
                    <LockClosedIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 outline-none"
                      placeholder="••••••••" required minLength={6}
                    />
                  </div>
                </div>
                {!isRegister && (
                  <div className="text-right">
                    <button type="button" onClick={() => setShowReset(true)} className="text-sm font-medium" style={{ color: C.teal }}>
                      Mot de passe oublié ?
                    </button>
                  </div>
                )}
                <button type="submit" className="w-full text-white font-semibold py-2.5 rounded-xl transition-transform hover:scale-[1.01]" style={{ background: C.teal }}>
                  {isRegister ? 'Créer un compte' : 'Se connecter'}
                </button>
                <button type="button" onClick={handleGoogle} className="w-full flex items-center justify-center gap-3 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2.5 rounded-xl transition-colors">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continuer avec Google
                </button>
                <div className="text-center text-sm text-gray-500">
                  {isRegister ? 'Déjà un compte ?' : 'Pas encore de compte ?'}
                  <button type="button" onClick={() => { setIsRegister(!isRegister); setError(''); setSuccess(''); }} className="ml-1 font-medium" style={{ color: C.teal }}>
                    {isRegister ? 'Se connecter' : 'Créer un compte'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
        <p className="text-center text-xs mt-4 opacity-50 font-mono" style={{ color: C.ink }}>Appuyez sur ⌘K une fois connecté pour la palette de commandes</p>
      </motion.div>
    </div>
  );
}

/* ============================================================
   PALETTE DE COMMANDES (⌘K)
   ============================================================ */
function CommandPalette() {
  const { paletteOpen, setPaletteOpen, toggleDark } = useUIStore();
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  const { logout } = useAuth();
  const inputRef = useRef(null);

  const actions = useMemo(() => ([
    { label: 'Tableau de bord', icon: HomeIcon, run: () => navigate('/dashboard') },
    { label: 'Patients', icon: UsersIcon, run: () => navigate('/patients') },
    { label: 'Ajouter un patient', icon: UserPlusIcon, run: () => navigate('/patients?action=add') },
    { label: 'Rechercher un patient', icon: MagnifyingGlassIcon, run: () => navigate('/patients?focus=search') },
    { label: 'Stock & péremptions', icon: ArchiveBoxIcon, run: () => navigate('/stock') },
    { label: 'Assistant IA (interactions, posologie)', icon: ChatBubbleLeftRightIcon, run: () => navigate('/assistant') },
    { label: 'Statistiques', icon: ChartBarIcon, run: () => navigate('/stats') },
    { label: 'Basculer le mode sombre', icon: MoonIcon, run: () => toggleDark() },
    { label: 'Déconnexion', icon: ArrowLeftOnRectangleIcon, run: () => logout() },
  ]), [navigate, toggleDark, logout]);

  const filtered = actions.filter((a) => a.label.toLowerCase().includes(q.toLowerCase()));

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(!paletteOpen);
      }
      if (e.key === 'Escape') setPaletteOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paletteOpen, setPaletteOpen]);

  useEffect(() => {
    if (paletteOpen) { setQ(''); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [paletteOpen]);

  return (
    <AnimatePresence>
      {paletteOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-[90] flex items-start justify-center pt-24 px-4"
          onClick={() => setPaletteOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
            style={{ background: C.card }}
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
              <CommandLineIcon className="h-5 w-5 text-gray-400" />
              <input
                ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Tapez une commande…"
                className="flex-1 outline-none text-sm font-body"
              />
              <kbd className="text-[10px] font-mono text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">ESC</kbd>
            </div>
            <div className="max-h-80 overflow-y-auto scrollbar-thin py-2">
              {filtered.length === 0 && (
                <p className="text-sm text-gray-400 px-4 py-6 text-center">Aucune commande trouvée</p>
              )}
              {filtered.map((a, i) => (
                <button
                  key={i}
                  onClick={() => { a.run(); setPaletteOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <a.icon className="h-4 w-4" style={{ color: C.teal }} />
                  {a.label}
                  <ChevronRightIcon className="h-3.5 w-3.5 ml-auto text-gray-300" />
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ============================================================
   SIDEBAR
   ============================================================ */
function Sidebar() {
  const location = useLocation();
  const { logout } = useAuth();
  const { dark, toggleDark, setPaletteOpen } = useUIStore();

  const navItems = [
    { path: '/dashboard', label: 'Tableau de bord', icon: HomeIcon },
    { path: '/patients', label: 'Patients', icon: UsersIcon },
    { path: '/stock', label: 'Stock & péremptions', icon: ArchiveBoxIcon },
    { path: '/assistant', label: 'Assistant IA', icon: ChatBubbleLeftRightIcon },
    { path: '/stats', label: 'Statistiques', icon: ChartBarIcon },
  ];

  return (
    <div className="w-64 flex flex-col h-screen sticky top-0" style={{ background: `linear-gradient(180deg, ${C.ink}, ${C.inkSoft})` }}>
      <div className="flex items-center gap-2 h-16 border-b border-white/10 px-5">
        <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: C.amber }}>
          <BeakerIcon className="h-4 w-4 text-white" />
        </div>
        <span className="text-white font-display text-base leading-tight">Sainte Marie Majeure</span>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path} to={item.path}
              className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all ${
                isActive ? 'bg-white/15 text-white shadow-lg' : 'text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              <item.icon className="mr-3 h-5 w-5" />
              {item.label}
            </Link>
          );
        })}

        <button
          onClick={() => setPaletteOpen(true)}
          className="w-full flex items-center justify-between px-4 py-3 mt-3 text-xs font-mono text-white/40 border border-white/10 rounded-lg hover:border-white/30 hover:text-white/70 transition-colors"
        >
          <span className="flex items-center gap-2"><CommandLineIcon className="h-4 w-4" /> Rechercher</span>
          <kbd className="border border-white/15 rounded px-1.5 py-0.5">⌘K</kbd>
        </button>
      </nav>

      <div className="p-4 border-t border-white/10 space-y-1">
        <button onClick={toggleDark} className="flex items-center w-full px-4 py-2 text-sm font-medium text-white/60 hover:bg-white/10 rounded-lg transition-colors">
          {dark ? <SunIcon className="h-5 w-5 mr-3" /> : <MoonIcon className="h-5 w-5 mr-3" />}
          {dark ? 'Mode clair' : 'Mode sombre'}
        </button>
        <button onClick={logout} className="flex items-center w-full px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-900/30 rounded-lg transition-colors">
          <ArrowLeftOnRectangleIcon className="h-5 w-5 mr-3" />
          Déconnexion
        </button>
        <p className="text-[10px] text-white/30 text-center mt-3 font-mono">v1.0 • PHCIE Sainte Marie Majeure</p>
      </div>
    </div>
  );
}

/* ============================================================
   PAGE : Tableau de bord
   ============================================================ */
function StatCard({ title, value, icon: Icon, tone, dark, sub }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="relative p-5 rounded-2xl overflow-hidden"
      style={{ background: dark ? C.cardDark : C.card, border: `1px solid ${dark ? '#ffffff14' : '#00000010'}` }}
    >
      <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-10" style={{ background: tone }} />
      <div className="flex items-center justify-between relative">
        <p className={`text-xs font-mono uppercase tracking-wide ${dark ? 'text-white/50' : 'text-gray-500'}`}>{title}</p>
        <Icon className="h-5 w-5" style={{ color: tone }} />
      </div>
      <p className={`font-display text-3xl mt-2 ${dark ? 'text-white' : 'text-gray-800'}`}>{value}</p>
      {sub && <p className={`text-xs mt-1 ${dark ? 'text-white/40' : 'text-gray-400'}`}>{sub}</p>}
    </motion.div>
  );
}

function DashboardPage() {
  const { user } = useAuth();
  const { dark } = useUIStore();
  const navigate = useNavigate();
  const isEmailVerified = user?.emailVerified;
  const [patients, setPatients] = useState([]);
  const [inventaire, setInventaire] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const qP = query(collection(db, 'patients'), where('pharmacienId', '==', user.uid));
    const unsubP = onSnapshot(qP, (snap) => {
      setPatients(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    const qI = query(collection(db, 'inventaire'), where('pharmacienId', '==', user.uid));
    const unsubI = onSnapshot(qI, (snap) => setInventaire(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => { unsubP(); unsubI(); };
  }, [user]);

  const stats = useMemo(() => {
    const totalPatients = patients.length;
    const allVisites = patients.flatMap((p) => (p.historique || []).map((h) => ({ ...h, patient: p })));
    const totalConsultations = allVisites.length;
    const today = new Date().toDateString();
    const consultationsJour = allVisites.filter((v) => toDate(v.date)?.toDateString() === today).length;
    const renouvellements = patients.filter((p) => {
      const d = daysUntil(p.dateRenouvellement);
      return d !== null && d <= 7;
    });
    const stockAlertes = inventaire.filter((i) => (i.quantite ?? 0) <= (i.seuilAlerte ?? 0));
    const peremptionsProches = inventaire.filter((i) => {
      const d = daysUntil(i.datePeremption);
      return d !== null && d <= 30;
    });
    return { totalPatients, totalConsultations, consultationsJour, renouvellements, stockAlertes, peremptionsProches, allVisites };
  }, [patients, inventaire]);

  const trendData = useMemo(() => {
    const days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d;
    });
    return days.map((d) => {
      const label = d.toLocaleDateString('fr-FR', { weekday: 'short' });
      const count = stats.allVisites.filter((v) => toDate(v.date)?.toDateString() === d.toDateString()).length;
      return { jour: label, consultations: count };
    });
  }, [stats.allVisites]);

  const topReasons = useMemo(() => {
    const counts = {};
    stats.allVisites.forEach((v) => {
      const key = (v.objet || 'Non précisé').trim();
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, value }));
  }, [stats.allVisites]);

  const pieColors = [C.teal, C.amber, C.sage, C.clay, C.tealLight];

  if (loading) return <div className={`p-6 ${dark ? 'text-white/60' : 'text-gray-500'}`}>Chargement des statistiques…</div>;

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className={`font-display text-2xl ${dark ? 'text-white' : 'text-gray-800'}`}>Tableau de bord</h1>
          <p className={dark ? 'text-white/50' : 'text-gray-500'}>Bonjour, {user?.displayName || user?.email}</p>
          {!isEmailVerified && user?.providerData?.[0]?.providerId === 'password' && (
            <div className="mt-2 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 w-fit">
              <XMarkIcon className="h-4 w-4" />
              <span>Email non vérifié. <button onClick={() => sendEmailVerification(auth.currentUser)} className="text-indigo-600 hover:underline">Renvoyer le lien</button></span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <StatCard title="Patients actifs" value={stats.totalPatients} icon={UsersIcon} tone={C.teal} dark={dark} />
        <StatCard title="Consultations totales" value={stats.totalConsultations} icon={ClipboardDocumentListIcon} tone={C.tealLight} dark={dark} />
        <StatCard title="Aujourd'hui" value={stats.consultationsJour} icon={CalendarDaysIcon} tone={C.sage} dark={dark} />
        <StatCard title="Alertes actives" value={stats.renouvellements.length + stats.stockAlertes.length + stats.peremptionsProches.length} icon={BellAlertIcon} tone={C.clay} dark={dark} sub="Renouvellements + stock" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
        <div className="lg:col-span-2 p-5 rounded-2xl" style={{ background: dark ? C.cardDark : C.card, border: `1px solid ${dark ? '#ffffff14' : '#00000010'}` }}>
          <p className={`text-sm font-medium mb-4 ${dark ? 'text-white' : 'text-gray-700'}`}>Consultations — 7 derniers jours</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.teal} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={C.teal} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#ffffff14' : '#00000010'} vertical={false} />
              <XAxis dataKey="jour" tick={{ fontSize: 12, fill: dark ? '#ffffff80' : '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: dark ? '#ffffff80' : '#6b7280' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: 'none' }} />
              <Area type="monotone" dataKey="consultations" stroke={C.teal} strokeWidth={2} fill="url(#trendFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="p-5 rounded-2xl" style={{ background: dark ? C.cardDark : C.card, border: `1px solid ${dark ? '#ffffff14' : '#00000010'}` }}>
          <p className={`text-sm font-medium mb-4 ${dark ? 'text-white' : 'text-gray-700'}`}>Motifs fréquents</p>
          {topReasons.length === 0 ? (
            <p className={`text-sm ${dark ? 'text-white/40' : 'text-gray-400'}`}>Pas encore de données</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={topReasons} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={3}>
                  {topReasons.map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: 'none' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <div className="p-5 rounded-2xl" style={{ background: dark ? C.cardDark : C.card, border: `1px solid ${dark ? '#ffffff14' : '#00000010'}` }}>
          <p className={`text-sm font-medium mb-3 flex items-center gap-2 ${dark ? 'text-white' : 'text-gray-700'}`}>
            <CalendarDaysIcon className="h-4 w-4" style={{ color: C.amber }} /> Renouvellements à prévoir
          </p>
          {stats.renouvellements.length === 0 ? (
            <p className={`text-sm ${dark ? 'text-white/40' : 'text-gray-400'}`}>Aucun renouvellement dans les 7 prochains jours</p>
          ) : (
            <div className="space-y-2">
              {stats.renouvellements.slice(0, 5).map((p) => {
                const d = daysUntil(p.dateRenouvellement);
                return (
                  <button key={p.id} onClick={() => navigate('/patients?focus=search')} className="w-full flex items-center justify-between text-sm px-3 py-2 rounded-lg hover:bg-black/5 transition-colors text-left">
                    <span className={dark ? 'text-white/80' : 'text-gray-700'}>{p.prenom} {p.nom}</span>
                    <span className={`text-xs font-mono ${d < 0 ? 'text-red-500' : 'text-amber-600'}`}>{d < 0 ? `en retard de ${Math.abs(d)}j` : `dans ${d}j`}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-5 rounded-2xl" style={{ background: dark ? C.cardDark : C.card, border: `1px solid ${dark ? '#ffffff14' : '#00000010'}` }}>
          <p className={`text-sm font-medium mb-3 flex items-center gap-2 ${dark ? 'text-white' : 'text-gray-700'}`}>
            <ArchiveBoxIcon className="h-4 w-4" style={{ color: C.clay }} /> Stock à surveiller
          </p>
          {stats.stockAlertes.length === 0 && stats.peremptionsProches.length === 0 ? (
            <p className={`text-sm ${dark ? 'text-white/40' : 'text-gray-400'}`}>Aucune alerte de stock</p>
          ) : (
            <div className="space-y-2">
              {[...stats.stockAlertes, ...stats.peremptionsProches].filter((v, i, arr) => arr.findIndex(x => x.id === v.id) === i).slice(0, 5).map((item) => (
                <button key={item.id} onClick={() => navigate('/stock')} className="w-full flex items-center justify-between text-sm px-3 py-2 rounded-lg hover:bg-black/5 transition-colors text-left">
                  <span className={dark ? 'text-white/80' : 'text-gray-700'}>{item.nom}</span>
                  <span className="text-xs font-mono text-red-500">{(item.quantite ?? 0) <= (item.seuilAlerte ?? 0) ? `stock: ${item.quantite}` : `péremption ${formatDate(item.datePeremption)}`}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   PAGE : Gestion des Patients
   ============================================================ */
function TimelineDrawer({ patient, onClose, dark }) {
  const historique = [...(patient.historique || [])].sort((a, b) => toDate(b.date) - toDate(a.date));
  return (
    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: 0.25 }}
      className="fixed right-0 top-0 h-screen w-full max-w-md z-50 shadow-2xl overflow-y-auto scrollbar-thin"
      style={{ background: dark ? C.cardDark : C.card }}
    >
      <div className="p-5 border-b flex items-center justify-between sticky top-0" style={{ background: dark ? C.cardDark : C.card, borderColor: dark ? '#ffffff14' : '#00000010' }}>
        <div>
          <p className={`font-display text-lg ${dark ? 'text-white' : 'text-gray-800'}`}>{patient.prenom} {patient.nom}</p>
          <p className={`text-xs font-mono ${dark ? 'text-white/40' : 'text-gray-400'}`}>{historique.length} consultation(s)</p>
        </div>
        <button onClick={onClose} className={dark ? 'text-white/50 hover:text-white' : 'text-gray-400 hover:text-gray-700'}>
          <XMarkIcon className="h-6 w-6" />
        </button>
      </div>
      <div className="p-5">
        {historique.length === 0 ? (
          <p className={`text-sm text-center py-10 ${dark ? 'text-white/40' : 'text-gray-400'}`}>Aucune visite enregistrée pour le moment</p>
        ) : (
          <div className="relative pl-6 space-y-6">
            <div className="absolute left-[7px] top-1 bottom-1 w-px" style={{ background: dark ? '#ffffff20' : '#00000015' }} />
            {historique.map((v, i) => (
              <div key={i} className="relative">
                <div className="absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2" style={{ borderColor: C.teal, background: dark ? C.cardDark : C.card }} />
                <p className={`text-xs font-mono ${dark ? 'text-white/40' : 'text-gray-400'}`}>{formatDate(v.date)}</p>
                <p className={`text-sm font-medium mt-0.5 ${dark ? 'text-white' : 'text-gray-800'}`}>{v.objet || 'Consultation'}</p>
                {v.notes && <p className={`text-sm mt-1 ${dark ? 'text-white/60' : 'text-gray-500'}`}>{v.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function VisitModal({ patient, onClose, onSave }) {
  const [objet, setObjet] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave({ date: new Date().toISOString(), objet, notes });
    setSaving(false);
  };
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <motion.form initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} onSubmit={submit} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-display text-lg text-gray-800">Nouvelle consultation — {patient.prenom} {patient.nom}</h3>
          <button type="button" onClick={onClose}><XMarkIcon className="h-5 w-5 text-gray-400" /></button>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Motif</label>
          <input value={objet} onChange={(e) => setObjet(e.target.value)} required className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none" placeholder="Fièvre, renouvellement, conseil..." />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows="3" className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none" />
        </div>
        <button disabled={saving} type="submit" className="w-full text-white font-semibold py-2.5 rounded-lg" style={{ background: C.teal }}>
          {saving ? 'Enregistrement...' : 'Enregistrer la visite'}
        </button>
      </motion.form>
    </div>
  );
}

function PatientsPage() {
  const { user } = useAuth();
  const { dark } = useUIStore();
  const { push } = useToastStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [patients, setPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [visitPatient, setVisitPatient] = useState(null);
  const [timelinePatient, setTimelinePatient] = useState(null);
  const [formData, setFormData] = useState({
    nom: '', prenom: '', telephone: '', dateRenouvellement: '', ordonnanceUrl: '', ordonnanceFile: null, notes: ''
  });
  const [isUploading, setIsUploading] = useState(false);
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'patients'), where('pharmacienId', '==', user.uid), orderBy('nom'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPatients(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => { push('Erreur de chargement : ' + err.message, 'error'); setLoading(false); });
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (searchParams.get('action') === 'add') { openAddModal(); setSearchParams({}); }
    if (searchParams.get('focus') === 'search') { searchInputRef.current?.focus(); setSearchParams({}); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const filteredPatients = patients.filter((p) =>
    (p.nom?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (p.prenom?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (p.telephone || '').includes(searchTerm)
  );

  const handleInputChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleFileChange = (e) => { const file = e.target.files[0]; if (file) setFormData({ ...formData, ordonnanceFile: file }); };

  const resetForm = () => {
    setFormData({ nom: '', prenom: '', telephone: '', dateRenouvellement: '', ordonnanceUrl: '', ordonnanceFile: null, notes: '' });
    setEditingPatient(null);
    setIsModalOpen(false);
    setIsUploading(false);
  };

  const openAddModal = () => { resetForm(); setIsModalOpen(true); };
  const openEditModal = (patient) => {
    setEditingPatient(patient);
    setFormData({
      nom: patient.nom || '', prenom: patient.prenom || '', telephone: patient.telephone || '',
      dateRenouvellement: patient.dateRenouvellement ? toDate(patient.dateRenouvellement).toISOString().slice(0, 10) : '',
      ordonnanceUrl: patient.ordonnanceUrl || '', ordonnanceFile: null, notes: patient.notes || ''
    });
    setIsModalOpen(true);
  };

  const uploadOrdonnance = async (file, patientId) => {
    if (!file) return null;
    const storageRef = ref(storage, `ordonnances/${user.uid}/${patientId}/${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    return getDownloadURL(snapshot.ref);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsUploading(true);
    try {
      let ordonnanceUrl = formData.ordonnanceUrl;
      if (formData.ordonnanceFile) {
        if (editingPatient?.ordonnanceUrl) {
          try { await deleteObject(ref(storage, editingPatient.ordonnanceUrl)); } catch { /* ignore */ }
        }
        ordonnanceUrl = await uploadOrdonnance(formData.ordonnanceFile, editingPatient ? editingPatient.id : 'temp');
      }
      const patientData = {
        nom: formData.nom, prenom: formData.prenom, telephone: formData.telephone,
        dateRenouvellement: formData.dateRenouvellement ? new Date(formData.dateRenouvellement).toISOString() : null,
        ordonnanceUrl: ordonnanceUrl || '', notes: formData.notes,
        pharmacienId: user.uid, updatedAt: serverTimestamp()
      };
      if (editingPatient) {
        await updateDoc(doc(db, 'patients', editingPatient.id), patientData);
        push('Patient mis à jour', 'success');
      } else {
        await addDoc(collection(db, 'patients'), { ...patientData, historique: [], createdAt: serverTimestamp() });
        push('Patient ajouté', 'success');
      }
      resetForm();
    } catch (err) {
      push('Erreur : ' + err.message, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce patient ?')) return;
    try {
      const patient = patients.find((p) => p.id === id);
      if (patient?.ordonnanceUrl) {
        try { await deleteObject(ref(storage, patient.ordonnanceUrl)); } catch { /* ignore */ }
      }
      await deleteDoc(doc(db, 'patients', id));
      push('Patient supprimé', 'success');
    } catch (err) {
      push('Erreur de suppression : ' + err.message, 'error');
    }
  };

  const saveVisit = async (visit) => {
    try {
      await updateDoc(doc(db, 'patients', visitPatient.id), {
        historique: arrayUnion(visit), updatedAt: serverTimestamp()
      });
      push('Consultation enregistrée', 'success');
      setVisitPatient(null);
    } catch (err) {
      push('Erreur : ' + err.message, 'error');
    }
  };

  const sendReminder = (patient) => {
    const num = normalizePhoneForWhatsApp(patient.telephone);
    const msg = encodeURIComponent(`Bonjour ${patient.prenom}, la Pharmacie Sainte Marie Majeure vous rappelle que le renouvellement de votre traitement est prévu prochainement. N'hésitez pas à passer nous voir. Bonne journée !`);
    window.open(`https://wa.me/${num}?text=${msg}`, '_blank');
  };

  const openWhatsApp = (telephone) => {
    if (!telephone) return;
    window.open(`https://wa.me/${normalizePhoneForWhatsApp(telephone)}`, '_blank');
  };

  if (loading) return <div className={`p-6 ${dark ? 'text-white/60' : 'text-gray-500'}`}>Chargement des patients...</div>;

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className={`font-display text-2xl ${dark ? 'text-white' : 'text-gray-800'}`}>Gestion des patients</h1>
          <p className={`text-sm ${dark ? 'text-white/50' : 'text-gray-500'}`}>{filteredPatients.length} patient(s)</p>
        </div>
        <button onClick={openAddModal} className="flex items-center gap-2 text-white px-4 py-2 rounded-lg transition-transform hover:scale-[1.02]" style={{ background: C.teal }}>
          <UserPlusIcon className="h-5 w-5" /> Ajouter un patient
        </button>
      </div>

      <div className="relative mb-4">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          ref={searchInputRef} type="text" placeholder="Rechercher par nom, prénom ou téléphone..."
          value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 outline-none ${dark ? 'bg-[#0F2E29] border-white/10 text-white placeholder:text-white/30' : 'border-gray-300 bg-white'}`}
        />
      </div>

      {filteredPatients.length === 0 ? (
        <div className="text-center py-12 rounded-xl border" style={{ background: dark ? C.cardDark : C.card, borderColor: dark ? '#ffffff14' : '#00000010' }}>
          <UserCircleIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className={dark ? 'text-white/50' : 'text-gray-500'}>Aucun patient trouvé</p>
          <button onClick={openAddModal} className="hover:underline mt-2" style={{ color: C.teal }}>Ajouter un patient</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPatients.map((patient) => {
            const renouvJours = daysUntil(patient.dateRenouvellement);
            const renouvUrgent = renouvJours !== null && renouvJours <= 7;
            return (
              <div key={patient.id} className="p-4 rounded-xl transition-shadow hover:shadow-md" style={{ background: dark ? C.cardDark : C.card, border: `1px solid ${renouvUrgent ? C.amber + '55' : (dark ? '#ffffff14' : '#00000010')}` }}>
                <div className="flex items-start justify-between">
                  <button onClick={() => setTimelinePatient(patient)} className="flex-1 text-left">
                    <h3 className={`font-semibold ${dark ? 'text-white' : 'text-gray-800'}`}>{patient.prenom} {patient.nom}</h3>
                    {patient.telephone && (
                      <span className="text-sm text-green-600 flex items-center gap-1 mt-1">
                        <PhoneIcon className="h-4 w-4" /> {patient.telephone}
                      </span>
                    )}
                    <p className={`text-xs mt-1 flex items-center gap-1 ${dark ? 'text-white/40' : 'text-gray-400'}`}>
                      <ClockIcon className="h-3.5 w-3.5" /> {(patient.historique || []).length} consultation(s) — voir l'historique
                    </p>
                  </button>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openEditModal(patient)} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors" title="Modifier"><PencilSquareIcon className="h-5 w-5" /></button>
                    <button onClick={() => handleDelete(patient.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors" title="Supprimer"><TrashIcon className="h-5 w-5" /></button>
                  </div>
                </div>

                {patient.ordonnanceUrl && (
                  <a href={patient.ordonnanceUrl} target="_blank" rel="noopener noreferrer" className="text-sm hover:underline flex items-center gap-1 mt-2" style={{ color: C.teal }}>
                    <PhotoIcon className="h-4 w-4" /> Voir ordonnance
                  </a>
                )}

                {renouvJours !== null && (
                  <div className={`mt-2 text-xs px-2 py-1 rounded-lg inline-flex items-center gap-1 ${renouvUrgent ? 'bg-amber-50 text-amber-700' : (dark ? 'text-white/40' : 'text-gray-400')}`}>
                    <CalendarDaysIcon className="h-3.5 w-3.5" />
                    {renouvJours < 0 ? `Renouvellement en retard de ${Math.abs(renouvJours)}j` : `Renouvellement dans ${renouvJours}j`}
                  </div>
                )}

                <div className="flex gap-2 mt-3">
                  <button onClick={() => setVisitPatient(patient)} className="flex-1 text-xs font-medium py-1.5 rounded-lg border transition-colors" style={{ borderColor: C.teal + '55', color: C.teal }}>
                    + Consultation
                  </button>
                  {patient.telephone && renouvUrgent && (
                    <button onClick={() => sendReminder(patient)} className="flex-1 text-xs font-medium py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors">
                      Rappel WhatsApp
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {timelinePatient && <TimelineDrawer patient={patients.find(p => p.id === timelinePatient.id) || timelinePatient} onClose={() => setTimelinePatient(null)} dark={dark} />}
      </AnimatePresence>
      {timelinePatient && <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setTimelinePatient(null)} />}

      {visitPatient && <VisitModal patient={visitPatient} onClose={() => setVisitPatient(null)} onSave={saveVisit} />}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-display text-xl text-gray-800">{editingPatient ? 'Modifier le patient' : 'Ajouter un patient'}</h2>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="h-6 w-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nom *</label>
                  <input type="text" name="nom" value={formData.nom} onChange={handleInputChange} className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Prénom *</label>
                  <input type="text" name="prenom" value={formData.prenom} onChange={handleInputChange} className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Téléphone (WhatsApp) *</label>
                <input type="tel" name="telephone" value={formData.telephone} onChange={handleInputChange} className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none" placeholder="05 01 02 03 04" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Prochain renouvellement</label>
                <input type="date" name="dateRenouvellement" value={formData.dateRenouvellement} onChange={handleInputChange} className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none" />
                <p className="text-xs text-gray-400 mt-1">Un rappel apparaîtra 7 jours avant cette date</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Ordonnance (image)</label>
                <div className="mt-1 flex items-center gap-4 flex-wrap">
                  <label className="cursor-pointer flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg border border-gray-300 transition-colors">
                    <PhotoIcon className="h-5 w-5" /> Choisir une image
                    <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                  </label>
                  {formData.ordonnanceFile && <span className="text-sm text-gray-600">{formData.ordonnanceFile.name}</span>}
                  {formData.ordonnanceUrl && !formData.ordonnanceFile && (
                    <a href={formData.ordonnanceUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:underline">Voir l'image actuelle</a>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Notes générales</label>
                <textarea name="notes" value={formData.notes} onChange={handleInputChange} rows="3" className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none" placeholder="Allergies, antécédents..." />
              </div>
              {isUploading && (
                <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                  <motion.div initial={{ width: '10%' }} animate={{ width: '90%' }} transition={{ duration: 1.2 }} className="h-2.5 rounded-full" style={{ background: C.teal }} />
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={isUploading} className={`flex-1 text-white font-semibold py-2.5 rounded-lg transition-colors ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`} style={{ background: C.teal }}>
                  {isUploading ? 'Envoi...' : editingPatient ? 'Mettre à jour' : 'Ajouter'}
                </button>
                <button type="button" onClick={resetForm} className="flex-1 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2.5 rounded-lg transition-colors">Annuler</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   PAGE : Stock & péremptions
   ============================================================ */
function InventairePage() {
  const { user } = useAuth();
  const { dark } = useUIStore();
  const { push } = useToastStore();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('tous');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ nom: '', categorie: '', quantite: '', seuilAlerte: '', datePeremption: '', prix: '' });

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'inventaire'), where('pharmacienId', '==', user.uid), orderBy('nom'));
    const unsub = onSnapshot(q, (snap) => { setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false); },
      (err) => { push('Erreur de chargement : ' + err.message, 'error'); setLoading(false); });
    return unsub;
  }, [user]);

  const resetForm = () => {
    setFormData({ nom: '', categorie: '', quantite: '', seuilAlerte: '', datePeremption: '', prix: '' });
    setEditingItem(null);
    setIsModalOpen(false);
  };
  const openAddModal = () => { resetForm(); setIsModalOpen(true); };
  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      nom: item.nom || '', categorie: item.categorie || '', quantite: item.quantite ?? '', seuilAlerte: item.seuilAlerte ?? '',
      datePeremption: item.datePeremption ? toDate(item.datePeremption).toISOString().slice(0, 10) : '', prix: item.prix ?? ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        nom: formData.nom, categorie: formData.categorie,
        quantite: Number(formData.quantite) || 0, seuilAlerte: Number(formData.seuilAlerte) || 0,
        datePeremption: formData.datePeremption ? new Date(formData.datePeremption).toISOString() : null,
        prix: Number(formData.prix) || 0, pharmacienId: user.uid, updatedAt: serverTimestamp()
      };
      if (editingItem) {
        await updateDoc(doc(db, 'inventaire', editingItem.id), data);
        push('Article mis à jour', 'success');
      } else {
        await addDoc(collection(db, 'inventaire'), { ...data, createdAt: serverTimestamp() });
        push('Article ajouté', 'success');
      }
      resetForm();
    } catch (err) {
      push('Erreur : ' + err.message, 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cet article du stock ?')) return;
    try { await deleteDoc(doc(db, 'inventaire', id)); push('Article supprimé', 'success'); }
    catch (err) { push('Erreur : ' + err.message, 'error'); }
  };

  const enriched = items.map((i) => {
    const joursPeremption = daysUntil(i.datePeremption);
    const stockFaible = (i.quantite ?? 0) <= (i.seuilAlerte ?? 0);
    const peremptionProche = joursPeremption !== null && joursPeremption <= 30;
    return { ...i, joursPeremption, stockFaible, peremptionProche };
  }).filter((i) => i.nom.toLowerCase().includes(search.toLowerCase()))
    .filter((i) => filter === 'tous' || (filter === 'stock' && i.stockFaible) || (filter === 'peremption' && i.peremptionProche));

  if (loading) return <div className={`p-6 ${dark ? 'text-white/60' : 'text-gray-500'}`}>Chargement du stock...</div>;

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className={`font-display text-2xl ${dark ? 'text-white' : 'text-gray-800'}`}>Stock & péremptions</h1>
          <p className={`text-sm ${dark ? 'text-white/50' : 'text-gray-500'}`}>{enriched.length} article(s)</p>
        </div>
        <button onClick={openAddModal} className="flex items-center gap-2 text-white px-4 py-2 rounded-lg transition-transform hover:scale-[1.02]" style={{ background: C.teal }}>
          <PlusIcon className="h-5 w-5" /> Ajouter un article
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un article..."
            className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 outline-none ${dark ? 'bg-[#0F2E29] border-white/10 text-white placeholder:text-white/30' : 'border-gray-300 bg-white'}`} />
        </div>
        <div className="flex gap-2">
          {[['tous', 'Tous'], ['stock', 'Stock faible'], ['peremption', 'Péremption proche']].map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)} className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${filter === key ? 'text-white' : (dark ? 'text-white/50 border-white/10' : 'text-gray-500 border-gray-200')}`} style={filter === key ? { background: C.teal, borderColor: C.teal } : {}}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {enriched.length === 0 ? (
        <div className="text-center py-12 rounded-xl border" style={{ background: dark ? C.cardDark : C.card, borderColor: dark ? '#ffffff14' : '#00000010' }}>
          <ArchiveBoxIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className={dark ? 'text-white/50' : 'text-gray-500'}>Aucun article trouvé</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {enriched.map((item) => (
            <div key={item.id} className="p-4 rounded-xl" style={{ background: dark ? C.cardDark : C.card, border: `1px solid ${(item.stockFaible || item.peremptionProche) ? C.clay + '55' : (dark ? '#ffffff14' : '#00000010')}` }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className={`font-semibold ${dark ? 'text-white' : 'text-gray-800'}`}>{item.nom}</p>
                  {item.categorie && <p className={`text-xs flex items-center gap-1 mt-0.5 ${dark ? 'text-white/40' : 'text-gray-400'}`}><TagIcon className="h-3 w-3" /> {item.categorie}</p>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEditModal(item)} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50"><PencilSquareIcon className="h-5 w-5" /></button>
                  <button onClick={() => handleDelete(item.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"><TrashIcon className="h-5 w-5" /></button>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className={`text-sm font-mono ${item.stockFaible ? 'text-red-500 font-semibold' : (dark ? 'text-white/70' : 'text-gray-600')}`}>Qté : {item.quantite}</span>
                {item.prix > 0 && <span className={`text-sm font-mono ${dark ? 'text-white/50' : 'text-gray-500'}`}>{item.prix} FCFA</span>}
              </div>
              {item.datePeremption && (
                <div className={`mt-2 text-xs px-2 py-1 rounded-lg inline-flex items-center gap-1 ${item.peremptionProche ? 'bg-red-50 text-red-600' : (dark ? 'text-white/40' : 'text-gray-400')}`}>
                  <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                  {item.joursPeremption < 0 ? 'Périmé' : `Péremption dans ${item.joursPeremption}j`}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-display text-xl text-gray-800">{editingItem ? "Modifier l'article" : 'Ajouter un article'}</h2>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="h-6 w-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nom du produit *</label>
                <input value={formData.nom} onChange={(e) => setFormData({ ...formData, nom: e.target.value })} className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Catégorie</label>
                <input value={formData.categorie} onChange={(e) => setFormData({ ...formData, categorie: e.target.value })} className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none" placeholder="Antibiotique, antalgique..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Quantité *</label>
                  <input type="number" min="0" value={formData.quantite} onChange={(e) => setFormData({ ...formData, quantite: e.target.value })} className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Seuil d'alerte *</label>
                  <input type="number" min="0" value={formData.seuilAlerte} onChange={(e) => setFormData({ ...formData, seuilAlerte: e.target.value })} className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Date de péremption</label>
                  <input type="date" value={formData.datePeremption} onChange={(e) => setFormData({ ...formData, datePeremption: e.target.value })} className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Prix (FCFA)</label>
                  <input type="number" min="0" value={formData.prix} onChange={(e) => setFormData({ ...formData, prix: e.target.value })} className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 text-white font-semibold py-2.5 rounded-lg" style={{ background: C.teal }}>{editingItem ? 'Mettre à jour' : 'Ajouter'}</button>
                <button type="button" onClick={resetForm} className="flex-1 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2.5 rounded-lg">Annuler</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   PAGE : Assistant IA — aide à la décision pharmaceutique
   ============================================================ */
function AssistantPage() {
  const { dark } = useUIStore();
  const [tab, setTab] = useState('interactions');
  const [molA, setMolA] = useState('');
  const [molB, setMolB] = useState('');
  const [molecule, setMolecule] = useState(POSOLOGIES_PEDIATRIQUES[0].nom);
  const [poids, setPoids] = useState('');

  const result = useMemo(() => {
    if (!molA || !molB || molA === molB) return null;
    return INTERACTIONS.find((i) => (i.a === molA && i.b === molB) || (i.a === molB && i.b === molA)) || 'none';
  }, [molA, molB]);

  const posologie = POSOLOGIES_PEDIATRIQUES.find((p) => p.nom === molecule);
  const doseCalculee = poids && posologie ? (Number(poids) * posologie.mgParKg) : null;
  const doseMax = poids && posologie ? Math.min(doseCalculee, Number(poids) * posologie.maxParJour) : null;

  const niveauStyle = { majeure: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' }, moderee: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' }, mineure: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' } };

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center gap-3 mb-1">
        <SparklesIcon className="h-6 w-6" style={{ color: C.amber }} />
        <h1 className={`font-display text-2xl ${dark ? 'text-white' : 'text-gray-800'}`}>Assistant du pharmacien</h1>
      </div>
      <p className={`text-sm mb-6 ${dark ? 'text-white/50' : 'text-gray-500'}`}>Outil d'aide à la décision — ne remplace jamais le jugement clinique du pharmacien.</p>

      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab('interactions')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'interactions' ? 'text-white' : (dark ? 'text-white/50' : 'text-gray-500')}`} style={tab === 'interactions' ? { background: C.teal } : {}}>
          <ShieldExclamationIcon className="h-4 w-4 inline mr-1.5 -mt-0.5" /> Interactions médicamenteuses
        </button>
        <button onClick={() => setTab('posologie')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'posologie' ? 'text-white' : (dark ? 'text-white/50' : 'text-gray-500')}`} style={tab === 'posologie' ? { background: C.teal } : {}}>
          <ScaleIcon className="h-4 w-4 inline mr-1.5 -mt-0.5" /> Posologie pédiatrique
        </button>
      </div>

      {tab === 'interactions' && (
        <div className="max-w-2xl">
          <div className="p-6 rounded-2xl" style={{ background: dark ? C.cardDark : C.card, border: `1px solid ${dark ? '#ffffff14' : '#00000010'}` }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${dark ? 'text-white/70' : 'text-gray-700'}`}>Molécule A</label>
                <select value={molA} onChange={(e) => setMolA(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none">
                  <option value="">Sélectionner...</option>
                  {MOLECULES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${dark ? 'text-white/70' : 'text-gray-700'}`}>Molécule B</label>
                <select value={molB} onChange={(e) => setMolB(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none">
                  <option value="">Sélectionner...</option>
                  {MOLECULES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>

            <div className="mt-5">
              {!molA || !molB ? (
                <p className={`text-sm ${dark ? 'text-white/40' : 'text-gray-400'}`}>Sélectionnez deux molécules pour vérifier une interaction connue.</p>
              ) : molA === molB ? (
                <p className={`text-sm ${dark ? 'text-white/40' : 'text-gray-400'}`}>Choisissez deux molécules différentes.</p>
              ) : result === 'none' ? (
                <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-start gap-2">
                  <CheckCircleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  Aucune interaction majeure connue dans notre base de référence entre ces deux molécules.
                </div>
              ) : result ? (
                <div className={`p-4 rounded-lg border text-sm flex items-start gap-2 ${niveauStyle[result.niveau].bg} ${niveauStyle[result.niveau].border} ${niveauStyle[result.niveau].text}`}>
                  <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold uppercase text-xs tracking-wide mb-1">Interaction {result.niveau === 'majeure' ? 'majeure' : result.niveau === 'moderee' ? 'modérée' : 'mineure'}</p>
                    <p>{result.detail}</p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          <p className={`text-xs mt-3 ${dark ? 'text-white/30' : 'text-gray-400'}`}>Base de référence locale à 10 associations courantes, à titre indicatif. Une intégration à une base pharmacologique complète nécessiterait un service backend dédié.</p>
        </div>
      )}

      {tab === 'posologie' && (
        <div className="max-w-2xl">
          <div className="p-6 rounded-2xl" style={{ background: dark ? C.cardDark : C.card, border: `1px solid ${dark ? '#ffffff14' : '#00000010'}` }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${dark ? 'text-white/70' : 'text-gray-700'}`}>Molécule</label>
                <select value={molecule} onChange={(e) => setMolecule(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none">
                  {POSOLOGIES_PEDIATRIQUES.map((p) => <option key={p.nom} value={p.nom}>{p.nom}</option>)}
                </select>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${dark ? 'text-white/70' : 'text-gray-700'}`}>Poids de l'enfant (kg)</label>
                <input type="number" min="0" value={poids} onChange={(e) => setPoids(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none" placeholder="ex : 18" />
              </div>
            </div>
            {poids && (
              <div className="mt-5 p-4 rounded-lg" style={{ background: dark ? '#ffffff08' : '#00000006' }}>
                <p className={`text-xs font-mono uppercase ${dark ? 'text-white/40' : 'text-gray-400'}`}>{posologie.unite}</p>
                <p className={`font-display text-3xl mt-1 ${dark ? 'text-white' : 'text-gray-800'}`}>{doseCalculee?.toFixed(1)} mg <span className="text-sm font-body font-normal opacity-50">par prise</span></p>
                <p className={`text-sm mt-1 ${dark ? 'text-white/50' : 'text-gray-500'}`}>Dose maximale conseillée : environ {doseMax?.toFixed(0)} mg/jour</p>
              </div>
            )}
          </div>
          <p className={`text-xs mt-3 ${dark ? 'text-white/30' : 'text-gray-400'}`}>Calcul indicatif basé sur des posologies usuelles. À valider systématiquement selon l'âge, la forme galénique disponible et les recommandations en vigueur.</p>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   PAGE : Statistiques
   ============================================================ */
function StatsPage() {
  const { user } = useAuth();
  const { dark } = useUIStore();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'patients'), where('pharmacienId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => { setPatients(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false); }, () => setLoading(false));
    return unsub;
  }, [user]);

  const monthlyGrowth = useMemo(() => {
    const months = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      return d;
    });
    return months.map((m) => {
      const label = m.toLocaleDateString('fr-FR', { month: 'short' });
      const count = patients.filter((p) => {
        const created = toDate(p.createdAt);
        return created && created.getFullYear() === m.getFullYear() && created.getMonth() === m.getMonth();
      }).length;
      return { mois: label, nouveaux: count };
    });
  }, [patients]);

  const totalConsultations = patients.reduce((acc, p) => acc + (p.historique || []).length, 0);
  const moyenneParPatient = patients.length ? (totalConsultations / patients.length).toFixed(1) : 0;

  if (loading) return <div className={`p-6 ${dark ? 'text-white/60' : 'text-gray-500'}`}>Chargement...</div>;

  return (
    <div className="p-4 md:p-6">
      <h1 className={`font-display text-2xl mb-6 ${dark ? 'text-white' : 'text-gray-800'}`}>Statistiques</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard title="Total patients" value={patients.length} icon={UsersIcon} tone={C.teal} dark={dark} />
        <StatCard title="Consultations cumulées" value={totalConsultations} icon={ClipboardDocumentListIcon} tone={C.amber} dark={dark} />
        <StatCard title="Moyenne / patient" value={moyenneParPatient} icon={ArrowPathIcon} tone={C.sage} dark={dark} />
      </div>

      <div className="p-5 rounded-2xl" style={{ background: dark ? C.cardDark : C.card, border: `1px solid ${dark ? '#ffffff14' : '#00000010'}` }}>
        <p className={`text-sm font-medium mb-4 ${dark ? 'text-white' : 'text-gray-700'}`}>Nouveaux patients — 6 derniers mois</p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={monthlyGrowth}>
            <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#ffffff14' : '#00000010'} vertical={false} />
            <XAxis dataKey="mois" tick={{ fontSize: 12, fill: dark ? '#ffffff80' : '#6b7280' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: dark ? '#ffffff80' : '#6b7280' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: 'none' }} />
            <Bar dataKey="nouveaux" fill={C.teal} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ============================================================
   LAYOUT + ROUTES
   ============================================================ */
function LayoutWithSidebar({ children }) {
  const { dark, paletteOpen, setPaletteOpen } = useUIStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className={`min-h-screen flex ${dark ? 'bg-[#0A1F1C]' : 'bg-[#F6F3EC]'}`}>
      <GlobalStyle />
      <ToastStack />
      <CommandPalette />
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
            <div className="relative w-64 h-full"><Sidebar /></div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex-1 overflow-auto">
        <div className="md:hidden flex items-center justify-between px-4 h-14 border-b" style={{ borderColor: dark ? '#ffffff14' : '#00000010' }}>
          <button onClick={() => setMobileOpen(true)} className={dark ? 'text-white' : 'text-gray-700'}><Bars3Icon className="h-6 w-6" /></button>
          <span className={`font-display text-sm ${dark ? 'text-white' : 'text-gray-800'}`}>Sainte Marie Majeure</span>
          <button onClick={() => setPaletteOpen(true)} className={dark ? 'text-white/60' : 'text-gray-400'}><CommandLineIcon className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/dashboard" element={<PrivateRoute><LayoutWithSidebar><DashboardPage /></LayoutWithSidebar></PrivateRoute>} />
      <Route path="/patients" element={<PrivateRoute><LayoutWithSidebar><PatientsPage /></LayoutWithSidebar></PrivateRoute>} />
      <Route path="/stock" element={<PrivateRoute><LayoutWithSidebar><InventairePage /></LayoutWithSidebar></PrivateRoute>} />
      <Route path="/assistant" element={<PrivateRoute><LayoutWithSidebar><AssistantPage /></LayoutWithSidebar></PrivateRoute>} />
      <Route path="/stats" element={<PrivateRoute><LayoutWithSidebar><StatsPage /></LayoutWithSidebar></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;