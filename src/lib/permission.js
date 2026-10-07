// Utilitaires du formulaire papier « Demande de permission »
import { roleLabel } from './personnel';

const pad = (n) => String(n).padStart(2, '0');

// Date du jour au format YYYY-MM-DD (fuseau local, compatible <input type="date">)
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// 2026-09-21 -> 21/09/2026
export function formatDateFR(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function parseISO(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null;
}

// « Nombre de jours … inclus » : du et au sont comptés.
export function joursInclus(du, au) {
  const a = parseISO(du);
  const b = parseISO(au);
  if (a == null || b == null || b < a) return null;
  return Math.round((b - a) / 86400000) + 1;
}

function toMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
  return m ? +m[1] * 60 + +m[2] : null;
}

// Durée en minutes entre deux heures HH:MM (null si incohérent)
export function minutesEntre(debut, fin) {
  const a = toMinutes(debut);
  const b = toMinutes(fin);
  if (a == null || b == null || b <= a) return null;
  return b - a;
}

// 150 -> « 2h30 », 120 -> « 2h »
export function formatDuree(minutes) {
  if (minutes == null) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h${pad(m)}` : `${h}h`;
}

// « 08:05 » -> ['08', '05']
export function splitHM(t) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t || '');
  return m ? [pad(+m[1]), m[2]] : ['', ''];
}

// Devine nom / prénoms depuis le displayName quand la convention est lisible :
// « KOUASSI Jean Marc » -> nom « KOUASSI », prénoms « Jean Marc ».
// Sans mot en majuscules on ne peut pas savoir quel mot est le nom : on laisse vide
// plutôt que de préremplir faux (le choix est ensuite mémorisé sur le profil).
export function splitNomComplet(displayName = '') {
  const tokens = displayName.trim().split(/\s+/).filter(Boolean);
  const caps = tokens.filter((t) => t.length > 1 && t === t.toUpperCase() && /[A-ZÀ-Ý]/.test(t));
  if (caps.length && caps.length < tokens.length) {
    return { nom: caps.join(' '), prenoms: tokens.filter((t) => !caps.includes(t)).join(' ') };
  }
  return { nom: '', prenoms: '' };
}

// Rend homogène une demande, y compris les anciennes (type + message) créées
// avant l'arrivée du formulaire.
export function normaliserDemande(d) {
  return {
    ...d,
    nom: d.nom ?? d.employeNom ?? '',
    prenoms: d.prenoms ?? '',
    fonction: d.fonction ?? roleLabel(d.role),
    motifs: d.motifs ?? [d.type, d.message].filter(Boolean).join(' — '),
  };
}

// Résumé d'une ligne pour les listes
export function resumePeriode(d) {
  const parts = [];
  if (d.jours) {
    const n = d.jours.nombre;
    parts.push(
      d.jours.du === d.jours.au
        ? `${n} jour · le ${formatDateFR(d.jours.du)}`
        : `${n} jour${n > 1 ? 's' : ''} · du ${formatDateFR(d.jours.du)} au ${formatDateFR(d.jours.au)}`,
    );
  }
  if (d.heures) {
    parts.push(`${formatDuree(d.heures.minutes)} le ${formatDateFR(d.heures.date)} (${d.heures.debut} – ${d.heures.fin})`);
  }
  return parts.join(' + ') || d.type || 'Demande de permission';
}
