// Vẽ 1 screenshot (SlideCanvas) hoặc Feature Graphic 1024×500 (FeatureCanvas) ở bề ngang W px bất kỳ
// Quy ước: font-size gốc = W/100 px → 1em = 1% bề ngang, nên thumbnail, canvas và file xuất giống hệt nhau
// Có prop `edit` → chế độ sửa trực tiếp: kéo máy/chữ để dời (dx,dy / tx,ty), kéo góc máy đổi cỡ, double-click chữ để gõ, đường gióng tâm
// Root canvas mang data-cv để đo vị trí khi kéo
import { useState } from "react";
import type { CSSProperties, ReactNode, PointerEvent as RPE, MouseEvent as RME, KeyboardEvent as RKE, FocusEvent as RFE } from "react";
import { FEATURE_ICONS } from "./icons";
import type { Project, SizePreset } from "@/lib/types";
import { FONTS, FEATURE_SIZE } from "@/lib/presets";
import { textOf } from "@/lib/rules";
import { mockScreen } from "@/lib/mocks";
import { Device, ASPECT } from "./Device";

// Nền slide; panorama = một nền dài n slide, slide i lấy khúc thứ i → lướt store thấy liền mạch
function background(p: Project, i: number, hEm: number, n: number): CSSProperties {
  const t = p.theme;
  if (t.bg === "color") return { background: t.solid };
  if (t.bg === "gradient" || t.bg === "blur") return { background: `linear-gradient(165deg,${t.c1},${t.c2})` };
  return {
    backgroundImage: `radial-gradient(circle at 18% 22%,${t.c2} 0,transparent 22%),radial-gradient(circle at 52% 80%,${t.c2}cc 0,transparent 26%),radial-gradient(circle at 84% 30%,#ffffff55 0,transparent 18%),linear-gradient(100deg,${t.c1},${t.c2} 50%,${t.c1})`,
    backgroundSize: `${100 * n}em ${hEm}em`,
    backgroundPosition: `${-i * 100}em 0`,
  };
}

// --- Chế độ sửa trên canvas (dùng chung cho Slide và Feature graphic) ---
export type CanvasPick = "device" | "text" | null;
export interface CanvasEdit {
  sel: CanvasPick;
  onSel: (v: CanvasPick) => void;
  onPatch: (patch: Record<string, unknown>, tag: string) => void; // patch vào slide đang chọn hoặc feature
}
type Guides = { x?: number; y?: number }; // em, vị trí đường gióng đang hiện

const SNAP = 1.2; // em: trong khoảng này thì hút
const r1 = (v: number) => Math.round(v * 10) / 10;

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

