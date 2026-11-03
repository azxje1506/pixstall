// Cột phải (kiểu Framer): 2 tab — "Slide"/"Feature" (thuộc tính riêng) và "Style" (Theme dùng chung mọi slide)
// Mọi thay đổi đi qua update(fn, tag) — tag giúp gộp các lần kéo slider thành 1 bước undo
// Panel đi theo vật chọn trên canvas (pick): chọn máy → nhóm Device lên đầu; chọn chữ → nhóm Text lên đầu; tự nhảy về tab Slide
// Nhóm có id thì thu gọn được (nhớ trong localStorage); Layout và Device có nút "Apply to all" chép sang mọi slide
import { useEffect, useState, type ReactNode } from "react";
import { ImageUp, CopyPlus, ImageOff, RotateCcw, Smartphone, EyeOff, TextAlignStart, TextAlignCenter, Sun, Moon, Type,
  PanelBottom, ArrowDownToLine, Copy, MoveRight, CopyCheck } from "lucide-react";
import type { Project, Slide, Theme, Feature, Layout, Tilt3D, FrameStyle, FrameColor, Bg } from "@/lib/types";
import { FONTS, FRAME_COLORS, GRADIENTS, TILT_PRESETS, DEFAULT_THEME, LOCALES } from "@/lib/presets";
import { textOf } from "@/lib/rules";
import { mockScreen } from "@/lib/mocks";
import { FEATURE_ICONS } from "./icons";
import { Seg, Slider, Group, Num, Prop, Tabs } from "./ui";
import { ColorField } from "./ColorField";
import type { CanvasPick } from "./SlideCanvas";

type Update = (fn: (d: Project) => Project, tag?: string) => void;
type PTab = "item" | "style";

const LAYOUTS: { v: Layout; label: string; icon: ReactNode }[] = [
  { v: "center", label: "Center", icon: <Smartphone /> },
  { v: "bleed", label: "Bleed", icon: <ArrowDownToLine /> },
  { v: "offset", label: "Offset", icon: <MoveRight /> },
  { v: "duo", label: "Duo", icon: <Copy /> },
  { v: "bottom", label: "Text ↓", icon: <PanelBottom /> },
];

const BG_HINT: Record<Bg, string> = {
  color: "Solid color on every slide.",
  gradient: "Same gradient on each slide.",
  panorama: "One background flows across all slides — seamless when users swipe.",
  blur: "Each screenshot becomes its own blurred backdrop (upload images to see it).",
};

// Nút nhỏ trên tiêu đề nhóm: chép thiết lập slide này sang mọi slide
const ApplyAll = ({ onClick }: { onClick: () => void }) => (
  <button className="gbtn" title="Copy this setting to every slide" onClick={onClick}><CopyCheck />Apply to all</button>
);

// --- Khối Device: vị trí máy + nghiêng 3D + cỡ (dùng cho slide và feature) ---
function DeviceControls({ v, scaleRange, onChange, tag, hot, right, label = "Device" }: {
  v: Tilt3D & { scale: number; dx?: number; dy?: number }; scaleRange: [number, number]; tag: string; hot: boolean; right?: ReactNode; label?: string;
  onChange: (patch: Partial<Tilt3D & { scale: number; dx: number; dy: number }>, tag?: string) => void;
}) {
  const active = TILT_PRESETS.find((t) => t.v.rx === v.rx && t.v.ry === v.ry && t.v.rz === v.rz)?.id;
  return (
    <Group id={`${tag}-device`} title={label} right={right}>
      <Prop label="Position" hot={hot}>
        <Num prefix="X" value={v.dx ?? 0} step={0.5} onChange={(dx) => onChange({ dx }, tag + "dx")} />
        <Num prefix="Y" value={v.dy ?? 0} step={0.5} onChange={(dy) => onChange({ dy }, tag + "dy")} />
      </Prop>
      <Slider label="Size" value={v.scale} min={scaleRange[0]} max={scaleRange[1]} unit="%" onChange={(scale) => onChange({ scale }, tag + "sc")} />
      <span className="sublab">3D tilt</span>
      <div className="presets">
        {TILT_PRESETS.map((t) => (
          <button key={t.id} className={active === t.id ? "on" : ""} onClick={() => onChange(t.v)}>
            <span className="tilt-ico" style={{ transform: `perspective(60px) rotateX(${t.v.rx}deg) rotateY(${t.v.ry}deg) rotateZ(${t.v.rz}deg)` }} />
            {t.label}
          </button>
        ))}
      </div>
      <Slider label="Lean X" value={v.rx} min={-45} max={45} unit="°" onChange={(rx) => onChange({ rx }, tag + "rx")} />
      <Slider label="Turn Y" value={v.ry} min={-45} max={45} unit="°" onChange={(ry) => onChange({ ry }, tag + "ry")} />
      <Slider label="Spin Z" value={v.rz} min={-45} max={45} unit="°" onChange={(rz) => onChange({ rz }, tag + "rz")} />
    </Group>
  );
}

