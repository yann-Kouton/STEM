import { useEffect, useRef, useState } from 'react';

// Résolution interne fixe ; l'affichage est responsive via CSS.
const W = 600;
const H = 200;
// Taille de l'image enregistrée dans Firestore (quelques Ko seulement).
const OUT_W = 300;
const OUT_H = 100;

// Zone de signature au doigt / à la souris / au stylet.
// Non contrôlé : appelle onChange(dataURL) à la fin de chaque trait, onChange(null) à l'effacement.
export default function SignaturePad({ onChange, disabled = false }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineWidth = 3.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#14206b';
  }, []);

  const point = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * W) / r.width, y: ((e.clientY - r.top) * H) / r.height };
  };

  const onDown = (e) => {
    if (disabled) return;
    e.preventDefault();
    canvasRef.current.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = point(e);
    last.current = p;
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.01, p.y);
    ctx.stroke();
    setHasInk(true);
  };

  const onMove = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const p = point(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };

  const onUp = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const out = document.createElement('canvas');
    out.width = OUT_W;
    out.height = OUT_H;
    out.getContext('2d').drawImage(canvasRef.current, 0, 0, OUT_W, OUT_H);
    onChange?.(out.toDataURL('image/png'));
  };

  const clear = () => {
    canvasRef.current.getContext('2d').clearRect(0, 0, W, H);
    setHasInk(false);
    onChange?.(null);
  };

  return (
    <div>
      <div
        className="relative rounded-md border border-dashed border-gray-400 bg-white"
        style={{ touchAction: 'none' }}
      >
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="block w-full h-auto cursor-crosshair rounded-md"
          style={{ aspectRatio: `${W} / ${H}`, touchAction: 'none' }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onPointerLeave={onUp}
          aria-label="Zone de signature"
        />
        {!hasInk && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-gray-400">
            Signez ici avec le doigt ou la souris
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={clear}
        disabled={!hasInk}
        className="mt-1.5 text-xs text-gray-500 hover:text-gray-800 disabled:opacity-40 underline underline-offset-2"
      >
        Effacer la signature
      </button>
    </div>
  );
}
