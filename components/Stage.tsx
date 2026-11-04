// Vùng giữa: dải slide như trên store (hoặc 1 slide / Feature graphic) + thanh dưới: kiểm tra luật store, lật slide, zoom
// Thả file ảnh vào để thêm slide. Slide đang chọn nhận `edit` → kéo máy/chữ ngay trên canvas; bấm nền để bỏ chọn
// Zoom: "fit" (vừa khung) hoặc tỉ lệ theo pixel ảnh xuất (1 = 100%). Ctrl/⌘+cuộn (hoặc chụm trackpad) zoom quanh con trỏ,
// Ctrl +/−/0 = to/nhỏ/vừa khung. Giữ Space (hoặc nút giữa chuột) rồi kéo để di chuyển màn. Chuột phải → onMenu
// Chip kiểm tra luật store: bấm để mở danh sách, bấm lỗi có slide → nhảy tới slide đó. Nền canvas sáng/tối riêng (nhớ localStorage)
import { useEffect, useRef, useState, type MouseEvent as RME } from "react";
import { ShieldCheck, TriangleAlert, CircleCheck, ChevronLeft, ChevronRight, ChevronUp, MousePointer2, Upload, Sparkles, Minus, Plus, Check, SunMoon, ArrowRight } from "lucide-react";
import type { Project } from "@/lib/types";
import { LOCALES, FEATURE_SIZE } from "@/lib/presets";
import { checkProject, currentSize } from "@/lib/rules";
import { SlideCanvas, FeatureCanvas, type CanvasEdit, type CanvasPick } from "./SlideCanvas";
import { ContextMenu } from "./ContextMenu";

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
  onMenu: (x: number, y: number, index: number, target: CanvasPick) => void; // index -1 = feature graphic
}

const ZOOMS = [0.1, 0.15, 0.25, 0.33, 0.5, 0.75, 1, 1.5, 2];
const ZMIN = 0.05, ZMAX = 3;
const isTyping = (t: EventTarget | null) => !!(t as HTMLElement)?.closest?.("input,textarea,select,[contenteditable=true]");

// Gợi ý trong lớp phủ: dự án toàn màn mẫu thì ảnh sẽ thế vào các slide mẫu
const allSampleHint = (p: Project) => (p.slides.every((s) => !s.img) ? "They'll replace the sample screens, in order" : "Each image becomes a new slide");

