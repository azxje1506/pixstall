// Vẽ 1 screenshot (SlideCanvas) hoặc Feature Graphic 1024×500 (FeatureCanvas) ở bề ngang W px bất kỳ
// Quy ước: font-size gốc = W/100 px → 1em = 1% bề ngang, nên thumbnail, canvas và file xuất giống hệt nhau
// Có prop `edit` → chế độ sửa trực tiếp: kéo máy/chữ để dời (dx,dy / tx,ty), 4 góc đổi cỡ, nút tròn xoay, double-click chữ để gõ,
// gióng theo lề/tâm/phần tử kia + thước đo khoảng cách (px ảnh xuất). front = phần nào nằm trên
// Root canvas mang data-cv để đo vị trí khi kéo. Style slide = themeOf(p, s) (Project style + override riêng slide)
// Chữ: *từ* được tô màu hl; khi double-click thì dòng đó remount (đổi key) sang chữ thô có dấu sao để gõ an toàn
// Chọn layer Text: 2 tay cầm cạnh trái/phải kéo đổi bề ngang (tw); quá 3 dòng thì hiện cảnh báo trên canvas
import { useLayoutEffect, useRef, useState } from "react";
import type { Theme, Slide } from "@/lib/types";
import type { CSSProperties, ReactNode, PointerEvent as RPE, MouseEvent as RME, KeyboardEvent as RKE, FocusEvent as RFE } from "react";
import { FEATURE_ICONS } from "./icons";
import type { Project, SizePreset } from "@/lib/types";
import { FONTS, FEATURE_SIZE } from "@/lib/presets";
import { textOf, themeOf, richParts } from "@/lib/rules";
import { mockScreen } from "@/lib/mocks";
import { Device, ASPECT } from "./Device";

// Nền slide; panorama = một nền dài n slide, slide i lấy khúc thứ i → lướt store thấy liền mạch
function background(t: Theme, i: number, hEm: number, n: number): CSSProperties {
  if (t.bg === "color") return { background: t.solid };
  if (t.bg === "gradient" || t.bg === "blur") return { background: `linear-gradient(165deg,${t.c1},${t.c2})` };
  return {
    backgroundImage: `radial-gradient(circle at 18% 22%,${t.c2} 0,transparent 22%),radial-gradient(circle at 52% 80%,${t.c2}cc 0,transparent 26%),radial-gradient(circle at 84% 30%,#ffffff55 0,transparent 18%),linear-gradient(100deg,${t.c1},${t.c2} 50%,${t.c1})`,
    backgroundSize: `${100 * n}em ${hEm}em`,
    backgroundPosition: `${-i * 100}em 0`,
  };
}

// --- Chế độ sửa trên canvas (dùng chung cho Slide và Feature graphic) ---
// Cấp chọn: null = không chọn gì · "slide" = cả slide (bấm nền) · "text" / "device" = một layer
export type CanvasPick = "slide" | "device" | "text" | null;
export type LayerPick = "device" | "text";
export interface CanvasEdit {
  sel: CanvasPick;
  hover?: LayerPick | null; // rê chuột trên cây Layers → viền layer tương ứng trên canvas
  onSel: (v: CanvasPick) => void;
  onPatch: (patch: Record<string, unknown>, tag: string) => void; // patch vào slide đang chọn hoặc feature
}
type Rect = { l: number; t: number; r: number; b: number };
// Lớp phủ khi sửa (em, toạ độ canvas): đường gióng x/y, thước đo khoảng cách m, nhãn số tip
type Guides = { x?: number; y?: number; m?: { x1: number; y1: number; x2: number; y2: number; label: string }; tip?: { x: number; y: number; text: string } };

const SNAP = 1.2; // em: trong khoảng này thì hút
const r1 = (v: number) => Math.round(v * 10) / 10;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

// Kéo chuột: đổi px → em; chặn kéo ảnh native của trình duyệt (preventDefault ở pointerdown)
function startDrag(e: RPE, k: number, onMove: (mx: number, my: number) => void, onEnd?: () => void) {
  e.preventDefault();
  const sx = e.clientX, sy = e.clientY;
  const move = (ev: PointerEvent) => onMove((ev.clientX - sx) / k, (ev.clientY - sy) / k);
  const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); document.body.classList.remove("dragging"); onEnd?.(); };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  document.body.classList.add("dragging");
}

