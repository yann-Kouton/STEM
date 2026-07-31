import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect, useMemo, useRef, useCallback, createContext, useContext } from 'react';
import { create } from 'zustand';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { AuthProvider, useAuth } from './context/AuthContext';
import {
  EnvelopeIcon, LockClosedIcon, ArrowLeftOnRectangleIcon, CheckBadgeIcon, XMarkIcon,
  UserPlusIcon, MagnifyingGlassIcon, PencilSquareIcon, TrashIcon, UserCircleIcon,
  PhoneIcon, HomeIcon, UsersIcon, ChatBubbleLeftRightIcon, ChartBarIcon, PhotoIcon,
  ClipboardDocumentListIcon, MoonIcon, SunIcon, CommandLineIcon, BellAlertIcon,
  ClockIcon, ChevronRightIcon, BeakerIcon, ScaleIcon,
  ShieldExclamationIcon, CheckCircleIcon, InformationCircleIcon, ExclamationTriangleIcon,
  CalendarDaysIcon, Bars3Icon, SparklesIcon, ArrowPathIcon,
  PaperAirplaneIcon, ChevronDownIcon,
  EyeIcon, EyeSlashIcon
} from '@heroicons/react/24/outline';
import { sendPasswordResetEmail, sendEmailVerification, updateProfile } from 'firebase/auth';
import { auth, db } from './firebase/config';
import {
  collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query,
  orderBy, serverTimestamp, where, arrayUnion, setDoc
} from 'firebase/firestore';

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

// === Fonction d'upload vers Cloudinary ===
async function uploadToCloudinary(file) {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error('Cloudinary non configuré. Vérifiez vos variables d\'environnement.');
  }
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: 'POST', body: formData }
  );
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Erreur lors de l\'upload vers Cloudinary');
  }
  const data = await response.json();
  return data.secure_url;
}

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
  error: ExclamationTriangleIcon,
  info: InformationCircleIcon,
};

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

