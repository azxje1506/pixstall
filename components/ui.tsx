// Linh kiện giao diện nhỏ dùng chung (kiểu inspector Framer): Seg, Slider (nhãn trái · thanh kéo · ô số), Num, Prop, Group, Modal
// Kích thước bám lưới 4px: hàng 32px, khoảng cách 8/12/16 — style nằm trong app/globals.css
import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";

export function Seg<T extends string>({ value, options, onChange, full }: {
  value: T; options: { v: T; label?: string; icon?: ReactNode; title?: string }[]; onChange: (v: T) => void; full?: boolean;
}) {
  return (
    <div className={`seg ${full ? "full" : ""}`}>
      {options.map((o) => (
        <button key={o.v} className={o.v === value ? "on" : ""} title={o.title ?? o.label} onClick={() => onChange(o.v)}>
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Ô số gõ được: Enter/blur thì chốt, ↑↓ tăng giảm (Shift ×10); prefix là chữ nhỏ phía trước (vd X, Y)
export function Num({ value, onChange, step = 1, min = -Infinity, max = Infinity, unit = "", prefix }: {
  value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; unit?: string; prefix?: string;
}) {
  const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  const [txt, setTxt] = useState(fmt(value));
  useEffect(() => setTxt(fmt(value)), [value]);
  const commit = (v: number) => { if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v))); else setTxt(fmt(value)); };
  return (
    <label className="num">
      {prefix && <span className="pre">{prefix}</span>}
      <input value={txt} inputMode="decimal" onChange={(e) => setTxt(e.target.value)}
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

// Một hàng thuộc tính: nhãn cột trái 72px, điều khiển chiếm phần còn lại
export function Prop({ label, children, hot }: { label: string; children: ReactNode; hot?: boolean }) {
  return (
    <div className={`prop ${hot ? "hot" : ""}`}>
      <span className="plab">{label}</span>
      <div className="pctl">{children}</div>
    </div>
  );
}

export function Slider({ label, value, min, max, step = 1, unit = "", onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void;
}) {
  return (
    <Prop label={label}>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)}
        style={{ ["--fill" as string]: `${((value - min) / (max - min)) * 100}%` }} />
      <Num value={value} min={min} max={max} step={step} unit={unit} onChange={onChange} />
    </Prop>
  );
}

export function Group({ title, right, children }: { title?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="group">
      {title && (
        <div className="ghead">
          <span className="ttl">{title}</span>
          {right}
        </div>
      )}
      {children}
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
