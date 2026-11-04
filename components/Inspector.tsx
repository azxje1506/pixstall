// Cột phải (kiểu Framer): CHỈ hiện setting của layer đang chọn
//   Layer chữ: Headline · Subtitle · Text/Badge tự do (x:…) — mỗi loại một panel; Delete để xoá, "+ Add text" để thêm
//   tab "Slide"/"Feature": breadcrumb "Slide 03 › Device" + panel theo cấp chọn
//     · Slide (hoặc chưa chọn): layer con (bấm để chọn, mắt để ẩn) · Layout · Background
//     · Text: nội dung · vị trí · Typography     · Device: ảnh chụp · vị trí/cỡ/3D · khung máy
//   tab "Project style": mọi thiết lập dùng chung, gom một chỗ để xem tổng
// Nhóm gắn nhãn "All slides" = thiết lập dùng chung toàn dự án (U2 sẽ cho đè riêng từng slide)
// Mọi thay đổi đi qua update(fn, tag) — tag gộp các lần kéo slider thành 1 bước undo
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ImageUp, CopyPlus, ImageOff, RotateCcw, Smartphone, EyeOff, Eye, TextAlignStart, TextAlignCenter, Sun, Moon, Type,
  PanelBottom, ArrowDownToLine, Copy, MoveRight, CopyCheck, ChevronRight, Frame, Highlighter, Plus, Trash2, Image as ImageIcon } from "lucide-react";
import type { Project, Slide, Theme, ThemeKey, Feature, Layout, Tilt3D, FrameStyle, FrameColor, Bg } from "@/lib/types";
import { FONTS, FRAME_COLORS, GRADIENTS, TILT_PRESETS, DEFAULT_THEME, LOCALES } from "@/lib/presets";
import { textOf, themeOf, plain } from "@/lib/rules";
import { mockScreen } from "@/lib/mocks";
import { FEATURE_ICONS } from "./icons";
import { Seg, Slider, Group, Num, Prop, Tabs } from "./ui";
import { ColorField } from "./ColorField";
import type { CanvasPick, LayerPick } from "./SlideCanvas";
import { isLayer, isHidden, layersOf, layerName as nameOf, extraOf, extraText, patchExtra, type LayerId } from "@/lib/layers";
import { layerIcon } from "./SlideList";

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


// --- Phạm vi sửa style: "project" (Project style, áp mọi slide) hoặc "slide" (đè riêng slide đang chọn) ---
// Nhóm ở phạm vi slide: thuộc tính đang đè có chấm xanh (bấm để bỏ đè); tiêu đề có "This slide" + Reset + Apply to all
export interface Scope {
  kind: "project" | "slide";
  t: Theme; // style thực tế đang thấy
  set: SetTheme; // ghi vào project theme hoặc override của slide
  ov?: Partial<Theme>; // phần slide đang đè
  reset?: (keys: ThemeKey[]) => void; // bỏ đè các khoá
  push?: (keys: ThemeKey[]) => void; // đẩy giá trị của slide này lên Project style cho mọi slide
}
const FRAME_KEYS: ThemeKey[] = ["frame", "frameColor", "bezel", "radius", "depth", "shadow"];
const BG_KEYS: ThemeKey[] = ["bg", "c1", "c2", "solid", "blur", "overlay"];
const TYPE_KEYS: ThemeKey[] = ["font", "tsize", "tweight", "tlh", "ssize", "align", "ink", "tcolor", "hl"];

// Chấm đè cho 1 khoá (chỉ ở phạm vi slide)
const mk = (sc: Scope, ...keys: ThemeKey[]) => sc.kind === "slide" && sc.ov && keys.some((k) => k in sc.ov!)
  ? { mark: true, onReset: () => sc.reset?.(keys) } : {};

