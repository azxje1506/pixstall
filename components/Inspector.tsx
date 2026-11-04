// Cột phải (kiểu Framer): CHỈ hiện setting của layer đang chọn
//   tab "Slide"/"Feature": breadcrumb "Slide 03 › Device" + panel theo cấp chọn
//     · Slide (hoặc chưa chọn): layer con (bấm để chọn, mắt để ẩn) · Layout · Background
//     · Text: nội dung · vị trí · Typography     · Device: ảnh chụp · vị trí/cỡ/3D · khung máy
//   tab "Project style": mọi thiết lập dùng chung, gom một chỗ để xem tổng
// Nhóm gắn nhãn "All slides" = thiết lập dùng chung toàn dự án (U2 sẽ cho đè riêng từng slide)
// Mọi thay đổi đi qua update(fn, tag) — tag gộp các lần kéo slider thành 1 bước undo
import { useEffect, useState, type ReactNode } from "react";
import { ImageUp, CopyPlus, ImageOff, RotateCcw, Smartphone, EyeOff, Eye, TextAlignStart, TextAlignCenter, Sun, Moon, Type,
  PanelBottom, ArrowDownToLine, Copy, MoveRight, CopyCheck, ChevronRight, Frame, Image as ImageIcon } from "lucide-react";
import type { Project, Slide, Theme, Feature, Layout, Tilt3D, FrameStyle, FrameColor, Bg } from "@/lib/types";
import { FONTS, FRAME_COLORS, GRADIENTS, TILT_PRESETS, DEFAULT_THEME, LOCALES } from "@/lib/presets";
import { textOf } from "@/lib/rules";
import { mockScreen } from "@/lib/mocks";
import { FEATURE_ICONS } from "./icons";
import { Seg, Slider, Group, Num, Prop, Tabs } from "./ui";
import { ColorField } from "./ColorField";
import type { CanvasPick, LayerPick } from "./SlideCanvas";

type Update = (fn: (d: Project) => Project, tag?: string) => void;
type SetTheme = (patch: Partial<Theme>, tag?: string) => void;
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

const LAYER_ICON: Record<LayerPick, ReactNode> = { text: <Type />, device: <Smartphone /> };

// Nhãn nhỏ trên tiêu đề nhóm dùng chung
const AllSlides = () => <span className="allbadge" title="Shared by every slide — change it once, applies everywhere">All slides</span>;
// Nút chép thiết lập slide này sang mọi slide
const ApplyAll = ({ onClick }: { onClick: () => void }) => (
  <button className="gbtn" title="Copy this setting to every slide" onClick={onClick}><CopyCheck />Apply to all</button>
);

// --- Nhóm dùng chung (dùng cả trong panel layer lẫn tab Project style) ---
function FrameGroup({ t, set }: { t: Theme; set: SetTheme }) {
  return (
    <Group id="st-frame" title="Device frame" right={<AllSlides />}>
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
  );
}

function BgGroup({ t, set }: { t: Theme; set: SetTheme }) {
  const gOn = (a: string, b: string) => t.bg !== "color" && t.c1.toUpperCase() === a.toUpperCase() && t.c2.toUpperCase() === b.toUpperCase();
  return (
    <Group id="st-bg" title="Background" right={<AllSlides />}>
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
  );
}

function TypeGroup({ t, set }: { t: Theme; set: SetTheme }) {
  return (
    <Group id="st-type" title="Typography" right={<AllSlides />}>
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
  );
}

