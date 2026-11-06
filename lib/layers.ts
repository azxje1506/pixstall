// Layer trên một slide / feature graphic: id, tên hiển thị, vị trí (để kéo & nhích phím), ẩn/hiện, thêm/xoá layer chữ
// Id layer: "title" (Headline) · "sub" (Subtitle) · "device" · "device2" (máy thứ 2, chỉ layout Duo) · "x:<id>" (chữ tự do) · "d:<id>" (hình trang trí, chỉ slide)
// Feature graphic: "icon" · "title" (tên app) · "sub" (tagline) · "x:<id>" · "device"/"device2"/"device3" (máy 1/2/3) — hàm f*
// posOf / withPos tự nhận ra slide hay feature (isFeat)
import type { Deco, Feature, PhoneCfg, Slide, TextItem } from "./types";
import { decoDef } from "./decos";
import { textOf, plain } from "./rules";

export type LayerId = "title" | "sub" | "icon" | "device" | "device2" | "device3" | `x:${string}` | `d:${string}`;
const IDS = ["title", "sub", "icon", "device", "device2", "device3"];
export const isLayer = (v: unknown): v is LayerId => typeof v === "string" && (IDS.includes(v) || v.startsWith("x:") || v.startsWith("d:"));
export const isDevice = (l: LayerId | null | undefined) => l === "device" || l === "device2" || l === "device3";
export const isDeco = (l: LayerId | null | undefined) => !!l && l.startsWith("d:");
export const isText = (l: LayerId | null | undefined) => !!l && !isDevice(l) && !isDeco(l);
export const decoOf = (s: { decos?: Deco[] }, l: LayerId): Deco | undefined => (isDeco(l) ? s.decos?.find((d) => d.id === l.slice(2)) : undefined);
export function patchDeco(s: { decos?: Deco[] }, l: LayerId, patch: Partial<Deco>): { decos: Deco[] } {
  const id = l.slice(2);
  return { decos: (s.decos ?? []).map((d) => (d.id === id ? { ...d, ...patch, tpl: false } : d)) }; // sửa tay → không còn là hình của template
}
export const extraId = (l: LayerId) => (l.startsWith("x:") ? l.slice(2) : null);
type Holder = { extras?: TextItem[] };
export const extraOf = (s: Holder, l: LayerId): TextItem | undefined => { const id = extraId(l); return id ? s.extras?.find((x) => x.id === id) : undefined; };
export const extraText = (x: TextItem, loc: string) => x.t[loc] ?? x.t.en ?? Object.values(x.t)[0] ?? "";

// Vị trí hiện tại của layer (em): offset với title/sub/device, toạ độ tâm với chữ tự do
export function posOf(s: Slide | Feature, l: LayerId): [number, number] {
  if (isFeat(s)) return fPos(s, l);
  if (l === "device") return [s.dx ?? 0, s.dy ?? 0];
  if (l === "title") return [s.tx ?? 0, s.ty ?? 0];
  const sl = s as Slide;
  if (l === "device2") return [sl.bx ?? 0, sl.by ?? 0];
  if (l === "sub") return [sl.sx ?? 0, sl.sy ?? 0];
  const dc = decoOf(sl, l);
  if (dc) return [dc.x, dc.y];
  const x = extraOf(sl, l);
  return x ? [x.x, x.y] : [0, 0];
}

// Patch đặt vị trí mới cho layer (trả Partial để đưa vào onPatch)
export function withPos(s: Slide | Feature, l: LayerId, x: number, y: number): Record<string, unknown> {
  if (isFeat(s)) return fWithPos(s, l, x, y);
  if (l === "device") return { dx: x, dy: y };
  if (l === "title") return { tx: x, ty: y };
  if (l === "sub") return { sx: x, sy: y };
  if (l === "device2") return { bx: x, by: y };
  if (isDeco(l)) return patchDeco(s as Slide, l, { x, y });
  const id = extraId(l), sl = s as Slide;
  return { extras: (sl.extras ?? []).map((e) => (e.id === id ? { ...e, x, y } : e)) };
}

export function patchExtra(s: Holder, l: LayerId, patch: Partial<TextItem>): { extras: TextItem[] } {
  const id = extraId(l);
  return { extras: (s.extras ?? []).map((e) => (e.id === id ? { ...e, ...patch } : e)) };
}

const fixed = (l: LayerId): l is "title" | "sub" | "device" | "device2" => !l.startsWith("x:") && !l.startsWith("d:") && l !== "icon" && l !== "device3";
export const isHidden = (s: Slide, l: LayerId) => (fixed(l) ? !!s.hidden?.[l] : isDeco(l) ? !!decoOf(s, l)?.hidden : !!extraOf(s, l)?.hidden);

export function toggleHidden(s: Slide, l: LayerId): Partial<Slide> {
  if (fixed(l)) return { hidden: { ...s.hidden, [l]: !s.hidden?.[l] } };
  if (isDeco(l)) return patchDeco(s, l, { hidden: !decoOf(s, l)?.hidden });
  return patchExtra(s, l, { hidden: !extraOf(s, l)?.hidden });
}

