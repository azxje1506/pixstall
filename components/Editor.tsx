// Editor chính Pixstall: ghép TopBar + SlideList + Stage + Inspector, giữ trạng thái UI (slide chọn, tab, hộp thoại)
"use client";
import { useEffect, useRef, useState } from "react";
import { useProject } from "@/lib/useProject";
import type { SizePreset, Slide, Feature } from "@/lib/types";
import { uid } from "@/lib/presets";
import { sizesOf, allSizes } from "@/lib/rules";
import { TopBar } from "./TopBar";
import { SlideList } from "./SlideList";
import { Stage } from "./Stage";
import { Inspector } from "./Inspector";
import { SizeDialog, ExportDialog, KeysDialog } from "./Dialogs";
import type { CanvasPick, LayerPick } from "./SlideCanvas";
import { ContextMenu, type MenuItem } from "./ContextMenu";
import { CopyPlus, Trash2, ImageUp, RotateCcw, BringToFront, SendToBack } from "lucide-react";

const readImg = (f: File) => new Promise<string>((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(f); });

export default function Editor() {
  const { p, update, undo, redo, canUndo, canRedo, save, fresh } = useProject();
  const [sel, setSel] = useState(0);
  const [tab, setTab] = useState<"slide" | "feature">("slide");
  const [view, setView] = useState<"strip" | "single">("strip");
  const [dark, setDark] = useState(false);
  const [dialog, setDialog] = useState<"" | "size" | "export" | "keys">("");
  const [toast, setToast] = useState<{ msg: string; undo?: boolean } | null>(null);
  const toastT = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [welcome, setWelcome] = useState(true); // tắt sau khi user upload hoặc chọn xem mẫu
  const [narrowOk, setNarrowOk] = useState(false); // màn hẹp: user bấm "vẫn mở" 
  const [pick, setPick] = useState<CanvasPick>(null); // cấp đang chọn: null / slide / text / device
  const [hov, setHov] = useState<LayerPick | null>(null); // layer đang rê trên cây Layers
  const [menu, setMenu] = useState<{ x: number; y: number; i: number; target: CanvasPick } | null>(null); // menu chuột phải (i = -1: feature)
  const addInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const n = p.slides.length;
  const idx = Math.min(sel, n - 1);

  useEffect(() => { document.documentElement.classList.toggle("dark", dark); }, [dark]);
  // Đổi slide / tab → chọn cấp Slide của slide mới (không giữ layer của slide cũ)
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } setPick("slide"); }, [idx, tab]);
  // Chọn một layer của slide i (từ cây Layers)
  const pickLayer = (i: number, layer: CanvasPick) => {
    if (i === -1) setTab("feature"); else { setSel(i); setTab("slide"); }
    setTimeout(() => setPick(layer), 0); // chạy sau effect đổi slide
  };
  const toggleHidden = (i: number, layer: LayerPick) => update((d) => ({ ...d, slides: d.slides.map((s, j) => (j === i ? { ...s, hidden: { ...s.hidden, [layer]: !s.hidden?.[layer] } } : s)) }));

  // Sửa slide đang chọn (dùng chung cho canvas + phím nhích)
  const patchSlide = (patch: Partial<Slide>, tag = "") => update((d) => ({ ...d, slides: d.slides.map((s, i) => (i === idx ? { ...s, ...patch } : s)) }), tag);
  const patchFeature = (patch: Partial<Feature>, tag = "") => update((d) => ({ ...d, feature: { ...d.feature, ...patch } }), tag);
  const patchCur = (patch: Record<string, unknown>, tag = "") => (tab === "feature" ? patchFeature(patch, tag) : patchSlide(patch, tag));

  // Phím tắt: Ctrl+Z / Ctrl+Shift+Z; có phần tử chọn thì mũi tên nhích (Shift = 2em), Esc bỏ chọn; không thì ←/→ lật slide
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t?.closest("input,textarea,select") || t?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { if (typing) return; e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (typing) return;
      if (e.key === "?" && !dialog) { e.preventDefault(); setDialog("keys"); return; }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") { e.preventDefault(); if (tab === "slide") dupAt(idx); return; }
      // Esc lùi 1 cấp: layer → slide → không chọn (đang gõ chữ thì ô chữ tự xử lý Esc)
      if (e.key === "Escape") return setPick((x) => (x === "text" || x === "device" ? "slide" : null));
      const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!dir) return;
      if (pick === "text" || pick === "device") {
        e.preventDefault();
        const st = e.shiftKey ? 2 : 0.5, s = tab === "feature" ? p.feature : p.slides[idx];
        const [kx, ky] = pick === "device" ? ["dx", "dy"] as const : ["tx", "ty"] as const;
        const r = (v: number) => Math.round(v * 10) / 10;
        patchCur({ [kx]: r((s[kx] ?? 0) + dir[0] * st), [ky]: r((s[ky] ?? 0) + dir[1] * st) }, "nudge");
      } else if (dir[0]) { setTab("slide"); setSel((x) => (x + dir[0] + n) % n); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Toast: có nút Hoàn tác khi undo=true (sống lâu hơn, 6s)
  const flash = (msg: string, withUndo = false) => {
    clearTimeout(toastT.current);
    setToast({ msg, undo: withUndo });
    toastT.current = setTimeout(() => setToast(null), withUndo ? 6000 : 2800);
  };
  const allSample = p.slides.every((s) => !s.img);

  // --- Thao tác slide dùng chung (cột trái, menu chuột phải, phím tắt) ---
  const dupAt = (at: number) => { update((d) => { const s = [...d.slides]; s.splice(at + 1, 0, { ...structuredClone(d.slides[at]), id: uid() }); return { ...d, slides: s }; }); setSel(at + 1); setTab("slide"); };
  const delAt = (at: number) => {
    if (n <= 1) return flash("Keep at least one slide");
    update((d) => ({ ...d, slides: d.slides.filter((_, i) => i !== at) }));
    setSel(at < idx ? idx - 1 : at === idx ? Math.min(idx, n - 2) : idx);
    flash(`Slide ${at + 1} deleted`, true);
  };

  // Mục menu chuột phải: lớp trên/dưới (khi bấm trúng máy/chữ), đặt lại vị trí, rồi thao tác slide
  const menuItems = (m: { i: number; target: CanvasPick }): MenuItem[] => {
    const isF = m.i === -1, it = isF ? p.feature : p.slides[m.i];
    if (!it) return [];
    const patch = (x: Record<string, unknown>) => (isF ? patchFeature(x) : update((d) => ({ ...d, slides: d.slides.map((s, j) => (j === m.i ? { ...s, ...x } : s)) })));
    const front = it.front ?? "text", moved = !!(it.dx || it.dy || it.tx || it.ty);
    const name = m.target === "device" ? (isF ? "devices" : "device") : "text";
    const items: MenuItem[] = [];
    if (m.target === "text" || m.target === "device") items.push(
      { label: `Bring ${name} to front`, icon: <BringToFront />, disabled: front === m.target, onClick: () => patch({ front: m.target }) },
      { label: `Send ${name} to back`, icon: <SendToBack />, disabled: front !== m.target, onClick: () => patch({ front: m.target === "device" ? "text" : "device" }) },
      "sep",
    );
    items.push({ label: "Reset position", icon: <RotateCcw />, disabled: !moved, onClick: () => patch({ dx: 0, dy: 0, tx: 0, ty: 0 }) });
    if (!isF) items.push(
      "sep",
      { label: "Duplicate slide", icon: <CopyPlus />, kbd: "Ctrl D", onClick: () => dupAt(m.i) },
      { label: (it as Slide).img ? "Replace screenshot…" : "Upload screenshot…", icon: <ImageUp />, onClick: () => { setSel(m.i); replaceInput.current?.click(); } },
      "sep",
      { label: "Delete slide", icon: <Trash2 />, danger: true, disabled: n <= 1, onClick: () => delAt(m.i) },
    );
    return items;
  };

  const addFiles = async (files: FileList) => {
    const imgs = await Promise.all([...files].filter((f) => f.type.startsWith("image/")).map(readImg));
    if (!imgs.length) return;
    setWelcome(false);
    setTab("slide");
    // Dự án còn toàn màn mẫu → đổ ảnh vào các slide mẫu theo thứ tự (giữ chữ + layout đẹp sẵn), dư thì thêm slide mới
    if (allSample) {
      update((d) => {
        const slides = d.slides.map((s, i) => (imgs[i] ? { ...s, img: imgs[i] } : s));
        const extra: Slide[] = imgs.slice(d.slides.length).map((img, k) => ({ id: uid(), t: { en: ["Your headline here", "Describe this screen"] }, layout: "center", scale: 76, rx: 0, ry: 0, rz: 0, img, mock: d.slides.length + k }));
        return { ...d, slides: [...slides, ...extra] };
      });
      setSel(0);
      flash(`Placed ${imgs.length} screenshot${imgs.length > 1 ? "s" : ""} into the sample slides`, true);
      return;
    }
    const added: Slide[] = imgs.map((img, k) => ({ id: uid(), t: { en: ["Your headline here", "Describe this screen"] }, layout: "center", scale: 76, rx: 0, ry: 0, rz: 0, img, mock: n + k }));
    update((d) => ({ ...d, slides: [...d.slides, ...added] }));
    setSel(n + added.length - 1);
    flash(`Added ${added.length} slide${added.length > 1 ? "s" : ""}`, true);
  };

  const replace = async (f?: File) => {
    if (!f) return;
    const img = await readImg(f);
    update((d) => ({ ...d, slides: d.slides.map((s, i) => (i === idx ? { ...s, img } : s)) }));
  };
  // Đổi ảnh slide bất kỳ: chọn slide đó rồi mở hộp chọn file
  const replaceAt = (i: number) => { setSel(i); setTab("slide"); replaceInput.current?.click(); };

  const addSize = (z: SizePreset) => {
    update((d) => ({ ...d, customSizes: [...d.customSizes, z], store: z.store, sizeId: z.id }));
    setDialog("");
    flash(`Added ${z.name} · ${z.w}×${z.h}`);
  };

  return (
    <div className="app">
      <TopBar p={p} save={save} view={view} viewLocked={tab === "feature"} dark={dark} canUndo={canUndo} canRedo={canRedo}
        onStore={(store) => { update((d) => ({ ...d, store, sizeId: sizesOf(d, store)[0].id })); if (store === "ios") setTab("slide"); }}
        onSize={(sizeId) => {
          // Chọn cỡ ở menu Target: đổi luôn store theo cỡ đó (1 bước undo); về App Store thì rời Feature graphic
          const st = allSizes(p).find((z) => z.id === sizeId)?.store ?? p.store;
          update((d) => ({ ...d, sizeId, store: st }));
          if (st === "ios") setTab("slide");
        }}
        onName={(name) => update((d) => ({ ...d, name }))} onKeys={() => setDialog("keys")}
        onLoc={(loc) => update((d) => ({ ...d, loc }))}
        onView={setView} onUndo={undo} onRedo={redo} onDark={() => setDark(!dark)}
        onExport={() => setDialog("export")} onAddSize={() => setDialog("size")} />
      <div className="body">
        <SlideList p={p} sel={idx} tab={tab}
          onPick={(i) => { setSel(i); setTab("slide"); setPick("slide"); }}
          onFeature={() => { setTab("feature"); setPick("slide"); }}
          onMove={(from, to) => { update((d) => { const s = [...d.slides]; const [m] = s.splice(from, 1); s.splice(to, 0, m); return { ...d, slides: s }; }); setSel(to); }}
          onDelete={delAt} onDuplicate={dupAt} onReplace={replaceAt} onFiles={addFiles}
          pick={pick} onLayer={pickLayer} onToggleHidden={toggleHidden} onHover={setHov}
          onMenu={(x, y, i) => { setSel(i); setTab("slide"); setMenu({ x, y, i, target: null }); }}
          onUpload={() => addInput.current?.click()} />
        <Stage p={p} sel={idx} tab={tab} view={view} onFiles={addFiles}
          welcome={welcome && fresh && allSample} onUpload={() => addInput.current?.click()} onSkipWelcome={() => setWelcome(false)}
          onPick={(i) => { setSel(i); setTab("slide"); }}
          onNav={(d) => { setTab("slide"); setSel((idx + d + n) % n); }}
          edit={{ sel: pick, hover: hov, onSel: setPick, onPatch: patchCur }}
          onMenu={(x, y, i, target) => setMenu({ x, y, i, target })} />
        <Inspector p={p} sel={idx} tab={tab} update={update} pick={pick}
          onPickLayer={setPick} onToggleHidden={(l) => toggleHidden(idx, l)}
          onReplace={() => replaceInput.current?.click()} onReplaceFile={replace} onFlash={flash}
          onDuplicate={() => dupAt(idx)} />
      </div>
      <input ref={addInput} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
      <input ref={replaceInput} type="file" accept="image/*" hidden onChange={(e) => { replace(e.target.files?.[0]); e.target.value = ""; }} />
      {dialog === "size" && <SizeDialog p={p} onAdd={addSize} onClose={() => setDialog("")}
        onRemove={(id) => update((d) => { const customSizes = d.customSizes.filter((z) => z.id !== id); return { ...d, customSizes, sizeId: d.sizeId === id ? sizesOf({ ...d, customSizes }, d.store)[0].id : d.sizeId }; })} />}
      {dialog === "export" && <ExportDialog p={p} onClose={() => setDialog("")} onDone={(k) => flash(`Exported ${k} files`)} />}
      {dialog === "keys" && <KeysDialog onClose={() => setDialog("")} />}
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems(menu)} onClose={() => setMenu(null)} />}
      {toast && (
        <div className="toast" role="status">
          {toast.msg}
          {toast.undo && <button onClick={() => { undo(); setToast(null); }}>Undo</button>}
        </div>
      )}
      {/* Màn hẹp (<900px): editor cần chuột + màn rộng */}
      {!narrowOk && (
        <div className="narrow">
          <div className="logo"><span className="mark" />Pixstall</div>
          <h1>Best on a bigger screen</h1>
          <p>Pixstall is a desktop editor for App Store &amp; Google Play screenshots. Open it on a laptop or desktop to drag, tilt and export.</p>
          <button className="primary" onClick={() => { navigator.clipboard?.writeText(location.href); flash("Link copied"); }}>Copy link</button>
          <button className="ghost" onClick={() => setNarrowOk(true)}>Open anyway</button>
        </div>
      )}
    </div>
  );
}
