// Lưu dự án vào IndexedDB (chứa được ảnh lớn, hàng trăm MB) thay cho localStorage (~5MB, đầy là lỗi ngầm)
// Store "kv" khoá "project" (chỉ JSON, ảnh nằm ở store "images" — lib/images.ts). Lần đầu tự chuyển dữ liệu cũ từ localStorage sang rồi xoá bản cũ.
"use client";
import type { Project } from "./types";

const DB = "pixstall", STORE = "kv", KEY = "project";
const LEGACY = "pixstall:project:v1";

let dbp: Promise<IDBDatabase> | null = null;
export function db(): Promise<IDBDatabase> {
  if (!dbp) dbp = new Promise((res, rej) => {
    // v2: thêm store "images" (kho ảnh, xem lib/images.ts)
    const r = indexedDB.open(DB, 2);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
      if (!d.objectStoreNames.contains("images")) d.createObjectStore("images");
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}

const tx = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> => {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(STORE, mode), req = fn(t.objectStore(STORE));
    t.oncomplete = () => res(req.result as T);
    t.onerror = t.onabort = () => rej(t.error ?? req.error);
  });
};

// Đọc dự án: IndexedDB trước, không có thì lấy bản cũ ở localStorage (và chuyển sang)
export async function loadProject(): Promise<Partial<Project> | null> {
  const got = await tx<Partial<Project> | undefined>("readonly", (s) => s.get(KEY)).catch(() => undefined);
  if (got) return got;
  try {
    const raw = localStorage.getItem(LEGACY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    await saveProject(p);
    localStorage.removeItem(LEGACY);
    return p;
  } catch { return null; }
}

// Ghi dự án; ném lỗi nếu thất bại (đầy ổ / chế độ ẩn danh) để UI báo cho user
export async function saveProject(p: Project): Promise<void> {
  await tx("readwrite", (s) => s.put(p, KEY));
}

// Xin trình duyệt giữ dữ liệu lâu dài (không tự dọn khi thiếu chỗ)
export const askPersist = () => navigator.storage?.persist?.().catch(() => false);
