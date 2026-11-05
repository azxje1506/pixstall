// Kho hình trang trí (layer "d:<id>" trên slide): SVG tự vẽ, đổi màu được (c = màu chính, c2 = màu phụ)
// Mỗi hình: id · tên · nhóm · tỉ lệ cao/rộng (ar) · màu mặc định (theo theme: "hl" màu tô, "ink" màu chữ, "c2" màu nền 2, "#hex")
// Thêm hình mới: thêm 1 phần tử vào DECOS, svg trả chuỗi <svg viewBox="0 0 100 100*ar">; nhớ preserveAspectRatio mặc định
// Tự vẽ thay vì lấy file UI8: giấy phép UI8 cho dùng trong sản phẩm, KHÔNG cho phát lại asset để người khác chèn vào thiết kế của họ
import type { Theme } from "./types";

export type DecoGroup = "shapes" | "sparkle" | "lines" | "badges";
export const DECO_GROUPS: { id: DecoGroup; label: string }[] = [
  { id: "sparkle", label: "Sparkle" }, { id: "shapes", label: "Shapes" }, { id: "lines", label: "Lines & arrows" }, { id: "badges", label: "Badges" },
];
export type DefColor = "hl" | "ink" | "c2" | "white" | `#${string}`;
export interface DecoDef { id: string; name: string; group: DecoGroup; ar: number; def: DefColor; def2?: DefColor; svg: (c: string, c2: string) => string }