// Phần phải của tiêu đề nhóm style
function ScopeBadge({ sc, keys }: { sc: Scope; keys: ThemeKey[] }) {
  if (sc.kind === "project") return <span className="allbadge" title="Shared by every slide">All slides</span>;
  const n = keys.filter((k) => sc.ov && k in sc.ov).length;
  if (!n) return <span className="allbadge muted" title="Uses the project style — any change here applies to this slide only">Project style</span>;
  return (
    <span className="row g4">
      <span className="allbadge own" title={`${n} setting${n > 1 ? "s" : ""} differ from the project style`}>This slide</span>
      <button className="ibtn sm" title="Reset this group to the project style" aria-label="Reset group to project style" onClick={() => sc.reset?.(keys)}><RotateCcw /></button>
      <button className="ibtn sm" title="Use these settings on every slide" aria-label="Apply group to all slides" onClick={() => sc.push?.(keys)}><CopyCheck /></button>
    </span>
  );
}

// Nút chép thiết lập slide này sang mọi slide
const ApplyAll = ({ onClick }: { onClick: () => void }) => (
  <button className="gbtn" title="Copy this setting to every slide" onClick={onClick}><CopyCheck />Apply to all</button>
);

// --- Nhóm style (dùng ở panel layer với phạm vi slide, và ở tab Project style) ---
function FrameGroup({ sc }: { sc: Scope }) {
  const { t, set } = sc;
  return (
    <Group id="st-frame" title="Device frame" right={<ScopeBadge sc={sc} keys={FRAME_KEYS} />}>
      <Prop label="Style" {...mk(sc, "frame")}>
        <Seg full value={t.frame} onChange={(frame: FrameStyle) => set({ frame })} options={[
          { v: "auto", label: "Auto" }, { v: "iphone", label: "iPhone" }, { v: "pixel", label: "Pixel" }, { v: "none", label: "None" },
        ]} />
      </Prop>
      <Prop label="Color" {...mk(sc, "frameColor")}>
        <div className="swatches">
          {(Object.keys(FRAME_COLORS) as FrameColor[]).map((c) => (
            <button key={c} title={FRAME_COLORS[c].label} aria-label={`Frame ${FRAME_COLORS[c].label}`} className={t.frameColor === c ? "on" : ""} style={{ background: FRAME_COLORS[c].body }} onClick={() => set({ frameColor: c })} />
          ))}
          <span className="mono">{FRAME_COLORS[t.frameColor].label}</span>
        </div>
      </Prop>
      <Slider label="Bezel" value={t.bezel} min={0} max={6} step={0.2} unit="%" onChange={(bezel) => set({ bezel }, "bezel")} {...mk(sc, "bezel")} />
      <Slider label="Radius" value={t.radius} min={0} max={20} step={0.5} unit="%" onChange={(radius) => set({ radius }, "radius")} {...mk(sc, "radius")} />
      <Slider label="Depth" value={t.depth} min={0} max={8} step={0.5} unit="%" onChange={(depth) => set({ depth }, "depth")} {...mk(sc, "depth")} />
      <Slider label="Shadow" value={t.shadow} min={0} max={60} onChange={(shadow) => set({ shadow }, "shadow")} {...mk(sc, "shadow")} />
    </Group>
  );
}

