// Cột trái: danh sách slide (thumbnail thật, kéo thả sắp xếp, đếm n/max) + Feature graphic + nút Upload
import { useState } from "react";
import { GripVertical, Trash, ImagePlus, Image as ImageIcon } from "lucide-react";
import type { Project } from "@/lib/types";
import { LIMIT } from "@/lib/presets";
import { currentSize, textOf } from "@/lib/rules";
import { SlideCanvas, FeatureCanvas } from "./SlideCanvas";

interface Props {
  p: Project;
  sel: number;
  tab: "slide" | "feature";
  onPick: (i: number) => void;
  onFeature: () => void;
  onMove: (from: number, to: number) => void;
  onDelete: () => void;
  onUpload: () => void;
}

export function SlideList({ p, sel, tab, onPick, onFeature, onMove, onDelete, onUpload }: Props) {
  const z = currentSize(p);
  const [drag, setDrag] = useState<number | null>(null);
  return (
    <aside className="left">
      <div className="listhead">
        <span className="lab">Screenshots</span>
        <span className="row" style={{ gap: 6 }}>
          <span className="mono">{p.slides.length} / {LIMIT[p.store][1]}</span>
          <button className="ibtn" title="Delete selected slide" onClick={onDelete}><Trash /></button>
        </span>
      </div>
      <div className="list">
        {p.slides.map((s, i) => (
          <div key={s.id} draggable onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (drag !== null && drag !== i) onMove(drag, i); setDrag(null); }}
            className={`item ${tab === "slide" && i === sel ? "on" : ""} ${i >= LIMIT[p.store][1] ? "over" : ""}`} onClick={() => onPick(i)}>
            <GripVertical className="grip" />
            <div className="thumb"><SlideCanvas p={p} index={i} width={34} size={z} /></div>
            <div className="meta">
              <div className="name">Slide {i + 1}{p.loc !== "en" && !s.t[p.loc] && <span className="tag">EN</span>}</div>
              <div className="sub">{textOf(s, p.loc)[0] || "—"}</div>
              <div className="mono">{z.w}×{z.h}</div>
            </div>
          </div>
        ))}
        {p.store === "play" && (
          <>
            <div className="sect lab">Play assets</div>
            <div className={`item ${tab === "feature" ? "on" : ""}`} onClick={onFeature}>
              <ImageIcon className="grip" />
              <div className="thumb"><FeatureCanvas p={p} width={64} /></div>
              <div className="meta"><div className="name">Feature graphic</div><div className="mono">1024×500</div></div>
            </div>
          </>
        )}
      </div>
      <div className="listfoot">
        <button className="primary wide" onClick={onUpload}><ImagePlus />Upload screenshots</button>
      </div>
    </aside>
  );
}
