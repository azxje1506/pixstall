// Editor chính Pixstall: ghép TopBar + SlideList + Stage + Inspector, giữ trạng thái UI (slide chọn, tab, hộp thoại)
"use client";
import { useEffect, useRef, useState } from "react";
import { useProject } from "@/lib/useProject";
import type { SizePreset, Slide } from "@/lib/types";
import { uid } from "@/lib/presets";
import { sizesOf } from "@/lib/rules";
import { TopBar } from "./TopBar";
import { SlideList } from "./SlideList";
import { Stage } from "./Stage";
import { Inspector } from "./Inspector";
import { SizeDialog, ExportDialog } from "./Dialogs";

const readImg = (f: File) => new Promise<string>((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(f); });

export default function Editor() {
  const { p, update, undo, redo, canUndo, canRedo } = useProject();
  const [sel, setSel] = useState(0);
  const [tab, setTab] = useState<"slide" | "feature">("slide");
  const [view, setView] = useState<"strip" | "single">("strip");
  const [dark, setDark] = useState(false);
  const [dialog, setDialog] = useState<"" | "size" | "export">("");
  const [toast, setToast] = useState("");
  const addInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const n = p.slides.length;
  const idx = Math.min(sel, n - 1);

  useEffect(() => { document.documentElement.classList.toggle("dark", dark); }, [dark]);

  // Phím tắt: Ctrl+Z / Ctrl+Shift+Z, ←/→ lật slide (khi không gõ chữ)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest("input,textarea,select");
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { if (typing) return; e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if (!typing && e.key === "ArrowRight") { setTab("slide"); setSel((s) => (s + 1) % n); }
      else if (!typing && e.key === "ArrowLeft") { setTab("slide"); setSel((s) => (s - 1 + n) % n); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, n]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2800); };

  const addFiles = async (files: FileList) => {
    const imgs = await Promise.all([...files].filter((f) => f.type.startsWith("image/")).map(readImg));
    if (!imgs.length) return;
    const fresh: Slide[] = imgs.map((img, k) => ({ id: uid(), t: { en: ["Your headline here", "Describe this screen"] }, layout: "center", scale: 76, rx: 0, ry: 0, rz: 0, img, mock: n + k }));
    update((d) => ({ ...d, slides: [...d.slides, ...fresh] }));
    setSel(n + fresh.length - 1);
    setTab("slide");
  };

  const replace = async (f?: File) => {
    if (!f) return;
    const img = await readImg(f);
    update((d) => ({ ...d, slides: d.slides.map((s, i) => (i === idx ? { ...s, img } : s)) }));
  };

  const addSize = (z: SizePreset) => {
    update((d) => ({ ...d, customSizes: [...d.customSizes, z], store: z.store, sizeId: z.id }));
    setDialog("");
    flash(`Added ${z.name} · ${z.w}×${z.h}`);
  };

  return (
    <div className="app">
      <TopBar p={p} view={view} dark={dark} canUndo={canUndo} canRedo={canRedo}
        onStore={(store) => { update((d) => ({ ...d, store, sizeId: sizesOf(d, store)[0].id })); if (store === "ios") setTab("slide"); }}
        onSize={(sizeId) => update((d) => ({ ...d, sizeId }))}
        onLoc={(loc) => update((d) => ({ ...d, loc }))}
        onView={setView} onUndo={undo} onRedo={redo} onDark={() => setDark(!dark)}
        onExport={() => setDialog("export")} onAddSize={() => setDialog("size")} />
      <div className="body">
        <SlideList p={p} sel={idx} tab={tab}
          onPick={(i) => { setSel(i); setTab("slide"); }}
          onFeature={() => setTab("feature")}
          onMove={(from, to) => { update((d) => { const s = [...d.slides]; const [m] = s.splice(from, 1); s.splice(to, 0, m); return { ...d, slides: s }; }); setSel(to); }}
          onDelete={() => { if (n <= 1) return flash("Keep at least one slide"); update((d) => ({ ...d, slides: d.slides.filter((_, i) => i !== idx) })); setSel(Math.max(0, idx - 1)); }}
          onUpload={() => addInput.current?.click()} />
        <Stage p={p} sel={idx} tab={tab} view={view} onFiles={addFiles}
          onPick={(i) => { setSel(i); setTab("slide"); }}
          onNav={(d) => { setTab("slide"); setSel((idx + d + n) % n); }} />
        <Inspector p={p} sel={idx} tab={tab} update={update}
          onReplace={() => replaceInput.current?.click()}
          onDuplicate={() => { update((d) => { const s = [...d.slides]; s.splice(idx + 1, 0, { ...structuredClone(d.slides[idx]), id: uid() }); return { ...d, slides: s }; }); setSel(idx + 1); }} />
      </div>
      <input ref={addInput} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
      <input ref={replaceInput} type="file" accept="image/*" hidden onChange={(e) => { replace(e.target.files?.[0]); e.target.value = ""; }} />
      {dialog === "size" && <SizeDialog p={p} onAdd={addSize} onClose={() => setDialog("")}
        onRemove={(id) => update((d) => { const customSizes = d.customSizes.filter((z) => z.id !== id); return { ...d, customSizes, sizeId: d.sizeId === id ? sizesOf({ ...d, customSizes }, d.store)[0].id : d.sizeId }; })} />}
      {dialog === "export" && <ExportDialog p={p} onClose={() => setDialog("")} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
