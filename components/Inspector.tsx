// Cột phải (kiểu Framer): CHỈ hiện setting của layer đang chọn
//   Feature graphic: App icon · App name · Tagline · Text/Badge · Phone 1..3 — mỗi cái một panel (giống slide)
//   Layer chữ: Headline · Subtitle · Text/Badge tự do (x:…) — mỗi loại một panel; Delete để xoá, "+ Add text" để thêm
//   tab "Slide"/"Feature": breadcrumb "Slide 03 › Device" + panel theo cấp chọn
//     · Slide (hoặc chưa chọn): layer con (bấm để chọn, mắt để ẩn) · Layout · Background
//     · Text: nội dung · vị trí · Typography     · Device: ảnh chụp · vị trí/cỡ/3D · khung máy
//   tab "Project style": mọi thiết lập dùng chung, gom một chỗ để xem tổng
// Nhóm gắn nhãn "All slides" = thiết lập dùng chung toàn dự án (U2 sẽ cho đè riêng từng slide)
// Mọi thay đổi đi qua update(fn, tag) — tag gộp các lần kéo slider thành 1 bước undo
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ImageUp, CopyPlus, ImageOff, RotateCcw, Smartphone, EyeOff, Eye, TextAlignStart, TextAlignCenter, Sun, Moon, Type,
  PanelBottom, ArrowDownToLine, Copy, MoveRight, CopyCheck, ChevronRight, Frame, Highlighter, Plus, Trash2, Crop, Link2, Languages, Columns2, AlignCenter, GalleryHorizontalEnd, Image as ImageIcon } from "lucide-react";