// --- Khối Device: vị trí máy + cỡ + nghiêng 3D (slide và feature) ---
function DeviceControls({ v, scaleRange, onChange, tag, right, label = "Device" }: {
  v: Tilt3D & { scale: number; dx?: number; dy?: number }; scaleRange: [number, number]; tag: string; right?: ReactNode; label?: string;
  onChange: (patch: Partial<Tilt3D & { scale: number; dx: number; dy: number }>, tag?: string) => void;
}) {
  const active = TILT_PRESETS.find((t) => t.v.rx === v.rx && t.v.ry === v.ry && t.v.rz === v.rz)?.id;
  return (
    <Group id={`${tag}-device`} title={label} right={right}>
      <Prop label="Position">
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

// --- Danh sách layer con trong panel cấp Slide: bấm để chọn, mắt để ẩn/hiện ---
function LayerList({ rows, onPick, onToggle }: { rows: { id: LayerPick; name: string; sub: string; hidden?: boolean }[]; onPick: (l: LayerPick) => void; onToggle?: (l: LayerPick) => void }) {
  return (
    <Group title="Layers">
      <div className="llist">
        {rows.map((r) => (
          <div key={r.id} className={`lrow ${r.hidden ? "off" : ""}`}>
            <button className="lmain" onClick={() => onPick(r.id)}>
              <span className="lico">{LAYER_ICON[r.id]}</span>
              <span className="lname">{r.name}</span>
              <span className="lsub">{r.sub}</span>
              <ChevronRight className="lgo" />
            </button>
            {onToggle && <button className="ibtn" title={r.hidden ? "Show layer" : "Hide layer"} aria-label={`${r.hidden ? "Show" : "Hide"} ${r.name}`} onClick={() => onToggle(r.id)}>{r.hidden ? <EyeOff /> : <Eye />}</button>}
          </div>
        ))}
      </div>
    </Group>
  );
}

// --- Tab Project style: gom mọi thiết lập dùng chung ---
function StyleTab({ t, set }: { t: Theme; set: SetTheme }) {
  return (
    <>
      <p className="tabnote">Defaults shared by every slide{t.bg === "panorama" ? " and the feature graphic" : ""}. Select a layer on the canvas to edit just that layer.</p>
      <FrameGroup t={t} set={set} />
      <BgGroup t={t} set={set} />
      <TypeGroup t={t} set={set} />
      <div className="group">
        <button className="ghost" onClick={() => set({ ...DEFAULT_THEME })}><RotateCcw />Reset project style</button>
      </div>
    </>
  );
}

export function Inspector({ p, sel, tab, update, pick, onPickLayer, onToggleHidden, onReplace, onReplaceFile, onDuplicate, onFlash }: {
  p: Project; sel: number; tab: "slide" | "feature"; update: Update; pick: CanvasPick;
  onPickLayer: (l: CanvasPick) => void; onToggleHidden: (l: LayerPick) => void;
  onReplace: () => void; onReplaceFile: (f?: File) => void; onDuplicate: () => void; onFlash: (m: string, undo?: boolean) => void;
}) {
  const [ptab, setPtab] = useState<PTab>("item");
  const [hot, setHot] = useState(false); // kéo file ngang thẻ Screenshot
  useEffect(() => { if (pick) setPtab("item"); }, [pick]); // chọn gì trên canvas → về tab thuộc tính

  const setTheme: SetTheme = (patch, tag) => update((d) => ({ ...d, theme: { ...d.theme, ...patch } }), tag);
  const setSlide = (patch: Partial<Slide>, tag?: string) =>
    update((d) => ({ ...d, slides: d.slides.map((s, i) => (i === sel ? { ...s, ...patch } : s)) }), tag);
  const setFeature = (patch: Partial<Feature>, tag?: string) => update((d) => ({ ...d, feature: { ...d.feature, ...patch } }), tag);
  const applyAll = (patch: Partial<Slide>, what: string) => {
    update((d) => ({ ...d, slides: d.slides.map((s) => ({ ...s, ...patch })) }));
    onFlash(`${what} applied to all ${p.slides.length} slides`, true);
  };

  const isFeature = tab === "feature";
  const layer: LayerPick | null = pick === "text" || pick === "device" ? pick : null;
  const head = (
    <div className="phead">
      <Tabs value={ptab} onChange={setPtab} options={[{ v: "item", label: isFeature ? "Feature" : "Slide" }, { v: "style", label: "Project style" }]} />
    </div>
  );
  if (ptab === "style") return <aside className="right">{head}<StyleTab t={p.theme} set={setTheme} /></aside>;

  // Breadcrumb: "Slide 03 › Device"; bấm phần đầu để lùi về cấp slide
  const rootName = isFeature ? "Feature graphic" : `Slide ${String(sel + 1).padStart(2, "0")}`;
  const layerName = layer === "text" ? (isFeature ? "Text & icon" : "Text") : layer === "device" ? (isFeature ? "Devices" : "Device") : "";
  const crumb = (actions: ReactNode) => (
    <div className="slidebar">
      <nav className="crumb" aria-label="Selection">
        {layer ? <button className="cr-root" onClick={() => onPickLayer("slide")}>{rootName}</button> : <span className="cr-cur">{isFeature ? <ImageIcon /> : <Frame />}{rootName}</span>}
        {layer && <><ChevronRight className="cr-sep" /><span className="cr-cur">{LAYER_ICON[layer]}{layerName}</span></>}
      </nav>
      <span className="row g4">{actions}</span>
    </div>
  );

  // ===== Feature graphic =====
  if (isFeature) {
    const f = p.feature;
    const moved = layer === "text" ? !!(f.tx || f.ty) : !!(f.dx || f.dy);
    const reset = layer && moved ? <button className="gbtn" title="Reset position" onClick={() => setFeature(layer === "text" ? { tx: 0, ty: 0 } : { dx: 0, dy: 0 })}><RotateCcw />Reset</button> : null;
    let body: ReactNode;
    if (layer === "text") body = <>
      <Group id="f-text" title="Text & icon">
        <input className="field" value={f.name} aria-label="App name" placeholder="App name" onChange={(e) => setFeature({ name: e.target.value }, "fname")} />
        <input className="field" value={f.tagline} aria-label="Tagline" placeholder="Tagline" onChange={(e) => setFeature({ tagline: e.target.value }, "ftag")} />
        <Prop label="Position">
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
      <TypeGroup t={p.theme} set={setTheme} />
    </>;
    else if (layer === "device") body = <>
      <DeviceControls label="Devices" v={f} scaleRange={[12, 30]} tag="f" onChange={(patch, tg) => setFeature(patch, tg)} />
      <FrameGroup t={p.theme} set={setTheme} />
    </>;
    else body = <>
      <LayerList onPick={onPickLayer} rows={[
        { id: "text", name: "Text & icon", sub: f.name || "—" },
        { id: "device", name: "Devices", sub: f.device ? "2 phones" : "hidden", hidden: !f.device },
      ]} onToggle={(l) => l === "device" && setFeature({ device: !f.device })} />
      <Group title="Feature graphic" right={<span className="mono">1024×500</span>}>
        <p className="hint">The banner on top of your Google Play listing. Click the text or the phones on the canvas to edit them.</p>
      </Group>
      <BgGroup t={p.theme} set={setTheme} />
    </>;
    return <aside className="right">{head}{crumb(reset)}{body}</aside>;
  }

  // ===== Slide =====
  const s = p.slides[sel];
  if (!s) return <aside className="right">{head}</aside>;
  const [title, sub] = textOf(s, p.loc);
  const setText = (k: 0 | 1, v: string) => {
    const cur: [string, string] = [...textOf(s, p.loc)] as [string, string];
    cur[k] = v;
    setSlide({ t: { ...s.t, [p.loc]: cur } }, `text${k}`);
  };
  const hiddenNow = layer ? !!s.hidden?.[layer] : false;
  const moved = layer === "text" ? !!(s.tx || s.ty) : layer === "device" ? !!(s.dx || s.dy) : !!(s.dx || s.dy || s.tx || s.ty);
  const actions = <>
    {moved && <button className="gbtn" title="Reset position" onClick={() => setSlide(layer === "text" ? { tx: 0, ty: 0 } : layer === "device" ? { dx: 0, dy: 0 } : { dx: 0, dy: 0, tx: 0, ty: 0 })}><RotateCcw />Reset</button>}
    {layer
      ? <button className="ibtn" title={hiddenNow ? "Show layer" : "Hide layer"} aria-label={hiddenNow ? "Show layer" : "Hide layer"} onClick={() => onToggleHidden(layer)}>{hiddenNow ? <EyeOff /> : <Eye />}</button>
      : <button className="ibtn" title="Duplicate slide" aria-label="Duplicate slide" onClick={onDuplicate}><CopyPlus /></button>}
  </>;

  let body: ReactNode;
  if (layer === "text") body = <>
    {hiddenNow && <p className="hidnote"><EyeOff />This layer is hidden on this slide.</p>}
    <Group id="s-text" title="Content" right={<span className="mono">{LOCALES[p.loc]}</span>}>
      <textarea className="field" rows={2} value={title} aria-label="Headline" placeholder="Headline" onChange={(e) => setText(0, e.target.value)} />
      <input className="field" value={sub} aria-label="Subtitle" placeholder="Subtitle (optional)" onChange={(e) => setText(1, e.target.value)} />
      <p className="hint">Tip: double-click the text on the canvas to type in place.</p>
    </Group>
    <Group id="s-tpos" title="Position">
      <Prop label="Offset">
        <Num prefix="X" value={s.tx ?? 0} step={0.5} onChange={(tx) => setSlide({ tx }, "ptx")} />
        <Num prefix="Y" value={s.ty ?? 0} step={0.5} onChange={(ty) => setSlide({ ty }, "pty")} />
      </Prop>
    </Group>
    <TypeGroup t={p.theme} set={setTheme} />
  </>;
  else if (layer === "device") body = <>
    {hiddenNow && <p className="hidnote"><EyeOff />This layer is hidden on this slide.</p>}
    {/* Thẻ ảnh chụp: xem ảnh (hoặc màn mẫu), bấm/thả để thay, gỡ để quay về màn mẫu */}
    <Group id="s-shot" title="Screenshot">
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
    <DeviceControls v={s} scaleRange={[40, 100]} tag="s" onChange={(patch, tg) => setSlide(patch, tg)}
      right={<ApplyAll onClick={() => applyAll({ rx: s.rx, ry: s.ry, rz: s.rz, scale: s.scale }, "Device tilt & size")} />} />
    <FrameGroup t={p.theme} set={setTheme} />
  </>;
  else body = <>
    <LayerList onPick={onPickLayer} onToggle={onToggleHidden} rows={[
      { id: "text", name: "Text", sub: title || "Untitled", hidden: s.hidden?.text },
      { id: "device", name: "Device", sub: s.img ? "Your screenshot" : "Sample screen", hidden: s.hidden?.device },
    ]} />
    <Group id="s-layout" title="Layout" right={<ApplyAll onClick={() => applyAll({ layout: s.layout }, "Layout")} />}>
      <div className="layouts">
        {LAYOUTS.map((l) => (
          <button key={l.v} title={l.label} className={s.layout === l.v ? "on" : ""} onClick={() => setSlide({ layout: l.v })}>{l.icon}{l.label}</button>
        ))}
      </div>
    </Group>
    <BgGroup t={p.theme} set={setTheme} />
  </>;

  return <aside className="right">{head}{crumb(actions)}{body}</aside>;
}
