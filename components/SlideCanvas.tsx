// Vẽ 1 screenshot (SlideCanvas) hoặc Feature Graphic 1024×500 (FeatureCanvas) ở bề ngang W px bất kỳ
// Quy ước: font-size gốc = W/100 px → 1em = 1% bề ngang, nên thumbnail, canvas và file xuất giống hệt nhau
// Style slide = themeOf(p, s) (Project style + override riêng slide). Root canvas mang data-cv để đo vị trí khi kéo
// Layer: "title" (Headline) · "sub" (Subtitle) · "x:<id>" (chữ tự do, slide.extras) · "device" — mỗi layer có data-pick riêng
// Có prop `edit` → sửa trực tiếp: kéo để dời, 4 góc đổi cỡ máy, nút tròn xoay, gióng theo lề/tâm/các layer khác + thước đo (px ảnh xuất)
// Máy: double-click (khi có ảnh) = chế độ CĂN ẢNH — kéo để dời ảnh trong màn (ix,iy), Esc/bấm ra ngoài để thoát
// Duo: máy 2 là layer "device2" (ảnh riêng img2 hoặc liên kết ảnh slide kế tiếp), dời bx/by, nghiêng thêm brz
// Chữ: double-click để gõ. Đang gõ mà bôi đen → thanh nổi "Highlight" (hoặc Ctrl/⌘+Shift+H) tô/bỏ tô màu đoạn đó;
// lưu lại dạng "*từ*" trong chuỗi (richParts tách ra khi vẽ). Layer ẩn vẫn giữ chỗ (visibility) để bố cục không nhảy
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties, ReactNode, PointerEvent as RPE, KeyboardEvent as RKE, FocusEvent as RFE } from "react";
import { Highlighter } from "lucide-react";
import { FEATURE_ICONS } from "./icons";
import type { Project, SizePreset, Theme, TextItem, Deco } from "@/lib/types";
import { decoDef, decoColor } from "@/lib/decos";
import { FONTS, FEATURE_SIZE } from "@/lib/presets";
import { textOf, themeOf, richParts, imgFor } from "@/lib/rules";
import { centerPatch, decoOf, patchDeco, posOf, withPos, posPatch, patchExtra, extraText, isDevice, isLayer, featText, setFeatText, phoneOf, phoneIdx, setPhone, PHONE_IDS, type LayerId } from "@/lib/layers";
import { imgSrc, imgMeta } from "@/lib/images";
import type { Slide } from "@/lib/types";
import { mockScreen } from "@/lib/mocks";
import { Device, ASPECT } from "./Device";

// Nền slide; panorama = một nền dài n slide, slide i lấy khúc thứ i → lướt store thấy liền mạch
function background(t: Theme, i: number, hEm: number, n: number): CSSProperties {
  if (t.bg === "color") return { background: t.solid };
  if (t.bg === "gradient") return { background: `linear-gradient(165deg,${t.c1},${t.c2})` };
  if (t.bg === "blur") return { background: t.c1 }; // nền lót; lớp ảnh mờ vẽ trong BlurBackdrop
  return {
    backgroundImage: `radial-gradient(circle at 18% 22%,${t.c2} 0,transparent 22%),radial-gradient(circle at 52% 80%,${t.c2}cc 0,transparent 26%),radial-gradient(circle at 84% 30%,#ffffff55 0,transparent 18%),linear-gradient(100deg,${t.c1},${t.c2} 50%,${t.c1})`,
    backgroundSize: `${100 * n}em ${hEm}em`,
    backgroundPosition: `${-i * 100}em 0`,
  };
}

// --- Kiểu chọn ---
// null = không chọn · "slide" = cả slide (bấm nền) · LayerId = một layer
export type CanvasPick = "slide" | LayerId | null;
export type LayerPick = LayerId;
export interface CanvasEdit {
  sel: CanvasPick;
  hover?: LayerId | null; // rê chuột trên cây Layers → viền layer tương ứng
  onSel: (v: CanvasPick) => void;
  onPatch: (patch: Record<string, unknown>, tag: string) => void; // patch vào slide đang chọn hoặc feature
  crop?: LayerId | null; // layer máy đang ở chế độ căn ảnh
  onCrop?: (l: LayerId | null) => void;
  multi?: LayerId[]; // nhóm đang chọn (≥2 layer); rỗng = chọn đơn
  onMulti?: (ls: LayerId[]) => void; // đặt lại nhóm chọn (0 = về Slide, 1 = chọn đơn)
}
// Tay cầm của một layer máy: đổi cỡ (scale) và xoay (rot, ghi vào khoá key)
type Tf = { scale?: { v: number; min: number; max: number; mul: number; set?: (v: number) => Record<string, unknown> }; rot?: { v: number; set: (a: number) => Record<string, unknown> } };
// Căn ảnh của một layer máy: v = [ix, iy, khoảng dư x, khoảng dư y]; set(ix, iy) = patch ghi lại
type CropInfo = { v: [number, number, number, number]; set: (ix: number, iy: number) => Record<string, unknown> };
type Rect = { l: number; t: number; r: number; b: number };
// Lớp phủ khi sửa (em): đường gióng x/y, thước đo khoảng cách m, nhãn số tip
// box = khung kéo vùng chọn (marquee), pre = layer sẽ được chọn khi thả chuột
type Guides = { box?: Rect; pre?: LayerId[]; x?: number; y?: number; m?: { x1: number; y1: number; x2: number; y2: number; label: string }; tip?: { x: number; y: number; text: string } };

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

const unionRect = (rs: Rect[]): Rect => ({ l: Math.min(...rs.map((r) => r.l)), t: Math.min(...rs.map((r) => r.t)), r: Math.max(...rs.map((r) => r.r)), b: Math.max(...rs.map((r) => r.b)) });

// Điểm hút gần nhất: cạnh/tâm phần tử (es) so với các đích (ts)
function bestSnap(es: number[], ts: number[]): { d: number; at: number } | null {
  let best: { d: number; at: number } | null = null;
  for (const e of es) for (const t of ts) if (Math.abs(t - e) < SNAP && (!best || Math.abs(t - e) < Math.abs(best.d))) best = { d: t - e, at: t };
  return best;
}

// Thước đo khoảng trống giữa 2 khung
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

