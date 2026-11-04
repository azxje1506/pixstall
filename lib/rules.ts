// Hàm tiện ích: lấy cỡ máy đang chọn, chọn khung theo store, kiểm tra luật store trước khi xuất
import type { Project, SizePreset, Store, FrameStyle, Slide } from "./types";
import { STORE_SIZES, LIMIT, LOCALES, APPLE_ACCEPTED } from "./presets";

export const allSizes = (p: Project): SizePreset[] => [...STORE_SIZES, ...p.customSizes];
export const sizesOf = (p: Project, store: Store) => allSizes(p).filter((z) => z.store === store);
export const currentSize = (p: Project): SizePreset =>
  allSizes(p).find((z) => z.id === p.sizeId) ?? sizesOf(p, p.store)[0];

// "auto" = iPhone cho App Store, Pixel cho Google Play
export const resolveFrame = (f: FrameStyle, store: Store): Exclude<FrameStyle, "auto"> =>
  f === "auto" ? (store === "ios" ? "iphone" : "pixel") : f;

// Chữ của slide theo ngôn ngữ, thiếu thì lấy tiếng Anh
export const textOf = (s: Slide, loc: string): [string, string] => s.t[loc] ?? s.t.en ?? ["", ""];

// Cỡ máy tự thêm có hợp luật store không
export function sizeWarnings(z: SizePreset): string[] {
  const out: string[] = [];
  const lo = Math.min(z.w, z.h), hi = Math.max(z.w, z.h);
  if (z.store === "play") {
    if (lo < 320 || hi > 3840) out.push("Google Play needs each side between 320 and 3840 px");
    if (hi > lo * 2) out.push("Google Play: long side can't exceed 2× the short side");
  } else if (!APPLE_ACCEPTED.some(([w, h]) => (w === z.w && h === z.h) || (h === z.w && w === z.h))) {
    out.push("App Store only accepts exact device sizes — this custom size may be rejected");
  }
  return out;
}

export type Issue = { level: "ok" | "warn"; msg: string; slide?: number }; // slide = index để bấm nhảy tới

export function checkProject(p: Project): Issue[] {
  const out: Issue[] = [];
  const n = p.slides.length, [mn, mx] = LIMIT[p.store], z = currentSize(p);
  const storeName = p.store === "ios" ? "App Store" : "Google Play";
  if (n < mn) out.push({ level: "warn", msg: `${storeName} needs at least ${mn} screenshots` });
  if (n > mx) out.push({ level: "warn", msg: `${storeName} allows max ${mx} — ${n - mx} will be skipped` });
  p.slides.forEach((s, i) => {
    const [title] = textOf(s, p.loc);
    if (title.length > 34) out.push({ level: "warn", msg: `Slide ${i + 1}: headline is long, may wrap to 3+ lines`, slide: i });
    if (!title.trim()) out.push({ level: "warn", msg: `Slide ${i + 1}: headline is empty`, slide: i });
  });
  if (p.loc !== "en") {
    const miss = p.slides.filter((s) => !s.t[p.loc]).length;
    const first = p.slides.findIndex((s) => !s.t[p.loc]);
    if (miss) out.push({ level: "warn", msg: `${miss} slide(s) not translated to ${LOCALES[p.loc]}`, slide: first });
  }
  if (z.custom) sizeWarnings(z).forEach((m) => out.push({ level: "warn", msg: m }));
  if (!out.length) out.push({ level: "ok", msg: `${Math.min(n, mx)} screenshots · ${z.w}×${z.h}` });
  if (p.store === "play") out.push({ level: "ok", msg: "Feature graphic 1024×500 included" });
  return out;
}
