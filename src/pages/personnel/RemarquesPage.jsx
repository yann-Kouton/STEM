import { useEffect, useState } from 'react';
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { ChatBubbleLeftEllipsisIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { db } from '../../firebase/config';
import { useEmployee } from '../../context/EmployeeContext';
import { C, useUIStore, useToastStore } from '../../lib/theme';
import { roleLabel } from '../../lib/personnel';

export default function RemarquesPage() {
  const { employee, isReviewer } = useEmployee();
  const dark = useUIStore((s) => s.dark);
  const push = useToastStore((s) => s.push);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!isReviewer) return undefined;
    const q = query(collection(db, 'remarques_anonymes'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [isReviewer]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSaving(true);
    try {
      // Volontairement : aucune information d'identité n'est enregistrée,
      // seul le rôle est conservé pour donner un contexte sans identifier l'auteur.
      await addDoc(collection(db, 'remarques_anonymes'), {
        role: employee?.role || null,
        message: message.trim(),
        createdAt: serverTimestamp(),
      });
      setMessage('');
      push('Remarque envoyée anonymement au Dr Principal et au Dr Délégué.', 'success');
    } catch (err) {
      push(err.message || "Impossible d'envoyer la remarque.", 'error');
    } finally {
      setSaving(false);
    }
  };

  const cardStyle = { background: dark ? C.cardDark : C.card, border: `1px solid ${dark ? '#ffffff14' : '#00000010'}` };

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className={`font-display text-2xl ${dark ? 'text-white' : 'text-gray-800'}`}>Remarques anonymes</h1>
        <p className={`text-sm mt-1 ${dark ? 'text-white/50' : 'text-gray-500'}`}>
          Votre identité n'est jamais enregistrée. Seul le Docteur Principal et le Docteur Délégué peuvent lire les remarques.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-5 rounded-2xl space-y-3 mb-8" style={cardStyle}>
        <div className={`flex items-center gap-2 text-xs font-mono uppercase tracking-wide ${dark ? 'text-white/40' : 'text-gray-400'}`}>
          <EyeSlashIcon className="h-4 w-4" /> 100% anonyme
        </div>
        <textarea
          value={message} onChange={(e) => setMessage(e.target.value)}
          placeholder="Partagez une remarque ou une critique constructive..." rows={4} required
          className="w-full px-4 py-2.5 rounded-xl border outline-none text-sm resize-none"
          style={{ background: dark ? '#ffffff08' : '#fff', borderColor: dark ? '#ffffff1a' : '#00000014', color: dark ? '#fff' : '#111' }}
        />
        <button
          type="submit" disabled={saving}
          className="text-white text-sm font-medium px-5 py-2.5 rounded-xl disabled:opacity-60"
          style={{ background: C.ink }}
        >
          {saving ? 'Envoi…' : 'Envoyer anonymement'}
        </button>
      </form>

      {isReviewer && (
        <>
          <h2 className={`text-xs font-mono uppercase tracking-wide mb-3 ${dark ? 'text-white/40' : 'text-gray-400'}`}>
            Remarques reçues ({items.length})
          </h2>
          {items.length === 0 ? (
            <div className={`text-center py-16 rounded-2xl ${dark ? 'text-white/40' : 'text-gray-400'}`}>
              <ChatBubbleLeftEllipsisIcon className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Aucune remarque pour le moment.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="p-4 rounded-2xl" style={cardStyle}>
                  <p className={`text-sm whitespace-pre-wrap ${dark ? 'text-white/80' : 'text-gray-700'}`}>{item.message}</p>
                  <p className={`text-xs mt-2 font-mono ${dark ? 'text-white/30' : 'text-gray-400'}`}>
                    Anonyme · {roleLabel(item.role)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
