import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc,
} from 'firebase/firestore';
import { MegaphoneIcon, CheckCircleIcon, PlusIcon } from '@heroicons/react/24/outline';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useEmployee } from '../../context/EmployeeContext';
import { C, useUIStore, useToastStore } from '../../lib/theme';
import { roleLabel } from '../../lib/personnel';

export default function ReclamationsPage() {
  const { user } = useAuth();
  const { employee, isReviewer } = useEmployee();
  const dark = useUIStore((s) => s.dark);
  const push = useToastStore((s) => s.push);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [titre, setTitre] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'reclamations'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'reclamations'), {
        auteurId: user.uid,
        auteurNom: employee?.displayName || user.displayName || user.email,
        auteurRole: employee?.role || null,
        titre: titre.trim(),
        message: message.trim(),
        statut: 'ouverte',
        createdAt: serverTimestamp(),
      });
      setTitre('');
      setMessage('');
      setShowForm(false);
      push('Réclamation envoyée à tous les employés.', 'success');
    } catch (err) {
      push(err.message || "Impossible d'envoyer la réclamation.", 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatut = async (item) => {
    try {
      await updateDoc(doc(db, 'reclamations', item.id), {
        statut: item.statut === 'traitee' ? 'ouverte' : 'traitee',
      });
    } catch (err) {
      push(err.message, 'error');
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className={`font-display text-2xl ${dark ? 'text-white' : 'text-gray-800'}`}>Réclamations</h1>
          <p className={`text-sm mt-1 ${dark ? 'text-white/50' : 'text-gray-500'}`}>
            Visibles par tous les employés, avec alerte sonore instantanée.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-transform hover:scale-[1.02]"
          style={{ background: C.clay }}
        >
          <PlusIcon className="h-4 w-4" /> Nouvelle réclamation
        </button>
      </div>

      {showForm && (
        <motion.form
          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          onSubmit={handleSubmit}
          className="mb-6 p-5 rounded-2xl space-y-3"
          style={{ background: dark ? C.cardDark : C.card, border: `1px solid ${dark ? '#ffffff14' : '#00000010'}` }}
        >
          <input
            value={titre} onChange={(e) => setTitre(e.target.value)}
            placeholder="Titre (optionnel)"
            className="w-full px-4 py-2.5 rounded-xl border outline-none text-sm"
            style={{ background: dark ? '#ffffff08' : '#fff', borderColor: dark ? '#ffffff1a' : '#00000014', color: dark ? '#fff' : '#111' }}
          />
          <textarea
            value={message} onChange={(e) => setMessage(e.target.value)}
            placeholder="Décrivez la réclamation..." rows={4} required
            className="w-full px-4 py-2.5 rounded-xl border outline-none text-sm resize-none"
            style={{ background: dark ? '#ffffff08' : '#fff', borderColor: dark ? '#ffffff1a' : '#00000014', color: dark ? '#fff' : '#111' }}
          />
          <button
            type="submit" disabled={saving}
            className="text-white text-sm font-medium px-5 py-2.5 rounded-xl disabled:opacity-60"
            style={{ background: C.teal }}
          >
            {saving ? 'Envoi…' : 'Publier pour tous'}
          </button>
        </motion.form>
      )}

      {loading ? (
        <p className={dark ? 'text-white/40 text-sm' : 'text-gray-400 text-sm'}>Chargement…</p>
      ) : items.length === 0 ? (
        <div className={`text-center py-16 rounded-2xl ${dark ? 'text-white/40' : 'text-gray-400'}`}>
          <MegaphoneIcon className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Aucune réclamation pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-2xl"
              style={{ background: dark ? C.cardDark : C.card, border: `1px solid ${dark ? '#ffffff14' : '#00000010'}` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  {item.titre && <p className={`font-semibold ${dark ? 'text-white' : 'text-gray-800'}`}>{item.titre}</p>}
                  <p className={`text-sm mt-1 whitespace-pre-wrap ${dark ? 'text-white/70' : 'text-gray-600'}`}>{item.message}</p>
                  <p className={`text-xs mt-2 font-mono ${dark ? 'text-white/30' : 'text-gray-400'}`}>
                    {item.auteurNom} · {roleLabel(item.auteurRole)}
                  </p>
                </div>
                <span
                  className="text-[10px] font-mono uppercase tracking-wide px-2 py-1 rounded-full flex-shrink-0"
                  style={{
                    background: item.statut === 'traitee' ? `${C.sage}22` : `${C.clay}22`,
                    color: item.statut === 'traitee' ? C.sage : C.clay,
                  }}
                >
                  {item.statut === 'traitee' ? 'Traitée' : 'Ouverte'}
                </span>
              </div>
              {isReviewer && (
                <button
                  onClick={() => toggleStatut(item)}
                  className={`mt-3 flex items-center gap-1.5 text-xs font-medium ${dark ? 'text-white/50 hover:text-white' : 'text-gray-500 hover:text-gray-800'}`}
                >
                  <CheckCircleIcon className="h-4 w-4" />
                  {item.statut === 'traitee' ? 'Marquer comme ouverte' : 'Marquer comme traitée'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
