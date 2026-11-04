// File dự án .pixstall = ZIP (không nén lại ảnh) gồm:
//   project.json  { app: "pixstall", format, savedAt, project }   — dự án y như trong IndexedDB, ảnh là "img:<id>"
//   images/<id>   Blob ảnh gốc (id = mã băm nội dung, xem lib/images.ts)
// Mở file: đưa từng ảnh vào kho (cùng nội dung → cùng id), đổi các "img:<id>" cũ sang id mới nếu khác, nạp bộ đệm rồi trả dự án
"use client";
import type { Project } from "./types";
import { getImageBlob, putImage, isRef, loadImages } from "./images";
import { refsOf } from "./useProject";

export const FILE_EXT = ".pixstall";
const FORMAT = 1; // tăng khi đổi cấu trúc file; file mới hơn bản app thì báo lỗi rõ ràng

export const fileNameOf = (p: Project) =>
  ((p.name || p.feature.name || "untitled").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "untitled") + FILE_EXT;

// Đổi mọi chuỗi "img:<id>" trong object lồng nhau theo bảng map
function remap<T>(v: T, map: Map<string, string>): T {
  if (typeof v === "string") return (map.get(v) ?? v) as T;
  if (Array.isArray(v)) return v.map((x) => remap(x, map)) as T;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, remap(x, map)])) as T;
  return v;
}

// Đóng gói dự án + ảnh thành 1 Blob .pixstall; missing = số ảnh không còn trong kho (bị trình duyệt dọn)
export async function packProject(p: Project): Promise<{ blob: Blob; images: number; missing: number }> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const refs = [...new Set(refsOf(p).filter(isRef))];
  let missing = 0;
  for (const ref of refs) {
    const b = await getImageBlob(ref);
    if (b) zip.file(`images/${ref.slice(4)}`, b); else missing++;
  }
  zip.file("project.json", JSON.stringify({ app: "pixstall", format: FORMAT, savedAt: new Date().toISOString(), project: p }));
  const blob = await zip.generateAsync({ type: "blob", compression: "STORE", mimeType: "application/zip" });
  return { blob, images: refs.length - missing, missing };
}

// Mở file .pixstall → dự án (chưa chuẩn hoá; gọi normalizeProject sau). Ném lỗi có câu dễ hiểu nếu file sai
export async function unpackProject(file: Blob): Promise<Partial<Project>> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(file).catch(() => { throw new Error("This isn't a Pixstall project file"); });
  const meta = zip.file("project.json");
  if (!meta) throw new Error("This isn't a Pixstall project file");
  const data = JSON.parse(await meta.async("string"));
  if (data?.app !== "pixstall" || !data.project?.slides) throw new Error("This isn't a Pixstall project file");
  if ((data.format ?? 1) > FORMAT) throw new Error("This file was made with a newer Pixstall — reload the page to update");
  const map = new Map<string, string>();
  for (const f of Object.values(zip.files)) {
    if (f.dir || !f.name.startsWith("images/")) continue;
    const ref = await putImage(await f.async("blob")).catch(() => null);
    if (ref) map.set("img:" + f.name.slice(7), ref);
  }
  const proj = remap(data.project as Partial<Project>, map);
  await loadImages(refsOf(proj as Project));
  return proj;
}