// --- Chữ có đoạn tô màu: chuỗi "*từ*" ⇄ HTML <span data-hl> ⇄ mảng ký tự + cờ tô ---
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const runsHtml = (chars: string[], flags: boolean[], hl: string) => {
  let out = "", i = 0;
  while (i < chars.length) {
    let j = i; while (j < chars.length && flags[j] === flags[i]) j++;
    const s = esc(chars.slice(i, j).join(""));
    out += flags[i] ? `<span data-hl style="color:${hl}">${s}</span>` : s;
    i = j;
  }
  return out;
};
const toHtml = (str: string, hl: string) => runsHtml(...(() => {
  const c: string[] = [], f: boolean[] = [];
  for (const [x, h] of richParts(str)) for (const ch of x) { c.push(ch); f.push(h); }
  return [c, f] as const;
})(), hl);
// Đọc DOM đang sửa → ký tự + cờ (ký tự nằm trong [data-hl] = được tô); bỏ <br> và dấu * gõ tay
function readSegs(el: HTMLElement) {
  const chars: string[] = [], flags: boolean[] = [];
  const walk = (n: Node, on: boolean) => {
    if (n.nodeType === 3) { for (const ch of n.textContent ?? "") if (ch !== "*" && ch !== "\n") { chars.push(ch); flags.push(on); } return; }
    if (n.nodeType !== 1 || (n as Element).tagName === "BR") return;
    const hl = on || (n as Element).hasAttribute("data-hl");
    n.childNodes.forEach((c) => walk(c, hl));
  };
  el.childNodes.forEach((c) => walk(c, false));
  return { chars, flags };
}
const serialize = ({ chars, flags }: { chars: string[]; flags: boolean[] }) => {
  let out = "", i = 0;
  while (i < chars.length) {
    let j = i; while (j < chars.length && flags[j] === flags[i]) j++;
    const s = chars.slice(i, j).join("");
    if (flags[i] && s.trim()) { const a = s.length - s.trimStart().length, b = s.trimEnd().length; out += s.slice(0, a) + "*" + s.slice(a, b) + "*" + s.slice(b); }
    else out += s;
    i = j;
  }
  return out.replace(/\s+/g, " ").trim();
};
// Vị trí ký tự (không tính dấu *) của một điểm trong DOM
function charOffset(el: HTMLElement, node: Node, off: number) {
  const r = document.createRange(); r.selectNodeContents(el); r.setEnd(node, off);
  return r.toString().replace(/[*\n]/g, "").length;
}
function setSelection(el: HTMLElement, a: number, b: number) {
  const pts: [Node, number][] = [];
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let n: Node | null, acc = 0;
  const find = (pos: number): [Node, number] => {
    for (const [node, start] of pts) if (pos <= start + (node.textContent?.length ?? 0)) return [node, pos - start];
    const last = pts[pts.length - 1]; return last ? [last[0], last[0].textContent?.length ?? 0] : [el, 0];
  };
  while ((n = tw.nextNode())) { pts.push([n, acc]); acc += n.textContent?.length ?? 0; }
  const [sn, so] = find(a), [en, eo] = find(b);
  const r = document.createRange(); r.setStart(sn, so); r.setEnd(en, eo);
  const sl = getSelection(); sl?.removeAllRanges(); sl?.addRange(r);
}
// Tô / bỏ tô đoạn đang bôi đen (cả đoạn đã tô thì bỏ, ngược lại thì tô); bỏ khoảng trắng 2 đầu
function toggleHL(el: HTMLElement, hl: string) {
  const sl = getSelection();
  if (!sl || sl.isCollapsed || !el.contains(sl.anchorNode)) return;
  const r = sl.getRangeAt(0);
  let a = charOffset(el, r.startContainer, r.startOffset), b = charOffset(el, r.endContainer, r.endOffset);
  const segs = readSegs(el);
  while (a < b && segs.chars[a] === " ") a++;
  while (b > a && segs.chars[b - 1] === " ") b--;
  if (a >= b) return;
  const all = segs.flags.slice(a, b).every(Boolean);
  for (let i = a; i < b; i++) segs.flags[i] = !all;
  el.innerHTML = runsHtml(segs.chars, segs.flags, hl);
  setSelection(el, a, b);
}