// --- Tab Style: khung máy, nền, chữ — dùng chung mọi slide ---
function StyleTab({ t, set }: { t: Theme; set: (patch: Partial<Theme>, tag?: string) => void }) {
  const gOn = (a: string, b: string) => t.bg !== "color" && t.c1.toUpperCase() === a.toUpperCase() && t.c2.toUpperCase() === b.toUpperCase();
  return (
    <>
      <p className="tabnote">Applies to every slide{t.bg === "panorama" ? " and the feature graphic" : ""}.</p>
      <Group id="st-frame" title="Device frame">
        <Seg full value={t.frame} onChange={(frame: FrameStyle) => set({ frame })} options={[
          { v: "auto", label: "Auto" }, { v: "iphone", label: "iPhone" }, { v: "pixel", label: "Pixel" }, { v: "none", label: "None" },
        ]} />
        <Prop label="Color">
          <div className="swatches">
            {(Object.keys(FRAME_COLORS) as FrameColor[]).map((c) => (
              <button key={c} title={FRAME_COLORS[c].label} aria-label={`Frame ${FRAME_COLORS[c].label}`} className={t.frameColor === c ? "on" : ""} style={{ background: FRAME_COLORS[c].body }} onClick={() => set({ frameColor: c })} />
            ))}
            <span className="mono">{FRAME_COLORS[t.frameColor].label}</span>
          </div>
        </Prop>
        <Slider label="Bezel" value={t.bezel} min={0} max={6} step={0.2} unit="%" onChange={(bezel) => set({ bezel }, "bezel")} />
        <Slider label="Radius" value={t.radius} min={0} max={20} step={0.5} unit="%" onChange={(radius) => set({ radius }, "radius")} />
        <Slider label="Depth" value={t.depth} min={0} max={8} step={0.5} unit="%" onChange={(depth) => set({ depth }, "depth")} />
        <Slider label="Shadow" value={t.shadow} min={0} max={60} onChange={(shadow) => set({ shadow }, "shadow")} />
      </Group>
      <Group id="st-bg" title="Background">
        <Seg full value={t.bg} onChange={(bg: Bg) => set({ bg })} options={[
          { v: "color", label: "Color" }, { v: "gradient", label: "Gradient" }, { v: "panorama", label: "Panorama" }, { v: "blur", label: "Blur" },
        ]} />
        <p className="hint">{BG_HINT[t.bg]}</p>
        {t.bg === "color"
          ? <Prop label="Fill"><ColorField label="Background color" value={t.solid} onChange={(solid) => set({ solid }, "solid")} /></Prop>
          : <>
              <Prop label="From"><ColorField label="Gradient start" value={t.c1} onChange={(c1) => set({ c1 }, "c1")} /></Prop>
              <Prop label="To"><ColorField label="Gradient end" value={t.c2} onChange={(c2) => set({ c2 }, "c2")} /></Prop>
            </>}
        <Prop label="Presets">
          <div className="swatches">
            {GRADIENTS.map(([a, b]) => (
              <button key={a} className={gOn(a, b) ? "on" : ""} title={`Gradient ${a} → ${b}`} aria-label={`Gradient ${a} to ${b}`} style={{ background: `linear-gradient(135deg,${a},${b})` }} onClick={() => set({ c1: a, c2: b, ...(t.bg === "color" ? { bg: "gradient" as Bg } : {}) })} />
            ))}
          </div>
        </Prop>
        {t.bg === "blur" && <>
          <Slider label="Blur" value={t.blur} min={0} max={30} onChange={(blur) => set({ blur }, "blur")} />
          <Slider label="Overlay" value={t.overlay} min={0} max={80} unit="%" onChange={(overlay) => set({ overlay }, "overlay")} />
        </>}
      </Group>
      <Group id="st-type" title="Typography">
        <Prop label="Font">
          <label className="chip"><Type />
            <select value={t.font} aria-label="Font" onChange={(e) => set({ font: e.target.value })}>
              {Object.keys(FONTS).map((f) => <option key={f}>{f}</option>)}
            </select>
          </label>
        </Prop>
        <Slider label="Size" value={t.tsize} min={5} max={12} step={0.5} onChange={(tsize) => set({ tsize }, "tsize")} />
        <Prop label="Align">
          <Seg full value={t.align} onChange={(align: Theme["align"]) => set({ align })} options={[
            { v: "left", icon: <TextAlignStart />, title: "Left" }, { v: "center", icon: <TextAlignCenter />, title: "Center" },
          ]} />
        </Prop>
        <Prop label="Ink">
          <Seg full value={t.ink} onChange={(ink: Theme["ink"]) => set({ ink })} options={[
            { v: "light", label: "Light", icon: <Sun /> }, { v: "dark", label: "Dark", icon: <Moon /> },
          ]} />
        </Prop>
      </Group>
      <div className="group">
        <button className="ghost" onClick={() => set({ ...DEFAULT_THEME })}><RotateCcw />Reset style</button>
      </div>
    </>
  );
}