import type { Deco, Project, Slide, Theme, ThemeKey, Feature, Layout, Tilt3D, FrameStyle, FrameColor, Bg, TextItem, ImgFit, PhoneCfg } from "@/lib/types";
import { FONTS, FRAME_COLORS, GRADIENTS, TILT_PRESETS, DEFAULT_THEME, LOCALES, uid } from "@/lib/presets";
import { DECOS, DECO_GROUPS, decoDef, decoColor, decoSize } from "@/lib/decos";
import { textOf, themeOf, plain, allSizes, imgFor, currentSize } from "@/lib/rules";
import { mockScreen } from "@/lib/mocks";
import { FEATURE_ICONS } from "./icons";
import { Seg, Slider, Group, Num, Prop, Tabs } from "./ui";
import { ColorField } from "./ColorField";
import { MenuButton, type MenuItem } from "./Popover";
import type { CanvasPick, LayerPick } from "./SlideCanvas";
import { isLayer, isDeco, decoOf, patchDeco, isHidden, layersOf, layerName as nameOf, extraOf, extraText, patchExtra, posOf, withPos, featText, setFeatText, fLayersOf, fIsHidden, fRemovable, fLayerName, phoneIdx, phoneOf, setPhone, phoneCount as phoneCountOf, type LayerId } from "@/lib/layers";
import { imgSrc, imgMeta, putImage } from "@/lib/images";
import { ASPECT } from "./Device";
import { TEMPLATES, TPL_GROUPS, activeTemplate, applyTemplate, type Template } from "@/lib/templates";
import { panRange, screenRatio, featureShot } from "./SlideCanvas";
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
  blur: "Each slide uses its own screenshot, enlarged and blurred, tinted with your two colors.",
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
      <Prop stack label="Style" {...mk(sc, "frame")}>
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
      <Prop stack label="Type" {...mk(sc, "bg")}>
        <Seg full value={t.bg} onChange={(bg: Bg) => set({ bg })} options={[
          { v: "color", label: "Color" }, { v: "gradient", label: "Gradient" }, { v: "panorama", label: "Panorama" }, { v: "blur", label: "Blur" },
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
      <Prop stack label="Color" {...mk(sc, "ink", "tcolor")}>
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
function DeviceControls({ v, scaleRange, onChange, tag, right, label = "Device", noPos }: {
  v: Tilt3D & { scale: number; dx?: number; dy?: number }; scaleRange: [number, number]; tag: string; right?: ReactNode; label?: string; noPos?: boolean;
  onChange: (patch: Partial<Tilt3D & { scale: number; dx: number; dy: number }>, tag?: string) => void;
}) {
  const active = TILT_PRESETS.find((t) => t.v.rx === v.rx && t.v.ry === v.ry && t.v.rz === v.rz)?.id;
  return (
    <Group id={`${tag}-device`} title={label} right={right}>
      {!noPos && <Prop label="Position">
        <Num prefix="X" value={v.dx ?? 0} step={0.5} onChange={(dx) => onChange({ dx }, tag + "dx")} />
        <Num prefix="Y" value={v.dy ?? 0} step={0.5} onChange={(dy) => onChange({ dy }, tag + "dy")} />
      </Prop>}
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
function LayerList({ rows, onPick, onToggle, addItems }: { rows: { id: LayerId; name: string; sub: string; hidden?: boolean }[]; onPick: (l: LayerId) => void; onToggle?: (l: LayerId) => void; addItems?: () => MenuItem[] }) {
  return (
    // Nút "Add text" sát mép phải panel → menu căn mép phải với nút (bottom-end), không đè lên danh sách
    <Group title="Layers" right={addItems && <MenuButton className="gbtn" title="Add a text layer" placement="bottom-end" menuWidth={168} items={addItems}><Plus />Add text</MenuButton>}>
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

// --- Kho hình trang trí: lưới thẻ xem trước trên nền slide (c1→c2) để hình trắng vẫn thấy; bấm = thêm / đổi hình ---
function DecoGrid({ t, on, onPick, groups = true }: { t: Theme; on?: string; onPick: (kind: string) => void; groups?: boolean }) {
  const bg = t.bg === "color" ? t.solid : `linear-gradient(160deg,${t.c1},${t.c2})`;
  const tile = (d: (typeof DECOS)[number]) => (
    <button key={d.id} className={`dtile ${on === d.id ? "on" : ""}`} title={d.name} aria-label={`${on ? "Change to" : "Add"} ${d.name}`} onClick={() => onPick(d.id)} style={{ background: bg }}>
      <span style={{ width: d.ar < 0.5 ? "80%" : "62%", aspectRatio: `${1 / d.ar}` }} dangerouslySetInnerHTML={{ __html: d.svg(decoColor(d.def, t), decoColor(d.def2 ?? "white", t)) }} />
    </button>
  );
  if (!groups) return <div className="dgrid">{DECOS.map(tile)}</div>;
  return <>{DECO_GROUPS.map((g) => (
    <div key={g.id} className="tgroup"><div className="sublab">{g.label}</div><div className="dgrid">{DECOS.filter((d) => d.group === g.id).map(tile)}</div></div>
  ))}</>;
}

// --- Template mẫu: thẻ xem trước (nền + máy + chữ thu nhỏ), bấm = áp cả bộ style ---
function TplThumb({ t }: { t: Theme }) {
  const bg = t.bg === "color" ? t.solid : `linear-gradient(${t.bg === "panorama" ? "100deg" : "160deg"},${t.c1},${t.c2})`;
  const ink = t.tcolor || (t.ink === "light" ? "#FFFFFF" : "#15151A");
  return (
    <div className="tthumb" style={{ background: bg }}>
      {[0, 1].map((i) => (
        <div key={i} className="tslide" style={{ alignItems: t.align === "left" ? "flex-start" : "center" }}>
          <b style={{ fontFamily: FONTS[t.font], fontWeight: t.tweight, color: ink }}>{i ? "Big " : ""}<span style={{ color: t.hl }}>{i ? "you" : "Aa"}</span></b>
          <i style={{ background: FRAME_COLORS[t.frameColor].body, borderRadius: `${t.radius * 0.3}px ${t.radius * 0.3}px 0 0`, boxShadow: `0 ${t.shadow / 10}px ${t.shadow / 5}px rgba(0,0,0,.${t.shadow > 35 ? 4 : 2})` }} />
        </div>
      ))}
    </div>
  );
}

function TemplateGroup({ t, onApply }: { t: Theme; onApply: (tpl: Template) => void }) {
  const on = activeTemplate(t);
  return (
    <Group id="st-tpl" title="Templates">
      {TPL_GROUPS.map((g) => (
        <div key={g.id} className="tgroup">
          <div className="sublab">{g.label}</div>
          <div className="tgrid">
            {TEMPLATES.filter((x) => x.group === g.id).map((x) => (
              <button key={x.id} className={`tcard ${on === x.id ? "on" : ""}`} title={x.desc} aria-label={`Apply ${x.name} template`} aria-pressed={on === x.id} onClick={() => onApply(x)}>
                <TplThumb t={x.theme} />
                <span>{x.name}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
      <p className="hint">Changes frame, background &amp; type on every slide. Text, images and layouts stay.</p>
    </Group>
  );
}

// --- Tab Project style: template + mọi thiết lập dùng chung + số slide đang có style riêng ---
function StyleTab({ sc, owned, onClearAll, onTemplate }: { sc: Scope; owned: number; onClearAll: () => void; onTemplate: (tpl: Template) => void }) {
  return (
    <>
      <p className="tabnote">Defaults for every slide{sc.t.bg === "panorama" ? " and the feature graphic" : ""}. Select a slide or layer to give just that one its own look.</p>
      {owned > 0 && (
        <div className="ownnote">
          <span><b>{owned} slide{owned > 1 ? "s" : ""}</b> use{owned > 1 ? "" : "s"} their own style and won't follow some changes here.</span>
          <button className="gbtn" onClick={onClearAll}><RotateCcw />Reset all</button>
        </div>
      )}
      <TemplateGroup t={sc.t} onApply={onTemplate} />
      <FrameGroup sc={sc} />
      <BgGroup sc={sc} />
      <TypeGroup sc={sc} />
      <div className="group">
        <button className="ghost" onClick={() => sc.set({ ...DEFAULT_THEME })}><RotateCcw />Reset project style</button>
      </div>
    </>
  );
}

type ImgKey = "img" | "img2";
export function Inspector({ p, sel, tab, update, pick, onPickLayer, onToggleHidden, onRemoveLayer, addItems, onReplace, onReplaceFile, onDuplicate, onFlash, crop, onCrop }: {
  p: Project; sel: number; tab: "slide" | "feature"; update: Update; pick: CanvasPick;
  onPickLayer: (l: CanvasPick) => void; onToggleHidden: (l: LayerPick) => void;
  onRemoveLayer: (l: LayerId) => void; addItems: () => MenuItem[];
  onReplace: (k?: ImgKey) => void; onReplaceFile: (f: File | undefined, k?: ImgKey) => void; onDuplicate: () => void; onFlash: (m: string, undo?: boolean) => void;
  crop: LayerId | null; onCrop: (l: LayerId | null) => void;
}) {
  const [ptab, setPtab] = useState<PTab>("item");
  const [hot, setHot] = useState(false); // kéo file ngang thẻ Screenshot
  const ta = useRef<HTMLTextAreaElement>(null); // ô tiêu đề (để tô màu phần bôi đen)
  // Ô chọn file dùng riêng trong panel (icon app, ảnh theo ngôn ngữ): đặt đích rồi mở hộp chọn
  const fileIn = useRef<HTMLInputElement>(null), fileTo = useRef<(ref: string) => void>(() => {});
  const pickTo = (fn: (ref: string) => void) => { fileTo.current = fn; fileIn.current?.click(); };
  const filePicker = <input ref={fileIn} type="file" accept="image/*" hidden onChange={async (e) => {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    const ref = await putImage(f).catch(() => null);
    if (ref) fileTo.current(ref); else onFlash("Couldn't read that image");
  }} />;
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
  const currentKind = (allSizes(p).find((z) => z.id === p.sizeId) ?? { kind: "phone" as const }).kind;
  const layer: LayerId | null = isLayer(pick) ? pick : null;
  const head = (
    <div className="phead">
      <Tabs value={ptab} onChange={setPtab} options={[{ v: "item", label: isFeature ? "Feature" : "Slide" }, { v: "style", label: "Project style" }]} />
    </div>
  );
  if (ptab === "style") return <aside className="right">{head}<StyleTab sc={project} owned={owned}
    onClearAll={() => { update((d) => ({ ...d, slides: d.slides.map((x) => ({ ...x, override: undefined })) })); onFlash("Every slide follows the project style again", true); }}
    onTemplate={(tpl) => { update((d) => applyTemplate(d, tpl)); onFlash(`${tpl.name} template applied${owned ? ` · ${owned} slide style${owned > 1 ? "s" : ""} reset` : ""}`, true); }} /></aside>;

  // Breadcrumb: "Slide 03 › Device"; bấm phần đầu để lùi về cấp slide
  const rootName = isFeature ? "Feature graphic" : `Slide ${String(sel + 1).padStart(2, "0")}`;
  const layerName = !layer ? "" : isFeature ? fLayerName(p.feature, layer) : nameOf(p.slides[sel], layer);
  const crumb = (actions: ReactNode) => (
    <div className="slidebar">
      <nav className="crumb" aria-label="Selection">
        {layer ? <button className="cr-root" onClick={() => onPickLayer("slide")}>{rootName}</button> : <span className="cr-cur">{isFeature ? <ImageIcon /> : <Frame />}{rootName}</span>}
        {layer && <><ChevronRight className="cr-sep" /><span className="cr-cur">{layerIcon(layer, layerName)}{layerName}</span></>}
      </nav>
      <span className="row g4">{actions}</span>
    </div>
  );

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

  // Thẻ ảnh chung (feature): xem ảnh / màn mẫu, thả file để thay qua onFile
  const card = (src: string | null | undefined, mock: number, title: string, hint: string, extra: ReactNode, onFile: (ref: string) => void) => (
    <div className={`shot ${hot ? "hot" : ""}`}
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); e.stopPropagation(); setHot(true); } }}
      onDragLeave={() => setHot(false)}
      onDrop={async (e) => { e.preventDefault(); e.stopPropagation(); setHot(false); const fl = e.dataTransfer.files[0]; if (!fl) return; const ref = await putImage(fl).catch(() => null); if (ref) onFile(ref); }}>
      <div className="shot-img">
        {src ? <img src={imgSrc(src, true)} alt="" draggable={false} /> : <div className="shot-mock" dangerouslySetInnerHTML={{ __html: mockScreen(mock) }} />}
        {!src && <span className="shot-tag">Sample</span>}
      </div>
      <div className="shot-meta">
        <span className="shot-t">{title}</span>
        <span className="hint">{hot ? "Drop to replace" : hint}</span>
        <span className="row g4">{extra}</span>
      </div>
    </div>
  );

  // Nhóm "Image in screen" dùng chung (máy slide, máy 2 Duo, máy Feature): Fill/Fit · Zoom · Offset · căn trên canvas · cảnh báo tỉ lệ
  const imgFit = (gid: string, img: string, c: ImgFit, set: (patch: ImgFit, tag?: string) => void, cropId: LayerId, kind: "phone" | "tablet", th: Theme) => {
    const sr = screenRatio(kind, th), pr = panRange(img, c, sr), m = imgMeta(img);
    const d = m && c.fit !== "fit" ? (m.h / m.w) * sr - 1 : 0; // >0: ảnh cao hơn màn → cắt trên/dưới
    return (
      <Group id={gid} title="Image in screen" right={(c.ix || c.iy || (c.iz ?? 1) !== 1 || c.fit === "fit") ? <button className="gbtn" onClick={() => set({ ix: 0, iy: 0, iz: 1, fit: "fill" })}><RotateCcw />Reset</button> : undefined}>
        <Prop label="Mode">
          <Seg full value={c.fit ?? "fill"} onChange={(fit: "fill" | "fit") => set({ fit })} options={[{ v: "fill", label: "Fill" }, { v: "fit", label: "Fit" }]} />
        </Prop>
        <Slider label="Zoom" value={Math.round((c.iz ?? 1) * 100)} min={100} max={300} step={5} unit="%" onChange={(v) => set({ iz: v / 100 }, gid + "iz")} />
        {(pr[0] > 0 || pr[1] > 0) ? (
          <Prop label="Offset">
            {pr[0] > 0 && <Num prefix="X" value={c.ix ?? 0} step={5} min={-100} max={100} onChange={(ix) => set({ ix }, gid + "ix")} />}
            {pr[1] > 0 && <Num prefix="Y" value={c.iy ?? 0} step={5} min={-100} max={100} onChange={(iy) => set({ iy }, gid + "iy")} />}
          </Prop>
        ) : <p className="hint">The whole screenshot is visible — zoom in to reposition it.</p>}
        <button className={crop === cropId ? "primary sm wide" : "ghost sm wide"} onClick={() => onCrop(crop === cropId ? null : cropId)}>
          <Crop />{crop === cropId ? "Done adjusting" : "Adjust on canvas"}
        </button>
        {m && Math.abs(d) >= 0.06 && <p className="warnline small"><Crop />{m.w}×{m.h} is {d > 0 ? "taller" : "wider"} than this screen — the {d > 0 ? "top & bottom" : "sides"} get cropped. Drag to reposition or switch to Fit.</p>}
      </Group>
    );
  };

  // Panel chữ tự do / badge dùng chung (slide + feature)
  const extraPanel = (ex: TextItem, setEx: (patch: Partial<TextItem>, tag?: string) => void, th: Theme) => {
    const val = extraText(ex, p.loc);
    return <>
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
          <ColorField label="Text color" value={ex.color || (th.tcolor || (th.ink === "light" ? "#FFFFFF" : "#15151A"))} onChange={(color) => setEx({ color }, "xc")} />
        </Prop>}
        {ex.pill && <p className="hint">Badge color follows the highlight color in Typography.</p>}
        <Prop label="Center">
          <Num prefix="X" value={ex.x} step={0.5} onChange={(x) => setEx({ x }, "xx")} />
          <Num prefix="Y" value={ex.y} step={0.5} onChange={(y) => setEx({ y }, "xy")} />
        </Prop>
      </Group>
    </>;
  };

  // ===== Feature graphic ===== (layer: icon · title=App name · sub=Tagline · x:… · device/device2/device3 = Phone 1..3)
  if (isFeature) {
    const f = p.feature, flay = f.layout ?? "split", pc = phoneCountOf(f);
    const [fname, ftag] = featText(f, p.loc);
    const pj = phoneIdx(layer), pcfg: PhoneCfg | null = pj >= 0 ? phoneOf(f, pj) : null;
    const fex = layer ? extraOf(f, layer) : undefined;
    const setPh = (patch: Partial<PhoneCfg>, tag?: string) => setFeature({ phones: setPhone(f, pj, patch) }, tag);
    const fHidden = layer ? fIsHidden(f, layer) : false;
    const [fx, fy] = layer && !fex ? posOf(f, layer) : [0, 0];
    const setPos = (x: number, y: number, tag: string) => layer && setFeature(withPos(f, layer, x, y) as Partial<Feature>, tag);
    const actions = <>
      {layer && !fex && (fx || fy) ? <button className="gbtn" title="Reset position" onClick={() => setPos(0, 0, "")}><RotateCcw />Reset</button> : null}
      {layer && <button className="ibtn" title={fHidden ? "Show layer" : "Hide layer"} aria-label={fHidden ? "Show layer" : "Hide layer"} onClick={() => onToggleHidden(layer)}>{fHidden ? <EyeOff /> : <Eye />}</button>}
      {layer && fRemovable(layer) && <button className="ibtn danger" title="Delete layer (Del)" aria-label="Delete layer" onClick={() => onRemoveLayer(layer)}><Trash2 /></button>}
    </>;
    const hid = fHidden && <p className="hidnote"><EyeOff />This layer is hidden.</p>;
    const posGroup = (gid: string) => (
      <Group id={gid} title="Position">
        <Prop label="Offset">
          <Num prefix="X" value={fx} step={0.5} onChange={(x) => setPos(x, fy, gid + "x")} />
          <Num prefix="Y" value={fy} step={0.5} onChange={(y) => setPos(fx, y, gid + "y")} />
        </Prop>
      </Group>
    );
    let body: ReactNode;
    if (layer === "title" || layer === "sub") {
      const k = layer === "title" ? 0 : 1, val = k ? ftag : fname;
      body = <>
        {hid}
        <Group id="f-text" title={k ? "Tagline" : "App name"} right={<span className="mono">{LOCALES[p.loc]}</span>}>
          <textarea ref={ta} className="field" rows={1} value={val} aria-label={k ? "Tagline" : "App name"} placeholder={k ? "Tagline" : "App name"} onChange={(e) => setFeature(setFeatText(f, p.loc, k, e.target.value), `ft${k}`)} />
          {hlRow(val, (v) => setFeature(setFeatText(f, p.loc, k, v)))}
        </Group>
        {posGroup("f-tpos")}
        <TypeGroup sc={project} />
      </>;
    } else if (layer === "icon") body = <>
      {hid}
      {/* Icon app: ảnh thật (khuyên dùng, 512×512) hoặc icon có sẵn */}
      <Group id="f-icon" title="App icon">
        <div className="iconrow">
          <span className="iconprev">{f.iconImg ? <img src={imgSrc(f.iconImg, true)} alt="" /> : (() => { const I = FEATURE_ICONS[f.icon] ?? FEATURE_ICONS.sprout; return <I />; })()}</span>
          <span className="shot-meta">
            <span className="shot-t">{f.iconImg ? "Your app icon" : "Placeholder icon"}</span>
            <span className="hint">PNG, square, 512×512 works best</span>
            <span className="row g4">
              <button className="primary sm" onClick={() => pickTo((iconImg) => setFeature({ iconImg }))}><ImageUp />{f.iconImg ? "Replace" : "Upload icon"}</button>
              {f.iconImg && <button className="ghost sm" title="Remove icon image" aria-label="Remove icon image" onClick={() => setFeature({ iconImg: undefined })}><ImageOff /></button>}
            </span>
          </span>
        </div>
        {!f.iconImg && <div className="icons">
          {Object.entries(FEATURE_ICONS).map(([k, I]) => (
            <button key={k} title={k} aria-label={`Icon ${k}`} className={f.icon === k ? "on" : ""} onClick={() => setFeature({ icon: k })}><I /></button>
          ))}
        </div>}
      </Group>
      {posGroup("f-ipos")}
    </>;
    else if (fex && layer) body = <>{hid}{extraPanel(fex, (patch, tag) => setFeature(patchExtra(f, layer, patch), tag), project.t)}</>;
    else if (pcfg && layer) {
      const si = featureShot(p, pj), linkedS = p.slides[si];
      body = <>
        {hid}
        {/* Ảnh của máy: ảnh riêng (chỉ dùng ở feature graphic) hoặc liên kết ảnh một slide */}
        <Group id="f-shot" title="Screenshot">
          {pcfg.img
            ? card(pcfg.img, 0, "Own image", "Only used in the feature graphic", <>
                <button className="primary sm" onClick={() => pickTo((img) => setPh({ img, ix: 0, iy: 0, iz: 1 }))}><ImageUp />Replace</button>
                <button className="ghost sm" title="Use a slide's screenshot instead" onClick={() => setPh({ img: undefined })}><Link2 />Link slide</button>
              </>, (img) => setPh({ img, ix: 0, iy: 0, iz: 1 }))
            : <>
                <Prop label="Slide">
                  <label className="chip">
                    <select value={linkedS?.id} aria-label={`Screen of phone ${pj + 1}`} onChange={(e) => {
                      const ids = Array.from({ length: pc }, (_, q) => p.slides[featureShot(p, q)]?.id ?? "");
                      ids[pj] = e.target.value; setFeature({ shots: ids });
                    }}>
                      {p.slides.map((x, i) => <option key={x.id} value={x.id}>Slide {String(i + 1).padStart(2, "0")} · {plain(textOf(x, p.loc)[0]) || "Untitled"}</option>)}
                    </select>
                  </label>
                </Prop>
                {card(imgFor(linkedS, p.loc), linkedS?.mock ?? 0, `Linked to slide ${String(si + 1).padStart(2, "0")}`, "Follows that slide's screenshot", <>
                  <button className="primary sm" onClick={() => pickTo((img) => setPh({ img, ix: 0, iy: 0, iz: 1 }))}><ImageUp />Use own image</button>
                </>, (img) => setPh({ img, ix: 0, iy: 0, iz: 1 }))}
              </>}
        </Group>
        {pcfg.img && imgFit("f-img", pcfg.img, pcfg, (patch, tag) => setPh(patch, tag), layer, "phone", project.t)}
        <Group id="f-phone" title={`Phone ${pj + 1}`}>
          <Prop label="Position">
            <Num prefix="X" value={pcfg.dx ?? 0} step={0.5} onChange={(dx) => setPh({ dx }, "pdx")} />
            <Num prefix="Y" value={pcfg.dy ?? 0} step={0.5} onChange={(dy) => setPh({ dy }, "pdy")} />
          </Prop>
          <Slider label="Extra spin" value={pcfg.rz ?? 0} min={-30} max={30} unit="°" onChange={(rz) => setPh({ rz }, "prz")} />
        </Group>
        <DeviceControls label="All phones" noPos v={f} scaleRange={[12, 30]} tag="f" onChange={(patch, tg) => setFeature(patch, tg)} />
        <FrameGroup sc={project} />
      </>;
    } else body = <>
      <LayerList onPick={onPickLayer} onToggle={onToggleHidden} addItems={addItems}
        rows={fLayersOf(f, p.loc, (j) => featureShot(p, j) + 1).map((l) => ({ ...l, hidden: fIsHidden(f, l.id) }))} />
      <Group id="f-layout" title="Layout" right={<span className="mono">1024×500</span>}>
        <div className="layouts three">
          {([["split", "Text left", <Columns2 key="a" />], ["center", "Centered", <AlignCenter key="b" />], ["phones", "Phones", <GalleryHorizontalEnd key="c" />]] as const).map(([v, label, ic]) => (
            <button key={v} className={flay === v ? "on" : ""} onClick={() => setFeature({ layout: v, dx: 0, dy: 0, tx: 0, ty: 0, sx: 0, sy: 0, ox: 0, oy: 0, device: true, phones: f.phones?.map((c) => ({ ...c, dx: 0, dy: 0, rz: 0 })) })}>{ic}{label}</button>
          ))}
        </div>
        <p className="hint">The banner on top of your Google Play listing. Click any text, the icon or a phone on the canvas to edit just that.</p>
      </Group>
      <BgGroup sc={project} />
    </>;
    return <aside className="right">{head}{crumb(actions)}{body}{filePicker}</aside>;
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
  const dc = layer && isDeco(layer) ? decoOf(s, layer) : undefined;
  const [lx, ly] = layer === "title" ? [s.tx, s.ty] : layer === "sub" ? [s.sx, s.sy] : layer === "device" ? [s.dx, s.dy] : layer === "device2" ? [s.bx, s.by] : [0, 0];
  const moved = layer && !ex ? !!(lx || ly) : !layer && !!(s.dx || s.dy || s.tx || s.ty || s.sx || s.sy);
  const resetPos = () => setSlide(layer === "title" ? { tx: 0, ty: 0 } : layer === "sub" ? { sx: 0, sy: 0 } : layer === "device" ? { dx: 0, dy: 0 } : layer === "device2" ? { bx: 0, by: 0 } : { dx: 0, dy: 0, tx: 0, ty: 0, sx: 0, sy: 0, bx: 0, by: 0 });
  const nextNo = ((sel + 1) % p.slides.length) + 1, linked = p.slides[nextNo - 1];

  // Thẻ ảnh chụp dùng chung cho máy chính / máy 2: xem ảnh, bấm hoặc thả file để thay
  const shotCard = (k: ImgKey, src: string | null | undefined, mock: number, title: string, hint: string, extra: ReactNode) => (
    <div className={`shot ${hot ? "hot" : ""}`}
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); e.stopPropagation(); setHot(true); } }}
      onDragLeave={() => setHot(false)}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setHot(false); onReplaceFile(e.dataTransfer.files[0], k); }}>
      <div className="shot-img">
        {src ? <img src={imgSrc(src, true)} alt="" draggable={false} /> : <div className="shot-mock" dangerouslySetInnerHTML={{ __html: mockScreen(mock) }} />}
        {!src && <span className="shot-tag">Sample</span>}
      </div>
      <div className="shot-meta">
        <span className="shot-t">{title}</span>
        <span className="hint">{hot ? "Drop to replace" : hint}</span>
        <span className="row g4">{extra}</span>
      </div>
    </div>
  );

  const shown = imgFor(s, p.loc), own = !!s.imgs?.[p.loc]; // ảnh đang hiện ở ngôn ngữ này / có ảnh riêng cho ngôn ngữ này không
  const pr = panRange(shown, s, screenRatio(currentKind, slideScope.t));
  // Cảnh báo lệch tỉ lệ: tỉ lệ ảnh so với tỉ lệ màn (trừ viền máy) lệch >6% thì báo phần nào bị cắt
  const ratioNote = (() => {
    const m = imgMeta(shown); if (!m || s.fit === "fit") return null;
    const t = slideScope.t, bz = t.frame === "none" ? 0 : t.bezel / 100, kind = currentKind;
    const scr = (ASPECT[kind] - 2 * bz) / (1 - 2 * bz), img = m.h / m.w, d = img / scr - 1;
    if (Math.abs(d) < 0.06) return null;
    return <p className="warnline small"><Crop />{m.w}×{m.h} is {d > 0 ? "taller" : "wider"} than this screen — the {d > 0 ? "top & bottom" : "sides"} get cropped. Drag to reposition or switch to Fit.</p>;
  })();
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
  } else if (dc && layer) {
    const def = decoDef(dc.kind), th = slideScope.t;
    const setD = (patch: Partial<Deco>, tag?: string) => setSlide(patchDeco(s, layer, patch), tag);
    body = <>
      {hidNote}
      <Group id="s-deco" title="Shape" right={<span className="mono">{def.name}</span>}>
        <DecoGrid t={th} on={dc.kind} groups={false} onPick={(kind) => setD({ kind })} />
      </Group>
      <Group id="s-deco-style" title="Style" right={(dc.color || dc.color2) ? <button className="gbtn" onClick={() => setD({ color: undefined, color2: undefined })}><RotateCcw />Theme colors</button> : undefined}>
        <Prop label="Color"><ColorField label="Decoration color" value={dc.color || decoColor(def.def, th)} onChange={(color) => setD({ color }, "dcol")} /></Prop>
        {def.def2 && <Prop label="Color 2"><ColorField label="Second color" value={dc.color2 || decoColor(def.def2, th)} onChange={(color2) => setD({ color2 }, "dcol2")} /></Prop>}
        <Slider label="Size" value={dc.size} min={4} max={140} onChange={(size) => setD({ size }, "dsize")} />
        <Slider label="Rotate" value={dc.rot ?? 0} min={-180} max={180} unit="°" onChange={(rot) => setD({ rot }, "drot")} />
        <Slider label="Opacity" value={Math.round((dc.opacity ?? 1) * 100)} min={10} max={100} unit="%" onChange={(v) => setD({ opacity: v / 100 }, "dop")} />
        <Prop label="Position">
          <Num prefix="X" value={dc.x} step={0.5} onChange={(x) => setD({ x }, "dx")} />
          <Num prefix="Y" value={dc.y} step={0.5} onChange={(y) => setD({ y }, "dy")} />
        </Prop>
        <Prop stack label="Layer">
          <Seg full value={dc.front ? "front" : "back"} onChange={(v: string) => setD({ front: v === "front" })} options={[{ v: "back", label: "Behind device" }, { v: "front", label: "On top" }]} />
        </Prop>
      </Group>
      <div className="group">
        <button className="ghost sm" onClick={() => {
          update((d) => ({ ...d, slides: d.slides.map((x, i) => (i === sel ? x : { ...x, decos: [...(x.decos ?? []), { ...dc, id: uid(), tpl: false }] })) }));
          onFlash(`${def.name} added to every slide`, true);
        }}><CopyCheck />Copy to all slides</button>
      </div>
    </>;
  } else if (ex && layer) {
    body = <>{hidNote}{extraPanel(ex, (patch, tag) => setSlide(patchExtra(s, layer, patch), tag), slideScope.t)}</>;
  } else if (layer === "device") body = <>
    {hidNote}
    <Group id="s-shot" title="Screenshot" right={shown && <span className="mono">{imgMeta(shown) ? `${imgMeta(shown)!.w}×${imgMeta(shown)!.h}` : ""}</span>}>
      {own
        ? shotCard("img", shown, s.mock, `${LOCALES[p.loc]} screenshot`, `Only used for ${LOCALES[p.loc]}`, <>
            <button className="primary sm" onClick={() => pickTo((ref) => setSlide({ imgs: { ...s.imgs, [p.loc]: ref } }))}><ImageUp />Replace</button>
            <button className="ghost sm" title="Use the shared screenshot for this language" onClick={() => { const { [p.loc]: _, ...rest } = s.imgs ?? {}; void _; setSlide({ imgs: Object.keys(rest).length ? rest : undefined }); }}><Link2 />Use shared</button>
          </>)
        : shotCard("img", s.img, s.mock, s.img ? "Your screenshot" : "Sample screen", s.img ? (p.loc === "en" ? "Drop a new image to replace" : "Shared by all languages") : "Replace it with your app's screen", <>
            <button className="primary sm" onClick={() => onReplace("img")}><ImageUp />{s.img ? "Replace" : "Upload"}</button>
            {s.img && <button className="ghost sm" title="Remove image" aria-label="Remove image" onClick={() => setSlide({ img: null })}><ImageOff /></button>}
          </>)}
      {/* Ảnh riêng cho ngôn ngữ đang xem (vd app bản tiếng Việt) */}
      {p.loc !== "en" && !own && (
        <button className="gbtn" onClick={() => pickTo((ref) => setSlide({ imgs: { ...s.imgs, [p.loc]: ref } }))}><Languages />Use a different screenshot for {LOCALES[p.loc]}</button>
      )}
    </Group>
    {/* Căn ảnh trong màn: Fill (cắt cho kín) / Fit (hiện trọn, viền đen), phóng to, dời */}
    {shown && imgFit("s-img", shown, s, (patch, tag) => setSlide(patch, tag), "device", currentKind, slideScope.t)}
    <DeviceControls v={s} scaleRange={[40, 100]} tag="s" onChange={(patch, tg) => setSlide(patch, tg)}
      right={<ApplyAll onClick={() => applyAll({ rx: s.rx, ry: s.ry, rz: s.rz, scale: s.scale }, "Device tilt & size")} />} />
    <FrameGroup sc={slideScope} />
  </>;
  // Máy 2 của Duo: ảnh riêng hoặc liên kết ảnh slide kế tiếp; vị trí + nghiêng riêng; cỡ & 3D dùng chung với Device
  else if (layer === "device2") body = <>
    {hidNote}
    <Group id="s-shot2" title="Screenshot">
      {s.img2
        ? shotCard("img2", s.img2, 0, "Own screenshot", "Only used on this slide", <>
            <button className="primary sm" onClick={() => onReplace("img2")}><ImageUp />Replace</button>
            <button className="ghost sm" title={`Show slide ${String(nextNo).padStart(2, "0")}'s screenshot instead`} onClick={() => setSlide({ img2: undefined })}><Link2 />Link</button>
          </>)
        : shotCard("img2", linked?.img, linked?.mock ?? 0, `Linked to slide ${String(nextNo).padStart(2, "0")}`, "Shows the next slide's screen — follows it when you change it", <>
            <button className="primary sm" onClick={() => onReplace("img2")}><ImageUp />Use own image</button>
          </>)}
    </Group>
    {s.img2 && imgFit("s-img2", s.img2, s.c2 ?? {}, (patch, tag) => setSlide({ c2: { ...s.c2, ...patch } }, tag), "device2", currentKind, slideScope.t)}
    <Group id="s-dev2" title="Device 2">
      <Prop label="Position">
        <Num prefix="X" value={s.bx ?? 0} step={0.5} onChange={(bx) => setSlide({ bx }, "bx")} />
        <Num prefix="Y" value={s.by ?? 0} step={0.5} onChange={(by) => setSlide({ by }, "by")} />
      </Prop>
      <Slider label="Extra spin" value={s.brz ?? 6} min={-30} max={30} unit="°" onChange={(brz) => setSlide({ brz }, "brz")} />
      <p className="hint">Size and 3D tilt are shared with Device — select Device to change them.</p>
      <button className="ghost sm wide" onClick={() => onPickLayer("device")}><Smartphone />Edit Device</button>
    </Group>
  </>;
  else body = <>
    <LayerList onPick={onPickLayer} onToggle={onToggleHidden} addItems={addItems}
      rows={layersOf(s, p.loc, nextNo).map((l) => ({ ...l, hidden: isHidden(s, l.id) }))} />
    <Group id="s-decor" title="Decorations">
      <DecoGrid t={slideScope.t} onPick={(kind) => {
        const def = decoDef(kind), z = currentSize(p), hEm = (100 * z.h) / z.w, id = uid(), n = (s.decos ?? []).length;
        const d: Deco = { id, kind, size: decoSize(def), x: 80 - (n % 3) * 30, y: Math.round(hEm * 0.12 + (n % 2) * 6), rot: 0 };
        setSlide({ decos: [...(s.decos ?? []), d] });
        onPickLayer(`d:${id}`);
      }} />
      <p className="hint">Click to add. Drag on the canvas to move; select it to recolor, resize or rotate. Templates add their own set.</p>
    </Group>
    <Group id="s-layout" title="Layout" right={<ApplyAll onClick={() => applyAll({ layout: s.layout }, "Layout")} />}>
      <div className="layouts">
        {LAYOUTS.map((l) => (
          <button key={l.v} title={l.label} className={s.layout === l.v ? "on" : ""} onClick={() => setSlide({ layout: l.v })}>{l.icon}{l.label}</button>
        ))}
      </div>
    </Group>
    <BgGroup sc={slideScope} />
  </>;

  return <aside className="right">{head}{crumb(actions)}{body}{filePicker}</aside>;
}
