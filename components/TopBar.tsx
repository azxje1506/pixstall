// Thanh trên: logo · tên dự án (sửa tại chỗ) · trạng thái lưu · menu Target (store + cỡ máy gộp 1 nút) · ngôn ngữ · kiểu xem
// · undo/redo · phím tắt · sáng/tối · Export
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Keyboard, Ruler, Cloud, CloudAlert, LoaderCircle, Apple, Play, Smartphone, Tablet, Languages, GalleryHorizontal, Square, Undo2, Redo2, Sun, Moon, Download } from "lucide-react";
import type { Project, Store } from "@/lib/types";
import { LOCALES } from "@/lib/presets";
import { currentSize, sizesOf } from "@/lib/rules";
import { Seg } from "./ui";
import type { SaveState } from "@/lib/useProject";

interface Props {
  p: Project;
  save: SaveState;
  view: "strip" | "single";
  viewLocked?: boolean; // Feature graphic chỉ có 1 ảnh → khoá chọn kiểu xem
  dark: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onStore: (s: Store) => void;
  onSize: (id: string) => void;
  onLoc: (l: string) => void;
  onView: (v: "strip" | "single") => void;
  onUndo: () => void;
  onRedo: () => void;
  onDark: () => void;
  onExport: () => void;
  onAddSize: () => void;
  onName: (v: string) => void;
  onKeys: () => void; // mở bảng phím tắt
}

// Popover Target: 2 cột App Store / Google Play, mỗi cột liệt kê cỡ preset + cỡ tự thêm; chọn 1 cỡ = đổi luôn store
function TargetMenu({ p, onPick, onAddSize, onClose }: { p: Project; onPick: (store: Store, id: string) => void; onAddSize: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const down = (e: PointerEvent) => { if (!ref.current?.parentElement?.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("pointerdown", down, true); window.addEventListener("keydown", key);
    return () => { window.removeEventListener("pointerdown", down, true); window.removeEventListener("keydown", key); };
  }, [onClose]);
  const col = (st: Store) => (
    <div className="tcol">
      <span className="tcol-h">{st === "ios" ? <Apple /> : <Play />}{st === "ios" ? "App Store" : "Google Play"}</span>
      {sizesOf(p, st).map((z) => {
        const on = p.sizeId === z.id && p.store === st;
        return (
          <button key={z.id} className={on ? "on" : ""} onClick={() => { onPick(st, z.id); onClose(); }}>
            {z.kind === "tablet" ? <Tablet /> : <Smartphone />}
            <span className="tname">{z.name}{z.custom && <span className="tag soft">custom</span>}</span>
            <span className="mono">{z.w}×{z.h}</span>
            {on && <Check className="tcheck" />}
          </button>
        );
      })}
    </div>
  );
  return (
    <div className="tmenu" ref={ref} role="dialog" aria-label="Target store and size">
      <div className="tcols">{col("ios")}{col("play")}</div>
      <button className="tadd" onClick={() => { onAddSize(); onClose(); }}><Ruler />Add custom size…</button>
    </div>
  );
}

// Tên dự án sửa tại chỗ: ô nhập tự giãn theo chữ, Enter/Esc để thoát
function ProjectName({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <label className="pname" title="Rename project">
      <span className="pname-sizer">{v || "Untitled"}</span>
      <input value={v} placeholder="Untitled" aria-label="Project name" onChange={(e) => setV(e.target.value)}
        onBlur={() => { const t = v.trim() || "Untitled"; setV(t); if (t !== value) onChange(t); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur(); }} />
    </label>
  );
}

export function TopBar(x: Props) {
  const z = currentSize(x.p);
  const [tm, setTm] = useState(false);
  return (
    <header className="top">
      <div className="logo"><span className="mark" />Pixstall</div>
      <span className="slash">/</span>
      <ProjectName value={x.p.name || x.p.feature.name || "Untitled"} onChange={x.onName} />
      {/* Trạng thái tự lưu trên trình duyệt (IndexedDB) */}
      <span className={`save ${x.save}`} title={x.save === "error" ? "Couldn't save: browser storage is full or blocked (private mode?). Export a ZIP to keep your work." : "Saved in this browser"}>
        {x.save === "error" ? <CloudAlert /> : x.save === "saved" ? <Cloud /> : <LoaderCircle className="spin" />}
        {x.save === "error" ? "Not saved" : x.save === "saved" ? "Saved" : "Saving…"}
      </span>
      <div className="center">
        <div className="twrap">
          <button className={`chip target ${tm ? "open" : ""}`} aria-haspopup="dialog" aria-expanded={tm} title="Store & device size" onClick={() => setTm(!tm)}>
            {x.p.store === "ios" ? <Apple /> : <Play />}
            <span className="tlabel">{z.name}</span>
            <span className="mono">{z.w}×{z.h}</span>
            <ChevronDown className="chev" />
          </button>
          {tm && <TargetMenu p={x.p} onClose={() => setTm(false)} onAddSize={x.onAddSize}
            onPick={(_, id) => x.onSize(id)} />}
        </div>
        <label className="chip">
          <Languages />
          <select value={x.p.loc} aria-label="Language" onChange={(e) => x.onLoc(e.target.value)}>
            {Object.entries(LOCALES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <div className={x.viewLocked ? "locked" : ""} title={x.viewLocked ? "Feature graphic is a single image" : undefined}>
          <Seg value={x.view} onChange={x.onView} options={[
            { v: "strip", label: "Store view", icon: <GalleryHorizontal /> },
            { v: "single", label: "Single", icon: <Square /> },
          ]} />
        </div>
        <button className="ibtn" title="Undo (Ctrl+Z)" aria-label="Undo" disabled={!x.canUndo} onClick={x.onUndo}><Undo2 /></button>
        <button className="ibtn" title="Redo (Ctrl+Shift+Z)" aria-label="Redo" disabled={!x.canRedo} onClick={x.onRedo}><Redo2 /></button>
      </div>
      <button className="ibtn" title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts" onClick={x.onKeys}><Keyboard /></button>
      <button className="ibtn" title={x.dark ? "Light mode" : "Dark mode"} aria-label="Toggle dark mode" onClick={x.onDark}>{x.dark ? <Sun /> : <Moon />}</button>
      <button className="primary" onClick={x.onExport}><Download />Export<span className="badge">ZIP</span></button>
    </header>
  );
}
