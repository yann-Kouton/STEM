// Rôles et permissions du personnel — module autonome, sans dépendance Firestore.
import { SUPER_ADMIN_EMAILS as CONFIG_ADMIN_EMAILS } from '../config.local';

export const ROLES = {
  DR_PRINCIPAL: 'dr_principal',
  DR_DELEGUE: 'dr_delegue',
  PHARMACIEN: 'pharmacien',
  AUXILIAIRE: 'auxiliaire',
  COMPTABLE: 'comptable',
};

export const ROLE_LABELS = {
  [ROLES.DR_PRINCIPAL]: 'Docteur Principal',
  [ROLES.DR_DELEGUE]: 'Docteur Délégué',
  [ROLES.PHARMACIEN]: 'Pharmacien',
  [ROLES.AUXILIAIRE]: 'Auxiliaire',
  [ROLES.COMPTABLE]: 'Comptable',
};

export const ROLE_ORDER = [
  ROLES.DR_PRINCIPAL,
  ROLES.DR_DELEGUE,
  ROLES.PHARMACIEN,
  ROLES.AUXILIAIRE,
  ROLES.COMPTABLE,
];

// Rôles ayant accès à l'interface clinique actuelle (dashboard, patients, IA, stats)
export const CLINICAL_ROLES = [ROLES.DR_PRINCIPAL, ROLES.DR_DELEGUE, ROLES.PHARMACIEN];

// Rôles pouvant consulter les remarques anonymes / superviser
export const REVIEWER_ROLES = [ROLES.DR_PRINCIPAL, ROLES.DR_DELEGUE];

export function isClinicalRole(role) {
  return CLINICAL_ROLES.includes(role);
}

export function isReviewerRole(role) {
  return REVIEWER_ROLES.includes(role);
}

export function isSuperAdmin(role) {
  return role === ROLES.DR_PRINCIPAL;
}

export function roleLabel(role) {
  return ROLE_LABELS[role] || 'Employé';
}

// Route d'atterrissage par défaut selon le rôle après connexion
export function defaultRouteForRole(role) {
  if (isClinicalRole(role)) return '/dashboard';
  if (role === ROLES.COMPTABLE) return '/rapports';
  return '/reclamations';
}

// --- Super admin (Docteur Principal) contrôlé par liste blanche d'emails ---
// Définie dans src/config.local.js (non versionné — voir config.local.example.js).
// Seuls ces comptes peuvent devenir / rester Docteur Principal automatiquement ;
// toute autre attribution du rôle se fait ensuite manuellement depuis le
// panneau d'administration.
const SUPER_ADMIN_EMAILS = (CONFIG_ADMIN_EMAILS || [])
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isSuperAdminEmail(email) {
  return !!email && SUPER_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

export function determineDefaultRole(email) {
  return isSuperAdminEmail(email) ? ROLES.DR_PRINCIPAL : ROLES.PHARMACIEN;
}

// --- Notification sonore (bip généré, sans fichier audio) -------------

export function playNotificationSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const playTone = (freq, start, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration + 0.05);
    };
    playTone(880, 0, 0.15);
    playTone(1180, 0.16, 0.2);
    setTimeout(() => ctx.close(), 800);
  } catch {
    // Environnement sans audio (ex: SSR) : on ignore silencieusement.
  }
}

export const STATUT_LABELS = {
  en_attente: 'En attente',
  approuvee: 'Approuvée',
  refusee: 'Refusée',
  ouverte: 'Ouverte',
  traitee: 'Traitée',
};

export const TYPES_PERMISSION = [
  'Congé',
  'Absence exceptionnelle',
  "Accès / matériel",
  'Autre',
];
