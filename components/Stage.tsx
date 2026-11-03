// Vùng giữa: dải slide như trên store (hoặc 1 slide / Feature graphic) + thanh dưới: kiểm tra luật store, lật slide
// Thả file ảnh trực tiếp vào đây để thêm slide. Slide đang chọn nhận `edit` → kéo máy/chữ ngay trên canvas; bấm nền để bỏ chọn
import { useEffect, useRef, useState } from "react";
import { ShieldCheck, TriangleAlert, CircleCheck, ChevronLeft, ChevronRight, MousePointer2 } from "lucide-react";
import type { Project } from "@/lib/types";
import { LOCALES, FEATURE_SIZE } from "@/lib/presets";
import { checkProject, currentSize } from "@/lib/rules";
import { SlideCanvas, FeatureCanvas, type CanvasEdit } from "./SlideCanvas";

interface Props {
  p: Project;
  sel: number;
  tab: "slide" | "feature";
  view: "strip" | "single";
  onPick: (i: number) => void;
  onNav: (d: number) => void;
  onFiles: (f: FileList) => void;
  edit: CanvasEdit;
}

export function Stage({ p, sel, tab, view, onPick, onNav, onFiles, edit }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 900, h: 600 });
  const [over, setOver] = useState(false);
  const z = currentSize(p);

  // Theo dõi kích thước vùng xem để co slide vừa khung
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = Math.max(260, box.h - 64);
  const issues = checkProject(p);
  const warns = issues.filter((x) => x.level === "warn");
  const storeName = p.store === "ios" ? "App Store" : "Google Play";

  let content;
  if (tab === "feature") content = <div className="slidewrap on"><FeatureCanvas p={p} width={Math.min(880, box.w - 80)} edit={edit} /></div>;
  else if (view === "single") {
    const w = Math.min(((H) * z.w) / z.h, box.w - 80);
    content = <div className="slidewrap on"><SlideCanvas p={p} index={sel} width={w} size={z} edit={edit} /></div>;
  } else {
    const w = (H * z.w) / z.h;
    content = p.slides.map((s, i) => (
      <div key={s.id} className={`slidewrap ${i === sel ? "on" : ""}`} onClick={() => onPick(i)}>
        <SlideCanvas p={p} index={i} width={w} size={z} edit={i === sel ? edit : undefined} />
      </div>
    ));
  }

  return (
    <main className={`main ${over ? "drop" : ""}`}
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { if (e.dataTransfer.files.length) { e.preventDefault(); onFiles(e.dataTransfer.files); } setOver(false); }}>
      <div className="stage" ref={ref} onPointerDown={() => edit.onSel(null)}><div className="strip">{content}</div></div>
      <div className="foot">
        <div className={`check ${warns.length ? "warn" : "ok"}`} tabIndex={0}>
          {warns.length ? <TriangleAlert /> : <ShieldCheck />}
          {warns.length ? `${warns.length} issue${warns.length > 1 ? "s" : ""}` : `Ready for ${storeName}`}
          <div className="issues">
            {issues.map((x, i) => (
              <div key={i}>{x.level === "ok" ? <CircleCheck className="c-ok" /> : <TriangleAlert className="c-warn" />}{x.msg}</div>
            ))}
          </div>
        </div>
        {<span className="tip"><MousePointer2 />{edit.sel ? "Drag to move · ↑↓←→ nudge · Esc deselect" : "Click device or text to edit · double-click text to type"}</span>}
        <div className="nav">
          <button className="ibtn" onClick={() => onNav(-1)}><ChevronLeft /></button>
          <span className="mono">{tab === "feature" ? "Feature graphic" : `slide ${sel + 1} / ${p.slides.length}`}</span>
          <button className="ibtn" onClick={() => onNav(1)}><ChevronRight /></button>
        </div>
        <span className="mono">{tab === "feature" ? `${FEATURE_SIZE.w}×${FEATURE_SIZE.h}` : `${z.w}×${z.h}`} · {LOCALES[p.loc]}</span>
      </div>
    </main>
  );
}
