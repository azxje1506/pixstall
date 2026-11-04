// Hàm tiện ích: lấy cỡ máy đang chọn, chọn khung theo store, kiểm tra luật store trước khi xuất
import type { Project, SizePreset, Store, FrameStyle, Slide, Theme } from "./types";
import { STORE_SIZES, LIMIT, LOCALES, APPLE_ACCEPTED } from "./presets";

export const allSizes = (p: Project): SizePreset[] => [...STORE_SIZES, ...p.customSizes];
export const sizesOf = (p: Project, store: Store) => allSizes(p).filter((z) => z.store === store);
export const currentSize = (p: Project): SizePreset =>
  allSizes(p).find((z) => z.id === p.sizeId) ?? sizesOf(p, p.store)[0];

// "auto" = iPhone cho App Store, Pixel cho Google Play
export const resolveFrame = (f: FrameStyle, store: Store): Exclude<FrameStyle, "auto"> =>
  f === "auto" ? (store === "ios" ? "iphone" : "pixel") : f;

// Style thực tế của một slide = Project style + phần slide đè lên
export const themeOf = (p: Project, s?: Slide): Theme => (s?.override ? { ...p.theme, ...s.override } : p.theme);
// Tách "Build habits that *stick*" → [["Build habits that ", false], ["stick", true]] để tô màu từ nhấn
export const richParts = (str: string): [string, boolean][] => str.split(/(\*[^*]+\*)/g).filter(Boolean).map((x) => (/^\*[^*]+\*$/.test(x) ? [x.slice(1, -1), true] : [x, false]));
export const plain = (str: string) => str.replace(/\*([^*]+)\*/g, "$1");

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

// Độ tương phản WCAG giữa 2 màu HEX (1..21); dùng để cảnh báo chữ khó đọc trên nền 1 màu
const lum = (hex: string) => {
  const m = hex.replace("#", "");
  const c = [0, 2, 4].map((i) => parseInt(m.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
export const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

export function checkProject(p: Project): Issue[] {
  const out: Issue[] = [];
  const n = p.slides.length, [mn, mx] = LIMIT[p.store], z = currentSize(p);
  const storeName = p.store === "ios" ? "App Store" : "Google Play";
  if (n < mn) out.push({ level: "warn", msg: `${storeName} needs at least ${mn} screenshots` });
  if (n > mx) out.push({ level: "warn", msg: `${storeName} allows max ${mx} — ${n - mx} will be skipped` });
  p.slides.forEach((s, i) => {
    const title = plain(textOf(s, p.loc)[0]);
    if (title.length > 34) out.push({ level: "warn", msg: `Slide ${i + 1}: headline is long, may wrap to 3+ lines`, slide: i });
    if (!title.trim()) out.push({ level: "warn", msg: `Slide ${i + 1}: headline is empty`, slide: i });
    // Chữ khó đọc: chỉ kiểm được khi nền là 1 màu (gradient/ảnh thì bỏ qua)
    const t = themeOf(p, s);
    if (t.bg === "color" && !s.hidden?.text && contrast(t.tcolor || (t.ink === "light" ? "#FFFFFF" : "#15151A"), t.solid) < 3)
      out.push({ level: "warn", msg: `Slide ${i + 1}: text is hard to read on this background`, slide: i });
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