// --- Bộ công cụ sửa trên canvas ---
// pos(l) = vị trí hiện tại của layer; move(l, x, y) = ghi vị trí mới. Chữ tự do (x:…) lưu toạ độ tâm nên không hút về 0
// tf(l) = tay cầm đổi cỡ/xoay của layer máy; crop(l) = [ix, iy] hiện tại nếu layer đó căn ảnh được (null = không)
function useEditKit(edit: CanvasEdit | undefined, k: number, hEm: number, pos: (l: LayerId) => [number, number], move: (l: LayerId, x: number, y: number) => void,
  tf: (l: LayerId) => Tf | null, pxPerEm: number, crop: (l: LayerId) => CropInfo | null = () => null,
  moveMany: (items: [LayerId, number, number][]) => void = () => {}) {
  const [g, setG] = useState<Guides>({});
  const [editing, setEditing] = useState<string | null>(null); // id dòng chữ đang gõ
  const [bar, setBar] = useState<{ x: number; y: number } | null>(null); // thanh nổi Highlight (toạ độ màn hình)
  const edEl = useRef<HTMLElement | null>(null), hlRef = useRef("#FDE68A");

  // Đang gõ: theo dõi vùng bôi đen để hiện thanh Highlight phía trên
  useEffect(() => {
    if (!editing) { setBar(null); return; }
    const on = () => {
      const sl = getSelection(), el = edEl.current;
      if (!sl || sl.isCollapsed || !el || !el.contains(sl.anchorNode)) return setBar(null);
      const r = sl.getRangeAt(0).getBoundingClientRect();
      setBar({ x: r.left + r.width / 2, y: r.top });
    };
    document.addEventListener("selectionchange", on);
    return () => document.removeEventListener("selectionchange", on);
  }, [editing]);

  const rich = (val: string, hl: string): ReactNode => richParts(val).map(([x, h], i) => (h ? <span key={i} style={{ color: hl }}>{x}</span> : x));
  // Một dòng chữ: thường thì vẽ bằng React; đang gõ thì giao DOM cho contentEditable (dangerouslySetInnerHTML, key "e" để dựng lại)
  const lineOf = (id: string, val: string, hl: string, commit: (v: string) => void) => {
    if (!edit) return { key: "r", props: {}, children: rich(val, hl) as ReactNode };
    if (editing !== id) return {
      key: "r", children: rich(val, hl) as ReactNode,
      props: { "data-line": id, onDoubleClick: () => { hlRef.current = hl; setEditing(id); } },
    };
    return {
      key: "e", children: undefined as ReactNode,
      props: {
        "data-line": id, contentEditable: true, suppressContentEditableWarning: true,
        dangerouslySetInnerHTML: { __html: toHtml(val, hl) },
        ref: (el: HTMLElement | null) => {
          edEl.current = el;
          if (el && !el.dataset.f) { el.dataset.f = "1"; el.focus(); setSelection(el, 0, readSegs(el).chars.length); }
        },
        onKeyDown: (e: RKE<HTMLElement>) => {
          e.stopPropagation();
          if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
          if (e.key === "Escape") e.currentTarget.blur();
          if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "h") { e.preventDefault(); toggleHL(e.currentTarget, hl); }
        },
        onBlur: (e: RFE<HTMLElement>) => { const v = serialize(readSegs(e.currentTarget)); edEl.current = null; setEditing(null); if (v !== val) commit(v); },
      },
    };
  };
  const toolbar = bar && editing && typeof document !== "undefined" ? createPortal(
    <div className="ed-bar" style={{ left: bar.x, top: bar.y }} onMouseDown={(e) => e.preventDefault()}>
      <button title="Highlight (Ctrl+Shift+H)" onClick={() => edEl.current && toggleHL(edEl.current, hlRef.current)}><Highlighter />Highlight</button>
    </div>, document.body) : null;

  if (!edit) return { hit: () => undefined, handle: undefined, guides: null, lineOf, root: undefined, grab: undefined };

  const many = edit.multi && edit.multi.length > 1 ? edit.multi : null; // đang chọn nhiều layer
  // Kéo cả nhóm: cùng một độ dời cho mọi layer đang chọn, gióng theo khung bao của nhóm.
  // Bấm rồi thả không kéo = chỉ chọn riêng layer đó (giống Figma)
  const dragMany = (e: RPE, what: LayerId, root: HTMLElement, R: DOMRect, ls: LayerId[]) => {
    const els = ls.map((l) => root.querySelector<HTMLElement>(`[data-pick="${l}"]`)).filter((x): x is HTMLElement => !!x);
    if (!els.length) return;
    const u = unionRect(els.map((x) => rectEm(x, R, k))), cc = [(u.l + u.r) / 2, (u.t + u.b) / 2];
    const others = [...root.querySelectorAll("[data-pick]")].filter((x) => !els.some((el) => el === x || el.contains(x) || x.contains(el)) && getComputedStyle(x).visibility !== "hidden").map((x) => rectEm(x, R, k));
    const tx = [8, 50, 92, ...others.flatMap((o) => [o.l, (o.l + o.r) / 2, o.r])];
    const ty = [hEm / 2, ...others.flatMap((o) => [o.t, (o.t + o.b) / 2, o.b])];
    const base = ls.map((l) => [l, ...pos(l)] as const);
    let moved = false;
    startDrag(e, k, (mx, my) => {
      if (!moved && Math.hypot(mx, my) * k < 3) return;
      moved = true;
      const ng: Guides = {};
      const sx = bestSnap([u.l + mx, cc[0] + mx, u.r + mx], tx), sy = bestSnap([u.t + my, cc[1] + my, u.b + my], ty);
      let dx = mx, dy = my;
      if (sx) { dx += sx.d; ng.x = sx.at; }
      if (sy) { dy += sy.d; ng.y = sy.at; }
      setG(ng);
      moveMany(base.map(([l, x, y]) => [l, r1(x + dx), r1(y + dy)]));
    }, () => { setG({}); if (!moved) edit.onMulti?.([what]); });
  };
  const drag = (e: RPE, what: LayerId) => {
    if (e.button !== 0 || (e.target as HTMLElement).isContentEditable) return;
    e.stopPropagation();
    // Shift / ⌘ / Ctrl + bấm = thêm/bớt layer khỏi nhóm chọn (không kéo)
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      e.preventDefault();
      const cur = many ?? (isLayer(edit.sel) ? [edit.sel] : []);
      edit.onMulti?.(cur.includes(what) ? cur.filter((x) => x !== what) : [...cur, what]);
      return;
    }
    // Phần tử thật của layer (khi bấm vào khung ma ngoài slide thì currentTarget là khung ma)
    const root = (e.currentTarget as HTMLElement).closest("[data-cv]") as HTMLElement, R = root.getBoundingClientRect();
    if (many?.includes(what)) return dragMany(e, what, root, R, many);
    edit.onSel(what);
    const el = (root.querySelector(`[data-pick="${what}"]`) as HTMLElement | null) ?? (e.currentTarget as HTMLElement);
    // Đang căn ảnh: kéo = dời ảnh trong màn, 1:1 theo cỡ màn (ix/iy = % bề ngang/cao màn), giới hạn ±100%
    const c0 = edit.crop === what ? crop(what) : null;
    if (c0) {
      // c0 = [ix, iy, khoảng dời x, khoảng dời y]; trục không còn phần dư (khoảng = 0) thì đứng yên
      const scr = el.querySelector(".scr")!.getBoundingClientRect(), [ix0, iy0, rx, ry] = c0.v;
      const step = (px: number, size: number, range: number) => (range ? ((px / size) * 100 / range) * 100 : 0);
      startDrag(e, k, (mx, my) => edit.onPatch(c0.set(r1(clamp(ix0 + step(mx * k, scr.width, rx), -100, 100)), r1(clamp(iy0 + step(my * k, scr.height, ry), -100, 100))), "pan"));
      return;
    }
    const r0 = rectEm(el, R, k), cc = [(r0.l + r0.r) / 2, (r0.t + r0.b) / 2];
    const others = [...root.querySelectorAll("[data-pick]")].filter((x) => x !== el && !el.contains(x) && getComputedStyle(x).visibility !== "hidden").map((x) => rectEm(x, R, k));
    // Layer gần nhất để đo khoảng cách
    const near = others.sort((a, b) => Math.hypot((a.l + a.r) / 2 - cc[0], (a.t + a.b) / 2 - cc[1]) - Math.hypot((b.l + b.r) / 2 - cc[0], (b.t + b.b) / 2 - cc[1]))[0];
    const tx = [8, 50, 92, ...others.flatMap((o) => [o.l, (o.l + o.r) / 2, o.r])];
    const ty = [hEm / 2, ...others.flatMap((o) => [o.t, (o.t + o.b) / 2, o.b])];
    const [bx, by] = pos(what), free = what.startsWith("x:") || what.startsWith("d:");
    startDrag(e, k, (mx, my) => {
      const ng: Guides = {};
      const sx = bestSnap([r0.l + mx, cc[0] + mx, r0.r + mx], tx);
      const sy = bestSnap([r0.t + my, cc[1] + my, r0.b + my], ty);
      let x = bx + mx, y = by + my;
      if (sx) { x += sx.d; ng.x = sx.at; } else if (!free && Math.abs(x) < SNAP) x = 0;
      if (sy) { y += sy.d; ng.y = sy.at; } else if (!free && Math.abs(y) < SNAP) y = 0;
      if (near) ng.m = measure({ l: r0.l + x - bx, r: r0.r + x - bx, t: r0.t + y - by, b: r0.b + y - by }, near, pxPerEm);
      setG(ng);
      move(what, r1(x), r1(y));
    }, () => setG({}));
  };
  const hit = (what: LayerId) => ({
    "data-pick": what,
    className: `ed-hit ${isDevice(what) ? "device" : "text"} ${edit.sel === what && !many ? "sel" : ""} ${many?.includes(what) ? "msel" : ""} ${g.pre?.includes(what) ? "pre" : ""} ${edit.hover === what ? "hov" : ""} ${edit.crop === what ? "cropping" : ""}`,
    onPointerDown: (e: RPE) => drag(e, what),
    onDragStart: (e: { preventDefault: () => void }) => e.preventDefault(),
    // Double-click máy có ảnh → vào/ra chế độ căn ảnh
    onDoubleClick: isDevice(what) ? () => { if (crop(what)) edit.onCrop?.(edit.crop === what ? null : what); } : undefined,
  });

  // Vị trí con trỏ (em) trong canvas — để đặt nhãn số cạnh chuột
  const ptr = (e: RPE) => { const R = (e.currentTarget as HTMLElement).closest("[data-cv]")!.getBoundingClientRect(); return [(e.clientX - R.left) / k, (e.clientY - R.top) / k]; };

  // 4 nút góc đổi cỡ máy (góc trái đảo dấu) + nút tròn xoay (hút 0°/±15°); ẩn khi đang căn ảnh
  const cur = !many && isLayer(edit.sel) && (isDevice(edit.sel) || edit.sel.startsWith("d:")) && edit.crop !== edit.sel ? tf(edit.sel) : null;
  const scale = cur?.scale, rot = cur?.rot;
  const handle = cur ? (
    <>
      {scale && (["nw", "ne", "sw", "se"] as const).map((c) => (
        <span key={c} className={`ed-handle ${c}`} onPointerDown={(e) => {
          e.stopPropagation();
          const sign = c.includes("e") ? 1 : -1, [px, py] = ptr(e);
          startDrag(e, k, (mx, my) => {
            // Trang trí: dùng delta theo trục cục bộ của hình đã xoay, giữ tâm và tỉ lệ.
            const a = (cur.rot?.v ?? 0) * Math.PI / 180;
            const delta = scale.set ? (mx * Math.cos(a) + my * Math.sin(a)) * 2 : mx;
            const v = Math.round(clamp(scale.v + delta * sign * scale.mul, scale.min, scale.max));
            setG({ tip: { x: px + mx, y: py + my, text: `${v}%` } });
            edit.onPatch(scale.set ? scale.set(v) : { scale: v }, "drag-scale");
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
            a = Math.round(clamp(a, scale?.set ? -180 : -45, scale?.set ? 180 : 45));
            setG({ tip: { x: px + mx, y: py + my, text: `${a}°` } });
            edit.onPatch(rot.set(a), "drag-rot");
          }, () => setG({}));
        }} />
      )}
    </>
  ) : undefined;

  const m = g.m;
  const guides = (
    <>
      {g.box && <div className="ed-marquee" style={{ left: `${g.box.l}em`, top: `${g.box.t}em`, width: `${g.box.r - g.box.l}em`, height: `${g.box.b - g.box.t}em` }} />}
      {g.x !== undefined && <div className="ed-guide v" style={{ left: `${g.x}em` }} />}
      {g.y !== undefined && <div className="ed-guide h" style={{ top: `${g.y}em` }} />}
      {m && (
        <div className={`ed-measure ${m.x1 === m.x2 ? "v" : "h"}`} style={{ left: `${Math.min(m.x1, m.x2)}em`, top: `${Math.min(m.y1, m.y2)}em`, width: `${Math.abs(m.x2 - m.x1)}em`, height: `${Math.abs(m.y2 - m.y1)}em` }}>
          <span>{m.label}</span>
        </div>
      )}
      {g.tip && <div className="ed-tip" style={{ left: `${g.tip.x}em`, top: `${g.tip.y}em` }}>{g.tip.text}</div>}
      {toolbar}
      {edit.crop && <div className="ed-croptip">Drag to reposition · Esc to finish</div>}
    </>
  );
  // Bấm nền slide (chỗ không có layer) → chọn cấp Slide; kéo trên nền = khung chọn vùng (marquee) chọn mọi layer chạm khung
  // Giữ Shift/⌘/Ctrl khi kéo = cộng thêm vào nhóm đang chọn. Layer đang ẩn không bị chọn
  const root = { onPointerDown: (e: RPE) => {
    if (e.button !== 0) return; e.stopPropagation();
    const add = e.shiftKey || e.metaKey || e.ctrlKey;
    const base = add ? (many ?? (isLayer(edit.sel) ? [edit.sel] : [])) : [];
    if (!add) edit.onSel("slide");
    const cvEl = e.currentTarget as HTMLElement, R = cvEl.getBoundingClientRect(), [px, py] = ptr(e);
    const items = [...cvEl.querySelectorAll<HTMLElement>("[data-pick]")].filter((x) => getComputedStyle(x).visibility !== "hidden").map((x) => [x.dataset.pick as LayerId, rectEm(x, R, k)] as const);
    let ids: LayerId[] = [], moved = false;
    startDrag(e, k, (mx, my) => {
      if (!moved && Math.hypot(mx, my) * k < 4) return;
      moved = true;
      const b: Rect = { l: Math.min(px, px + mx), r: Math.max(px, px + mx), t: Math.min(py, py + my), b: Math.max(py, py + my) };
      ids = items.filter(([, r]) => r.l < b.r && r.r > b.l && r.t < b.b && r.b > b.t).map(([id]) => id);
      setG({ box: b, pre: ids });
    }, () => { setG({}); if (!moved) return; const set = [...base, ...ids.filter((i) => !base.includes(i))]; if (set.length) edit.onMulti?.(set); });
  } };
  return { hit, handle, guides, lineOf, root, grab: drag };
}

