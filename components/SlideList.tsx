// Cột trái (kiểu panel Layers của Framer): danh sách slide, kéo thả sắp xếp, đếm n/max, Feature graphic; nút + để thêm slide từ ảnh
// Nhân bản / đổi ảnh / xoá nằm trên TỪNG hàng (hiện khi rê chuột); xoá có toast Hoàn tác ở Editor
// Kéo hàng: vạch tím báo chỗ thả (trên/dưới hàng đích). Thả FILE ảnh vào vùng trống dưới danh sách = thêm slide
// Còn màn mẫu → một dải thông báo chung thay vì nhãn "Sample" lặp ở mọi hàng (mỗi hàng chỉ còn chấm nhỏ)
// Cây Layers: slide đang chọn mở ra các layer con (Headline, Subtitle, Text/Badge tự do, Device) — bấm để chọn (đồng bộ 2 chiều
// với canvas), KÉO THẢ hàng = đổi thứ tự lớp (vào/ra nhóm), mắt để ẩn, chuột phải = menu (xoá, nhóm, đổi tên…), rê chuột để viền layer trên canvas; nhóm hiện như thư mục, double-click tên để đổi; dòng cuối "+ Add text" mở menu thêm chữ
// Thumbnail nằm trong khung CỐ ĐỊNH 40×64 px, slide được co vừa (contain) → hàng nào cũng cao bằng nhau dù iPhone hay iPad
import { useRef, useState, type ReactNode } from "react";
import { GripVertical, Trash2, Plus, CopyPlus, ImageUp, Upload, Image as ImageIcon, ChevronRight, Type, Smartphone, Eye, EyeOff, Heading, Pilcrow, Tag, Sparkles, Group } from "lucide-react";
import { layersOf, isHidden, fLayersOf, fIsHidden, fRemovable, treeOf, stackOf, type LayerId } from "@/lib/layers";
import { featureShot } from "./SlideCanvas";
import { MenuButton, type MenuItem } from "./Popover";
import type { CanvasPick, LayerPick } from "./SlideCanvas";
import type { Project } from "@/lib/types";
import { LIMIT } from "@/lib/presets";
import { currentSize, textOf, plain } from "@/lib/rules";
import { SlideCanvas, FeatureCanvas } from "./SlideCanvas";

const sameSet = (a: string[], b: string[]) => a.length > 1 && a.length === b.length && b.every((x) => a.includes(x as LayerId));
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
  onLayer: (i: number, l: CanvasPick, add?: boolean) => void; // i = -1: feature graphic; add = Shift/⌘-click thêm vào nhóm chọn
  onGroup: (i: number, gid: string) => void; // bấm dòng nhóm = chọn cả nhóm
  multi: LayerId[]; // các layer đang chọn cùng lúc
  onToggleHidden: (i: number, l: LayerPick) => void;
  onHover: (l: LayerPick | null) => void;
  onRemoveLayer: (i: number, l: LayerId) => void;
  onRowMenu: (x: number, y: number, i: number, l: LayerId | null, gid?: string) => void;
  onReorder: (i: number, ids: LayerId[], anchor: { id: LayerId; after: boolean } | null, gid: string | null | undefined) => void; // kéo thả đổi thứ tự lớp // chuột phải trên dòng layer / nhóm
  renaming: string | null; onRename: (i: number, gid: string, name: string | null) => void; onStartRename: (gid: string) => void; // đổi tên nhóm tại chỗ
  onGroupHidden: (i: number, gid: string) => void; // mắt của nhóm: ẩn/hiện mọi con
  addItems: (i: number) => MenuItem[]; // menu "Add text" của slide i (-1 = feature graphic)
}

// Icon theo loại layer
export const layerIcon = (id: LayerId, name: string): ReactNode =>
  id.startsWith("device") ? <Smartphone /> : id.startsWith("d:") ? <Sparkles /> : id === "icon" ? <ImageIcon /> : id === "title" ? <Heading /> : id === "sub" ? <Pilcrow /> : name === "Badge" ? <Tag /> : <Type />;

