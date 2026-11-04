// Bảng dịch: dòng = slide (Headline · Subtitle · chữ tự do · ảnh chụp), cột = ngôn ngữ; sửa thẳng trong ô
// Ô ngôn ngữ chưa có bản dịch: nền vàng + chữ mờ là bản English (đang dùng tạm). Ô giống hệt English: chấm cam "EN"
// "Fill from English" chép English vào các ô thiếu của cột (làm nháp). Dòng ảnh: mỗi ngôn ngữ một ảnh riêng (thiếu = dùng ảnh chung)
// Chữ slide lưu theo cặp t[loc] = [headline, subtitle]: sửa 1 ô ở ngôn ngữ chưa có thì ô kia lấy tạm bản English
import { Fragment, useMemo, useRef, useState } from "react";
import { Languages, Plus, Wand2, ImageUp, X, Image as ImageIcon } from "lucide-react";
import type { Project, Slide } from "@/lib/types";
import { LOCALES } from "@/lib/presets";
import { usedLocales, plain } from "@/lib/rules";
import { imgSrc, putImage } from "@/lib/images";
import { mockScreen } from "@/lib/mocks";
import { Modal } from "./ui";

type Update = (fn: (d: Project) => Project, tag?: string) => void;

export function TranslateDialog({ p, update, onClose, onFlash }: { p: Project; update: Update; onClose: () => void; onFlash: (m: string, undo?: boolean) => void }) {
  const [extra, setExtra] = useState<string[]>([]); // ngôn ngữ vừa thêm cột (chưa có dữ liệu)
  const locs = useMemo(() => { const u = usedLocales(p); return [...u, ...extra.filter((l) => !u.includes(l))].sort((a, b) => (a === "en" ? -1 : b === "en" ? 1 : Object.keys(LOCALES).indexOf(a) - Object.keys(LOCALES).indexOf(b))); }, [p, extra]);
  const others = locs.filter((l) => l !== "en");
  const unused = Object.keys(LOCALES).filter((l) => !locs.includes(l));
  const fileIn = useRef<HTMLInputElement>(null), fileTo = useRef<(ref: string) => void>(() => {});

  const setSlide = (i: number, fn: (s: Slide) => Partial<Slide>, tag = "") => update((d) => ({ ...d, slides: d.slides.map((s, j) => (j === i ? { ...s, ...fn(s) } : s)) }), tag);
  const en = (s: Slide): [string, string] => s.t.en ?? ["", ""];
  // Ghi 1 ô chữ slide (k = 0 headline, 1 subtitle)
  const setCell = (i: number, loc: string, k: 0 | 1, v: string) => setSlide(i, (s) => {
    const cur = [...(s.t[loc] ?? en(s))] as [string, string]; cur[k] = v;
    return { t: { ...s.t, [loc]: cur } };
  }, `tr-${i}-${loc}-${k}`);
  const setExtraCell = (i: number, id: string, loc: string, v: string) => setSlide(i, (s) => ({ extras: (s.extras ?? []).map((x) => (x.id === id ? { ...x, t: { ...x.t, [loc]: v } } : x)) }), `trx-${i}-${id}-${loc}`);

  // Đếm số slide đã dịch ở một ngôn ngữ
  const done = (loc: string) => p.slides.filter((s) => s.t[loc]).length;
  const fill = (loc: string) => {
    update((d) => ({ ...d, slides: d.slides.map((s) => ({ ...s, t: s.t[loc] ? s.t : { ...s.t, [loc]: [...en(s)] as [string, string] },
      extras: s.extras?.map((x) => (x.t[loc] !== undefined ? x : { ...x, t: { ...x.t, [loc]: x.t.en ?? "" } })) })) }));
    onFlash(`Copied English into empty ${LOCALES[loc]} cells`, true);
  };
  const pickImg = (fn: (ref: string) => void) => { fileTo.current = fn; fileIn.current?.click(); };

  // Một ô chữ: thiếu = vàng, placeholder là English; giống English = chấm "EN"
  const cell = (val: string | undefined, enVal: string, onChange: (v: string) => void, loc: string) => {
    const missing = loc !== "en" && val === undefined && !!enVal, same = loc !== "en" && val !== undefined && !!val && val === enVal;
    return (
      <td className={`trc ${missing ? "miss" : ""}`}>
        <textarea rows={1} value={val ?? ""} placeholder={loc === "en" ? "—" : plain(enVal) || "—"} aria-label={`${LOCALES[loc]} text`}
          onChange={(e) => onChange(e.target.value.replace(/\n/g, " "))} />
        {same && <span className="trsame" title="Same as English — not translated yet">EN</span>}
      </td>
    );
  };

  return (
    <Modal title="Translations" icon={<Languages />} onClose={onClose} width={Math.min(1100, 260 + locs.length * 260)}>
      <div className="trwrap">
        <div className="trbar">
          <span className="hint">Edit text for every language side by side. Yellow cells still show English.</span>
          {unused.length > 0 && (
            <label className="chip"><Plus />
              <select value="" aria-label="Add a language" onChange={(e) => e.target.value && setExtra([...extra, e.target.value])}>
                <option value="">Add language…</option>
                {unused.map((l) => <option key={l} value={l}>{LOCALES[l]}</option>)}
              </select>
            </label>
          )}
        </div>
        <div className="trscroll">
          <table className="trtable">
            <thead>
              <tr>
                <th className="trk" />
                {locs.map((l) => (
                  <th key={l}>
                    <div className="trh">
                      <span><b>{LOCALES[l]}</b>{l !== "en" && <span className="mono"> {done(l)}/{p.slides.length}</span>}</span>
                      {l !== "en" && done(l) < p.slides.length && <button className="gbtn" title="Copy English into empty cells as a draft" onClick={() => fill(l)}><Wand2 />Fill from English</button>}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {p.slides.map((s, i) => {
                const [t0, t1] = en(s), hasSub = locs.some((l) => s.t[l]?.[1]), lead = `Slide ${String(i + 1).padStart(2, "0")}`;
                return [
                  <tr key={s.id + "h"} className="trfirst">
                    <th className="trk"><b>{lead}</b><span>Headline</span></th>
                    {locs.map((l) => <Fragment key={l}>{cell(s.t[l]?.[0], t0, (v) => setCell(i, l, 0, v), l)}</Fragment>)}
                  </tr>,
                  hasSub && (
                    <tr key={s.id + "s"}>
                      <th className="trk"><span>Subtitle</span></th>
                      {locs.map((l) => <Fragment key={l}>{cell(s.t[l]?.[1], t1, (v) => setCell(i, l, 1, v), l)}</Fragment>)}
                    </tr>
                  ),
                  ...(s.extras ?? []).map((x) => (
                    <tr key={s.id + x.id}>
                      <th className="trk"><span>{x.pill ? "Badge" : "Text"}</span></th>
                      {locs.map((l) => <Fragment key={l}>{cell(x.t[l], x.t.en ?? "", (v) => setExtraCell(i, x.id, l, v), l)}</Fragment>)}
                    </tr>
                  )),
                  // Dòng ảnh: English = ảnh chung; ngôn ngữ khác = ảnh riêng (thiếu thì mờ, dùng ảnh chung)
                  <tr key={s.id + "i"} className="trimg">
                    <th className="trk"><span>Screenshot</span></th>
                    {locs.map((l) => {
                      const ownImg = l === "en" ? s.img : s.imgs?.[l], show = ownImg ?? s.img;
                      return (
                        <td key={l} className="trc">
                          <div className="trshot">
                            <span className={`trthumb ${l !== "en" && !ownImg ? "shared" : ""}`}>
                              {show ? <img src={imgSrc(show, true)} alt="" /> : <span className="trmock" dangerouslySetInnerHTML={{ __html: mockScreen(s.mock) }} />}
                            </span>
                            <span className="trshot-meta">
                              <span className="hint">{l === "en" ? (s.img ? "Shared screenshot" : "Sample") : ownImg ? "Own screenshot" : "Uses shared"}</span>
                              <span className="row g4">
                                <button className="ghost sm" title={`Upload ${LOCALES[l]} screenshot`} onClick={() => pickImg((ref) => setSlide(i, (x) => (l === "en" ? { img: ref } : { imgs: { ...x.imgs, [l]: ref } })))}><ImageUp />{ownImg ? "Replace" : "Upload"}</button>
                                {l !== "en" && ownImg && <button className="ibtn sm" title="Use shared screenshot" aria-label="Use shared screenshot" onClick={() => setSlide(i, (x) => { const { [l]: _, ...rest } = x.imgs ?? {}; void _; return { imgs: Object.keys(rest).length ? rest : undefined }; })}><X /></button>}
                              </span>
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>,
                ];
              })}
            </tbody>
          </table>
        </div>
        {others.length === 0 && <p className="trempty"><ImageIcon />Add a language above to start translating.</p>}
      </div>
      <input ref={fileIn} type="file" accept="image/*" hidden onChange={async (e) => {
        const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
        const ref = await putImage(f).catch(() => null);
        if (ref) fileTo.current(ref); else onFlash("Couldn't read that image");
      }} />
    </Modal>
  );
}
