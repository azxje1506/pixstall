// Template mẫu: bộ Project style dựng sẵn (khung máy + nền + chữ), áp vào dự án bằng 1 cú bấm
// Chỉ đổi theme (màu, khung, font) — KHÔNG đụng layout, chữ, ảnh, vị trí; áp xong xoá style riêng từng slide để cả bộ đồng nhất
// Thêm template mới: thêm 1 phần tử vào TEMPLATES (chỉ cần khai khoá khác DEFAULT_THEME)
import type { Project, Theme } from "./types";
import { DEFAULT_THEME } from "./presets";

// group: nhóm hiện trên panel — classic (4 mẫu gốc) · vivid (theo kit UI8 Digcy Kit 20) · cinematic (theo kit UI8 Magic Pro)
export type TplGroup = "classic" | "vivid" | "cinematic";
export interface Template { id: string; name: string; desc: string; group: TplGroup; theme: Theme }
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

// Áp template: thay theme + bỏ style riêng của mọi slide (1 bước undo do caller gói trong update)
export const applyTemplate = (d: Project, tpl: Template): Project => ({
  ...d, theme: { ...tpl.theme }, slides: d.slides.map((s) => (s.override ? { ...s, override: undefined } : s)),
});
