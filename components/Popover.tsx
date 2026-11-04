// Popover dùng chung toàn app — MỌI menu / bảng nổi đều đi qua đây, đừng tự định vị bằng toạ độ tay nữa
//
// • Popover        : khung nổi neo vào một Anchor (khung của nút, hoặc 1 điểm khi chuột phải). Vẽ qua portal vào khung .app,
//                    position fixed → không bị panel cha cắt (overflow). Tự đặt theo `placement`, hết chỗ thì tự lật/căn mép:
//                    - dọc: "bottom" thiếu chỗ thì lật lên trên (và ngược lại)
//                    - ngang: "start" (mép trái thẳng mép trái nút) tràn phải thì chuyển "end" (mép phải thẳng mép phải nút);
//                      "end" tràn trái thì chuyển "start"; cuối cùng kẹp trong màn hình (cách mép 8px)
//                    Tự đo lại khi nội dung đổi cỡ (ResizeObserver). Đóng khi: bấm ra ngoài · Esc · cuộn ngoài popover · đổi cỡ cửa sổ
// • Menu           : danh sách MenuItem (icon · nhãn · phím tắt · danger · disabled · "sep"); ↑↓ để chọn, Enter để bấm
// • PopoverButton  : nút + popover tự quản lý trạng thái mở (bấm lại để đóng); nút có class "open" + aria-expanded khi mở
// • MenuButton     : PopoverButton hiện Menu — items có thể là hàm (tính lúc mở)
// • ContextMenu    : Menu mở tại 1 điểm (chuột phải)
//
// Ví dụ:
//   <MenuButton className="gbtn" placement="bottom-end" items={() => addItems(i)}><Plus />Add text</MenuButton>
//   <PopoverButton className="chip" placement="bottom-center" popClass="tmenu" content={(close) => <Body onDone={close} />}>…</PopoverButton>
"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode, type RefObject, type KeyboardEvent as RKE } from "react";
import { createPortal } from "react-dom";

// --- Kiểu dữ liệu ---
export type Anchor = { left: number; top: number; right: number; bottom: number };
export type Placement = "bottom-start" | "bottom-end" | "bottom-center" | "top-start" | "top-end" | "top-center";
export type MenuItem = { label: string; icon?: ReactNode; kbd?: string; onClick: () => void; danger?: boolean; disabled?: boolean; on?: boolean } | "sep";

export const rectOf = (el: Element): Anchor => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; };
export const pointAnchor = (x: number, y: number): Anchor => ({ left: x, right: x, top: y, bottom: y });

// --- Tính vị trí: trả toạ độ góc trái trên + phía thực tế (sau khi lật) ---
const M = 8; // khoảng cách tối thiểu tới mép màn hình
function place(a: Anchor, w: number, h: number, placement: Placement, off: number) {
  const vw = window.innerWidth, vh = window.innerHeight;
  let [side, align] = placement.split("-") as ["bottom" | "top", "start" | "end" | "center"];
  let y: number;
  if (side === "bottom") {
    y = a.bottom + off;
    if (y + h > vh - M && a.top - off - h >= M) { side = "top"; y = a.top - off - h; }
  } else {
    y = a.top - off - h;
    if (y < M && a.bottom + off + h <= vh - M) { side = "bottom"; y = a.bottom + off; }
  }
  y = Math.min(Math.max(y, M), Math.max(M, vh - M - h));
  const xs = { start: a.left, end: a.right - w, center: (a.left + a.right) / 2 - w / 2 };
  let x = xs[align];
  if (x + w > vw - M) { x = xs.end; align = "end"; }
  if (x < M) { x = Math.max(xs.start, M); align = "start"; }
  x = Math.min(Math.max(x, M), Math.max(M, vw - M - w));
  return { x, y, side, align };
}

// --- Popover ---
export function Popover({ anchor, placement = "bottom-start", offset = 4, onClose, ignore, className = "", role = "dialog", label, minWidth, children }: {
  anchor: Anchor; placement?: Placement; offset?: number; onClose: () => void;
  ignore?: RefObject<Element | null>; // bấm vào phần tử này không tính là "bấm ra ngoài" (thường là nút mở) → để nút tự bật/tắt
  className?: string; role?: string; label?: string; minWidth?: number; children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<ReturnType<typeof place> | null>(null);
  const close = useRef(onClose); close.current = onClose;

  // Đo cỡ thật rồi đặt chỗ; nội dung đổi cỡ (vd bảng màu thêm "Recent") thì đặt lại
  const measure = useCallback(() => {
    const el = ref.current; if (!el) return;
    setPos(place(anchor, el.offsetWidth, el.offsetHeight, placement, offset));
  }, [anchor.left, anchor.top, anchor.right, anchor.bottom, placement, offset]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(measure, [measure]);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(measure); ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  // Đóng: bấm ra ngoài · Esc (chặn luôn để canvas không bỏ chọn) · cuộn bên ngoài · đổi cỡ cửa sổ
  useEffect(() => {
    const inside = (t: EventTarget | null) => !!t && (ref.current?.contains(t as Node) || !!ignore?.current?.contains(t as Node));
    const down = (e: PointerEvent) => { if (!inside(e.target)) close.current(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); close.current(); } };
    const scroll = (e: Event) => { if (!ref.current?.contains(e.target as Node)) close.current(); };
    const resize = () => close.current();
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("keydown", key, true);
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("pointerdown", down, true); window.removeEventListener("keydown", key, true);
      window.removeEventListener("scroll", scroll, true); window.removeEventListener("resize", resize);
    };
  }, [ignore]);

  if (typeof document === "undefined") return null;
  // Vẽ vào trong khung .app (không phải body) để ăn đủ style có tiền tố ".app …" (cỡ icon, màu…); .app không có transform nên position fixed vẫn tính theo màn hình
  return createPortal(
    <div ref={ref} className={`pop ${className}`} role={role} aria-label={label} data-side={pos?.side} data-align={pos?.align}
      // Chưa đo xong: ẩn bằng opacity (KHÔNG dùng visibility:hidden — phần tử bị ẩn kiểu đó không nhận focus được, Menu sẽ mất focus)
      style={{ left: pos?.x ?? -9999, top: pos?.y ?? 0, opacity: pos ? undefined : 0, pointerEvents: pos ? undefined : "none", minWidth }}
      onContextMenu={(e) => e.preventDefault()}>
      {children}
    </div>,
    document.querySelector(".app") ?? document.body,
  );
}

