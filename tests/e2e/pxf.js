// E2E Pixstall v1.1 #1 — Lưu file .pixstall, mở ở trình duyệt mới, hộp xác nhận + Undo, file hỏng, New project. Chạy: NODE_PATH=<playwright>/node_modules node pxf.js <URL>
// E2E v1.1 #1: lưu file .pixstall → mở ở trình duyệt mới; hộp xác nhận + Undo; file hỏng; New project
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const URL = process.argv[2] || 'http://localhost:47811', D = '/home/namcuong/apps/pixstall-shots/pf/', C = '/home/namcuong/apps/pixstall-shots/pc/';
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium-browser' });
  const r = {};
  const catchDownload = (pg) => pg.evaluate(() => { window.__file = null; HTMLAnchorElement.prototype.click = function () { const n = this.download; fetch(this.href).then(x => x.arrayBuffer()).then(buf => { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); window.__file = { name: n, b64: btoa(s) }; }); }; });
  const pix = (pg, sel) => pg.$eval(sel, (im) => { const c = document.createElement('canvas'); c.width = c.height = 4; const x = c.getContext('2d'); x.drawImage(im, im.naturalWidth / 2, im.naturalHeight / 2, 4, 4, 0, 0, 4, 4); return [...x.getImageData(1, 1, 1, 1).data].slice(0, 3); });
  // --- 1. Tạo dự án có ảnh + tuỳ biến rồi lưu file ---
  const ctx1 = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const pg = await ctx1.newPage(); const e1 = []; pg.on('pageerror', e => e1.push(e.message)); pg.on('console', m => m.type() === 'error' && e1.push(m.text()));
  await pg.goto(URL, { waitUntil: 'networkidle' }); await pg.waitForTimeout(700);
  r.welcomeLink = await pg.locator('.linkbtn').count();
  await pg.setInputFiles('input[type=file][multiple]', [C + 'red.png', C + 'green.png']); await pg.waitForTimeout(1200);
  await pg.click('.pname'); await pg.keyboard.press('Control+a'); await pg.keyboard.type('Bloom Launch'); await pg.keyboard.press('Enter');
  await pg.click('text=Single'); await pg.locator('.slidewrap.on [data-cv]').click({ position: { x: 6, y: 6 } });
  await pg.click('.prop:has(.plab:text("Type")) button:has-text("Color")'); await pg.waitForTimeout(150); // nền riêng slide 1
  await pg.click('.chip.target'); await pg.click('.tcol:nth-child(2) button:has-text("Phone")'); await pg.click('.item:has-text("Feature graphic")');
  await pg.locator('.slidewrap.on [data-pick=icon]').click();
  const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('button:has-text("Upload icon")')]); await fc.setFiles(D + '../pd/icon.png'); await pg.waitForTimeout(800);
  await pg.click('[aria-label="File menu"]'); await pg.waitForTimeout(150);
  r.fileMenu = await pg.$$eval('.cmenu button', a => a.map(x => x.innerText.replace(/\n/g, ' ')));
  await pg.keyboard.press('Escape');
  await catchDownload(pg);
  await pg.keyboard.press('Control+s');
  await pg.waitForFunction(() => window.__file, null, { timeout: 30000 });
  const f = await pg.evaluate(() => window.__file); fs.writeFileSync(D + f.name, Buffer.from(f.b64, 'base64'));
  r.saved = { name: f.name, kb: Math.round(f.b64.length * 0.75 / 1024), toast: await pg.$eval('.toast', e => e.innerText).catch(() => null) };
  await pg.screenshot({ path: D + '01-menu.png' });
  r.e1 = e1;
  // --- 2. Trình duyệt mới hoàn toàn → mở file ---
  const ctx2 = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p2 = await ctx2.newPage(); const e2 = []; p2.on('pageerror', e => e2.push(e.message)); p2.on('console', m => m.type() === 'error' && e2.push(m.text()));
  await p2.goto(URL, { waitUntil: 'networkidle' }); await p2.waitForTimeout(700);
  const [fc2] = await Promise.all([p2.waitForEvent('filechooser'), p2.click('.linkbtn')]); await fc2.setFiles(D + f.name); await p2.waitForTimeout(1500);
  r.opened = {
    confirm: await p2.locator('.modal').count(), name: await p2.$eval('.pname input', e => e.value), toast: await p2.$eval('.toast', e => e.innerText).catch(() => null),
    store: await p2.$eval('.chip.target', e => e.innerText.replace(/\n/g, ' ')), welcome: await p2.locator('.wcard').count(),
  };
  await p2.click('.chip.target'); await p2.click('.tcol:nth-child(1) button:has-text("iPhone 6.9")'); await p2.waitForTimeout(200);
  await p2.click('text=Single'); await p2.waitForTimeout(300);
  r.opened.slide1 = await pix(p2, '.slidewrap.on [data-pick=device] img');
  r.opened.slide1bg = await p2.$eval('.slidewrap.on [data-cv]', e => getComputedStyle(e).backgroundColor);
  r.opened.ownDot = await p2.locator('.list .odot.static').count();
  // --- 3. Sửa rồi thả file vào → hộp xác nhận → Open → Undo ---
  await p2.locator('.slidewrap.on [data-pick=title]').click(); await p2.fill('.right textarea', 'Changed after open'); await p2.waitForTimeout(150);
  const buf = fs.readFileSync(D + f.name).toString('base64');
  await p2.evaluate(async ([b64, name]) => { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); const dt = new DataTransfer(); dt.items.add(new File([u], name)); const t = document.querySelector('.main'); t.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: dt })); t.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt })); }, [buf, f.name]);
  await p2.waitForTimeout(300);
  r.confirm = await p2.$eval('.modal .hd-t', e => e.innerText).catch(() => null);
  await p2.screenshot({ path: D + '02-confirm.png' });
  await p2.click('.modal button:has-text("Open")'); await p2.waitForTimeout(1200);
  r.afterOpen = await p2.$eval('.list .lgroup .sub', e => e.innerText);
  await p2.click('.toast button'); await p2.waitForTimeout(300);
  r.afterUndo = await p2.$eval('.list .lgroup .sub', e => e.innerText);
  // --- 4. File hỏng ---
  const [fc3] = await Promise.all([p2.waitForEvent('filechooser'), p2.keyboard.press('Control+o')]);
  fs.copyFileSync(C + 'red.png', D + 'broken.pixstall'); await fc3.setFiles(D + 'broken.pixstall'); await p2.waitForTimeout(300);
  if (await p2.locator('.modal').count()) await p2.click('.modal button:has-text("Open")'); await p2.waitForTimeout(600);
  r.broken = await p2.$eval('.toast', e => e.innerText).catch(() => null);
  r.brokenKept = await p2.$eval('.list .lgroup .sub', e => e.innerText);
  // --- 5. New project ---
  await p2.click('[aria-label="File menu"]'); await p2.click('.cmenu button:has-text("New project")'); await p2.waitForTimeout(200);
  r.newConfirm = await p2.$eval('.modal .hd-t', e => e.innerText).catch(() => null);
  await p2.click('.modal button:has-text("Start new")'); await p2.waitForTimeout(400);
  r.afterNew = { name: await p2.$eval('.pname input', e => e.value), welcome: await p2.locator('.wcard').count(), toast: await p2.$eval('.toast', e => e.innerText).catch(() => null) };
  r.e2 = e2;
  console.log(JSON.stringify(r, null, 1));
  await b.close();
})();