function BgGroup({ sc }: { sc: Scope }) {
  const { t, set } = sc;
  const gOn = (a: string, b: string) => t.bg !== "color" && t.c1.toUpperCase() === a.toUpperCase() && t.c2.toUpperCase() === b.toUpperCase();
  return (
    <Group id="st-bg" title="Background" right={<ScopeBadge sc={sc} keys={BG_KEYS} />}>
      <Prop label="Type" {...mk(sc, "bg")}>
        <Seg full value={t.bg} onChange={(bg: Bg) => set({ bg })} options={[
          { v: "color", label: "Color" }, { v: "gradient", label: "Gradient" }, { v: "panorama", label: "Pano" }, { v: "blur", label: "Blur" },
        ]} />
      </Prop>
      <p className="hint">{BG_HINT[t.bg]}</p>
      {t.bg === "color"
        ? <Prop label="Fill" {...mk(sc, "solid")}><ColorField label="Background color" value={t.solid} onChange={(solid) => set({ solid }, "solid")} /></Prop>
        : <>
            <Prop label="From" {...mk(sc, "c1")}><ColorField label="Gradient start" value={t.c1} onChange={(c1) => set({ c1 }, "c1")} /></Prop>
            <Prop label="To" {...mk(sc, "c2")}><ColorField label="Gradient end" value={t.c2} onChange={(c2) => set({ c2 }, "c2")} /></Prop>
          </>}
      <Prop label="Presets">
        <div className="swatches">
          {GRADIENTS.map(([a, b]) => (
            <button key={a} className={gOn(a, b) ? "on" : ""} title={`Gradient ${a} → ${b}`} aria-label={`Gradient ${a} to ${b}`} style={{ background: `linear-gradient(135deg,${a},${b})` }} onClick={() => set({ c1: a, c2: b, ...(t.bg === "color" ? { bg: "gradient" as Bg } : {}) })} />
          ))}
        </div>
      </Prop>
      {t.bg === "blur" && <>
        <Slider label="Blur" value={t.blur} min={0} max={30} onChange={(blur) => set({ blur }, "blur")} {...mk(sc, "blur")} />
        <Slider label="Overlay" value={t.overlay} min={0} max={80} unit="%" onChange={(overlay) => set({ overlay }, "overlay")} {...mk(sc, "overlay")} />
      </>}
    </Group>
  );
}

