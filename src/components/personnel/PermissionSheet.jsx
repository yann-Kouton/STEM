import { formatDateFR, formatDuree, normaliserDemande, splitHM } from '../../lib/permission';

export const PAPER_FONT = "Cambria, Georgia, 'Times New Roman', serif";
export const GREEN = '#1f6b4f';
export const INK = '#14206b'; // « stylo bleu » pour les valeurs remplies

// Logo à l'octogone (approximation du logo du papier à en-tête ; remplaçable).
function OctagonLogo({ className }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <polygon points="30,4 70,4 96,30 96,70 70,96 30,96 4,70 4,30" fill="none" stroke={GREEN} strokeWidth="3" />
      <line x1="50" y1="22" x2="50" y2="82" stroke={GREEN} strokeWidth="3" strokeLinecap="round" />
      <circle cx="50" cy="19" r="3.5" fill={GREEN} />
      <path d="M50 30 C30 34 30 46 50 50 C70 54 70 66 50 70" fill="none" stroke={GREEN} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M50 30 C70 34 70 46 50 50 C30 54 30 66 50 70" fill="none" stroke={GREEN} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M47 25 C38 20 30 22 24 28 C32 28 38 30 46 31 Z" fill={GREEN} />
      <path d="M53 25 C62 20 70 22 76 28 C68 28 62 30 54 31 Z" fill={GREEN} />
    </svg>
  );
}

// Cadre commun : en-tête, titre, corps encadré, pied de page — identique au formulaire papier.
export function PaperFrame({ children }) {
  return (
    <div
      className="permission-sheet mx-auto w-full max-w-[794px] bg-white text-[#1a1a1a] shadow-xl"
      style={{ fontFamily: PAPER_FONT }}
    >
      <div className="px-5 pb-6 pt-7 sm:px-10">
        <header className="flex items-center gap-4 sm:gap-6">
          <OctagonLogo className="h-16 w-16 flex-shrink-0 sm:h-20 sm:w-20" />
          <div className="flex-1 text-center">
            <p className="text-[22px] italic leading-tight sm:text-[30px]" style={{ color: GREEN }}>
              Pharmacie Ste Marie Majeure{' '}
              <span className="text-[11px] font-semibold not-italic tracking-wide">SUARL</span>
            </p>
            <p className="mt-2 text-sm sm:text-base">Dr AKA Lyne WAYOU</p>
            <p className="text-xs sm:text-sm">Pharmacien</p>
            <div className="mx-auto mt-1 h-px w-2/3" style={{ background: GREEN }} />
          </div>
        </header>

        <h2 className="mx-auto mt-7 w-fit border-2 border-gray-700 px-3 py-0.5 text-lg font-bold tracking-wide sm:text-xl">
          DEMANDE DE PERMISSION
        </h2>

        <div className="mt-5 divide-y divide-gray-700 border border-gray-700">{children}</div>

        <footer className="mt-8 border-t pt-3 text-center text-[11px] leading-relaxed sm:text-xs" style={{ borderColor: GREEN }}>
          <p className="italic" style={{ color: GREEN }}>Marcory Zone 4C, Rue du Canal, face Immeuble Les Elfes</p>
          <p>Tél:(+225) 27 21 25 54 07 / 01 40 30 69 80 - Mail: phcie_marie.majeure@yahoo.fr</p>
          <p>Espace vétérinaire: Cél: (+225) 07 00 00 26 36</p>
          <p>N°CC: 1013852 R - RC N°:2010-B-2751 / BICICI:N°CI 006 01754 0100279000 15 92</p>
        </footer>
      </div>
    </div>
  );
}

// Zone de valeur soulignée en pointillés, comme les « ........ » du papier.
function Blank({ children, className = '', min = '3rem' }) {
  return (
    <span
      className={`inline-block border-b border-dotted border-gray-600 px-1 text-center align-baseline ${className}`}
      style={{ minWidth: min, color: INK }}
    >
      {children || '\u00A0'}
    </span>
  );
}