// Danh sách layer theo thứ tự hiển thị trong cây (chữ trước, máy sau); chỉ có layer đang tồn tại
// next = số thứ tự (1-based) slide kế tiếp — máy 2 của Duo mặc định lấy ảnh slide đó
export function layersOf(s: Slide, loc: string, next?: number): { id: LayerId; name: string; sub: string }[] {
  const [title, sub] = textOf(s, loc);
  const out: { id: LayerId; name: string; sub: string }[] = [];
  if (title) out.push({ id: "title", name: "Headline", sub: plain(title) });
  if (sub) out.push({ id: "sub", name: "Subtitle", sub: plain(sub) });
  for (const x of s.extras ?? []) out.push({ id: `x:${x.id}`, name: x.pill ? "Badge" : "Text", sub: plain(extraText(x, loc)) || "—" });
  for (const d of s.decos ?? []) out.push({ id: `d:${d.id}`, name: decoDef(d.kind).name, sub: d.front ? "Decoration · on top" : "Decoration" });
  out.push({ id: "device", name: "Device", sub: s.img ? "Screenshot" : "Sample" });
  if (s.layout === "duo") out.push({ id: "device2", name: "Device 2", sub: s.img2 ? "Own screenshot" : `Linked · slide ${String(next ?? 0).padStart(2, "0")}` });
  return out;
}

export const layerName = (s: Slide, l: LayerId) => l === "title" ? "Headline" : l === "sub" ? "Subtitle" : l === "device" ? "Device" : l === "device2" ? "Device 2" : isDeco(l) ? decoDef(decoOf(s, l)?.kind ?? "").name : extraOf(s, l)?.pill ? "Badge" : "Text";

// Xoá layer chữ: title/sub = xoá nội dung ở MỌI ngôn ngữ; chữ tự do = bỏ khỏi extras. Device không xoá được (ẩn thôi)
export function removeLayer(s: Slide, l: LayerId): Partial<Slide> | null {
  if (isDevice(l)) return null;
  if (l === "title" || l === "sub") {
    const k = l === "title" ? 0 : 1, t: Slide["t"] = {};
    for (const [loc, v] of Object.entries(s.t)) { const c = [...v] as [string, string]; c[k] = ""; t[loc] = c; }
    return { t };
  }
  if (isDeco(l)) return { decos: (s.decos ?? []).filter((d) => d.id !== l.slice(2)) };
  const id = extraId(l);
  return { extras: (s.extras ?? []).filter((e) => e.id !== id) };
}

// Đưa layer về giữa khung (hEm = chiều cao slide theo em): máy/tiêu đề/phụ đề = bỏ dời; chữ tự do + trang trí = đặt tâm vào giữa và hiện lại
export function centerPatch(s: Slide, l: LayerId, hEm: number): Partial<Slide> {
  if (l === "device") return { dx: 0, dy: 0, hidden: { ...s.hidden, device: false } };
  if (l === "device2") return { bx: 0, by: 0, hidden: { ...s.hidden, device2: false } };
  if (l === "title") return { tx: 0, ty: 0, hidden: { ...s.hidden, title: false } };
  if (l === "sub") return { sx: 0, sy: 0, hidden: { ...s.hidden, sub: false } };
  const y = Math.round(hEm * 5) / 10;
  if (isDeco(l)) return patchDeco(s, l, { x: 50, y, hidden: false });
  return patchExtra(s, l, { x: 50, y, hidden: false });
}

// Có thể thêm loại chữ nào: headline/subtitle chỉ khi đang không có
export const canAdd = (s: Slide, loc: string) => { const [t, u] = textOf(s, loc); return { title: !t, sub: !u }; };

// ===================== Feature graphic =====================
export const isFeat = (s: Slide | Feature): s is Feature => "tagline" in s;
export const PHONE_IDS = ["device", "device2", "device3"] as const;
export const phoneIdx = (l: LayerId | null | undefined) => (l ? (PHONE_IDS as readonly string[]).indexOf(l) : -1);
export const phoneCount = (f: Feature) => (f.layout === "phones" ? 3 : 2);
export const phoneOf = (f: Feature, j: number): PhoneCfg => f.phones?.[j] ?? {};
// Trả mảng phones mới với máy j đã được sửa (tự thêm phần tử rỗng nếu thiếu)
export function setPhone(f: Feature, j: number, patch: Partial<PhoneCfg>): PhoneCfg[] {
  const arr = [...(f.phones ?? [])];
  while (arr.length <= j) arr.push({});
  arr[j] = { ...arr[j], ...patch };
  return arr;
}
// Chữ feature theo ngôn ngữ: en = name/tagline; ngôn ngữ khác = t[loc] (thiếu thì dùng tạm en)
export const featText = (f: Feature, loc: string): [string, string] => (loc !== "en" && f.t?.[loc]) || [f.name, f.tagline];
export function setFeatText(f: Feature, loc: string, k: 0 | 1, v: string): Partial<Feature> {
  if (loc === "en") return k ? { tagline: v } : { name: v };
  const cur = [...featText(f, loc)] as [string, string];
  cur[k] = v;
  return { t: { ...f.t, [loc]: cur } };
}