// Cỡ ảnh so với màn (rx = rộng ảnh / rộng màn, ry = cao ảnh / cao màn) sau Fill (phủ kín) hoặc Fit (hiện trọn), chưa tính zoom
// sr = tỉ lệ rộng/cao của màn; ar = tỉ lệ rộng/cao của ảnh
function contentSize(img: string | null | undefined, fit: boolean, sr: number): [number, number] | null {
  const m = imgMeta(img); if (!m) return null;
  const ar = m.w / m.h;
  return fit ? [Math.min(1, ar / sr), Math.min(1, sr / ar)] : [Math.max(1, ar / sr), Math.max(1, sr / ar)];
}
// Khoảng dời tối đa (% cỡ màn) mỗi trục = phần ảnh còn dư ra ngoài màn (sau zoom). ix/iy lưu dạng -100..100 = % khoảng này
export function panRange(img: string | null | undefined, c: Pick<Slide, "fit" | "iz"> | undefined, sr: number): [number, number] {
  const cs = contentSize(img, c?.fit === "fit", sr); if (!cs) return [0, 0];
  const iz = c?.iz ?? 1;
  return [Math.max(0, (cs[0] * iz - 1) * 50), Math.max(0, (cs[1] * iz - 1) * 50)];
}

// Màn hình trong máy: ảnh đặt theo cỡ thật (không dùng object-fit, vì object-fit cắt ảnh trong khung thẻ img → dời sẽ lộ nền)
// thumb = bản thu nhỏ; chưa có kích thước ảnh (meta) thì vẽ tạm kiểu cover
function Shot({ img, mock, c, thumb, sr }: { img?: string | null; mock: number; c?: Pick<Slide, "fit" | "ix" | "iy" | "iz">; thumb?: boolean; sr: number }) {
  if (!img) return <div dangerouslySetInnerHTML={{ __html: mockScreen(mock) }} />;
  const iz = c?.iz ?? 1, fit = c?.fit === "fit", cs = contentSize(img, fit, sr), [mx, my] = panRange(img, c, sr);
  const tx = ((c?.ix ?? 0) / 100) * mx, ty = ((c?.iy ?? 0) / 100) * my;
  const st: CSSProperties = cs
    ? { position: "absolute", maxWidth: "none", width: `${cs[0] * iz * 100}%`, height: `${cs[1] * iz * 100}%`, left: `${50 + tx}%`, top: `${50 + ty}%`, transform: "translate(-50%,-50%)" }
    : { width: "100%", height: "100%", objectFit: "cover" };
  return (
    <div style={{ position: "absolute", inset: 0, background: fit ? "#000" : undefined, overflow: "hidden" }}>
      <img src={imgSrc(img, thumb)} alt="" draggable={false} style={{ display: "block", ...st }} />
    </div>
  );
}
// Chữ tự do / badge (slide và feature dùng chung): đặt theo tâm (x,y); badge nền = màu tô, chữ đậm tối
type Kit = ReturnType<typeof useEditKit>;
function renderExtras(items: TextItem[] | undefined, L: string, t: Theme, ink: string, z: number, kit: Kit, commit: (x: TextItem, v: string) => void) {
  return (items ?? []).map((x) => {
    const id = `x:${x.id}` as LayerId, X = kit.lineOf(id, extraText(x, L), x.pill ? t.c1 : t.hl, (v) => commit(x, v));
    return (
      <div key={x.id} {...kit.hit(id)} style={{ position: "absolute", left: `${x.x}em`, top: `${x.y}em`, transform: "translate(-50%,-50%)", zIndex: z, maxWidth: "88em", textAlign: "center", fontFamily: FONTS[t.font], whiteSpace: "nowrap", ...(x.hidden ? { visibility: "hidden" as const } : {}) }}>
        <div key={X.key} {...X.props} style={{ fontSize: `${x.size}em`, fontWeight: x.weight, lineHeight: 1.2, color: x.pill ? "#15151A" : x.color || ink, ...(x.pill ? { background: t.hl, padding: ".35em .9em", borderRadius: "999px", display: "inline-block" } : {}) }}>{X.children}</div>
      </div>
    );
  });
}

// Hình trang trí: tâm (x,y) em, rộng size em, xoay rot; nằm dưới máy (z 1) hoặc trên cùng (z 5) khi front
function renderDecos(items: Deco[] | undefined, front: boolean, t: Theme, kit: Kit) {
  return (items ?? []).filter((d) => !!d.front === front).map((d) => {
    const def = decoDef(d.kind), c = d.color || decoColor(def.def, t), c2 = d.color2 || decoColor(def.def2 ?? "white", t);
    return (
      <div key={d.id} {...kit.hit(`d:${d.id}` as LayerId)} style={{ position: "absolute", left: `${d.x}em`, top: `${d.y}em`, width: `${d.size}em`, height: `${d.size * def.ar}em`,
        transform: `translate(-50%,-50%) rotate(${d.rot ?? 0}deg)`, zIndex: front ? 7 : 1, opacity: d.opacity ?? 1, ...(d.hidden ? { visibility: "hidden" as const } : {}) }}>
        <div style={{ width: "100%", height: "100%", pointerEvents: "none" }} dangerouslySetInnerHTML={{ __html: def.svg(c, c2) }} />
        {kit.hit(`d:${d.id}` as LayerId)?.className.includes(" sel") && kit.handle}
      </div>
    );
  });
}