export function Inspector({ p, sel, tab, update, pick, onReplace, onReplaceFile, onDuplicate, onFlash }: {
  p: Project; sel: number; tab: "slide" | "feature"; update: Update; pick: CanvasPick;
  onReplace: () => void; onReplaceFile: (f?: File) => void; onDuplicate: () => void; onFlash: (m: string, undo?: boolean) => void;
}) {
  const [ptab, setPtab] = useState<PTab>("item");
  const [hot, setHot] = useState(false); // kéo file ngang thẻ Screenshot
  useEffect(() => { if (pick) setPtab("item"); }, [pick]); // chọn trên canvas → về tab thuộc tính

  const setTheme = (patch: Partial<Theme>, tag?: string) => update((d) => ({ ...d, theme: { ...d.theme, ...patch } }), tag);
  const setSlide = (patch: Partial<Slide>, tag?: string) =>
    update((d) => ({ ...d, slides: d.slides.map((s, i) => (i === sel ? { ...s, ...patch } : s)) }), tag);
  const setFeature = (patch: Partial<Feature>, tag?: string) => update((d) => ({ ...d, feature: { ...d.feature, ...patch } }), tag);
  const applyAll = (patch: Partial<Slide>, what: string) => {
    update((d) => ({ ...d, slides: d.slides.map((s) => ({ ...s, ...patch })) }));
    onFlash(`${what} applied to all ${p.slides.length} slides`, true);
  };

  const isFeature = tab === "feature";
  const head = (
    <div className="phead">
      <Tabs value={ptab} onChange={setPtab} options={[{ v: "item", label: isFeature ? "Feature" : "Slide" }, { v: "style", label: "Style" }]} />
    </div>
  );
  if (ptab === "style") return <aside className="right">{head}<StyleTab t={p.theme} set={setTheme} /></aside>;

  // --- Tab Feature graphic ---
  if (isFeature) {
    const f = p.feature;
    const text = (
      <Group key="text" id="f-text" title="Text & icon" right={<span className="mono">1024×500</span>}>
        <input className="field" value={f.name} aria-label="App name" placeholder="App name" onChange={(e) => setFeature({ name: e.target.value }, "fname")} />
        <input className="field" value={f.tagline} aria-label="Tagline" placeholder="Tagline" onChange={(e) => setFeature({ tagline: e.target.value }, "ftag")} />
        <Prop label="Position" hot={pick === "text"}>
          <Num prefix="X" value={f.tx ?? 0} step={0.5} onChange={(tx) => setFeature({ tx }, "ftx")} />
          <Num prefix="Y" value={f.ty ?? 0} step={0.5} onChange={(ty) => setFeature({ ty }, "fty")} />
        </Prop>
        <span className="sublab">Icon</span>
        <div className="icons">
          {Object.entries(FEATURE_ICONS).map(([k, I]) => (
            <button key={k} title={k} aria-label={`Icon ${k}`} className={f.icon === k ? "on" : ""} onClick={() => setFeature({ icon: k })}><I /></button>
          ))}
        </div>
      </Group>
    );
    const devices = (
      <div key="dev">
        <div className="group">
          <Seg full value={f.device ? "on" : "off"} onChange={(v) => setFeature({ device: v === "on" })} options={[
            { v: "on", label: "Show devices", icon: <Smartphone /> }, { v: "off", label: "Hide", icon: <EyeOff /> },
          ]} />
        </div>
        {f.device && <DeviceControls label="Devices" v={f} scaleRange={[12, 30]} tag="f" hot={pick === "device"} onChange={(patch, tg) => setFeature(patch, tg)} />}
      </div>
    );
    return <aside className="right">{head}{pick === "device" ? [devices, text] : [text, devices]}</aside>;
  }

  // --- Tab Slide ---
  const s = p.slides[sel];
  if (!s) return <aside className="right">{head}</aside>;
  const [title, sub] = textOf(s, p.loc);
  const setText = (k: 0 | 1, v: string) => {
    const cur: [string, string] = [...textOf(s, p.loc)] as [string, string];
    cur[k] = v;
    setSlide({ t: { ...s.t, [p.loc]: cur } }, `text${k}`);
  };

  const textGroup = (
    <Group key="text" id="s-text" title="Text" right={<span className="mono">{LOCALES[p.loc]}</span>}>
      <textarea className="field" rows={2} value={title} aria-label="Headline" placeholder="Headline" onChange={(e) => setText(0, e.target.value)} />
      <input className="field" value={sub} aria-label="Subtitle" placeholder="Subtitle (optional)" onChange={(e) => setText(1, e.target.value)} />
      <Prop label="Position" hot={pick === "text"}>
        <Num prefix="X" value={s.tx ?? 0} step={0.5} onChange={(tx) => setSlide({ tx }, "ptx")} />
        <Num prefix="Y" value={s.ty ?? 0} step={0.5} onChange={(ty) => setSlide({ ty }, "pty")} />
      </Prop>
    </Group>
  );

  // Thẻ ảnh chụp: xem ảnh đang dùng (hoặc màn mẫu), bấm/thả để thay, gỡ để quay về màn mẫu
  const shotGroup = (
    <Group key="shot" id="s-shot" title="Screenshot">
      <div className={`shot ${hot ? "hot" : ""}`}
        onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); e.stopPropagation(); setHot(true); } }}
        onDragLeave={() => setHot(false)}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setHot(false); onReplaceFile(e.dataTransfer.files[0]); }}>
        <div className="shot-img">
          {s.img ? <img src={s.img} alt="" draggable={false} /> : <div className="shot-mock" dangerouslySetInnerHTML={{ __html: mockScreen(s.mock) }} />}
          {!s.img && <span className="shot-tag">Sample</span>}
        </div>
        <div className="shot-meta">
          <span className="shot-t">{s.img ? "Your screenshot" : "Sample screen"}</span>
          <span className="hint">{hot ? "Drop to replace" : s.img ? "Drop a new image to replace" : "Replace it with your app's screen"}</span>
          <span className="row g4">
            <button className="primary sm" onClick={onReplace}><ImageUp />{s.img ? "Replace" : "Upload"}</button>
            {s.img && <button className="ghost sm" title="Remove image" aria-label="Remove image" onClick={() => setSlide({ img: null })}><ImageOff /></button>}
          </span>
        </div>
      </div>
    </Group>
  );

  const layoutGroup = (
    <Group key="layout" id="s-layout" title="Layout" right={<ApplyAll onClick={() => applyAll({ layout: s.layout }, "Layout")} />}>
      <div className="layouts">
        {LAYOUTS.map((l) => (
          <button key={l.v} title={l.label} className={s.layout === l.v ? "on" : ""} onClick={() => setSlide({ layout: l.v })}>{l.icon}{l.label}</button>
        ))}
      </div>
    </Group>
  );

  const moved = !!(s.dx || s.dy || s.tx || s.ty);
  const deviceGroup = (
    <DeviceControls key="dev" v={s} scaleRange={[40, 100]} tag="s" hot={pick === "device"} onChange={(patch, tg) => setSlide(patch, tg)}
      right={<ApplyAll onClick={() => applyAll({ rx: s.rx, ry: s.ry, rz: s.rz, scale: s.scale }, "Device tilt & size")} />} />
  );

  // Thứ tự nhóm theo vật đang chọn trên canvas
  const order = pick === "device" ? [deviceGroup, layoutGroup, textGroup, shotGroup]
    : pick === "text" ? [textGroup, layoutGroup, shotGroup, deviceGroup]
    : [textGroup, shotGroup, layoutGroup, deviceGroup];

  return (
    <aside className="right">
      {head}
      <div className="slidebar">
        <span className="ttl">Slide {String(sel + 1).padStart(2, "0")}</span>
        <span className="row g4">
          {moved && <button className="gbtn" title="Reset device & text positions" onClick={() => setSlide({ dx: 0, dy: 0, tx: 0, ty: 0 })}><RotateCcw />Reset position</button>}
          <button className="ibtn" title="Duplicate slide" aria-label="Duplicate slide" onClick={onDuplicate}><CopyPlus /></button>
        </span>
      </div>
      {order}
    </aside>
  );
}
