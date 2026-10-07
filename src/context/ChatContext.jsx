import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection, doc, onSnapshot, query, serverTimestamp, setDoc, where, writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';
import { useEmployee } from './EmployeeContext';
import { useToastStore } from '../lib/theme';
import { playNotificationSound } from '../lib/personnel';

export const GENERAL_ID = 'general';
export const MAX_MESSAGE_LENGTH = 2000;

// Identifiant déterministe d'une conversation privée : les deux UID triés.
// Les UID Firebase ne contiennent pas de « _ », ce qui permet aux règles Firestore
// de retrouver les deux participants directement depuis l'identifiant.
export const dmId = (a, b) => `dm_${[a, b].sort().join('_')}`;

const ChatContext = createContext({
  directory: [], conversations: {}, unreadById: {}, unreadCount: 0,
  activeId: null, setActiveId: () => {}, markRead: () => {}, sendMessage: async () => {},
});

const ts = (v) => (v && typeof v.toMillis === 'function' ? v.toMillis() : 0);
const readData = (snap) => snap.data({ serverTimestamps: 'estimate' });

export function ChatProvider({ children }) {
  const { user } = useAuth();
  const { employee } = useEmployee();
  const push = useToastStore((s) => s.push);
  const uid = user?.uid;
  const enabled = !!uid && !!employee;

  const [directory, setDirectory] = useState([]);
  const [general, setGeneral] = useState(null);
  const [dms, setDms] = useState({});
  const [reads, setReads] = useState({});
  const [activeId, setActiveId] = useState(null);

  const activeRef = useRef(null);
  activeRef.current = activeId;
  // Dernier message déjà « vu » par conversation, pour ne notifier que les nouveautés.
  const seenRef = useRef({});
  const primedRef = useRef({ general: false, dms: false });

  const notifyIfNew = useCallback((id, data, primed) => {
    const lm = data?.lastMessage;
    const t = ts(lm?.createdAt);
    const previous = seenRef.current[id] || 0;
    if (t) seenRef.current[id] = Math.max(previous, t);
    if (!primed || !lm || !t || t <= previous) return;
    if (lm.senderId === uid) return;
    if (activeRef.current === id && !document.hidden) return;
    playNotificationSound();
    const suffix = id === GENERAL_ID ? ' · Général' : '';
    const text = (lm.text || '').length > 90 ? `${lm.text.slice(0, 90)}…` : lm.text;
    push(`${lm.senderName || 'Collègue'}${suffix} : ${text}`, 'info');
  }, [uid, push]);

  // Annuaire : tous les collègues actifs.
  useEffect(() => {
    if (!enabled) { setDirectory([]); return undefined; }
    return onSnapshot(collection(db, 'employes'), (snap) => {
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((e) => !e.disabled)
        .map((e) => ({
          id: e.id,
          name: e.displayName || [e.prenoms, e.nom].filter(Boolean).join(' ') || e.email || 'Collègue',
          email: e.email || '',
          role: e.role || null,
        }));
      rows.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
      setDirectory(rows);
    }, () => {});
  }, [enabled]);

  // Discussion générale
  useEffect(() => {
    if (!enabled) { setGeneral(null); return undefined; }
    primedRef.current.general = false;
    return onSnapshot(doc(db, 'conversations', GENERAL_ID), (snap) => {
      const data = snap.exists() ? { id: GENERAL_ID, ...readData(snap) } : null;
      setGeneral(data);
      if (data) notifyIfNew(GENERAL_ID, data, primedRef.current.general);
      // « Amorcé » = premier instantané venant du serveur (pas du cache local) :
      // les messages reçus pendant l'absence de l'utilisateur ne déclenchent pas d'alerte.
      if (!snap.metadata.fromCache) primedRef.current.general = true;
    }, () => {});
  }, [enabled, notifyIfNew]);

  // Conversations privées dont je suis participant
  useEffect(() => {
    if (!enabled) { setDms({}); return undefined; }
    primedRef.current.dms = false;
    const q = query(collection(db, 'conversations'), where('participants', 'array-contains', uid));
    return onSnapshot(q, (snap) => {
      const next = {};
      snap.docs.forEach((d) => { next[d.id] = { id: d.id, ...readData(d) }; });
      setDms(next);
      const wasPrimed = primedRef.current.dms;
      snap.docChanges().forEach((c) => {
        if (c.type === 'removed') return;
        notifyIfNew(c.doc.id, next[c.doc.id], wasPrimed);
      });
      if (!snap.metadata.fromCache) primedRef.current.dms = true;
    }, () => {});
  }, [enabled, uid, notifyIfNew]);

  // Dates de dernière lecture (une entrée par conversation)
  useEffect(() => {
    if (!enabled) { setReads({}); return undefined; }
    return onSnapshot(doc(db, 'chat_reads', uid), (snap) => {
      setReads(snap.exists() ? readData(snap) : {});
    }, () => {});
  }, [enabled, uid]);

  const conversations = useMemo(() => {
    const all = { ...dms };
    if (general) all[GENERAL_ID] = general;
    return all;
  }, [dms, general]);

  const unreadById = useMemo(() => {
    const out = {};
    Object.entries(conversations).forEach(([id, c]) => {
      const lm = c.lastMessage;
      if (!lm || lm.senderId === uid) return;
      if (ts(lm.createdAt) > ts(reads[id])) out[id] = true;
    });
    return out;
  }, [conversations, reads, uid]);

  const unreadCount = Object.keys(unreadById).length;

  const markRead = useCallback((id) => {
    if (!uid) return;
    setDoc(doc(db, 'chat_reads', uid), { [id]: serverTimestamp() }, { merge: true }).catch(() => {});
  }, [uid]);

  const sendMessage = useCallback(async (id, rawText) => {
    const text = rawText.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!uid || !text) return;
    const senderName = employee?.displayName || user.displayName || user.email || 'Collègue';
    const isGeneral = id === GENERAL_ID;

    const batch = writeBatch(db);
    batch.set(doc(collection(db, 'conversations', id, 'messages')), {
      senderId: uid,
      senderName,
      senderRole: employee?.role || null,
      text,
      createdAt: serverTimestamp(),
    });
    const convData = {
      type: isGeneral ? 'general' : 'direct',
      lastMessage: {
        text: text.slice(0, 200), senderId: uid, senderName, createdAt: serverTimestamp(),
      },
      updatedAt: serverTimestamp(),
    };
    if (!isGeneral) convData.participants = id.split('_').slice(1);
    batch.set(doc(db, 'conversations', id), convData, { merge: true });
    await batch.commit();
  }, [uid, employee, user]);

  const value = {
    directory, conversations, unreadById, unreadCount,
    activeId, setActiveId, markRead, sendMessage,
  };
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export const useChat = () => useContext(ChatContext);