// Nền Blur: chính màn hình của slide phóng to + làm mờ + tăng bão hoà (khác hẳn gradient), rồi phủ lớp tối và ánh màu c1→c2
// Chưa có ảnh thì dùng màn mẫu; t.blur = độ mờ, t.overlay = độ tối (%)
function BlurBackdrop({ t, img, mock, thumb }: { t: Theme; img: string | null | undefined; mock: number; thumb?: boolean }) {
  const fx: CSSProperties = { position: "absolute", filter: `blur(${Math.max(1, t.blur) * 0.22}em) saturate(1.6)`, transform: "scale(1.15)" };
  return (
    <>
      {img
        ? <div style={{ ...fx, inset: "-12%", backgroundImage: `url(${imgSrc(img, thumb)})`, backgroundSize: "cover", backgroundPosition: "center" }} />
        : // fontSize 1.4em → đơn vị bên trong = 1/100 bề ngang khối 140% slide, đúng quy ước của .mk
          <div style={{ ...fx, fontSize: "1.4em", left: "-14.3em", top: "-10%", width: "100em", height: "120%", overflow: "hidden", background: "#fff" }}>
            <div style={{ position: "absolute", inset: 0 }} dangerouslySetInnerHTML={{ __html: mockScreen(mock) }} />
          </div>}
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(165deg,${t.c1}66,${t.c2}55)`, mixBlendMode: "multiply" }} />
      <div style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${t.overlay / 100})` }} />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 60% at 50% 0%,rgba(255,255,255,.18),transparent 60%)" }} />
    </>
  );
}

// --- Khung canvas khi sửa ---
// Không sửa (xuất ảnh, thumbnail): 1 lớp overflow hidden như cũ.
// Đang sửa: khung ngoài overflow visible (nền vẫn chỉ vẽ trong khung), nội dung nằm trong lớp .cv-clip cắt viền;
// layer đang chọn có phần lọt ra ngoài → vẽ "khung ma" (viền + nền nhạt) đúng kích thước thật, nằm DƯỚI lớp cắt nên chỉ hiện/bắt chuột ở phần ngoài khung → kéo lại được
// Lọt >65% ra ngoài → thêm nút "Bring to center" dưới đáy slide
type Ghost = { l: number; t: number; w: number; h: number; inside: number } | null;
function useGhost(cv: React.RefObject<HTMLDivElement | null>, sel: CanvasPick | undefined) {
  const [g, setG] = useState<Ghost>(null);
  const key = useRef("");
  useLayoutEffect(() => {
    let next: Ghost = null;
    const root = cv.current;
    if (root && sel && sel !== "slide") {
      const el = root.querySelector<HTMLElement>(`[data-pick="${sel}"]`);
      if (el) {
        const a = el.getBoundingClientRect(), b = root.getBoundingClientRect();
        const iw = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)), ih = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        const area = a.width * a.height, inside = area ? (iw * ih) / area : 1;
        if (inside < 0.999) next = { l: a.left - b.left, t: a.top - b.top, w: a.width, h: a.height, inside };
      }
    }
    const k = next ? [next.l, next.t, next.w, next.h, next.inside].map((v) => v.toFixed(1)).join() : "";
    if (k !== key.current) { key.current = k; setG(next); }
  });
  return g;
}
// Khung bao nhóm đang chọn (px so với canvas) + nhãn số layer; đo lại sau mỗi lần vẽ, chỉ setState khi đổi
type Box = { l: number; t: number; w: number; h: number } | null;
function useMultiBox(cv: React.RefObject<HTMLDivElement | null>, ls: LayerId[] | undefined) {
  const [b, setB] = useState<Box>(null);
  const key = useRef("");
  useLayoutEffect(() => {
    let next: Box = null;
    const root = cv.current;
    if (root && ls && ls.length > 1) {
      const R = root.getBoundingClientRect();
      const rs = ls.map((l) => root.querySelector<HTMLElement>(`[data-pick="${l}"]`)?.getBoundingClientRect()).filter((r): r is DOMRect => !!r);
      if (rs.length) {
        const l = Math.min(...rs.map((r) => r.left)), t = Math.min(...rs.map((r) => r.top));
        next = { l: l - R.left, t: t - R.top, w: Math.max(...rs.map((r) => r.right)) - l, h: Math.max(...rs.map((r) => r.bottom)) - t };
      }
    }
    const k = next ? [next.l, next.t, next.w, next.h].map((v) => v.toFixed(1)).join() : "";
    if (k !== key.current) { key.current = k; setB(next); }
  });
  return b;
}
function CanvasFrame({ cvRef, edit, kit, style, ghost, mbox, onCenter, children }: {
  cvRef?: React.Ref<HTMLDivElement>; edit?: CanvasEdit; kit: Kit; style: CSSProperties; ghost: Ghost; mbox?: Box; onCenter: () => void; children: ReactNode;
}) {
  if (!edit) return <div data-cv ref={cvRef} style={{ position: "relative", overflow: "hidden", ...style }}>{children}</div>;
  const sel = edit.sel as LayerId;
  return (
    <div data-cv ref={cvRef} {...kit.root} style={{ position: "relative", overflow: "visible", ...style }}>
      {ghost && (
        <div className="ed-ghost" title="Drag to move back into the frame" style={{ left: ghost.l, top: ghost.t, width: ghost.w, height: ghost.h }}
          onPointerDown={(e) => kit.grab?.(e, sel)} />
      )}
      <div className="cv-clip">{children}</div>
      {mbox && <div className="ed-multibox" style={{ left: mbox.l, top: mbox.t, width: mbox.w, height: mbox.h }}><span>{edit.multi?.length} layers</span></div>}
      {kit.guides}
      {ghost && ghost.inside < 0.35 && (
        <button className="ed-bringback" onPointerDown={(e) => e.stopPropagation()} onClick={onCenter}>
          Layer is outside the frame · <b>Bring to center</b>
        </button>
      )}
    </div>
  );
}

// Tỉ lệ rộng/cao của màn trong máy (trừ viền) theo loại máy + theme
export const screenRatio = (kind: "phone" | "tablet", t: Theme) => { const bz = t.frame === "none" ? 0 : t.bezel / 100; return (1 - 2 * bz) / (ASPECT[kind] - 2 * bz); };
// Ảnh của slide i theo ngôn ngữ loc (máy chính, kèm cách căn của slide đó)
const screenOf = (p: Project, i: number, sr: number, thumb: boolean | undefined, loc: string) => { const s = p.slides[i]; return s ? <Shot img={imgFor(s, loc)} mock={s.mock} c={s} thumb={thumb} sr={sr} /> : null; };

