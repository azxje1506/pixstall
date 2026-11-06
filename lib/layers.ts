// Layer trên một slide / feature graphic: id, tên hiển thị, vị trí (để kéo & nhích phím), ẩn/hiện, thêm/xoá layer chữ
// Id layer: "title" (Headline) · "sub" (Subtitle) · "device" · "device2" (máy thứ 2, chỉ layout Duo) · "x:<id>" (chữ tự do) · "d:<id>" (hình trang trí, chỉ slide)
// Feature graphic: "icon" · "title" (tên app) · "sub" (tagline) · "x:<id>" · "device"/"device2"/"device3" (máy 1/2/3) — hàm f*
// posOf / withPos tự nhận ra slide hay feature (isFeat)
import type { Deco, Feature, LayerGroup, PhoneCfg, Slide, TextItem } from "./types";
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

// Dời nhiều layer một lúc: áp withPos lần lượt lên bản tạm của holder rồi gộp patch
// (cần vì nhiều hình trang trí / chữ tự do cùng nằm trong một mảng decos/extras — ghi rời sẽ đè nhau)
export function posPatch(s: Slide | Feature, items: (readonly [LayerId, number, number])[]): Record<string, unknown> {
  let cur = s; const out: Record<string, unknown> = {};
  for (const [l, x, y] of items) { const pt = withPos(cur, l, x, y); Object.assign(out, pt); cur = { ...cur, ...pt } as typeof s; }
  return out;
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
  for (const d of s.decos ?? []) out.push({ id: `d:${d.id}`, name: decoDef(d.kind).name, sub: "Decoration" });
  out.push({ id: "device", name: "Device", sub: s.img ? "Screenshot" : "Sample" });
  if (s.layout === "duo") out.push({ id: "device2", name: "Device 2", sub: s.img2 ? "Own screenshot" : `Linked · slide ${String(next ?? 0).padStart(2, "0")}` });
  const st = stackOf(s); // xếp theo thứ tự lớp: trên cùng trước
  return out.sort((a, b) => st.indexOf(a.id) - st.indexOf(b.id));
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

// ===================== Nhóm layer (Group) =====================
// Holder = slide hoặc feature (cùng có groups/extras/decos). Hàm trả patch { groups } để đưa vào onPatch / update
type GHolder = { groups?: LayerGroup[]; extras?: TextItem[]; decos?: Deco[] };
export const groupsOf = (h: GHolder): LayerGroup[] => h.groups ?? [];
export const groupOf = (h: GHolder, l: LayerId): LayerGroup | undefined => groupsOf(h).find((g) => g.ids.includes(l));
export const groupById = (h: GHolder, id: string | null | undefined) => (id ? groupsOf(h).find((g) => g.id === id) : undefined);
// Mở rộng danh sách chọn: layer nằm trong nhóm → kéo theo cả nhóm (trừ nhóm đang "vào trong" enter)
export function expandGroups(h: GHolder, ls: LayerId[], enter?: string | null): LayerId[] {
  const out: LayerId[] = [];
  for (const l of ls) { const g = groupOf(h, l); for (const x of g && g.id !== enter ? (g.ids as LayerId[]) : [l]) if (!out.includes(x)) out.push(x); }
  return out;
}
// Nhóm có đúng tập layer ls (không phân biệt thứ tự) — để biết đang chọn "cả nhóm"
export const groupExact = (h: GHolder, ls: LayerId[]) => groupsOf(h).find((g) => g.ids.length === ls.length && g.ids.every((x) => ls.includes(x as LayerId)));
// Bỏ id không còn tồn tại (chữ tự do / trang trí đã xoá) và nhóm còn < 2 layer
export function pruneGroups(h: GHolder): LayerGroup[] | undefined {
  const alive = (l: string) => l.startsWith("x:") ? !!h.extras?.some((x) => x.id === l.slice(2)) : l.startsWith("d:") ? !!h.decos?.some((d) => d.id === l.slice(2)) : true;
  const gs = groupsOf(h).map((g) => ({ ...g, ids: g.ids.filter(alive) })).filter((g) => g.ids.length > 1);
  return gs.length ? gs : undefined;
}
// Gom ls thành nhóm mới (layer đang ở nhóm khác thì rút ra); tên mặc định "Group N"
export function makeGroup(h: GHolder, ls: LayerId[], id: string): { groups: LayerGroup[] } {
  const rest = groupsOf(h).map((g) => ({ ...g, ids: g.ids.filter((x) => !ls.includes(x as LayerId)) })).filter((g) => g.ids.length > 1);
  let n = groupsOf(h).length + 1; while (groupsOf(h).some((g) => g.name === `Group ${n}`)) n++;
  return { groups: [...rest, { id, name: `Group ${n}`, ids: [...ls] }] };
}
export const ungroup = (h: GHolder, id: string): { groups: LayerGroup[] | undefined } => { const gs = groupsOf(h).filter((g) => g.id !== id); return { groups: gs.length ? gs : undefined }; };
export const renameGroup = (h: GHolder, id: string, name: string) => ({ groups: groupsOf(h).map((g) => (g.id === id ? { ...g, name } : g)) });
// Cây Layers có nhóm: nhóm nằm ở vị trí layer con đầu tiên, các con xếp ngay dưới (depth 1)
export type TreeRow<R> = { kind: "group"; g: LayerGroup; depth: 0 } | { kind: "layer"; row: R; depth: 0 | 1; g?: LayerGroup };
export function treeOf<R extends { id: LayerId }>(h: GHolder, rows: R[]): TreeRow<R>[] {
  const out: TreeRow<R>[] = [], done = new Set<string>();
  for (const r of rows) {
    const g = groupOf(h, r.id);
    if (!g) { out.push({ kind: "layer", row: r, depth: 0 }); continue; }
    if (done.has(g.id)) continue;
    done.add(g.id);
    out.push({ kind: "group", g, depth: 0 });
    for (const c of rows) if (g.ids.includes(c.id)) out.push({ kind: "layer", row: c, depth: 1, g });
  }
  return out;
}
// Patch xoá/sửa layer kèm tỉa nhóm (layer đã mất thì rút khỏi nhóm, nhóm < 2 con thì giải tán)
export const withPrune = <T extends GHolder>(h: T, pt: Partial<T> | null): Partial<T> | null => (pt ? { ...pt, groups: pruneGroups({ ...h, ...pt }) } : null);

// ===================== Thứ tự lớp (z-order) — chỉ slide =====================
// Slide.order = danh sách LayerId, phần tử đầu nằm TRÊN CÙNG (giống cây Layers của Figma). Thiếu order → suy từ quy tắc cũ:
// trang trí "On top" (z7) > chữ (z3, hoặc z0 khi s.front = "device") > máy (z2) > máy 2 / trang trí "Behind" (z1); cùng z thì vẽ sau nằm trên.
// Layer chưa có trong order (mới thêm, template thêm) được chèn theo mức z cũ của nó. Thành viên một nhóm luôn đứng liền nhau
// (gom về chỗ thành viên cao nhất) — nhóm là một khối trong ngăn xếp như Figma
const ALL_FIXED: LayerId[] = ["title", "sub", "device", "device2"];
export function universeOf(s: Slide): LayerId[] {
  return [...ALL_FIXED, ...(s.extras ?? []).map((x) => `x:${x.id}` as LayerId), ...(s.decos ?? []).map((d) => `d:${d.id}` as LayerId)];
}
// Mức z cũ + thứ tự vẽ cũ → số so sánh (lớn = nằm trên)
function legacyRank(s: Slide): Map<LayerId, number> {
  const m = new Map<LayerId, number>(), zt = s.front === "device" ? 0 : 3;
  let dom = 0; const put = (l: LayerId, z: number) => m.set(l, z * 1000 + dom++);
  for (const d of s.decos ?? []) if (!d.front) put(`d:${d.id}`, 1);
  put("sub", zt); put("title", zt); // tiêu đề đứng trên phụ đề trong cây (hai khối không chồng nhau)
  for (const x of s.extras ?? []) put(`x:${x.id}`, zt);
  put("device2", 1); put("device", 2);
  for (const d of s.decos ?? []) if (d.front) put(`d:${d.id}`, 7);
  return m;
}
export function stackOf(s: Slide): LayerId[] {
  const all = universeOf(s), rank = legacyRank(s);
  const byLegacy = [...all].sort((a, b) => (rank.get(b) ?? 0) - (rank.get(a) ?? 0));
  let out: LayerId[];
  if (!s.order?.length) out = byLegacy;
  else {
    out = (s.order as LayerId[]).filter((l) => all.includes(l));
    for (const m of byLegacy) {
      if (out.includes(m)) continue;
      const z = rank.get(m) ?? 0, at = out.findIndex((x) => (rank.get(x) ?? 0) < z);
      out.splice(at < 0 ? out.length : at, 0, m);
    }
  }
  // Gom thành viên nhóm liền nhau tại chỗ thành viên cao nhất
  for (const g of s.groups ?? []) {
    const mem = out.filter((l) => g.ids.includes(l)); if (mem.length < 2) continue;
    const at = out.indexOf(mem[0]); out = out.filter((l) => !mem.includes(l)); out.splice(at, 0, ...mem);
  }
  return out;
}
// z-index cho từng layer khi vẽ: trên cùng = N … dưới cùng = 1
export function zMap(s: Slide): Record<string, number> {
  const st = stackOf(s), z: Record<string, number> = {};
  st.forEach((l, i) => { z[l] = st.length - i; });
  return z;
}
// Kéo thả trong cây Layers: đưa ids tới ngay trước/sau anchor; gid = nhóm đích (null = ra ngoài mọi nhóm, undefined = giữ nhóm cũ)
export function moveInStack(s: Slide, ids: LayerId[], anchor: { id: LayerId; after: boolean } | null, gid: string | null | undefined): Partial<Slide> {
  const st = stackOf(s), moving = st.filter((l) => ids.includes(l)), rest = st.filter((l) => !ids.includes(l));
  let at = anchor ? rest.indexOf(anchor.id) : rest.length;
  if (at < 0) at = rest.length; else if (anchor?.after) at++;
  rest.splice(at, 0, ...moving);
  let groups = s.groups;
  if (gid !== undefined) {
    groups = (s.groups ?? []).map((g) => ({ ...g, ids: g.id === gid ? [...g.ids.filter((x) => !ids.includes(x as LayerId)), ...ids] : g.ids.filter((x) => !ids.includes(x as LayerId)) }));
  }
  const pt: Partial<Slide> = { order: rest, groups };
  return { ...pt, groups: pruneGroups({ ...s, ...pt }) };
}
// Đưa lên/xuống: front/back = trên cùng/dưới cùng, forward/backward = vượt 1 khối. Đang chọn con trong nhóm → chỉ xếp giữa anh em trong nhóm;
// còn lại xếp theo khối cấp ngoài (nhóm = 1 khối)
export type ZOp = "front" | "forward" | "backward" | "back";
export function zPatch(s: Slide, ids: LayerId[], op: ZOp): Partial<Slide> | null {
  const st = stackOf(s), g = (s.groups ?? []).find((x) => ids.every((l) => x.ids.includes(l)) && ids.length < x.ids.length);
  // Khối: nhóm (không chứa ids) = 1 khối; trong ngữ cảnh nhóm g thì mỗi con là 1 khối
  const scope = g ? st.filter((l) => g.ids.includes(l)) : st;
  const units: LayerId[][] = [];
  for (const l of scope) {
    const gg = g ? undefined : (s.groups ?? []).find((x) => x.ids.includes(l));
    const key = ids.includes(l) ? "__sel" : gg ? gg.id : l;
    const last = units[units.length - 1];
    if (last && (last as unknown as { k?: string }).k === key && key !== l) last.push(l);
    else { const u = [l] as LayerId[] & { k?: string }; u.k = key; units.push(u); }
  }
  // Các khối đang chọn (có thể rời nhau) gộp thành 1 khối tại chỗ khối chọn đầu tiên
  const isSel = (u: LayerId[]) => (u as unknown as { k?: string }).k === "__sel";
  const si = units.findIndex(isSel); if (si < 0) return null;
  const sel = units.filter(isSel).flat();
  for (let i = units.length - 1; i >= 0; i--) if (isSel(units[i])) units.splice(i, 1);
  const to = op === "front" ? 0 : op === "back" ? units.length : op === "forward" ? Math.max(0, si - 1) : Math.min(units.length, si + 1);
  if (to === si) return null;
  units.splice(to, 0, sel);
  const flat = units.flat();
  const order = g ? (() => { const at = st.indexOf(scope[0]); const o = st.filter((l) => !scope.includes(l)); o.splice(at, 0, ...flat); return o; })() : flat;
  return { order };
}