function fPos(f: Feature, l: LayerId): [number, number] {
  if (l === "title") return [f.tx ?? 0, f.ty ?? 0];
  if (l === "sub") return [f.sx ?? 0, f.sy ?? 0];
  if (l === "icon") return [f.ox ?? 0, f.oy ?? 0];
  const j = phoneIdx(l);
  if (j >= 0) { const c = phoneOf(f, j); return [c.dx ?? 0, c.dy ?? 0]; }
  const x = extraOf(f, l);
  return x ? [x.x, x.y] : [0, 0];
}
function fWithPos(f: Feature, l: LayerId, x: number, y: number): Partial<Feature> {
  if (l === "title") return { tx: x, ty: y };
  if (l === "sub") return { sx: x, sy: y };
  if (l === "icon") return { ox: x, oy: y };
  const j = phoneIdx(l);
  if (j >= 0) return { phones: setPhone(f, j, { dx: x, dy: y }) };
  const id = extraId(l);
  return { extras: (f.extras ?? []).map((e) => (e.id === id ? { ...e, x, y } : e)) };
}

export const fIsHidden = (f: Feature, l: LayerId) => {
  if (l === "title" || l === "sub" || l === "icon") return !!f.hidden?.[l];
  const j = phoneIdx(l);
  return j >= 0 ? !!phoneOf(f, j).hidden : !!extraOf(f, l)?.hidden;
};
export function fToggleHidden(f: Feature, l: LayerId): Partial<Feature> {
  if (l === "title" || l === "sub" || l === "icon") return { hidden: { ...f.hidden, [l]: !f.hidden?.[l] } };
  const j = phoneIdx(l);
  if (j >= 0) return { phones: setPhone(f, j, { hidden: !phoneOf(f, j).hidden }) };
  return patchExtra(f, l, { hidden: !extraOf(f, l)?.hidden });
}
// Xoá được: tên app / tagline (xoá chữ ở mọi ngôn ngữ) và chữ tự do; icon và máy chỉ ẩn được
export const fRemovable = (l: LayerId) => l === "title" || l === "sub" || l.startsWith("x:");
export function fRemoveLayer(f: Feature, l: LayerId): Partial<Feature> | null {
  if (l === "title" || l === "sub") {
    const k = l === "title" ? 0 : 1, t: Record<string, [string, string]> = {};
    for (const [loc, v] of Object.entries(f.t ?? {})) { const c = [...v] as [string, string]; c[k] = ""; t[loc] = c; }
    return { ...(k ? { tagline: "" } : { name: "" }), t };
  }
  if (!l.startsWith("x:")) return null;
  const id = extraId(l);
  return { extras: (f.extras ?? []).filter((e) => e.id !== id) };
}
export const fLayerName = (f: Feature, l: LayerId) => {
  if (l === "title") return "App name";
  if (l === "sub") return "Tagline";
  if (l === "icon") return "App icon";
  const j = phoneIdx(l);
  if (j >= 0) return `Phone ${j + 1}`;
  return extraOf(f, l)?.pill ? "Badge" : "Text";
};
// Layer của feature theo thứ tự cây; slideNo(j) = số thứ tự slide mà máy j đang lấy ảnh
export function fLayersOf(f: Feature, loc: string, slideNo: (j: number) => number): { id: LayerId; name: string; sub: string }[] {
  const [n, tg] = featText(f, loc), out: { id: LayerId; name: string; sub: string }[] = [];
  if (f.layout !== "phones") {
    out.push({ id: "icon", name: "App icon", sub: f.iconImg ? "Your icon" : "Placeholder" });
    if (n) out.push({ id: "title", name: "App name", sub: plain(n) });
    if (tg) out.push({ id: "sub", name: "Tagline", sub: plain(tg) });
  }
  for (const x of f.extras ?? []) out.push({ id: `x:${x.id}`, name: x.pill ? "Badge" : "Text", sub: plain(extraText(x, loc)) || "—" });
  for (let j = 0; j < phoneCount(f); j++) {
    const c = phoneOf(f, j);
    out.push({ id: PHONE_IDS[j], name: `Phone ${j + 1}`, sub: c.img ? "Own image" : `Slide ${String(slideNo(j)).padStart(2, "0")}` });
  }
  return out;
}
export const fCanAdd = (f: Feature, loc: string) => { const [n, t] = featText(f, loc); return { title: !n, sub: !t }; };
// Tên layer chung cho slide hoặc feature
export const nameOfLayer = (s: Slide | Feature, l: LayerId) => (isFeat(s) ? fLayerName(s, l) : layerName(s, l));