export function SlideCanvas({ p, index, width, size, loc, edit }: { p: Project; index: number; width: number; size: SizePreset; loc?: string; edit?: CanvasEdit }) {
  const s = p.slides[index], t = themeOf(p, s), n = p.slides.length;
  const L = loc ?? p.loc, k = width / 100;
  const cv = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState(0); // số dòng tiêu đề (chỉ đo khi đang sửa)

  const hEm = (100 * size.h) / size.w;
  const centered = s && (s.layout === "center" || s.layout === "bleed" || s.layout === "bottom");
  const duo = s?.layout === "duo";
  const kit = useEditKit(edit, k, hEm,
    (l) => (s ? posOf(s, l) : [0, 0]),
    (l, x, y) => s && edit?.onPatch(withPos(s, l, x, y), "drag-" + l),
    // Đổi cỡ: Duo dùng chung s.scale cho 2 máy (bề ngang máy = scale·0.66); xoay máy 2 ghi vào brz (độ nghiêng thêm)
    (l) => !s ? null : l.startsWith("d:") ? (() => {
      const d = decoOf(s, l); return !d ? null : {
        scale: { v: d.size, min: 4, max: 140, mul: 1, set: (size: number) => patchDeco(s, l, { size }) },
        rot: { v: d.rot ?? 0, set: (rot: number) => patchDeco(s, l, { rot }) },
      };
    })() : l === "device2"
      ? { scale: { v: s.scale, min: 40, max: 100, mul: 1 / 0.66 }, rot: { v: s.brz ?? 6, set: (a: number) => ({ brz: a }) } }
      : { scale: { v: s.scale, min: 40, max: 100, mul: duo ? 1 / 0.66 : centered ? 2 : 1 }, rot: { v: s.rz, set: (a: number) => ({ rz: a }) } },
    size.w / 100,
    // Căn ảnh: máy chính (ảnh theo ngôn ngữ) và máy 2 của Duo khi dùng ảnh riêng (c2)
    (l): CropInfo | null => {
      if (!s) return null;
      const r0 = screenRatio(size.kind, t), im = imgFor(s, L);
      if (l === "device" && im) return { v: [s.ix ?? 0, s.iy ?? 0, ...panRange(im, s, r0)], set: (ix, iy) => ({ ix, iy }) };
      if (l === "device2" && s.img2) { const c = s.c2 ?? {}; return { v: [c.ix ?? 0, c.iy ?? 0, ...panRange(s.img2, c, r0)], set: (ix, iy) => ({ c2: { ...s.c2, ix, iy } }) }; }
      return null;
    },
    (items) => s && edit?.onPatch(posPatch(s, items), "drag-multi"));
  const titleRaw = s ? textOf(s, L)[0] : "";
  useLayoutEffect(() => {
    if (!edit) return;
    const h = cv.current?.querySelector<HTMLElement>('[data-line="title"]');
    setLines(h ? Math.round(h.getBoundingClientRect().height / ((width / 100) * t.tsize * t.tlh)) : 0);
  }, [edit, titleRaw, width, t.tsize, t.tlh, t.font, t.tweight, s?.tw, s?.layout]);
  const multiOn = !!edit?.multi && edit.multi.length > 1;
  const ghost = useGhost(cv, multiOn ? null : edit?.sel), mbox = useMultiBox(cv, edit?.multi);
  if (!s) return null;
  const [title, sub] = textOf(s, L);
  const tab = size.kind === "tablet", asp = ASPECT[size.kind];
  const ink = t.tcolor || (t.ink === "light" ? "#fff" : "#15151A");
  const { hit, handle, lineOf } = kit;
  const th = width < 240; // vẽ nhỏ (cột trái, hộp Export) → dùng ảnh thu nhỏ
  const sr = screenRatio(size.kind, t);
  const hd = (l: LayerId) => (edit?.sel === l ? handle : undefined);

  // --- Tính vị trí khối chữ + máy theo layout (em) ---
  const padT = tab ? 6 : 9;
  const subEm = t.tsize * t.ssize;
  const titleH = title ? t.tsize * 2.35 : 0;
  const subH = sub ? subEm * 1.9 + (title ? subEm * 1.4 : 0) : 0;
  const textH = titleH + subH;
  const below = padT + textH + (textH ? 4 : 0); // máy bắt đầu dưới khối chữ
  const zText = s.front === "device" ? 0 : 3;
  const block: CSSProperties = { position: "absolute", zIndex: zText, textAlign: t.align, color: ink, fontFamily: FONTS[t.font] };
  const dev = { kind: size.kind, store: p.store, theme: t, rx: s.rx, ry: s.ry, rz: s.rz, hit: hit("device") };
  let devices: ReactNode = null;

  if (s.layout === "bottom") {
    block.bottom = `${padT}em`;
    const w = Math.min(s.scale, (hEm - 7 - textH - padT - 5) / asp);
    devices = <Device {...dev} handle={hd("device")} w={w} x={(100 - w) / 2 + (s.dx ?? 0)} y={6 + (s.dy ?? 0)}>{screenOf(p, index, sr, th, L)}</Device>;
  } else {
    block.top = `${padT}em`;
    const dx = s.dx ?? 0, dy = s.dy ?? 0;
    if (s.layout === "center") {
      const w = Math.min(s.scale, (hEm - below - 5) / asp);
      devices = <Device {...dev} handle={hd("device")} w={w} x={(100 - w) / 2 + dx} y={below + dy}>{screenOf(p, index, sr, th, L)}</Device>;
    }
    if (s.layout === "bleed") devices = <Device {...dev} handle={hd("device")} w={s.scale} x={(100 - s.scale) / 2 + dx} y={below + dy}>{screenOf(p, index, sr, th, L)}</Device>;
    if (s.layout === "offset") devices = <Device {...dev} handle={hd("device")} w={s.scale} x={34 + dx} y={below - 2 + dy}>{screenOf(p, index, sr, th, L)}</Device>;
    if (s.layout === "duo") {
      const w = s.scale * 0.66;
      devices = (
        <>
          {!s.hidden?.device2 && (
            <Device {...dev} hit={hit("device2")} handle={hd("device2")} rz={s.rz + (s.brz ?? 6)} w={w} x={100 - 5 - w + (s.bx ?? 0)} y={below + 8 + (s.by ?? 0)} z={1}>
              {s.img2 ? <Shot img={s.img2} mock={0} c={s.c2} thumb={th} sr={sr} /> : screenOf(p, (index + 1) % n, sr, th, L)}
            </Device>
          )}
          {!s.hidden?.device && <Device {...dev} handle={hd("device")} rz={s.rz - 4} w={w} x={5 + dx} y={below + dy}>{screenOf(p, index, sr, th, L)}</Device>}
        </>
      );
    }
  }
  // Bề ngang khối chữ: mặc định 84% (offset: 62%, bám lề trái); tw đè lên
  const offset = s.layout === "offset", tw = s.tw ?? (offset ? 62 : 84);
  if (offset) { block.textAlign = "left"; block.left = "8em"; block.right = `${100 - 8 - tw}em`; }
  else { block.left = `${(100 - tw) / 2}em`; block.right = `${(100 - tw) / 2}em`; }

  // Tay cầm đổi bề ngang (khi Headline hoặc Subtitle đang chọn)
  const widthHandles = edit && !multiOn && (edit.sel === "title" || edit.sel === "sub") ? (["l", "r"] as const).map((side) => (
    <span key={side} className={`ed-wh ${side}`} title="Drag to change text width" onPointerDown={(e) => {
      e.stopPropagation();
      const sign = side === "r" ? 1 : -1, mul = offset ? (side === "r" ? 1 : 0) : 2;
      if (!mul) return;
      startDrag(e, k, (mx) => edit.onPatch({ tw: Math.round(clamp(tw + mx * sign * mul, 30, offset ? 84 : 100)) }, "drag-tw"));
    }} />
  )) : null;
  const setLine = (i: 0 | 1) => (v: string) => { const cur = [...textOf(s, L)] as [string, string]; cur[i] = v; edit?.onPatch({ t: { ...s.t, [L]: cur } }, ""); };
  const T = lineOf("title", title, t.hl, setLine(0)), U = lineOf("sub", sub, t.hl, setLine(1));
  const vis = (h?: boolean): CSSProperties => (h ? { visibility: "hidden" } : {});

  return (
    <CanvasFrame cvRef={cv} edit={edit} kit={kit} ghost={ghost} mbox={mbox} onCenter={() => isLayer(edit?.sel) && edit?.onPatch(centerPatch(s, edit.sel, hEm), "")}
      style={{ width, height: (width * size.h) / size.w, fontSize: width / 100, ...background(t, index, hEm, n) }}>
      {t.bg === "blur" && <BlurBackdrop t={t} img={imgFor(s, L)} mock={s.mock} thumb={th} />}
      {renderDecos(s.decos, false, t, kit)}
      {(title || sub) && (
        <div style={block}>
          {title && (
            <div {...hit("title")} style={{ position: "relative", transform: s.tx || s.ty ? `translate(${s.tx ?? 0}em,${s.ty ?? 0}em)` : undefined, ...vis(s.hidden?.title) }}>
              <h2 key={T.key} {...T.props} style={{ fontSize: `${t.tsize}em`, fontWeight: t.tweight, lineHeight: t.tlh, letterSpacing: "-.02em", margin: 0 }}>{T.children}</h2>
              {edit?.sel === "title" && widthHandles}
              {edit && lines > 3 && <span className="ed-warn">{lines} lines · shorten or widen</span>}
            </div>
          )}
          {sub && (
            <div {...hit("sub")} style={{ position: "relative", marginTop: title ? `${subEm * 1.4}em` : 0, transform: s.sx || s.sy ? `translate(${s.sx ?? 0}em,${s.sy ?? 0}em)` : undefined, ...vis(s.hidden?.sub) }}>
              <p key={U.key} {...U.props} style={{ fontSize: `${subEm}em`, margin: 0, opacity: 0.85, fontWeight: 500, lineHeight: 1.3 }}>{U.children}</p>
              {edit?.sel === "sub" && widthHandles}
            </div>
          )}
        </div>
      )}
      {/* Chữ tự do: đặt theo tâm (x,y); dạng pill thì nền = màu tô, chữ đậm tối */}
      {renderExtras(s.extras, L, t, ink, zText, kit, (x, v) => edit?.onPatch(patchExtra(s, `x:${x.id}` as LayerId, { t: { ...x.t, [L]: v } }), ""))}
      {(duo || !s.hidden?.device) && devices}
      {renderDecos(s.decos, true, t, kit)}
    </CanvasFrame>
  );
}

