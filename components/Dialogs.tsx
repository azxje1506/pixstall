// Hộp thoại: thêm/xoá cỡ máy tự chọn (SizeDialog), xuất ZIP (ExportDialog), bảng phím tắt (KeysDialog)
// Export: thẻ cỡ có ảnh xem trước slide 1, nhớ lựa chọn lần trước (localStorage), thanh tiến độ + nút Huỷ (AbortController)
import { useMemo, useRef, useState } from "react";
import { Ruler, Trash, FileArchive, Download, TriangleAlert, LoaderCircle, Plus, Keyboard, X, Check } from "lucide-react";
import type { Kind, Project, SizePreset, Store } from "@/lib/types";
import { LOCALES, uid } from "@/lib/presets";
import { allSizes, sizeWarnings } from "@/lib/rules";
import { SlideCanvas, FeatureCanvas } from "./SlideCanvas";
import { exportZip, planFiles, download } from "@/lib/exporter";
import { Modal, Seg } from "./ui";

// --- Thêm cỡ máy tự chọn ---
export function SizeDialog({ p, onAdd, onRemove, onClose }: { p: Project; onAdd: (z: SizePreset) => void; onRemove: (id: string) => void; onClose: () => void }) {
  const [z, setZ] = useState<SizePreset>({ id: "", name: "My device", w: 1290, h: 2796, store: p.store, kind: "phone", custom: true });
  const warns = sizeWarnings(z);
  const bad = z.w < 200 || z.h < 200 || z.w > 6000 || z.h > 6000 || !z.name.trim();
  const ratio = (z.h / z.w).toFixed(2);
  return (
    <Modal title="Custom device size" icon={<Ruler />} onClose={onClose}>
      <div className="form">
        <label>Name<input className="field" value={z.name} onChange={(e) => setZ({ ...z, name: e.target.value })} /></label>
        <div className="two">
          <label>Width (px)<input className="field" type="number" value={z.w} onChange={(e) => setZ({ ...z, w: +e.target.value })} /></label>
          <label>Height (px)<input className="field" type="number" value={z.h} onChange={(e) => setZ({ ...z, h: +e.target.value })} /></label>
        </div>
        <div className="two">
          <label>Store<Seg full value={z.store} onChange={(store: Store) => setZ({ ...z, store })} options={[{ v: "ios", label: "App Store" }, { v: "play", label: "Google Play" }]} /></label>
          <label>Device<Seg full value={z.kind} onChange={(kind: Kind) => setZ({ ...z, kind })} options={[{ v: "phone", label: "Phone" }, { v: "tablet", label: "Tablet" }]} /></label>
        </div>
        <p className="hint mono">Aspect 1 : {ratio}</p>
        {warns.map((w) => <p key={w} className="warnline"><TriangleAlert />{w}</p>)}
        <button className="primary wide" disabled={bad} onClick={() => onAdd({ ...z, id: uid() })}><Plus />Add size</button>
        {p.customSizes.length > 0 && <>
          <span className="lab" style={{ marginTop: 8 }}>Your sizes</span>
          {p.customSizes.map((c) => (
            <div key={c.id} className="row sizeitem">
              <span>{c.name} <span className="mono">{c.w}×{c.h} · {c.store === "ios" ? "App Store" : "Play"}</span></span>
              <button className="ibtn" title="Remove" onClick={() => onRemove(c.id)}><Trash /></button>
            </div>
          ))}
        </>}
      </div>
    </Modal>
  );
}

// --- Xuất ZIP ---
const EKEY = "pixstall:export-prefs";
type Prefs = { picked: string[]; locs: string[]; format: "png" | "jpg"; feature: boolean };
const readPrefs = (): Partial<Prefs> => { try { return JSON.parse(localStorage.getItem(EKEY) || "{}"); } catch { return {}; } };

