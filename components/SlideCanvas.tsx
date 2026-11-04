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
import type { Project, SizePreset, Theme } from "@/lib/types";
import { FONTS, FEATURE_SIZE } from "@/lib/presets";
import { textOf, themeOf, richParts, imgFor } from "@/lib/rules";
import { posOf, withPos, patchExtra, extraText, isDevice, isLayer, type LayerId } from "@/lib/layers";
import { imgSrc, imgMeta } from "@/lib/images";
import type { Slide } from "@/lib/types";
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
}
// Tay cầm của một layer máy: đổi cỡ (scale) và xoay (rot, ghi vào khoá key)
type Tf = { scale?: { v: number; min: number; max: number; mul: number }; rot?: { v: number; key: string } };
type Rect = { l: number; t: number; r: number; b: number };
// Lớp phủ khi sửa (em): đường gióng x/y, thước đo khoảng cách m, nhãn số tip
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
  tf: (l: LayerId) => Tf | null, pxPerEm: number, crop: (l: LayerId) => [number, number, number, number] | null = () => null) {
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

  if (!edit) return { hit: () => undefined, handle: undefined, guides: null, lineOf, root: undefined };

  const drag = (e: RPE, what: LayerId) => {
    if (e.button !== 0 || (e.target as HTMLElement).isContentEditable) return;
    e.stopPropagation(); edit.onSel(what);
    const el = e.currentTarget as HTMLElement, root = el.closest("[data-cv]") as HTMLElement, R = root.getBoundingClientRect();
    // Đang căn ảnh: kéo = dời ảnh trong màn, 1:1 theo cỡ màn (ix/iy = % bề ngang/cao màn), giới hạn ±100%
    const c0 = edit.crop === what ? crop(what) : null;
    if (c0) {
      // c0 = [ix, iy, khoảng dời x, khoảng dời y]; trục không còn phần dư (khoảng = 0) thì đứng yên
      const scr = el.querySelector(".scr")!.getBoundingClientRect(), [ix0, iy0, rx, ry] = c0;
      const step = (px: number, size: number, range: number) => (range ? ((px / size) * 100 / range) * 100 : 0);
      startDrag(e, k, (mx, my) => edit.onPatch({ ix: r1(clamp(ix0 + step(mx * k, scr.width, rx), -100, 100)), iy: r1(clamp(iy0 + step(my * k, scr.height, ry), -100, 100)) }, "pan"));
      return;
    }
    const r0 = rectEm(el, R, k), cc = [(r0.l + r0.r) / 2, (r0.t + r0.b) / 2];
    const others = [...root.querySelectorAll("[data-pick]")].filter((x) => x !== el && !el.contains(x) && getComputedStyle(x).visibility !== "hidden").map((x) => rectEm(x, R, k));
    // Layer gần nhất để đo khoảng cách
    const near = others.sort((a, b) => Math.hypot((a.l + a.r) / 2 - cc[0], (a.t + a.b) / 2 - cc[1]) - Math.hypot((b.l + b.r) / 2 - cc[0], (b.t + b.b) / 2 - cc[1]))[0];
    const tx = [8, 50, 92, ...others.flatMap((o) => [o.l, (o.l + o.r) / 2, o.r])];
    const ty = [hEm / 2, ...others.flatMap((o) => [o.t, (o.t + o.b) / 2, o.b])];
    const [bx, by] = pos(what), free = what.startsWith("x:");
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
    className: `ed-hit ${isDevice(what) ? "device" : "text"} ${edit.sel === what ? "sel" : ""} ${edit.hover === what ? "hov" : ""} ${edit.crop === what ? "cropping" : ""}`,
    onPointerDown: (e: RPE) => drag(e, what),
    onDragStart: (e: { preventDefault: () => void }) => e.preventDefault(),
    // Double-click máy có ảnh → vào/ra chế độ căn ảnh
    onDoubleClick: isDevice(what) ? () => { if (crop(what)) edit.onCrop?.(edit.crop === what ? null : what); } : undefined,
  });

  // Vị trí con trỏ (em) trong canvas — để đặt nhãn số cạnh chuột
  const ptr = (e: RPE) => { const R = (e.currentTarget as HTMLElement).closest("[data-cv]")!.getBoundingClientRect(); return [(e.clientX - R.left) / k, (e.clientY - R.top) / k]; };

  // 4 nút góc đổi cỡ máy (góc trái đảo dấu) + nút tròn xoay (hút 0°/±15°); ẩn khi đang căn ảnh
  const cur = isLayer(edit.sel) && isDevice(edit.sel) && edit.crop !== edit.sel ? tf(edit.sel) : null;
  const scale = cur?.scale, rot = cur?.rot;
  const handle = cur ? (
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
            edit.onPatch({ [rot.key]: a }, "drag-rot");
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
      {toolbar}
      {edit.crop && <div className="ed-croptip">Drag to reposition · Esc to finish</div>}
    </>
  );
  // Bấm nền slide (chỗ không có layer) → chọn cấp Slide
  const root = { onPointerDown: (e: RPE) => { if (e.button !== 0) return; e.stopPropagation(); edit.onSel("slide"); } };
  return { hit, handle, guides, lineOf, root };
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
    (l) => !s ? null : l === "device2"
      ? { scale: { v: s.scale, min: 40, max: 100, mul: 1 / 0.66 }, rot: { v: s.brz ?? 6, key: "brz" } }
      : { scale: { v: s.scale, min: 40, max: 100, mul: duo ? 1 / 0.66 : centered ? 2 : 1 }, rot: { v: s.rz, key: "rz" } },
    size.w / 100,
    (l) => { const im = imgFor(s, L); return s && l === "device" && im ? [s.ix ?? 0, s.iy ?? 0, ...panRange(im, s, screenRatio(size.kind, t))] as [number, number, number, number] : null; });
  const titleRaw = s ? textOf(s, L)[0] : "";
  useLayoutEffect(() => {
    if (!edit) return;
    const h = cv.current?.querySelector<HTMLElement>('[data-line="title"]');
    setLines(h ? Math.round(h.getBoundingClientRect().height / ((width / 100) * t.tsize * t.tlh)) : 0);
  }, [edit, titleRaw, width, t.tsize, t.tlh, t.font, t.tweight, s?.tw, s?.layout]);
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
              {s.img2 ? <Shot img={s.img2} mock={0} thumb={th} sr={sr} /> : screenOf(p, (index + 1) % n, sr, th, L)}
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
  const widthHandles = edit && (edit.sel === "title" || edit.sel === "sub") ? (["l", "r"] as const).map((side) => (
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
    <div data-cv ref={cv} {...kit.root} style={{ position: "relative", overflow: "hidden", width, height: (width * size.h) / size.w, fontSize: width / 100, ...background(t, index, hEm, n) }}>
      {t.bg === "blur" && imgFor(s, L) && (
        <>
          <div style={{ position: "absolute", inset: "-10%", backgroundImage: `url(${imgSrc(imgFor(s, L), th)})`, backgroundSize: "cover", backgroundPosition: "center", filter: `blur(${t.blur * 0.12}em)` }} />
          <div style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${t.overlay / 100})` }} />
        </>
      )}
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
      {(s.extras ?? []).map((x) => {
        const id = `x:${x.id}` as LayerId, val = extraText(x, L);
        const X = lineOf(id, val, x.pill ? t.c1 : t.hl, (v) => edit?.onPatch(patchExtra(s, id, { t: { ...x.t, [L]: v } }), ""));
        return (
          <div key={x.id} {...hit(id)} style={{ position: "absolute", left: `${x.x}em`, top: `${x.y}em`, transform: "translate(-50%,-50%)", zIndex: zText, maxWidth: "88em", textAlign: "center", fontFamily: FONTS[t.font], whiteSpace: "nowrap", ...vis(x.hidden) }}>
            <div key={X.key} {...X.props} style={{ fontSize: `${x.size}em`, fontWeight: x.weight, lineHeight: 1.2, color: x.pill ? "#15151A" : x.color || ink, ...(x.pill ? { background: t.hl, padding: ".35em .9em", borderRadius: "999px", display: "inline-block" } : {}) }}>{X.children}</div>
          </div>
        );
      })}
      {(duo || !s.hidden?.device) && devices}
      {kit.guides}
    </div>
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
  const hEm = (100 * FEATURE_SIZE.h) / FEATURE_SIZE.w, lay = f.layout ?? "split";
  const kit = useEditKit(edit, k, hEm, (l) => posOf(f, l), (l, x, y) => edit?.onPatch(withPos(f, l, x, y), "drag-" + l),
    () => ({ scale: { v: f.scale, min: 12, max: 30, mul: 1 }, rot: { v: f.rz, key: "rz" } }), FEATURE_SIZE.w / 100);
  const th = width < 240, sr = screenRatio("phone", t);
  const ink = t.tcolor || (t.ink === "light" ? "#fff" : "#15151A");
  const Icon = FEATURE_ICONS[f.icon] ?? FEATURE_ICONS.sprout;
  const dw = f.scale, dx = f.dx ?? 0, dy = f.dy ?? 0, dh = dw * ASPECT.phone;
  const dev = { kind: "phone" as const, store: "play" as const, theme: t, rx: f.rx, ry: f.ry, rz: f.rz, hit: { style: { pointerEvents: "auto" as const } } };
  const FN = kit.lineOf("fn", f.name, t.hl, (name) => edit?.onPatch({ name }, ""));
  const FT = kit.lineOf("ft", f.tagline, t.hl, (tagline) => edit?.onPatch({ tagline }, ""));
  const center = lay === "center";
  const phone = (j: number, x: number, y: number, extra: Partial<typeof dev> & { z?: number } = {}) => (
    <Device key={j} {...dev} {...extra} w={dw} x={x} y={y}>{screenOf(p, featureShot(p, j), sr, th, L)}</Device>
  );

  // Khung + vị trí các máy theo bố cục (em, so với khung bọc)
  let box: CSSProperties, phones: ReactNode;
  if (lay === "center") {
    box = { left: `${4 + dx}em`, top: `${(hEm - dh) / 2 + 6 + dy}em`, width: "92em", height: `${dh}em` };
    phones = <>{phone(0, 0, 0, { ry: -f.ry, rz: -(f.rz + 6) })}{phone(1, 92 - dw, 0, { rz: f.rz + 6 })}</>;
  } else if (lay === "phones") {
    box = { left: `${50 - dw * 1.4 + dx}em`, top: `${(hEm - dh) / 2 - 1 + dy}em`, width: `${dw * 2.8}em`, height: `${dh + 6}em` };
    phones = <>{phone(1, 0, 6, { rz: f.rz - 8, z: 1 })}{phone(2, dw * 1.8, 6, { rz: f.rz + 8, z: 1 })}{phone(0, dw * 0.9, 0, { z: 3 })}</>;
  } else {
    box = { left: `${100 - 6 - dw * 1.85 + dx}em`, top: `${(hEm - dh) / 2 - 1.5 + dy}em`, width: `${dw * 1.85}em`, height: `${dh + 4.5}em` };
    phones = <>{phone(1, dw * 0.85, 0, { rz: f.rz + 4, z: 1 })}{phone(0, 0, 4.5)}</>;
  }
  const icon = (
    <div style={{ width: "10em", height: "10em", borderRadius: "2.6em", background: "#fff", display: "grid", placeItems: "center", overflow: "hidden", boxShadow: "0 .8em 2.4em rgba(0,0,0,.16)", color: t.c1, margin: center ? "0 auto" : undefined }}>
      {f.iconImg ? <img src={imgSrc(f.iconImg, th)} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : <Icon style={{ width: "5.4em", height: "5.4em" }} strokeWidth={2} />}
    </div>
  );
  return (
    <div data-cv {...kit.root} style={{ position: "relative", overflow: "hidden", width, height: (width * FEATURE_SIZE.h) / FEATURE_SIZE.w, fontSize: width / 100, ...background(t, 0, hEm, 1) }}>
      {lay !== "phones" && (
        <div {...kit.hit("title")} style={{ position: "absolute", top: "50%", color: ink, fontFamily: FONTS[t.font], zIndex: f.front === "device" ? 0 : 3,
          ...(center
            ? { left: "50%", width: "52em", textAlign: "center", transform: `translate(calc(-50% + ${f.tx ?? 0}em), calc(-50% + ${f.ty ?? 0}em))` }
            : { left: "7em", width: "48em", transform: `translate(${f.tx ?? 0}em, calc(-50% + ${f.ty ?? 0}em))` }) }}>
          {icon}
          <h2 key={FN.key} {...FN.props} style={{ fontSize: center ? "6em" : "7em", margin: ".3em 0 0", fontWeight: 800, letterSpacing: "-.03em", lineHeight: 1 }}>{FN.children}</h2>
          <p key={"t" + FT.key} {...FT.props} style={{ fontSize: "3em", margin: ".35em 0 0", opacity: 0.88, fontWeight: 500 }}>{FT.children}</p>
        </div>
      )}
      {f.device && (
        <div {...kit.hit("device")} style={{ position: "absolute", zIndex: 2, pointerEvents: "none", ...box }}>
          {phones}
          {kit.handle}
        </div>
      )}
      {kit.guides}
    </div>
  );
}
