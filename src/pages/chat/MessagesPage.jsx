import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  collection, endBefore, getDocs, limitToLast, onSnapshot, orderBy, query,
} from 'firebase/firestore';
import {
  ArrowLeftIcon, ChatBubbleOvalLeftEllipsisIcon, MagnifyingGlassIcon, PaperAirplaneIcon, UserGroupIcon,
} from '@heroicons/react/24/outline';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { GENERAL_ID, MAX_MESSAGE_LENGTH, dmId, useChat } from '../../context/ChatContext';
import { C, useUIStore, useToastStore } from '../../lib/theme';
import { roleLabel } from '../../lib/personnel';

// ---------- helpers ----------

// Nombre de messages chargés à la fois (écoute en direct, puis « messages précédents »).
const PAGE_SIZE = 50;
// Un message qui vient d'être envoyé n'a pas encore d'horodatage serveur : il reste tout en bas.
const millisOf = (m) => (m.createdAt?.toMillis ? m.createdAt.toMillis() : Number.MAX_SAFE_INTEGER);

const AVATAR_TONES = [C.teal, C.amber, C.clay, '#5B6FB5', '#8A6BA8', C.sage];
// Versions plus claires pour le texte en mode sombre (contraste suffisant sur fond vert foncé).
const TEXT_TONES_DARK = ['#5FD0B8', '#F0B35C', '#F09A88', '#9DB0F0', '#CDAAE6', '#A6D7BC'];
const ACCENT_DARK = '#5FD0B8';

function toneFor(name = '', dark = false) {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return (dark ? TEXT_TONES_DARK : AVATAR_TONES)[h % AVATAR_TONES.length];
}

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

const sameDay = (a, b) => a.toDateString() === b.toDateString();

function timeFR(d) {
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function dayLabel(d) {
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, now)) return "Aujourd'hui";
  if (sameDay(d, yesterday)) return 'Hier';
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
}

function listTime(d) {
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, now)) return timeFR(d);
  if (sameDay(d, yesterday)) return 'Hier';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

const dateOf = (v) => (v && typeof v.toDate === 'function' ? v.toDate() : null);

function Avatar({ name, group, size = 'h-11 w-11' }) {
  return (
    <div
      className={`${size} flex flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white`}
      style={{ background: group ? C.ink : toneFor(name) }}
    >
      {group ? <UserGroupIcon className="h-5 w-5" /> : initials(name)}
    </div>
  );
}

// ---------- liste des conversations ----------

function ConversationRow({ active, unread, avatar, title, subtitle, time, dark, onClick }) {
  return (
    <button
      type="button" onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors"
      style={{ background: active ? (dark ? '#ffffff14' : '#146C5E14') : 'transparent' }}
    >
      {avatar}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className={`truncate text-sm ${unread ? 'font-semibold' : 'font-medium'} ${dark ? 'text-white' : 'text-gray-800'}`}>{title}</p>
          {time && <span className={`flex-shrink-0 text-[11px] ${unread ? 'font-semibold' : ''}`} style={{ color: unread ? (dark ? ACCENT_DARK : C.teal) : (dark ? '#ffffff59' : '#9ca3af') }}>{time}</span>}
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className={`truncate text-xs ${unread ? (dark ? 'font-medium text-white/80' : 'font-medium text-gray-700') : (dark ? 'text-white/45' : 'text-gray-500')}`}>{subtitle}</p>
          {unread && <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: dark ? ACCENT_DARK : C.teal }} aria-label="Nouveau message" />}
        </div>
      </div>
    </button>
  );
}

