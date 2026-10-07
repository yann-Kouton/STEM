import { useState } from 'react';
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useEmployee } from '../../context/EmployeeContext';
import { C, useToastStore } from '../../lib/theme';
import { roleLabel } from '../../lib/personnel';
import { formatDuree, joursInclus, minutesEntre, splitNomComplet, todayISO } from '../../lib/permission';
import { INK, PaperFrame } from './PermissionSheet';
import SignaturePad from './SignaturePad';

const dotted =
  'bg-transparent border-0 border-b border-dotted border-gray-600 px-1 py-0.5 outline-none ' +
  'focus:border-solid focus:border-[#146C5E] disabled:opacity-40 rounded-none';

function Field({ label, children }) {
  return (
    <label className="mt-2 flex items-baseline gap-1 text-[15px]">
      <span className="flex-shrink-0">{label}</span>
      {children}
    </label>
  );
}

// Formulaire de demande de permission : mêmes rubriques, même ordre que le papier.
export default function PermissionForm({ onDone, onCancel }) {
  const { user } = useAuth();
  const { employee } = useEmployee();
  const push = useToastStore((s) => s.push);

  const guess = splitNomComplet(employee?.displayName || user?.displayName || '');
  const [nom, setNom] = useState(employee?.nom ?? guess.nom);
  const [prenoms, setPrenoms] = useState(employee?.prenoms ?? guess.prenoms);
  const [fonction, setFonction] = useState(employee?.fonction ?? roleLabel(employee?.role));

  const [parJours, setParJours] = useState(true);
  const [du, setDu] = useState(todayISO());
  const [au, setAu] = useState(todayISO());

  const [parHeures, setParHeures] = useState(false);
  const [dateHeures, setDateHeures] = useState(todayISO());
  const [debut, setDebut] = useState('');
  const [fin, setFin] = useState('');

  const [motifs, setMotifs] = useState('');
  const [dateDemande, setDateDemande] = useState(todayISO());
  const [signature, setSignature] = useState(null);
  const [saving, setSaving] = useState(false);

  const nbJours = joursInclus(du, au);
  const minutes = minutesEntre(debut, fin);

  const validate = () => {
    if (!nom.trim() || !prenoms.trim() || !fonction.trim()) return 'Renseignez votre nom, vos prénoms et votre fonction.';
    if (!parJours && !parHeures) return 'Choisissez une période : en heures, en jours, ou les deux.';
    if (parJours && nbJours == null) return 'Les dates « du … au … » sont incorrectes (la fin doit être après le début).';
    if (parHeures && (!dateHeures || minutes == null)) return "Les heures sont incorrectes (l'heure de fin doit être après l'heure de début).";
    if (!motifs.trim()) return 'Indiquez le motif de votre demande.';
    if (!signature) return 'Signez la demande avant de l\'envoyer.';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const error = validate();
    if (error) {
      push(error, 'error');
      return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, 'demandes_permission'), {
        employeId: user.uid,
        employeNom: `${prenoms.trim()} ${nom.trim()}`,
        role: employee?.role || null,
        nom: nom.trim(),
        prenoms: prenoms.trim(),
        fonction: fonction.trim(),
        heures: parHeures ? { minutes, debut, fin, date: dateHeures } : null,
        jours: parJours ? { nombre: nbJours, du, au } : null,
        motifs: motifs.trim(),
        dateDemande,
        signature,
        statut: 'en_attente',
        decision: null,
        createdAt: serverTimestamp(),
      });
      // On mémorise l'identité pour préremplir la prochaine demande (sans bloquer l'envoi).
      updateDoc(doc(db, 'employes', user.uid), {
        nom: nom.trim(), prenoms: prenoms.trim(), fonction: fonction.trim(),
      }).catch(() => {});
      push('Demande envoyée au Docteur.', 'success');
      onDone?.();
    } catch (err) {
      push(err.message || "Impossible d'envoyer la demande.", 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaperFrame>
        <section className="px-4 py-4 sm:px-6" style={{ color: INK }}>
          <h3 className="text-[15px] font-bold text-[#1a1a1a]">DEMANDEUR</h3>
          <div className="text-[#1a1a1a]">
            <Field label="Nom :">
              <input value={nom} onChange={(e) => setNom(e.target.value)} required className={`${dotted} min-w-0 flex-1`} style={{ color: INK }} />
            </Field>
            <Field label="prénoms :">
              <input value={prenoms} onChange={(e) => setPrenoms(e.target.value)} required className={`${dotted} min-w-0 flex-1`} style={{ color: INK }} />
            </Field>
            <Field label="Fonction :">
              <input value={fonction} onChange={(e) => setFonction(e.target.value)} required className={`${dotted} min-w-0 flex-1`} style={{ color: INK }} />
            </Field>
          </div>

          <h3 className="mt-5 text-[15px] font-bold text-[#1a1a1a]">PERIODE DEMANDEE :</h3>

          <div className="mt-3 text-[15px] text-[#1a1a1a]">
            <label className="flex items-center gap-2 font-medium">
              <input type="checkbox" checked={parHeures} onChange={(e) => setParHeures(e.target.checked)} className="h-4 w-4 accent-[#146C5E]" />
              Nombre d&apos;heures
              {parHeures && <span className="font-normal" style={{ color: INK }}>: {minutes != null ? formatDuree(minutes) : '—'}</span>}
            </label>
            <div className={`mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-2 pl-6 ${parHeures ? '' : 'opacity-40'}`}>
              <span>le</span>
              <input type="date" value={dateHeures} onChange={(e) => setDateHeures(e.target.value)} disabled={!parHeures} className={`${dotted} w-40`} style={{ color: INK }} />
              <span>de</span>
              <input type="time" value={debut} onChange={(e) => setDebut(e.target.value)} disabled={!parHeures} className={`${dotted} w-28`} style={{ color: INK }} />
              <span>à</span>
              <input type="time" value={fin} onChange={(e) => setFin(e.target.value)} disabled={!parHeures} className={`${dotted} w-28`} style={{ color: INK }} />
            </div>

            <label className="mt-4 flex items-center gap-2 font-medium">
              <input type="checkbox" checked={parJours} onChange={(e) => setParJours(e.target.checked)} className="h-4 w-4 accent-[#146C5E]" />
              Nombre de jours
              {parJours && <span className="font-normal" style={{ color: INK }}>: {nbJours != null ? `${nbJours} jrs` : '—'}</span>}
            </label>
            <div className={`mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-2 pl-6 ${parJours ? '' : 'opacity-40'}`}>
              <span>du</span>
              <input
                type="date" value={du} disabled={!parJours}
                onChange={(e) => { setDu(e.target.value); if (au < e.target.value) setAu(e.target.value); }}
                className={`${dotted} w-40`} style={{ color: INK }}
              />
              <span>au</span>
              <input type="date" value={au} min={du} onChange={(e) => setAu(e.target.value)} disabled={!parJours} className={`${dotted} w-40`} style={{ color: INK }} />
              <span>inclus.</span>
            </div>

            <div className="mt-5 flex gap-1">
              <span className="flex-shrink-0">motifs :</span>
              <textarea
                value={motifs} onChange={(e) => setMotifs(e.target.value)} required rows={3}
                className="min-h-[84px] flex-1 resize-y border-0 px-1 outline-none focus:bg-emerald-50/50"
                style={{
                  color: INK,
                  lineHeight: '28px',
                  backgroundImage: 'repeating-linear-gradient(transparent, transparent 26px, #6b7280 26px, #6b7280 27px)',
                }}
              />
            </div>

            <div className="mt-5 sm:ml-auto sm:w-72">
              <label className="flex items-baseline justify-end gap-2">
                Abidjan, le
                <input type="date" value={dateDemande} onChange={(e) => setDateDemande(e.target.value)} className={`${dotted} w-40`} style={{ color: INK }} />
              </label>
              <p className="mb-1 mt-3">Signature :</p>
              <SignaturePad onChange={setSignature} />
            </div>
          </div>
        </section>

        <section className="px-4 py-4 text-[#1a1a1a] sm:px-6">
          <h3 className="text-[15px] font-bold">DECISION DU DOCTEUR:</h3>
          <p className="mt-2 text-sm italic text-gray-500">
            Cette partie sera remplie par le Docteur après réception de votre demande.
          </p>
        </section>
      </PaperFrame>

      <div className="mx-auto mt-5 flex max-w-[794px] flex-wrap justify-end gap-3">
        <button
          type="button" onClick={onCancel}
          className="rounded-xl border border-black/10 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Annuler
        </button>
        <button
          type="submit" disabled={saving}
          className="rounded-xl px-6 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          style={{ background: C.teal }}
        >
          {saving ? 'Envoi…' : 'Envoyer la demande'}
        </button>
      </div>
    </form>
  );
}