// Bộ công cụ sửa: trả props gắn vào máy/chữ + nút đổi cỡ + lớp đường gióng
// Hút: tâm phần tử về tâm canvas (hiện đường gióng tím), hoặc offset về 0 (vị trí gốc của layout)
function useEditKit(edit: CanvasEdit | undefined, k: number, hEm: number, o: { dx: number; dy: number; tx: number; ty: number },
  scale: { v: number; min: number; max: number; mul: number } | null) {
  const [g, setG] = useState<Guides>({});
  if (!edit) return { hitDev: undefined, hitText: undefined, handle: undefined, guides: null, editable: () => undefined };

  const drag = (e: RPE, what: "device" | "text") => {
    if (e.button !== 0 || (e.target as HTMLElement).isContentEditable) return;
    e.stopPropagation(); edit.onSel(what);
    // Đo tâm phần tử lúc bắt đầu (em, so với góc trái trên canvas)
    const el = e.currentTarget as HTMLElement, root = el.closest("[data-cv]") as HTMLElement;
    const r = el.getBoundingClientRect(), R = root.getBoundingClientRect();
    const cx = (r.left + r.width / 2 - R.left) / k, cy = (r.top + r.height / 2 - R.top) / k;
    const [bx, by] = what === "device" ? [o.dx, o.dy] : [o.tx, o.ty];
    const [kx, ky] = what === "device" ? ["dx", "dy"] : ["tx", "ty"];
    startDrag(e, k, (mx, my) => {
      const ng: Guides = {};
      let x = bx + mx, y = by + my;
      if (Math.abs(cx + mx - 50) < SNAP) { x = bx + 50 - cx; ng.x = 50; } else if (Math.abs(x) < SNAP) x = 0;
      if (Math.abs(cy + my - hEm / 2) < SNAP) { y = by + hEm / 2 - cy; ng.y = hEm / 2; } else if (Math.abs(y) < SNAP) y = 0;
      setG(ng);
      edit.onPatch({ [kx]: r1(x), [ky]: r1(y) }, "drag-" + what);
    }, () => setG({}));
  };
  const hit = (what: "device" | "text") => ({
    className: `ed-hit ${edit.sel === what ? "sel" : ""}`,
    onPointerDown: (e: RPE) => drag(e, what),
    onDragStart: (e: { preventDefault: () => void }) => e.preventDefault(),
  });
  // Nút góc: kéo ngang đổi cỡ máy
  const handle = edit.sel === "device" && scale ? (
    <span className="ed-handle" onPointerDown={(e) => {
      e.stopPropagation();
      startDrag(e, k, (mx) => edit.onPatch({ scale: Math.round(Math.min(scale.max, Math.max(scale.min, scale.v + mx * scale.mul))) }, "drag-scale"));
    }} />
  ) : undefined;
  // Double-click chữ → gõ thẳng; Enter/rời ô thì gọi commit(text mới)
  const editable = (val: string, commit: (v: string) => void) => ({
    suppressContentEditableWarning: true,
    onDoubleClick: (e: RME<HTMLElement>) => {
      const el = e.currentTarget; el.contentEditable = "true"; el.focus();
      const rg = document.createRange(); rg.selectNodeContents(el); const sl = getSelection(); sl?.removeAllRanges(); sl?.addRange(rg);
    },
    onKeyDown: (e: RKE<HTMLElement>) => { e.stopPropagation(); if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); } if (e.key === "Escape") e.currentTarget.blur(); },
    onBlur: (e: RFE<HTMLElement>) => { const el = e.currentTarget; el.contentEditable = "false"; const v = el.innerText.trim(); if (v !== val) commit(v); },
  });
  const guides = (g.x !== undefined || g.y !== undefined) ? (
    <>
      {g.x !== undefined && <div className="ed-guide v" style={{ left: `${g.x}em` }} />}
      {g.y !== undefined && <div className="ed-guide h" style={{ top: `${g.y}em` }} />}
    </>
  ) : null;
  return { hitDev: hit("device"), hitText: hit("text"), handle, guides, editable };
}

function Screen({ p, i }: { p: Project; i: number }) {
  const s = p.slides[i];
  if (!s) return null;
  return s.img ? <img src={s.img} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : <div dangerouslySetInnerHTML={{ __html: mockScreen(s.mock) }} />;
}

