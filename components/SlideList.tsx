// Cột trái (kiểu panel Layers của Framer): danh sách slide, kéo thả sắp xếp, đếm n/max, Feature graphic; nút + để thêm slide từ ảnh
// Nhân bản / đổi ảnh / xoá nằm trên TỪNG hàng (hiện khi rê chuột); xoá có toast Hoàn tác ở Editor
// Kéo hàng: vạch tím báo chỗ thả (trên/dưới hàng đích). Thả FILE ảnh vào vùng trống dưới danh sách = thêm slide
// Còn màn mẫu → một dải thông báo chung thay vì nhãn "Sample" lặp ở mọi hàng (mỗi hàng chỉ còn chấm nhỏ)
// Cây Layers: slide đang chọn mở ra các layer con (Headline, Subtitle, Text/Badge tự do, Device) — bấm để chọn (đồng bộ 2 chiều
// với canvas), mắt để ẩn, thùng rác để xoá layer chữ, rê chuột để viền layer trên canvas; dòng cuối "+ Add text" mở menu thêm chữ
// Thumbnail nằm trong khung CỐ ĐỊNH 40×64 px, slide được co vừa (contain) → hàng nào cũng cao bằng nhau dù iPhone hay iPad
import { useState, type ReactNode } from "react";
import { GripVertical, Trash2, Plus, CopyPlus, ImageUp, Upload, Image as ImageIcon, ChevronRight, Type, Smartphone, Eye, EyeOff, Heading, Pilcrow, Tag, Sparkles } from "lucide-react";
import { layersOf, isHidden, fLayersOf, fIsHidden, fRemovable, type LayerId } from "@/lib/layers";
import { featureShot } from "./SlideCanvas";
import { MenuButton, type MenuItem } from "./Popover";
import type { CanvasPick, LayerPick } from "./SlideCanvas";
import type { Project } from "@/lib/types";
import { LIMIT } from "@/lib/presets";
import { currentSize, textOf, plain } from "@/lib/rules";
import { SlideCanvas, FeatureCanvas } from "./SlideCanvas";

const TW = 40, TH = 64; // khung thumbnail (px, lưới 4)

interface Props {
  p: Project;
  sel: number;
  tab: "slide" | "feature";
  onPick: (i: number) => void;
  onFeature: () => void;
  onMove: (from: number, to: number) => void;
  onDelete: (i: number) => void;
  onDuplicate: (i: number) => void;
  onUpload: () => void;
  onMenu: (x: number, y: number, i: number) => void; // chuột phải trên hàng
  onReplace: (i: number) => void; // đổi ảnh của hàng i
  onFiles: (f: FileList) => void; // thả file vào vùng trống
  pick: CanvasPick;
  onLayer: (i: number, l: CanvasPick) => void; // i = -1: feature graphic
  onToggleHidden: (i: number, l: LayerPick) => void;
  onHover: (l: LayerPick | null) => void;
  onRemoveLayer: (i: number, l: LayerId) => void;
  addItems: (i: number) => MenuItem[]; // menu "Add text" của slide i (-1 = feature graphic)
}

// Icon theo loại layer
export const layerIcon = (id: LayerId, name: string): ReactNode =>
  id.startsWith("device") ? <Smartphone /> : id.startsWith("d:") ? <Sparkles /> : id === "icon" ? <ImageIcon /> : id === "title" ? <Heading /> : id === "sub" ? <Pilcrow /> : name === "Badge" ? <Tag /> : <Type />;

