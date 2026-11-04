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
  img: string | null; // "img:<id>" trong kho ảnh (lib/images.ts) hoặc dataURL cũ; null = dùng màn mẫu
  imgs?: Record<string, string>; // ảnh riêng theo ngôn ngữ (locale -> img ref), đè lên img khi xem/xuất ngôn ngữ đó
  // Căn ảnh trong màn hình máy: fit = cover (Fill) / contain (Fit); ix,iy = dời ảnh (% cỡ màn); iz = phóng (1..3)
  fit?: "fill" | "fit"; ix?: number; iy?: number; iz?: number;
  // Máy thứ 2 (layout Duo): img2 = ảnh riêng (thiếu = lấy ảnh slide kế tiếp), bx,by = dời (em), brz = nghiêng thêm so với rz (mặc định 6)
  img2?: string | null; bx?: number; by?: number; brz?: number;
  mock: number; // số màn mẫu khi chưa có ảnh
  // Dời vị trí khi kéo trên canvas (em = % bề ngang slide); thiếu = 0 (dự án cũ)
  dx?: number; dy?: number; // máy
  tx?: number; ty?: number; // tiêu đề (Headline)
  sx?: number; sy?: number; // phụ đề (Subtitle)
  extras?: TextItem[]; // layer chữ tự do
  front?: "text" | "device"; // phần nào nằm trên (mặc định chữ trên máy)
  hidden?: { title?: boolean; sub?: boolean; device?: boolean; device2?: boolean; text?: boolean }; // ẩn layer (cả lúc xuất); text = bản cũ, tự chuyển khi nạp
  override?: Partial<Theme>; // style riêng của slide này, đè lên Project style
  tw?: number; // bề ngang khối chữ (% slide); thiếu = theo layout
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
  tweight: number; // độ đậm tiêu đề (400..900)
  tlh: number; // giãn dòng tiêu đề (0.9..1.5)
  tcolor: string; // màu chữ tự chọn; "" = theo ink (trắng/đen)
  hl: string; // màu tô cho từ nằm trong *dấu sao*
  ssize: number; // cỡ phụ đề so với tiêu đề (0.3..0.8)
}

// Layer chữ tự do (thêm bằng "+ Add text"): vị trí tâm x,y (em), chữ theo ngôn ngữ
export interface TextItem {
  id: string;
  t: Record<string, string>; // locale -> nội dung (hỗ trợ *từ* để tô màu)
  x: number; y: number; // tâm khối chữ (em, so với góc trái trên slide)
  size: number; // em
  weight: number;
  color?: string; // "" / thiếu = theo màu chữ của slide
  pill?: boolean; // dạng nhãn viên thuốc (nền = màu tô)
  hidden?: boolean;
}

// Các khoá theme được phép đè riêng từng slide (khung máy, nền, chữ)
export type ThemeKey = keyof Theme;

export interface Feature extends Tilt3D {
  name: string;
  tagline: string;
  icon: string;
  device: boolean;
  scale: number;
  dx?: number; dy?: number; // dời cụm máy (em)
  tx?: number; ty?: number; // dời khối icon + chữ (em)
  front?: "text" | "device";
  iconImg?: string; // icon app thật (img ref); có thì thay icon Lucide
  layout?: "split" | "center" | "phones"; // chữ trái + máy phải · chữ giữa + 2 máy 2 bên · chỉ 3 máy
  shots?: string[]; // id slide cho từng máy (thiếu = slide theo thứ tự)
}

export interface Project {
  name?: string; // tên dự án (thanh trên + tên file ZIP); thiếu thì dùng tên app ở feature
  store: Store;
  sizeId: string;
  loc: string;
  slides: Slide[];
  theme: Theme;
  feature: Feature;
  customSizes: SizePreset[];
}