export function ExportDialog({ p, onClose, onDone }: { p: Project; onClose: () => void; onDone: (n: number) => void }) {
  const sizes = allSizes(p);
  const saved = useMemo(readPrefs, []);
  const usedLocs = useMemo(() => Object.keys(LOCALES).filter((l) => l === "en" || p.slides.some((s) => s.t[l])), [p.slides]);
  const [picked, setPicked] = useState<string[]>(() => {
    const ok = saved.picked?.filter((id) => sizes.some((z) => z.id === id));
    return ok?.length ? ok : sizes.filter((z) => z.store === p.store && (z.custom || ["ip69", "ipad13", "ph", "tab10"].includes(z.id))).map((z) => z.id);
  });
  const [locs, setLocs] = useState<string[]>(() => { const ok = saved.locs?.filter((l) => usedLocs.includes(l)); return ok?.length ? ok : usedLocs; });
  const [format, setFormat] = useState<"png" | "jpg">(saved.format ?? "png");
  const [feature, setFeature] = useState(saved.feature ?? p.store === "play");
  const [prog, setProg] = useState<[number, number] | null>(null);
  const [err, setErr] = useState("");
  const ctrl = useRef<AbortController | null>(null);

  const opts = { sizes: sizes.filter((z) => picked.includes(z.id)), locales: locs, format, feature };
  const files = planFiles(p, opts);
  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const name = (p.name || p.feature.name || "app").toLowerCase().replace(/\W+/g, "-").replace(/^-|-$/g, "") || "app";

  const run = async () => {
    setErr("");
    localStorage.setItem(EKEY, JSON.stringify({ picked, locs, format, feature }));
    setProg([0, files.length]);
    ctrl.current = new AbortController();
    try {
      const blob = await exportZip(p, opts, (d, t) => setProg([d, t]), ctrl.current.signal);
      download(blob, `pixstall-${name}.zip`);
      onDone(files.length);
      onClose();
    } catch (e) {
      const m = e instanceof Error ? e.message : "Export failed";
      setErr(m === "Cancelled" ? "" : m);
      setProg(null);
    }
  };

  // Thẻ một cỡ: ảnh xem trước slide 1 ở đúng tỉ lệ + tên + kích thước
  const card = (z: SizePreset) => {
    const on = picked.includes(z.id), tw = Math.min(40, (64 * z.w) / z.h);
    return (
      <button key={z.id} className={`scard ${on ? "on" : ""}`} aria-pressed={on} onClick={() => setPicked(toggle(picked, z.id))}>
        <span className="sthumb"><span className="thumb-in"><SlideCanvas p={{ ...p, store: z.store }} index={0} width={tw} size={z} /></span></span>
        <span className="smeta">
          <span className="sname">{z.name}{z.custom && <span className="tag soft">custom</span>}</span>
          <span className="mono">{z.w}×{z.h}</span>
        </span>
        <span className="sbox">{on && <Check />}</span>
      </button>
    );
  };

  return (
    <Modal title="Export for stores" icon={<FileArchive />} onClose={prog ? () => {} : onClose} width={620}>
      <div className="form">
        {(["ios", "play"] as Store[]).map((st) => (
          <div key={st}>
            <span className="lab">{st === "ios" ? "App Store sizes" : "Google Play sizes"}</span>
            <div className="scards">
              {sizes.filter((z) => z.store === st).map(card)}
              {st === "play" && (
                <button className={`scard ${feature ? "on" : ""}`} aria-pressed={feature} onClick={() => setFeature(!feature)}>
                  <span className="sthumb wide"><span className="thumb-in"><FeatureCanvas p={p} width={64} /></span></span>
                  <span className="smeta"><span className="sname">Feature graphic</span><span className="mono">1024×500</span></span>
                  <span className="sbox">{feature && <Check />}</span>
                </button>
              )}
            </div>
          </div>
        ))}
        <span className="lab">Languages</span>
        <div className="chips">
          {usedLocs.map((l) => (
            <button key={l} className={`pill ${locs.includes(l) ? "on" : ""}`} onClick={() => setLocs(toggle(locs, l))}>{LOCALES[l]}</button>
          ))}
        </div>
        <span className="lab">Format</span>
        <Seg full value={format} onChange={setFormat} options={[{ v: "png", label: "PNG · RGB, App Store-safe" }, { v: "jpg", label: "JPG · smaller files" }]} />
        <p className="hint">{format === "png" ? "Lossless, saved without transparency — Apple rejects screenshots with an alpha channel." : "95% quality. Good for Google Play; App Store accepts it too."}</p>
        <div className="tree">{files.slice(0, 12).join("\n")}{files.length > 12 ? `\n… +${files.length - 12} more` : ""}</div>
        {err && <p className="warnline"><TriangleAlert />{err}</p>}
        {prog && <div className="bar"><div style={{ width: `${(prog[0] / Math.max(prog[1], 1)) * 100}%` }} /></div>}
        <div className="row">
          <span className="mono">{prog ? `Rendering ${prog[0]} / ${prog[1]}…` : `${files.length} files · pixstall-${name}.zip`}</span>
          {prog
            ? <button className="ghost sm" onClick={() => ctrl.current?.abort()}><X />Cancel</button>
            : <button className="primary" disabled={!files.length} onClick={run}><Download />Download ZIP</button>}
        </div>
        {prog && <p className="hint"><LoaderCircle className="spin" /> Keep this tab open until it finishes.</p>}
      </div>
    </Modal>
  );
}

// --- Bảng phím tắt (mở bằng phím ? hoặc nút bàn phím trên thanh trên) ---
const KEYS: [string, [string, string][]][] = [
  ["General", [["Ctrl Z", "Undo"], ["Ctrl Shift Z", "Redo"], ["Ctrl D", "Duplicate slide"], ["← →", "Previous / next slide"], ["?", "Show shortcuts"]]],
  ["Canvas", [["Click", "Select device or text"], ["Double‑click", "Edit text"], ["↑ ↓ ← →", "Nudge selection (Shift = ×4)"], ["Esc", "Deselect"], ["Right‑click", "More actions"]]],
  ["View", [["Ctrl +/−", "Zoom in / out"], ["Ctrl 0", "Zoom to fit"], ["Ctrl Scroll", "Zoom at cursor"], ["Space Drag", "Pan"]]],
  ["Inspector", [["Drag label", "Scrub the value"], ["Shift Alt", "Faster / finer scrub"], ["↑ ↓", "Step a number field (Shift ×10)"]]],
];

export function KeysDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Keyboard shortcuts" icon={<Keyboard />} onClose={onClose} width={560}>
      <div className="keys">
        {KEYS.map(([g, rows]) => (
          <div key={g}>
            <span className="lab">{g}</span>
            {rows.map(([k, d]) => (
              <div key={k} className="krow"><span>{d}</span><span className="kk">{k.split(" ").map((x, i) => <kbd key={i}>{x}</kbd>)}</span></div>
            ))}
          </div>
        ))}
      </div>
    </Modal>
  );
}
