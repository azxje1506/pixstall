// E2E Pixstall — Layer chữ slide: Headline/Subtitle riêng, thêm/xoá Text-Badge, tô màu trên canvas, dự án cũ. Chạy: NODE_PATH=<thư mục có playwright>/node_modules node pxb2.js <URL> (mặc định localhost:47811)
const { chromium } = require('playwright');
(async () => {
  const URL = process.argv[2] || 'http://localhost:47811', D='/home/namcuong/apps/pixstall-shots/pb2/';
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium-browser' });
  const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs=[]; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => m.type()==='error' && errs.push(m.text()));
  const r = {};
  const tree = () => pg.$$eval('.lchildren .litem', a=>a.map(x=>x.querySelector('.lname')?.innerText + (x.classList.contains('off')?'(off)':'')));
  const crumb = () => pg.$eval('.crumb', e=>e.innerText.replace(/\n/g,' '));
  await pg.goto(URL, { waitUntil: 'networkidle' }); await pg.waitForTimeout(700);
  await pg.click('text=Explore the sample first').catch(()=>{});
  await pg.click('text=Single'); await pg.waitForTimeout(300);
  r.tree = await tree();
  // chọn subtitle trên canvas
  await pg.locator('.slidewrap.on [data-pick=sub]').click(); await pg.waitForTimeout(150);
  r.subPanel = { crumb: await crumb(), groups: await pg.$$eval('.right .ghead .ttl', a=>a.map(x=>x.innerText)), boxes: await pg.$$eval('.right textarea', a=>a.map(x=>x.value)) };
  // kéo subtitle riêng
  const sb = await pg.locator('.slidewrap.on [data-pick=sub]').boundingBox();
  await pg.mouse.move(sb.x+sb.width/2, sb.y+sb.height/2); await pg.mouse.down(); await pg.mouse.move(sb.x+sb.width/2+3, sb.y+sb.height/2+60, { steps: 6 }); await pg.mouse.up();
  r.subMoved = await pg.$$eval('.prop:has(.plab:text("Offset")) .num input', a=>a.map(x=>x.value));
  r.titleTransform = await pg.$eval('.slidewrap.on [data-pick=title]', e=>e.style.transform || 'none');
  // highlight trực tiếp trên canvas: dblclick headline, chọn chữ "stick"
  await pg.dblclick('.slidewrap.on [data-line=title]'); await pg.waitForTimeout(150);
  await pg.evaluate(() => { const el = document.querySelector('.slidewrap.on [data-line=title]'); const tn = el.firstChild; const i = tn.textContent.indexOf('stick'); const rg = document.createRange(); rg.setStart(tn, i); rg.setEnd(tn, i + 5); const s = getSelection(); s.removeAllRanges(); s.addRange(rg); });
  await pg.waitForTimeout(200);
  r.toolbar = await pg.locator('.ed-bar').count();
  await pg.screenshot({ path: D+'01-canvas-highlight.png' });
  await pg.click('.ed-bar button'); await pg.waitForTimeout(100);
  r.spanWhileEditing = await pg.$eval('.slidewrap.on [data-line=title] span[data-hl]', e=>e.innerText).catch(()=>null);
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(200);
  await pg.locator('.lchildren .litem:has-text("Headline")').click(); await pg.waitForTimeout(150);
  r.titleRaw = await pg.$eval('.right textarea', e=>e.value);
  r.renderedSpan = await pg.$eval('.slidewrap.on [data-line=title] span', e=>[e.innerText, getComputedStyle(e).color]).catch(()=>null);
  // phím tắt Ctrl+Shift+H: tô thêm "Build"
  await pg.dblclick('.slidewrap.on [data-line=title]'); await pg.waitForTimeout(150);
  await pg.evaluate(() => { const el = document.querySelector('.slidewrap.on [data-line=title]'); const tn = el.firstChild; const rg = document.createRange(); rg.setStart(tn, 0); rg.setEnd(tn, 5); const s = getSelection(); s.removeAllRanges(); s.addRange(rg); });
  await pg.keyboard.press('Control+Shift+H'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(200);
  r.titleRaw2 = await pg.$eval('.right textarea', e=>e.value);
  // xoá subtitle bằng phím Delete
  await pg.locator('.slidewrap.on [data-pick=sub]').click(); await pg.keyboard.press('Delete'); await pg.waitForTimeout(200);
  r.afterDel = { tree: await tree(), toast: await pg.$eval('.toast', e=>e.innerText).catch(()=>null), crumb: await crumb() };
  await pg.click('.toast button'); await pg.waitForTimeout(150); r.afterUndo = await tree();
  // thêm badge
  await pg.click('.ladd'); await pg.waitForTimeout(150); r.addMenu = await pg.$$eval('.cmenu button', a=>a.map(x=>x.innerText+(x.disabled?'[x]':'')));
  await pg.click('.cmenu button:has-text("Badge")'); await pg.waitForTimeout(200);
  r.badge = { crumb: await crumb(), tree: await tree(), sel: await pg.locator('.slidewrap.on .ed-hit.sel').getAttribute('data-pick') };
  const bb = await pg.locator('.slidewrap.on .ed-hit.sel').boundingBox();
  await pg.mouse.move(bb.x+bb.width/2, bb.y+bb.height/2); await pg.mouse.down(); await pg.mouse.move(bb.x+bb.width/2+40, bb.y+bb.height/2+200, { steps: 6 }); await pg.mouse.up();
  r.badgePos = await pg.$$eval('.prop:has(.plab:text("Center")) .num input', a=>a.map(x=>x.value));
  await pg.screenshot({ path: D+'02-badge.png' });
  // thêm text tự do qua chuột phải nền
  const cv = await pg.locator('.slidewrap.on [data-cv]').boundingBox();
  await pg.mouse.click(cv.x+8, cv.y+cv.height-8, { button: 'right' }); await pg.waitForTimeout(150);
  await pg.click('.cmenu button:has-text("Add text")'); await pg.waitForTimeout(150);
  r.tree2 = await tree();
  // ẩn headline bằng mắt
  await pg.hover('.lchildren .litem:has-text("Headline")'); await pg.click('.lchildren .litem:has-text("Headline") button[aria-label^="Hide"]'); await pg.waitForTimeout(150);
  r.hiddenVis = await pg.$eval('.slidewrap.on [data-pick=title]', e=>getComputedStyle(e).visibility);
  await pg.screenshot({ path: D+'03-tree.png' });
  r.errs = errs; console.log(JSON.stringify(r,null,1));
  // --- dự án cũ (localStorage v1): hidden.text + tx ---
  const ctx2 = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const pg2 = await ctx2.newPage(); const errs2=[]; pg2.on('pageerror', e => errs2.push(e.message));
  await pg2.addInitScript(() => { localStorage.setItem('pixstall:project:v1', JSON.stringify({ store: 'ios', sizeId: 'ip69', loc: 'en', customSizes: [], theme: { frame:'auto', frameColor:'black', bezel:2.4, radius:13, shadow:28, depth:3, bg:'panorama', c1:'#5B5BF0', c2:'#A78BFA', solid:'#F1F0FF', blur:14, overlay:35, font:'Inter', tsize:8.5, align:'center', ink:'light' }, feature: { name:'Old', tagline:'x', icon:'sprout', device:true, scale:17, rx:0, ry:0, rz:0 }, slides: [ { id:'a', t:{ en:['Old headline','Old sub'] }, layout:'center', scale:76, img:null, mock:0, rx:0, ry:0, rz:0, tx:5, ty:2, hidden:{ text:true } }, { id:'b', t:{ en:['Second','Sub two'] }, layout:'bleed', scale:74, img:null, mock:1, rx:0, ry:0, rz:0 } ] })); });
  await pg2.goto(URL, { waitUntil: 'networkidle' }); await pg2.waitForTimeout(900);
  const o = {};
  o.tree = await pg2.$$eval('.lchildren .litem', a=>a.map(x=>x.querySelector('.lname')?.innerText + (x.classList.contains('off')?'(off)':'')));
  o.subTransform = await pg2.$eval('.slidewrap.on [data-pick=sub]', e=>e.style.transform);
  o.errs = errs2;
  console.log('OLD', JSON.stringify(o));
  await b.close();
})();
