// Hộp thoại: thêm/xoá cỡ máy tự chọn (SizeDialog) và xuất ZIP có tiến độ (ExportDialog)
import { useMemo, useState } from "react";
import { Ruler, Trash, FileArchive, Download, TriangleAlert, LoaderCircle, Plus } from "lucide-react";
import type { Kind, Project, SizePreset, Store } from "@/lib/types";
import { LOCALES, uid } from "@/lib/presets";
import { allSizes, sizeWarnings } from "@/lib/rules";
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
export function ExportDialog({ p, onClose }: { p: Project; onClose: () => void }) {
  const sizes = allSizes(p);
  const [picked, setPicked] = useState<string[]>(() => sizes.filter((z) => z.store === p.store && (z.custom || ["ip69", "ipad13", "ph", "tab10"].includes(z.id))).map((z) => z.id));
  const usedLocs = useMemo(() => Object.keys(LOCALES).filter((l) => l === "en" || p.slides.some((s) => s.t[l])), [p.slides]);
  const [locs, setLocs] = useState<string[]>(usedLocs);
  const [format, setFormat] = useState<"png" | "jpg">("png");
  const [feature, setFeature] = useState(p.store === "play");
  const [prog, setProg] = useState<[number, number] | null>(null);
  const [err, setErr] = useState("");

  const opts = { sizes: sizes.filter((z) => picked.includes(z.id)), locales: locs, format, feature };
  const files = planFiles(p, opts);
  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const run = async () => {
    setErr("");
    setProg([0, files.length]);
    try {
      const blob = await exportZip(p, opts, (d, t) => setProg([d, t]));
      download(blob, `pixstall-${p.feature.name.toLowerCase().replace(/\W+/g, "-") || "app"}.zip`);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Export failed");
      setProg(null);
    }
  };

  return (
    <Modal title="Export for stores" icon={<FileArchive />} onClose={prog ? () => {} : onClose} width={560}>
      <div className="form">
        <span className="lab">Sizes</span>
        <div className="checks">
          {(["ios", "play"] as Store[]).map((st) => (
            <div key={st}>
              <div className="mono" style={{ margin: "2px 0 4px" }}>{st === "ios" ? "App Store" : "Google Play"}</div>
              {sizes.filter((z) => z.store === st).map((z) => (
                <label key={z.id} className="check-row">
                  <input type="checkbox" checked={picked.includes(z.id)} onChange={() => setPicked(toggle(picked, z.id))} />
                  {z.name}{z.custom && <span className="tag">custom</span>} <span className="mono">{z.w}×{z.h}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
        <label className="check-row"><input type="checkbox" checked={feature} onChange={() => setFeature(!feature)} />Google Play feature graphic <span className="mono">1024×500</span></label>
        <span className="lab">Languages</span>
        <div className="chips">
          {usedLocs.map((l) => (
            <button key={l} className={`pill ${locs.includes(l) ? "on" : ""}`} onClick={() => setLocs(toggle(locs, l))}>{LOCALES[l]}</button>
          ))}
        </div>
        <span className="lab">Format</span>
        <Seg value={format} onChange={setFormat} options={[{ v: "png", label: "PNG" }, { v: "jpg", label: "JPG · no alpha" }]} />
        <div className="tree">{files.slice(0, 14).join("\n")}{files.length > 14 ? `\n… +${files.length - 14} more` : ""}</div>
        {err && <p className="warnline"><TriangleAlert />{err}</p>}
        <div className="row">
          <span className="mono">{files.length} files</span>
          <button className="primary" disabled={!files.length || !!prog} onClick={run}>
            {prog ? <><LoaderCircle className="spin" />Rendering {prog[0]}/{prog[1]}</> : <><Download />Download ZIP</>}
          </button>
        </div>
        {prog && <div className="bar"><div style={{ width: `${(prog[0] / Math.max(prog[1], 1)) * 100}%` }} /></div>}
      </div>
    </Modal>
  );
}
