// Cột trái (kiểu panel Layers của Framer): danh sách slide, kéo thả sắp xếp, đếm n/max, Feature graphic; nút + để thêm slide từ ảnh
// Thumbnail nằm trong khung CỐ ĐỊNH 40×64 px, slide được co vừa (contain) → hàng nào cũng cao bằng nhau dù iPhone hay iPad
import { useState } from "react";
import { GripVertical, Trash, Plus, Image as ImageIcon } from "lucide-react";
import type { Project } from "@/lib/types";
import { LIMIT } from "@/lib/presets";
import { currentSize, textOf } from "@/lib/rules";
import { SlideCanvas, FeatureCanvas } from "./SlideCanvas";

const TW = 40, TH = 64; // khung thumbnail (px, lưới 4)

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
  const tw = Math.min(TW, (TH * z.w) / z.h); // co slide vừa khung, giữ tỉ lệ
  const [mn, mx] = LIMIT[p.store];

  return (
    <aside className="left">
      <div className="listhead">
        <span className="ttl">Screenshots</span>
        <span className="row g4">
          <span className={`count ${p.slides.length > mx || p.slides.length < mn ? "bad" : ""}`}>{p.slides.length}/{mx}</span>
          <button className="ibtn" title="Delete selected slide" onClick={onDelete}><Trash /></button>
          <button className="ibtn" title="Add screenshots" onClick={onUpload}><Plus /></button>
        </span>
      </div>
      <div className="list">
        {p.slides.map((s, i) => (
          <div key={s.id} draggable onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (drag !== null && drag !== i) onMove(drag, i); setDrag(null); }}
            className={`item ${tab === "slide" && i === sel ? "on" : ""} ${i >= mx ? "over" : ""}`} onClick={() => onPick(i)}>
            <GripVertical className="grip" />
            <div className="thumb" style={{ width: TW, height: TH }}>
              <div className="thumb-in"><SlideCanvas p={p} index={i} width={tw} size={z} /></div>
            </div>
            <div className="meta">
              <div className="name">
                <span className="idx">{String(i + 1).padStart(2, "0")}</span>
                {!s.img && <span className="tag soft">Sample</span>}
                {p.loc !== "en" && !s.t[p.loc] && <span className="tag">EN</span>}
              </div>
              <div className="sub">{textOf(s, p.loc)[0] || "Untitled"}</div>
            </div>
          </div>
        ))}
        {p.store === "play" && (
          <>
            <div className="sect ttl">Play assets</div>
            <div className={`item ${tab === "feature" ? "on" : ""}`} onClick={onFeature}>
              <ImageIcon className="grip" />
              <div className="thumb" style={{ width: 64, height: 32 }}><FeatureCanvas p={p} width={64} /></div>
              <div className="meta"><div className="name">Feature graphic</div><div className="sub mono">1024×500</div></div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