// Feature Graphic Google Play (1024×500). Layer "title" = icon + tên + tagline, layer "device" = cụm máy. 3 bố cục:
//   split  = chữ trái, 2 máy phải (mặc định) · center = chữ giữa, 2 máy 2 bên nghiêng vào trong · phones = chỉ 3 máy xoè giữa
// Icon: ảnh thật (iconImg) hoặc icon Lucide. Máy j lấy ảnh slide có id shots[j] (thiếu = slide thứ j), theo ngôn ngữ đang xem
// Khung bọc cụm máy không bắt chuột (pointer-events none), chỉ các máy bắt → bấm chỗ trống giữa 2 máy vẫn chọn được nền/chữ
export const featureShot = (p: Project, j: number) => {
  const id = p.feature.shots?.[j], i = id ? p.slides.findIndex((s) => s.id === id) : -1;
  return i >= 0 ? i : Math.min(j, p.slides.length - 1);
};

export function FeatureCanvas({ p, width, edit, loc }: { p: Project; width: number; edit?: CanvasEdit; loc?: string }) {
  const f = p.feature, t = p.theme, k = width / 100, L = loc ?? p.loc;
  const fcv = useRef<HTMLDivElement>(null);
  const hEm = (100 * FEATURE_SIZE.h) / FEATURE_SIZE.w, lay = f.layout ?? "split";
  const th = width < 240, sr = screenRatio("phone", t);
  // Độ xoay gốc của máy j theo bố cục; phones[j].rz cộng thêm. Kéo nút xoay ghi phần chênh vào phones[j].rz
  const baseRz = (j: number) => (lay === "center" ? (j === 0 ? -(f.rz + 6) : f.rz + 6) : lay === "phones" ? [f.rz, f.rz - 8, f.rz + 8][j] : j === 1 ? f.rz + 4 : f.rz);
  const kit = useEditKit(edit, k, hEm, (l) => posOf(f, l), (l, x, y) => edit?.onPatch(withPos(f, l, x, y), "drag-" + l),
    (l) => {
      const j = phoneIdx(l); if (j < 0) return null;
      const b = baseRz(j);
      return { scale: { v: f.scale, min: 12, max: 30, mul: 1 }, rot: { v: b + (phoneOf(f, j).rz ?? 0), set: (a: number) => ({ phones: setPhone(f, j, { rz: a - b }) }) } };
    },
    FEATURE_SIZE.w / 100,
    (l): CropInfo | null => {
      const j = phoneIdx(l), c = j >= 0 ? phoneOf(f, j) : null;
      return c?.img ? { v: [c.ix ?? 0, c.iy ?? 0, ...panRange(c.img, c, sr)], set: (ix, iy) => ({ phones: setPhone(f, j, { ix, iy }) }) } : null;
    },
    (items) => edit?.onPatch(posPatch(f, items), "drag-multi"));
  const fmulti = !!edit?.multi && edit.multi.length > 1;
  const fghost = useGhost(fcv, fmulti ? null : edit?.sel), fmbox = useMultiBox(fcv, edit?.multi);
  // Về giữa: layer dời theo offset → bỏ dời; chữ tự do (tâm x,y) → giữa banner
  const fCenter = (l: LayerId): [number, number] => (l.startsWith("x:") ? [50, Math.round(hEm * 5) / 10] : [0, 0]);
  const ink = t.tcolor || (t.ink === "light" ? "#fff" : "#15151A");
  const Icon = FEATURE_ICONS[f.icon] ?? FEATURE_ICONS.sprout;
  const dw = f.scale, dh = dw * ASPECT.phone, dx = f.dx ?? 0, dy = f.dy ?? 0;
  const dev = { kind: "phone" as const, store: "play" as const, theme: t, rx: f.rx, ry: f.ry, rz: f.rz };
  const [name, tag] = featText(f, L), hid = f.hidden ?? {};
  const FN = kit.lineOf("title", name, t.hl, (v) => edit?.onPatch(setFeatText(f, L, 0, v), ""));
  const FT = kit.lineOf("sub", tag, t.hl, (v) => edit?.onPatch(setFeatText(f, L, 1, v), ""));
  const center = lay === "center", zText = f.front === "device" ? 0 : 3;
  const off = (x?: number, y?: number) => (x || y ? `translate(${x ?? 0}em,${y ?? 0}em)` : undefined);
  const vis = (h?: boolean): CSSProperties => (h ? { visibility: "hidden" } : {});

  // Một máy = 1 layer (device/device2/device3): ảnh riêng hoặc ảnh slide liên kết; khung bọc không bắt chuột, chỉ máy bắt
  const phone = (j: number, x: number, y: number, extra: { ry?: number; z?: number } = {}) => {
    const c = phoneOf(f, j), id = PHONE_IDS[j], h = kit.hit(id);
    if (c.hidden) return null;
    return (
      <Device key={j} {...dev} ry={extra.ry ?? f.ry} z={extra.z} rz={baseRz(j) + (c.rz ?? 0)} w={dw} x={x + (c.dx ?? 0)} y={y + (c.dy ?? 0)}
        hit={h ? { ...h, style: { pointerEvents: "auto" } } : undefined} handle={edit?.sel === id ? kit.handle : undefined}>
        {c.img ? <Shot img={c.img} mock={0} c={c} thumb={th} sr={sr} /> : screenOf(p, featureShot(p, j), sr, th, L)}
      </Device>
    );
  };
  let box: CSSProperties, phones: ReactNode;
  if (lay === "center") {
    box = { left: `${4 + dx}em`, top: `${(hEm - dh) / 2 + 6 + dy}em`, width: "92em", height: `${dh}em` };
    phones = <>{phone(0, 0, 0, { ry: -f.ry })}{phone(1, 92 - dw, 0)}</>;
  } else if (lay === "phones") {
    box = { left: `${50 - dw * 1.4 + dx}em`, top: `${(hEm - dh) / 2 - 1 + dy}em`, width: `${dw * 2.8}em`, height: `${dh + 6}em` };
    phones = <>{phone(1, 0, 6, { z: 1 })}{phone(2, dw * 1.8, 6, { z: 1 })}{phone(0, dw * 0.9, 0, { z: 3 })}</>;
  } else {
    box = { left: `${100 - 6 - dw * 1.85 + dx}em`, top: `${(hEm - dh) / 2 - 1.5 + dy}em`, width: `${dw * 1.85}em`, height: `${dh + 4.5}em` };
    phones = <>{phone(1, dw * 0.85, 0, { z: 1 })}{phone(0, 0, 4.5)}</>;
  }
  return (
    <CanvasFrame cvRef={fcv} edit={edit} kit={kit} ghost={fghost} mbox={fmbox} onCenter={() => isLayer(edit?.sel) && edit?.onPatch(withPos(f, edit.sel, ...fCenter(edit.sel)), "")}
      style={{ width, height: (width * FEATURE_SIZE.h) / FEATURE_SIZE.w, fontSize: width / 100, ...background(t, 0, hEm, 1) }}>
      {lay !== "phones" && (
        // Khối chữ: chỉ để xếp hàng (không bắt chuột); icon / tên / tagline là 3 layer, mỗi cái dời riêng
        <div style={{ position: "absolute", top: "50%", color: ink, fontFamily: FONTS[t.font], zIndex: zText, pointerEvents: "none",
          ...(center ? { left: "50%", width: "52em", textAlign: "center", transform: "translate(-50%,-50%)" } : { left: "7em", width: "48em", transform: "translateY(-50%)" }) }}>
          <div {...kit.hit("icon")} style={{ position: "relative", width: "fit-content", margin: center ? "0 auto" : undefined, pointerEvents: "auto", transform: off(f.ox, f.oy), ...vis(hid.icon) }}>
            <div style={{ width: "10em", height: "10em", borderRadius: "2.6em", background: "#fff", display: "grid", placeItems: "center", overflow: "hidden", boxShadow: "0 .8em 2.4em rgba(0,0,0,.16)", color: t.c1 }}>
              {f.iconImg ? <img src={imgSrc(f.iconImg, th)} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : <Icon style={{ width: "5.4em", height: "5.4em" }} strokeWidth={2} />}
            </div>
          </div>
          {name && (
            <div {...kit.hit("title")} style={{ position: "relative", pointerEvents: "auto", transform: off(f.tx, f.ty), ...vis(hid.title) }}>
              <h2 key={FN.key} {...FN.props} style={{ fontSize: center ? "6em" : "7em", margin: ".3em 0 0", fontWeight: 800, letterSpacing: "-.03em", lineHeight: 1 }}>{FN.children}</h2>
            </div>
          )}
          {tag && (
            <div {...kit.hit("sub")} style={{ position: "relative", pointerEvents: "auto", transform: off(f.sx, f.sy), ...vis(hid.sub) }}>
              <p key={"t" + FT.key} {...FT.props} style={{ fontSize: "3em", margin: ".35em 0 0", opacity: 0.88, fontWeight: 500 }}>{FT.children}</p>
            </div>
          )}
        </div>
      )}
      {renderExtras(f.extras, L, t, ink, zText, kit, (x, v) => edit?.onPatch(patchExtra(f, `x:${x.id}` as LayerId, { t: { ...x.t, [L]: v } }), ""))}
      {f.device && <div style={{ position: "absolute", zIndex: 2, pointerEvents: "none", ...box }}>{phones}</div>}
    </CanvasFrame>
  );
}