// Hàng layer con (thụt vào dưới slide/feature)
// Hàng layer con. Rê chuột chỉ hiện nút mắt; mọi thao tác khác (xoá, nhóm, đổi tên…) nằm ở menu chuột phải (onMenu)
// depth 1 = con của nhóm (thụt thêm); grp = dòng nhóm; editing = đang đổi tên (ô nhập tại chỗ, Enter lưu · Esc huỷ)
// Shift/⌘-click → onClick(true); double-click tên nhóm = đổi tên
// dnd = thuộc tính kéo thả (data-lid/data-gid/data-hdr/data-first) — chỉ cây của slide; drop = lớp vạch báo chỗ thả
function LayerRow({ icon, name, sub, on, hidden, depth = 0, grp, editing, dnd, drop, onClick, onToggle, onHover, onMenu, onRename, onStartRename }: {
  icon: ReactNode; name: string; sub: string; on: boolean; hidden?: boolean; depth?: number; grp?: boolean; editing?: boolean;
  dnd?: Record<string, string | undefined>; drop?: string;
  onClick: (add: boolean) => void; onToggle?: () => void; onHover: (v: boolean) => void; onMenu: (x: number, y: number) => void;
  onRename?: (v: string | null) => void; onStartRename?: () => void;
}) {
  return (
    <div {...dnd} className={`litem ${on ? "on" : ""} ${hidden ? "off" : ""} ${depth ? "nested" : ""} ${grp ? "lgrp" : ""} ${drop ?? ""}`} title={grp ? "Click to select the group · double-click to rename · right-click for more" : "Shift-click to select several · right-click for more"}
      onMouseDown={(e) => { if (e.shiftKey && !editing) e.preventDefault(); }} // Shift-click không bôi đen chữ
      onClick={(e) => { if (!editing) onClick(e.shiftKey || e.metaKey || e.ctrlKey); }} onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onMenu(e.clientX, e.clientY); }}>
      <span className="lico">{icon}</span>
      {editing
        ? <input className="lrename" aria-label="Group name" defaultValue={name} autoFocus onFocus={(e) => e.currentTarget.select()} onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") onRename?.(null); }}
            onBlur={(e) => onRename?.(e.currentTarget.value.trim() || null)} />
        : <span className="lname" onDoubleClick={grp ? (e) => { e.stopPropagation(); onStartRename?.(); } : undefined}>{name}</span>}
      {!editing && <span className="lsub">{sub}</span>}
      {onToggle && !editing && <button className="ibtn eye" title={hidden ? "Show" : "Hide"} aria-label={`${hidden ? "Show" : "Hide"} ${name}`} onClick={(e) => { e.stopPropagation(); onToggle(); }}>{hidden ? <EyeOff /> : <Eye />}</button>}
    </div>
  );
}

