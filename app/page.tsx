// Trang chủ = editor (chạy hoàn toàn phía client, không SSR vì dùng localStorage + render ảnh trên trình duyệt)
"use client";
import dynamic from "next/dynamic";

const Editor = dynamic(() => import("@/components/Editor"), { ssr: false, loading: () => <div className="boot">Pixstall</div> });

export default function Page() {
  return <Editor />;
}
