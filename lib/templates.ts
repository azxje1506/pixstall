// Template mẫu: bộ Project style dựng sẵn (khung máy + nền + chữ), áp vào dự án bằng 1 cú bấm
// Chỉ đổi theme (màu, khung, font) — KHÔNG đụng layout, chữ, ảnh, vị trí; áp xong xoá style riêng từng slide để cả bộ đồng nhất
// Thêm template mới: thêm 1 phần tử vào TEMPLATES (chỉ cần khai khoá khác DEFAULT_THEME)
import type { Project, Theme } from "./types";
import { DEFAULT_THEME } from "./presets";

export interface Template { id: string; name: string; desc: string; theme: Theme }

const mk = (id: string, name: string, desc: string, t: Partial<Theme>): Template => ({ id, name, desc, theme: { ...DEFAULT_THEME, ...t } });

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
