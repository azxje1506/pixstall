// Thanh trên: logo · chọn store · chọn cỡ máy (có cỡ tự thêm) · ngôn ngữ · kiểu xem · undo/redo · sáng/tối · Export
import { Apple, Play, Smartphone, Tablet, Languages, GalleryHorizontal, Square, Undo2, Redo2, Sun, Moon, Download } from "lucide-react";
import type { Project, Store } from "@/lib/types";
import { LOCALES, STORE_SIZES } from "@/lib/presets";
import { currentSize, sizesOf } from "@/lib/rules";
import { Seg } from "./ui";

interface Props {
  p: Project;
  view: "strip" | "single";
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
}

export function TopBar(x: Props) {
  const z = currentSize(x.p);
  const presets = STORE_SIZES.filter((s) => s.store === x.p.store);
  const customs = sizesOf(x.p, x.p.store).filter((s) => s.custom);
  return (
    <header className="top">
      <div className="logo"><span className="mark" />Pixstall</div>
      <div className="center">
        <Seg value={x.p.store} onChange={x.onStore} options={[
          { v: "ios", label: "App Store", icon: <Apple /> },
          { v: "play", label: "Google Play", icon: <Play /> },
        ]} />
        <label className="chip">
          {z.kind === "tablet" ? <Tablet /> : <Smartphone />}
          <select value={z.id} onChange={(e) => (e.target.value === "__add" ? x.onAddSize() : x.onSize(e.target.value))}>
            <optgroup label="Store sizes">
              {presets.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.w}×{s.h}</option>)}
            </optgroup>
            {customs.length > 0 && (
              <optgroup label="Custom">
                {customs.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.w}×{s.h}</option>)}
              </optgroup>
            )}
            <option value="__add">＋ Add custom size…</option>
          </select>
        </label>
        <label className="chip">
          <Languages />
          <select value={x.p.loc} onChange={(e) => x.onLoc(e.target.value)}>
            {Object.entries(LOCALES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <Seg value={x.view} onChange={x.onView} options={[
          { v: "strip", label: "Store view", icon: <GalleryHorizontal /> },
          { v: "single", label: "Single", icon: <Square /> },
        ]} />
        <button className="ibtn" title="Undo (Ctrl+Z)" disabled={!x.canUndo} onClick={x.onUndo}><Undo2 /></button>
        <button className="ibtn" title="Redo (Ctrl+Shift+Z)" disabled={!x.canRedo} onClick={x.onRedo}><Redo2 /></button>
      </div>
      <button className="ibtn" title="Theme" onClick={x.onDark}>{x.dark ? <Sun /> : <Moon />}</button>
      <button className="primary" onClick={x.onExport}><Download />Export<span className="badge">ZIP</span></button>
    </header>
  );
}
