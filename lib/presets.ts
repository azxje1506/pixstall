// Hằng số: cỡ ảnh store, giới hạn số ảnh, ngôn ngữ, font, màu khung máy, preset nghiêng 3D, dự án mẫu
import type { Project, SizePreset, Store, Theme, Tilt3D, FrameColor } from "./types";

// --- Cỡ ảnh store (kiểm lại spec mới nhất của Apple/Google trước khi phát hành) ---
export const STORE_SIZES: SizePreset[] = [
  { id: "ip69", name: 'iPhone 6.9"', w: 1320, h: 2868, store: "ios", kind: "phone" },
  { id: "ip65", name: 'iPhone 6.5"', w: 1284, h: 2778, store: "ios", kind: "phone" },
  { id: "ip61", name: 'iPhone 6.1"', w: 1179, h: 2556, store: "ios", kind: "phone" },
  { id: "ipad13", name: 'iPad 13"', w: 2064, h: 2752, store: "ios", kind: "tablet" },
  { id: "ph", name: "Phone", w: 1080, h: 1920, store: "play", kind: "phone" },
  { id: "phqhd", name: "Phone QHD", w: 1440, h: 2560, store: "play", kind: "phone" },
  { id: "tab7", name: 'Tablet 7"', w: 1200, h: 1920, store: "play", kind: "tablet" },
  { id: "tab10", name: 'Tablet 10"', w: 1600, h: 2560, store: "play", kind: "tablet" },
];
// Các cỡ Apple chấp nhận (dùng để kiểm cỡ tự thêm)
export const APPLE_ACCEPTED: [number, number][] = [
  [1320, 2868], [1290, 2796], [1284, 2778], [1242, 2688], [1206, 2622], [1179, 2556], [1242, 2208],
  [2064, 2752], [2048, 2732], [1668, 2388], [1640, 2360], [1488, 2266],
];
export const FEATURE_SIZE = { w: 1024, h: 500 };

// Số ảnh tối thiểu / tối đa mỗi store
export const LIMIT: Record<Store, [number, number]> = { ios: [1, 10], play: [2, 8] };

export const LOCALES: Record<string, string> = {
  en: "English", vi: "Tiếng Việt", ja: "日本語", es: "Español", de: "Deutsch", fr: "Français", pt: "Português", ko: "한국어",
};

// Tên font -> biến CSS do next/font sinh ra (khai trong app/layout.tsx)
// Sau font chính là font hệ thống cho chữ Nhật/Hàn/Trung (font Latin không có) → không rơi về font có chân mặc định
const CJK = `"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", "Apple SD Gothic Neo", "Malgun Gothic", "PingFang SC", "Microsoft YaHei", "Noto Sans CJK JP", "Noto Sans JP", sans-serif`;
export const FONTS: Record<string, string> = {
  Inter: `var(--font-inter), ${CJK}`,
  "Plus Jakarta Sans": `var(--font-jakarta), ${CJK}`,
  "Space Grotesk": `var(--font-grotesk), ${CJK}`,
  Nunito: `var(--font-nunito), ${CJK}`,
  "DM Serif Display": `var(--font-serif), "Hiragino Mincho ProN", "Yu Mincho", serif`,
};

// Màu thân máy: body = viền màn, edge = chỉ sáng mép, side = thân dày khi xoay 3D
export const FRAME_COLORS: Record<FrameColor, { body: string; edge: string; side: string; label: string }> = {
  black: { body: "#0B0B0D", edge: "rgba(255,255,255,.14)", side: "#1C1C20", label: "Black" },
  titanium: { body: "#2B2A2E", edge: "rgba(255,255,255,.22)", side: "#5C5A60", label: "Titanium" },
  silver: { body: "#E3E4E8", edge: "rgba(0,0,0,.10)", side: "#B9BAC0", label: "Silver" },
  white: { body: "#FFFFFF", edge: "rgba(0,0,0,.08)", side: "#D9DADF", label: "White" },
};

// Preset nghiêng 3D bấm nhanh
export const TILT_PRESETS: { id: string; label: string; v: Tilt3D }[] = [
  { id: "flat", label: "Flat", v: { rx: 0, ry: 0, rz: 0 } },
  { id: "left", label: "Turn left", v: { rx: 4, ry: 24, rz: 0 } },
  { id: "right", label: "Turn right", v: { rx: 4, ry: -24, rz: 0 } },
  { id: "back", label: "Lean back", v: { rx: 24, ry: 0, rz: 0 } },
  { id: "hero", label: "Hero", v: { rx: 16, ry: -20, rz: 6 } },
  { id: "float", label: "Float", v: { rx: 10, ry: 14, rz: -8 } },
];

export const GRADIENTS: [string, string][] = [
  ["#5B5BF0", "#A78BFA"], ["#FF7A59", "#FFC371"], ["#0EA5E9", "#22D3EE"],
  ["#10B981", "#A3E635"], ["#111827", "#4B5563"], ["#EC4899", "#8B5CF6"],
];

export const DEFAULT_THEME: Theme = {
  frame: "auto", frameColor: "black", bezel: 2.4, radius: 13, shadow: 28, depth: 3,
  bg: "panorama", c1: "#5B5BF0", c2: "#A78BFA", solid: "#F1F0FF", blur: 14, overlay: 35,
  font: "Inter", tsize: 8.5, align: "center", ink: "light",
  tweight: 800, tlh: 1.08, tcolor: "", hl: "#FDE68A", ssize: 0.48,
};

let n = 0;
export const uid = () => `s${Date.now().toString(36)}${(n++).toString(36)}`;

// Dự án mẫu "Bloom" để user thấy ngay kết quả
export function sampleProject(): Project {
  const s = (t: Record<string, [string, string]>, layout: Project["slides"][0]["layout"], mock: number, tilt: Partial<Tilt3D> = {}, scale = 76) =>
    ({ id: uid(), t, layout, mock, scale, img: null, rx: 0, ry: 0, rz: 0, ...tilt });
  return {
    store: "ios", sizeId: "ip69", loc: "en", customSizes: [],
    theme: { ...DEFAULT_THEME },
    feature: { name: "Bloom", tagline: "Tiny habits. Big you.", icon: "sprout", device: true, scale: 17, rx: 10, ry: -22, rz: 4 },
    slides: [
      s({ en: ["Build habits that stick", "Plan your day in seconds"], vi: ["Xây thói quen bền vững", "Lên kế hoạch trong vài giây"] }, "center", 0),
      s({ en: ["See your week at a glance", "Clear stats, zero clutter"], vi: ["Cả tuần trong một cái nhìn", "Số liệu rõ, không rối"] }, "bleed", 1, { rx: 14, ry: -20, rz: 4 }, 74),
      s({ en: ["Never break the streak", "Gentle reminders that work"] }, "offset", 2, { ry: 18 }, 80),
      s({ en: ["Focus mode", "Deep work, one tap away"] }, "duo", 3),
      s({ en: ["Reflect every evening", "A private daily journal"] }, "bottom", 4, { rx: 20 }, 78),
      s({ en: ["Go Pro, grow faster", "Unlimited habits & themes"] }, "center", 5, { ry: -14 }),
    ],
  };
}
