// Layer trên một slide / feature graphic: id, tên hiển thị, vị trí (để kéo & nhích phím), ẩn/hiện, thêm/xoá layer chữ
// Id layer: "title" (Headline) · "sub" (Subtitle) · "device" · "x:<id>" (chữ tự do trong slide.extras)
// Feature graphic chỉ có "title" (khối icon + tên + tagline) và "device"
import type { Feature, Slide, TextItem } from "./types";
import { textOf, plain } from "./rules";

export type LayerId = "title" | "sub" | "device" | `x:${string}`;
export const isLayer = (v: unknown): v is LayerId => v === "title" || v === "sub" || v === "device" || (typeof v === "string" && v.startsWith("x:"));
export const isText = (l: LayerId | null | undefined) => !!l && l !== "device";
export const extraId = (l: LayerId) => (l.startsWith("x:") ? l.slice(2) : null);
export const extraOf = (s: Slide, l: LayerId): TextItem | undefined => { const id = extraId(l); return id ? s.extras?.find((x) => x.id === id) : undefined; };
export const extraText = (x: TextItem, loc: string) => x.t[loc] ?? x.t.en ?? Object.values(x.t)[0] ?? "";

// Vị trí hiện tại của layer (em): offset với title/sub/device, toạ độ tâm với chữ tự do
export function posOf(s: Slide | Feature, l: LayerId): [number, number] {
  if (l === "device") return [s.dx ?? 0, s.dy ?? 0];
  if (l === "title") return [s.tx ?? 0, s.ty ?? 0];
  const sl = s as Slide;
  if (l === "sub") return [sl.sx ?? 0, sl.sy ?? 0];
  const x = extraOf(sl, l);
  return x ? [x.x, x.y] : [0, 0];
}

// Patch đặt vị trí mới cho layer (trả Partial để đưa vào onPatch)
export function withPos(s: Slide | Feature, l: LayerId, x: number, y: number): Partial<Slide> {
  if (l === "device") return { dx: x, dy: y };
  if (l === "title") return { tx: x, ty: y };
  if (l === "sub") return { sx: x, sy: y };
  const id = extraId(l), sl = s as Slide;
  return { extras: (sl.extras ?? []).map((e) => (e.id === id ? { ...e, x, y } : e)) };
}

export function patchExtra(s: Slide, l: LayerId, patch: Partial<TextItem>): Partial<Slide> {
  const id = extraId(l);
  return { extras: (s.extras ?? []).map((e) => (e.id === id ? { ...e, ...patch } : e)) };
}

export const isHidden = (s: Slide, l: LayerId) => (l === "title" || l === "sub" || l === "device" ? !!s.hidden?.[l] : !!extraOf(s, l)?.hidden);

export function toggleHidden(s: Slide, l: LayerId): Partial<Slide> {
  if (l === "title" || l === "sub" || l === "device") return { hidden: { ...s.hidden, [l]: !s.hidden?.[l] } };
  return patchExtra(s, l, { hidden: !extraOf(s, l)?.hidden });
}

// Danh sách layer theo thứ tự hiển thị trong cây (chữ trước, máy sau); chỉ có layer đang tồn tại
export function layersOf(s: Slide, loc: string): { id: LayerId; name: string; sub: string }[] {
  const [title, sub] = textOf(s, loc);
  const out: { id: LayerId; name: string; sub: string }[] = [];
  if (title) out.push({ id: "title", name: "Headline", sub: plain(title) });
  if (sub) out.push({ id: "sub", name: "Subtitle", sub: plain(sub) });
  for (const x of s.extras ?? []) out.push({ id: `x:${x.id}`, name: x.pill ? "Badge" : "Text", sub: plain(extraText(x, loc)) || "—" });
  out.push({ id: "device", name: "Device", sub: s.img ? "Screenshot" : "Sample" });
  return out;
}

export const layerName = (s: Slide, l: LayerId) => l === "title" ? "Headline" : l === "sub" ? "Subtitle" : l === "device" ? "Device" : extraOf(s, l)?.pill ? "Badge" : "Text";

// Xoá layer chữ: title/sub = xoá nội dung ở MỌI ngôn ngữ; chữ tự do = bỏ khỏi extras. Device không xoá được (ẩn thôi)
export function removeLayer(s: Slide, l: LayerId): Partial<Slide> | null {
  if (l === "device") return null;
  if (l === "title" || l === "sub") {
    const k = l === "title" ? 0 : 1, t: Slide["t"] = {};
    for (const [loc, v] of Object.entries(s.t)) { const c = [...v] as [string, string]; c[k] = ""; t[loc] = c; }
    return { t };
  }
  const id = extraId(l);
  return { extras: (s.extras ?? []).filter((e) => e.id !== id) };
}

// Có thể thêm loại chữ nào: headline/subtitle chỉ khi đang không có
export const canAdd = (s: Slide, loc: string) => { const [t, u] = textOf(s, loc); return { title: !t, sub: !u }; };
