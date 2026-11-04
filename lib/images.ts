// Kho ảnh chụp: Blob trong IndexedDB (store "images", khoá = mã băm nội dung) + bộ đệm objectURL trong bộ nhớ
// Dự án chỉ lưu tham chiếu "img:<id>" → mỗi lần sửa chữ không phải ghi lại hàng chục MB ảnh, undo nhẹ
// Mỗi ảnh có bản thu nhỏ (360px) cho cột trái / hộp Export; ảnh cạnh dài >4000px được thu nhỏ ngay khi tải lên
// imgSrc(ref) đọc đồng bộ từ bộ đệm → phải gọi loadImages() trước khi vẽ (useProject làm lúc mở app)
// Chuỗi "data:..." (dự án cũ) vẫn vẽ được; useProject chuyển chúng vào kho khi nạp
"use client";
import { db } from "./storage";

const STORE = "images", MAX = 4000, THUMB = 360;
type Rec = { blob: Blob; thumb: Blob; w: number; h: number };

const full = new Map<string, string>(), small = new Map<string, string>(), meta = new Map<string, { w: number; h: number }>();
export const isRef = (s?: string | null): s is string => !!s && s.startsWith("img:");

// Đường dẫn để vẽ: thumb = true thì ưu tiên ảnh thu nhỏ
export function imgSrc(ref?: string | null, thumb = false): string {
  if (!ref) return "";
  if (!isRef(ref)) return ref;
  const id = ref.slice(4);
  return (thumb ? small.get(id) : undefined) ?? full.get(id) ?? "";
}
export const imgMeta = (ref?: string | null) => (isRef(ref) ? meta.get(ref.slice(4)) : undefined);

const run = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> => {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(STORE, mode), req = fn(t.objectStore(STORE));
    t.oncomplete = () => res(req.result as T);
    t.onerror = t.onabort = () => rej(t.error ?? req.error);
  });
};

async function hash(b: Blob) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", await b.arrayBuffer()));
  return [...d.slice(0, 12)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

// Vẽ lại ảnh với cạnh dài tối đa `side` (giữ nguyên nếu đã nhỏ hơn)
async function scaled(bmp: ImageBitmap, side: number, type: string, q?: number): Promise<Blob> {
  const r = Math.min(1, side / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * r); c.height = Math.round(bmp.height * r);
  const x = c.getContext("2d")!;
  x.imageSmoothingQuality = "high";
  x.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Encode failed"))), type, q));
}

function remember(id: string, r: Rec) {
  if (!full.has(id)) full.set(id, URL.createObjectURL(r.blob));
  if (!small.has(id)) small.set(id, URL.createObjectURL(r.thumb));
  meta.set(id, { w: r.w, h: r.h });
}

// Đưa ảnh vào kho (File, Blob hoặc dataURL cũ) → trả "img:<id>". Ảnh trùng nội dung dùng lại bản đã có
export async function putImage(src: Blob | string): Promise<string> {
  let blob = typeof src === "string" ? await (await fetch(src)).blob() : src;
  let bmp = await createImageBitmap(blob);
  if (Math.max(bmp.width, bmp.height) > MAX) {
    blob = await scaled(bmp, MAX, blob.type === "image/jpeg" ? "image/jpeg" : "image/png", 0.92);
    bmp.close(); bmp = await createImageBitmap(blob);
  }
  const id = await hash(blob);
  if (!full.has(id)) {
    const rec: Rec = { blob, thumb: await scaled(bmp, THUMB, "image/webp", 0.85), w: bmp.width, h: bmp.height };
    await run("readwrite", (s) => s.put(rec, id));
    remember(id, rec);
  }
  bmp.close();
  return "img:" + id;
}

// Lấy Blob gốc của ảnh (để đóng gói file dự án); không có thì null
export async function getImageBlob(ref: string): Promise<Blob | null> {
  if (!isRef(ref)) return null;
  const r = await run<Rec | undefined>("readonly", (s) => s.get(ref.slice(4))).catch(() => undefined);
  return r?.blob ?? null;
}

// Nạp các ảnh dự án đang dùng vào bộ đệm; ảnh mất (bị trình duyệt dọn) thì bỏ qua → vẽ rỗng
export async function loadImages(refs: string[]) {
  await Promise.all(refs.filter(isRef).map(async (ref) => {
    const id = ref.slice(4);
    if (full.has(id)) return;
    const r = await run<Rec | undefined>("readonly", (s) => s.get(id)).catch(() => undefined);
    if (r) remember(id, r);
  }));
}

// Dọn ảnh không còn dự án nào tham chiếu (gọi lúc mở app, sau khi nạp xong)
export async function gcImages(keep: string[]) {
  const ids = new Set(keep.filter(isRef).map((r) => r.slice(4)));
  const all = await run<IDBValidKey[]>("readonly", (s) => s.getAllKeys()).catch(() => []);
  await Promise.all(all.filter((k) => !ids.has(String(k))).map((k) => run("readwrite", (s) => s.delete(k)).catch(() => {})));
}
