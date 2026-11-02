// Cột phải: thuộc tính slide (chữ, layout, nghiêng 3D) hoặc Feature graphic, rồi Theme dùng chung mọi slide
// Mọi thay đổi đi qua update(fn, tag) — tag giúp gộp các lần kéo slider thành 1 bước undo
import type { ReactNode } from "react";
import { ImageUp, CopyPlus, Layers, Palette, Type, RotateCcw, Smartphone, EyeOff, TextAlignStart, TextAlignCenter, Sun, Moon, Rotate3d,
  PanelBottom, ArrowDownToLine, Copy, MoveRight } from "lucide-react";
import type { Project, Slide, Theme, Feature, Layout, Tilt3D, FrameStyle, FrameColor, Bg } from "@/lib/types";
import { FONTS, FRAME_COLORS, GRADIENTS, TILT_PRESETS, DEFAULT_THEME, LOCALES } from "@/lib/presets";
import { textOf } from "@/lib/rules";
import { FEATURE_ICONS } from "./icons";
import { Seg, Slider, Group } from "./ui";

type Update = (fn: (d: Project) => Project, tag?: string) => void;

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

// Khối nghiêng 3D dùng chung cho slide và feature graphic
function TiltControls({ v, scale, scaleRange, onChange, tag }: { v: Tilt3D; scale: number; scaleRange: [number, number]; onChange: (patch: Partial<Tilt3D & { scale: number }>, tag?: string) => void; tag: string }) {
  const active = TILT_PRESETS.find((t) => t.v.rx === v.rx && t.v.ry === v.ry && t.v.rz === v.rz)?.id;
  return (
    <Group title="3D tilt" right={<Rotate3d className="muted" />}>
      <div className="presets">
        {TILT_PRESETS.map((t) => (
          <button key={t.id} className={active === t.id ? "on" : ""} onClick={() => onChange(t.v)}>
            <span className="tilt-ico" style={{ transform: `perspective(60px) rotateX(${t.v.rx}deg) rotateY(${t.v.ry}deg) rotateZ(${t.v.rz}deg)` }} />
            {t.label}
          </button>
        ))}
      </div>
      <Slider label="Rotate X · lean" value={v.rx} min={-45} max={45} unit="°" onChange={(rx) => onChange({ rx }, tag + "rx")} />
      <Slider label="Rotate Y · turn" value={v.ry} min={-45} max={45} unit="°" onChange={(ry) => onChange({ ry }, tag + "ry")} />
      <Slider label="Rotate Z · spin" value={v.rz} min={-30} max={30} unit="°" onChange={(rz) => onChange({ rz }, tag + "rz")} />
      <Slider label="Device size" value={scale} min={scaleRange[0]} max={scaleRange[1]} unit="%" onChange={(s) => onChange({ scale: s }, tag + "sc")} />
    </Group>
  );
}

function ThemeControls({ t, set }: { t: Theme; set: (patch: Partial<Theme>, tag?: string) => void }) {
  return (
    <>
      <Group title="Device frame">
        <Seg full value={t.frame} onChange={(frame: FrameStyle) => set({ frame })} options={[
          { v: "auto", label: "Auto" }, { v: "iphone", label: "iPhone" }, { v: "pixel", label: "Pixel" }, { v: "none", label: "None" },
        ]} />
        <div className="swatches">
          {(Object.keys(FRAME_COLORS) as FrameColor[]).map((c) => (
            <button key={c} title={FRAME_COLORS[c].label} className={t.frameColor === c ? "on" : ""} style={{ background: FRAME_COLORS[c].body }} onClick={() => set({ frameColor: c })} />
          ))}
          <span className="mono" style={{ marginLeft: 4 }}>{FRAME_COLORS[t.frameColor].label}</span>
        </div>
        <Slider label="Bezel" value={t.bezel} min={0} max={6} step={0.2} unit="%" onChange={(bezel) => set({ bezel }, "bezel")} />
        <Slider label="Rounded corners" value={t.radius} min={0} max={20} step={0.5} unit="%" onChange={(radius) => set({ radius }, "radius")} />
        <Slider label="Thickness (3D)" value={t.depth} min={0} max={8} step={0.5} unit="%" onChange={(depth) => set({ depth }, "depth")} />
        <Slider label="Shadow" value={t.shadow} min={0} max={60} onChange={(shadow) => set({ shadow }, "shadow")} />
      </Group>
      <Group title="Background">
        <Seg full value={t.bg} onChange={(bg: Bg) => set({ bg })} options={[
          { v: "color", label: "Color" }, { v: "gradient", label: "Gradient" }, { v: "panorama", label: "Panorama" }, { v: "blur", label: "Blur" },
        ]} />
        <p className="hint">{BG_HINT[t.bg]}</p>
        <div className="colors">
          {t.bg === "color"
            ? <input type="color" value={t.solid} onChange={(e) => set({ solid: e.target.value }, "solid")} />
            : <>
                <input type="color" value={t.c1} onChange={(e) => set({ c1: e.target.value }, "c1")} />
                <input type="color" value={t.c2} onChange={(e) => set({ c2: e.target.value }, "c2")} />
              </>}
          <div className="swatches">
            {GRADIENTS.map(([a, b]) => (
              <button key={a} style={{ background: `linear-gradient(135deg,${a},${b})` }} onClick={() => set({ c1: a, c2: b, ...(t.bg === "color" ? { bg: "gradient" as Bg } : {}) })} />
            ))}
          </div>
        </div>
        {t.bg === "blur" && <>
          <Slider label="Blur" value={t.blur} min={0} max={30} onChange={(blur) => set({ blur }, "blur")} />
          <Slider label="Overlay" value={t.overlay} min={0} max={80} unit="%" onChange={(overlay) => set({ overlay }, "overlay")} />
        </>}
      </Group>
      <Group title="Typography">
        <label className="chip tall"><Type />
          <select value={t.font} onChange={(e) => set({ font: e.target.value })}>
            {Object.keys(FONTS).map((f) => <option key={f}>{f}</option>)}
          </select>
        </label>
        <Slider label="Headline size" value={t.tsize} min={5} max={12} step={0.5} onChange={(tsize) => set({ tsize }, "tsize")} />
        <div className="two">
          <Seg full value={t.align} onChange={(align: Theme["align"]) => set({ align })} options={[
            { v: "left", icon: <TextAlignStart />, title: "Left" }, { v: "center", icon: <TextAlignCenter />, title: "Center" },
          ]} />
          <Seg full value={t.ink} onChange={(ink: Theme["ink"]) => set({ ink })} options={[
            { v: "light", label: "Light", icon: <Sun /> }, { v: "dark", label: "Dark", icon: <Moon /> },
          ]} />
        </div>
      </Group>
      <Group>
        <button className="ghost" onClick={() => set({ ...DEFAULT_THEME })}><RotateCcw />Reset theme</button>
      </Group>
    </>
  );
}

