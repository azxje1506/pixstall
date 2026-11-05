// Template mẫu: bộ Project style dựng sẵn (khung máy + nền + chữ), áp vào dự án bằng 1 cú bấm
// Chỉ đổi theme (màu, khung, font) — KHÔNG đụng layout, chữ, ảnh, vị trí; áp xong xoá style riêng từng slide để cả bộ đồng nhất
// Thêm template mới: thêm 1 phần tử vào TEMPLATES (chỉ cần khai khoá khác DEFAULT_THEME)
import type { Deco, Project, Theme } from "./types";
import { decoColor, type DefColor } from "./decos";
import { currentSize } from "./rules";
import { uid } from "./presets";
import { DEFAULT_THEME } from "./presets";

// group: nhóm hiện trên panel — classic (4 mẫu gốc) · vivid (theo kit UI8 Digcy Kit 20) · cinematic (theo kit UI8 Magic Pro)
export type TplGroup = "classic" | "vivid" | "cinematic";
// Bộ trang trí của template: mỗi phần tử là 1 "set"; slide i dùng set i % n (vòng sau lật ngang cho đỡ lặp)
// y = phần của chiều cao slide (0..1) để hợp cả máy dọc lẫn tablet; x, size = em (% bề ngang); màu thiếu = theo theme
export interface TplDeco { kind: string; x: number; y: number; size: number; rot?: number; color?: DefColor; color2?: DefColor; opacity?: number; front?: boolean }
export interface Template { id: string; name: string; desc: string; group: TplGroup; theme: Theme; decor?: TplDeco[][] }
export const TPL_GROUPS: { id: TplGroup; label: string }[] = [
  { id: "classic", label: "Classic" }, { id: "vivid", label: "Vivid" }, { id: "cinematic", label: "Cinematic" },
];

const mk = (id: string, name: string, desc: string, t: Partial<Theme>, group: TplGroup = "classic"): Template => ({ id, name, desc, group, theme: { ...DEFAULT_THEME, ...t } });