// Khung phần tử (em) so với góc trái trên canvas
const rectEm = (el: Element, R: DOMRect, k: number): Rect => {
  const r = el.getBoundingClientRect();
  return { l: (r.left - R.left) / k, t: (r.top - R.top) / k, r: (r.right - R.left) / k, b: (r.bottom - R.top) / k };
};

// Tìm điểm hút gần nhất: cạnh/tâm của phần tử (es) so với các đích (ts); trả độ lệch cần bù + vị trí đường gióng
function bestSnap(es: number[], ts: number[]): { d: number; at: number } | null {
  let best: { d: number; at: number } | null = null;
  for (const e of es) for (const t of ts) if (Math.abs(t - e) < SNAP && (!best || Math.abs(t - e) < Math.abs(best.d))) best = { d: t - e, at: t };
  return best;
}

// Thước đo khoảng trống giữa 2 khung (dọc nếu chồng theo chiều ngang, ngang nếu chồng theo chiều dọc)
function measure(a: Rect, o: Rect, pxPerEm: number): Guides["m"] {
  const lab = (g: number) => `${Math.round(g * pxPerEm)}`;
  if (a.l < o.r && a.r > o.l) {
    const x = (Math.max(a.l, o.l) + Math.min(a.r, o.r)) / 2;
    if (a.t >= o.b) return { x1: x, x2: x, y1: o.b, y2: a.t, label: lab(a.t - o.b) };
    if (o.t >= a.b) return { x1: x, x2: x, y1: a.b, y2: o.t, label: lab(o.t - a.b) };
  } else if (a.t < o.b && a.b > o.t) {
    const y = (Math.max(a.t, o.t) + Math.min(a.b, o.b)) / 2;
    if (a.l >= o.r) return { x1: o.r, x2: a.l, y1: y, y2: y, label: lab(a.l - o.r) };
    if (o.l >= a.r) return { x1: a.r, x2: o.l, y1: y, y2: y, label: lab(o.l - a.r) };
  }
  return undefined;
}