const S = (vb: string, body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="100%" height="100%" style="display:block;overflow:visible">${body}</svg>`;
const star = (cx: number, cy: number, r: number, k = 0.42, n = 5) =>
  Array.from({ length: n * 2 }, (_, i) => { const a = (Math.PI * i) / n - Math.PI / 2, rr = i % 2 ? r * k : r; return `${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`; }).join(" ");
// Lấp lánh 4 cánh (cong vào) — tâm cx,cy bán kính r
const spark = (cx: number, cy: number, r: number) => `M${cx} ${cy - r}C${cx + r * 0.12} ${cy - r * 0.12} ${cx + r * 0.12} ${cy - r * 0.12} ${cx + r} ${cy}C${cx + r * 0.12} ${cy + r * 0.12} ${cx + r * 0.12} ${cy + r * 0.12} ${cx} ${cy + r}C${cx - r * 0.12} ${cy + r * 0.12} ${cx - r * 0.12} ${cy + r * 0.12} ${cx - r} ${cy}C${cx - r * 0.12} ${cy - r * 0.12} ${cx - r * 0.12} ${cy - r * 0.12} ${cx} ${cy - r}Z`;
// Lá nguyệt quế: 1 nhánh (bên trái), lật ngang cho bên phải
const laurel = (c: string, flip = false) => {
  const leaves = Array.from({ length: 6 }, (_, i) => { const t = i / 5, y = 88 - t * 70, x = 30 - Math.sin(t * Math.PI) * 14; return `<ellipse cx="${x - 7}" cy="${y}" rx="8" ry="3.6" transform="rotate(${-35 - t * 30} ${x - 7} ${y})" fill="${c}"/><ellipse cx="${x + 5}" cy="${y - 5}" rx="7" ry="3.2" transform="rotate(${45 + t * 20} ${x + 5} ${y - 5})" fill="${c}"/>`; }).join("");
  return `<g${flip ? ' transform="translate(100 0) scale(-1 1)"' : ""}><path d="M34 94C14 70 14 40 30 12" fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round"/>${leaves}</g>`;
};

export const DECOS: DecoDef[] = [
  // --- Sparkle ---
  { id: "spark", name: "Sparkle", group: "sparkle", ar: 1, def: "hl", svg: (c) => S("0 0 100 100", `<path d="${spark(50, 50, 50)}" fill="${c}"/>`) },
  { id: "spark3", name: "Sparkles", group: "sparkle", ar: 1, def: "hl", svg: (c) => S("0 0 100 100", `<path d="${spark(38, 56, 38)}" fill="${c}"/><path d="${spark(80, 20, 18)}" fill="${c}"/><path d="${spark(84, 78, 11)}" fill="${c}" opacity=".8"/>`) },
  { id: "star", name: "Star", group: "sparkle", ar: 1, def: "hl", svg: (c) => S("0 0 100 100", `<polygon points="${star(50, 53, 50, 0.45)}" fill="${c}" stroke="${c}" stroke-width="6" stroke-linejoin="round"/>`) },
  { id: "rating", name: "5 stars", group: "sparkle", ar: 0.2, def: "#FFC93C", svg: (c) => S("0 0 100 20", [0, 1, 2, 3, 4].map((i) => `<polygon points="${star(10 + i * 20, 10.5, 9.2, 0.45)}" fill="${c}" stroke="${c}" stroke-width="1.2" stroke-linejoin="round"/>`).join("")) },
  { id: "confetti", name: "Confetti", group: "sparkle", ar: 1, def: "hl", def2: "white", svg: (c, c2) => S("0 0 100 100", `<rect x="8" y="14" width="14" height="6" rx="3" fill="${c}" transform="rotate(-30 15 17)"/><circle cx="62" cy="10" r="5" fill="${c2}"/><rect x="78" y="34" width="14" height="6" rx="3" fill="${c2}" transform="rotate(40 85 37)"/><circle cx="20" cy="62" r="4" fill="${c2}"/><rect x="44" y="44" width="12" height="5" rx="2.5" fill="${c}" transform="rotate(15 50 46)"/><polygon points="${star(84, 84, 8, 0.5)}" fill="${c}"/><rect x="18" y="86" width="12" height="5" rx="2.5" fill="${c}" transform="rotate(-60 24 88)"/><circle cx="56" cy="80" r="3.5" fill="${c}"/>`) },
  { id: "burst", name: "Burst", group: "sparkle", ar: 1, def: "hl", svg: (c) => S("0 0 100 100", `<polygon points="${star(50, 50, 50, 0.78, 14)}" fill="${c}"/>`) },
  // --- Shapes ---
  { id: "blob", name: "Blob", group: "shapes", ar: 0.9, def: "c2", svg: (c) => S("0 0 100 90", `<path d="M52 2C76 0 98 16 99 42C100 66 82 88 56 89C30 90 4 78 1 52C-2 26 24 4 52 2Z" fill="${c}"/>`) },
  { id: "circle", name: "Circle", group: "shapes", ar: 1, def: "white", svg: (c) => S("0 0 100 100", `<circle cx="50" cy="50" r="50" fill="${c}"/>`) },
  { id: "ring", name: "Ring", group: "shapes", ar: 1, def: "white", svg: (c) => S("0 0 100 100", `<circle cx="50" cy="50" r="44" fill="none" stroke="${c}" stroke-width="12"/>`) },
  { id: "dots", name: "Dot grid", group: "shapes", ar: 1, def: "white", svg: (c) => S("0 0 100 100", Array.from({ length: 25 }, (_, i) => `<circle cx="${10 + (i % 5) * 20}" cy="${10 + Math.floor(i / 5) * 20}" r="4.5" fill="${c}"/>`).join("")) },
  { id: "heart", name: "Heart", group: "shapes", ar: 0.9, def: "#FF5A7A", svg: (c) => S("0 0 100 90", `<path d="M50 88C20 66 0 48 0 26C0 10 12 0 27 0C37 0 45 6 50 14C55 6 63 0 73 0C88 0 100 10 100 26C100 48 80 66 50 88Z" fill="${c}"/>`) },
  { id: "pill", name: "Pill", group: "shapes", ar: 0.4, def: "white", svg: (c) => S("0 0 100 40", `<rect width="100" height="40" rx="20" fill="${c}"/>`) },
  { id: "cloud", name: "Cloud", group: "shapes", ar: 0.6, def: "white", svg: (c) => S("0 0 100 60", `<path d="M22 58C10 58 0 49 0 38C0 27 9 19 20 19C23 8 33 0 46 0C59 0 70 9 72 21C74 20 77 20 79 20C91 20 100 28 100 39C100 50 91 58 79 58Z" fill="${c}"/>`) },
  // --- Lines & arrows ---
  { id: "squiggle", name: "Squiggle", group: "lines", ar: 0.3, def: "hl", svg: (c) => S("0 0 100 30", `<path d="M4 18C14 4 22 4 30 15C38 26 46 26 54 15C62 4 70 4 78 15C84 23 90 24 96 14" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round"/>`) },
  { id: "swoosh", name: "Underline", group: "lines", ar: 0.18, def: "hl", svg: (c) => S("0 0 100 18", `<path d="M3 13C30 3 70 1 97 7" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round"/>`) },
  { id: "scribble", name: "Circle mark", group: "lines", ar: 0.62, def: "hl", svg: (c) => S("0 0 100 62", `<path d="M62 6C30 0 4 12 4 32C4 52 34 60 60 56C86 52 98 38 94 24C90 10 66 4 44 8" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round"/>`) },
  { id: "arrow", name: "Arrow", group: "lines", ar: 0.75, def: "ink", svg: (c) => S("0 0 100 75", `<path d="M8 8C14 44 42 64 84 60" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round"/><path d="M70 46L88 60L70 72" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`) },
  { id: "loop", name: "Loop arrow", group: "lines", ar: 0.7, def: "ink", svg: (c) => S("0 0 100 70", `<path d="M6 60C20 54 32 40 34 26C36 12 22 8 18 20C14 32 38 44 60 40C74 37 84 30 90 20" fill="none" stroke="${c}" stroke-width="4.5" stroke-linecap="round"/><path d="M78 18L91 18L88 31" fill="none" stroke="${c}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>`) },
  { id: "zigzag", name: "Zigzag", group: "lines", ar: 0.24, def: "white", svg: (c) => S("0 0 100 24", `<path d="M4 18L16 6L28 18L40 6L52 18L64 6L76 18L88 6L96 14" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`) },
  // --- Badges ---
  { id: "laurel", name: "Award", group: "badges", ar: 0.62, def: "ink", svg: (c) => S("0 0 100 62", `<g transform="scale(.62)">${laurel(c)}</g><g transform="translate(38 0) scale(.62)">${laurel(c, true)}</g>`) },
  { id: "award", name: "App of the Day", group: "badges", ar: 0.42, def: "ink", svg: (c) => S("0 0 100 42", `<g transform="translate(0 0) scale(.42)">${laurel(c)}</g><g transform="translate(58 0) scale(.42)">${laurel(c, true)}</g><text x="50" y="19" text-anchor="middle" font-family="inherit" font-weight="800" font-size="10" fill="${c}">APP OF</text><text x="50" y="31" text-anchor="middle" font-family="inherit" font-weight="800" font-size="10" fill="${c}">THE DAY</text>`) },
  { id: "new", name: "NEW sticker", group: "badges", ar: 1, def: "hl", def2: "#15151A", svg: (c, c2) => S("0 0 100 100", `<polygon points="${star(50, 50, 50, 0.82, 16)}" fill="${c}"/><text x="50" y="58" text-anchor="middle" font-family="inherit" font-weight="900" font-size="24" fill="${c2}" transform="rotate(-12 50 50)">NEW</text>`) },
  { id: "free", name: "FREE tag", group: "badges", ar: 0.42, def: "hl", def2: "#15151A", svg: (c, c2) => S("0 0 100 42", `<rect x="2" y="2" width="96" height="38" rx="19" fill="${c}"/><text x="50" y="28" text-anchor="middle" font-family="inherit" font-weight="900" font-size="20" letter-spacing="1" fill="${c2}">FREE</text>`) },
];
export const decoDef = (kind: string) => DECOS.find((d) => d.id === kind) ?? DECOS[0];

// Màu thật của hình theo theme (khi deco chưa đặt màu riêng)
export function decoColor(c: DefColor | undefined, t: Theme): string {
  const ink = t.tcolor || (t.ink === "light" ? "#FFFFFF" : "#15151A");
  if (!c || c === "hl") return t.hl;
  if (c === "ink") return ink;
  if (c === "c2") return t.c2;
  if (c === "white") return "#FFFFFF";
  return c;
}

// Bề ngang mặc định khi thêm (em = % bề ngang slide)
export const decoSize = (d: DecoDef) => d.id === "rating" ? 40 : d.id === "award" ? 44 : d.group === "sparkle" ? 14 : d.group === "badges" ? 22 : d.group === "lines" ? 30 : d.id === "dots" ? 18 : 26;