function ConversationList({ dark, uid }) {
  const { directory, conversations, unreadById, activeId, setActiveId } = useChat();
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();

  const people = useMemo(() => directory
    .filter((p) => p.id !== uid && (!q || p.name.toLowerCase().includes(q)))
    .map((p) => {
      const convId = dmId(uid, p.id);
      const last = conversations[convId]?.lastMessage;
      return { ...p, convId, last, lastDate: dateOf(last?.createdAt) };
    })
    .sort((a, b) => (b.lastDate?.getTime() || 0) - (a.lastDate?.getTime() || 0) || a.name.localeCompare(b.name, 'fr')),
  [directory, conversations, uid, q]);

  const general = conversations[GENERAL_ID]?.lastMessage;
  const generalPreview = general
    ? `${general.senderId === uid ? 'Vous' : general.senderName} : ${general.text}`
    : 'Tous les employés';
  const showGeneral = !q || 'discussion générale'.includes(q) || 'general'.includes(q);

  const border = dark ? '#ffffff14' : '#00000010';

  return (
    <>
      <div className="border-b px-4 pb-3 pt-4" style={{ borderColor: border }}>
        <h1 className={`font-display text-xl ${dark ? 'text-white' : 'text-gray-800'}`}>Messages</h1>
        <div className="relative mt-3">
          <MagnifyingGlassIcon className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${dark ? 'text-white/40' : 'text-gray-400'}`} />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un collègue"
            className="w-full rounded-xl border py-2 pl-9 pr-3 text-sm outline-none"
            style={{ background: dark ? '#ffffff08' : '#fff', borderColor: dark ? '#ffffff1a' : '#00000014', color: dark ? '#fff' : '#111' }}
          />
        </div>
      </div>
      <div className="scrollbar-thin flex-1 overflow-y-auto py-1">
        {showGeneral && (
          <ConversationRow
            dark={dark} active={activeId === GENERAL_ID} unread={!!unreadById[GENERAL_ID]}
            avatar={<Avatar group />} title="Discussion générale" subtitle={generalPreview}
            time={dateOf(general?.createdAt) ? listTime(dateOf(general.createdAt)) : ''}
            onClick={() => setActiveId(GENERAL_ID)}
          />
        )}
        {people.length > 0 && (
          <p className={`px-4 pb-1 pt-4 text-xs font-medium ${dark ? 'text-white/40' : 'text-gray-400'}`}>Collègues</p>
        )}
        {people.map((p) => (
          <ConversationRow
            key={p.id} dark={dark} active={activeId === p.convId} unread={!!unreadById[p.convId]}
            avatar={<Avatar name={p.name} />} title={p.name}
            subtitle={p.last ? `${p.last.senderId === uid ? 'Vous : ' : ''}${p.last.text}` : roleLabel(p.role)}
            time={p.lastDate ? listTime(p.lastDate) : ''}
            onClick={() => setActiveId(p.convId)}
          />
        ))}
        {q && people.length === 0 && !showGeneral && (
          <p className={`px-4 py-6 text-center text-sm ${dark ? 'text-white/40' : 'text-gray-400'}`}>Aucun collègue trouvé.</p>
        )}
        {!q && people.length === 0 && (
          <p className={`px-4 py-6 text-center text-sm ${dark ? 'text-white/40' : 'text-gray-400'}`}>
            Les autres employés apparaîtront ici dès qu&apos;ils se seront connectés.
          </p>
        )}
      </div>
    </>
  );
}

// ---------- fil de discussion ----------

function Thread({ convId, title, subtitle, isGeneral, dark, uid, onBack }) {
  const { sendMessage } = useChat();
  const push = useToastStore((s) => s.push);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [text, setText] = useState('');
  // Tous les messages déjà vus (id -> message) : ceux qui sortent de la fenêtre « en direct »
  // ne disparaissent donc jamais de l'écran. snapsRef garde les documents Firestore pour le curseur.
  const byIdRef = useRef(new Map());
  const snapsRef = useRef(new Map());
  const anchorRef = useRef(null);
  const endRef = useRef(null);
  const listRef = useRef(null);
  const stickRef = useRef(true);
  const inputRef = useRef(null);

  const mergeSnaps = (docs) => {
    docs.forEach((d) => {
      snapsRef.current.set(d.id, d);
      byIdRef.current.set(d.id, { id: d.id, ...d.data({ serverTimestamps: 'estimate' }) });
    });
    setMessages([...byIdRef.current.values()].sort((a, b) => millisOf(a) - millisOf(b)));
  };

  useEffect(() => {
    byIdRef.current = new Map();
    snapsRef.current = new Map();
    anchorRef.current = null;
    setMessages([]);
    setHasMore(false);
    setLoading(true);
    stickRef.current = true;
    let first = true;
    // Écoute en direct des PAGE_SIZE derniers messages.
    const q = query(collection(db, 'conversations', convId, 'messages'), orderBy('createdAt', 'asc'), limitToLast(PAGE_SIZE));
    const unsub = onSnapshot(q, (snap) => {
      if (first) {
        setHasMore(snap.size >= PAGE_SIZE);
        first = false;
      } else if (snap.size >= PAGE_SIZE && byIdRef.current.size
        && !snap.docs.some((d) => byIdRef.current.has(d.id))) {
        // Plus de PAGE_SIZE messages sont arrivés d'un coup (ex. longue coupure réseau) :
        // il pourrait manquer des messages entre l'ancien affichage et la fenêtre en direct.
        // On repart de la fenêtre en direct ; « messages précédents » comblera l'historique.
        byIdRef.current = new Map();
        snapsRef.current = new Map();
        setHasMore(true);
      }
      mergeSnaps(snap.docs);
      setLoading(false);
    }, () => setLoading(false));
    if (window.matchMedia('(pointer: fine)').matches) inputRef.current?.focus();
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convId]);

  // Charge la page de messages juste avant le plus ancien affiché.
  const loadOlder = async () => {
    if (loadingOlder || !hasMore) return;
    const cursor = snapsRef.current.get(messages[0]?.id);
    if (!cursor) return;
    setLoadingOlder(true);
    try {
      const q = query(
        collection(db, 'conversations', convId, 'messages'),
        orderBy('createdAt', 'asc'), endBefore(cursor), limitToLast(PAGE_SIZE),
      );
      const snap = await getDocs(q);
      const el = listRef.current;
      // Distance au bas de la liste, pour que l'écran ne saute pas quand on ajoute en haut.
      anchorRef.current = el ? el.scrollHeight - el.scrollTop : null;
      mergeSnaps(snap.docs);
      if (snap.size < PAGE_SIZE) setHasMore(false);
    } catch (err) {
      push(err.message || 'Impossible de charger les messages précédents.', 'error');
    } finally {
      setLoadingOlder(false);
    }
  };

  // Reste en bas quand un message arrive, sauf si l'utilisateur relit l'historique.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (anchorRef.current != null && el) {
      el.scrollTop = el.scrollHeight - anchorRef.current;
      anchorRef.current = null;
      return;
    }
    const last = messages[messages.length - 1];
    if (stickRef.current || last?.senderId === uid) endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, uid]);

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text]);

  const onScroll = () => {
    const el = listRef.current;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const send = async () => {
    const value = text.trim();
    if (!value) return;
    setText('');
    stickRef.current = true;
    try {
      await sendMessage(convId, value);
    } catch (err) {
      setText(value);
      push(err.message || "Impossible d'envoyer le message.", 'error');
    }
  };

  const onKeyDown = (e) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
    // Sur téléphone, Entrée = retour à la ligne ; l'envoi se fait avec le bouton.
    if (window.matchMedia('(pointer: coarse)').matches) return;
    e.preventDefault();
    send();
  };

  const border = dark ? '#ffffff14' : '#00000010';

  return (
    <>
      <header className="flex items-center gap-3 border-b px-3 py-3 md:px-5" style={{ borderColor: border }}>
        <button type="button" onClick={onBack} aria-label="Retour aux conversations" className={`rounded-lg p-1.5 md:hidden ${dark ? 'text-white/70' : 'text-gray-600'}`}>
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <Avatar name={title} group={isGeneral} size="h-10 w-10" />
        <div className="min-w-0">
          <p className={`truncate text-sm font-semibold ${dark ? 'text-white' : 'text-gray-800'}`}>{title}</p>
          <p className={`truncate text-xs ${dark ? 'text-white/45' : 'text-gray-500'}`}>{subtitle}</p>
        </div>
      </header>

      <div ref={listRef} onScroll={onScroll} className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4 md:px-6">
        {loading ? (
          <p className={`text-center text-sm ${dark ? 'text-white/40' : 'text-gray-400'}`}>Chargement…</p>
        ) : messages.length === 0 ? (
          <div className={`flex h-full flex-col items-center justify-center text-center ${dark ? 'text-white/40' : 'text-gray-400'}`}>
            <ChatBubbleOvalLeftEllipsisIcon className="mb-3 h-10 w-10 opacity-40" />
            <p className="text-sm">{isGeneral ? "Aucun message pour l'instant. Lancez la discussion avec toute l'équipe." : `Aucun message avec ${title}. Écrivez le premier.`}</p>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col">
            {hasMore && (
              <div className="mb-2 flex justify-center">
                <button
                  type="button" onClick={loadOlder} disabled={loadingOlder}
                  className={`rounded-full px-4 py-1.5 text-xs font-medium transition-opacity disabled:opacity-60 ${dark ? 'bg-white/10 text-white/70 hover:bg-white/15' : 'bg-black/5 text-gray-600 hover:bg-black/10'}`}
                >
                  {loadingOlder ? 'Chargement…' : 'Afficher les messages précédents'}
                </button>
              </div>
            )}
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const d = dateOf(m.createdAt);
              const pd = dateOf(prev?.createdAt);
              const newDay = d && (!pd || !sameDay(d, pd));
              const mine = m.senderId === uid;
              const firstOfGroup = !prev || prev.senderId !== m.senderId || newDay;
              return (
                <div key={m.id}>
                  {newDay && (
                    <div className="my-4 flex justify-center">
                      <span className={`rounded-full px-3 py-1 text-[11px] ${dark ? 'bg-white/10 text-white/60' : 'bg-black/5 text-gray-500'}`}>{dayLabel(d)}</span>
                    </div>
                  )}
                  <div className={`flex ${mine ? 'justify-end' : 'justify-start'} ${firstOfGroup ? 'mt-3' : 'mt-1'}`}>
                    <div
                      className="max-w-[82%] rounded-2xl px-3.5 py-2 text-sm md:max-w-[70%]"
                      style={{
                        background: mine ? C.teal : (dark ? '#ffffff14' : '#fff'),
                        color: mine ? '#fff' : (dark ? '#fff' : '#1f2937'),
                        border: mine ? 'none' : `1px solid ${border}`,
                        borderBottomRightRadius: mine && firstOfGroup ? 6 : undefined,
                        borderBottomLeftRadius: !mine && firstOfGroup ? 6 : undefined,
                      }}
                    >
                      {isGeneral && !mine && firstOfGroup && (
                        <p className="mb-0.5 text-xs font-semibold" style={{ color: toneFor(m.senderName, dark) }}>
                          {m.senderName} <span className="font-normal opacity-60">· {roleLabel(m.senderRole)}</span>
                        </p>
                      )}
                      <p className="whitespace-pre-wrap break-words">{m.text}</p>
                      <p className={`mt-0.5 text-right text-[10px] ${mine ? 'text-white/70' : (dark ? 'text-white/40' : 'text-gray-400')}`}>
                        {d ? timeFR(d) : ''}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <div className="border-t p-3 md:px-6" style={{ borderColor: border }}>
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <textarea
            ref={inputRef} value={text} rows={1} maxLength={MAX_MESSAGE_LENGTH}
            onChange={(e) => setText(e.target.value)} onKeyDown={onKeyDown}
            placeholder={isGeneral ? 'Écrire à toute l\'équipe…' : `Écrire à ${title}…`}
            className="max-h-36 min-h-[42px] flex-1 resize-none rounded-2xl border px-4 py-2.5 text-sm outline-none"
            style={{ background: dark ? '#ffffff08' : '#fff', borderColor: dark ? '#ffffff1a' : '#00000014', color: dark ? '#fff' : '#111' }}
          />
          <button
            type="button" onClick={send} disabled={!text.trim()} aria-label="Envoyer"
            className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-full text-white transition-opacity disabled:opacity-40"
            style={{ background: C.teal }}
          >
            <PaperAirplaneIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </>
  );
}

// ---------- page ----------

export default function MessagesPage() {
  const { user } = useAuth();
  const dark = useUIStore((s) => s.dark);
  const { directory, conversations, unreadById, activeId, setActiveId, markRead } = useChat();
  const uid = user.uid;

  // Sur ordinateur on ouvre directement la discussion générale ; sur téléphone, la liste.
  useEffect(() => {
    if (window.matchMedia('(min-width: 768px)').matches) setActiveId(GENERAL_ID);
    return () => setActiveId(null);
  }, [setActiveId]);

  // Marque la conversation ouverte comme lue (y compris les messages qui arrivent pendant qu'elle est ouverte).
  const [visible, setVisible] = useState(!document.hidden);
  useEffect(() => {
    const onVis = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
  const activeUnread = !!(activeId && unreadById[activeId]);
  const lastMillis = conversations[activeId]?.lastMessage?.createdAt?.toMillis?.() || 0;
  useEffect(() => {
    if (activeId && activeUnread && visible) markRead(activeId);
  }, [activeId, activeUnread, lastMillis, visible, markRead]);

  const isGeneral = activeId === GENERAL_ID;
  const other = activeId && !isGeneral
    ? directory.find((p) => p.id === activeId.split('_').slice(1).find((x) => x !== uid))
    : null;
  const title = isGeneral ? 'Discussion générale' : (other?.name || 'Conversation');
  const subtitle = isGeneral ? `Tous les employés · ${directory.length} membre${directory.length > 1 ? 's' : ''}` : roleLabel(other?.role);

  const border = dark ? '#ffffff14' : '#00000010';
  const panel = dark ? C.cardDark : '#FBFAF6';

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] md:h-screen" style={{ background: panel }}>
      <aside
        className={`${activeId ? 'hidden md:flex' : 'flex'} w-full flex-col border-r md:w-80 md:flex-shrink-0`}
        style={{ borderColor: border }}
      >
        <ConversationList dark={dark} uid={uid} />
      </aside>
      <section className={`${activeId ? 'flex' : 'hidden md:flex'} min-w-0 flex-1 flex-col`}>
        {activeId ? (
          <Thread
            key={activeId} convId={activeId} title={title} subtitle={subtitle}
            isGeneral={isGeneral} dark={dark} uid={uid} onBack={() => setActiveId(null)}
          />
        ) : (
          <div className={`flex flex-1 flex-col items-center justify-center text-center ${dark ? 'text-white/40' : 'text-gray-400'}`}>
            <ChatBubbleOvalLeftEllipsisIcon className="mb-3 h-12 w-12 opacity-40" />
            <p className="text-sm">Choisissez une conversation.</p>
          </div>
        )}
      </section>
    </div>
  );
}