// Hàng layer con (thụt vào dưới slide/feature)
function LayerRow({ icon, name, sub, on, hidden, onClick, onToggle, onHover, onRemove }: { icon: ReactNode; name: string; sub: string; on: boolean; hidden?: boolean; onClick: () => void; onToggle?: () => void; onHover: (v: boolean) => void; onRemove?: () => void }) {
  return (
    <div className={`litem ${on ? "on" : ""} ${hidden ? "off" : ""}`} onClick={onClick} onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)}>
      <span className="lico">{icon}</span>
      <span className="lname">{name}</span>
      <span className="lsub">{sub}</span>
      {onRemove && <button className="ibtn eye danger" title="Delete layer" aria-label={`Delete ${name}`} onClick={(e) => { e.stopPropagation(); onRemove(); }}><Trash2 /></button>}
      {onToggle && <button className="ibtn eye" title={hidden ? "Show layer" : "Hide layer"} aria-label={`${hidden ? "Show" : "Hide"} ${name}`} onClick={(e) => { e.stopPropagation(); onToggle(); }}>{hidden ? <EyeOff /> : <Eye />}</button>}
    </div>
  );
}

export function SlideList({ p, sel, tab, onPick, onFeature, onMove, onDelete, onDuplicate, onUpload, onMenu, onReplace, onFiles, pick, onLayer, onToggleHidden, onHover, onRemoveLayer, addItems }: Props) {
  const z = currentSize(p);
  const [drag, setDrag] = useState<number | null>(null);
  const [mark, setMark] = useState<{ i: number; after: boolean } | null>(null); // vạch chỗ thả khi kéo hàng
  const [hot, setHot] = useState(false); // kéo file ngang vùng trống
  const samples = p.slides.filter((s) => !s.img).length;
  // Thả hàng: tính index đích theo nửa trên/dưới của hàng
  const dropTo = (i: number, after: boolean) => {
    if (drag === null) return;
    let to = after ? i + 1 : i;
    if (drag < to) to--;
    if (to !== drag) onMove(drag, to);
  };
  const tw = Math.min(TW, (TH * z.w) / z.h); // co slide vừa khung, giữ tỉ lệ
  const [mn, mx] = LIMIT[p.store];

  return (
    <aside className="left">
      <div className="listhead">
        <span className="ttl">Screenshots</span>
        <span className="row g4">
          <span className={`count ${p.slides.length > mx || p.slides.length < mn ? "bad" : ""}`}>{p.slides.length}/{mx}</span>
          <button className="ibtn" title="Add screenshots" aria-label="Add screenshots" onClick={onUpload}><Plus /></button>
        </span>
      </div>
      {samples > 0 && (
        <button className="samplebar" onClick={onUpload}>
          <span className="sdot" /><span className="stext">{samples} sample screen{samples > 1 ? "s" : ""} · <b>replace with yours</b></span>
        </button>
      )}
      <div className="list">
        {p.slides.map((s, i) => { const open = tab === "slide" && i === sel; return (
          <div key={s.id} className="lgroup">
          <div draggable
            onDragStart={(e) => { setDrag(i); e.dataTransfer.effectAllowed = "move"; }}
            onDragEnd={() => { setDrag(null); setMark(null); }}
            onDragOver={(e) => {
              if (drag === null) return;
              e.preventDefault();
              const r = e.currentTarget.getBoundingClientRect(), after = e.clientY > r.top + r.height / 2;
              if (mark?.i !== i || mark.after !== after) setMark({ i, after });
            }}
            onDrop={(e) => { if (drag === null) return; e.preventDefault(); if (mark) dropTo(mark.i, mark.after); setDrag(null); setMark(null); }}
            className={`item ${open ? "on" : ""} ${open && pick && pick !== "slide" ? "parent" : ""} ${i >= mx ? "over" : ""} ${drag === i ? "dragging" : ""} ${mark?.i === i ? (mark.after ? "mark-after" : "mark-before") : ""}`} onClick={() => onPick(i)}
            onContextMenu={(e) => { e.preventDefault(); onMenu(e.clientX, e.clientY, i); }}>
            <GripVertical className="grip" />
            <ChevronRight className={`tw ${open ? "open" : ""}`} />
            <div className="thumb" style={{ width: TW, height: TH }}>
              <div className="thumb-in"><SlideCanvas p={p} index={i} width={tw} size={z} /></div>
            </div>
            <div className="meta">
              <div className="name">
                <span className="idx">{String(i + 1).padStart(2, "0")}</span>
                {!s.img && <span className="sdot" title="Sample screen" />}
                {p.loc !== "en" && !s.t[p.loc] && <span className="tag">EN</span>}
                {s.override && <span className="odot static" title="This slide has its own style" />}
              </div>
              <div className="sub">{plain(textOf(s, p.loc)[0]) || "Untitled"}</div>
            </div>
            <div className="rowact" onClick={(e) => e.stopPropagation()}>
              <button className="ibtn" title={s.img ? "Replace image" : "Upload image"} aria-label={`Replace image of slide ${i + 1}`} onClick={() => onReplace(i)}><ImageUp /></button>
              <button className="ibtn" title="Duplicate" aria-label={`Duplicate slide ${i + 1}`} onClick={() => onDuplicate(i)}><CopyPlus /></button>
              <button className="ibtn danger" title="Delete" aria-label={`Delete slide ${i + 1}`} onClick={() => onDelete(i)}><Trash2 /></button>
            </div>
          </div>
          {open && (
            <div className="lchildren">
              {layersOf(s, p.loc, ((i + 1) % p.slides.length) + 1).map((l) => (
                <LayerRow key={l.id} icon={layerIcon(l.id, l.name)} name={l.name} sub={l.sub} on={pick === l.id} hidden={isHidden(s, l.id)}
                  onClick={() => onLayer(i, l.id)} onToggle={() => onToggleHidden(i, l.id)} onHover={(v) => onHover(v ? l.id : null)}
                  onRemove={l.id === "device" || l.id === "device2" ? undefined : () => onRemoveLayer(i, l.id)} />
              ))}
              <MenuButton className="litem ladd" placement="bottom-start" menuWidth={168} items={() => addItems(i)}>
                <span className="lico"><Plus /></span><span className="lname">Add text</span>
              </MenuButton>
            </div>
          )}
          </div>
        ); })}
        {p.store === "play" && (
          <>
            <div className="sect ttl">Play assets</div>
            <div className={`item ${tab === "feature" ? "on" : ""} ${tab === "feature" && pick && pick !== "slide" ? "parent" : ""}`} onClick={onFeature}>
              <ImageIcon className="grip" />
              <div className="thumb" style={{ width: 64, height: 32 }}><FeatureCanvas p={p} width={64} /></div>
              <div className="meta"><div className="name">Feature graphic</div><div className="sub mono">1024×500</div></div>
            </div>
            {tab === "feature" && (
              <div className="lchildren">
                {fLayersOf(p.feature, p.loc, (j) => featureShot(p, j) + 1).map((l) => (
                  <LayerRow key={l.id} icon={layerIcon(l.id, l.name)} name={l.name} sub={l.sub} on={pick === l.id} hidden={fIsHidden(p.feature, l.id)}
                    onClick={() => onLayer(-1, l.id)} onToggle={() => onToggleHidden(-1, l.id)} onHover={(v) => onHover(v ? l.id : null)}
                    onRemove={fRemovable(l.id) ? () => onRemoveLayer(-1, l.id) : undefined} />
                ))}
                <MenuButton className="litem ladd" placement="bottom-start" menuWidth={168} items={() => addItems(-1)}>
                  <span className="lico"><Plus /></span><span className="lname">Add text</span>
                </MenuButton>
              </div>
            )}
          </>
        )}
        {/* Vùng trống còn lại: thả file ảnh vào để thêm slide */}
        <div className={`listdrop ${hot ? "hot" : ""}`}
          onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); e.stopPropagation(); setHot(true); } }}
          onDragLeave={() => setHot(false)}
          onDrop={(e) => { if (!e.dataTransfer.files.length) return; e.preventDefault(); e.stopPropagation(); setHot(false); onFiles(e.dataTransfer.files); }}>
          {hot && <span><Upload />Drop to add slides</span>}
        </div>
      </div>
    </aside>
  );
}