export function Stage({ p, sel, tab, view, onPick, onNav, onFiles, edit, welcome, onUpload, onSkipWelcome, onMenu }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 900, h: 600 });
  const [over, setOver] = useState(false);
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [zmenu, setZmenu] = useState<{ x: number; y: number } | null>(null);
  const [space, setSpace] = useState(false);
  const [panning, setPanning] = useState(false);
  const [edges, setEdges] = useState({ l: false, r: false });
  const [issuesOpen, setIssuesOpen] = useState(false);
  const chk = useRef<HTMLDivElement>(null);
  const [cvDark, setCvDark] = useState(() => localStorage.getItem("pixstall:canvas-dark") === "1");
  useEffect(() => { localStorage.setItem("pixstall:canvas-dark", cvDark ? "1" : "0"); }, [cvDark]);
  // Đóng danh sách lỗi khi bấm ra ngoài / Esc
  useEffect(() => {
    if (!issuesOpen) return;
    const down = (e: PointerEvent) => { if (!chk.current?.contains(e.target as Node)) setIssuesOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setIssuesOpen(false); };
    window.addEventListener("pointerdown", down, true); window.addEventListener("keydown", key);
    return () => { window.removeEventListener("pointerdown", down, true); window.removeEventListener("keydown", key); };
  }, [issuesOpen]);
  const panned = useRef(false);
  const z = currentSize(p);

  // Theo dõi kích thước vùng xem để co slide vừa khung
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // --- Kích thước slide theo zoom ---
  const feature = tab === "feature";
  const H = Math.max(260, box.h - 64);
  const baseW = feature ? FEATURE_SIZE.w : z.w;
  const fitW = feature ? Math.min(880, box.w - 80, ((box.h - 80) * FEATURE_SIZE.w) / FEATURE_SIZE.h)
    : view === "single" ? Math.min((H * z.w) / z.h, box.w - 80) : (H * z.w) / z.h;
  const w = zoom === "fit" ? fitW : baseW * zoom;
  const pct = Math.round((w / baseW) * 100);
  const live = useRef({ w, baseW }); live.current = { w, baseW };

  const stepZoom = (dir: 1 | -1) => {
    const cur = live.current.w / live.current.baseW;
    setZoom(dir > 0 ? ZOOMS.find((x) => x > cur + 0.001) ?? ZMAX : [...ZOOMS].reverse().find((x) => x < cur - 0.001) ?? ZMIN);
  };

  // Ctrl/⌘ + cuộn: zoom quanh con trỏ (listener không passive để chặn zoom trang của trình duyệt)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const on = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const cur = live.current.w / live.current.baseW;
      const next = Math.min(ZMAX, Math.max(ZMIN, cur * Math.exp(-Math.max(-50, Math.min(50, e.deltaY)) * 0.006)));
      const ratio = next / cur, r = el.getBoundingClientRect();
      const px = e.clientX - r.left, py = e.clientY - r.top, sl = el.scrollLeft, st = el.scrollTop;
      setZoom(next);
      requestAnimationFrame(() => { el.scrollLeft = (sl + px) * ratio - px; el.scrollTop = (st + py) * ratio - py; });
    };
    el.addEventListener("wheel", on, { passive: false });
    return () => el.removeEventListener("wheel", on);
  }, []);

  // Phím: Ctrl +/−/0 zoom; giữ Space = chế độ kéo màn
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ["=", "+", "-", "0"].includes(e.key)) {
        e.preventDefault();
        if (e.key === "0") setZoom("fit"); else stepZoom(e.key === "-" ? -1 : 1);
      } else if (e.code === "Space" && !isTyping(e.target)) { e.preventDefault(); setSpace(true); }
    };
    const up = (e: KeyboardEvent) => { if (e.code === "Space") setSpace(false); };
    const blur = () => setSpace(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Kéo màn: chặn ở pha capture để không chạm tới máy/chữ bên dưới
  const panStart = (e: React.PointerEvent) => {
    if (!(space || e.button === 1)) return;
    e.preventDefault(); e.stopPropagation();
    const el = ref.current!, sx = e.clientX, sy = e.clientY, l = el.scrollLeft, t = el.scrollTop;
    panned.current = false; setPanning(true);
    const mv = (ev: PointerEvent) => { panned.current = true; el.scrollLeft = l - (ev.clientX - sx); el.scrollTop = t - (ev.clientY - sy); };
    const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); setPanning(false); };
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up);
  };

  // Mép mờ khi dải slide còn phần khuất trái/phải
  const checkEdges = () => {
    const el = ref.current;
    if (!el) return;
    const l = el.scrollLeft > 4, r = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setEdges((o) => (o.l === l && o.r === r ? o : { l, r }));
  };
  useEffect(checkEdges);

  // Đổi slide → cuộn cho slide đó lọt vào khung
  useEffect(() => {
    if (view !== "strip" || feature) return;
    ref.current?.querySelector(".slidewrap.on")?.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
  }, [sel, view, feature]);

  const ctx = (e: RME, i: number) => {
    e.preventDefault();
    const tgt = (e.target as HTMLElement).closest("[data-pick]")?.getAttribute("data-pick") as CanvasPick;
    const own = i === -1 || i === sel;
    if (i >= 0) onPick(i);
    if (own && tgt) edit.onSel(tgt);
    onMenu(e.clientX, e.clientY, i, own ? tgt : null);
  };

  const issues = checkProject(p);
  const warns = issues.filter((x) => x.level === "warn");
  const storeName = p.store === "ios" ? "App Store" : "Google Play";

  let content;
  if (feature) content = <div className="slidewrap on" onContextMenu={(e) => ctx(e, -1)}><FeatureCanvas p={p} width={w} edit={edit} /></div>;
  else if (view === "single") content = <div className="slidewrap on" onContextMenu={(e) => ctx(e, sel)}><SlideCanvas p={p} index={sel} width={w} size={z} edit={edit} /></div>;
  else content = p.slides.map((s, i) => (
    <div key={s.id} className={`slidewrap ${i === sel ? "on" : ""}`} onClick={() => onPick(i)} onContextMenu={(e) => ctx(e, i)}>
      <SlideCanvas p={p} index={i} width={w} size={z} edit={i === sel ? edit : undefined} />
    </div>
  ));

  return (
    <main className={`main ${over ? "drop" : ""} ${cvDark ? "cv-dark" : ""}`}
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setOver(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false); }}
      onDrop={(e) => { if (e.dataTransfer.files.length) { e.preventDefault(); onFiles(e.dataTransfer.files); } setOver(false); }}>
      <div className={`stage ${space ? "space" : ""} ${panning ? "panning" : ""}`} ref={ref}
        onScroll={checkEdges}
        onPointerDownCapture={panStart}
        onClickCapture={(e) => { if (panned.current) { e.stopPropagation(); panned.current = false; } }}
        onPointerDown={() => edit.onSel(null)}>
        <div className="strip">{content}</div>
      </div>
      {edges.l && <div className="edgefade l" />}
      {edges.r && <div className="edgefade r" />}
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
        <div className="chkwrap" ref={chk}>
          <button className={`check ${warns.length ? "warn" : "ok"}`} aria-expanded={issuesOpen} onClick={() => setIssuesOpen(!issuesOpen)}>
            {warns.length ? <TriangleAlert /> : <ShieldCheck />}
            {warns.length ? `${warns.length} issue${warns.length > 1 ? "s" : ""}` : `Ready for ${storeName}`}
            <ChevronUp className={`chev ${issuesOpen ? "up" : ""}`} />
          </button>
          {issuesOpen && (
            <div className="issues" role="dialog" aria-label="Store checks">
              <div className="ihead"><span className="ttl">{storeName} checks</span><span className="mono">{warns.length ? `${warns.length} to fix` : "all good"}</span></div>
              {issues.map((x, i) => x.slide !== undefined ? (
                <button key={i} className="irow link" onClick={() => { onPick(x.slide!); setIssuesOpen(false); }}>
                  <TriangleAlert className="c-warn" /><span>{x.msg}</span><ArrowRight className="go" />
                </button>
              ) : (
                <div key={i} className="irow">{x.level === "ok" ? <CircleCheck className="c-ok" /> : <TriangleAlert className="c-warn" />}<span>{x.msg}</span></div>
              ))}
            </div>
          )}
        </div>
        <span className="tip"><MousePointer2 />{edit.sel ? "Drag to move · corners resize · ◯ rotates · Esc deselect" : "Click to edit · right-click for more · Space+drag to pan"}</span>
        <div className="nav">
          <button className="ibtn" title="Previous" aria-label="Previous slide" onClick={() => onNav(-1)}><ChevronLeft /></button>
          <span className="mono">{feature ? "Feature graphic" : `slide ${sel + 1} / ${p.slides.length}`}</span>
          <button className="ibtn" title="Next" aria-label="Next slide" onClick={() => onNav(1)}><ChevronRight /></button>
        </div>
        <div className="zoom">
          <button className={`ibtn ${cvDark ? "on" : ""}`} title="Canvas background: light / dark" aria-label="Toggle canvas background" onClick={() => setCvDark(!cvDark)}><SunMoon /></button>
          <button className="ibtn" title="Zoom out (Ctrl −)" aria-label="Zoom out" onClick={() => stepZoom(-1)}><Minus /></button>
          <button className="zval" title="Zoom level" aria-label={`Zoom ${pct}%`} onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setZmenu({ x: r.left, y: r.top - 4 }); }}>
            {zoom === "fit" ? <>Fit<span className="muted"> {pct}%</span></> : `${pct}%`}
          </button>
          <button className="ibtn" title="Zoom in (Ctrl +)" aria-label="Zoom in" onClick={() => stepZoom(1)}><Plus /></button>
          <span className="mono dims">{feature ? `${FEATURE_SIZE.w}×${FEATURE_SIZE.h}` : `${z.w}×${z.h}`} · {LOCALES[p.loc]}</span>
        </div>
      </div>
      {zmenu && (
        <ContextMenu x={zmenu.x} y={zmenu.y} minWidth={168} onClose={() => setZmenu(null)} items={[
          { label: "Zoom to fit", kbd: "Ctrl 0", on: zoom === "fit", icon: zoom === "fit" ? <Check /> : null, onClick: () => setZoom("fit") },
          "sep",
          ...[0.25, 0.5, 0.75, 1, 2].map((v) => ({ label: `${v * 100}%`, on: zoom === v, icon: zoom === v ? <Check /> : null, onClick: () => setZoom(v) })),
          "sep",
          { label: "Zoom in", kbd: "Ctrl +", icon: <Plus />, onClick: () => stepZoom(1) },
          { label: "Zoom out", kbd: "Ctrl −", icon: <Minus />, onClick: () => stepZoom(-1) },
        ]} />
      )}
    </main>
  );
}