// --- Menu: danh sách lệnh; ↑↓ di chuyển (vòng tròn), Enter/Space bấm (mặc định của nút) ---
// Mở ra là nhận focus (khung, chưa chọn mục nào) → ↓ vào mục đầu, ↑ vào mục cuối; Esc do Popover đóng
export function Menu({ items, onDone }: { items: MenuItem[]; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.focus({ preventScroll: true }); }, []);
  const key = (e: RKE<HTMLDivElement>) => {
    e.stopPropagation(); // không để phím mũi tên lọt ra canvas (nhích layer)
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const bs = [...ref.current!.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
    const i = bs.indexOf(document.activeElement as HTMLButtonElement), d = e.key === "ArrowDown" ? 1 : -1;
    bs[i < 0 ? (d > 0 ? 0 : bs.length - 1) : (i + d + bs.length) % bs.length]?.focus();
  };
  return (
    <div ref={ref} className="mlist" tabIndex={-1} onKeyDown={key}>
      {items.map((it, i) => it === "sep" ? <div key={i} className="csep" role="separator" /> : (
        <button key={i} role="menuitem" className={`${it.danger ? "danger" : ""} ${it.on ? "on" : ""}`} disabled={it.disabled}
          onClick={() => { it.onClick(); onDone(); }}>
          <span className="cico">{it.icon}</span>
          <span className="clab">{it.label}</span>
          {it.kbd && <kbd>{it.kbd}</kbd>}
        </button>
      ))}
    </div>
  );
}

// --- Nút mở popover (tự giữ trạng thái mở) ---
type BtnProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "content">;
export function PopoverButton({ content, placement = "bottom-start", offset, popClass, popRole = "dialog", popLabel, popMinWidth, onOpenChange, className = "", children, onClick, ...rest }: BtnProps & {
  content: (close: () => void) => ReactNode; placement?: Placement; offset?: number;
  popClass?: string; popRole?: string; popLabel?: string; popMinWidth?: number; onOpenChange?: (open: boolean) => void;
}) {
  const btn = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const change = useRef(onOpenChange); change.current = onOpenChange;
  const close = useCallback(() => { setAnchor(null); change.current?.(false); }, []);
  return (
    <>
      <button ref={btn} type="button" {...rest} className={`${className} ${anchor ? "open" : ""}`} aria-expanded={!!anchor} aria-haspopup={popRole === "menu" ? "menu" : "dialog"}
        onClick={(e) => { onClick?.(e); if (anchor) close(); else { setAnchor(rectOf(btn.current!)); change.current?.(true); } }}>
        {children}
      </button>
      {anchor && (
        <Popover anchor={anchor} placement={placement} offset={offset} onClose={close} ignore={btn} className={popClass} role={popRole} label={popLabel} minWidth={popMinWidth}>
          {content(close)}
        </Popover>
      )}
    </>
  );
}

export function MenuButton({ items, menuWidth, ...p }: Omit<Parameters<typeof PopoverButton>[0], "content" | "popRole" | "popClass" | "popMinWidth"> & {
  items: MenuItem[] | (() => MenuItem[]); menuWidth?: number;
}) {
  return <PopoverButton {...p} popClass="cmenu" popRole="menu" popMinWidth={menuWidth}
    content={(close) => <Menu items={typeof items === "function" ? items() : items} onDone={close} />} />;
}

// --- Menu chuột phải: mở tại 1 điểm (đặt góc trái trên tại con trỏ, hết chỗ thì tự lật) ---
export function ContextMenu({ x, y, items, onClose, minWidth = 200 }: { x: number; y: number; items: MenuItem[]; onClose: () => void; minWidth?: number }) {
  return (
    <Popover anchor={pointAnchor(x, y)} placement="bottom-start" offset={0} onClose={onClose} className="cmenu" role="menu" minWidth={minWidth}>
      <Menu items={items} onDone={onClose} />
    </Popover>
  );
}
