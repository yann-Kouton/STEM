import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { UserGroupIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useEmployee } from '../../context/EmployeeContext';
import { C, useUIStore, useToastStore } from '../../lib/theme';
import { ROLES, ROLE_ORDER, roleLabel } from '../../lib/personnel';

export default function AdminPage() {
  const { user } = useAuth();
  const { isDrPrincipal, loading } = useEmployee();
  const dark = useUIStore((s) => s.dark);
  const push = useToastStore((s) => s.push);
  const [employes, setEmployes] = useState([]);
  const [listLoading, setListLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'employes'), (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      rows.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
      setEmployes(rows);
      setListLoading(false);
    }, () => setListLoading(false));
    return () => unsub();
  }, []);

  const cardStyle = { background: dark ? C.cardDark : C.card, border: `1px solid ${dark ? '#ffffff14' : '#00000010'}` };

  if (loading || listLoading) {
    return <div className="p-8"><p className={dark ? 'text-white/40 text-sm' : 'text-gray-400 text-sm'}>Chargement…</p></div>;
  }

  if (!isDrPrincipal) {
    return (
      <div className="p-6 md:p-8 max-w-lg mx-auto text-center py-24">
        <LockClosedIcon className={`h-10 w-10 mx-auto mb-3 ${dark ? 'text-white/30' : 'text-gray-300'}`} />
        <p className={dark ? 'text-white/50' : 'text-gray-500'}>
          Cette section est réservée au Docteur Principal.
        </p>
      </div>
    );
  }

  const changeRole = async (emp, newRole) => {
    try {
      await updateDoc(doc(db, 'employes', emp.id), { role: newRole });
      push(`Rôle de ${emp.displayName || emp.email} mis à jour : ${roleLabel(newRole)}.`, 'success');
    } catch (err) {
      push(err.message, 'error');
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className={`font-display text-2xl ${dark ? 'text-white' : 'text-gray-800'}`}>Administration du personnel</h1>
        <p className={`text-sm mt-1 ${dark ? 'text-white/50' : 'text-gray-500'}`}>
          Attribuez un rôle à chaque employé. Vous êtes le seul à pouvoir modifier les rôles.
        </p>
      </div>

      <div className="rounded-2xl overflow-hidden" style={cardStyle}>
        <div className={`flex items-center gap-2 px-5 py-3 text-xs font-mono uppercase tracking-wide ${dark ? 'text-white/40 border-b border-white/10' : 'text-gray-400 border-b border-gray-100'}`}>
          <UserGroupIcon className="h-4 w-4" /> {employes.length} employé{employes.length > 1 ? 's' : ''}
        </div>
        <div className="divide-y" style={{ borderColor: dark ? '#ffffff14' : '#00000010' }}>
          {employes.map((emp) => (
            <div key={emp.id} className="flex items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <p className={`text-sm font-medium truncate ${dark ? 'text-white' : 'text-gray-800'}`}>
                  {emp.displayName || emp.email} {emp.id === user.uid && <span className="text-xs opacity-50">(vous)</span>}
                </p>
                <p className={`text-xs truncate ${dark ? 'text-white/40' : 'text-gray-400'}`}>{emp.email}</p>
              </div>
              <select
                value={emp.role || ROLES.PHARMACIEN}
                onChange={(e) => changeRole(emp, e.target.value)}
                disabled={emp.id === user.uid}
                className="text-sm px-3 py-2 rounded-lg border outline-none disabled:opacity-50 flex-shrink-0"
                style={{ background: dark ? '#ffffff08' : '#fff', borderColor: dark ? '#ffffff1a' : '#00000014', color: dark ? '#fff' : '#111' }}
              >
                {ROLE_ORDER.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
