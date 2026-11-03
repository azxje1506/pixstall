// Vẽ 1 screenshot (SlideCanvas) hoặc Feature Graphic 1024×500 (FeatureCanvas) ở bề ngang W px bất kỳ
// Quy ước: font-size gốc = W/100 px → 1em = 1% bề ngang, nên thumbnail, canvas và file xuất giống hệt nhau
// Có prop `edit` → chế độ sửa trực tiếp: kéo máy/chữ để dời (dx,dy / tx,ty), kéo góc máy đổi cỡ, double-click chữ để gõ
import type { CSSProperties, ReactNode, PointerEvent as RPE, MouseEvent as RME, KeyboardEvent as RKE, FocusEvent as RFE } from "react";
import { FEATURE_ICONS } from "./icons";
import type { Project, SizePreset, Slide } from "@/lib/types";
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

// --- Chế độ sửa trên canvas ---
export type CanvasPick = "device" | "text" | null;
export interface CanvasEdit {
  sel: CanvasPick;
  onSel: (v: CanvasPick) => void;
  onPatch: (patch: Partial<Slide>, tag: string) => void;
}

const SNAP = 1.2; // em: gần tâm thì hút về 0
const snap = (v: number) => (Math.abs(v) < SNAP ? 0 : Math.round(v * 10) / 10);

// Kéo chuột: đổi px → em theo bề ngang slide, gọi onMove liên tục tới khi nhả
function startDrag(e: RPE, k: number, onMove: (dxEm: number, dyEm: number) => void) {
  const sx = e.clientX, sy = e.clientY;
  const move = (ev: PointerEvent) => onMove((ev.clientX - sx) / k, (ev.clientY - sy) / k);
  const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); document.body.classList.remove("dragging"); };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  document.body.classList.add("dragging");
}

