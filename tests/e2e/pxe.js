// E2E Pixstall — Feature graphic tách layer (icon/tên/tagline/từng máy), dịch, xuất theo ngôn ngữ, dự án cũ. Chạy: NODE_PATH=<thư mục có playwright>/node_modules node pxe.js <URL> (mặc định localhost:47811)
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const URL = process.argv[2] || 'http://localhost:47811', D='/home/namcuong/apps/pixstall-shots/pe/', C='/home/namcuong/apps/pixstall-shots/pc/';
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium-browser' });
  const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs=[]; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => m.type()==='error' && errs.push(m.text()));
  const r = {};
  const tree = () => pg.$$eval('.lchildren .litem', a=>a.map(x=>x.querySelector('.lname')?.innerText + (x.classList.contains('off')?'(off)':'')));
  const crumb = () => pg.$eval('.crumb', e=>e.innerText.replace(/\n/g,' '));
  const groups = () => pg.$$eval('.right .ghead .ttl', a=>a.map(x=>x.innerText));
  const proj = () => pg.evaluate(() => new Promise((res) => { const q = indexedDB.open('pixstall'); q.onsuccess = () => { const t = q.result.transaction('kv'); const a = t.objectStore('kv').get('project'); t.oncomplete = () => res(a.result); }; }));
  await pg.goto(URL, { waitUntil: 'networkidle' }); await pg.waitForTimeout(700);
  await pg.click('text=Explore the sample first').catch(()=>{});
  await pg.click('.chip.target'); await pg.click('.tcol:nth-child(2) button:has-text("Phone")'); await pg.waitForTimeout(200);
  await pg.click('.item:has-text("Feature graphic")'); await pg.waitForTimeout(300);
  r.tree = await tree();
  // tên app
  await pg.locator('.slidewrap.on [data-pick=title]').click(); await pg.waitForTimeout(150);
  r.name = { crumb: await crumb(), groups: await groups() };
  // kéo tagline riêng
  const tb = await pg.locator('.slidewrap.on [data-pick=sub]').boundingBox();
  await pg.mouse.move(tb.x+30, tb.y+tb.height/2); await pg.mouse.down(); await pg.mouse.move(tb.x+30, tb.y+tb.height/2+40, { steps: 6 }); await pg.mouse.up(); await pg.waitForTimeout(600);
  let pj = await proj(); r.afterDragSub = { sy: pj.feature.sy, ty: pj.feature.ty ?? 0, crumb: await crumb() };
  // icon riêng
  await pg.locator('.slidewrap.on [data-pick=icon]').click(); await pg.waitForTimeout(150);
  r.icon = { crumb: await crumb(), groups: await groups() };
  // xoá tagline bằng Delete
  await pg.locator('.slidewrap.on [data-pick=sub]').click(); await pg.keyboard.press('Delete'); await pg.waitForTimeout(200);
  r.afterDel = { tree: await tree(), toast: await pg.$eval('.toast', e=>e.innerText).catch(()=>null) };
  await pg.click('.toast button'); await pg.waitForTimeout(150); r.afterUndo = await tree();
  // thêm badge
  await pg.click('.lchildren .ladd'); await pg.waitForTimeout(150);
  r.addMenu = await pg.$$eval('.cmenu button', a=>a.map(x=>x.innerText+(x.disabled?'[x]':'')));
  await pg.click('.cmenu button:has-text("Badge")'); await pg.waitForTimeout(250);
  r.badge = { crumb: await crumb(), tree: await tree() };
  // máy 2 riêng
  const d2b = await pg.locator('.slidewrap.on [data-pick=device2]').boundingBox();
  await pg.mouse.click(d2b.x + d2b.width - 10, d2b.y + 40); await pg.waitForTimeout(150);
  r.phone2 = { crumb: await crumb(), groups: await groups(), handles: await pg.locator('.ed-handle').count(), rot: await pg.locator('.ed-rot').count() };
  const d2 = await pg.locator('.slidewrap.on [data-pick=device2]').boundingBox();
  await pg.mouse.move(d2.x+d2.width-10, d2.y+40); await pg.mouse.down(); await pg.mouse.move(d2.x+d2.width+30, d2.y+70, { steps: 6 }); await pg.mouse.up(); await pg.waitForTimeout(600);
  pj = await proj(); r.phonesAfter = pj.feature.phones;
  // máy 1: ảnh riêng + căn ảnh
  await pg.locator('.lchildren .litem:has-text("Phone 1")').click(); await pg.waitForTimeout(150);
  const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('button:has-text("Use own image")')]); await fc.setFiles(C+'blue.png'); await pg.waitForTimeout(900);
  r.phone1own = { card: await pg.$eval('.shot-t', e=>e.innerText), groups: await groups() };
  await pg.locator('.slidewrap.on [data-pick=device]').dblclick(); await pg.waitForTimeout(150);
  r.cropping = await pg.locator('.ed-hit.cropping').count();
  await pg.keyboard.press('Escape');
  // ẩn máy 2 bằng mắt
  await pg.hover('.lchildren .litem:has-text("Phone 2")'); await pg.click('.lchildren .litem:has-text("Phone 2") button[aria-label^="Hide"]'); await pg.waitForTimeout(150);
  r.phonesVisible = await pg.locator('.slidewrap.on [data-pick^=device]').count();
  await pg.keyboard.press('Control+z'); await pg.waitForTimeout(150);
  await pg.screenshot({ path: D+'01-feature.png' });
  // bố cục centered
  await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape');
  await pg.locator('.item:has-text("Feature graphic")').click(); await pg.waitForTimeout(150);
  await pg.click('.layouts.three button:has-text("Centered")'); await pg.waitForTimeout(250);
  await pg.screenshot({ path: D+'02-centered.png', clip: await pg.locator('.slidewrap.on').boundingBox() });
  await pg.click('.layouts.three button:has-text("Text left")'); await pg.waitForTimeout(200);
  // bảng dịch: tên app tiếng Việt
  await pg.selectOption('select[aria-label="Language"]', '__tr'); await pg.waitForTimeout(300);
  r.trFeature = await pg.$$eval('.trtable tbody th.trk', a=>a.map(x=>x.innerText.replace(/\n/g,' ')).filter(x=>/Feature|App name|Tagline|Badge/.test(x)));
  const cols = await pg.$$eval('.trtable thead th b', a=>a.map(x=>x.innerText)); const vi = cols.indexOf('Tiếng Việt');
  const nameRow = pg.locator('.trtable tbody tr:has(th:has-text("App name"))');
  await nameRow.locator('td.trc').nth(vi).locator('textarea').fill('Nở Hoa'); await pg.waitForTimeout(150);
  await pg.screenshot({ path: D+'03-tr.png' });
  await pg.keyboard.press('Escape'); await pg.click('.modal', { position: { x: 5, y: 5 } }).catch(()=>{});
  await pg.selectOption('select[aria-label="Language"]', 'vi'); await pg.waitForTimeout(250);
  r.viName = await pg.$eval('.slidewrap.on [data-line=title]', e=>e.innerText);
  await pg.selectOption('select[aria-label="Language"]', 'en'); await pg.waitForTimeout(150);
  r.enName = await pg.$eval('.slidewrap.on [data-line=title]', e=>e.innerText);
  // xuất: en + vi, Phone + feature
  await pg.click('text=Export'); await pg.waitForTimeout(300);
  for (const n of await pg.$$eval('.scard.on .sname', a=>a.map(x=>x.innerText))) if (!(n === 'Phone' || n.startsWith('Feature'))) await pg.click(`.scard.on:has-text("${n.replace(/"/g,'\\"')}")`);
  if (!(await pg.locator('.scard.on .sname:text-is("Phone")').count())) await pg.click('.scard:has(.sname:text-is("Phone"))');
  if (!(await pg.locator('.scard.on:has-text("Feature graphic")').count())) await pg.click('.scard:has-text("Feature graphic")');
  for (const l of await pg.$$eval('.pill', a=>a.map(x=>x.innerText+'|'+x.classList.contains('on')))) { const [name, on] = l.split('|'); if ((name==='English'||name==='Tiếng Việt') !== (on==='true')) await pg.click(`.pill:has-text("${name}")`); }
  r.plan = await pg.$eval('.tree', e=>e.innerText.split('\n').filter(x=>x.includes('feature')));
  await pg.evaluate(() => { HTMLAnchorElement.prototype.click = function () { fetch(this.href).then(r=>r.arrayBuffer()).then(buf=>{ let s=''; const u=new Uint8Array(buf); for (let i=0;i<u.length;i+=32768) s+=String.fromCharCode.apply(null,u.subarray(i,i+32768)); window.__zip=btoa(s); }); }; });
  await pg.click('button:has-text("Download ZIP")');
  await pg.waitForFunction(() => window.__zip, null, { timeout: 180000 });
  fs.writeFileSync(D+'out.zip', Buffer.from(await pg.evaluate(() => window.__zip), 'base64'));
  // Duo máy 2 ảnh riêng → có Image in screen
  await pg.click('.chip.target'); await pg.click('.tcol:nth-child(1) button:has-text("iPhone 6.9")'); await pg.waitForTimeout(200);
  await pg.click('text=Single'); await pg.locator('.list > .lgroup').nth(3).locator('.item').click(); await pg.waitForTimeout(200);
  await pg.locator('.slidewrap.on [data-pick=device2]').click();
  const [fc2] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('button:has-text("Use own image")')]); await fc2.setFiles(C+'red.png'); await pg.waitForTimeout(800);
  r.duo2 = await groups();
  await pg.locator('.slidewrap.on [data-pick=device2]').dblclick(); await pg.waitForTimeout(150);
  r.duoCrop = await pg.locator('.ed-hit.cropping').count();
  r.errs = errs; console.log(JSON.stringify(r, null, 1));
  // dự án cũ: feature tx/ty dời cả khối, dx dời cả cụm, device=false
  const ctx2 = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const pg2 = await ctx2.newPage(); const e2=[]; pg2.on('pageerror', e => e2.push(e.message));
  await pg2.addInitScript(() => { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x','1'); localStorage.setItem('pixstall:project:v1', JSON.stringify({ store:'play', sizeId:'ph', loc:'en', customSizes:[], theme:{}, feature:{ name:'Old', tagline:'Old tag', icon:'sprout', device:false, scale:17, rx:0, ry:0, rz:0, tx:4, ty:2, dx:3, dy:1 }, slides:[ { id:'a', t:{ en:['Old','Sub'] }, layout:'center', scale:76, img:null, mock:0, rx:0, ry:0, rz:0 }, { id:'b', t:{ en:['Two','Sub'] }, layout:'center', scale:76, img:null, mock:1, rx:0, ry:0, rz:0 } ] })); });
  await pg2.goto(URL, { waitUntil: 'networkidle' }); await pg2.waitForTimeout(1200);
  await pg2.click('.item:has-text("Feature graphic")'); await pg2.waitForTimeout(300);
  const o = { tree: await pg2.$$eval('.lchildren .litem', a=>a.map(x=>x.querySelector('.lname')?.innerText + (x.classList.contains('off')?'(off)':''))) };
  o.f = await pg2.evaluate(() => new Promise((res) => { const q = indexedDB.open('pixstall'); q.onsuccess = () => { const t = q.result.transaction('kv'); const a = t.objectStore('kv').get('project'); t.oncomplete = () => { const f = a.result.feature; res({ tx: f.tx, ox: f.ox, sx: f.sx, dx: f.dx, phones: f.phones, device: f.device }); }; }; }));
  o.errs = e2;
  console.log('OLD', JSON.stringify(o));
  await b.close();
})();
