// Hook trạng thái dự án: undo/redo (gộp các thay đổi liên tiếp cùng nhãn, vd kéo slider) + tự lưu IndexedDB
// `save` = trạng thái lưu cho thanh trên: loading → saved / saving / error
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Project } from "./types";
import { sampleProject, DEFAULT_THEME } from "./presets";
import { loadProject, saveProject, askPersist } from "./storage";

const MAX = 60;
export type SaveState = "loading" | "saved" | "saving" | "error";

export function useProject() {
  const [p, setP] = useState<Project>(() => sampleProject());
  const past = useRef<Project[]>([]);
  const future = useRef<Project[]>([]);
  const last = useRef<{ tag: string; at: number }>({ tag: "", at: 0 });
  const [, force] = useState(0);
  const [save, setSave] = useState<SaveState>("loading");
  const loaded = useRef(false);
  const [fresh, setFresh] = useState(false); // true = chưa từng có dự án lưu (lần đầu vào)

  // Nạp bản đã lưu (chạy 1 lần phía client)
  useEffect(() => {
    loadProject().then((got) => {
      // Dự án cũ thiếu trường theme mới → bù bằng DEFAULT_THEME
      if (got) setP({ ...sampleProject(), ...got, theme: { ...DEFAULT_THEME, ...got.theme } }); else setFresh(true);
      loaded.current = true;
      setSave("saved");
      askPersist();
    });
  }, []);

  // Tự lưu sau 400ms ngừng sửa; lỗi thì báo "error" (không nuốt lỗi như trước)
  useEffect(() => {
    if (!loaded.current) return;
    setSave("saving");
    const id = setTimeout(() => {
      saveProject(p).then(() => setSave("saved")).catch(() => setSave("error"));
    }, 400);
    return () => clearTimeout(id);
  }, [p]);

  const cur = useRef(p);
  cur.current = p;
  const commit = (next: Project) => { cur.current = next; setP(next); force((x) => x + 1); };

  // tag giống nhau trong 600ms → gộp thành 1 bước undo (vd kéo slider)
  const update = useCallback((fn: (d: Project) => Project, tag = "") => {
    const now = Date.now();
    const merge = tag && last.current.tag === tag && now - last.current.at < 600;
    if (!merge) {
      past.current = [...past.current.slice(-MAX), cur.current];
      future.current = [];
    }
    last.current = { tag, at: now };
    commit(fn(cur.current));
  }, []);

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(cur.current);
    last.current = { tag: "", at: 0 };
    commit(prev);
  }, []);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(cur.current);
    last.current = { tag: "", at: 0 };
    commit(next);
  }, []);

  const reset = useCallback(() => update(() => sampleProject()), [update]);

  return { p, update, undo, redo, reset, save, fresh, canUndo: past.current.length > 0, canRedo: future.current.length > 0 };
}
