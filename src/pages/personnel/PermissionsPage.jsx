import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where,
} from 'firebase/firestore';
import {
  ClipboardDocumentCheckIcon, PlusIcon, PrinterIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useEmployee } from '../../context/EmployeeContext';
import { C, useUIStore, useToastStore } from '../../lib/theme';
import { STATUT_LABELS } from '../../lib/personnel';
import { formatDateFR, normaliserDemande, resumePeriode, todayISO } from '../../lib/permission';
import PermissionForm from '../../components/personnel/PermissionForm';
import PermissionSheet, { INK } from '../../components/personnel/PermissionSheet';
import SignaturePad from '../../components/personnel/SignaturePad';

const millis = (item) => (item.createdAt?.toMillis ? item.createdAt.toMillis() : Number.MAX_SAFE_INTEGER);

function StatutBadge({ statut }) {
  const tone = statut === 'approuvee' ? C.sage : statut === 'refusee' ? C.clay : C.amber;
  return (
    <span
      className="flex-shrink-0 rounded-full px-2 py-1 font-mono text-[10px] uppercase tracking-wide"
      style={{ background: `${tone}22`, color: tone }}
    >
      {STATUT_LABELS[statut] || statut}
    </span>
  );
}

function RequestCard({ item, dark, showAuthor, onOpen }) {
  const d = normaliserDemande(item);
  const auteur = [d.prenoms, d.nom].filter(Boolean).join(' ') || d.employeNom;
  return (
    <button
      type="button" onClick={() => onOpen(item)}
      className="w-full rounded-2xl p-4 text-left transition-shadow hover:shadow-md"
      style={{ background: dark ? C.cardDark : C.card, border: `1px solid ${dark ? '#ffffff14' : '#00000010'}` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${dark ? 'text-white' : 'text-gray-800'}`}>{resumePeriode(d)}</p>
          <p className={`mt-1 line-clamp-2 text-sm ${dark ? 'text-white/70' : 'text-gray-600'}`}>{d.motifs}</p>
          <p className={`mt-2 text-xs ${dark ? 'text-white/40' : 'text-gray-400'}`}>
            {showAuthor && <>{auteur} · {d.fonction} · </>}
            Demande du {formatDateFR(d.dateDemande) || (d.createdAt?.toDate ? d.createdAt.toDate().toLocaleDateString('fr-FR') : '')}
          </p>
        </div>
        <StatutBadge statut={d.statut} />
      </div>
    </button>
  );
}

// Le Docteur saisit sa décision directement dans la zone « DECISION DU DOCTEUR » de la fiche.
function DecisionEditor({ item, onDone }) {
  const { user } = useAuth();
  const { employee } = useEmployee();
  const push = useToastStore((s) => s.push);
  const [accord, setAccord] = useState(null);
  const [docteurNom, setDocteurNom] = useState(employee?.displayName || user?.displayName || '');
  const [date, setDate] = useState(todayISO());
  const [signature, setSignature] = useState(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (accord === null) return push('Cochez OUI ou NON.', 'error');
    if (!docteurNom.trim()) return push('Indiquez le nom du Docteur.', 'error');
    if (!signature) return push('Signez avant d\'enregistrer la décision.', 'error');
    setSaving(true);
    try {
      await updateDoc(doc(db, 'demandes_permission', item.id), {
        statut: accord ? 'approuvee' : 'refusee',
        decision: { accord, docteurNom: docteurNom.trim(), date, signature },
        traiteAt: serverTimestamp(),
        traiteParId: user.uid,
      });
      push(accord ? 'Permission accordée.' : 'Permission refusée.', 'success');
      onDone();
    } catch (err) {
      push(err.message || "Impossible d'enregistrer la décision.", 'error');
    } finally {
      setSaving(false);
    }
  };

  const box = (value, label) => (
    <button
      type="button" onClick={() => setAccord(value)} aria-pressed={accord === value}
      className="mx-1 inline-flex items-center gap-1 align-middle"
    >
      {label}
      <span
        className="inline-flex h-6 w-6 items-center justify-center border border-gray-700 text-sm font-bold"
        style={{ color: INK }}
      >
        {accord === value ? '✕' : ''}
      </span>
    </button>
  );

  return (
    <div className="mt-3 text-[15px]">
      <div className="flex flex-wrap items-baseline gap-x-1 gap-y-2 leading-8">
        <span>Accord de Dr</span>
        <input
          value={docteurNom} onChange={(e) => setDocteurNom(e.target.value)}
          className="min-w-[8rem] flex-1 rounded-none border-0 border-b border-dotted border-gray-600 bg-transparent px-1 outline-none focus:border-solid focus:border-[#146C5E]"
          style={{ color: INK }}
        />
        <span>:</span>
        {box(true, 'OUI')}
        {box(false, 'NON')}
      </div>
      <div className="mt-3 sm:ml-auto sm:w-72">
        <label className="flex items-baseline justify-end gap-2">
          Abidjan, le
          <input
            type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-40 rounded-none border-0 border-b border-dotted border-gray-600 bg-transparent px-1 outline-none focus:border-solid focus:border-[#146C5E]"
            style={{ color: INK }}
          />
        </label>
        <p className="mb-1 mt-3">Signature :</p>
        <SignaturePad onChange={setSignature} />
      </div>
      <div className="no-print mt-4 flex justify-end">
        <button
          type="button" onClick={save} disabled={saving}
          className="rounded-xl px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          style={{ background: C.teal }}
        >
          {saving ? 'Enregistrement…' : 'Enregistrer la décision'}
        </button>
      </div>
    </div>
  );
}

// Fiche ouverte en plein écran : imprimable / exportable en PDF (Imprimer → Enregistrer en PDF).
function PermissionModal({ item, canDecide, onClose }) {
  useEffect(() => {
    document.body.classList.add('has-print-portal');
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('has-print-portal');
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const pending = item.statut === 'en_attente';

  return createPortal(
    <div className="print-portal fixed inset-0 z-[95] overflow-y-auto bg-black/60" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mx-auto max-w-[794px] px-3 py-5" onMouseDown={(e) => e.stopPropagation()}>
        <div className="no-print mb-3 flex items-center justify-between gap-3 text-white">
          <div className="flex items-center gap-2">
            <StatutBadge statut={item.statut} />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button" onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-2 text-sm hover:bg-white/25"
            >
              <PrinterIcon className="h-4 w-4" /> Imprimer / PDF
            </button>
            <button
              type="button" onClick={onClose} aria-label="Fermer"
              className="rounded-lg bg-white/15 p-2 hover:bg-white/25"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
        <PermissionSheet
          demande={item}
          decisionSlot={canDecide && pending ? <DecisionEditor item={item} onDone={onClose} /> : undefined}
        />
      </div>
    </div>,
    document.body,
  );
}

export default function PermissionsPage() {
  const { user } = useAuth();
  const { isDrPrincipal, isSuperAdmin } = useEmployee();
  const dark = useUIStore((s) => s.dark);
  const canDecide = isDrPrincipal || isSuperAdmin;

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [tab, setTab] = useState('a_traiter');

  // Le Docteur voit toutes les demandes ; les autres uniquement les leurs.
  useEffect(() => {
    if (!user) return undefined;
    const col = collection(db, 'demandes_permission');
    const q = canDecide ? query(col, orderBy('createdAt', 'desc')) : query(col, where('employeId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }));
      list.sort((a, b) => millis(b) - millis(a));
      setRows(list);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [user, canDecide]);

  const mine = useMemo(() => rows.filter((r) => r.employeId === user?.uid), [rows, user]);
  const pending = useMemo(() => rows.filter((r) => r.statut === 'en_attente'), [rows]);
  const opened = rows.find((r) => r.id === openId) || null;

  const tabs = canDecide
    ? [
      { id: 'a_traiter', label: `À traiter (${pending.length})`, list: pending, author: true, empty: 'Aucune demande en attente.' },
      { id: 'toutes', label: 'Toutes', list: rows, author: true, empty: 'Aucune demande enregistrée.' },
      { id: 'mes', label: 'Mes demandes', list: mine, author: false, empty: "Vous n'avez encore fait aucune demande." },
    ]
    : [{ id: 'mes', label: 'Mes demandes', list: mine, author: false, empty: "Vous n'avez encore fait aucune demande." }];
  const current = tabs.find((t) => t.id === tab) || tabs[0];

  if (creating) {
    return (
      <div className="p-4 md:p-8">
        <PermissionForm onDone={() => { setCreating(false); setTab('mes'); }} onCancel={() => setCreating(false)} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className={`font-display text-2xl ${dark ? 'text-white' : 'text-gray-800'}`}>Permissions</h1>
          <p className={`mt-1 text-sm ${dark ? 'text-white/50' : 'text-gray-500'}`}>
            Remplissez le formulaire de demande ; le Docteur donne sa décision sur la même fiche.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex flex-shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-transform hover:scale-[1.02]"
          style={{ background: C.teal }}
        >
          <PlusIcon className="h-4 w-4" /> Nouvelle demande
        </button>
      </div>

      {tabs.length > 1 && (
        <div className="mb-5 flex gap-1 rounded-xl p-1" style={{ background: dark ? '#ffffff0d' : '#0000000a' }}>
          {tabs.map((t) => (
            <button
              key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                current.id === t.id
                  ? (dark ? 'bg-white/15 text-white' : 'bg-white text-gray-800 shadow-sm')
                  : (dark ? 'text-white/50' : 'text-gray-500')
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className={dark ? 'text-sm text-white/40' : 'text-sm text-gray-400'}>Chargement…</p>
      ) : current.list.length === 0 ? (
        <div className={`rounded-2xl py-16 text-center ${dark ? 'text-white/40' : 'text-gray-400'}`}>
          <ClipboardDocumentCheckIcon className="mx-auto mb-3 h-10 w-10 opacity-40" />
          <p className="text-sm">{current.empty}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {current.list.map((item) => (
            <RequestCard key={item.id} item={item} dark={dark} showAuthor={current.author} onOpen={(i) => setOpenId(i.id)} />
          ))}
        </div>
      )}

      {opened && <PermissionModal item={opened} canDecide={canDecide} onClose={() => setOpenId(null)} />}
    </div>
  );
}
