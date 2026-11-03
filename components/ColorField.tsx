// Ô chọn màu tự làm (thay input[type=color] mặc định): bấm ô màu → popover gồm
// vùng Saturation/Value + thanh Hue + ô HEX + màu vừa dùng (nhớ 8 màu, localStorage) + màu gợi ý. Click ra ngoài / Esc để đóng.
// onChange gọi liên tục khi kéo — truyền tag ở chỗ gọi để gộp undo
import { useEffect, useRef, useState, type PointerEvent as RPE } from "react";

// --- Đổi màu HEX ⇄ HSV (h 0..360, s/v 0..1) ---
function hexToHsv(hex: string): [number, number, number] {
  const m = hex.replace("#", "").padEnd(6, "0");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m.slice(i, i + 2), 16) / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, mx ? d / mx : 0, mx];
}
function hsvToHex(h: number, s: number, v: number): string {
  const f = (n: number) => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return "#" + [f(5), f(3), f(1)].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
}
const isHex = (s: string) => /^#?[0-9a-f]{6}$/i.test(s.trim());

const RKEY = "pixstall:recent-colors";
const PRESET = ["#FFFFFF", "#F1F0FF", "#111827", "#5B5BF0", "#A78BFA", "#FF7A59", "#FFC371", "#0EA5E9", "#10B981", "#EC4899"];
const readRecent = (): string[] => { try { return JSON.parse(localStorage.getItem(RKEY) || "[]"); } catch { return []; } };
const pushRecent = (c: string) => localStorage.setItem(RKEY, JSON.stringify([c.toUpperCase(), ...readRecent().filter((x) => x !== c.toUpperCase())].slice(0, 8)));

// Kéo trong một vùng: trả toạ độ 0..1 theo khung phần tử
function track(e: RPE<HTMLDivElement>, fn: (x: number, y: number) => void) {
  const el = e.currentTarget, r = el.getBoundingClientRect();
  const at = (ev: { clientX: number; clientY: number }) => fn(Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)));
  at(e);
  const up = () => { window.removeEventListener("pointermove", at); window.removeEventListener("pointerup", up); };
  window.addEventListener("pointermove", at);
  window.addEventListener("pointerup", up);
}

export function ColorField({ value, onChange, label }: { value: string; onChange: (hex: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const [hsv, setHsv] = useState(() => hexToHsv(value));
  const [txt, setTxt] = useState(value.toUpperCase());
  const box = useRef<HTMLDivElement>(null);

  // Đồng bộ khi màu đổi từ ngoài (preset, undo) — giữ hue cũ nếu màu xám
  useEffect(() => {
    setTxt(value.toUpperCase());
    if (hsvToHex(...hsv) !== value.toUpperCase()) { const n = hexToHsv(value); setHsv(n[1] ? n : [hsv[0], n[1], n[2]]); }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Click ra ngoài / Esc → đóng và ghi vào "vừa dùng"
  useEffect(() => {
    if (!open) return;
    const close = () => { setOpen(false); pushRecent(value); };
    const down = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) close(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
    window.addEventListener("pointerdown", down);
    window.addEventListener("keydown", key, true);
    return () => { window.removeEventListener("pointerdown", down); window.removeEventListener("keydown", key, true); };
  }, [open, value]);

  const set = (n: [number, number, number]) => { setHsv(n); onChange(hsvToHex(...n)); };
  const recent = open ? readRecent() : [];

  return (
    <div className="cf" ref={box}>
      <button className="cf-btn" aria-label={`${label}: ${value}`} title={label} onClick={() => setOpen(!open)}>
        <span className="cf-sw" style={{ background: value }} />
        <span className="mono">{value.toUpperCase().slice(1)}</span>
      </button>
      {open && (
        <div className="cf-pop" role="dialog" aria-label={label}>
          <div className="cf-sv" style={{ background: `hsl(${hsv[0]} 100% 50%)` }} onPointerDown={(e) => track(e, (x, y) => set([hsv[0], x, 1 - y]))}>
            <span style={{ left: `${hsv[1] * 100}%`, top: `${(1 - hsv[2]) * 100}%`, background: value }} />
          </div>
          <div className="cf-hue" onPointerDown={(e) => track(e, (x) => set([x * 359.9, hsv[1], hsv[2]]))}>
            <span style={{ left: `${(hsv[0] / 360) * 100}%`, background: `hsl(${hsv[0]} 100% 50%)` }} />
          </div>
          <label className="num cf-hex">
            <span className="pre">HEX</span>
            <input value={txt} aria-label="Hex color" onChange={(e) => { setTxt(e.target.value); if (isHex(e.target.value)) onChange(("#" + e.target.value.trim().replace("#", "")).toUpperCase()); }}
              onBlur={() => setTxt(value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
          </label>
          {recent.length > 0 && <><span className="plab">Recent</span><div className="cf-row">{recent.map((c) => <button key={c} aria-label={c} title={c} style={{ background: c }} onClick={() => onChange(c)} />)}</div></>}
          <span className="plab">Presets</span>
          <div className="cf-row">{PRESET.map((c) => <button key={c} aria-label={c} title={c} style={{ background: c }} onClick={() => onChange(c)} />)}</div>
        </div>
      )}
    </div>
  );
}