export const TEMPLATES: Template[] = [
  mk("minimal", "Minimal", "Soft gray, silver frame, calm type", {
    frame: "auto", frameColor: "silver", bezel: 2, radius: 13, shadow: 16, depth: 2,
    bg: "color", solid: "#F4F4F6", c1: "#F4F4F6", c2: "#E4E4EA",
    font: "Inter", tsize: 7.5, align: "center", ink: "dark", tweight: 600, tlh: 1.14, tcolor: "", hl: "#2563EB", ssize: 0.46,
  }),
  mk("bold", "Bold", "Hot gradient, huge left-aligned headline", {
    frame: "auto", frameColor: "black", bezel: 2.4, radius: 13, shadow: 42, depth: 4,
    bg: "gradient", c1: "#FF3D54", c2: "#FF9F1C", solid: "#FF3D54",
    font: "Space Grotesk", tsize: 10.5, align: "left", ink: "light", tweight: 900, tlh: 1, tcolor: "", hl: "#FFE14D", ssize: 0.4,
  }),
  mk("dark", "Dark", "Night panorama, titanium frame, glow accent", {
    frame: "auto", frameColor: "titanium", bezel: 2.4, radius: 13, shadow: 54, depth: 3,
    bg: "panorama", c1: "#07070F", c2: "#3730A3", solid: "#0B0B14",
    font: "Plus Jakarta Sans", tsize: 8, align: "center", ink: "light", tweight: 700, tlh: 1.1, tcolor: "", hl: "#A5B4FC", ssize: 0.48,
  }),
  mk("playful", "Playful", "Candy panorama, white frame, round & chunky", {
    frame: "auto", frameColor: "white", bezel: 3.2, radius: 17, shadow: 30, depth: 5,
    bg: "panorama", c1: "#FF8FB1", c2: "#FFD36E", solid: "#FFE4EC",
    font: "Plus Jakarta Sans", tsize: 9, align: "center", ink: "dark", tweight: 800, tlh: 1.04, tcolor: "#3B0764", hl: "#E11D48", ssize: 0.46,
  }),
  // --- Vivid: số liệu lấy từ file Figma "App Store Screenshot Template Kit 20" (Digcy) ---
  // Kit: tiêu đề Switzer/Nunito/Recoleta Bold cỡ ~15% bề ngang, giãn dòng 1.0, chữ phụ ~3.5–5.6%; máy bo 16.4%; bóng (0, 4.7%) blur 9.4% đen 15%
  // Font kit không có trên Google Fonts → thay gần nhất: Switzer→Inter, Recoleta→DM Serif Display, Nunito giữ nguyên
  mk("violet", "Violet Night", "Deep violet gradient, giant white headline", { frame: "auto", frameColor: "black", bezel: 2, radius: 16, shadow: 30, depth: 3,
    bg: "gradient", c1: "#BE00F8", c2: "#3D0092", solid: "#3D0092", font: "Inter", tsize: 11, align: "center", ink: "light", tweight: 800, tlh: 1, tcolor: "", hl: "#F9A8FF", ssize: 0.4 }, "vivid"),
  mk("candy", "Candy", "Purple → pink, round chunky type", { frame: "auto", frameColor: "black", bezel: 2, radius: 16, shadow: 30, depth: 3,
    bg: "gradient", c1: "#6938EF", c2: "#F472B6", solid: "#6938EF", font: "Nunito", tsize: 11, align: "center", ink: "light", tweight: 900, tlh: 1, tcolor: "", hl: "#FDE68A", ssize: 0.4 }, "vivid"),
  mk("tangerine", "Tangerine", "Warm orange, punchy white headline", { frame: "auto", frameColor: "black", bezel: 2, radius: 16, shadow: 30, depth: 3,
    bg: "gradient", c1: "#EF6820", c2: "#F38744", solid: "#EF6820", font: "Inter", tsize: 11, align: "center", ink: "light", tweight: 800, tlh: 1, tcolor: "", hl: "#FFF3B0", ssize: 0.4 }, "vivid"),
  mk("lemon", "Lemon", "Solid yellow, black type, high contrast", { frame: "auto", frameColor: "black", bezel: 2, radius: 16, shadow: 24, depth: 3,
    bg: "color", c1: "#FAC515", c2: "#EAAA08", solid: "#FAC515", font: "Inter", tsize: 11, align: "center", ink: "dark", tweight: 800, tlh: 1, tcolor: "#000000", hl: "#FFFFFF", ssize: 0.4 }, "vivid"),
  mk("forest", "Forest", "Green gradient, calm and confident", { frame: "auto", frameColor: "black", bezel: 2, radius: 16, shadow: 30, depth: 3,
    bg: "gradient", c1: "#26955C", c2: "#114B15", solid: "#114B15", font: "Inter", tsize: 11, align: "center", ink: "light", tweight: 800, tlh: 1, tcolor: "", hl: "#BEF264", ssize: 0.4 }, "vivid"),
  mk("lime", "Lime", "Fresh lime with deep green type", { frame: "auto", frameColor: "black", bezel: 2, radius: 16, shadow: 24, depth: 3,
    bg: "color", c1: "#BEF264", c2: "#A3E635", solid: "#BEF264", font: "Inter", tsize: 11, align: "center", ink: "dark", tweight: 800, tlh: 1, tcolor: "#052E1C", hl: "#7A5AF8", ssize: 0.4 }, "vivid"),
  mk("editorial", "Editorial", "Light gray, serif headline, sky accent", { frame: "auto", frameColor: "black", bezel: 2, radius: 16, shadow: 22, depth: 3,
    bg: "color", c1: "#F5F5F5", c2: "#E5E5E5", solid: "#F5F5F5", font: "DM Serif Display", tsize: 11, align: "center", ink: "dark", tweight: 400, tlh: 1, tcolor: "#000000", hl: "#38BDF8", ssize: 0.42 }, "vivid"),
  mk("sky", "Sky", "Aqua to sky blue, airy and light", { frame: "auto", frameColor: "silver", bezel: 2, radius: 16, shadow: 34, depth: 3,
    bg: "gradient", c1: "#A5F3FC", c2: "#38BDF8", solid: "#38BDF8", font: "Inter", tsize: 11, align: "center", ink: "light", tweight: 800, tlh: 1, tcolor: "", hl: "#0C4A6E", ssize: 0.4 }, "vivid"),
  // --- Cinematic: số liệu lấy từ file Figma "App Store Screenshot Premium Templates" (Magic Pro) ---
  // Kit: SF Pro Display Bold ~11.6% bề ngang (→ Inter 700), chữ phụ Regular ~5.3%, bóng đậm (0, .4%) blur 1% đen 65%; bảng màu theo style "Screenshot Template_1..6"
  mk("neon", "Neon Dusk", "Magenta to ultramarine, glowing night", { frame: "auto", frameColor: "titanium", bezel: 2.4, radius: 14, shadow: 46, depth: 4,
    bg: "panorama", c1: "#FF66FF", c2: "#0000C8", solid: "#000000", font: "Inter", tsize: 9.5, align: "center", ink: "light", tweight: 700, tlh: 1.1, tcolor: "", hl: "#88DDFF", ssize: 0.46 }, "cinematic"),
  mk("wine", "Wine", "Burgundy to rose, rich and moody", { frame: "auto", frameColor: "black", bezel: 2.4, radius: 14, shadow: 46, depth: 4,
    bg: "gradient", c1: "#8C2828", c2: "#E65377", solid: "#8C2828", font: "Inter", tsize: 9.5, align: "center", ink: "light", tweight: 700, tlh: 1.1, tcolor: "", hl: "#FFD5FC", ssize: 0.46 }, "cinematic"),
  mk("olive", "Olive Noir", "Near-black with olive highlight", { frame: "auto", frameColor: "titanium", bezel: 2.4, radius: 14, shadow: 50, depth: 4,
    bg: "color", c1: "#0D0D0D", c2: "#303030", solid: "#0D0D0D", font: "Inter", tsize: 9.5, align: "center", ink: "light", tweight: 700, tlh: 1.1, tcolor: "", hl: "#BCD08A", ssize: 0.46 }, "cinematic"),
  mk("amber", "Amber", "Golden orange, white frame, bright", { frame: "auto", frameColor: "white", bezel: 2.4, radius: 14, shadow: 40, depth: 4,
    bg: "color", c1: "#FDA932", c2: "#FFC107", solid: "#FDA932", font: "Inter", tsize: 9.5, align: "center", ink: "light", tweight: 700, tlh: 1.1, tcolor: "", hl: "#3C0E87", ssize: 0.46 }, "cinematic"),
];

