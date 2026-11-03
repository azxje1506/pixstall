// Menu nổi dùng chung (chuột phải trên canvas/danh sách slide, menu mức zoom): đặt tại (x,y) toạ độ màn hình,
// tự lật vào trong nếu tràn mép; đóng khi click ra ngoài, Esc, cuộn hoặc đổi cỡ cửa sổ. "sep" = vạch ngăn
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export type MenuItem = { label: string; icon?: ReactNode; kbd?: string; onClick: () => void; danger?: boolean; disabled?: boolean; on?: boolean } | "sep";

export function ContextMenu({ x, y, items, onClose, minWidth = 200 }: { x: number; y: number; items: MenuItem[]; onClose: () => void; minWidth?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  useLayoutEffect(() => {
    const r = ref.current!.getBoundingClientRect();
    setPos({ x: Math.max(8, x + r.width > innerWidth - 8 ? x - r.width : x), y: Math.max(8, y + r.height > innerHeight - 8 ? y - r.height : y) });
  }, [x, y]);

  useEffect(() => {
    const down = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("keydown", key, true);
    window.addEventListener("resize", onClose);
    window.addEventListener("wheel", onClose, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", down, true); window.removeEventListener("keydown", key, true);
      window.removeEventListener("resize", onClose); window.removeEventListener("wheel", onClose);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="cmenu" role="menu" style={{ left: pos.x, top: pos.y, minWidth }} onContextMenu={(e) => e.preventDefault()}>
      {items.map((it, i) => it === "sep" ? <div key={i} className="csep" /> : (
        <button key={i} role="menuitem" className={`${it.danger ? "danger" : ""} ${it.on ? "on" : ""}`} disabled={it.disabled}
          onClick={() => { it.onClick(); onClose(); }}>
          <span className="cico">{it.icon}</span>
          <span className="clab">{it.label}</span>
          {it.kbd && <kbd>{it.kbd}</kbd>}
        </button>
      ))}
    </div>
  );
}