export function Inspector({ p, sel, tab, update, onReplace, onDuplicate }: { p: Project; sel: number; tab: "slide" | "feature"; update: Update; onReplace: () => void; onDuplicate: () => void }) {
  const setTheme = (patch: Partial<Theme>, tag?: string) => update((d) => ({ ...d, theme: { ...d.theme, ...patch } }), tag);
  const setSlide = (patch: Partial<Slide>, tag?: string) =>
    update((d) => ({ ...d, slides: d.slides.map((s, i) => (i === sel ? { ...s, ...patch } : s)) }), tag);
  const setFeature = (patch: Partial<Feature>, tag?: string) => update((d) => ({ ...d, feature: { ...d.feature, ...patch } }), tag);
  const theme = <><div className="divider"><Layers />Theme — applies to all slides</div><ThemeControls t={p.theme} set={setTheme} /></>;

  if (tab === "feature") {
    const f = p.feature;
    return (
      <aside className="right">
        <Group title="Feature graphic" right={<span className="mono">1024×500</span>}>
          <input className="field" value={f.name} placeholder="App name" onChange={(e) => setFeature({ name: e.target.value }, "fname")} />
          <input className="field" value={f.tagline} placeholder="Tagline" onChange={(e) => setFeature({ tagline: e.target.value }, "ftag")} />
          <span className="lab">Icon</span>
          <div className="icons">
            {Object.entries(FEATURE_ICONS).map(([k, I]) => (
              <button key={k} className={f.icon === k ? "on" : ""} onClick={() => setFeature({ icon: k })}><I /></button>
            ))}
          </div>
          <Seg full value={f.device ? "on" : "off"} onChange={(v) => setFeature({ device: v === "on" })} options={[
            { v: "on", label: "Show devices", icon: <Smartphone /> }, { v: "off", label: "Hide", icon: <EyeOff /> },
          ]} />
        </Group>
        {f.device && <TiltControls v={f} scale={f.scale} scaleRange={[12, 30]} tag="f" onChange={(patch, tag) => setFeature(patch, tag)} />}
        <div className="divider"><Palette />Theme — shared with screenshots</div>
        <ThemeControls t={p.theme} set={setTheme} />
      </aside>
    );
  }

  const s = p.slides[sel];
  if (!s) return <aside className="right" />;
  const [title, sub] = textOf(s, p.loc);
  const setText = (k: 0 | 1, v: string) => {
    const cur: [string, string] = [...textOf(s, p.loc)] as [string, string];
    cur[k] = v;
    setSlide({ t: { ...s.t, [p.loc]: cur } }, `text${k}`);
  };
  return (
    <aside className="right">
      <Group title={`Slide ${sel + 1}`} right={<span className="mono">{LOCALES[p.loc]}</span>}>
        <textarea className="field" rows={2} value={title} placeholder="Headline" onChange={(e) => setText(0, e.target.value)} />
        <input className="field" value={sub} placeholder="Subtitle (optional)" onChange={(e) => setText(1, e.target.value)} />
        <div className="two">
          <button className="ghost" onClick={onReplace}><ImageUp />Screenshot</button>
          <button className="ghost" onClick={onDuplicate}><CopyPlus />Duplicate</button>
        </div>
      </Group>
      <Group title="Layout">
        <div className="layouts">
          {LAYOUTS.map((l) => (
            <button key={l.v} className={s.layout === l.v ? "on" : ""} onClick={() => setSlide({ layout: l.v })}>{l.icon}{l.label}</button>
          ))}
        </div>
      </Group>
      <TiltControls v={s} scale={s.scale} scaleRange={[40, 100]} tag="s" onChange={(patch, tag) => setSlide(patch, tag)} />
      {theme}
    </aside>
  );
}
