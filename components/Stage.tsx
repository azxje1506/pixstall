// Vùng giữa: dải slide như trên store (hoặc 1 slide / Feature graphic) + thanh dưới: kiểm tra luật store, lật slide
// Thả file ảnh trực tiếp vào đây để thêm slide. Slide đang chọn nhận `edit` → kéo máy/chữ ngay trên canvas; bấm nền để bỏ chọn
import { useEffect, useRef, useState } from "react";
import { ShieldCheck, TriangleAlert, CircleCheck, ChevronLeft, ChevronRight, MousePointer2, Upload, Sparkles } from "lucide-react";
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
  welcome: boolean; // lần đầu vào, dự án toàn màn mẫu → hiện thẻ chào mừng
  onUpload: () => void;
  onSkipWelcome: () => void;
}

// Gợi ý trong lớp phủ: dự án toàn màn mẫu thì ảnh sẽ thế vào các slide mẫu
const allSampleHint = (p: Project) => (p.slides.every((s) => !s.img) ? "They'll replace the sample screens, in order" : "Each image becomes a new slide");

export function Stage({ p, sel, tab, view, onPick, onNav, onFiles, edit, welcome, onUpload, onSkipWelcome }: Props) {
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
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false); }}
      onDrop={(e) => { if (e.dataTransfer.files.length) { e.preventDefault(); onFiles(e.dataTransfer.files); } setOver(false); }}>
      <div className="stage" ref={ref} onPointerDown={() => edit.onSel(null)}><div className="strip">{content}</div></div>
      {/* Lớp phủ khi kéo file ảnh vào */}
      {over && <div className="dropover"><div><Upload /><b>Drop to add screenshots</b><span>{allSampleHint(p)}</span></div></div>}
      {/* Thẻ chào mừng lần đầu */}
      {welcome && !over && (
        <div className="welcome" onPointerDown={(e) => e.stopPropagation()}>
          <div className="wcard">
            <span className="w-ico"><Upload /></span>
            <h2>Drop your app screenshots</h2>
            <p>They go straight into this layout, with headlines, 3D devices and backgrounds ready to export for {p.store === "ios" ? "the App Store" : "Google Play"}.</p>
            <button className="primary" onClick={onUpload}><Upload />Upload screenshots</button>
            <button className="ghost" onClick={onSkipWelcome}><Sparkles />Explore the sample first</button>
            <span className="mono">PNG or JPG · {z.w}×{z.h} works best</span>
          </div>
        </div>
      )}
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
          <button className="ibtn" title="Previous" aria-label="Previous slide" onClick={() => onNav(-1)}><ChevronLeft /></button>
          <span className="mono">{tab === "feature" ? "Feature graphic" : `slide ${sel + 1} / ${p.slides.length}`}</span>
          <button className="ibtn" title="Next" aria-label="Next slide" onClick={() => onNav(1)}><ChevronRight /></button>
        </div>
        <span className="mono dims">{tab === "feature" ? `${FEATURE_SIZE.w}×${FEATURE_SIZE.h}` : `${z.w}×${z.h}`} · {LOCALES[p.loc]}</span>
      </div>
    </main>
  );
}
