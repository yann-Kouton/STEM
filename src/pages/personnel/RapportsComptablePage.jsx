import { useEffect, useRef, useState } from 'react';
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp, where } from 'firebase/firestore';
import {
  DocumentArrowUpIcon, ArrowDownTrayIcon, DocumentTextIcon, LockClosedIcon,
} from '@heroicons/react/24/outline';
import { db } from '../../firebase/config';
import { uploadToCloudinary } from '../../lib/cloudinary';
import { useAuth } from '../../context/AuthContext';
import { useEmployee } from '../../context/EmployeeContext';
import { C, useUIStore, useToastStore } from '../../lib/theme';

const ACCEPTED = '.xlsx,.xls,.pdf,.docx,.doc';

function formatDate(ts) {
  if (!ts?.seconds) return '';
  return new Date(ts.seconds * 1000).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function RapportsComptablePage() {
  const { user } = useAuth();
  const { employee, isComptable, isReviewer } = useEmployee();
  const dark = useUIStore((s) => s.dark);
  const push = useToastStore((s) => s.push);
  const fileRef = useRef(null);
  const [dateRapport, setDateRapport] = useState(() => new Date().toISOString().slice(0, 10));
  const [uploading, setUploading] = useState(false);
  const [mine, setMine] = useState([]);
  const [all, setAll] = useState([]);

  useEffect(() => {
    if (!isComptable || !user) return undefined;
    const q = query(collection(db, 'rapports_comptables'), where('auteurId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      rows.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setMine(rows);
    });
    return () => unsub();
  }, [isComptable, user]);

  useEffect(() => {
    if (!isReviewer) return undefined;
    const q = query(collection(db, 'rapports_comptables'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => setAll(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, [isReviewer]);

  const handleUpload = async (e) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) { push('Sélectionnez un fichier (Excel, PDF ou Word).', 'error'); return; }
    setUploading(true);
    try {
      const uploaded = await uploadToCloudinary(file, 'raw');
      await addDoc(collection(db, 'rapports_comptables'), {
        auteurId: user.uid,
        auteurNom: employee?.displayName || user.displayName || user.email,
        fileName: file.name,
        fileUrl: uploaded.url,
        fileType: file.name.split('.').pop(),
        dateRapport,
        createdAt: serverTimestamp(),
      });
      if (fileRef.current) fileRef.current.value = '';
      push('Rapport transmis au Docteur Principal.', 'success');
    } catch (err) {
      push(err.message || "Échec de l'envoi du rapport.", 'error');
    } finally {
      setUploading(false);
    }
  };

  const cardStyle = { background: dark ? C.cardDark : C.card, border: `1px solid ${dark ? '#ffffff14' : '#00000010'}` };

  if (!isComptable && !isReviewer) {
    return (
      <div className="p-6 md:p-8 max-w-2xl mx-auto text-center py-24">
        <LockClosedIcon className={`h-10 w-10 mx-auto mb-3 ${dark ? 'text-white/30' : 'text-gray-300'}`} />
        <p className={dark ? 'text-white/50' : 'text-gray-500'}>
          Cette section est réservée au Comptable et à la Direction.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className={`font-display text-2xl ${dark ? 'text-white' : 'text-gray-800'}`}>Rapports journaliers</h1>
        <p className={`text-sm mt-1 ${dark ? 'text-white/50' : 'text-gray-500'}`}>
          {isComptable ? 'Transmettez votre rapport (Excel, PDF ou Word) au Docteur Principal.' : 'Rapports transmis par le Comptable.'}
        </p>
      </div>

      {isComptable && (
        <form onSubmit={handleUpload} className="p-5 rounded-2xl space-y-3 mb-8" style={cardStyle}>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="date" value={dateRapport} onChange={(e) => setDateRapport(e.target.value)}
              className="px-4 py-2.5 rounded-xl border outline-none text-sm"
              style={{ background: dark ? '#ffffff08' : '#fff', borderColor: dark ? '#ffffff1a' : '#00000014', color: dark ? '#fff' : '#111' }}
            />
            <input
              ref={fileRef} type="file" accept={ACCEPTED} required
              className={`flex-1 text-sm ${dark ? 'text-white/70' : 'text-gray-600'}`}
            />
          </div>
          <button
            type="submit" disabled={uploading}
            className="flex items-center gap-2 text-white text-sm font-medium px-5 py-2.5 rounded-xl disabled:opacity-60"
            style={{ background: C.teal }}
          >
            <DocumentArrowUpIcon className="h-4 w-4" />
            {uploading ? 'Envoi en cours…' : 'Transmettre le rapport'}
          </button>
        </form>
      )}

      {isComptable && (
        <div className="mb-8">
          <h2 className={`text-xs font-mono uppercase tracking-wide mb-3 ${dark ? 'text-white/40' : 'text-gray-400'}`}>Mes envois</h2>
          {mine.length === 0 ? (
            <p className={`text-sm ${dark ? 'text-white/30' : 'text-gray-400'}`}>Aucun rapport envoyé pour l'instant.</p>
          ) : (
            <div className="space-y-2">
              {mine.map((r) => <RapportRow key={r.id} r={r} dark={dark} showAuteur={false} />)}
            </div>
          )}
        </div>
      )}

      {isReviewer && (
        <div>
          <h2 className={`text-xs font-mono uppercase tracking-wide mb-3 ${dark ? 'text-white/40' : 'text-gray-400'}`}>Rapports reçus</h2>
          {all.length === 0 ? (
            <div className={`text-center py-16 rounded-2xl ${dark ? 'text-white/40' : 'text-gray-400'}`}>
              <DocumentTextIcon className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Aucun rapport reçu pour le moment.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {all.map((r) => <RapportRow key={r.id} r={r} dark={dark} showAuteur />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RapportRow({ r, dark, showAuteur }) {
  return (
    <a
      href={r.fileUrl} target="_blank" rel="noreferrer"
      className="flex items-center justify-between gap-3 p-4 rounded-2xl hover:shadow-md transition-shadow"
      style={{ background: dark ? '#0F2E29' : '#fff', border: `1px solid ${dark ? '#ffffff14' : '#00000010'}` }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${C.amber}22` }}>
          <DocumentTextIcon className="h-5 w-5" style={{ color: C.amber }} />
        </div>
        <div className="min-w-0">
          <p className={`text-sm font-medium truncate ${dark ? 'text-white' : 'text-gray-800'}`}>{r.fileName}</p>
          <p className={`text-xs font-mono ${dark ? 'text-white/40' : 'text-gray-400'}`}>
            {formatDate(r.createdAt)} {showAuteur && r.auteurNom ? `· ${r.auteurNom}` : ''} {r.dateRapport ? `· pour le ${r.dateRapport}` : ''}
          </p>
        </div>
      </div>
      <ArrowDownTrayIcon className={`h-5 w-5 flex-shrink-0 ${dark ? 'text-white/40' : 'text-gray-400'}`} />
    </a>
  );
}
