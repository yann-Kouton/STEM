import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where,
} from 'firebase/firestore';
import { ClipboardDocumentCheckIcon, PlusIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useEmployee } from '../../context/EmployeeContext';
import { C, useUIStore, useToastStore } from '../../lib/theme';
import { roleLabel, STATUT_LABELS, TYPES_PERMISSION } from '../../lib/personnel';

function StatutBadge({ statut, dark }) {
  const tone = statut === 'approuvee' ? C.sage : statut === 'refusee' ? C.clay : C.amber;
  return (
    <span
      className="text-[10px] font-mono uppercase tracking-wide px-2 py-1 rounded-full flex-shrink-0"
      style={{ background: `${tone}22`, color: tone }}
    >
      {STATUT_LABELS[statut] || statut}
    </span>
  );
}

export default function PermissionsPage() {
  const { user } = useAuth();
  const { employee, isDrPrincipal } = useEmployee();
  const dark = useUIStore((s) => s.dark);
  const push = useToastStore((s) => s.push);

  const [mine, setMine] = useState([]);
  const [pending, setPending] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState(TYPES_PERMISSION[0]);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return undefined;
    const q = query(collection(db, 'demandes_permission'), where('employeId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      rows.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setMine(rows);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!isDrPrincipal) return undefined;
    const q = query(collection(db, 'demandes_permission'), where('statut', '==', 'en_attente'));
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      rows.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
      setPending(rows);
    });
    return () => unsub();
  }, [isDrPrincipal]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'demandes_permission'), {
        employeId: user.uid,
        employeNom: employee?.displayName || user.displayName || user.email,
        role: employee?.role || null,
        type,
        message: message.trim(),
        statut: 'en_attente',
        createdAt: serverTimestamp(),
      });
      setMessage('');
      setShowForm(false);
      push('Demande envoyée au Docteur Principal.', 'success');
    } catch (err) {
      push(err.message || "Impossible d'envoyer la demande.", 'error');
    } finally {
      setSaving(false);
    }
  };

  const traiter = async (item, statut) => {
    try {
      await updateDoc(doc(db, 'demandes_permission', item.id), {
        statut,
        traiteAt: serverTimestamp(),
      });
      push(statut === 'approuvee' ? 'Demande approuvée.' : 'Demande refusée.', 'success');
    } catch (err) {
      push(err.message, 'error');
    }
  };

  const cardStyle = { background: dark ? C.cardDark : C.card, border: `1px solid ${dark ? '#ffffff14' : '#00000010'}` };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className={`font-display text-2xl ${dark ? 'text-white' : 'text-gray-800'}`}>Permissions</h1>
          <p className={`text-sm mt-1 ${dark ? 'text-white/50' : 'text-gray-500'}`}>
            Demandez une permission ; le Docteur Principal la valide.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-transform hover:scale-[1.02]"
          style={{ background: C.teal }}
        >
          <PlusIcon className="h-4 w-4" /> Nouvelle demande
        </button>
      </div>

      {showForm && (
        <motion.form
          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          onSubmit={handleSubmit}
          className="mb-8 p-5 rounded-2xl space-y-3" style={cardStyle}
        >
          <select
            value={type} onChange={(e) => setType(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border outline-none text-sm"
            style={{ background: dark ? '#ffffff08' : '#fff', borderColor: dark ? '#ffffff1a' : '#00000014', color: dark ? '#fff' : '#111' }}
          >
            {TYPES_PERMISSION.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <textarea
            value={message} onChange={(e) => setMessage(e.target.value)}
            placeholder="Précisez votre demande (dates, motif...)" rows={3} required
            className="w-full px-4 py-2.5 rounded-xl border outline-none text-sm resize-none"
            style={{ background: dark ? '#ffffff08' : '#fff', borderColor: dark ? '#ffffff1a' : '#00000014', color: dark ? '#fff' : '#111' }}
          />
          <button
            type="submit" disabled={saving}
            className="text-white text-sm font-medium px-5 py-2.5 rounded-xl disabled:opacity-60"
            style={{ background: C.teal }}
          >
            {saving ? 'Envoi…' : 'Envoyer la demande'}
          </button>
        </motion.form>
      )}

      {isDrPrincipal && (
        <div className="mb-8">
          <h2 className={`text-xs font-mono uppercase tracking-wide mb-3 ${dark ? 'text-white/40' : 'text-gray-400'}`}>
            Demandes à traiter ({pending.length})
          </h2>
          {pending.length === 0 ? (
            <p className={`text-sm ${dark ? 'text-white/30' : 'text-gray-400'}`}>Aucune demande en attente.</p>
          ) : (
            <div className="space-y-3">
              {pending.map((item) => (
                <div key={item.id} className="p-4 rounded-2xl" style={cardStyle}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`font-semibold text-sm ${dark ? 'text-white' : 'text-gray-800'}`}>{item.type}</p>
                      <p className={`text-sm mt-1 ${dark ? 'text-white/70' : 'text-gray-600'}`}>{item.message}</p>
                      <p className={`text-xs mt-2 font-mono ${dark ? 'text-white/30' : 'text-gray-400'}`}>
                        {item.employeNom} · {roleLabel(item.role)}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => traiter(item, 'approuvee')} className="p-2 rounded-lg" style={{ background: `${C.sage}22`, color: C.sage }}>
                        <CheckIcon className="h-4 w-4" />
                      </button>
                      <button onClick={() => traiter(item, 'refusee')} className="p-2 rounded-lg" style={{ background: `${C.clay}22`, color: C.clay }}>
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <h2 className={`text-xs font-mono uppercase tracking-wide mb-3 ${dark ? 'text-white/40' : 'text-gray-400'}`}>Mes demandes</h2>
      {mine.length === 0 ? (
        <div className={`text-center py-16 rounded-2xl ${dark ? 'text-white/40' : 'text-gray-400'}`}>
          <ClipboardDocumentCheckIcon className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Vous n'avez encore fait aucune demande.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {mine.map((item) => (
            <div key={item.id} className="p-4 rounded-2xl flex items-start justify-between gap-3" style={cardStyle}>
              <div>
                <p className={`font-semibold text-sm ${dark ? 'text-white' : 'text-gray-800'}`}>{item.type}</p>
                <p className={`text-sm mt-1 ${dark ? 'text-white/70' : 'text-gray-600'}`}>{item.message}</p>
              </div>
              <StatutBadge statut={item.statut} dark={dark} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
