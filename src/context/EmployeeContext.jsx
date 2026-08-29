import { createContext, useContext, useEffect, useState } from 'react';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';
import { useToastStore } from '../lib/theme';
import {
  ROLES, CLINICAL_ROLES, REVIEWER_ROLES, determineDefaultRole, isSuperAdminEmail,
} from '../lib/personnel';

const EmployeeContext = createContext(null);

export function EmployeeProvider({ children }) {
  const { user, logout } = useAuth();
  const push = useToastStore((s) => s.push);
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setEmployee(null);
      setLoading(false);
      return undefined;
    }
    setLoading(true);

    // Migration transparente : si un ancien compte "pharmaciens" existe sans
    // équivalent dans "employes", on le recopie avec un rôle par défaut.
    (async () => {
      try {
        const employeRef = doc(db, 'employes', user.uid);
        const employeSnap = await getDoc(employeRef);
        if (!employeSnap.exists()) {
          const legacyRef = doc(db, 'pharmaciens', user.uid);
          const legacySnap = await getDoc(legacyRef);
          const role = determineDefaultRole(user.email);
          if (legacySnap.exists()) {
            await setDoc(employeRef, { ...legacySnap.data(), role, disabled: false }, { merge: true });
          } else {
            await setDoc(employeRef, {
              email: user.email,
              displayName: user.displayName || '',
              role,
              disabled: false,
              createdAt: serverTimestamp(),
            }, { merge: true });
          }
        } else if (isSuperAdminEmail(user.email) && employeSnap.data().role !== ROLES.SUPER_ADMIN) {
          // Garde-fou : l'email whitelisté redevient toujours Super Admin,
          // même s'il a été modifié par erreur depuis le panneau d'administration.
          await updateDoc(employeRef, { role: ROLES.SUPER_ADMIN });
        }
      } catch (err) {
        console.error('Migration employé impossible :', err);
      }
    })();

    const unsub = onSnapshot(doc(db, 'employes', user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.disabled) {
          setEmployee(null);
          setLoading(false);
          push('Votre accès a été désactivé par l\'administrateur.', 'error');
          logout();
          return;
        }
        setEmployee({ id: snap.id, ...data, role: data.role || ROLES.PHARMACIEN });
      } else {
        setEmployee(null);
      }
      setLoading(false);
    }, () => setLoading(false));

    return () => unsub();
  }, [user]);

  const role = employee?.role || null;

  const value = {
    employee,
    role,
    loading,
    isSuperAdmin: role === ROLES.SUPER_ADMIN,
    isDrPrincipal: role === ROLES.DR_PRINCIPAL,
    isDrDelegue: role === ROLES.DR_DELEGUE,
    isPharmacien: role === ROLES.PHARMACIEN,
    isAuxiliaire: role === ROLES.AUXILIAIRE,
    isComptable: role === ROLES.COMPTABLE,
    isClinical: CLINICAL_ROLES.includes(role),
    isReviewer: REVIEWER_ROLES.includes(role),
  };

  return <EmployeeContext.Provider value={value}>{children}</EmployeeContext.Provider>;
}

export function useEmployee() {
  return useContext(EmployeeContext);
}