// Bộ công cụ sửa: props gắn vào máy/chữ + 4 nút góc đổi cỡ + nút xoay + lớp gióng/thước đo
// Hút: cạnh/tâm phần tử về lề 8% · tâm · lề 92% của canvas và cạnh/tâm phần tử kia; không trúng thì hút offset về 0
function useEditKit(edit: CanvasEdit | undefined, k: number, hEm: number, o: { dx: number; dy: number; tx: number; ty: number },
  scale: { v: number; min: number; max: number; mul: number } | null, rot: { v: number } | null, pxPerEm: number) {
  const [g, setG] = useState<Guides>({});
  const [editing, setEditing] = useState<string | null>(null); // id dòng chữ đang gõ
  // Một dòng chữ: không sửa thì tô *từ*; đang gõ thì hiện chữ thô. key đổi theo trạng thái → React dựng lại thẻ, tránh lệch DOM
  const rich = (val: string, hl: string): ReactNode => richParts(val).map(([x, h], i) => (h ? <span key={i} style={{ color: hl }}>{x}</span> : x));
  const lineOf = (id: string, val: string, hl: string, commit: (v: string) => void) => {
    if (!edit) return { key: "r", props: {}, children: rich(val, hl) };
    const on = editing === id;
    return {
      key: on ? "e" : "r",
      children: on ? val : rich(val, hl),
      props: {
        "data-line": id,
        suppressContentEditableWarning: true,
        onDoubleClick: (e: RME<HTMLElement>) => {
          const root = e.currentTarget.closest("[data-cv]");
          setEditing(id);
          requestAnimationFrame(() => {
            const el = root?.querySelector<HTMLElement>(`[data-line="${id}"]`);
            if (!el) return;
            el.contentEditable = "true"; el.focus();
            const rg = document.createRange(); rg.selectNodeContents(el); const sl = getSelection(); sl?.removeAllRanges(); sl?.addRange(rg);
          });
        },
        onKeyDown: (e: RKE<HTMLElement>) => { e.stopPropagation(); if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); } if (e.key === "Escape") e.currentTarget.blur(); },
        onBlur: (e: RFE<HTMLElement>) => { const v = e.currentTarget.innerText.trim(); setEditing(null); if (v !== val) commit(v); },
      },
    };
  };
  if (!edit) return { hitDev: undefined, hitText: undefined, handle: undefined, guides: null, lineOf, root: undefined };

  const drag = (e: RPE, what: LayerPick) => {
    if (e.button !== 0 || (e.target as HTMLElement).isContentEditable) return;
    e.stopPropagation(); edit.onSel(what);
    const el = e.currentTarget as HTMLElement, root = el.closest("[data-cv]") as HTMLElement, R = root.getBoundingClientRect();
    const r0 = rectEm(el, R, k);
    const otherEl = [...root.querySelectorAll("[data-pick]")].find((x) => x !== el);
    const ot = otherEl ? rectEm(otherEl, R, k) : null;
    const tx = [8, 50, 92, ...(ot ? [ot.l, (ot.l + ot.r) / 2, ot.r] : [])];
    const ty = [hEm / 2, ...(ot ? [ot.t, (ot.t + ot.b) / 2, ot.b] : [])];
    const [bx, by] = what === "device" ? [o.dx, o.dy] : [o.tx, o.ty];
    const [kx, ky] = what === "device" ? ["dx", "dy"] : ["tx", "ty"];
    startDrag(e, k, (mx, my) => {
      const ng: Guides = {};
      const sx = bestSnap([r0.l + mx, (r0.l + r0.r) / 2 + mx, r0.r + mx], tx);
      const sy = bestSnap([r0.t + my, (r0.t + r0.b) / 2 + my, r0.b + my], ty);
      let x = bx + mx, y = by + my;
      if (sx) { x += sx.d; ng.x = sx.at; } else if (Math.abs(x) < SNAP) x = 0;
      if (sy) { y += sy.d; ng.y = sy.at; } else if (Math.abs(y) < SNAP) y = 0;
      if (ot) { const sh = { l: r0.l + x - bx, r: r0.r + x - bx, t: r0.t + y - by, b: r0.b + y - by }; ng.m = measure(sh, ot, pxPerEm); }
      setG(ng);
      edit.onPatch({ [kx]: r1(x), [ky]: r1(y) }, "drag-" + what);
    }, () => setG({}));
  };
  const hit = (what: LayerPick) => ({
    "data-pick": what,
    className: `ed-hit ${what} ${edit.sel === what ? "sel" : ""} ${edit.hover === what ? "hov" : ""}`,
    onPointerDown: (e: RPE) => drag(e, what),
    onDragStart: (e: { preventDefault: () => void }) => e.preventDefault(),
  });

  // Vị trí con trỏ (em) trong canvas — để đặt nhãn số cạnh chuột
  const ptr = (e: RPE) => { const R = (e.currentTarget as HTMLElement).closest("[data-cv]")!.getBoundingClientRect(); return [(e.clientX - R.left) / k, (e.clientY - R.top) / k]; };

  // 4 nút góc: kéo ra ngoài = to, vào trong = nhỏ (góc trái đảo dấu); nút tròn trên đỉnh = xoay Spin Z (hút 0°/±15° trong 2°)
  const handle = edit.sel === "device" ? (
    <>
      {scale && (["nw", "ne", "sw", "se"] as const).map((c) => (
        <span key={c} className={`ed-handle ${c}`} onPointerDown={(e) => {
          e.stopPropagation();
          const sign = c.includes("e") ? 1 : -1, [px, py] = ptr(e);
          startDrag(e, k, (mx, my) => {
            const v = Math.round(clamp(scale.v + mx * sign * scale.mul, scale.min, scale.max));
            setG({ tip: { x: px + mx, y: py + my, text: `${v}%` } });
            edit.onPatch({ scale: v }, "drag-scale");
          }, () => setG({}));
        }} />
      ))}
      {rot && (
        <span className="ed-rot" title="Drag to rotate · snaps to 0° and ±15°" onPointerDown={(e) => {
          e.stopPropagation();
          const box = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
          const cx = box.left + box.width / 2, cy = box.top + box.height / 2;
          const a0 = Math.atan2(e.clientY - cy, e.clientX - cx), sx = e.clientX, sy = e.clientY, [px, py] = ptr(e);
          startDrag(e, k, (mx, my) => {
            let a = rot.v + ((Math.atan2(sy + my * k - cy, sx + mx * k - cx) - a0) * 180) / Math.PI;
            a = ((a + 540) % 360) - 180;
            for (const t of [0, 15, -15]) if (Math.abs(a - t) < 2) a = t;
            a = Math.round(clamp(a, -45, 45));
            setG({ tip: { x: px + mx, y: py + my, text: `${a}°` } });
            edit.onPatch({ rz: a }, "drag-rot");
          }, () => setG({}));
        }} />
      )}
    </>
  ) : undefined;


  const m = g.m;
  const guides = (
    <>
      {g.x !== undefined && <div className="ed-guide v" style={{ left: `${g.x}em` }} />}
      {g.y !== undefined && <div className="ed-guide h" style={{ top: `${g.y}em` }} />}
      {m && (
        <div className={`ed-measure ${m.x1 === m.x2 ? "v" : "h"}`} style={{ left: `${Math.min(m.x1, m.x2)}em`, top: `${Math.min(m.y1, m.y2)}em`, width: `${Math.abs(m.x2 - m.x1)}em`, height: `${Math.abs(m.y2 - m.y1)}em` }}>
          <span>{m.label}</span>
        </div>
      )}
      {g.tip && <div className="ed-tip" style={{ left: `${g.tip.x}em`, top: `${g.tip.y}em` }}>{g.tip.text}</div>}
    </>
  );
  // Bấm nền slide (chỗ không có layer) → chọn cấp Slide
  const root = { onPointerDown: (e: RPE) => { if (e.button !== 0) return; e.stopPropagation(); edit.onSel("slide"); } };
  return { hitDev: hit("device"), hitText: hit("text"), handle, guides, lineOf, root };
}

