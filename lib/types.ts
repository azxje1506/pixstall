// Kiểu dữ liệu chung của Pixstall: dự án = slides + theme + feature graphic + cỡ máy tự thêm
export type Store = "ios" | "play";
export type Kind = "phone" | "tablet";

// Một cỡ ảnh xuất (preset của store hoặc user tự thêm)
export interface SizePreset {
  id: string;
  name: string;
  w: number;
  h: number;
  store: Store;
  kind: Kind;
  custom?: boolean;
}

export type Layout = "center" | "bleed" | "bottom" | "duo" | "offset";

// Góc xoay 3D của thiết bị (độ): rx = ngửa/cúi, ry = xoay trái/phải, rz = nghiêng phẳng
export interface Tilt3D {
  rx: number;
  ry: number;
  rz: number;
}

export interface Slide extends Tilt3D {
  id: string;
  t: Record<string, [string, string]>; // locale -> [tiêu đề, phụ đề]
  layout: Layout;
  scale: number; // bề ngang máy, % bề ngang slide
  img: string | null; // dataURL ảnh chụp; null = dùng màn mẫu
  mock: number; // số màn mẫu khi chưa có ảnh
  // Dời vị trí khi kéo trên canvas (em = % bề ngang slide); thiếu = 0 (dự án cũ)
  dx?: number; dy?: number; // máy
  tx?: number; ty?: number; // khối chữ
  front?: "text" | "device"; // phần nào nằm trên (mặc định chữ trên máy)
}

export type FrameStyle = "auto" | "iphone" | "pixel" | "none";
export type FrameColor = "black" | "titanium" | "silver" | "white";
export type Bg = "color" | "gradient" | "panorama" | "blur";

export interface Theme {
  frame: FrameStyle;
  frameColor: FrameColor;
  bezel: number; // độ dày viền máy, % bề ngang máy
  radius: number; // bo góc máy, % bề ngang máy
  shadow: number; // 0..60
  depth: number; // độ dày thân máy khi nghiêng 3D, % bề ngang máy
  bg: Bg;
  c1: string;
  c2: string;
  solid: string;
  blur: number;
  overlay: number;
  font: string;
  tsize: number; // cỡ tiêu đề, % bề ngang slide
  align: "left" | "center";
  ink: "light" | "dark";
}

export interface Feature extends Tilt3D {
  name: string;
  tagline: string;
  icon: string;
  device: boolean;
  scale: number;
  dx?: number; dy?: number; // dời cụm máy (em)
  tx?: number; ty?: number; // dời khối icon + chữ (em)
  front?: "text" | "device";
}

export interface Project {
  store: Store;
  sizeId: string;
  loc: string;
  slides: Slide[];
  theme: Theme;
  feature: Feature;
  customSizes: SizePreset[];
}