// Template đang khớp với project theme (mọi khoá trùng) — để đánh dấu thẻ đang chọn
export const activeTemplate = (t: Theme): string | null => {
  const hit = TEMPLATES.find((x) => (Object.keys(x.theme) as (keyof Theme)[]).every((k) => String(x.theme[k]).toUpperCase() === String(t[k]).toUpperCase()));
  return hit?.id ?? null;
};

// Áp template: thay theme + bỏ style riêng của mọi slide + thay bộ trang trí của template cũ (giữ hình user tự thêm)
// Cả lần áp là 1 bước undo do caller gói trong update
export function applyTemplate(d: Project, tpl: Template): Project {
  const z = currentSize(d), hEm = (100 * z.h) / z.w, sets = tpl.decor ?? [];
  const col = (c?: DefColor) => (c ? decoColor(c, tpl.theme) : undefined);
  return {
    ...d, theme: { ...tpl.theme },
    slides: d.slides.map((s, i) => {
      const own = (s.decos ?? []).filter((x) => !x.tpl);
      const set = sets.length ? sets[i % sets.length] : [], flip = sets.length ? Math.floor(i / sets.length) % 2 === 1 : false;
      const add: Deco[] = set.map((x) => ({ id: uid(), kind: x.kind, size: x.size, x: flip ? 100 - x.x : x.x, y: Math.round(x.y * hEm * 10) / 10,
        rot: flip ? -(x.rot ?? 0) : x.rot ?? 0, color: col(x.color), color2: col(x.color2), opacity: x.opacity, front: x.front, tpl: true }));
      const decos = [...own, ...add];
      return { ...s, override: undefined, decos: decos.length ? decos : undefined };
    }),
  };
}

