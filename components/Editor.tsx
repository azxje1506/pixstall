// Editor chính Pixstall: ghép TopBar + SlideList + Stage + Inspector, giữ trạng thái UI (slide chọn, tab, hộp thoại)
"use client";
import { useEffect, useRef, useState } from "react";
import { useProject } from "@/lib/useProject";
import type { SizePreset, Slide, Feature, Project } from "@/lib/types";
import { uid } from "@/lib/presets";
import { sizesOf, allSizes } from "@/lib/rules";
import { TopBar } from "./TopBar";
import { SlideList } from "./SlideList";
import { Stage } from "./Stage";
import { Inspector } from "./Inspector";
import { SizeDialog, ExportDialog, KeysDialog, ReplaceDialog } from "./Dialogs";
import { packProject, unpackProject, fileNameOf, FILE_EXT } from "@/lib/projectFile";
import { download } from "@/lib/exporter";
import { normalizeProject } from "@/lib/useProject";
import { sampleProject } from "@/lib/presets";
import { TranslateDialog } from "./TranslateDialog";
import type { CanvasPick, LayerPick } from "./SlideCanvas";
import { alignPatch, alignManyPatch, alignUnitPatch, type AlignEdge } from "./SlideCanvas";
import { ContextMenu, type MenuItem } from "./Popover";
import { putImage } from "@/lib/images";
import { FilePlus2, FolderOpen, Save, Crop, CopyPlus, Trash2, ImageUp, RotateCcw, BringToFront, SendToBack, Heading, Type, Pilcrow, Tag } from "lucide-react";
import { isFeat, fToggleHidden, fRemoveLayer, fLayerName, fCanAdd, setFeatText, phoneIdx, phoneOf, nameOfLayer, isLayer, isText, isDeco, isDevice, posOf, withPos, posPatch, withPrune, groupOf, groupById, groupExact, expandGroups, makeGroup, ungroup, toggleHidden as toggleH, removeLayer, layerName, canAdd, type LayerId } from "@/lib/layers";
import { currentSize, themeOf, textOf } from "@/lib/rules";

// Ảnh tải lên → kho ảnh (thu nhỏ nếu >4000px), trả "img:<id>"; file hỏng thì bỏ qua
const readImg = (f: File) => putImage(f).catch(() => null);