export function SlideList({ p, sel, tab, onPick, onFeature, onMove, onDelete, onDuplicate, onUpload, onMenu, onReplace, onFiles, pick, multi, onLayer, onGroup, onToggleHidden, onHover, onRemoveLayer, onRowMenu, onReorder, renaming, onRename, onStartRename, onGroupHidden, addItems }: Props) {
  const z = currentSize(p);
  const [drag, setDrag] = useState<number | null>(null);
  const [mark, setMark] = useState<{ i: number; after: boolean } | null>(null); // vạch chỗ thả khi kéo hàng
  const [hot, setHot] = useState(false); // kéo file ngang vùng trống
  // --- Kéo thả layer trong cây (thứ tự lớp, kiểu Figma) ---
  // Kéo hàng layer (hoặc dòng nhóm = cả khối) → vạch tím báo chỗ: nửa trên hàng = phía trên, nửa dưới = phía dưới;
  // thả cạnh con của một nhóm = vào nhóm đó; nửa dưới dòng nhóm = vào nhóm (lên đầu); cạnh hàng ngoài nhóm = ra khỏi nhóm
  const [ldrop, setLdrop] = useState<{ key: string; cls: string } | null>(null);
  const dragged = useRef(false);
  const startRowDrag = (e: React.PointerEvent, i: number) => {
    if (e.button !== 0) return;
    const t = e.target as HTMLElement;
    if (t.closest("button,input")) return;
    const row = t.closest<HTMLElement>(".litem[data-lid]"); if (!row) return;
    const box = e.currentTarget as HTMLElement, sx = e.clientX, sy = e.clientY;
    const isGrp = row.dataset.hdr === "1", lid = row.dataset.lid as LayerId;
    const ids: LayerId[] = isGrp ? (row.dataset.ids ?? "").split(",") as LayerId[] : multi.includes(lid) && i === sel && tab === "slide" ? multi : [lid];
    let on = false, plan: { anchor: { id: LayerId; after: boolean }; gid: string | null | undefined } | null = null;
    const move = (ev: PointerEvent) => {
      if (!on) { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return; on = true; document.body.classList.add("dragging"); document.body.style.setProperty("--drag-cur", "grabbing"); row.classList.add("ldragging"); }
      const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>(".litem[data-lid]");
      plan = null;
      if (!el || !box.contains(el)) return setLdrop(null);
      const r = el.getBoundingClientRect(), low = ev.clientY > r.top + r.height / 2, tl = el.dataset.lid as LayerId, hdr = el.dataset.hdr === "1";
      const tgIds = hdr ? (el.dataset.ids ?? "").split(",") : [tl];
      if (tgIds.some((x) => ids.includes(x as LayerId))) return setLdrop(null); // thả lên chính nó
      if (hdr) plan = { anchor: { id: tl, after: false }, gid: low && !isGrp ? el.dataset.gid : null };
      else plan = { anchor: { id: tl, after: low }, gid: isGrp ? null : el.dataset.gid ?? null };
      if (isGrp) plan.gid = undefined; // kéo cả nhóm: giữ nguyên thành viên
      setLdrop({ key: el.dataset.key!, cls: hdr ? (low && !isGrp ? "drop-into" : "drop-before") : low ? "drop-after" : "drop-before" });
    };
    const up = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
      document.body.classList.remove("dragging"); row.classList.remove("ldragging"); setLdrop(null);
      if (!on) return;
      dragged.current = true; setTimeout(() => { dragged.current = false; }, 0); // chặn click sau khi thả
      if (plan) onReorder(i, ids, plan.anchor, plan.gid);
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };
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
            <div className="lchildren" onPointerDown={(e) => startRowDrag(e, i)} onClickCapture={(e) => { if (dragged.current) e.stopPropagation(); }}>
              {treeOf(s, layersOf(s, p.loc, ((i + 1) % p.slides.length) + 1)).map((r) => r.kind === "group" ? (
                <LayerRow key={"g" + r.g.id} grp icon={<Group />} name={r.g.name} sub={`${r.g.ids.length} layers`} on={sameSet(multi, r.g.ids)}
                  dnd={{ "data-key": "g" + r.g.id, "data-lid": stackOf(s).find((l) => r.g.ids.includes(l)), "data-hdr": "1", "data-gid": r.g.id, "data-ids": r.g.ids.join(",") }} drop={ldrop?.key === "g" + r.g.id ? ldrop.cls : undefined}
                  hidden={r.g.ids.every((l) => isHidden(s, l as LayerId))} editing={renaming === r.g.id}
                  onClick={() => onGroup(i, r.g.id)} onHover={() => {}} onToggle={() => onGroupHidden(i, r.g.id)}
                  onMenu={(x, y) => onRowMenu(x, y, i, null, r.g.id)} onStartRename={() => onStartRename(r.g.id)} onRename={(v) => onRename(i, r.g.id, v)} />
              ) : (
                <LayerRow key={r.row.id} depth={r.depth} icon={layerIcon(r.row.id, r.row.name)} name={r.row.name} sub={r.row.sub} on={pick === r.row.id || multi.includes(r.row.id)} hidden={isHidden(s, r.row.id)}
                  dnd={{ "data-key": r.row.id, "data-lid": r.row.id, "data-gid": r.g?.id }} drop={ldrop?.key === r.row.id ? ldrop.cls : undefined}
                  onClick={(add) => onLayer(i, r.row.id, add)} onToggle={() => onToggleHidden(i, r.row.id)} onHover={(v) => onHover(v ? r.row.id : null)}
                  onMenu={(x, y) => onRowMenu(x, y, i, r.row.id)} />
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
                {treeOf(p.feature, fLayersOf(p.feature, p.loc, (j) => featureShot(p, j) + 1)).map((r) => r.kind === "group" ? (
                  <LayerRow key={"g" + r.g.id} grp icon={<Group />} name={r.g.name} sub={`${r.g.ids.length} layers`} on={sameSet(multi, r.g.ids)}
                    hidden={r.g.ids.every((l) => fIsHidden(p.feature, l as LayerId))} editing={renaming === r.g.id}
                    onClick={() => onGroup(-1, r.g.id)} onHover={() => {}} onToggle={() => onGroupHidden(-1, r.g.id)}
                    onMenu={(x, y) => onRowMenu(x, y, -1, null, r.g.id)} onStartRename={() => onStartRename(r.g.id)} onRename={(v) => onRename(-1, r.g.id, v)} />
                ) : (
                  <LayerRow key={r.row.id} depth={r.depth} icon={layerIcon(r.row.id, r.row.name)} name={r.row.name} sub={r.row.sub} on={pick === r.row.id || multi.includes(r.row.id)} hidden={fIsHidden(p.feature, r.row.id)}
                    onClick={(add) => onLayer(-1, r.row.id, add)} onToggle={() => onToggleHidden(-1, r.row.id)} onHover={(v) => onHover(v ? r.row.id : null)}
                    onMenu={(x, y) => onRowMenu(x, y, -1, r.row.id)} />
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
