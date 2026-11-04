// E2E Pixstall — Kho ảnh, căn ảnh trong màn (Fill/Fit/kéo), Duo máy 2, dự án cũ dataURL. Chạy: NODE_PATH=<thư mục có playwright>/node_modules node pxc.js <URL> (mặc định localhost:47811)
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const URL = process.argv[2] || 'http://localhost:47811', D='/home/namcuong/apps/pixstall-shots/pc/';
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium-browser' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const pg = await ctx.newPage(); const errs=[]; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => m.type()==='error' && errs.push(m.text()));
  const r = {};
  await pg.goto(URL, { waitUntil: 'networkidle' }); await pg.waitForTimeout(700);
  // tạo ảnh thử: đỏ 1080x1920 (lệch tỉ lệ), xanh lá 1179x2556, xanh dương 4500x9000 (to quá)
  const mk = async (w, h, color, label) => Buffer.from(await pg.evaluate(([w,h,c,l]) => { const cv=document.createElement('canvas'); cv.width=w; cv.height=h; const x=cv.getContext('2d'); x.fillStyle=c; x.fillRect(0,0,w,h); x.fillStyle='#fff'; x.font=`bold ${w/8}px sans-serif`; x.fillText(l, w*0.1, h*0.12); return cv.toDataURL('image/png').split(',')[1]; }, [w,h,color,label]), 'base64');
  const files = [['red.png',1080,1920,'#E11D48','ONE'],['green.png',1179,2556,'#10B981','TWO'],['blue.png',4500,9000,'#2563EB','BIG']];
  for (const [f,w,h,c,l] of files) fs.writeFileSync(D+f, await mk(w,h,c,l));
  await pg.setInputFiles('input[type=file][multiple]', [D+'red.png', D+'green.png', D+'blue.png']); await pg.waitForTimeout(1500);
  const idb = () => pg.evaluate(() => new Promise((res) => { const q = indexedDB.open('pixstall'); q.onsuccess = () => { const d = q.result; const t = d.transaction(['kv','images']); const a = t.objectStore('kv').get('project'); const c = t.objectStore('images').getAllKeys(); t.oncomplete = () => res({ json: JSON.stringify(a.result).length, refs: a.result.slides.map(s=>s.img), images: c.result.length }); }; }));
  await pg.waitForTimeout(800);
  r.store = await idb();
  // ảnh to đã thu nhỏ?
  r.bigMeta = await pg.evaluate(() => new Promise((res) => { const q = indexedDB.open('pixstall'); q.onsuccess = () => { const t = q.result.transaction('images'); const a = t.objectStore('images').getAll(); t.oncomplete = () => res(a.result.map(x=>[x.w,x.h, Math.round(x.thumb.size/1024)+'KB'])); }; }));
  // tải lại → ảnh còn
  await pg.reload({ waitUntil: 'networkidle' }); await pg.waitForTimeout(1200);
  r.afterReload = await pg.$$eval('.slidewrap img', a=>a.slice(0,3).map(x=>x.src.slice(0,5)+':'+x.naturalWidth));
  r.thumbs = await pg.$$eval('.list .thumb img', a=>a.slice(0,3).map(x=>x.naturalWidth));
  // panel Device + cảnh báo tỉ lệ
  await pg.click('text=Single'); await pg.waitForTimeout(300);
  await pg.locator('.slidewrap.on [data-pick=device]').click(); await pg.waitForTimeout(150);
  r.groups = await pg.$$eval('.right .ghead .ttl', a=>a.map(x=>x.innerText));
  r.ratioWarn = await pg.$eval('.warnline.small', e=>e.innerText).catch(()=>null);
  // căn ảnh: double-click → kéo → Esc
  await pg.locator('.slidewrap.on [data-pick=device]').dblclick(); await pg.waitForTimeout(150);
  r.cropping = await pg.locator('.ed-hit.cropping').count();
  const db1 = await pg.locator('.slidewrap.on [data-pick=device]').boundingBox();
  await pg.mouse.move(db1.x+db1.width/2, db1.y+db1.height/2); await pg.mouse.down(); await pg.mouse.move(db1.x+db1.width/2+30, db1.y+db1.height/2-40, { steps: 6 }); await pg.mouse.up();
  r.pan = await pg.$$eval('.prop:has(.plab:text("Offset")) .num input', a=>a.map(x=>x.value));
  r.devStill = await pg.$$eval('.prop:has(.plab:text("Position")) .num input', a=>a.map(x=>x.value));
  await pg.screenshot({ path: D+'01-crop.png' });
  await pg.keyboard.press('Escape'); r.afterEsc = { cropping: await pg.locator('.ed-hit.cropping').count(), sel: await pg.$eval('.crumb', e=>e.innerText.replace(/\n/g,' ')) };
  await pg.click('.prop:has(.plab:text("Mode")) button:has-text("Fit")'); await pg.waitForTimeout(100);
  r.fit = await pg.$eval('.slidewrap.on [data-pick=device] img', e=>getComputedStyle(e).objectFit);
  await pg.screenshot({ path: D+'02-fit.png' });
  // Duo: slide 4
  await pg.locator('.list > .lgroup').nth(3).locator('.item').click(); await pg.waitForTimeout(250);
  r.duoTree = await pg.$$eval('.lchildren .litem', a=>a.map(x=>x.innerText.replace(/\n/g,' ')));
  await pg.locator('.slidewrap.on [data-pick=device2]').click(); await pg.waitForTimeout(150);
  r.dev2 = { crumb: await pg.$eval('.crumb', e=>e.innerText.replace(/\n/g,' ')), card: await pg.$eval('.shot-t', e=>e.innerText), handles: await pg.locator('.ed-handle').count(), rot: await pg.locator('.ed-rot').count() };
  const d2 = await pg.locator('.slidewrap.on [data-pick=device2]').boundingBox();
  await pg.mouse.move(d2.x+d2.width/2, d2.y+d2.height/2); await pg.mouse.down(); await pg.mouse.move(d2.x+d2.width/2-30, d2.y+d2.height/2+25, { steps: 6 }); await pg.mouse.up();
  r.dev2pos = await pg.$$eval('.prop:has(.plab:text("Position")) .num input', a=>a.map(x=>x.value));
  const rb = await pg.locator('.ed-rot').boundingBox();
  await pg.mouse.move(rb.x+6, rb.y+6); await pg.mouse.down(); await pg.mouse.move(rb.x+70, rb.y+20, { steps: 6 }); await pg.mouse.up();
  r.brz = await pg.$eval('.prop:has(.plab:text("Extra spin")) .num input', e=>e.value);
  const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('button:has-text("Use own image")')]);
  await fc.setFiles(D+'green.png'); await pg.waitForTimeout(800);
  r.dev2own = { card: await pg.$eval('.shot-t', e=>e.innerText), tree: await pg.$eval('.litem.on .lsub', e=>e.innerText) };
  // device chính của duo cũng có tay cầm
  await pg.locator('.lchildren .litem:has-text("Device")').first().click(); await pg.waitForTimeout(150);
  r.duoMainHandles = await pg.locator('.ed-handle').count();
  await pg.screenshot({ path: D+'03-duo.png' });
  r.store2 = await idb();
  r.errs = errs;
  console.log(JSON.stringify(r, null, 1));
  // --- dự án cũ có dataURL ---
  const ctx2 = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const pg2 = await ctx2.newPage(); const e2=[]; pg2.on('pageerror', e => e2.push(e.message));
  const red = 'data:image/png;base64,' + fs.readFileSync(D+'red.png').toString('base64');
  await pg2.addInitScript((red) => { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x','1'); localStorage.setItem('pixstall:project:v1', JSON.stringify({ store:'ios', sizeId:'ip69', loc:'en', customSizes:[], theme:{}, feature:{ name:'Old', tagline:'x', icon:'sprout', device:true, scale:17, rx:0, ry:0, rz:0 }, slides:[ { id:'a', t:{ en:['Old','Sub'] }, layout:'center', scale:76, img:red, mock:0, rx:0, ry:0, rz:0 } ] })); }, red);
  await pg2.goto(URL, { waitUntil: 'networkidle' }); await pg2.waitForTimeout(1500);
  const o = { img: await pg2.$eval('.slidewrap img', x=>x.src.slice(0,5)+':'+x.naturalWidth).catch(()=>null) };
  await pg2.waitForTimeout(800);
  o.stored = await pg2.evaluate(() => new Promise((res) => { const q = indexedDB.open('pixstall'); q.onsuccess = () => { const t = q.result.transaction('kv'); const a = t.objectStore('kv').get('project'); t.oncomplete = () => res(String(a.result?.slides?.[0]?.img).slice(0,10)); }; }));
  o.errs = e2;
  console.log('OLD', JSON.stringify(o));
  await b.close();
})();