function Screen({ p, i }: { p: Project; i: number }) {
  const s = p.slides[i];
  if (!s) return null;
  return s.img ? <img src={s.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : <div dangerouslySetInnerHTML={{ __html: mockScreen(s.mock) }} />;
}

export function SlideCanvas({ p, index, width, size, loc, edit }: { p: Project; index: number; width: number; size: SizePreset; loc?: string; edit?: CanvasEdit }) {
  const s = p.slides[index], t = p.theme, n = p.slides.length;
  if (!s) return null;
  const L = loc ?? p.loc, k = width / 100;
  const dx = s.dx ?? 0, dy = s.dy ?? 0, tx = s.tx ?? 0, ty = s.ty ?? 0;
  const hEm = (100 * size.h) / size.w;
  const [title, sub] = textOf(s, L);
  const tab = size.kind === "tablet", asp = ASPECT[size.kind];
  const ink = t.ink === "light" ? "#fff" : "#15151A";

  // --- Tính vị trí chữ + máy theo layout (đơn vị em) ---
  const padT = tab ? 6 : 9;
  const textH = t.tsize * 2.35 + (sub ? t.tsize * 0.9 + 1.6 : 0);
  const below = padT + textH + 4; // máy bắt đầu dưới khối chữ
  const textStyle: CSSProperties = { position: "absolute", left: "8em", right: "8em", zIndex: 3, textAlign: t.align, color: ink, fontFamily: FONTS[t.font], transform: tx || ty ? `translate(${tx}em,${ty}em)` : undefined };

  // --- Bắt kéo thả khi đang sửa (edit có mặt) ---
  const centered = s.layout === "center" || s.layout === "bleed" || s.layout === "bottom";
  const hitDev = edit && {
    className: `ed-hit ${edit.sel === "device" ? "sel" : ""}`,
    onPointerDown: (e: RPE) => {
      if (e.button !== 0) return;
      e.stopPropagation(); edit.onSel("device");
      startDrag(e, k, (mx, my) => edit.onPatch({ dx: snap(dx + mx), dy: snap(dy + my) }, "drag-dev"));
    },
  };
  // Nút góc: kéo ngang đổi cỡ máy (máy canh giữa thì nở 2 phía → nhân 2)
  const handle = edit?.sel === "device" && s.layout !== "duo" ? (
    <span className="ed-handle" onPointerDown={(e) => {
      e.stopPropagation();
      startDrag(e, k, (mx) => edit.onPatch({ scale: Math.round(Math.min(100, Math.max(40, s.scale + mx * (centered ? 2 : 1)))) }, "drag-scale"));
    }} />
  ) : undefined;
  const hitText = edit && {
    className: `ed-hit ${edit.sel === "text" ? "sel" : ""}`,
    onPointerDown: (e: RPE) => {
      if (e.button !== 0 || (e.target as HTMLElement).isContentEditable) return;
      e.stopPropagation(); edit.onSel("text");
      startDrag(e, k, (mx, my) => edit.onPatch({ tx: snap(tx + mx), ty: snap(ty + my) }, "drag-text"));
    },
  };
  // Double-click chữ → gõ thẳng; rời ô (hoặc Enter) thì lưu theo ngôn ngữ đang xem
  const editable = (i: 0 | 1) => edit && {
    suppressContentEditableWarning: true,
    onDoubleClick: (e: RME<HTMLElement>) => {
      const el = e.currentTarget; el.contentEditable = "true"; el.focus();
      const r = document.createRange(); r.selectNodeContents(el); const sl = getSelection(); sl?.removeAllRanges(); sl?.addRange(r);
    },
    onKeyDown: (e: RKE<HTMLElement>) => { e.stopPropagation(); if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); } if (e.key === "Escape") e.currentTarget.blur(); },
    onBlur: (e: RFE<HTMLElement>) => {
      const el = e.currentTarget; el.contentEditable = "false";
      const cur = [...textOf(s, L)] as [string, string]; cur[i] = el.innerText.trim();
      if (cur[i] !== textOf(s, L)[i]) edit.onPatch({ t: { ...s.t, [L]: cur } }, "");
    },
  };
  const dev = { kind: size.kind, store: p.store, theme: t, rx: s.rx, ry: s.ry, rz: s.rz, hit: hitDev || undefined };
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
    <div style={{ position: "relative", overflow: "hidden", width, height: (width * size.h) / size.w, fontSize: width / 100, ...background(p, index, hEm, n) }}>
      {t.bg === "blur" && s.img && (
        <>
          <div style={{ position: "absolute", inset: "-10%", backgroundImage: `url(${s.img})`, backgroundSize: "cover", backgroundPosition: "center", filter: `blur(${t.blur * 0.12}em)` }} />
          <div style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${t.overlay / 100})` }} />
        </>
      )}
      <div {...hitText} style={textStyle}>
        <h2 {...editable(0)} style={{ fontSize: `${t.tsize}em`, fontWeight: 800, lineHeight: 1.08, letterSpacing: "-.02em", margin: 0 }}>{title}</h2>
        {sub && <p {...editable(1)} style={{ fontSize: `${t.tsize * 0.48}em`, marginTop: "1.4em", marginBottom: 0, opacity: 0.85, fontWeight: 500, lineHeight: 1.3 }}>{sub}</p>}
      </div>
      {devices}
    </div>
  );
}

// Feature Graphic Google Play: icon + tên + câu giới thiệu + máy 3D (viền mảnh)
export function FeatureCanvas({ p, width }: { p: Project; width: number }) {
  const f = p.feature, t = p.theme;
  const hEm = (100 * FEATURE_SIZE.h) / FEATURE_SIZE.w;
  const ink = t.ink === "light" ? "#fff" : "#15151A";
  const Icon = FEATURE_ICONS[f.icon] ?? FEATURE_ICONS.sprout;
  const dw = f.scale, dev = { kind: "phone" as const, store: "play" as const, theme: t, rx: f.rx, ry: f.ry, rz: f.rz };
  return (
    <div style={{ position: "relative", overflow: "hidden", width, height: (width * FEATURE_SIZE.h) / FEATURE_SIZE.w, fontSize: width / 100, ...background(p, 0, hEm, 1) }}>
      <div style={{ position: "absolute", left: "7em", top: "50%", transform: "translateY(-50%)", color: ink, fontFamily: FONTS[t.font], zIndex: 3, width: "48em" }}>
        <div style={{ width: "10em", height: "10em", borderRadius: "2.6em", background: "#fff", display: "grid", placeItems: "center", boxShadow: "0 .8em 2.4em rgba(0,0,0,.16)", color: t.c1 }}>
          <Icon style={{ width: "5.4em", height: "5.4em" }} strokeWidth={2} />
        </div>
        <h2 style={{ fontSize: "7em", margin: ".3em 0 0", fontWeight: 800, letterSpacing: "-.03em", lineHeight: 1 }}>{f.name}</h2>
        <p style={{ fontSize: "3em", margin: ".35em 0 0", opacity: 0.88, fontWeight: 500 }}>{f.tagline}</p>
      </div>
      {f.device && (
        <>
          <Device {...dev} rz={f.rz + 4} w={dw} x={100 - 6 - dw} y={(hEm - dw * ASPECT.phone) / 2 - 1.5} z={1}><Screen p={p} i={1} /></Device>
          <Device {...dev} w={dw} x={100 - 6 - dw * 1.85} y={(hEm - dw * ASPECT.phone) / 2 + 3}><Screen p={p} i={0} /></Device>
        </>
      )}
    </div>
  );
}
