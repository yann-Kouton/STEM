import { useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useEmployee } from '../../context/EmployeeContext';
import { useToastStore } from '../../lib/theme';
import { playNotificationSound } from '../../lib/personnel';

// Alertes en temps réel sur les demandes de permission :
// - Docteur Principal / Super Admin : une nouvelle demande arrive (son + notification) ;
// - autres employés : le Docteur a accordé ou refusé leur demande.
// Monté une seule fois à la racine de l'application (survit aux changements de page).
export default function PermissionNotifier() {
  const { user } = useAuth();
  const { employee, isDrPrincipal, isSuperAdmin } = useEmployee();
  const push = useToastStore((s) => s.push);
  const canDecide = isDrPrincipal || isSuperAdmin;
  const uid = user?.uid;
  const ready = !!uid && !!employee;

  useEffect(() => {
    if (!ready) return undefined;
    const col = collection(db, 'demandes_permission');
    const q = canDecide
      ? query(col, where('statut', '==', 'en_attente'))
      : query(col, where('employeId', '==', uid));

    const known = new Map(); // id -> dernier statut connu
    // « Amorcé » = premier instantané venant du serveur : l'existant ne déclenche pas d'alerte.
    let primed = false;

    const unsub = onSnapshot(q, (snap) => {
      snap.docChanges().forEach((c) => {
        const id = c.doc.id;
        if (c.type === 'removed') { known.delete(id); return; }
        const data = c.doc.data();
        const before = known.get(id);
        known.set(id, data.statut);
        if (!primed || c.doc.metadata.hasPendingWrites) return;

        if (canDecide) {
          if (c.type === 'added' && data.employeId !== uid) {
            const who = [data.prenoms, data.nom].filter(Boolean).join(' ') || data.employeNom || 'Un employé';
            playNotificationSound();
            push(`Nouvelle demande de permission : ${who}`, 'info');
          }
        } else if (before === 'en_attente' && data.statut !== 'en_attente') {
          playNotificationSound();
          if (data.statut === 'approuvee') push('Votre demande de permission a été accordée.', 'success');
          else push('Votre demande de permission a été refusée.', 'error');
        }
      });
      if (!snap.metadata.fromCache) primed = true;
    }, () => {});

    return () => unsub();
  }, [ready, canDecide, uid, push]);

  return null;
}
