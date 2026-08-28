import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { ShieldExclamationIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useEmployee } from '../../context/EmployeeContext';
import { playNotificationSound, roleLabel } from '../../lib/personnel';

// Écoute en temps réel la collection "reclamations" et alerte tous les
// employés connectés (son + modal) dès qu'une nouvelle réclamation arrive,
// sauf l'auteur lui-même.
export default function ReclamationNotifier() {
  const { user } = useAuth();
  const { employee } = useEmployee();
  const [queue, setQueue] = useState([]);
  const readyRef = useRef(false);
  const knownIdsRef = useRef(new Set());

  useEffect(() => {
    if (!user) return undefined;
    readyRef.current = false;
    knownIdsRef.current = new Set();

    const q = query(collection(db, 'reclamations'), orderBy('createdAt', 'desc'), limit(30));
    const unsub = onSnapshot(q, (snap) => {
      if (!readyRef.current) {
        // Premier chargement : on mémorise l'existant sans notifier.
        snap.docs.forEach((d) => knownIdsRef.current.add(d.id));
        readyRef.current = true;
        return;
      }
      snap.docChanges().forEach((change) => {
        if (change.type !== 'added') return;
        if (knownIdsRef.current.has(change.doc.id)) return;
        knownIdsRef.current.add(change.doc.id);
        const data = change.doc.data();
        if (data.auteurId === user.uid) return; // pas d'auto-notification
        setQueue((q2) => [...q2, { id: change.doc.id, ...data }]);
        playNotificationSound();
      });
    });
    return () => unsub();
  }, [user, employee?.id]);

  const current = queue[0];

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 12 }}
            className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden bg-white"
          >
            <div className="px-5 py-4 flex items-center gap-3 bg-red-50 border-b border-red-100">
              <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
                <ShieldExclamationIcon className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-700">Nouvelle réclamation</p>
                <p className="text-xs text-red-500">
                  {current.auteurNom || 'Employé'} · {roleLabel(current.auteurRole)}
                </p>
              </div>
              <button
                onClick={() => setQueue((q2) => q2.slice(1))}
                className="text-red-300 hover:text-red-500"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 py-4">
              {current.titre && <p className="font-semibold text-gray-800 mb-1">{current.titre}</p>}
              <p className="text-sm text-gray-600 whitespace-pre-wrap line-clamp-6">{current.message}</p>
            </div>
            <div className="px-5 pb-4">
              <button
                onClick={() => setQueue((q2) => q2.slice(1))}
                className="w-full bg-gray-900 hover:bg-black text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
              >
                J'ai vu, fermer
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