function TypeGroup({ sc }: { sc: Scope }) {
  const { t, set } = sc;
  const inkHex = t.ink === "light" ? "#FFFFFF" : "#15151A";
  return (
    <Group id="st-type" title="Typography" right={<ScopeBadge sc={sc} keys={TYPE_KEYS} />}>
      <Prop label="Font" {...mk(sc, "font")}>
        <label className="chip"><Type />
          <select value={t.font} aria-label="Font" onChange={(e) => set({ font: e.target.value })}>
            {Object.keys(FONTS).map((f) => <option key={f}>{f}</option>)}
          </select>
        </label>
      </Prop>
      <Slider label="Size" value={t.tsize} min={5} max={12} step={0.5} onChange={(tsize) => set({ tsize }, "tsize")} {...mk(sc, "tsize")} />
      <Slider label="Weight" value={t.tweight} min={400} max={900} step={100} onChange={(tweight) => set({ tweight }, "tweight")} {...mk(sc, "tweight")} />
      <Slider label="Sub size" value={Math.round(t.ssize * 100)} min={30} max={80} unit="%" onChange={(v) => set({ ssize: v / 100 }, "ssize")} {...mk(sc, "ssize")} />
      <Slider label="Line ht." value={t.tlh} min={0.9} max={1.5} step={0.02} onChange={(tlh) => set({ tlh: +tlh.toFixed(2) }, "tlh")} {...mk(sc, "tlh")} />
      <Prop label="Align" {...mk(sc, "align")}>
        <Seg full value={t.align} onChange={(align: Theme["align"]) => set({ align })} options={[
          { v: "left", icon: <TextAlignStart />, title: "Left" }, { v: "center", icon: <TextAlignCenter />, title: "Center" },
        ]} />
      </Prop>
      <Prop label="Color" {...mk(sc, "ink", "tcolor")}>
        <Seg full value={t.tcolor ? "custom" : t.ink} onChange={(v: string) => (v === "custom" ? set({ tcolor: inkHex === "#FFFFFF" ? "#FFF7E6" : "#1E1B4B" }) : set({ ink: v as Theme["ink"], tcolor: "" }))} options={[
          { v: "light", icon: <Sun />, title: "White" }, { v: "dark", icon: <Moon />, title: "Black" }, { v: "custom", label: "Custom" },
        ]} />
      </Prop>
      {t.tcolor && <Prop label="Custom"><ColorField label="Text color" value={t.tcolor} onChange={(tcolor) => set({ tcolor }, "tcolor")} /></Prop>}
      <Prop label="Highlight" {...mk(sc, "hl")}><ColorField label="Highlight color for *words*" value={t.hl} onChange={(hl) => set({ hl }, "hl")} /></Prop>
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
function LayerList({ rows, onPick, onToggle, onAdd }: { rows: { id: LayerId; name: string; sub: string; hidden?: boolean }[]; onPick: (l: LayerId) => void; onToggle?: (l: LayerId) => void; onAdd?: (x: number, y: number) => void }) {
  return (
    <Group title="Layers" right={onAdd && <button className="gbtn" title="Add a text layer" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); onAdd(r.left, r.bottom + 4); }}><Plus />Add text</button>}>
      <div className="llist">
        {rows.map((r) => (
          <div key={r.id} className={`lrow ${r.hidden ? "off" : ""}`}>
            <button className="lmain" onClick={() => onPick(r.id)}>
              <span className="lico">{layerIcon(r.id, r.name)}</span>
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

// --- Tab Project style: mọi thiết lập dùng chung + số slide đang có style riêng ---
function StyleTab({ sc, owned, onClearAll }: { sc: Scope; owned: number; onClearAll: () => void }) {
  return (
    <>
      <p className="tabnote">Defaults for every slide{sc.t.bg === "panorama" ? " and the feature graphic" : ""}. Select a slide or layer to give just that one its own look.</p>
      {owned > 0 && (
        <div className="ownnote">
          <span><b>{owned} slide{owned > 1 ? "s" : ""}</b> use{owned > 1 ? "" : "s"} their own style and won't follow some changes here.</span>
          <button className="gbtn" onClick={onClearAll}><RotateCcw />Reset all</button>
        </div>
      )}
      <FrameGroup sc={sc} />
      <BgGroup sc={sc} />
      <TypeGroup sc={sc} />
      <div className="group">
        <button className="ghost" onClick={() => sc.set({ ...DEFAULT_THEME })}><RotateCcw />Reset project style</button>
      </div>
    </>
  );
}

export function Inspector({ p, sel, tab, update, pick, onPickLayer, onToggleHidden, onRemoveLayer, onAddMenu, onReplace, onReplaceFile, onDuplicate, onFlash }: {
  p: Project; sel: number; tab: "slide" | "feature"; update: Update; pick: CanvasPick;
  onPickLayer: (l: CanvasPick) => void; onToggleHidden: (l: LayerPick) => void;
  onRemoveLayer: (l: LayerId) => void; onAddMenu: (x: number, y: number) => void;
  onReplace: () => void; onReplaceFile: (f?: File) => void; onDuplicate: () => void; onFlash: (m: string, undo?: boolean) => void;
}) {
  const [ptab, setPtab] = useState<PTab>("item");
  const [hot, setHot] = useState(false); // kéo file ngang thẻ Screenshot
  const ta = useRef<HTMLTextAreaElement>(null); // ô tiêu đề (để tô màu phần bôi đen)
  useEffect(() => { if (pick) setPtab("item"); }, [pick]); // chọn gì trên canvas → về tab thuộc tính

  const setTheme: SetTheme = (patch, tag) => update((d) => ({ ...d, theme: { ...d.theme, ...patch } }), tag);
  const project: Scope = { kind: "project", t: p.theme, set: setTheme };
  // Phạm vi slide đang chọn: ghi vào override; giá trị trùng Project style thì tự bỏ đè cho gọn
  const cur = p.slides[sel];
  const slideScope: Scope = {
    kind: "slide", t: themeOf(p, cur), ov: cur?.override,
    set: (patch, tag) => update((d) => ({ ...d, slides: d.slides.map((x, i) => {
      if (i !== sel) return x;
      const o: Partial<Theme> = { ...x.override, ...patch };
      for (const k of Object.keys(o) as ThemeKey[]) if (o[k] === d.theme[k]) delete o[k];
      return { ...x, override: Object.keys(o).length ? o : undefined };
    }) }), tag),
    reset: (keys) => update((d) => ({ ...d, slides: d.slides.map((x, i) => {
      if (i !== sel || !x.override) return x;
      const o = { ...x.override }; keys.forEach((k) => delete o[k]);
      return { ...x, override: Object.keys(o).length ? o : undefined };
    }) })),
    push: (keys) => {
      const eff = themeOf(p, cur), patch: Partial<Theme> = {};
      keys.forEach((k) => { (patch as Record<string, unknown>)[k] = eff[k]; });
      update((d) => ({ ...d, theme: { ...d.theme, ...patch }, slides: d.slides.map((x) => {
        if (!x.override) return x;
        const o = { ...x.override }; keys.forEach((k) => delete o[k]);
        return { ...x, override: Object.keys(o).length ? o : undefined };
      }) }));
      onFlash(`Applied to all ${p.slides.length} slides`, true);
    },
  };
  const owned = p.slides.filter((x) => x.override && Object.keys(x.override).length).length;
  const setSlide = (patch: Partial<Slide>, tag?: string) =>
    update((d) => ({ ...d, slides: d.slides.map((s, i) => (i === sel ? { ...s, ...patch } : s)) }), tag);
  const setFeature = (patch: Partial<Feature>, tag?: string) => update((d) => ({ ...d, feature: { ...d.feature, ...patch } }), tag);
  const applyAll = (patch: Partial<Slide>, what: string) => {
    update((d) => ({ ...d, slides: d.slides.map((s) => ({ ...s, ...patch })) }));
    onFlash(`${what} applied to all ${p.slides.length} slides`, true);
  };

  const isFeature = tab === "feature";
  const layer: LayerId | null = isLayer(pick) ? pick : null;
  const head = (
    <div className="phead">
      <Tabs value={ptab} onChange={setPtab} options={[{ v: "item", label: isFeature ? "Feature" : "Slide" }, { v: "style", label: "Project style" }]} />
    </div>
  );
  if (ptab === "style") return <aside className="right">{head}<StyleTab sc={project} owned={owned}
    onClearAll={() => { update((d) => ({ ...d, slides: d.slides.map((x) => ({ ...x, override: undefined })) })); onFlash("Every slide follows the project style again", true); }} /></aside>;

  // Breadcrumb: "Slide 03 › Device"; bấm phần đầu để lùi về cấp slide
  const rootName = isFeature ? "Feature graphic" : `Slide ${String(sel + 1).padStart(2, "0")}`;
  const layerName = !layer ? "" : isFeature ? (layer === "device" ? "Devices" : "Text & icon") : nameOf(p.slides[sel], layer);
  const crumb = (actions: ReactNode) => (
    <div className="slidebar">
      <nav className="crumb" aria-label="Selection">
        {layer ? <button className="cr-root" onClick={() => onPickLayer("slide")}>{rootName}</button> : <span className="cr-cur">{isFeature ? <ImageIcon /> : <Frame />}{rootName}</span>}
        {layer && <><ChevronRight className="cr-sep" /><span className="cr-cur">{layerIcon(layer, layerName)}{layerName}</span></>}
      </nav>
      <span className="row g4">{actions}</span>
    </div>
  );

  // ===== Feature graphic =====
  if (isFeature) {
    const f = p.feature;
    const moved = layer === "title" ? !!(f.tx || f.ty) : !!(f.dx || f.dy);
    const reset = layer && moved ? <button className="gbtn" title="Reset position" onClick={() => setFeature(layer === "title" ? { tx: 0, ty: 0 } : { dx: 0, dy: 0 })}><RotateCcw />Reset</button> : null;
    let body: ReactNode;
    if (layer === "title") body = <>
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
      <TypeGroup sc={project} />
    </>;
    else if (layer === "device") body = <>
      <DeviceControls label="Devices" v={f} scaleRange={[12, 30]} tag="f" onChange={(patch, tg) => setFeature(patch, tg)} />
      <FrameGroup sc={project} />
    </>;
    else body = <>
      <LayerList onPick={onPickLayer} rows={[
        { id: "title", name: "Text & icon", sub: f.name || "—" },
        { id: "device", name: "Devices", sub: f.device ? "2 phones" : "hidden", hidden: !f.device },
      ]} onToggle={(l) => l === "device" && setFeature({ device: !f.device })} />
      <Group title="Feature graphic" right={<span className="mono">1024×500</span>}>
        <p className="hint">The banner on top of your Google Play listing. Click the text or the phones on the canvas to edit them.</p>
      </Group>
      <BgGroup sc={project} />
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
  const hiddenNow = layer ? isHidden(s, layer) : false;
  const twDef = s.layout === "offset" ? 62 : 84;
  const ex = layer ? extraOf(s, layer) : undefined;
  // Bọc phần đang bôi đen trong ô (tiêu đề/phụ đề/chữ tự do) bằng *…* (bấm lại khi đã bọc thì gỡ)
  const highlight = (val: string, write: (v: string) => void) => {
    const el = ta.current; if (!el) return;
    let [a, b] = [el.selectionStart ?? 0, el.selectionEnd ?? 0];
    if (a === b) { onFlash("Select some words first — or select them right on the canvas"); return; }
    while (val[a] === " ") a++; while (b > a && val[b - 1] === " ") b--;
    const wrapped = val[a - 1] === "*" && val[b] === "*";
    write(wrapped ? val.slice(0, a - 1) + val.slice(a, b) + val.slice(b + 1) : val.slice(0, a) + "*" + val.slice(a, b) + "*" + val.slice(b));
  };
  const hlRow = (val: string, write: (v: string) => void) => (
    <div className="hlrow">
      <button className="gbtn" title="Select words in the box above, then click to color them" onMouseDown={(e) => e.preventDefault()} onClick={() => highlight(val, write)}><Highlighter />Highlight</button>
      <span className="hint">or select words right on the canvas</span>
    </div>
  );
  const [lx, ly] = layer === "title" ? [s.tx, s.ty] : layer === "sub" ? [s.sx, s.sy] : layer === "device" ? [s.dx, s.dy] : [0, 0];
  const moved = layer && !ex ? !!(lx || ly) : !layer && !!(s.dx || s.dy || s.tx || s.ty || s.sx || s.sy);
  const resetPos = () => setSlide(layer === "title" ? { tx: 0, ty: 0 } : layer === "sub" ? { sx: 0, sy: 0 } : layer === "device" ? { dx: 0, dy: 0 } : { dx: 0, dy: 0, tx: 0, ty: 0, sx: 0, sy: 0 });
  const actions = <>
    {moved && <button className="gbtn" title="Reset position" onClick={resetPos}><RotateCcw />Reset</button>}
    {layer && <button className="ibtn" title={hiddenNow ? "Show layer" : "Hide layer"} aria-label={hiddenNow ? "Show layer" : "Hide layer"} onClick={() => onToggleHidden(layer)}>{hiddenNow ? <EyeOff /> : <Eye />}</button>}
    {layer && layer !== "device" && <button className="ibtn danger" title="Delete layer (Del)" aria-label="Delete layer" onClick={() => onRemoveLayer(layer)}><Trash2 /></button>}
    {!layer && <button className="ibtn" title="Duplicate slide" aria-label="Duplicate slide" onClick={onDuplicate}><CopyPlus /></button>}
  </>;
  const hidNote = hiddenNow && <p className="hidnote"><EyeOff />This layer is hidden on this slide.</p>;
  const widthRow = <Slider label="Width" value={s.tw ?? twDef} min={30} max={s.layout === "offset" ? 84 : 100} unit="%" onChange={(tw) => setSlide({ tw }, "ptw")}
    mark={s.tw !== undefined && s.tw !== twDef} onReset={() => setSlide({ tw: undefined })} />;

  let body: ReactNode;
  if (layer === "title" || layer === "sub") {
    const k = layer === "title" ? 0 : 1, val = k ? sub : title;
    body = <>
      {hidNote}
      <Group id="s-text" title={layer === "title" ? "Headline" : "Subtitle"} right={<span className="mono">{LOCALES[p.loc]}</span>}>
        <textarea ref={ta} className="field" rows={2} value={val} aria-label={layer === "title" ? "Headline" : "Subtitle"} placeholder={layer === "title" ? "Headline" : "Subtitle"} onChange={(e) => setText(k, e.target.value)} />
        {hlRow(val, (v) => setText(k, v))}
      </Group>
      <Group id="s-tpos" title="Position & size">
        <Prop label="Offset">
          <Num prefix="X" value={(k ? s.sx : s.tx) ?? 0} step={0.5} onChange={(v) => setSlide(k ? { sx: v } : { tx: v }, "pox")} />
          <Num prefix="Y" value={(k ? s.sy : s.ty) ?? 0} step={0.5} onChange={(v) => setSlide(k ? { sy: v } : { ty: v }, "poy")} />
        </Prop>
        {widthRow}
        <p className="hint">Width is shared by the headline and subtitle.</p>
      </Group>
      <TypeGroup sc={slideScope} />
    </>;
  } else if (ex && layer) {
    const val = extraText(ex, p.loc), setEx = (patch: Partial<typeof ex>, tag?: string) => setSlide(patchExtra(s, layer, patch), tag);
    body = <>
      {hidNote}
      <Group id="s-extra" title={ex.pill ? "Badge" : "Text"} right={<span className="mono">{LOCALES[p.loc]}</span>}>
        <textarea ref={ta} className="field" rows={1} value={val} aria-label="Text" placeholder="Text" onChange={(e) => setEx({ t: { ...ex.t, [p.loc]: e.target.value } }, "xtext")} />
        {hlRow(val, (v) => setEx({ t: { ...ex.t, [p.loc]: v } }))}
      </Group>
      <Group id="s-xstyle" title="Style">
        <Prop label="Kind">
          <Seg full value={ex.pill ? "pill" : "plain"} onChange={(v) => setEx({ pill: v === "pill" })} options={[{ v: "plain", label: "Text" }, { v: "pill", label: "Badge" }]} />
        </Prop>
        <Slider label="Size" value={ex.size} min={1.5} max={12} step={0.1} onChange={(size) => setEx({ size }, "xsize")} />
        <Slider label="Weight" value={ex.weight} min={400} max={900} step={100} onChange={(weight) => setEx({ weight }, "xw")} />
        {!ex.pill && <Prop label="Color" mark={!!ex.color} onReset={() => setEx({ color: "" })}>
          <ColorField label="Text color" value={ex.color || (slideScope.t.tcolor || (slideScope.t.ink === "light" ? "#FFFFFF" : "#15151A"))} onChange={(color) => setEx({ color }, "xc")} />
        </Prop>}
        {ex.pill && <p className="hint">Badge color follows the highlight color in Typography.</p>}
        <Prop label="Center">
          <Num prefix="X" value={ex.x} step={0.5} onChange={(x) => setEx({ x }, "xx")} />
          <Num prefix="Y" value={ex.y} step={0.5} onChange={(y) => setEx({ y }, "xy")} />
        </Prop>
      </Group>
    </>;
  } else if (layer === "device") body = <>
    {hidNote}
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
    <FrameGroup sc={slideScope} />
  </>;
  else body = <>
    <LayerList onPick={onPickLayer} onToggle={onToggleHidden} onAdd={onAddMenu}
      rows={layersOf(s, p.loc).map((l) => ({ ...l, hidden: isHidden(s, l.id) }))} />
    <Group id="s-layout" title="Layout" right={<ApplyAll onClick={() => applyAll({ layout: s.layout }, "Layout")} />}>
      <div className="layouts">
        {LAYOUTS.map((l) => (
          <button key={l.v} title={l.label} className={s.layout === l.v ? "on" : ""} onClick={() => setSlide({ layout: l.v })}>{l.icon}{l.label}</button>
        ))}
      </div>
    </Group>
    <BgGroup sc={slideScope} />
  </>;

  return <aside className="right">{head}{crumb(actions)}{body}</aside>;
}
