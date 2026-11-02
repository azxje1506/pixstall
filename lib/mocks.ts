// Màn hình app mẫu "Bloom" (HTML tĩnh) hiện trong máy khi user chưa tải ảnh chụp lên
// Đơn vị: 1em của .mk = 4.2% bề ngang màn hình máy (đặt trong globals.css)
const C = ["#FF7A59", "#5B5BF0", "#10B981", "#F59E0B", "#EC4899"];
const SB = '<div class="sb"><span>9:41</span><span>●●● ▮</span></div>';

const rows = (n: number) =>
  Array.from({ length: n }, (_, k) =>
    `<div class="card"><div class="dot" style="background:${C[k % 5]}"></div><div style="flex:1"><div class="ln" style="width:${70 - k * 8}%;background:#2a2a33;opacity:.75"></div><div class="ln" style="width:${45 + k * 6}%"></div></div><div class="chk" style="border-color:${k < 2 ? C[2] : "#ccc"};background:${k < 2 ? C[2] : "none"}"></div></div>`
  ).join("");

export function mockScreen(i: number): string {
  switch (((i % 6) + 6) % 6) {
    case 0:
      return `<div class="mk">${SB}<h4>Today</h4>${rows(7)}</div>`;
    case 1:
      return `<div class="mk">${SB}<h4>This week</h4><div style="display:flex;align-items:flex-end;gap:.5em;height:8em;margin:1em 0 1.2em">${[50, 72, 40, 90, 65, 80, 55]
        .map((h, k) => `<div style="flex:1;height:${h}%;border-radius:.5em;background:${k === 3 ? C[1] : "#DCDCF8"}"></div>`)
        .join("")}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:.55em"><div class="card" style="display:block"><b style="font-size:1.6em">86%</b><div class="ln"></div></div><div class="card" style="display:block"><b style="font-size:1.6em">12</b><div class="ln"></div></div></div>${rows(3)}</div>`;
    case 2:
      return `<div class="mk">${SB}<h4>42 day streak</h4><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:.35em;margin-top:1em">${Array.from(
        { length: 35 },
        (_, k) => `<div style="aspect-ratio:1;border-radius:.35em;background:${C[2]};opacity:${[0.15, 0.4, 0.7, 1][(k * 7) % 4]}"></div>`
      ).join("")}</div><div style="margin-top:1.2em">${rows(3)}</div></div>`;
    case 3:
      return `<div class="mk" style="background:#14141B;color:#fff">${SB}<h4>Focus</h4><div style="width:12em;height:12em;margin:2.5em auto;border-radius:50%;background:conic-gradient(${C[3]} 0 68%,#2A2A35 0);display:grid;place-items:center"><div style="width:10em;height:10em;border-radius:50%;background:#14141B;display:grid;place-items:center"><b style="font-size:2.3em">25:00</b></div></div><div style="display:flex;justify-content:center"><div style="padding:.6em 1.6em;border-radius:2em;background:${C[3]};color:#14141B;font-weight:700">Start</div></div></div>`;
    case 4:
      return `<div class="mk">${SB}<h4>Journal</h4>${[0, 1, 2, 3]
        .map((k) => `<div class="card" style="display:block;padding:1em"><b style="color:${C[(k % 4) + 1]};font-size:.85em">OCT ${28 - k}</b><div class="ln" style="background:#2a2a33;opacity:.7;width:80%"></div><div class="ln"></div><div class="ln" style="width:60%"></div></div>`)
        .join("")}</div>`;
    default:
      return `<div class="mk" style="background:#0F0F14;color:#fff">${SB}<div style="border-radius:1.2em;padding:1.4em;background:linear-gradient(135deg,${C[1]},${C[4]});margin-bottom:1em"><b style="font-size:1.8em">Bloom Pro</b><div style="opacity:.8;margin-top:.3em">Unlock everything</div></div>${["Unlimited habits", "All themes", "iCloud sync", "Widgets", "Insights"]
        .map((x) => `<div style="display:flex;gap:.6em;padding:.55em 0;border-bottom:1px solid #22222b"><span style="color:${C[2]}">✓</span>${x}</div>`)
        .join("")}<div style="margin-top:1.2em;text-align:center;padding:.8em;border-radius:1em;background:#fff;color:#0F0F14;font-weight:700">Try free for 7 days</div></div>`;
  }
}