export function SlideCanvas({ p, index, width, size, loc, edit }: { p: Project; index: number; width: number; size: SizePreset; loc?: string; edit?: CanvasEdit }) {
  const s = p.slides[index], t = p.theme, n = p.slides.length;
  const L = loc ?? p.loc, k = width / 100;
  const dx = s?.dx ?? 0, dy = s?.dy ?? 0, tx = s?.tx ?? 0, ty = s?.ty ?? 0;
  const hEm = (100 * size.h) / size.w;
  const centered = s && (s.layout === "center" || s.layout === "bleed" || s.layout === "bottom");
  // Máy canh giữa thì nở 2 phía khi kéo góc → nhân 2; layout duo không có nút đổi cỡ
  const kit = useEditKit(edit, k, hEm, { dx, dy, tx, ty }, s && s.layout !== "duo" ? { v: s.scale, min: 40, max: 100, mul: centered ? 2 : 1 } : null);
  if (!s) return null;
  const [title, sub] = textOf(s, L);
  const tab = size.kind === "tablet", asp = ASPECT[size.kind];
  const ink = t.ink === "light" ? "#fff" : "#15151A";

  // --- Tính vị trí chữ + máy theo layout (đơn vị em) ---
  const padT = tab ? 6 : 9;
  const textH = t.tsize * 2.35 + (sub ? t.tsize * 0.9 + 1.6 : 0);
  const below = padT + textH + 4; // máy bắt đầu dưới khối chữ
  const textStyle: CSSProperties = { position: "absolute", left: "8em", right: "8em", zIndex: 3, textAlign: t.align, color: ink, fontFamily: FONTS[t.font], transform: tx || ty ? `translate(${tx}em,${ty}em)` : undefined };

  const { hitDev, hitText, handle, editable } = kit;
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
  if (s.layout === "offset") { textStyle.textAlign = "left"; textStyle.right = "30em"; }

  return (
    <div data-cv style={{ position: "relative", overflow: "hidden", width, height: (width * size.h) / size.w, fontSize: width / 100, ...background(p, index, hEm, n) }}>
      {t.bg === "blur" && s.img && (
        <>
          <div style={{ position: "absolute", inset: "-10%", backgroundImage: `url(${s.img})`, backgroundSize: "cover", backgroundPosition: "center", filter: `blur(${t.blur * 0.12}em)` }} />
          <div style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${t.overlay / 100})` }} />
        </>
      )}
      <div {...hitText} style={textStyle}>
        <h2 {...editable(title, setLine(0))} style={{ fontSize: `${t.tsize}em`, fontWeight: 800, lineHeight: 1.08, letterSpacing: "-.02em", margin: 0 }}>{title}</h2>
        {sub && <p {...editable(sub, setLine(1))} style={{ fontSize: `${t.tsize * 0.48}em`, marginTop: "1.4em", marginBottom: 0, opacity: 0.85, fontWeight: 500, lineHeight: 1.3 }}>{sub}</p>}
      </div>
      {devices}
      {kit.guides}
    </div>
  );
}

// Feature Graphic Google Play: icon + tên + câu giới thiệu + cụm 2 máy 3D; có `edit` thì kéo cụm chữ / cụm máy như slide
export function FeatureCanvas({ p, width, edit }: { p: Project; width: number; edit?: CanvasEdit }) {
  const f = p.feature, t = p.theme, k = width / 100;
  const hEm = (100 * FEATURE_SIZE.h) / FEATURE_SIZE.w;
  const dx = f.dx ?? 0, dy = f.dy ?? 0, tx = f.tx ?? 0, ty = f.ty ?? 0;
  const kit = useEditKit(edit, k, hEm, { dx, dy, tx, ty }, { v: f.scale, min: 12, max: 30, mul: 1 });
  const ink = t.ink === "light" ? "#fff" : "#15151A";
  const Icon = FEATURE_ICONS[f.icon] ?? FEATURE_ICONS.sprout;
  const dw = f.scale, dev = { kind: "phone" as const, store: "play" as const, theme: t, rx: f.rx, ry: f.ry, rz: f.rz };
  const y0 = (hEm - dw * ASPECT.phone) / 2;
  return (
    <div data-cv style={{ position: "relative", overflow: "hidden", width, height: (width * FEATURE_SIZE.h) / FEATURE_SIZE.w, fontSize: width / 100, ...background(p, 0, hEm, 1) }}>
      <div {...kit.hitText} style={{ position: "absolute", left: "7em", top: "50%", transform: `translate(${tx}em, calc(-50% + ${ty}em))`, color: ink, fontFamily: FONTS[t.font], zIndex: 3, width: "48em" }}>
        <div style={{ width: "10em", height: "10em", borderRadius: "2.6em", background: "#fff", display: "grid", placeItems: "center", boxShadow: "0 .8em 2.4em rgba(0,0,0,.16)", color: t.c1 }}>
          <Icon style={{ width: "5.4em", height: "5.4em" }} strokeWidth={2} />
        </div>
        <h2 {...kit.editable(f.name, (name) => edit?.onPatch({ name }, ""))} style={{ fontSize: "7em", margin: ".3em 0 0", fontWeight: 800, letterSpacing: "-.03em", lineHeight: 1 }}>{f.name}</h2>
        <p {...kit.editable(f.tagline, (tagline) => edit?.onPatch({ tagline }, ""))} style={{ fontSize: "3em", margin: ".35em 0 0", opacity: 0.88, fontWeight: 500 }}>{f.tagline}</p>
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