function Line({ label, value }) {
  return (
    <p className="mt-2 flex items-baseline gap-1 text-[15px]">
      <span className="flex-shrink-0">{label}</span>
      <span className="flex-1 border-b border-dotted border-gray-600 px-1" style={{ color: INK }}>
        {value || '\u00A0'}
      </span>
    </p>
  );
}

function Check({ checked }) {
  return (
    <span
      className="mx-1 inline-flex h-5 w-5 items-center justify-center border border-gray-700 align-middle text-sm font-bold"
      style={{ color: INK }}
    >
      {checked ? '✕' : ''}
    </span>
  );
}

function SignatureImg({ src }) {
  return src ? (
    <img src={src} alt="Signature" className="inline-block h-12 align-middle" />
  ) : (
    <Blank min="9rem" />
  );
}

// Fiche en lecture seule. `decisionSlot` remplace le contenu de la décision
// (utilisé par le Docteur pour saisir sa décision directement sur la fiche).
export default function PermissionSheet({ demande, decisionSlot }) {
  const d = normaliserDemande(demande);
  const [hd, md] = splitHM(d.heures?.debut);
  const [hf, mf] = splitHM(d.heures?.fin);
  const dec = d.decision;

  return (
    <PaperFrame>
      <section className="px-4 py-4 sm:px-6">
        <h3 className="text-[15px] font-bold">DEMANDEUR</h3>
        <Line label="Nom :" value={d.nom} />
        <Line label="prénoms :" value={d.prenoms} />
        <Line label="Fonction :" value={d.fonction} />

        <h3 className="mt-5 text-[15px] font-bold">PERIODE DEMANDEE :</h3>
        <p className="mt-3 text-[15px] leading-8">
          Nombre d&apos;heures : <Blank min="4rem">{d.heures ? formatDuree(d.heures.minutes) : ''}</Blank> : de{' '}
          <Blank min="2rem">{hd}</Blank>h<Blank min="2rem">{md}</Blank>mn, à{' '}
          <Blank min="2rem">{hf}</Blank>h<Blank min="2rem">{mf}</Blank>mn.
          {d.heures?.date && (
            <span className="text-gray-500"> (le <span style={{ color: INK }}>{formatDateFR(d.heures.date)}</span>)</span>
          )}
        </p>
        <p className="text-[15px] leading-8">
          Nombre de jours : <Blank min="2.5rem">{d.jours?.nombre}</Blank> jrs : du{' '}
          <Blank min="6rem">{formatDateFR(d.jours?.du)}</Blank> au{' '}
          <Blank min="6rem">{formatDateFR(d.jours?.au)}</Blank> inclus.
        </p>

        <div className="mt-2 flex gap-1 text-[15px]">
          <span className="flex-shrink-0">motifs :</span>
          <div
            className="min-h-[84px] flex-1 whitespace-pre-wrap break-words px-1"
            style={{
              color: INK,
              lineHeight: '28px',
              backgroundImage: 'repeating-linear-gradient(transparent, transparent 26px, #6b7280 26px, #6b7280 27px)',
            }}
          >
            {d.motifs}
          </div>
        </div>

        <div className="mt-4 text-right text-[15px]">
          <p>
            Abidjan, le <Blank min="6.5rem">{formatDateFR(d.dateDemande)}</Blank>
          </p>
          <p className="mt-3">
            Signature : <SignatureImg src={d.signature} />
          </p>
        </div>
      </section>

      <section className="px-4 py-4 sm:px-6">
        <h3 className="text-[15px] font-bold">DECISION DU DOCTEUR:</h3>
        {decisionSlot || (
          <div className="mt-3 text-[15px]">
            <p className="leading-8">
              Accord de Dr <Blank min="9rem">{dec?.docteurNom}</Blank> : OUI
              <Check checked={dec?.accord === true} /> NON
              <Check checked={dec?.accord === false} />
            </p>
            <div className="mt-2 text-right">
              <p>
                Abidjan, le <Blank min="6.5rem">{formatDateFR(dec?.date)}</Blank>
              </p>
              <p className="mt-3">
                Signature : <SignatureImg src={dec?.signature} />
              </p>
            </div>
          </div>
        )}
      </section>
    </PaperFrame>
  );
}
