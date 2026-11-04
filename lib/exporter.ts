// Xuất ảnh thật ngay trên trình duyệt: render từng slide ở ĐÚNG pixel vào vùng ẩn → html-to-image → JSZip
// PNG được mã hoá lại thành RGB 3 kênh (không alpha) để App Store không từ chối
// Cấu trúc ZIP: <store>/<tên-cỡ>_<w>x<h>/<locale>/01.png … + google-play/feature-graphic_1024x500
"use client";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import type { Project, SizePreset } from "./types";
import { FEATURE_SIZE, LIMIT } from "./presets";
import { SlideCanvas, FeatureCanvas } from "@/components/SlideCanvas";

export interface ExportOptions {
  sizes: SizePreset[];
  locales: string[];
  format: "png" | "jpg";
  feature: boolean;
}

const slug = (s: string) => s.toLowerCase().replace(/"/g, "in").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const wait = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

export function planFiles(p: Project, o: ExportOptions): string[] {
  const files: string[] = [];
  for (const z of o.sizes) {
    const max = Math.min(p.slides.length, LIMIT[z.store][1]);
    for (const l of o.locales) for (let i = 0; i < max; i++)
      files.push(`${z.store === "ios" ? "app-store" : "google-play"}/${slug(z.name)}_${z.w}x${z.h}/${l}/${String(i + 1).padStart(2, "0")}.${o.format}`);
  }
  if (o.feature) files.push(`google-play/feature-graphic_${FEATURE_SIZE.w}x${FEATURE_SIZE.h}.${o.format}`);
  return files;
}

// signal: bấm Huỷ → ném lỗi "Cancelled" ở ảnh kế tiếp, dọn vùng ẩn trong finally
export async function exportZip(p: Project, o: ExportOptions, onProgress: (done: number, total: number) => void, signal?: AbortSignal): Promise<Blob> {
  const [{ toCanvas }, { default: JSZip }, { encode }] = await Promise.all([import("html-to-image"), import("jszip"), import("fast-png")]);
  const zip = new JSZip();
  const files = planFiles(p, o);
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-200000px;top:0;pointer-events:none";
  document.body.appendChild(host);
  const root = createRoot(host);
  await document.fonts.ready;

  // Chụp node → canvas đúng pixel → JPG (không alpha sẵn) hoặc PNG RGB tự mã hoá
  const snap = async (w: number, h: number): Promise<Blob | Uint8Array> => {
    const node = host.firstElementChild as HTMLElement;
    await Promise.all([...node.querySelectorAll("img")].map((im) => im.decode().catch(() => {})));
    await wait();
    // KHÔNG truyền backgroundColor: html-to-image gán nó thẳng lên node gốc → đè mất nền "Color" của slide.
    // Chụp xong mới trải lên nền trắng (bỏ vùng trong suốt) để ảnh luôn đặc, không alpha
    const shot = await toCanvas(node, { width: w, height: h, canvasWidth: w, canvasHeight: h, pixelRatio: 1 });
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const cx = canvas.getContext("2d")!;
    cx.fillStyle = "#ffffff"; cx.fillRect(0, 0, w, h); cx.drawImage(shot, 0, 0);
    if (o.format === "jpg") {
      return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Render failed"))), "image/jpeg", 0.95));
    }
    const rgba = canvas.getContext("2d")!.getImageData(0, 0, w, h).data;
    const rgb = new Uint8Array(w * h * 3);
    for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) { rgb[j] = rgba[i]; rgb[j + 1] = rgba[i + 1]; rgb[j + 2] = rgba[i + 2]; }
    return encode({ width: w, height: h, data: rgb, channels: 3, depth: 8 });
  };

  try {
    let k = 0;
    for (const z of o.sizes) {
      const max = Math.min(p.slides.length, LIMIT[z.store][1]);
      const proj = { ...p, store: z.store };
      for (const l of o.locales) for (let i = 0; i < max; i++) {
        if (signal?.aborted) throw new Error("Cancelled");
        flushSync(() => root.render(createElement(SlideCanvas, { p: proj, index: i, width: z.w, size: z, loc: l })));
        zip.file(files[k], await snap(z.w, z.h));
        onProgress(++k, files.length);
      }
    }
    if (o.feature) {
      if (signal?.aborted) throw new Error("Cancelled");
      flushSync(() => root.render(createElement(FeatureCanvas, { p, width: FEATURE_SIZE.w, loc: o.locales[0] ?? p.loc })));
      zip.file(files[k], await snap(FEATURE_SIZE.w, FEATURE_SIZE.h));
      onProgress(++k, files.length);
    }
  } finally {
    root.unmount();
    host.remove();
  }
  return zip.generateAsync({ type: "blob" });
}

export function download(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
