// Linh kiện giao diện nhỏ dùng chung: Segmented, Slider (nhãn VIẾT HOA + số mono), Group, Modal
import type { ReactNode } from "react";
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

export function Slider({ label, value, min, max, step = 1, unit = "", onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="row">
        <span className="lab">{label}</span>
        <span className="mono">{Number.isInteger(value) ? value : value.toFixed(1)}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
    </div>
  );
}

export function Group({ title, right, children }: { title?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="group">
      {title && (
        <div className="row">
          <span className="lab">{title}</span>
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