export default function Editor() {
  const { p, update, undo, redo, canUndo, canRedo, save, fresh } = useProject();
  const [sel, setSel] = useState(0);
  const [tab, setTab] = useState<"slide" | "feature">("slide");
  const [view, setView] = useState<"strip" | "single">("strip");
  const [dark, setDark] = useState(false);
  const [dialog, setDialog] = useState<"" | "size" | "export" | "keys" | "tr">("");
  const [toast, setToast] = useState<{ msg: string; undo?: boolean } | null>(null);
  const toastT = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [welcome, setWelcome] = useState(true); // tắt sau khi user upload hoặc chọn xem mẫu
  const [narrowOk, setNarrowOk] = useState(false); // màn hẹp: user bấm "vẫn mở" 
  const [pick, setPick] = useState<CanvasPick>(null); // cấp đang chọn: null / slide / text / device
  const [multi, setMulti] = useState<LayerId[]>([]); // nhóm chọn ≥2 layer (Shift-click / kéo vùng); pick = layer mới nhất trong nhóm
  // Chọn đơn layer khác / về Slide → bỏ nhóm
  useEffect(() => { if (multi.length && (!isLayer(pick) || !multi.includes(pick))) setMulti([]); }, [pick, multi]);
  // Nhóm đang "vào trong" (double-click con): tự thoát khi chọn thứ nằm ngoài nhóm đó
  const [enter, setEnter] = useState<string | null>(null);
  const holder = tab === "feature" ? p.feature : p.slides[Math.min(sel, p.slides.length - 1)];
  useEffect(() => {
    if (!enter) return;
    const g = groupById(holder ?? {}, enter);
    if (!g || !isLayer(pick) || !g.ids.includes(pick) || multi.length > 1) setEnter(null);
  }, [enter, pick, multi, holder]);
  const setGroup = (ls: LayerId[]) => {
    if (ls.length > 1) { setMulti(ls); setPick(ls[ls.length - 1]); }
    else { setMulti([]); setPick(ls[0] ?? "slide"); }
  };
  const [hov, setHov] = useState<LayerPick | null>(null); // layer đang rê trên cây Layers
  const [crop, setCrop] = useState<LayerId | null>(null); // máy đang ở chế độ căn ảnh (double-click máy)
  useEffect(() => { if (crop && pick !== crop) setCrop(null); }, [pick, crop]); // chọn thứ khác → thoát căn ảnh
  const [menu, setMenu] = useState<{ x: number; y: number; i: number; target: CanvasPick } | null>(null); // menu chuột phải (i = -1: feature)
  const addInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const n = p.slides.length;
  const idx = Math.min(sel, n - 1);

  useEffect(() => { document.documentElement.classList.toggle("dark", dark); }, [dark]);
  // Đổi slide / tab → chọn cấp Slide của slide mới (không giữ layer của slide cũ)
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } setPick("slide"); }, [idx, tab]);
  // Chọn một layer của slide i (từ cây Layers). add = Shift/⌘-click: thêm/bớt vào nhóm chọn (chỉ trong slide đang mở)
  // Bấm dòng con của một nhóm = vào trong nhóm đó và chọn riêng con
  const pickLayer = (i: number, layer: CanvasPick, add?: boolean) => {
    const same = i === -1 ? tab === "feature" : tab === "slide" && i === idx;
    if (add && same && isLayer(layer)) {
      const cur = multi.length > 1 ? multi : isLayer(pick) ? [pick] : [];
      return setGroup(cur.includes(layer) ? cur.filter((x) => x !== layer) : [...cur, layer]);
    }
    if (i === -1) setTab("feature"); else { setSel(i); setTab("slide"); }
    const h = i === -1 ? p.feature : p.slides[i], g = isLayer(layer) && h ? groupOf(h, layer) : undefined;
    setTimeout(() => { setMulti([]); setPick(layer); if (g) setEnter(g.id); }, 0); // chạy sau effect đổi slide
  };
  // Chọn cả nhóm gid của slide i (dòng nhóm trên cây Layers)
  const pickGroup = (i: number, gid: string) => {
    if (i === -1) setTab("feature"); else { setSel(i); setTab("slide"); }
    const h = i === -1 ? p.feature : p.slides[i], g = h && groupById(h, gid);
    if (g) setTimeout(() => { setEnter(null); setGroup(g.ids as LayerId[]); }, 0);
  };
  const patchAt = (i: number, fn: (s: Slide) => Partial<Slide> | null, tag = "") => update((d) => ({ ...d, slides: d.slides.map((s, j) => { if (j !== i) return s; const x = fn(s); return x ? { ...s, ...x } : s; }) }), tag);
  // i = -1 → Feature graphic (mọi thao tác layer bên dưới)
  const patchF = (fn: (f: Feature) => Partial<Feature> | null) => update((d) => { const x = fn(d.feature); return x ? { ...d, feature: { ...d.feature, ...x } } : d; });
  const toggleHidden = (i: number, layer: LayerPick) => (i === -1 ? patchF((f) => fToggleHidden(f, layer)) : patchAt(i, (s) => toggleH(s, layer)));
  // Xoá layer chữ (Headline/Subtitle/App name/Tagline xoá nội dung ở mọi ngôn ngữ; chữ tự do bỏ hẳn) → về cấp trên, có Undo
  const removeAt = (i: number, layer: LayerId) => {
    if (i === -1) {
      if (!fRemoveLayer(p.feature, layer)) return;
      const nm = fLayerName(p.feature, layer);
      patchF((f) => withPrune(f, fRemoveLayer(f, layer)));
      setPick("slide");
      return flash(`${nm} removed`, true);
    }
    const s = p.slides[i]; if (!s || isDevice(layer)) return;
    const nm = layerName(s, layer);
    patchAt(i, (x) => withPrune(x, removeLayer(x, layer)));
    setPick("slide");
    flash(`${nm} removed`, true);
  };
  // Thêm layer chữ: Headline/Subtitle (khi đang thiếu) hoặc chữ tự do / nhãn pill đặt gần đáy slide
  const addText = (i: number, kind: "title" | "sub" | "text" | "badge") => {
    // Feature graphic: tên app / tagline điền chữ mẫu; chữ tự do đặt dưới khối chữ, badge ở góc trên
    if (i === -1) {
      const f = p.feature, t = p.theme, loc = p.loc;
      let id: LayerId;
      if (kind === "title" || kind === "sub") {
        const k = kind === "title" ? 0 : 1;
        patchF((x) => ({ ...setFeatText(x, loc, k, k ? "Your tagline here" : "Your App"), hidden: { ...x.hidden, [kind]: false } }));
        id = kind;
      } else {
        const xid = uid(), pill = kind === "badge", left = (f.layout ?? "split") === "split";
        const item = { id: xid, t: { [loc]: pill ? "NEW" : "Available now" }, x: left ? (pill ? 12 : 26) : 50, y: pill ? 6 : 43, size: pill ? 2.4 : t.tsize * 0.36, weight: pill ? 700 : 600, pill };
        patchF((x) => ({ extras: [...(x.extras ?? []), item] }));
        id = `x:${xid}`;
      }
      return pickLayer(-1, id);
    }
    const s = p.slides[i]; if (!s) return;
    const loc = p.loc, z = currentSize(p), hEm = (100 * z.h) / z.w, t = themeOf(p, s);
    let id: LayerId;
    if (kind === "title" || kind === "sub") {
      const k = kind === "title" ? 0 : 1, cur = [...(s.t[loc] ?? s.t.en ?? ["", ""])] as [string, string];
      cur[k] = kind === "title" ? "Your headline here" : "Describe this screen";
      patchAt(i, () => ({ t: { ...s.t, [loc]: cur } }));
      id = kind;
    } else {
      const xid = uid(), pill = kind === "badge";
      // Chỗ đặt mặc định: badge ngay trên tiêu đề; chữ thường ở khe giữa khối chữ và máy (layout chữ-dưới thì đặt sát đỉnh)
      const [tt, ss] = textOf(s, loc), padT = z.kind === "tablet" ? 6 : 9, sub = t.tsize * t.ssize;
      const textBottom = padT + (tt ? t.tsize * 2.35 : 0) + (ss ? sub * (tt ? 3.3 : 1.9) : 0);
      const y = pill ? Math.max(2.5, padT - 3) : s.layout === "bottom" ? Math.max(4, padT - 2) : textBottom + 2;
      const item = { id: xid, t: { [loc]: pill ? "NEW" : "Add a short note" }, x: 50, y: Math.min(y, hEm - 4), size: pill ? t.tsize * 0.36 : t.tsize * 0.42, weight: pill ? 700 : 600, pill };
      patchAt(i, (x) => ({ extras: [...(x.extras ?? []), item] }));
      id = `x:${xid}`;
    }
    pickLayer(i, id);
  };
  const addItems = (i: number): MenuItem[] => {
    const s = i === -1 ? p.feature : p.slides[i]; if (!s) return [];
    const can = isFeat(s) ? fCanAdd(s, p.loc) : canAdd(s, p.loc), fe = i === -1;
    return [
      { label: fe ? "App name" : "Headline", icon: <Heading />, disabled: !can.title || (fe && p.feature.layout === "phones"), onClick: () => addText(i, "title") },
      { label: fe ? "Tagline" : "Subtitle", icon: <Pilcrow />, disabled: !can.sub || (fe && p.feature.layout === "phones"), onClick: () => addText(i, "sub") },
      "sep",
      { label: "Text", icon: <Type />, onClick: () => addText(i, "text") },
      { label: "Badge", icon: <Tag />, onClick: () => addText(i, "badge") },
    ];
  };

  // --- File dự án .pixstall: lưu / mở / tạo mới ---
  const openInput = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState<{ kind: "open"; file: File } | { kind: "new" } | null>(null);
  const [busy, setBusy] = useState(false);
  const savedRef = useRef<Project | null>(null); // dự án lúc lưu file gần nhất (để biết đã có thay đổi chưa)
  const curName = p.name || p.feature.name || "Untitled";
  const saveFile = async () => {
    if (busy) return; setBusy(true);
    try {
      const { blob, images, missing } = await packProject(p);
      download(blob, fileNameOf(p));
      savedRef.current = p;
      flash(`Saved ${fileNameOf(p)} · ${images} image${images === 1 ? "" : "s"}${missing ? ` · ${missing} missing` : ""}`);
    } catch { flash("Couldn't save the project file"); }
    setBusy(false);
  };
  const doOpen = async (file: File) => {
    setConfirm(null); setBusy(true);
    try {
      const proj = normalizeProject(await unpackProject(file));
      update(() => proj);
      savedRef.current = null;
      setSel(0); setTab("slide"); setPick(null); setWelcome(false);
      flash(`Opened ${proj.name || file.name.replace(FILE_EXT, "")}`, true);
    } catch (e) { flash(e instanceof Error ? e.message : "Couldn't open that file"); }
    setBusy(false);
  };
  const doNew = () => {
    setConfirm(null);
    update(() => ({ ...sampleProject(), name: "Untitled" }));
    savedRef.current = null;
    setSel(0); setTab("slide"); setPick(null); setWelcome(true);
    flash("New project", true);
  };
  // Dự án đang là mẫu chưa đụng tới (hoặc vừa lưu file, chưa sửa) thì khỏi hỏi
  const untouched = () => savedRef.current === p || (!p.name && p.slides.every((s) => !s.img) && !canUndo);
  const askOpen = (file: File) => (untouched() ? doOpen(file) : setConfirm({ kind: "open", file }));
  const askNew = () => (untouched() ? doNew() : setConfirm({ kind: "new" }));
  const fileItems: MenuItem[] = [
    { label: "New project", icon: <FilePlus2 />, onClick: askNew },
    { label: "Open…", icon: <FolderOpen />, kbd: "Ctrl O", onClick: () => openInput.current?.click() },
    "sep",
    { label: "Save to file", icon: <Save />, kbd: "Ctrl S", disabled: busy, onClick: saveFile },
  ];

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
      // Ctrl/⌘+S lưu file, Ctrl/⌘+O mở file — chặn hộp lưu trang của trình duyệt; đang gõ thì chốt ô trước
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key.toLowerCase() === "s" || e.key.toLowerCase() === "o")) {
        e.preventDefault(); (document.activeElement as HTMLElement)?.blur?.();
        if (e.key.toLowerCase() === "s") setTimeout(saveFile, 0); else openInput.current?.click();
        return;
      }
      if (typing) return;
      if (e.key === "?" && !dialog) { e.preventDefault(); setDialog("keys"); return; }
      const H = tab === "feature" ? p.feature : p.slides[idx]; // slide/feature đang sửa
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") { e.preventDefault(); if (tab === "slide") dupAt(idx); return; }
      // Esc lùi 1 cấp: layer → slide → không chọn (đang gõ chữ thì ô chữ tự xử lý Esc)
      // Đang ở trong nhóm → Esc chọn lại cả nhóm; lần nữa → về Slide
      if (e.key === "Escape") {
        if (crop) return setCrop(null);
        const g = groupById(H, enter);
        if (g && multi.length < 2) { setEnter(null); return setGroup(g.ids as LayerId[]); }
        return setPick((x) => (isLayer(x) ? "slide" : null));
      }
      // Delete / Backspace: xoá layer chữ đang chọn
      // Ctrl/⌘+G gom nhóm · Ctrl/⌘+Shift+G rã nhóm (nhóm đang chọn, hoặc nhóm chứa layer đang chọn)
      if ((e.metaKey || e.ctrlKey) && e.code === "KeyG") {
        e.preventDefault();
        if (e.shiftKey) {
          const g = groupExact(H, multi) ?? (isLayer(pick) ? groupOf(H, pick) : undefined);
          if (!g) return;
          patchCur(ungroup(H, g.id), "ungroup"); setEnter(null); setGroup(g.ids as LayerId[]); flash(`${g.name} ungrouped`, true);
        } else if (multi.length > 1) {
          const ls = expandGroups(H, multi), pt = makeGroup(H, ls, uid());
          patchCur(pt, "group"); setGroup(ls); flash(`${pt.groups[pt.groups.length - 1].name} created · double-click to edit inside`, true);
        } else flash("Select 2 or more layers to group (Shift-click or drag a box)");
        return;
      }
      // Alt + A/H/D (trái/giữa/phải) · W/V/S (trên/giữa/dưới): 1 layer hoặc cả nhóm → theo khung; nhiều layer rời → theo khung bao chọn
      const AK: Record<string, AlignEdge> = { KeyA: "left", KeyH: "hcenter", KeyD: "right", KeyW: "top", KeyV: "vcenter", KeyS: "bottom" };
      if (e.altKey && !e.metaKey && !e.ctrlKey && AK[e.code] && isLayer(pick)) {
        e.preventDefault();
        const edge = AK[e.code], ls = multi.length > 1 ? multi : [pick];
        const pt = ls.length === 1 ? alignPatch(H, pick, edge) : groupExact(H, ls) ? alignUnitPatch(H, ls, edge) : alignManyPatch(H, ls, edge, false);
        if (pt) { document.body.classList.add("ed-anim"); patchCur(pt, "align"); setTimeout(() => document.body.classList.remove("ed-anim"), 240); }
        return;
      }
      // Ctrl/⌘+A: chọn mọi layer đang hiện trên slide/feature
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        const ids = [...document.querySelectorAll<HTMLElement>(".slidewrap.on [data-cv] [data-pick]")].filter((x) => getComputedStyle(x).visibility !== "hidden").map((x) => x.dataset.pick as LayerId);
        setGroup(ids); return;
      }
      // Nhóm chọn: Delete xoá mọi chữ/trang trí trong nhóm (máy thì bỏ qua) — một bước Undo; mũi tên nhích cả nhóm
      if (multi.length > 1) {
        const F = tab === "feature", cur = F ? p.feature : p.slides[idx];
        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          const del = multi.filter((l) => isText(l) || isDeco(l));
          if (!del.length) return;
          const fold = <T,>(h: T, fn: (x: T, l: LayerId) => Partial<T> | null) => { let x = h; const out: Partial<T> = {}; for (const l of del) { const pt = fn(x, l); if (pt) { Object.assign(out, pt); x = { ...x, ...pt }; } } return out; };
          if (F) patchF((f) => withPrune(f, fold(f, fRemoveLayer))); else patchAt(idx, (s) => withPrune(s, fold(s, removeLayer)));
          setPick("slide"); flash(`${del.length} layers deleted`, true); return;
        }
        const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
        if (d) {
          e.preventDefault();
          const st = e.shiftKey ? 2 : 0.5, r = (v: number) => Math.round(v * 10) / 10;
          patchCur(posPatch(cur, multi.map((l) => { const [x, y] = posOf(cur, l); return [l, r(x + d[0] * st), r(y + d[1] * st)] as const; })), "nudge");
          return;
        }
      }
      if ((e.key === "Delete" || e.key === "Backspace") && (isText(isLayer(pick) ? pick : null) || isDeco(isLayer(pick) ? pick : null))) { e.preventDefault(); removeAt(tab === "feature" ? -1 : idx, pick as LayerId); return; }
      const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!dir) return;
      if (isLayer(pick)) {
        e.preventDefault();
        const st = e.shiftKey ? 2 : 0.5, s = tab === "feature" ? p.feature : p.slides[idx];
        const [x, y] = posOf(s, pick), r = (v: number) => Math.round(v * 10) / 10;
        patchCur(withPos(s, pick, r(x + dir[0] * st), r(y + dir[1] * st)), "nudge");
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
    const front = it.front ?? "text";
    const tg = isLayer(m.target) ? m.target : null, grp = isDevice(tg) ? "device" : "text";
    const name = isDevice(tg) ? "device" : "text";
    const items: MenuItem[] = [];
    if (tg) items.push(
      { label: `Bring ${name} to front`, icon: <BringToFront />, disabled: front === grp, onClick: () => patch({ front: grp }) },
      { label: `Send ${name} to back`, icon: <SendToBack />, disabled: front !== grp, onClick: () => patch({ front: grp === "device" ? "text" : "device" }) },
      "sep",
    );
    // Đặt lại vị trí: của đúng layer (chữ tự do không có vị trí gốc) hoặc mọi layer khi bấm nền
    const sl = it as Slide;
    const moved = tg ? !tg.startsWith("x:") && posOf(it, tg).some(Boolean) : !!(it.dx || it.dy || it.tx || it.ty || (!isF && (sl.sx || sl.sy)));
    items.push({ label: "Reset position", icon: <RotateCcw />, disabled: !moved, onClick: () => patch(tg ? withPos(it, tg, 0, 0) : { dx: 0, dy: 0, tx: 0, ty: 0, sx: 0, sy: 0 }) });
    // Căn ảnh: máy chính, máy 2 của Duo (ảnh riêng) hoặc máy Feature graphic có ảnh riêng
    const canCrop = tg && (isF ? !!phoneOf(p.feature, phoneIdx(tg)).img && phoneIdx(tg) >= 0 : (tg === "device" && !!sl.img) || (tg === "device2" && !!sl.img2));
    if (canCrop && tg) items.push({ label: crop === tg ? "Done adjusting image" : "Adjust image…", icon: <Crop />, kbd: "Dbl-click", onClick: () => setCrop(crop === tg ? null : tg) });
    if (tg && !isDevice(tg) && tg !== "icon") items.push({ label: `Delete ${nameOfLayer(it, tg).toLowerCase()}`, icon: <Trash2 />, kbd: "Del", danger: true, onClick: () => removeAt(m.i, tg) });
    if (!tg) items.push("sep", ...addItems(m.i).map((x) => (x === "sep" ? x : { ...x, label: `Add ${x.label.toLowerCase()}` })));
    if (!isF) items.push(
      "sep",
      { label: "Duplicate slide", icon: <CopyPlus />, kbd: "Ctrl D", onClick: () => dupAt(m.i) },
      { label: (it as Slide).img ? "Replace screenshot…" : "Upload screenshot…", icon: <ImageUp />, onClick: () => { setSel(m.i); pickFile("img"); } },
      "sep",
      { label: "Delete slide", icon: <Trash2 />, danger: true, disabled: n <= 1, onClick: () => delAt(m.i) },
    );
    return items;
  };

  const addFiles = async (files: FileList) => {
    // Thả file .pixstall vào app → mở dự án thay vì thêm ảnh
    const proj = [...files].find((f) => f.name.toLowerCase().endsWith(FILE_EXT));
    if (proj) return askOpen(proj);
    const imgs = (await Promise.all([...files].filter((f) => f.type.startsWith("image/")).map(readImg))).filter((x): x is string => !!x);
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

  // Thay ảnh của slide đang chọn: k = "img" (máy chính) hoặc "img2" (máy 2 của Duo); ảnh mới thì về vị trí/zoom mặc định
  const target = useRef<"img" | "img2">("img");
  const replace = async (f?: File, k: "img" | "img2" = target.current) => {
    if (!f) return;
    const img = await readImg(f);
    if (!img) return flash("Couldn't read that image");
    update((d) => ({ ...d, slides: d.slides.map((s, i) => (i === idx ? { ...s, [k]: img, ...(k === "img" ? { ix: 0, iy: 0, iz: 1 } : {}) } : s)) }));
  };
  const pickFile = (k: "img" | "img2" = "img") => { target.current = k; replaceInput.current?.click(); };
  // Đổi ảnh slide bất kỳ: chọn slide đó rồi mở hộp chọn file
  const replaceAt = (i: number) => { setSel(i); setTab("slide"); pickFile("img"); };

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
        onName={(name) => update((d) => ({ ...d, name }))} onKeys={() => setDialog("keys")} onTranslate={() => setDialog("tr")} fileItems={fileItems}
        onLoc={(loc) => update((d) => ({ ...d, loc }))}
        onView={setView} onUndo={undo} onRedo={redo} onDark={() => setDark(!dark)}
        onExport={() => setDialog("export")} onAddSize={() => setDialog("size")} />
      <div className="body">
        <SlideList p={p} sel={idx} tab={tab}
          onPick={(i) => { setSel(i); setTab("slide"); setPick("slide"); }}
          onFeature={() => { setTab("feature"); setPick("slide"); }}
          onMove={(from, to) => { update((d) => { const s = [...d.slides]; const [m] = s.splice(from, 1); s.splice(to, 0, m); return { ...d, slides: s }; }); setSel(to); }}
          onDelete={delAt} onDuplicate={dupAt} onReplace={replaceAt} onFiles={addFiles}
          pick={pick} multi={multi} onLayer={pickLayer} onGroup={pickGroup} onToggleHidden={toggleHidden} onHover={setHov}
          onRemoveLayer={(i, l) => removeAt(i, l)} addItems={addItems}
          onMenu={(x, y, i) => { setSel(i); setTab("slide"); setMenu({ x, y, i, target: null }); }}
          onUpload={() => addInput.current?.click()} />
        <Stage p={p} sel={idx} tab={tab} view={view} onFiles={addFiles}
          welcome={welcome && fresh && allSample} onUpload={() => addInput.current?.click()} onSkipWelcome={() => setWelcome(false)} onOpenFile={() => openInput.current?.click()}
          onPick={(i) => { setSel(i); setTab("slide"); }}
          onNav={(d) => { setTab("slide"); setSel((idx + d + n) % n); }}
          edit={{ sel: pick, hover: hov, onSel: setPick, onPatch: patchCur, crop, onCrop: setCrop, multi, onMulti: setGroup, groups: holder?.groups, enter, onEnter: setEnter }}
          onMenu={(x, y, i, target) => setMenu({ x, y, i, target })} />
        <Inspector p={p} sel={idx} tab={tab} update={update} pick={pick} multi={multi} onMulti={setGroup} enter={enter} onPickGroup={(gid) => pickGroup(tab === "feature" ? -1 : idx, gid)}
          onPickRow={(l, add) => pickLayer(tab === "feature" ? -1 : idx, l, add)}
          onPickLayer={setPick} onToggleHidden={(l) => toggleHidden(tab === "feature" ? -1 : idx, l)}
          onRemoveLayer={(l) => removeAt(tab === "feature" ? -1 : idx, l)} addItems={() => addItems(tab === "feature" ? -1 : idx)}
          crop={crop} onCrop={(l) => { if (l) setPick(l); setCrop(l); }}
          onReplace={pickFile} onReplaceFile={(f, k) => replace(f, k)} onFlash={flash}
          onDuplicate={() => dupAt(idx)} />
      </div>
      <input ref={addInput} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
      <input ref={replaceInput} type="file" accept="image/*" hidden onChange={(e) => { replace(e.target.files?.[0]); e.target.value = ""; }} />
      {dialog === "size" && <SizeDialog p={p} onAdd={addSize} onClose={() => setDialog("")}
        onRemove={(id) => update((d) => { const customSizes = d.customSizes.filter((z) => z.id !== id); return { ...d, customSizes, sizeId: d.sizeId === id ? sizesOf({ ...d, customSizes }, d.store)[0].id : d.sizeId }; })} />}
      {dialog === "export" && <ExportDialog p={p} onClose={() => setDialog("")} onDone={(k) => flash(`Exported ${k} files`)} />}
      {dialog === "keys" && <KeysDialog onClose={() => setDialog("")} />}
      {dialog === "tr" && <TranslateDialog p={p} update={update} onFlash={flash} onClose={() => setDialog("")} />}
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems(menu)} onClose={() => setMenu(null)} />}
      <input ref={openInput} type="file" accept={`${FILE_EXT},application/zip`} hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) askOpen(f); }} />
      {confirm && <ReplaceDialog current={curName}
        title={confirm.kind === "open" ? `Open ${confirm.file.name}?` : "Start a new project?"}
        confirmLabel={confirm.kind === "open" ? "Open" : "Start new"}
        onClose={() => setConfirm(null)}
        onSaveFirst={async () => { const c = confirm; await saveFile(); if (c.kind === "open") doOpen(c.file); else doNew(); }}
        onConfirm={() => (confirm.kind === "open" ? doOpen(confirm.file) : doNew())} />}
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
