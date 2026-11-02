// Khung thiết bị 3D: viền mảnh theo % bề ngang máy, xoay rotateX/Y/Z có phối cảnh, thân dày giả bằng các lớp xếp chồng
// Mọi kích thước dùng em của slide (1em = 1% bề ngang slide) để xem trước và xuất ảnh ra cùng một kết quả
import type { CSSProperties, ReactNode } from "react";
import type { Kind, Store, Theme, Tilt3D } from "@/lib/types";
import { FRAME_COLORS } from "@/lib/presets";
import { resolveFrame } from "@/lib/rules";

export const ASPECT: Record<Kind, number> = { phone: 2.17, tablet: 1.38 };

interface Props extends Tilt3D {
  w: number; // bề ngang máy (em)
  x: number;
  y: number;
  kind: Kind;
  store: Store;
  theme: Theme;
  children: ReactNode;
  z?: number;
}

export function Device({ w, x, y, rx, ry, rz, kind, store, theme, children, z = 2 }: Props) {
  const frame = resolveFrame(theme.frame, store);
  const col = FRAME_COLORS[theme.frameColor];
  const h = w * ASPECT[kind];
  const bezel = frame === "none" ? 0 : (w * theme.bezel) / 100;
  const r = ((w * theme.radius) / 100) * (kind === "tablet" ? 0.55 : 1);
  const tilted = rx !== 0 || ry !== 0;
  const depth = (w * theme.depth) / 100;
  const layers = frame === "none" || !tilted ? 0 : 6;

  // Bóng đổ mềm, đậm nhạt theo theme.shadow
  const s = theme.shadow;
  const shadow = s ? `0 ${(w * s) / 700}em ${(w * s) / 220}em rgba(0,0,0,${0.12 + s / 260})` : "none";
  const plate: CSSProperties = { position: "absolute", inset: 0, borderRadius: `${r}em` };
  const mainShadow = [frame === "none" ? "" : `inset 0 0 0 ${w * 0.005}em ${col.edge}`, !layers && s ? shadow : ""].filter(Boolean).join(",") || "none";

  return (
    <div style={{ position: "absolute", left: `${x}em`, top: `${y}em`, width: `${w}em`, height: `${h}em`, perspective: `${w * 7}em`, zIndex: z }}>
      <div style={{ position: "relative", width: "100%", height: "100%", transformStyle: "preserve-3d", transform: `rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)` }}>
        {/* Thân máy: các lớp lùi dần theo trục Z, tạo cạnh dày khi nghiêng */}
        {Array.from({ length: layers }, (_, i) => (
          <div key={i} style={{ ...plate, background: col.side, transform: `translateZ(${-(depth * (i + 1)) / layers}em)`, boxShadow: i === layers - 1 ? shadow : "none" }} />
        ))}
        <div style={{ ...plate, padding: `${bezel}em`, background: frame === "none" ? "transparent" : col.body, boxShadow: mainShadow }}>
          <div className="scr" style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", borderRadius: `${Math.max(r - bezel, r * 0.2)}em`, background: "#fff", fontSize: `${w / 100}em` }}>
            {children}
            {frame === "iphone" && kind === "phone" && (
              <div style={{ position: "absolute", top: "2.2em", left: "50%", transform: "translateX(-50%)", width: "28em", height: "8em", borderRadius: "5em", background: "#000", zIndex: 3 }} />
            )}
            {frame === "pixel" && kind === "phone" && (
              <div style={{ position: "absolute", top: "2.6em", left: "50%", transform: "translateX(-50%)", width: "3.6em", height: "3.6em", borderRadius: "50%", background: "#000", zIndex: 3 }} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