// --- Căn layer theo khung (Align) ---
// Đo khung thật của layer trên canvas đang mở (.slidewrap.on) rồi dời đúng phần chênh qua withPos → dùng chung cho máy, chữ, trang trí, slide lẫn feature
export type AlignEdge = "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom";
export function alignPatch(holder: Slide | import("@/lib/types").Feature, l: LayerId, edge: AlignEdge): Record<string, unknown> | null {
  const root = document.querySelector<HTMLElement>(".slidewrap.on [data-cv]"), el = root?.querySelector<HTMLElement>(`[data-pick="${l}"]`);
  if (!root || !el) return null;
  const R = root.getBoundingClientRect(), k = R.width / 100, r = rectEm(el, R, k), H = R.height / k;
  const dx = edge === "left" ? -r.l : edge === "right" ? 100 - r.r : edge === "hcenter" ? 50 - (r.l + r.r) / 2 : 0;
  const dy = edge === "top" ? -r.t : edge === "bottom" ? H - r.b : edge === "vcenter" ? H / 2 - (r.t + r.b) / 2 : 0;
  const [x, y] = posOf(holder, l);
  return withPos(holder, l, r1(x + dx), r1(y + dy));
}

// --- Căn / dàn đều NHIỀU layer ---
// toFrame = căn theo khung slide; không thì căn theo khung bao của nhóm (như Figma). Đo DOM thật rồi gộp patch bằng posPatch
type Holder = Slide | import("@/lib/types").Feature;
function measureMany(ls: LayerId[]) {
  const root = document.querySelector<HTMLElement>(".slidewrap.on [data-cv]");
  if (!root) return null;
  const R = root.getBoundingClientRect(), k = R.width / 100;
  const rs = ls.map((l) => [l, root.querySelector<HTMLElement>(`[data-pick="${l}"]`)] as const).filter((x): x is readonly [LayerId, HTMLElement] => !!x[1]).map(([l, el]) => [l, rectEm(el, R, k)] as const);
  return { rs, H: R.height / k };
}
export function alignManyPatch(holder: Holder, ls: LayerId[], edge: AlignEdge, toFrame: boolean): Record<string, unknown> | null {
  const m = measureMany(ls); if (!m || !m.rs.length) return null;
  const u = toFrame ? { l: 0, t: 0, r: 100, b: m.H } : unionRect(m.rs.map(([, r]) => r));
  return posPatch(holder, m.rs.map(([l, r]) => {
    const dx = edge === "left" ? u.l - r.l : edge === "right" ? u.r - r.r : edge === "hcenter" ? (u.l + u.r) / 2 - (r.l + r.r) / 2 : 0;
    const dy = edge === "top" ? u.t - r.t : edge === "bottom" ? u.b - r.b : edge === "vcenter" ? (u.t + u.b) / 2 - (r.t + r.b) / 2 : 0;
    const [x, y] = posOf(holder, l);
    return [l, r1(x + dx), r1(y + dy)] as const;
  }));
}
// Dàn đều (≥3 layer): giữ 2 layer ngoài cùng, chia đều KHOẢNG TRỐNG giữa các layer theo trục h (ngang) / v (dọc)
export function distributePatch(holder: Holder, ls: LayerId[], axis: "h" | "v"): Record<string, unknown> | null {
  const m = measureMany(ls); if (!m || m.rs.length < 3) return null;
  const a = axis === "h" ? (r: Rect) => [r.l, r.r] : (r: Rect) => [r.t, r.b];
  const rs = [...m.rs].sort((p, q) => a(p[1])[0] + a(p[1])[1] - a(q[1])[0] - a(q[1])[1]);
  const start = Math.min(...rs.map(([, r]) => a(r)[0])), end = Math.max(...rs.map(([, r]) => a(r)[1]));
  const sizes = rs.map(([, r]) => a(r)[1] - a(r)[0]), gap = (end - start - sizes.reduce((x, y) => x + y, 0)) / (rs.length - 1);
  let at = start;
  return posPatch(holder, rs.map(([l, r], i) => {
    const d = at - a(r)[0]; at += sizes[i] + gap;
    const [x, y] = posOf(holder, l);
    return (axis === "h" ? [l, r1(x + d), y] : [l, x, r1(y + d)]) as readonly [LayerId, number, number];
  }));
}