// --- Trang trí sẵn cho từng template (vị trí né khối chữ giữa và thân máy; nằm sau máy trừ huy hiệu) ---
const D = (kind: string, x: number, y: number, size: number, o: Partial<TplDeco> = {}): TplDeco => ({ kind, x, y, size, ...o });
const DECOR: Record<string, TplDeco[][]> = {
  minimal: [[D("dots", 87, 0.06, 13, { color: "#D4D4D8" })], [D("ring", 10, 0.9, 20, { color: "#E4E4E7" })]],
  bold: [[D("burst", 88, 0.07, 18, { rot: 12 }), D("zigzag", 13, 0.6, 20, { color: "white", opacity: 0.6 })], [D("arrow", 82, 0.25, 20, { color: "white", rot: -10 })]],
  dark: [[D("spark3", 86, 0.07, 15), D("spark", 9, 0.42, 7, { opacity: 0.7 })], [D("spark", 88, 0.5, 9), D("dots", 12, 0.9, 16, { color: "white", opacity: 0.25 })]],
  playful: [[D("blob", 92, 0.1, 30, { color: "white", opacity: 0.35 }), D("spark3", 12, 0.07, 13)], [D("heart", 87, 0.36, 13, { rot: 12 }), D("squiggle", 16, 0.88, 24)]],
  violet: [[D("spark3", 86, 0.07, 15, { color: "white" }), D("ring", 5, 0.5, 26, { color: "white", opacity: 0.2 })], [D("spark", 12, 0.08, 9, { color: "white" }), D("blob", 97, 0.8, 40, { color: "white", opacity: 0.12 })]],
  candy: [[D("heart", 88, 0.08, 13, { rot: 14, color: "white" }), D("confetti", 12, 0.3, 17)], [D("spark3", 86, 0.32, 13), D("squiggle", 15, 0.9, 24, { color: "white" })]],
  tangerine: [[D("burst", 88, 0.08, 17, { color: "white", opacity: 0.9 }), D("squiggle", 14, 0.56, 24, { color: "white" })], [D("circle", 93, 0.88, 36, { color: "white", opacity: 0.15 }), D("spark", 10, 0.08, 9, { color: "white" })]],
  lemon: [[D("rating", 50, 0.032, 28, { color: "#15151A" }), D("arrow", 85, 0.3, 17, { color: "#15151A", rot: -20 })], [D("new", 85, 0.3, 19, { color: "#15151A", color2: "#FAC515", rot: 8 })]],
  forest: [[D("spark3", 86, 0.07, 15, { color: "#BEF264" }), D("blob", 3, 0.62, 34, { color: "#BEF264", opacity: 0.18 })], [D("dots", 88, 0.33, 15, { color: "#BEF264", opacity: 0.6 })]],
  lime: [[D("burst", 86, 0.08, 17, { color: "#7A5AF8" }), D("squiggle", 14, 0.62, 24, { color: "#052E1C" })], [D("spark3", 12, 0.07, 13, { color: "#052E1C" }), D("ring", 92, 0.6, 24, { color: "#7A5AF8", opacity: 0.5 })]],
  editorial: [[D("spark", 88, 0.07, 9, { color: "#38BDF8" }), D("circle", 7, 0.7, 28, { color: "#38BDF8", opacity: 0.18 })], [D("loop", 84, 0.3, 19, { color: "#000000" })]],
  sky: [[D("cloud", 86, 0.07, 22, { color: "white", opacity: 0.9 }), D("cloud", 8, 0.46, 18, { color: "white", opacity: 0.6 })], [D("cloud", 14, 0.08, 20, { color: "white", opacity: 0.9 }), D("spark", 88, 0.6, 9, { color: "white" })]],
  neon: [[D("spark3", 86, 0.07, 15, { color: "#88DDFF" }), D("ring", 7, 0.62, 30, { color: "#FF66FF", opacity: 0.35 })], [D("spark", 12, 0.1, 9, { color: "#FF66FF" }), D("dots", 90, 0.86, 16, { color: "#88DDFF", opacity: 0.4 })]],
  wine: [[D("ring", 90, 0.08, 21, { color: "#FFD5FC", opacity: 0.5 }), D("spark", 10, 0.45, 8, { color: "#FFD5FC" })], [D("blob", 3, 0.88, 40, { color: "#FFD5FC", opacity: 0.12 })]],
  olive: [[D("spark3", 88, 0.07, 13, { color: "#BCD08A" }), D("ring", 6, 0.55, 26, { color: "#BCD08A", opacity: 0.3 })], [D("spark", 12, 0.07, 9, { color: "#BCD08A" }), D("dots", 92, 0.86, 16, { color: "#BCD08A", opacity: 0.35 })]],
  amber: [[D("burst", 88, 0.08, 19, { color: "white", opacity: 0.85 }), D("squiggle", 14, 0.6, 24, { color: "#3C0E87" })], [D("spark3", 12, 0.07, 13, { color: "white" })]],
};
// Hình ở dải trên (y < .15) dồn sát góc, phía trên tiêu đề (tiêu đề bắt đầu ~9em) để không đè chữ
const tuck = (x: TplDeco): TplDeco => (x.y < 0.15 && x.kind !== "rating" ? { ...x, y: 0.032, x: x.x > 50 ? 92 : 8, size: Math.min(x.size, 12) } : x);
for (const t of TEMPLATES) t.decor = DECOR[t.id]?.map((set) => set.map(tuck));
