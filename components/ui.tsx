// Linh kiện giao diện nhỏ dùng chung (kiểu inspector Framer): Seg, Slider, Num, Prop, Group (thu gọn được), Tabs, Modal
// Kích thước bám lưới 4px: hàng 28px, khoảng cách 8/12/16 — style nằm trong app/globals.css
// - Prop có `scrub` → kéo ngang trên NHÃN để đổi số (như Framer/Figma); Shift = nhanh ×10, Alt = chậm ×0.1
// - Group có `id` → bấm tiêu đề để thu gọn, trạng thái nhớ trong localStorage
import { useEffect, useState, type ReactNode, type PointerEvent as RPE } from "react";
import { X, ChevronRight } from "lucide-react";

export function Seg<T extends string>({ value, options, onChange, full }: {
  value: T; options: { v: T; label?: string; icon?: ReactNode; title?: string }[]; onChange: (v: T) => void; full?: boolean;
}) {
  return (
    <div className={`seg ${full ? "full" : ""}`}>
      {options.map((o) => (
        <button key={o.v} className={o.v === value ? "on" : ""} title={o.title ?? o.label} aria-label={o.title ?? o.label} onClick={() => onChange(o.v)}>
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Ô số gõ được: Enter/blur thì chốt, ↑↓ tăng giảm (Shift ×10); prefix là chữ nhỏ phía trước (vd X, Y), unit nằm trong ô
export function Num({ value, onChange, step = 1, min = -Infinity, max = Infinity, unit = "", prefix, label }: {
  value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; unit?: string; prefix?: string; label?: string;
}) {
  const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  const [txt, setTxt] = useState(fmt(value));
  useEffect(() => setTxt(fmt(value)), [value]);
  const commit = (v: number) => { if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v))); else setTxt(fmt(value)); };
  return (
    <label className="num">
      {prefix && <span className="pre">{prefix}</span>}
      <input value={txt} inputMode="decimal" aria-label={label ?? prefix} onChange={(e) => setTxt(e.target.value)} onFocus={(e) => e.target.select()}
        onBlur={() => commit(parseFloat(txt))}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault(); const d = (e.key === "ArrowUp" ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
            commit(Math.round((value + d) * 10) / 10);
          }
        }} />
      {unit && <span className="unit">{unit}</span>}
    </label>
  );
}

export interface Scrub { value: number; min: number; max: number; step: number; onChange: (v: number) => void }

// Kéo trên nhãn để đổi số: 1px = 1 step (Shift ×10, Alt ×0.1), làm tròn theo step
function startScrub(e: RPE, s: Scrub) {
  if (e.button !== 0) return;
  e.preventDefault();
  const x0 = e.clientX, v0 = s.value;
  const dec = s.step < 1 ? 1 : 0;
  const move = (ev: PointerEvent) => {
    const k = ev.shiftKey ? 10 : ev.altKey ? 0.1 : 1;
    const raw = v0 + (ev.clientX - x0) * s.step * k;
    const v = Math.min(s.max, Math.max(s.min, Math.round(raw / s.step) * s.step));
    s.onChange(+v.toFixed(dec));
  };
  const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); document.body.classList.remove("scrubbing"); };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  document.body.classList.add("scrubbing");
}

// Một hàng thuộc tính: nhãn cột trái 64px, điều khiển chiếm phần còn lại
export function Prop({ label, children, hot, scrub }: { label: string; children: ReactNode; hot?: boolean; scrub?: Scrub }) {
  return (
    <div className={`prop ${hot ? "hot" : ""}`}>
      <span className={`plab ${scrub ? "scrub" : ""}`} title={scrub ? "Drag to adjust · Shift faster · Alt finer" : undefined}
        onPointerDown={scrub ? (e) => startScrub(e, scrub) : undefined}>{label}</span>
      <div className="pctl">{children}</div>
    </div>
  );
}

export function Slider({ label, value, min, max, step = 1, unit = "", onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void;
}) {
  return (
    <Prop label={label} scrub={{ value, min, max, step, onChange }}>
      <input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)}
        style={{ ["--fill" as string]: `${((value - min) / (max - min)) * 100}%` }} />
      <Num value={value} min={min} max={max} step={step} unit={unit} label={label} onChange={onChange} />
    </Prop>
  );
}

// --- Nhóm thu gọn được (nhớ trạng thái theo id) ---
const GKEY = "pixstall:closed-groups";
const readClosed = (): string[] => { try { return JSON.parse(localStorage.getItem(GKEY) || "[]"); } catch { return []; } };

export function Group({ id, title, right, children }: { id?: string; title?: string; right?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(() => !(id && readClosed().includes(id)));
  const toggle = () => {
    if (!id) return;
    const next = !open; setOpen(next);
    const c = readClosed().filter((x) => x !== id);
    localStorage.setItem(GKEY, JSON.stringify(next ? c : [...c, id]));
  };
  return (
    <div className={`group ${open ? "" : "closed"}`}>
      {title && (
        <div className="ghead">
          {id ? (
            <button className="gtoggle" aria-expanded={open} onClick={toggle}>
              <ChevronRight className="chev" />
              <span className="ttl">{title}</span>
            </button>
          ) : <span className="ttl">{title}</span>}
          {open && right}
        </div>
      )}
      {open && children}
    </div>
  );
}

// Tab đầu panel (Slide | Style)
export function Tabs<T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: string; badge?: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {options.map((o) => (
        <button key={o.v} role="tab" aria-selected={o.v === value} className={o.v === value ? "on" : ""} onClick={() => onChange(o.v)}>
          {o.label}{o.badge}
        </button>
      ))}
    </div>
  );
}

export function Modal({ title, icon, onClose, children, width = 520 }: { title: string; icon?: ReactNode; onClose: () => void; children: ReactNode; width?: number }) {
  return (
    <div className="modal" onMouseDown={onClose}>
      <div className="box" style={{ width }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="hd">
          <span className="hd-t">{icon}{title}</span>
          <button className="ibtn" onClick={onClose} aria-label="Close"><X /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