// === Gestion des statuts de rendez-vous ===
const RDV_STATUTS = ['Prévu', 'Effectué', 'Manqué', 'Annulé'];
function rdvStatutStyle(statut) {
  switch (statut) {
    case 'Effectué': return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
    case 'Manqué': return { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' };
    case 'Annulé': return { bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200' };
    default: return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' }; // Prévu
  }
}
// Retourne le prochain RDV "Prévu" le plus proche (peut être en retard) parmi la liste de RDV d'un patient
function nextRendezVous(rendezVous) {
  const prevus = (rendezVous || []).filter((r) => r.statut === 'Prévu' && r.date);
  if (prevus.length === 0) return null;
  return [...prevus].sort((a, b) => toDate(a.date) - toDate(b.date))[0];
}

// Fonction de calcul d'âge
function calculAge(dateNaissance) {
  if (!dateNaissance) return null;
  const naissance = toDate(dateNaissance);
  if (!naissance) return null;
  const now = new Date();
  let age = now.getFullYear() - naissance.getFullYear();
  const mois = now.getMonth() - naissance.getMonth();
  if (mois < 0 || (mois === 0 && now.getDate() < naissance.getDate())) {
    age--;
  }
  return age;
}

// Fonction pour capitaliser la première lettre de chaque phrase
function capitalizeSentences(text) {
  if (!text) return text;
  // Diviser le texte en phrases en utilisant les séparateurs . ? !
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  // Capitaliser la première lettre de chaque phrase
  const capitalized = sentences.map(sentence => {
    const trimmed = sentence.trim();
    if (trimmed.length === 0) return sentence;
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  });
  // Rejoindre les phrases avec un espace (ou conserver la ponctuation)
  return capitalized.join(' ');
}

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

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      if (isRegister) {
        const userCredential = await register(email, password);
        const user = userCredential.user;
        const displayName = `Dr. ${prenom} ${nom}`;
        await updateProfile(user, { displayName });
        await setDoc(doc(db, 'pharmaciens', user.uid), {
          nom,
          prenom,
          email,
          displayName,
          createdAt: serverTimestamp()
        });
        await sendEmailVerification(user);
        setSuccess('Un email de vérification vous a été envoyé. Veuillez le confirmer avant de vous connecter.');
        setNom('');
        setPrenom('');
        setEmail('');
        setPassword('');
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
    const result = await loginWithGoogle();
    const user = result.user;
    // Extraire prénom et nom depuis displayName
    const fullName = user.displayName || '';
    const nameParts = fullName.split(' ');
    const prenom = nameParts[0] || '';
    const nom = nameParts.slice(1).join(' ') || '';
    // Créer le document pharmacien s'il n'existe pas
    await setDoc(doc(db, 'pharmaciens', user.uid), {
      nom,
      prenom,
      email: user.email,
      displayName: fullName,
      createdAt: serverTimestamp()
    }, { merge: true }); // merge: true pour ne pas écraser si déjà existant
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
            <p className="text-white/60 text-xs mt-1 font-mono uppercase tracking-widest">Plateforme interne</p>
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
                {isRegister && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Prénom</label>
                      <div className="relative mt-1">
                        <UserCircleIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          type="text"
                          value={prenom}
                          onChange={(e) => setPrenom(e.target.value)}
                          className="pl-10 w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 outline-none"
                          placeholder="Vignon"
                          required={isRegister}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Nom</label>
                      <div className="relative mt-1">
                        <UserCircleIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          type="text"
                          value={nom}
                          onChange={(e) => setNom(e.target.value)}
                          className="pl-10 w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 outline-none"
                          placeholder="Kouton"
                          required={isRegister}
                        />
                      </div>
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <div className="relative mt-1">
                    <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 outline-none"
                      placeholder="kouton.vignon@exemple.com" required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Mot de passe</label>
                  <div className="relative mt-1 flex items-center">
                    <LockClosedIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 outline-none"
                      placeholder="••••••••"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeSlashIcon className="h-5 w-5" />
                      ) : (
                        <EyeIcon className="h-5 w-5" />
                      )}
                    </button>
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
      </motion.div>
    </div>
  );
}

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
    { label: 'Vignon IA', icon: ChatBubbleLeftRightIcon, run: () => navigate('/assistant') },
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
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              <input
                ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher une fonctionnalité..."
                className="flex-1 outline-none text-sm font-body"
              />
              <kbd className="text-[10px] font-mono text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">ESC</kbd>
            </div>
            <div className="max-h-80 overflow-y-auto scrollbar-thin py-2">
              {filtered.length === 0 && (
                <p className="text-sm text-gray-400 px-4 py-6 text-center">Aucune fonctionnalité trouvée</p>
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

function Sidebar() {
  const location = useLocation();
  const { logout, user } = useAuth();
  const { dark, toggleDark, setPaletteOpen } = useUIStore();

  const navItems = [
    { path: '/dashboard', label: 'Tableau de bord', icon: HomeIcon },
    { path: '/patients', label: 'Patients', icon: UsersIcon },
    { path: '/assistant', label: 'Vignon IA', icon: ChatBubbleLeftRightIcon },
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
          <span className="flex items-center gap-2">
            <MagnifyingGlassIcon className="h-4 w-4" /> Rechercher
          </span>
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
        {user?.displayName && (
          <p className="text-xs text-white/40 text-center mt-2">{user.displayName}</p>
        )}
      </div>
    </div>
  );
}

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const qP = query(collection(db, 'patients'), where('pharmacienId', '==', user.uid));
    const unsubP = onSnapshot(qP, (snap) => {
      setPatients(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return () => { unsubP(); };
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
    return { totalPatients, totalConsultations, consultationsJour, renouvellements, allVisites };
  }, [patients]);

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
  const displayName = user?.displayName || user?.email || 'Utilisateur';

  if (loading) return <div className={`p-6 ${dark ? 'text-white/60' : 'text-gray-500'}`}>Chargement des statistiques…</div>;

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className={`font-display text-2xl ${dark ? 'text-white' : 'text-gray-800'}`}>Tableau de bord</h1>
          <p className={dark ? 'text-white/50' : 'text-gray-500'}>Bonjour, {displayName}</p>
          {!isEmailVerified && user?.providerData?.[0]?.providerId === 'password' && (
            <div className="mt-2 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 w-fit">
              <XMarkIcon className="h-4 w-4" />
              <span>Email non vérifié. <button onClick={() => sendEmailVerification(auth.currentUser)} className="text-indigo-600 hover:underline">Renvoyer le lien</button></span>
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        <StatCard title="Patients actifs" value={stats.totalPatients} icon={UsersIcon} tone={C.teal} dark={dark} />
        <StatCard title="Consultations totales" value={stats.totalConsultations} icon={ClipboardDocumentListIcon} tone={C.tealLight} dark={dark} />
        <StatCard title="Aujourd'hui" value={stats.consultationsJour} icon={CalendarDaysIcon} tone={C.sage} dark={dark} />
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
      <div className="mt-4">
        <div className="p-5 rounded-2xl" style={{ background: dark ? C.cardDark : C.card, border: `1px solid ${dark ? '#ffffff14' : '#00000010'}` }}>
          <p className={`text-sm font-medium mb-3 flex items-center gap-2 ${dark ? 'text-white' : 'text-gray-700'}`}>
            <CalendarDaysIcon className="h-4 w-4" style={{ color: C.amber }} /> RDV à prévoir
          </p>
          {stats.renouvellements.length === 0 ? (
            <p className={`text-sm ${dark ? 'text-white/40' : 'text-gray-400'}`}>Aucun RDV dans les 7 prochains jours</p>
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
      </div>
    </div>
  );
}

function PatientDetailDrawer({ patient, onClose, dark, onEditConstante, onDeleteConstante, onAddRdv, onEditRdv, onDeleteRdv, onSetRdvStatut }) {
  const historique = [...(patient.historique || [])].sort((a, b) => toDate(b.date) - toDate(a.date));
  const age = calculAge(patient.dateNaissance);

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'tween', duration: 0.25 }}
      className="fixed right-0 top-0 h-screen w-full max-w-2xl z-50 shadow-2xl overflow-y-auto scrollbar-thin"
      style={{ background: dark ? C.cardDark : C.card }}
    >
      <div
        className="p-5 border-b sticky top-0 z-10 flex items-center justify-between"
        style={{ background: dark ? C.cardDark : C.card, borderColor: dark ? '#ffffff14' : '#00000010' }}
      >
        <div>
          <p className={`font-display text-xl ${dark ? 'text-white' : 'text-gray-800'}`}>
            {patient.prenom} {patient.nom}
          </p>
          {patient.contact1 && (
            <p className={`text-sm flex items-center gap-1 mt-0.5 ${dark ? 'text-white/60' : 'text-gray-600'}`}>
              <PhoneIcon className="h-4 w-4" /> {patient.contact1}
            </p>
          )}
        </div>
        <button onClick={onClose} className={dark ? 'text-white/50 hover:text-white' : 'text-gray-400 hover:text-gray-700'}>
          <XMarkIcon className="h-6 w-6" />
        </button>
      </div>
      <div className="p-6 space-y-6">
        <div>
          <h4 className={`text-sm font-semibold uppercase tracking-wider ${dark ? 'text-white/40' : 'text-gray-500'} border-b pb-1`}>
            I. Données administratives
          </h4>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3 text-sm">
            <div><dt className={`${dark ? 'text-white/40' : 'text-gray-500'}`}>Genre</dt><dd className={`font-medium ${dark ? 'text-white' : 'text-gray-800'}`}>{patient.genre || '—'}</dd></div>
            <div><dt className={`${dark ? 'text-white/40' : 'text-gray-500'}`}>Date de naissance</dt><dd className={`font-medium ${dark ? 'text-white' : 'text-gray-800'}`}>{patient.dateNaissance ? formatDate(patient.dateNaissance) : '—'}</dd></div>
            <div><dt className={`${dark ? 'text-white/40' : 'text-gray-500'}`}>Âge</dt><dd className={`font-medium ${dark ? 'text-white' : 'text-gray-800'}`}>{age !== null ? `${age} ans` : '—'}</dd></div>
            <div className="col-span-2"><dt className={`${dark ? 'text-white/40' : 'text-gray-500'}`}>Adresse</dt><dd className={`font-medium ${dark ? 'text-white' : 'text-gray-800'}`}>{patient.adresse || '—'}</dd></div>
            <div className="col-span-2"><dt className={`${dark ? 'text-white/40' : 'text-gray-500'}`}>Assurance</dt>
              <dd className={`font-medium ${dark ? 'text-white' : 'text-gray-800'}`}>
                {patient.assuranceNom ? (
                  <div>
                    <div><span className="text-xs opacity-60">Nom :</span> {patient.assuranceNom}</div>
                    <div><span className="text-xs opacity-60">Matricule :</span> {patient.assuranceMatricule || '—'}</div>
                    <div><span className="text-xs opacity-60">N° affilié :</span> {patient.assuranceNumeroAffilie || '—'}</div>
                  </div>
                ) : '—'}
              </dd>
            </div>
            <div><dt className={`${dark ? 'text-white/40' : 'text-gray-500'}`}>Contact 2</dt><dd className={`font-medium ${dark ? 'text-white' : 'text-gray-800'}`}>{patient.contact2 || '—'}</dd></div>
          </dl>
        </div>
        <div>
          <h4 className={`text-sm font-semibold uppercase tracking-wider ${dark ? 'text-white/40' : 'text-gray-500'} border-b pb-1`}>
            II. Données médicales
          </h4>
          <dl className="grid grid-cols-1 gap-y-2 mt-3 text-sm">
            <div><dt className={`${dark ? 'text-white/40' : 'text-gray-500'}`}>Allergies connues et intolérances</dt>
              <dd className={`font-medium ${dark ? 'text-white' : 'text-gray-800'}`}>
                {patient.allergieMedicamenteuse === 'OUI' ? <span className="text-red-600">OUI — {patient.allergiePrecision || 'non précisé'}</span> : 'NON'}
              </dd>
            </div>
            <div><dt className={`${dark ? 'text-white/40' : 'text-gray-500'}`}>Status particulier (Asthme, Insuffisance rénale)</dt>
              <dd className={`font-medium ${dark ? 'text-white' : 'text-gray-800'}`}>
                {patient.antecedentMaladie === 'OUI' ? <span className="text-amber-600">OUI — {patient.antecedentPrecision || 'non précisé'}</span> : 'NON'}
              </dd>
            </div>
            <div><dt className={`${dark ? 'text-white/40' : 'text-gray-500'}`}>Pathologie chronique</dt><dd className={`font-medium ${dark ? 'text-white' : 'text-gray-800'}`}>{patient.pathologieChronique || '—'}</dd></div>
            <div><dt className={`${dark ? 'text-white/40' : 'text-gray-500'}`}>Traitement chronique</dt><dd className={`font-medium ${dark ? 'text-white' : 'text-gray-800'}`}>{patient.traitementChronique && patient.traitementChronique.length > 0 ? <ul className="list-disc list-inside space-y-0.5">{patient.traitementChronique.map((med, idx) => <li key={idx}>{med}</li>)}</ul> : '—'}</dd></div>
          </dl>
        </div>
        <div>
          <h4 className={`text-sm font-semibold uppercase tracking-wider ${dark ? 'text-white/40' : 'text-gray-500'} border-b pb-1`}>
            III. Mode de vie
          </h4>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3 text-sm">
            <div><dt className={`${dark ? 'text-white/40' : 'text-gray-500'}`}>Tabagisme</dt><dd className={`font-medium ${dark ? 'text-white' : 'text-gray-800'}`}>{patient.tabagisme || 'NON'}</dd></div>
            <div><dt className={`${dark ? 'text-white/40' : 'text-gray-500'}`}>Alcool</dt><dd className={`font-medium ${dark ? 'text-white' : 'text-gray-800'}`}>{patient.alcool || 'NON'}</dd></div>
            <div><dt className={`${dark ? 'text-white/40' : 'text-gray-500'}`}>Café</dt><dd className={`font-medium ${dark ? 'text-white' : 'text-gray-800'}`}>{patient.cafe || 'NON'}</dd></div>
            <div><dt className={`${dark ? 'text-white/40' : 'text-gray-500'}`}>Régime particulier</dt><dd className={`font-medium ${dark ? 'text-white' : 'text-gray-800'}`}>{patient.regimeParticulier === 'OUI' ? patient.regimePrecision || 'OUI' : 'NON'}</dd></div>
            <div><dt className={`${dark ? 'text-white/40' : 'text-gray-500'}`}>Activité physique</dt><dd className={`font-medium ${dark ? 'text-white' : 'text-gray-800'}`}>{patient.activitePhysique === 'OUI' ? patient.activitePrecision || 'OUI' : 'NON'}</dd></div>
            <div><dt className={`${dark ? 'text-white/40' : 'text-gray-500'}`}>Métier</dt><dd className={`font-medium ${dark ? 'text-white' : 'text-gray-800'}`}>{patient.metier || '—'}</dd></div>
            <div className="col-span-2"><dt className={`${dark ? 'text-white/40' : 'text-gray-500'}`}>Remarques</dt><dd className={`font-medium ${dark ? 'text-white' : 'text-gray-800'}`}>{patient.notes || '—'}</dd></div>
          </dl>
        </div>
        {patient.ordonnanceUrl && (
          <div><dt className={`text-sm ${dark ? 'text-white/40' : 'text-gray-500'}`}>Ordonnance (fiche)</dt><dd><a href={patient.ordonnanceUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-teal-600 hover:underline flex items-center gap-1"><PhotoIcon className="h-4 w-4" /> Voir l'image</a></dd></div>
        )}
        <RendezVousSection patient={patient} dark={dark} onAddRdv={onAddRdv} onEditRdv={onEditRdv} onDeleteRdv={onDeleteRdv} onSetStatut={onSetRdvStatut} />
        <PatientVitalsSection patient={patient} dark={dark} onEditConstante={onEditConstante} onDeleteConstante={onDeleteConstante} />
        <div>
          <h4 className={`text-sm font-semibold uppercase tracking-wider ${dark ? 'text-white/40' : 'text-gray-500'} border-b pb-1`}>
            Historique des consultations ({historique.length})
          </h4>
          {historique.length === 0 ? (
            <p className={`text-sm mt-3 ${dark ? 'text-white/40' : 'text-gray-400'}`}>Aucune consultation enregistrée.</p>
          ) : (
            <div className="relative pl-6 mt-3 space-y-4">
              <div className="absolute left-[7px] top-1 bottom-1 w-px" style={{ background: dark ? '#ffffff20' : '#00000015' }} />
              {historique.map((v, i) => (
                <div key={i} className="relative">
                  <div className="absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2" style={{ borderColor: C.teal, background: dark ? C.cardDark : C.card }} />
                  <p className={`text-xs font-mono ${dark ? 'text-white/40' : 'text-gray-400'}`}>{formatDate(v.date)}</p>
                  <p className={`text-sm font-medium mt-0.5 ${dark ? 'text-white' : 'text-gray-800'}`}>{v.objet || 'Consultation'}</p>
                  {v.notes && <p className={`text-sm mt-1 ${dark ? 'text-white/60' : 'text-gray-500'}`}>{v.notes}</p>}
                  {v.ordonnanceUrl && (
                    <a href={v.ordonnanceUrl} target="_blank" rel="noopener noreferrer" className="text-sm mt-1 hover:underline flex items-center gap-1" style={{ color: C.teal }}>
                      <PhotoIcon className="h-4 w-4" /> Voir l'ordonnance
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// Section "Suivi physiologique" : graphique d'évolution + tableau des mesures
function PatientVitalsSection({ patient, dark, onEditConstante, onDeleteConstante }) {
  const constantesWithIndex = (patient.constantes || []).map((c, idx) => ({ ...c, _origIndex: idx }));
  const constantes = [...constantesWithIndex].sort((a, b) => toDate(a.date) - toDate(b.date));
  const chartData = constantes.map((c) => ({
    date: formatDate(c.date),
    Poids: c.poids ?? null,
    Systolique: c.tensionSystolique ?? null,
    Diastolique: c.tensionDiastolique ?? null,
    Glycémie: c.glycemie ?? null,
  }));
  const gridColor = dark ? '#ffffff14' : '#00000010';
  const axisColor = dark ? '#ffffff80' : '#6b7280';

  return (
    <div>
      <h4 className={`text-sm font-semibold uppercase tracking-wider ${dark ? 'text-white/40' : 'text-gray-500'} border-b pb-1`}>
        Suivi physiologique ({constantes.length})
      </h4>
      {constantes.length === 0 ? (
        <p className={`text-sm mt-3 ${dark ? 'text-white/40' : 'text-gray-400'}`}>Aucune mesure enregistrée.</p>
      ) : (
        <div className="mt-3 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 rounded-xl" style={{ background: dark ? C.cardDark : '#F9FAFB', border: `1px solid ${gridColor}` }}>
              <p className={`text-xs font-medium mb-2 ${dark ? 'text-white/60' : 'text-gray-600'}`}>Poids (kg)</p>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: axisColor }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: axisColor }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: 'none' }} />
                  <Line type="monotone" dataKey="Poids" stroke={C.teal} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="p-3 rounded-xl" style={{ background: dark ? C.cardDark : '#F9FAFB', border: `1px solid ${gridColor}` }}>
              <p className={`text-xs font-medium mb-2 ${dark ? 'text-white/60' : 'text-gray-600'}`}>Glycémie (g/L)</p>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: axisColor }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: axisColor }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: 'none' }} />
                  <Line type="monotone" dataKey="Glycémie" stroke={C.amber} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="p-3 rounded-xl sm:col-span-2" style={{ background: dark ? C.cardDark : '#F9FAFB', border: `1px solid ${gridColor}` }}>
              <p className={`text-xs font-medium mb-2 ${dark ? 'text-white/60' : 'text-gray-600'}`}>Tension artérielle (mmHg)</p>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: axisColor }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: axisColor }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: 'none' }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="Systolique" stroke={C.clay} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  <Line type="monotone" dataKey="Diastolique" stroke={C.sage} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl" style={{ border: `1px solid ${gridColor}` }}>
            <table className="w-full text-sm">
              <thead>
                <tr className={dark ? 'text-white/40' : 'text-gray-500'}>
                  <th className="text-left font-medium px-3 py-2">Date</th>
                  <th className="text-left font-medium px-3 py-2">Poids</th>
                  <th className="text-left font-medium px-3 py-2">Tension</th>
                  <th className="text-left font-medium px-3 py-2">Glycémie</th>
                  <th className="text-left font-medium px-3 py-2">Temp.</th>
                  <th className="text-left font-medium px-3 py-2">Pouls</th>
                  {(onEditConstante || onDeleteConstante) && <th className="text-right font-medium px-3 py-2">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {[...constantes].reverse().map((c, i) => (
                  <tr key={i} className={dark ? 'text-white/80' : 'text-gray-700'} style={{ borderTop: `1px solid ${gridColor}` }}>
                    <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">{formatDate(c.date)}</td>
                    <td className="px-3 py-2">{c.poids != null ? `${c.poids} kg` : '—'}</td>
                    <td className="px-3 py-2">{(c.tensionSystolique != null || c.tensionDiastolique != null) ? `${c.tensionSystolique ?? '—'}/${c.tensionDiastolique ?? '—'}` : '—'}</td>
                    <td className="px-3 py-2">{c.glycemie != null ? `${c.glycemie} g/L` : '—'}</td>
                    <td className="px-3 py-2">{c.temperature != null ? `${c.temperature} °C` : '—'}</td>
                    <td className="px-3 py-2">{c.pouls != null ? `${c.pouls} bpm` : '—'}</td>
                    {(onEditConstante || onDeleteConstante) && (
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-2">
                          {onEditConstante && (
                            <button type="button" onClick={() => onEditConstante(patient, c._origIndex)} className="p-1 text-gray-400 hover:text-indigo-600 rounded transition-colors" title="Modifier">
                              <PencilSquareIcon className="h-4 w-4" />
                            </button>
                          )}
                          {onDeleteConstante && (
                            <button type="button" onClick={() => onDeleteConstante(patient, c._origIndex)} className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors" title="Supprimer">
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// Modal de visite avec capitalisation en temps réel
function VisitModal({ patient, onClose, onSave }) {
  const [objet, setObjet] = useState('');
  const [notes, setNotes] = useState('');
  const [ordonnanceFile, setOrdonnanceFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const { push } = useToastStore();

  // Gestionnaires onChange avec capitalisation immédiate
  const handleObjetChange = (e) => {
    setObjet(capitalizeSentences(e.target.value));
  };

  const handleNotesChange = (e) => {
    setNotes(capitalizeSentences(e.target.value));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) setOrdonnanceFile(file);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      let ordonnanceUrl = '';
      if (ordonnanceFile) {
        ordonnanceUrl = await uploadToCloudinary(ordonnanceFile);
      }
      // Les données sont déjà capitalisées grâce aux onChange
      await onSave({ date: new Date().toISOString(), objet, notes, ordonnanceUrl: ordonnanceUrl || '' });
    } catch (err) {
      push('Erreur lors de l\'envoi de l\'ordonnance : ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
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
          <input
            value={objet}
            onChange={handleObjetChange}
            required
            className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none"
            placeholder="Fièvre, renouvellement, conseil..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Notes</label>
          <textarea
            value={notes}
            onChange={handleNotesChange}
            rows="3"
            className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Ordonnance (image)</label>
          <div className="mt-1 flex items-center gap-3 flex-wrap">
            <label className="cursor-pointer flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg border border-gray-300 transition-colors text-sm">
              <PhotoIcon className="h-5 w-5" /> Choisir une image
              <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            </label>
            {ordonnanceFile && <span className="text-sm text-gray-600">{ordonnanceFile.name}</span>}
          </div>
        </div>
        <button disabled={saving} type="submit" className="w-full text-white font-semibold py-2.5 rounded-lg" style={{ background: C.teal }}>{saving ? 'Enregistrement...' : 'Enregistrer la visite'}</button>
      </motion.form>
    </div>
  );
}

// Modal d'ajout de constantes physiologiques (poids, tension, glycémie, etc.)
function ConstanteModal({ patient, initialData, onClose, onSave, onDelete }) {
  const isEditing = !!initialData;
  const [date, setDate] = useState(initialData ? toDate(initialData.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [poids, setPoids] = useState(initialData?.poids ?? '');
  const [tensionSystolique, setTensionSystolique] = useState(initialData?.tensionSystolique ?? '');
  const [tensionDiastolique, setTensionDiastolique] = useState(initialData?.tensionDiastolique ?? '');
  const [glycemie, setGlycemie] = useState(initialData?.glycemie ?? '');
  const [temperature, setTemperature] = useState(initialData?.temperature ?? '');
  const [pouls, setPouls] = useState(initialData?.pouls ?? '');
  const [notes, setNotes] = useState(initialData?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { push } = useToastStore();

  const submit = async (e) => {
    e.preventDefault();
    if (!poids && !tensionSystolique && !tensionDiastolique && !glycemie && !temperature && !pouls) {
      push('Veuillez renseigner au moins une valeur', 'error');
      return;
    }
    setSaving(true);
    await onSave({
      date: new Date(date).toISOString(),
      poids: poids ? parseFloat(poids) : null,
      tensionSystolique: tensionSystolique ? parseFloat(tensionSystolique) : null,
      tensionDiastolique: tensionDiastolique ? parseFloat(tensionDiastolique) : null,
      glycemie: glycemie ? parseFloat(glycemie) : null,
      temperature: temperature ? parseFloat(temperature) : null,
      pouls: pouls ? parseFloat(pouls) : null,
      notes: capitalizeSentences(notes),
    });
    setSaving(false);
  };

  const handleDeleteClick = async () => {
    setDeleting(true);
    await onDelete();
    setDeleting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <motion.form initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} onSubmit={submit} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="font-display text-lg text-gray-800">{isEditing ? 'Modifier la mesure' : 'Constantes'} — {patient.prenom} {patient.nom}</h3>
          <button type="button" onClick={onClose}><XMarkIcon className="h-5 w-5 text-gray-400" /></button>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Date de la mesure</label>
          <input
            type="date" value={date} onChange={(e) => setDate(e.target.value)} required
            className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">Poids (kg)</label>
            <input type="number" step="0.1" value={poids} onChange={(e) => setPoids(e.target.value)} className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none" placeholder="ex : 68.5" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Glycémie (g/L)</label>
            <input type="number" step="0.01" value={glycemie} onChange={(e) => setGlycemie(e.target.value)} className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none" placeholder="ex : 1.05" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Tension artérielle (mmHg)</label>
          <div className="grid grid-cols-2 gap-3 mt-1">
            <input type="number" value={tensionSystolique} onChange={(e) => setTensionSystolique(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none" placeholder="Systolique (ex : 12)" />
            <input type="number" value={tensionDiastolique} onChange={(e) => setTensionDiastolique(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none" placeholder="Diastolique (ex : 8)" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">Température (°C)</label>
            <input type="number" step="0.1" value={temperature} onChange={(e) => setTemperature(e.target.value)} className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none" placeholder="ex : 37.2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Pouls (bpm)</label>
            <input type="number" value={pouls} onChange={(e) => setPouls(e.target.value)} className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none" placeholder="ex : 72" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Remarques</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows="2" className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none" />
        </div>
        <div className="flex gap-3">
          <button disabled={saving || deleting} type="submit" className="flex-1 text-white font-semibold py-2.5 rounded-lg" style={{ background: C.teal }}>{saving ? 'Enregistrement...' : isEditing ? 'Mettre à jour' : 'Enregistrer la mesure'}</button>
          {isEditing && onDelete && (
            <button type="button" disabled={saving || deleting} onClick={handleDeleteClick} className="px-4 py-2.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors font-medium text-sm">
              {deleting ? 'Suppression...' : 'Supprimer'}
            </button>
          )}
        </div>
      </motion.form>
    </div>
  );
}

// Modal d'ajout / modification d'un rendez-vous
function RendezVousModal({ patient, initialData, onClose, onSave, onDelete }) {
  const isEditing = !!initialData;
  const [date, setDate] = useState(initialData ? toDate(initialData.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [motif, setMotif] = useState(initialData?.motif ?? '');
  const [statut, setStatut] = useState(initialData?.statut ?? 'Prévu');
  const [notes, setNotes] = useState(initialData?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave({
      date: new Date(date).toISOString(),
      motif: capitalizeSentences(motif),
      statut,
      notes: capitalizeSentences(notes),
    });
    setSaving(false);
  };

  const handleDeleteClick = async () => {
    setDeleting(true);
    await onDelete();
    setDeleting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <motion.form initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} onSubmit={submit} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="font-display text-lg text-gray-800">{isEditing ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous'} — {patient.prenom} {patient.nom}</h3>
          <button type="button" onClick={onClose}><XMarkIcon className="h-5 w-5 text-gray-400" /></button>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Date du rendez-vous</label>
          <input
            type="date" value={date} onChange={(e) => setDate(e.target.value)} required
            className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Motif</label>
          <input
            type="text" value={motif} onChange={(e) => setMotif(e.target.value)}
            className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none"
            placeholder="ex : Renouvellement traitement chronique"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Statut</label>
          <select value={statut} onChange={(e) => setStatut(e.target.value)} className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none bg-white">
            {RDV_STATUTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Remarques</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows="2" className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none" />
        </div>
        <div className="flex gap-3">
          <button disabled={saving || deleting} type="submit" className="flex-1 text-white font-semibold py-2.5 rounded-lg" style={{ background: C.teal }}>{saving ? 'Enregistrement...' : isEditing ? 'Mettre à jour' : 'Enregistrer le rendez-vous'}</button>
          {isEditing && onDelete && (
            <button type="button" disabled={saving || deleting} onClick={handleDeleteClick} className="px-4 py-2.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors font-medium text-sm">
              {deleting ? 'Suppression...' : 'Supprimer'}
            </button>
          )}
        </div>
      </motion.form>
    </div>
  );
}

// Section "Rendez-vous" affichée dans la fiche patient : liste + changement de statut rapide
function RendezVousSection({ patient, dark, onAddRdv, onEditRdv, onDeleteRdv, onSetStatut }) {
  const rendezVous = [...(patient.rendezVous || [])]
    .map((r, idx) => ({ ...r, _origIndex: idx }))
    .sort((a, b) => toDate(b.date) - toDate(a.date));
  const canManage = !!(onAddRdv || onEditRdv || onDeleteRdv || onSetStatut);

  return (
    <div>
      <div className="flex items-center justify-between border-b pb-1">
        <h4 className={`text-sm font-semibold uppercase tracking-wider ${dark ? 'text-white/40' : 'text-gray-500'}`}>
          Rendez-vous ({rendezVous.length})
        </h4>
        {onAddRdv && (
          <button type="button" onClick={() => onAddRdv(patient)} className="text-xs font-medium hover:underline" style={{ color: C.teal }}>+ Nouveau RDV</button>
        )}
      </div>
      {rendezVous.length === 0 ? (
        <p className={`text-sm mt-3 ${dark ? 'text-white/40' : 'text-gray-400'}`}>Aucun rendez-vous enregistré.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {rendezVous.map((r) => {
            const style = rdvStatutStyle(r.statut);
            const d = daysUntil(r.date);
            return (
              <div key={r._origIndex} className={`p-3 rounded-xl border ${style.border} ${dark ? 'bg-white/5' : style.bg}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className={`text-sm font-medium ${dark ? 'text-white' : 'text-gray-800'}`}>{formatDate(r.date)}</p>
                    {r.motif && <p className={`text-sm mt-0.5 ${dark ? 'text-white/70' : 'text-gray-600'}`}>{r.motif}</p>}
                    {r.notes && <p className={`text-xs mt-1 ${dark ? 'text-white/40' : 'text-gray-400'}`}>{r.notes}</p>}
                    {r.statut === 'Prévu' && d !== null && (
                      <p className={`text-xs mt-1 font-mono ${d < 0 ? 'text-red-500' : 'text-amber-600'}`}>{d < 0 ? `en retard de ${Math.abs(d)}j` : d === 0 ? "aujourd'hui" : `dans ${d}j`}</p>
                    )}
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-lg whitespace-nowrap ${style.bg} ${style.text}`}>{r.statut}</span>
                </div>
                {canManage && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {onSetStatut && r.statut === 'Prévu' && (
                      <>
                        <button type="button" onClick={() => onSetStatut(patient, r._origIndex, 'Effectué')} className="text-xs font-medium px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors">Marquer effectué</button>
                        <button type="button" onClick={() => onSetStatut(patient, r._origIndex, 'Manqué')} className="text-xs font-medium px-2 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors">Marquer manqué</button>
                        <button type="button" onClick={() => onSetStatut(patient, r._origIndex, 'Annulé')} className="text-xs font-medium px-2 py-1 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">Annuler</button>
                      </>
                    )}
                    {onEditRdv && (
                      <button type="button" onClick={() => onEditRdv(patient, r._origIndex)} className={`text-xs font-medium px-2 py-1 rounded-lg border transition-colors ${dark ? 'border-white/20 text-white/70 hover:bg-white/10' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>Modifier</button>
                    )}
                    {onDeleteRdv && (
                      <button type="button" onClick={() => onDeleteRdv(patient, r._origIndex)} className="text-xs font-medium px-2 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors">Supprimer</button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
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
  const [constantePatient, setConstantePatient] = useState(null);
  const [editingConstanteIndex, setEditingConstanteIndex] = useState(null);
  const [detailPatient, setDetailPatient] = useState(null);
  const [formData, setFormData] = useState({
    nom: '', prenom: '', genre: 'Homme', dateNaissance: '', adresse: '',
    assuranceNom: '', assuranceMatricule: '', assuranceNumeroAffilie: '',
    contact1: '', contact2: '',
    allergieMedicamenteuse: 'NON', allergiePrecision: '',
    antecedentMaladie: 'NON', antecedentPrecision: '',
    pathologieChronique: '', traitementChronique: [''],
    tabagisme: 'NON', alcool: 'NON', cafe: 'NON', regimeParticulier: 'NON', regimePrecision: '',
    activitePhysique: 'NON', activitePrecision: '', metier: '',
    notes: ''
  });
  const [isUploading, setIsUploading] = useState(false);
  const [rdvPatient, setRdvPatient] = useState(null);
  const [editingRdvIndex, setEditingRdvIndex] = useState(null);
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
  }, [searchParams]);

  const filteredPatients = patients.filter((p) =>
    (p.nom?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (p.prenom?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (p.contact1 || p.telephone || '').includes(searchTerm)
  );

  // Fonction utilitaire pour créer un gestionnaire de changement avec capitalisation immédiate
  const createCapitalizedChangeHandler = (field) => (e) => {
    const value = e.target.value;
    setFormData(prev => ({
      ...prev,
      [field]: capitalizeSentences(value)
    }));
  };

  const handleRadioChange = (e) => { setFormData({ ...formData, [e.target.name]: e.target.value }); };

  const resetForm = () => {
    setFormData({
      nom: '', prenom: '', genre: 'Homme', dateNaissance: '', adresse: '',
      assuranceNom: '', assuranceMatricule: '', assuranceNumeroAffilie: '',
      contact1: '', contact2: '',
      allergieMedicamenteuse: 'NON', allergiePrecision: '',
      antecedentMaladie: 'NON', antecedentPrecision: '',
      pathologieChronique: '', traitementChronique: [''],
      tabagisme: 'NON', alcool: 'NON', cafe: 'NON', regimeParticulier: 'NON', regimePrecision: '',
      activitePhysique: 'NON', activitePrecision: '', metier: '',
      notes: ''
    });
    setEditingPatient(null);
    setIsModalOpen(false);
    setIsUploading(false);
  };

  const openAddModal = () => { resetForm(); setIsModalOpen(true); };
  const openEditModal = (patient) => {
    setEditingPatient(patient);
    setFormData({
      nom: patient.nom || '', prenom: patient.prenom || '', genre: patient.genre || 'Homme',
      dateNaissance: patient.dateNaissance ? toDate(patient.dateNaissance).toISOString().slice(0, 10) : '',
      adresse: patient.adresse || '',
      assuranceNom: patient.assuranceNom || '',
      assuranceMatricule: patient.assuranceMatricule || '',
      assuranceNumeroAffilie: patient.assuranceNumeroAffilie || '',
      contact1: patient.contact1 || patient.telephone || '', contact2: patient.contact2 || '',
      allergieMedicamenteuse: patient.allergieMedicamenteuse || 'NON',
      allergiePrecision: patient.allergiePrecision || '',
      antecedentMaladie: patient.antecedentMaladie || 'NON',
      antecedentPrecision: patient.antecedentPrecision || '',
      pathologieChronique: patient.pathologieChronique || '',
      traitementChronique: patient.traitementChronique && patient.traitementChronique.length > 0 ? patient.traitementChronique : [''],
      tabagisme: patient.tabagisme || 'NON', alcool: patient.alcool || 'NON', cafe: patient.cafe || 'NON',
      regimeParticulier: patient.regimeParticulier || 'NON', regimePrecision: patient.regimePrecision || '',
      activitePhysique: patient.activitePhysique || 'NON', activitePrecision: patient.activitePrecision || '',
      metier: patient.metier || '',
      notes: patient.notes || ''
    });
    setIsModalOpen(true);
  };

  // Envoi (silencieux, non bloquant) du SMS de bienvenue via l'API SMSGate
  // dès qu'un nouveau patient est enregistré. N'empêche jamais la création
  // du patient de réussir si le SMS échoue (ex : passerelle SMSGate hors
  // ligne) : on prévient juste discrètement le pharmacien dans ce cas.
  const sendWelcomeSms = (patientData) => {
    if (!patientData.contact1) return;
    const apiUrl = import.meta.env.DEV ? 'http://localhost:3000/api/send-sms' : '/api/send-sms';
    fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: patientData.contact1,
        message: `Bonjour ${patientData.prenom}, bienvenue à la Pharmacie Sainte Marie Majeure ! Votre dossier a bien été créé. N'hésitez pas à nous contacter pour toute question. Bonne santé !`,
      }),
    })
      .then((res) => { if (!res.ok) throw new Error('SMS non envoyé'); })
      .catch((err) => {
        console.warn('Envoi du SMS de bienvenue impossible :', err.message);
        push('Patient enregistré, mais le SMS de bienvenue n\'a pas pu être envoyé', 'error');
      });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsUploading(true);
    try {
      // Les données sont déjà capitalisées grâce aux onChange, mais on s'assure une dernière fois
      const patientData = {
        nom: formData.nom, prenom: formData.prenom, genre: formData.genre,
        dateNaissance: formData.dateNaissance ? new Date(formData.dateNaissance).toISOString() : null,
        adresse: formData.adresse,
        assuranceNom: formData.assuranceNom,
        assuranceMatricule: formData.assuranceMatricule,
        assuranceNumeroAffilie: formData.assuranceNumeroAffilie,
        contact1: formData.contact1, contact2: formData.contact2,
        allergieMedicamenteuse: formData.allergieMedicamenteuse,
        allergiePrecision: formData.allergiePrecision,
        antecedentMaladie: formData.antecedentMaladie,
        antecedentPrecision: formData.antecedentPrecision,
        pathologieChronique: formData.pathologieChronique,
        traitementChronique: formData.traitementChronique.filter(m => m.trim() !== ''),
        tabagisme: formData.tabagisme, alcool: formData.alcool, cafe: formData.cafe,
        regimeParticulier: formData.regimeParticulier, regimePrecision: formData.regimePrecision,
        activitePhysique: formData.activitePhysique, activitePrecision: formData.activitePrecision,
        metier: formData.metier,
        notes: formData.notes,
        pharmacienId: user.uid, updatedAt: serverTimestamp()
      };
      if (editingPatient) {
        await updateDoc(doc(db, 'patients', editingPatient.id), patientData);
        push('Patient mis à jour', 'success');
      } else {
        await addDoc(collection(db, 'patients'), { ...patientData, historique: [], constantes: [], rendezVous: [], createdAt: serverTimestamp() });
        push('Patient ajouté', 'success');
        sendWelcomeSms(patientData);
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

  const saveConstante = async (constante) => {
    try {
      if (editingConstanteIndex != null) {
        const freshPatient = patients.find(p => p.id === constantePatient.id) || constantePatient;
        const newConstantes = [...(freshPatient.constantes || [])];
        newConstantes[editingConstanteIndex] = constante;
        await updateDoc(doc(db, 'patients', constantePatient.id), {
          constantes: newConstantes, updatedAt: serverTimestamp()
        });
        push('Mesure mise à jour', 'success');
      } else {
        await updateDoc(doc(db, 'patients', constantePatient.id), {
          constantes: arrayUnion(constante), updatedAt: serverTimestamp()
        });
        push('Mesure enregistrée', 'success');
      }
      setConstantePatient(null);
      setEditingConstanteIndex(null);
    } catch (err) {
      push('Erreur : ' + err.message, 'error');
    }
  };

  const openAddConstante = (patient) => { setConstantePatient(patient); setEditingConstanteIndex(null); };
  const openEditConstante = (patient, idx) => { setConstantePatient(patient); setEditingConstanteIndex(idx); };
  const closeConstanteModal = () => { setConstantePatient(null); setEditingConstanteIndex(null); };

  const deleteConstante = async (patient, idx) => {
    if (!confirm('Supprimer cette mesure ?')) return false;
    try {
      const freshPatient = patients.find(p => p.id === patient.id) || patient;
      const newConstantes = (freshPatient.constantes || []).filter((_, i) => i !== idx);
      await updateDoc(doc(db, 'patients', patient.id), {
        constantes: newConstantes, updatedAt: serverTimestamp()
      });
      push('Mesure supprimée', 'success');
      return true;
    } catch (err) {
      push('Erreur : ' + err.message, 'error');
      return false;
    }
  };

  const saveRdv = async (rdv) => {
    try {
      if (editingRdvIndex != null) {
        const freshPatient = patients.find(p => p.id === rdvPatient.id) || rdvPatient;
        const newRdv = [...(freshPatient.rendezVous || [])];
        newRdv[editingRdvIndex] = rdv;
        await updateDoc(doc(db, 'patients', rdvPatient.id), {
          rendezVous: newRdv, updatedAt: serverTimestamp()
        });
        push('Rendez-vous mis à jour', 'success');
      } else {
        await updateDoc(doc(db, 'patients', rdvPatient.id), {
          rendezVous: arrayUnion(rdv), updatedAt: serverTimestamp()
        });
        push('Rendez-vous enregistré', 'success');
      }
      setRdvPatient(null);
      setEditingRdvIndex(null);
    } catch (err) {
      push('Erreur : ' + err.message, 'error');
    }
  };

  const openAddRdv = (patient) => { setRdvPatient(patient); setEditingRdvIndex(null); };
  const openEditRdv = (patient, idx) => { setRdvPatient(patient); setEditingRdvIndex(idx); };
  const closeRdvModal = () => { setRdvPatient(null); setEditingRdvIndex(null); };

  const deleteRdv = async (patient, idx) => {
    if (!confirm('Supprimer ce rendez-vous ?')) return false;
    try {
      const freshPatient = patients.find(p => p.id === patient.id) || patient;
      const newRdv = (freshPatient.rendezVous || []).filter((_, i) => i !== idx);
      await updateDoc(doc(db, 'patients', patient.id), {
        rendezVous: newRdv, updatedAt: serverTimestamp()
      });
      push('Rendez-vous supprimé', 'success');
      return true;
    } catch (err) {
      push('Erreur : ' + err.message, 'error');
      return false;
    }
  };

  const setRdvStatut = async (patient, idx, statut) => {
    try {
      const freshPatient = patients.find(p => p.id === patient.id) || patient;
      const newRdv = [...(freshPatient.rendezVous || [])];
      newRdv[idx] = { ...newRdv[idx], statut };
      await updateDoc(doc(db, 'patients', patient.id), {
        rendezVous: newRdv, updatedAt: serverTimestamp()
      });
      push(`Rendez-vous marqué « ${statut} »`, 'success');
    } catch (err) {
      push('Erreur : ' + err.message, 'error');
    }
  };

  const handleCall = (telephone) => { if (!telephone) return; window.location.href = `tel:${telephone}`; };
  const handleSms = (telephone, prenom) => { if (!telephone) return; const msg = encodeURIComponent(`Bonjour ${prenom}, la Pharmacie Sainte Marie Majeure vous contacte.`); window.location.href = `sms:${telephone}?body=${msg}`; };
  const sendReminder = (patient) => {
    const num = normalizePhoneForWhatsApp(patient.contact1 || patient.telephone || '');
    if (!num) return;
    const msg = encodeURIComponent(`Bonjour ${patient.prenom}, la Pharmacie Sainte Marie Majeure vous rappelle que le renouvellement de votre traitement est prévu prochainement. N'hésitez pas à passer nous voir. Bonne journée !`);
    window.open(`https://wa.me/${num}?text=${msg}`, '_blank');
  };

  if (loading) return <div className={`p-6 ${dark ? 'text-white/60' : 'text-gray-500'}`}>Chargement des patients...</div>;

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div><h1 className={`font-display text-2xl ${dark ? 'text-white' : 'text-gray-800'}`}>Gestion des patients</h1><p className={`text-sm ${dark ? 'text-white/50' : 'text-gray-500'}`}>{filteredPatients.length} patient(s)</p></div>
        <button onClick={openAddModal} className="flex items-center gap-2 text-white px-4 py-2 rounded-lg transition-transform hover:scale-[1.02]" style={{ background: C.teal }}><UserPlusIcon className="h-5 w-5" /> Ajouter un patient</button>
      </div>
      <div className="relative mb-4">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input ref={searchInputRef} type="text" placeholder="Rechercher par nom, prénom ou téléphone..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 outline-none ${dark ? 'bg-[#0F2E29] border-white/10 text-white placeholder:text-white/30' : 'border-gray-300 bg-white'}`} />
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
            const prochainRdv = nextRendezVous(patient.rendezVous);
            const renouvJours = prochainRdv ? daysUntil(prochainRdv.date) : null;
            const renouvUrgent = renouvJours !== null && renouvJours <= 7;
            const contact = patient.contact1 || patient.telephone;
            return (
              <div key={patient.id} className="p-4 rounded-xl transition-shadow hover:shadow-md" style={{ background: dark ? C.cardDark : C.card, border: `1px solid ${renouvUrgent ? C.amber + '55' : (dark ? '#ffffff14' : '#00000010')}` }}>
                <div className="flex items-start justify-between">
                  <button onClick={() => setDetailPatient(patient)} className="flex-1 text-left">
                    <h3 className={`font-semibold ${dark ? 'text-white' : 'text-gray-800'}`}>{patient.prenom} {patient.nom}</h3>
                    {contact && <span className="text-sm text-green-600 flex items-center gap-1 mt-1"><PhoneIcon className="h-4 w-4" /> {contact}</span>}
                    {patient.allergieMedicamenteuse === 'OUI' && patient.allergiePrecision && <p className="text-xs text-red-600 mt-1">Allergie : {patient.allergiePrecision}</p>}
                    {patient.pathologieChronique && <p className="text-xs text-amber-600 mt-1">Pathologie : {patient.pathologieChronique}</p>}
                    {patient.metier && <p className="text-xs text-gray-600 mt-1">Métier : {patient.metier}</p>}
                    <p className={`text-xs mt-1 flex items-center gap-1 ${dark ? 'text-white/40' : 'text-gray-400'}`}><ClockIcon className="h-3.5 w-3.5" /> {(patient.historique || []).length} consultation(s) — voir détail</p>
                  </button>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openEditModal(patient)} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors" title="Modifier"><PencilSquareIcon className="h-5 w-5" /></button>
                    <button onClick={() => handleDelete(patient.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors" title="Supprimer"><TrashIcon className="h-5 w-5" /></button>
                  </div>
                </div>
                {prochainRdv && (
                  <div className={`mt-2 flex flex-wrap items-center gap-2 text-xs px-2 py-1.5 rounded-lg ${renouvUrgent ? 'bg-amber-50 text-amber-700' : (dark ? 'text-white/40' : 'text-gray-400')}`}>
                    <span className="flex items-center gap-1"><CalendarDaysIcon className="h-3.5 w-3.5" />{renouvJours < 0 ? `RDV en retard de ${Math.abs(renouvJours)}j` : renouvJours === 0 ? "RDV aujourd'hui" : `RDV dans ${renouvJours}j`}{prochainRdv.motif ? ` — ${prochainRdv.motif}` : ''}</span>
                    <button onClick={() => setRdvStatut(patient, patient.rendezVous.indexOf(prochainRdv), 'Effectué')} className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors">Effectué</button>
                    <button onClick={() => setRdvStatut(patient, patient.rendezVous.indexOf(prochainRdv), 'Manqué')} className="px-1.5 py-0.5 rounded bg-red-100 text-red-600 hover:bg-red-200 transition-colors">Manqué</button>
                  </div>
                )}
                <div className="flex flex-wrap gap-1 mt-3">
                  <button onClick={() => setVisitPatient(patient)} className="flex-1 text-xs font-medium py-1.5 rounded-lg border transition-colors" style={{ borderColor: C.teal + '55', color: C.teal }}>+ Consultation</button>
                  <button onClick={() => openAddRdv(patient)} className="flex-1 text-xs font-medium py-1.5 rounded-lg border transition-colors" style={{ borderColor: C.amber + '55', color: C.amber }}>+ RDV</button>
                  <button onClick={() => openAddConstante(patient)} className="flex-1 text-xs font-medium py-1.5 rounded-lg border transition-colors" style={{ borderColor: C.sage + '55', color: C.sage }}>+ Constante</button>
                  {contact && (
                    <>
                      <button onClick={() => handleCall(contact)} className="flex-1 text-xs font-medium py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors flex items-center justify-center gap-1"><PhoneIcon className="h-3 w-3" /> Appeler</button>
                      <button onClick={() => handleSms(contact, patient.prenom)} className="flex-1 text-xs font-medium py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors flex items-center justify-center gap-1"><ChatBubbleLeftRightIcon className="h-3 w-3" /> SMS</button>
                      {renouvUrgent && <button onClick={() => sendReminder(patient)} className="flex-1 text-xs font-medium py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1"><ChatBubbleLeftRightIcon className="h-3 w-3" /> WhatsApp</button>}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <AnimatePresence>
        {detailPatient && (
          <PatientDetailDrawer
            patient={patients.find(p => p.id === detailPatient.id) || detailPatient}
            onClose={() => setDetailPatient(null)}
            dark={dark}
            onEditConstante={openEditConstante}
            onDeleteConstante={deleteConstante}
            onAddRdv={openAddRdv}
            onEditRdv={openEditRdv}
            onDeleteRdv={(patient, idx) => deleteRdv(patient, idx)}
            onSetRdvStatut={setRdvStatut}
          />
        )}
      </AnimatePresence>
      {detailPatient && <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setDetailPatient(null)} />}
      {visitPatient && <VisitModal patient={visitPatient} onClose={() => setVisitPatient(null)} onSave={saveVisit} />}
      {rdvPatient && (
        <RendezVousModal
          patient={rdvPatient}
          initialData={editingRdvIndex != null ? (patients.find(p => p.id === rdvPatient.id) || rdvPatient).rendezVous?.[editingRdvIndex] : null}
          onClose={closeRdvModal}
          onSave={saveRdv}
          onDelete={editingRdvIndex != null ? async () => { const ok = await deleteRdv(rdvPatient, editingRdvIndex); if (ok) closeRdvModal(); } : null}
        />
      )}
      {constantePatient && (
        <ConstanteModal
          patient={constantePatient}
          initialData={editingConstanteIndex != null ? (patients.find(p => p.id === constantePatient.id) || constantePatient).constantes?.[editingConstanteIndex] : null}
          onClose={closeConstanteModal}
          onSave={saveConstante}
          onDelete={editingConstanteIndex != null ? async () => { const ok = await deleteConstante(constantePatient, editingConstanteIndex); if (ok) closeConstanteModal(); } : null}
        />
      )}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-display text-xl text-gray-800">{editingPatient ? 'Modifier le patient' : 'Ajouter un patient'}</h2>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="h-6 w-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="border-b border-gray-200 pb-4">
                <h3 className="font-display text-lg text-gray-800 mb-3">I. Données administratives</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Nom *</label>
                    <input
                      type="text" name="nom" value={formData.nom}
                      onChange={createCapitalizedChangeHandler('nom')}
                      className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Prénom(s) *</label>
                    <input
                      type="text" name="prenom" value={formData.prenom}
                      onChange={createCapitalizedChangeHandler('prenom')}
                      className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none"
                      required
                    />
                  </div>
                </div>
                <div className="mt-3"><label className="block text-sm font-medium text-gray-700">Genre</label><div className="flex gap-4 mt-1"><label className="flex items-center gap-1"><input type="radio" name="genre" value="Homme" checked={formData.genre === 'Homme'} onChange={handleRadioChange} /> Homme</label><label className="flex items-center gap-1"><input type="radio" name="genre" value="Femme" checked={formData.genre === 'Femme'} onChange={handleRadioChange} /> Femme</label></div></div>
                <div className="mt-3"><label className="block text-sm font-medium text-gray-700">Date de naissance</label><input type="date" name="dateNaissance" value={formData.dateNaissance} onChange={handleRadioChange} className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none" /></div>
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700">Adresse</label>
                  <input
                    type="text" name="adresse" value={formData.adresse}
                    onChange={createCapitalizedChangeHandler('adresse')}
                    className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none"
                  />
                </div>
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700">Assurance</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-1">
                    <input
                      type="text" name="assuranceNom" value={formData.assuranceNom}
                      onChange={createCapitalizedChangeHandler('assuranceNom')}
                      placeholder="Nom (ex: CMU)"
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none"
                    />
                    <input
                      type="text" name="assuranceMatricule" value={formData.assuranceMatricule}
                      onChange={createCapitalizedChangeHandler('assuranceMatricule')}
                      placeholder="Matricule"
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none"
                    />
                    <input
                      type="text" name="assuranceNumeroAffilie" value={formData.assuranceNumeroAffilie}
                      onChange={createCapitalizedChangeHandler('assuranceNumeroAffilie')}
                      placeholder="N° affilié"
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                  <div><label className="block text-sm font-medium text-gray-700">Contact 1 *</label><input type="tel" name="contact1" value={formData.contact1} onChange={handleRadioChange} className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none" required /></div>
                  <div><label className="block text-sm font-medium text-gray-700">Contact 2</label><input type="tel" name="contact2" value={formData.contact2} onChange={handleRadioChange} className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none" /></div>
                </div>
              </div>
              <div className="border-b border-gray-200 pb-4">
                <h3 className="font-display text-lg text-gray-800 mb-3">II. Données médicales</h3>
                <div><label className="block text-sm font-medium text-gray-700">Allergies connues et intolérances</label><div className="flex gap-4 mt-1"><label className="flex items-center gap-1"><input type="radio" name="allergieMedicamenteuse" value="OUI" checked={formData.allergieMedicamenteuse === 'OUI'} onChange={handleRadioChange} /> OUI</label><label className="flex items-center gap-1"><input type="radio" name="allergieMedicamenteuse" value="NON" checked={formData.allergieMedicamenteuse === 'NON'} onChange={handleRadioChange} /> NON</label></div>
                  {formData.allergieMedicamenteuse === 'OUI' && (
                    <div className="mt-2">
                      <label className="block text-sm font-medium text-gray-700">À préciser</label>
                      <input
                        type="text" name="allergiePrecision" value={formData.allergiePrecision}
                        onChange={createCapitalizedChangeHandler('allergiePrecision')}
                        className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none"
                        placeholder="ex : Pénicilline"
                      />
                    </div>
                  )}
                </div>
                <div className="mt-3"><label className="block text-sm font-medium text-gray-700">Status particulier (asthme, insuffisance rénale)</label><div className="flex gap-4 mt-1"><label className="flex items-center gap-1"><input type="radio" name="antecedentMaladie" value="OUI" checked={formData.antecedentMaladie === 'OUI'} onChange={handleRadioChange} /> OUI</label><label className="flex items-center gap-1"><input type="radio" name="antecedentMaladie" value="NON" checked={formData.antecedentMaladie === 'NON'} onChange={handleRadioChange} /> NON</label></div>
                  {formData.antecedentMaladie === 'OUI' && (
                    <div className="mt-2">
                      <label className="block text-sm font-medium text-gray-700">À préciser</label>
                      <input
                        type="text" name="antecedentPrecision" value={formData.antecedentPrecision}
                        onChange={createCapitalizedChangeHandler('antecedentPrecision')}
                        className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none"
                        placeholder="ex : Diabète, HTA..."
                      />
                    </div>
                  )}
                </div>
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700">Pathologie chronique</label>
                  <input
                    type="text" name="pathologieChronique" value={formData.pathologieChronique}
                    onChange={createCapitalizedChangeHandler('pathologieChronique')}
                    className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none"
                    placeholder="ex : Diabète, HTA..."
                  />
                </div>
                <div className="mt-3"><label className="block text-sm font-medium text-gray-700">Traitement chronique</label>
                  <div className="space-y-2 mt-1">
                    {formData.traitementChronique.map((med, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={med}
                          onChange={(e) => {
                            const newList = [...formData.traitementChronique];
                            newList[index] = capitalizeSentences(e.target.value);
                            setFormData({ ...formData, traitementChronique: newList });
                          }}
                          placeholder={`Médicament ${index + 1}`}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newList = formData.traitementChronique.filter((_, i) => i !== index);
                            setFormData({ ...formData, traitementChronique: newList.length ? newList : [''] });
                          }}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <XMarkIcon className="h-5 w-5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, traitementChronique: [...formData.traitementChronique, ''] })}
                      className="text-sm text-teal-600 hover:underline"
                    >
                      + Ajouter un médicament
                    </button>
                  </div>
                </div>
              </div>
              <div className="border-b border-gray-200 pb-4">
                <h3 className="font-display text-lg text-gray-800 mb-3">III. Mode de vie</h3>
                {['tabagisme', 'alcool', 'cafe', 'regimeParticulier', 'activitePhysique'].map((field) => {
                  const label = field === 'regimeParticulier' ? 'Régime particulier' : field === 'activitePhysique' ? 'Activité physique' : field.charAt(0).toUpperCase() + field.slice(1);
                  return (
                    <div key={field} className="mt-3">
                      <label className="block text-sm font-medium text-gray-700">{label}</label>
                      <div className="flex gap-4 mt-1">
                        <label className="flex items-center gap-1"><input type="radio" name={field} value="OUI" checked={formData[field] === 'OUI'} onChange={handleRadioChange} /> OUI</label>
                        <label className="flex items-center gap-1"><input type="radio" name={field} value="NON" checked={formData[field] === 'NON'} onChange={handleRadioChange} /> NON</label>
                      </div>
                      {field === 'regimeParticulier' && formData.regimeParticulier === 'OUI' && (
                        <div className="mt-2">
                          <label className="block text-sm font-medium text-gray-700">Préciser</label>
                          <input
                            type="text" name="regimePrecision" value={formData.regimePrecision}
                            onChange={createCapitalizedChangeHandler('regimePrecision')}
                            className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none"
                            placeholder="ex : Sans sel, végétarien..."
                          />
                        </div>
                      )}
                      {field === 'activitePhysique' && formData.activitePhysique === 'OUI' && (
                        <div className="mt-2">
                          <label className="block text-sm font-medium text-gray-700">Préciser</label>
                          <input
                            type="text" name="activitePrecision" value={formData.activitePrecision}
                            onChange={createCapitalizedChangeHandler('activitePrecision')}
                            className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none"
                            placeholder="ex : 3x/semaine, marche..."
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700">Métier</label>
                  <input
                    type="text" name="metier" value={formData.metier}
                    onChange={createCapitalizedChangeHandler('metier')}
                    className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none"
                    placeholder="ex : Enseignant, Commerçant..."
                  />
                </div>
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700">NB (remarques générales)</label>
                  <textarea
                    name="notes" value={formData.notes}
                    onChange={createCapitalizedChangeHandler('notes')}
                    rows="3"
                    className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none"
                    placeholder="Informations complémentaires..."
                  />
                </div>
              </div>
              <div className="text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                Les rendez-vous (planification, statut effectué/manqué/annulé) se gèrent désormais depuis la fiche détail du patient, bouton « + Nouveau RDV ». L'ordonnance s'ajoute lors de chaque consultation.
              </div>
              {isUploading && <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden"><motion.div initial={{ width: '10%' }} animate={{ width: '90%' }} transition={{ duration: 1.2 }} className="h-2.5 rounded-full" style={{ background: C.teal }} /></div>}
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={isUploading} className={`flex-1 text-white font-semibold py-2.5 rounded-lg transition-colors ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`} style={{ background: C.teal }}>{isUploading ? 'Envoi...' : editingPatient ? 'Mettre à jour' : 'Ajouter'}</button>
                <button type="button" onClick={resetForm} className="flex-1 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2.5 rounded-lg transition-colors">Annuler</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// === Rendu markdown compact pour les bulles du chat assistant ===
function ChatMarkdown({ content, dark, isUser }) {
  const linkColor = isUser ? '#FFFFFF' : C.teal;
  const subtleBg = dark ? 'bg-black/25' : 'bg-black/5';
  const subtleBorder = dark ? 'border-white/10' : 'border-gray-200';

  return (
    <div className="text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-2 whitespace-pre-wrap">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-0.5">{children}</ol>,
          li: ({ children }) => <li className="leading-snug">{children}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 font-medium"
              style={{ color: linkColor }}
            >
              {children}
            </a>
          ),
          h1: ({ children }) => <p className="font-display text-base font-semibold mb-1.5">{children}</p>,
          h2: ({ children }) => <p className="font-display text-base font-semibold mb-1.5">{children}</p>,
          h3: ({ children }) => <p className="font-semibold mb-1">{children}</p>,
          blockquote: ({ children }) => (
            <blockquote className={`border-l-2 pl-3 my-2 italic opacity-90 ${subtleBorder}`}>{children}</blockquote>
          ),
          hr: () => <hr className={`my-2 ${subtleBorder}`} />,
          code: ({ inline, children }) =>
            inline ? (
              <code className={`px-1 py-0.5 rounded text-[0.8em] font-mono ${subtleBg}`}>{children}</code>
            ) : (
              <pre className={`rounded-lg p-3 my-2 overflow-x-auto text-xs font-mono ${subtleBg}`}>
                <code>{children}</code>
              </pre>
            ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-2">
              <table className="text-xs border-collapse w-full">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className={`border px-2 py-1 text-left font-semibold ${subtleBorder}`}>{children}</th>,
          td: ({ children }) => <td className={`border px-2 py-1 ${subtleBorder}`}>{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// Extrait le prénom depuis le displayName Firebase ("Dr. Prenom Nom" -> "Prenom")
function getPharmacienFirstName(user) {
  if (!user) return null;
  const raw = user.displayName || '';
  const withoutTitle = raw.replace(/^Dr\.?\s*/i, '').trim();
  if (withoutTitle) return withoutTitle.split(/\s+/)[0];
  if (user.email) return user.email.split('@')[0];
  return null;
}

function executeAction(action, params, context) {
  const { navigate, patients, setDetailPatient } = context;

  switch (action) {
    case 'searchPatient':
      if (params.query && params.query.trim() !== '') {
        navigate('/patients?focus=search');
        return `🔍 Recherche lancée pour "${params.query}"`;
      } else {
        return '🔍 Veuillez me donner le nom du patient que vous souhaitez rechercher.';
      }

    case 'showPatient':
      if (params.patientId) {
        const patient = patients.find(p => p.id === params.patientId);
        if (patient) {
          setDetailPatient(patient);
          return `📋 Voici la fiche de ${patient.prenom} ${patient.nom}`;
        }
        return `❌ Patient non trouvé avec l'ID ${params.patientId}`;
      }
      if (params.name) {
        const found = patients.filter(p =>
          p.nom.toLowerCase().includes(params.name.toLowerCase()) ||
          p.prenom.toLowerCase().includes(params.name.toLowerCase())
        );
        if (found.length === 1) {
          setDetailPatient(found[0]);
          return `📋 Voici la fiche de ${found[0].prenom} ${found[0].nom}`;
        } else if (found.length > 1) {
          return `🔍 Plusieurs patients correspondent : ${found.map(p => p.prenom + ' ' + p.nom).join(', ')}`;
        }
        return `❌ Aucun patient trouvé pour "${params.name}"`;
      }
      return '❌ Veuillez préciser un patient (nom ou ID)';

    default:
      return `❌ Action "${action}" non reconnue.`;
  }
}

function AssistantPage() {
  const { dark } = useUIStore();
  const { push } = useToastStore();
  const navigate = useNavigate();
  const { user } = useAuth();

  const pharmacienName = getPharmacienFirstName(user);

  const [patients, setPatients] = useState([]);
  const [detailPatient, setDetailPatient] = useState(null);

  const savedMessages = localStorage.getItem('vignon_chat_messages');
  const initialMessages = savedMessages
    ? JSON.parse(savedMessages)
    : [
        {
          role: 'assistant',
          content: `Bonjour Dr.${pharmacienName ? ` ${pharmacienName}` : ''}, je suis Vignon, votre assistant médical. Je peux rechercher des patients et afficher leurs fiches, et répondre à vos questions générales — au besoin en cherchant sur internet des informations à jour. Que puis-je faire pour vous ?`,
        },
      ];

  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // === Résumé progressif de l'historique (économie de tokens) ===
  // `summary` condense tout ce qui précède `summarizedCount` messages.
  // Seuls les messages APRÈS ce point, plus le résumé, sont envoyés à l'API :
  // le reste de l'historique reste visible à l'écran mais ne coûte plus rien.
  const [summary, setSummary] = useState(() => localStorage.getItem('vignon_chat_summary') || '');
  const [summarizedCount, setSummarizedCount] = useState(
    () => parseInt(localStorage.getItem('vignon_chat_summarized_count') || '0', 10)
  );
  const SUMMARY_TRIGGER = 12; // au-delà de ce nb de messages non résumés, on condense
  const KEEP_RECENT = 6; // nb de messages bruts toujours conservés tels quels

  const chatContainerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'patients'), where('pharmacienId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setPatients(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    localStorage.setItem('vignon_chat_messages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('vignon_chat_summary', summary);
    localStorage.setItem('vignon_chat_summarized_count', String(summarizedCount));
  }, [summary, summarizedCount]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const MODEL = 'mistral-medium-latest';
  const isDev = import.meta.env.DEV;

  const sendToAssistant = async (messages, conversationSummary) => {
    const apiUrl = isDev
      ? 'http://localhost:3000/api/assistant'
      : '/api/assistant';
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        model: MODEL,
        displayName: pharmacienName,
        previousSummary: conversationSummary || undefined,
      }),
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(error);
    }
    return response.json();
  };

  // Appel caché qui condense un lot de vieux messages (+ résumé existant
  // éventuel) en un résumé court, via un modèle moins cher côté serveur.
  const summarizeOldMessages = async (batch, existingSummary) => {
    const apiUrl = isDev
      ? 'http://localhost:3000/api/assistant'
      : '/api/assistant';
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summarize: true,
        messages: batch,
        previousSummary: existingSummary || undefined,
      }),
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(error);
    }
    const data = await response.json();
    return data.summary;
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg = input.trim();
    setInput('');
    const updatedMessages = [...messages, { role: 'user', content: userMsg }];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      // Historique pas encore condensé (ce qui suit `summarizedCount`)
      let currentSummary = summary;
      let currentSummarizedCount = summarizedCount;
      const notYetSummarized = updatedMessages.slice(currentSummarizedCount);

      // Si ça dépasse le seuil, on condense tout sauf les derniers messages
      // (qu'on garde bruts pour ne pas perdre le fil immédiat de l'échange).
      if (notYetSummarized.length > SUMMARY_TRIGGER) {
        const toArchive = notYetSummarized.slice(0, notYetSummarized.length - KEEP_RECENT);
        if (toArchive.length > 0) {
          try {
            const newSummary = await summarizeOldMessages(toArchive, currentSummary);
            if (newSummary) {
              currentSummary = newSummary;
              currentSummarizedCount += toArchive.length;
              setSummary(currentSummary);
              setSummarizedCount(currentSummarizedCount);
            }
          } catch (summaryError) {
            // Si le résumé échoue, on continue avec l'historique complet
            // cette fois-ci plutôt que de bloquer la conversation.
            console.warn('Résumé de conversation impossible :', summaryError);
          }
        }
      }

      const windowMessages = updatedMessages.slice(currentSummarizedCount);
      const response = await sendToAssistant(windowMessages, currentSummary);
      let assistantContent = response.content;
      let action = response.action;

      if (action) {
        const context = {
          push,
          navigate,
          patients,
          setDetailPatient,
        };
        const actionResult = executeAction(action.type, action.params, context);
        assistantContent += `\n\n${actionResult}`;
      }

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: assistantContent },
      ]);
    } catch (error) {
      console.error('Erreur assistant:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '❌ Désolé, une erreur est survenue. Veuillez réessayer.',
        },
      ]);
      push('Erreur de communication avec l\'assistant', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewConversation = () => {
    if (messages.length > 1 && !confirm('Voulez-vous vraiment effacer cette conversation ?')) return;
    const welcomeMessage = {
      role: 'assistant',
      content: `Bonjour${pharmacienName ? ` ${pharmacienName}` : ''}, je suis Vignon, votre assistant médical. Je peux rechercher des patients et afficher leurs fiches, et répondre à vos questions générales — au besoin en cherchant sur internet des informations à jour. Que puis-je faire pour vous ?`,
    };
    setMessages([welcomeMessage]);
    localStorage.setItem('vignon_chat_messages', JSON.stringify([welcomeMessage]));
    setSummary('');
    setSummarizedCount(0);
    localStorage.removeItem('vignon_chat_summary');
    localStorage.removeItem('vignon_chat_summarized_count');
    setInput('');
  };

  return (
    <div className="p-4 md:p-6 h-full flex flex-col" style={{ maxHeight: 'calc(100vh - 80px)' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <SparklesIcon className="h-6 w-6" style={{ color: C.amber }} />
          <h1 className={`font-display text-2xl ${dark ? 'text-white' : 'text-gray-800'}`}>Vignon</h1>
        </div>
        <button
          onClick={handleNewConversation}
          className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
            dark
              ? 'border-white/20 text-white/70 hover:bg-white/10'
              : 'border-gray-300 text-gray-600 hover:bg-gray-100'
          }`}
        >
          Nouvelle conversation
        </button>
      </div>

      <div
        ref={chatContainerRef}
        className={`flex-1 overflow-y-auto rounded-xl p-4 space-y-4 ${dark ? 'bg-[#0F2E29] border border-white/10' : 'bg-white border border-gray-200'}`}
        style={{ minHeight: '300px' }}
      >
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] sm:max-w-[75%] px-4 py-2.5 rounded-2xl ${
                msg.role === 'user'
                  ? dark
                    ? 'bg-teal-700 text-white'
                    : 'bg-teal-500 text-white'
                  : dark
                  ? 'bg-gray-700 text-gray-200'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              <ChatMarkdown content={msg.content} dark={dark} isUser={msg.role === 'user'} />
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className={`px-4 py-2 rounded-2xl ${dark ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <div className="flex items-center gap-2">
                <ArrowPathIcon className="h-4 w-4 animate-spin text-teal-500" />
                <span className="text-sm text-gray-500">Vignon réfléchit...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Posez une question ou donnez une instruction..."
          className={`flex-1 px-4 py-2 rounded-lg border focus:ring-2 outline-none ${
            dark
              ? 'bg-[#0F2E29] border-white/10 text-white placeholder:text-white/30'
              : 'bg-white border-gray-300'
          }`}
          disabled={isLoading}
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          className={`px-4 py-2 rounded-lg text-white font-medium transition-colors ${
            isLoading || !input.trim() ? 'opacity-50 cursor-not-allowed' : 'hover:bg-opacity-80'
          }`}
          style={{ background: C.teal }}
        >
          <PaperAirplaneIcon className="h-5 w-5" />
        </button>
      </div>

      {detailPatient && (
        <PatientDetailDrawer
          patient={patients.find((p) => p.id === detailPatient.id) || detailPatient}
          onClose={() => setDetailPatient(null)}
          dark={dark}
        />
      )}
      {detailPatient && <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setDetailPatient(null)} />}
    </div>
  );
}

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

function LayoutWithSidebar({ children }) {
  const { dark, paletteOpen, setPaletteOpen } = useUIStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className={`min-h-screen flex ${dark ? 'bg-[#0A1F1C]' : 'bg-[#F6F3EC]'}`}>
      <GlobalStyle />
      <ToastStack />
      <CommandPalette />
      <div className="hidden md:block"><Sidebar /></div>
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