function Screen({ p, i }: { p: Project; i: number }) {
  const s = p.slides[i];
  if (!s) return null;
  return s.img ? <img src={s.img} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : <div dangerouslySetInnerHTML={{ __html: mockScreen(s.mock) }} />;
}

export function SlideCanvas({ p, index, width, size, loc, edit }: { p: Project; index: number; width: number; size: SizePreset; loc?: string; edit?: CanvasEdit }) {
  const s = p.slides[index], t = themeOf(p, s), n = p.slides.length;
  const L = loc ?? p.loc, k = width / 100;
  const cv = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState(0); // số dòng tiêu đề (chỉ đo khi đang sửa)
  const dx = s?.dx ?? 0, dy = s?.dy ?? 0, tx = s?.tx ?? 0, ty = s?.ty ?? 0;
  const hEm = (100 * size.h) / size.w;
  const centered = s && (s.layout === "center" || s.layout === "bleed" || s.layout === "bottom");
  // Máy canh giữa thì nở 2 phía khi kéo góc → nhân 2; layout duo không có nút đổi cỡ
  const kit = useEditKit(edit, k, hEm, { dx, dy, tx, ty }, s && s.layout !== "duo" ? { v: s.scale, min: 40, max: 100, mul: centered ? 2 : 1 } : null,
    s && s.layout !== "duo" ? { v: s.rz } : null, size.w / 100);
  const titleRaw = s ? textOf(s, L)[0] : "";
  useLayoutEffect(() => {
    if (!edit) return;
    const h = cv.current?.querySelector<HTMLElement>('[data-line="t0"]');
    if (h) setLines(Math.round(h.getBoundingClientRect().height / ((width / 100) * t.tsize * t.tlh)));
  }, [edit, titleRaw, width, t.tsize, t.tlh, t.font, t.tweight, s?.tw, s?.layout]);
  if (!s) return null;
  const [title, sub] = textOf(s, L);
  const tab = size.kind === "tablet", asp = ASPECT[size.kind];
  const ink = t.tcolor || (t.ink === "light" ? "#fff" : "#15151A");

  // --- Tính vị trí chữ + máy theo layout (đơn vị em) ---
  const padT = tab ? 6 : 9;
  const textH = t.tsize * 2.35 + (sub ? t.tsize * 0.9 + 1.6 : 0);
  const below = padT + textH + 4; // máy bắt đầu dưới khối chữ
  const textStyle: CSSProperties = { position: "absolute", left: "8em", right: "8em", zIndex: s.front === "device" ? 0 : 3, textAlign: t.align, color: ink, fontFamily: FONTS[t.font], transform: tx || ty ? `translate(${tx}em,${ty}em)` : undefined };

  const { hitDev, hitText, handle, lineOf } = kit;
  const setLine = (i: 0 | 1) => (v: string) => { const cur = [...textOf(s, L)] as [string, string]; cur[i] = v; edit?.onPatch({ t: { ...s.t, [L]: cur } }, ""); };
  const dev = { kind: size.kind, store: p.store, theme: t, rx: s.rx, ry: s.ry, rz: s.rz, hit: hitDev };
  let devices: ReactNode = null;

  if (s.layout === "bottom") {
    textStyle.bottom = `${padT}em`;
    const w = Math.min(s.scale, (hEm - 7 - textH - padT - 5) / asp);
    devices = <Device {...dev} handle={handle} w={w} x={(100 - w) / 2 + dx} y={6 + dy}><Screen p={p} i={index} /></Device>;
  } else {
    textStyle.top = `${padT}em`;
    if (s.layout === "center") {
      const w = Math.min(s.scale, (hEm - below - 5) / asp);
      devices = <Device {...dev} handle={handle} w={w} x={(100 - w) / 2 + dx} y={below + dy}><Screen p={p} i={index} /></Device>;
    }
    if (s.layout === "bleed") devices = <Device {...dev} handle={handle} w={s.scale} x={(100 - s.scale) / 2 + dx} y={below + dy}><Screen p={p} i={index} /></Device>;
    if (s.layout === "offset") devices = <Device {...dev} handle={handle} w={s.scale} x={34 + dx} y={below - 2 + dy}><Screen p={p} i={index} /></Device>;
    if (s.layout === "duo") {
      const w = s.scale * 0.66;
      devices = (
        <>
          <Device {...dev} rz={s.rz + 6} w={w} x={100 - 5 - w + dx} y={below + 8 + dy} z={1}><Screen p={p} i={(index + 1) % n} /></Device>
          <Device {...dev} rz={s.rz - 4} w={w} x={5 + dx} y={below + dy}><Screen p={p} i={index} /></Device>
        </>
      );
    }
  }
  // Bề ngang khối chữ: mặc định 84% (offset: 62%, bám lề trái); tw đè lên. Khối giữa thì nở đều 2 bên
  const offset = s.layout === "offset", twDef = offset ? 62 : 84, tw = s.tw ?? twDef;
  if (offset) { textStyle.textAlign = "left"; textStyle.left = "8em"; textStyle.right = `${100 - 8 - tw}em`; }
  else { textStyle.left = `${(100 - tw) / 2}em`; textStyle.right = `${(100 - tw) / 2}em`; }
  // Tay cầm đổi bề ngang (khi layer Text đang chọn)
  const widthHandle = (side: "l" | "r") => (
    <span key={side} className={`ed-wh ${side}`} title="Drag to change text width" onPointerDown={(e) => {
      e.stopPropagation();
      const sign = side === "r" ? 1 : -1, mul = offset ? (side === "r" ? 1 : 0) : 2;
      if (!mul) return;
      startDrag(e, k, (mx) => edit?.onPatch({ tw: Math.round(Math.min(offset ? 92 - 8 : 100, Math.max(30, tw + mx * sign * mul))) } as Partial<Slide>, "drag-tw"));
    }} />
  );
  const L0 = lineOf("t0", title, t.hl, setLine(0)), L1 = lineOf("t1", sub, t.hl, setLine(1));

  return (
    <div data-cv ref={cv} {...kit.root} style={{ position: "relative", overflow: "hidden", width, height: (width * size.h) / size.w, fontSize: width / 100, ...background(t, index, hEm, n) }}>
      {t.bg === "blur" && s.img && (
        <>
          <div style={{ position: "absolute", inset: "-10%", backgroundImage: `url(${s.img})`, backgroundSize: "cover", backgroundPosition: "center", filter: `blur(${t.blur * 0.12}em)` }} />
          <div style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${t.overlay / 100})` }} />
        </>
      )}
      {!s.hidden?.text && <div {...hitText} style={textStyle}>
        <h2 key={L0.key} {...L0.props} style={{ fontSize: `${t.tsize}em`, fontWeight: t.tweight, lineHeight: t.tlh, letterSpacing: "-.02em", margin: 0 }}>{L0.children}</h2>
        {sub && <p key={"s" + L1.key} {...L1.props} style={{ fontSize: `${t.tsize * 0.48}em`, marginTop: "1.4em", marginBottom: 0, opacity: 0.85, fontWeight: 500, lineHeight: 1.3 }}>{L1.children}</p>}
        {edit?.sel === "text" && [widthHandle("l"), widthHandle("r")]}
        {edit && lines > 3 && <span className="ed-warn">{lines} lines · shorten or widen</span>}
      </div>}
      {!s.hidden?.device && devices}
      {kit.guides}
    </div>
  );
}

// Feature Graphic Google Play: icon + tên + câu giới thiệu + cụm 2 máy 3D; có `edit` thì kéo cụm chữ / cụm máy như slide
export function FeatureCanvas({ p, width, edit }: { p: Project; width: number; edit?: CanvasEdit }) {
  const f = p.feature, t = p.theme, k = width / 100;
  const hEm = (100 * FEATURE_SIZE.h) / FEATURE_SIZE.w;
  const dx = f.dx ?? 0, dy = f.dy ?? 0, tx = f.tx ?? 0, ty = f.ty ?? 0;
  const kit = useEditKit(edit, k, hEm, { dx, dy, tx, ty }, { v: f.scale, min: 12, max: 30, mul: 1 }, { v: f.rz }, FEATURE_SIZE.w / 100);
  const ink = t.tcolor || (t.ink === "light" ? "#fff" : "#15151A");
  const Icon = FEATURE_ICONS[f.icon] ?? FEATURE_ICONS.sprout;
  const dw = f.scale, dev = { kind: "phone" as const, store: "play" as const, theme: t, rx: f.rx, ry: f.ry, rz: f.rz };
  const y0 = (hEm - dw * ASPECT.phone) / 2;
  const FN = kit.lineOf("fn", f.name, t.hl, (name) => edit?.onPatch({ name }, ""));
  const FT = kit.lineOf("ft", f.tagline, t.hl, (tagline) => edit?.onPatch({ tagline }, ""));
  return (
    <div data-cv {...kit.root} style={{ position: "relative", overflow: "hidden", width, height: (width * FEATURE_SIZE.h) / FEATURE_SIZE.w, fontSize: width / 100, ...background(t, 0, hEm, 1) }}>
      <div {...kit.hitText} style={{ position: "absolute", left: "7em", top: "50%", transform: `translate(${tx}em, calc(-50% + ${ty}em))`, color: ink, fontFamily: FONTS[t.font], zIndex: f.front === "device" ? 0 : 3, width: "48em" }}>
        <div style={{ width: "10em", height: "10em", borderRadius: "2.6em", background: "#fff", display: "grid", placeItems: "center", boxShadow: "0 .8em 2.4em rgba(0,0,0,.16)", color: t.c1 }}>
          <Icon style={{ width: "5.4em", height: "5.4em" }} strokeWidth={2} />
        </div>
        <h2 key={FN.key} {...FN.props} style={{ fontSize: "7em", margin: ".3em 0 0", fontWeight: 800, letterSpacing: "-.03em", lineHeight: 1 }}>{FN.children}</h2>
        <p key={"t" + FT.key} {...FT.props} style={{ fontSize: "3em", margin: ".35em 0 0", opacity: 0.88, fontWeight: 500 }}>{FT.children}</p>
      </div>
      {f.device && (
        // Cụm máy bọc chung 1 khung để kéo cả cặp; khung phủ đúng vùng 2 máy
        <div {...kit.hitDev} style={{ position: "absolute", left: `${100 - 6 - dw * 1.85 + dx}em`, top: `${y0 - 1.5 + dy}em`, width: `${dw * 1.85}em`, height: `${dw * ASPECT.phone + 4.5}em`, zIndex: 2 }}>
          <Device {...dev} rz={f.rz + 4} w={dw} x={dw * 0.85} y={0} z={1}><Screen p={p} i={1} /></Device>
          <Device {...dev} w={dw} x={0} y={4.5}><Screen p={p} i={0} /></Device>
          {kit.handle}
        </div>
      )}
      {kit.guides}
    </div>
  );
}
