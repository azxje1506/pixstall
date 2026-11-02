// Hook trạng thái dự án: undo/redo (gộp các thay đổi liên tiếp cùng nhãn, vd kéo slider) + tự lưu localStorage
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Project } from "./types";
import { sampleProject } from "./presets";

const KEY = "pixstall:project:v1";
const MAX = 60;

export function useProject() {
  const [p, setP] = useState<Project>(() => sampleProject());
  const past = useRef<Project[]>([]);
  const future = useRef<Project[]>([]);
  const last = useRef<{ tag: string; at: number }>({ tag: "", at: 0 });
  const [, force] = useState(0);
  const loaded = useRef(false);

  // Nạp bản đã lưu (chạy 1 lần phía client)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setP({ ...sampleProject(), ...JSON.parse(raw) });
    } catch {}
    loaded.current = true;
  }, []);

  // Tự lưu (ảnh dataURL lớn có thể vượt quota → bỏ qua lỗi)
  useEffect(() => {
    if (!loaded.current) return;
    const id = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {}
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

  return { p, update, undo, redo, reset, canUndo: past.current.length > 0, canRedo: future.current.length > 0 };
}
