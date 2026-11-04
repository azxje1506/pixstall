// E2E Pixstall — Feature graphic icon/bố cục + bảng dịch + ảnh theo ngôn ngữ + xuất ZIP 2 ngôn ngữ. Chạy: NODE_PATH=<thư mục có playwright>/node_modules node pxd.js <URL> (mặc định localhost:47811)
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const URL = process.argv[2] || 'http://localhost:47811', D='/home/namcuong/apps/pixstall-shots/pd/', C='/home/namcuong/apps/pixstall-shots/pc/';
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium-browser' });
  const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs=[]; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => m.type()==='error' && errs.push(m.text()));
  const r = {};
  await pg.goto(URL, { waitUntil: 'networkidle' }); await pg.waitForTimeout(700);
  // icon ảnh thật
  const icon = Buffer.from(await pg.evaluate(() => { const c=document.createElement('canvas'); c.width=c.height=512; const x=c.getContext('2d'); x.fillStyle='#F97316'; x.fillRect(0,0,512,512); x.fillStyle='#fff'; x.beginPath(); x.arc(256,256,140,0,7); x.fill(); return c.toDataURL('image/png').split(',')[1]; }), 'base64');
  fs.writeFileSync(D+'icon.png', icon);
  await pg.setInputFiles('input[type=file][multiple]', [C+'red.png', C+'green.png', C+'blue.png']); await pg.waitForTimeout(1500);
  // Feature graphic
  await pg.click('.chip.target'); await pg.click('.tcol:nth-child(2) button:has-text("Phone")'); await pg.waitForTimeout(200);
  await pg.click('.item:has-text("Feature graphic")'); await pg.waitForTimeout(300);
  r.featGroups = await pg.$$eval('.right .ghead .ttl', a=>a.map(x=>x.innerText));
  for (const lay of ['Centered', 'Phones', 'Text left']) {
    await pg.click(`.layouts.three button:has-text("${lay}")`); await pg.waitForTimeout(250);
    await pg.screenshot({ path: D+`f-${lay.replace(' ','')}.png`, clip: await pg.locator('.slidewrap.on').boundingBox() });
    r['phones_'+lay] = await pg.locator('.slidewrap.on [data-pick=device] .scr').count();
  }
  // chọn chữ → upload icon
  await pg.locator('.slidewrap.on [data-pick=icon]').click(); await pg.waitForTimeout(150);
  const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('button:has-text("Upload icon")')]); await fc.setFiles(D+'icon.png'); await pg.waitForTimeout(800);
  r.iconImg = await pg.locator('.slidewrap.on [data-pick=icon] img').count();
  // chọn máy → đổi ảnh phone 1 sang slide 03 (xanh dương)
  await pg.locator('.lchildren .litem:has-text("Phone 1")').click(); await pg.waitForTimeout(150);
  r.screens = await pg.$eval('.crumb', e=>e.innerText.replace(/\n/g,' '));
  const sid = await pg.$eval('select[aria-label="Screen of phone 1"]', (s) => s.options[2].value);
  await pg.selectOption('select[aria-label="Screen of phone 1"]', sid); await pg.waitForTimeout(250);
  await pg.screenshot({ path: D+'f-final.png', clip: await pg.locator('.slidewrap.on').boundingBox() });
  // click vào khoảng trống giữa → không chọn devices (centered)
  // --- Bảng dịch ---
  await pg.selectOption('select[aria-label="Language"]', '__tr'); await pg.waitForTimeout(300);
  r.trCols = await pg.$$eval('.trtable thead th', a=>a.map(x=>x.innerText.replace(/\n/g,' ')).filter(Boolean));
  await pg.selectOption('select[aria-label="Add a language"]', 'ja'); await pg.waitForTimeout(150);
  r.trCols2 = await pg.$$eval('.trtable thead th b', a=>a.map(x=>x.innerText));
  r.missing = await pg.locator('.trc.miss').count();
  // sửa ô tiếng Nhật slide 1 headline
  const jaIdx = r.trCols2.indexOf('日本語');
  const firstRow = pg.locator('.trtable tbody tr.trfirst').first();
  await firstRow.locator('td.trc').nth(jaIdx).locator('textarea').fill('習慣を続けよう');
  await pg.waitForTimeout(150);
  r.afterEdit = { missing: await pg.locator('.trc.miss').count(), same: await pg.locator('.trsame').count() };
  // fill from English cho tiếng Nhật
  await pg.locator('.trtable thead th').nth(jaIdx + 1).locator('button:has-text("Fill")').click(); await pg.waitForTimeout(150);
  r.afterFill = { missing: await pg.locator('.trc.miss').count(), same: await pg.locator('.trsame').count(), toast: await pg.$eval('.toast', e=>e.innerText).catch(()=>null) };
  // ảnh riêng tiếng Nhật cho slide 1 (xanh lá)
  const shotRow = pg.locator('.trtable tbody tr.trimg').first();
  const [fc2] = await Promise.all([pg.waitForEvent('filechooser'), shotRow.locator('td.trc').nth(jaIdx).locator('button:has-text("Upload")').click()]);
  await fc2.setFiles(C+'green.png'); await pg.waitForTimeout(800);
  r.jaShot = await shotRow.locator('td.trc').nth(jaIdx).locator('.hint').innerText();
  await pg.screenshot({ path: D+'tr.png' });
  await pg.keyboard.press('Escape'); await pg.click('.modal', { position: { x: 5, y: 5 } }).catch(()=>{}); await pg.waitForTimeout(150);
  // xem tiếng Nhật trên canvas
  await pg.selectOption('select[aria-label="Language"]', 'ja'); await pg.waitForTimeout(200);
  await pg.click('.list > .lgroup >> nth=0 >> .item'); await pg.waitForTimeout(200);
  await pg.click('text=Single'); await pg.waitForTimeout(250);
  r.jaTitle = await pg.$eval('.slidewrap.on [data-line=title]', e=>e.innerText);
  r.jaImgColor = await pg.$eval('.slidewrap.on [data-pick=device] img', (im) => { const c=document.createElement('canvas'); c.width=c.height=4; const x=c.getContext('2d'); x.drawImage(im, im.naturalWidth/2, im.naturalHeight/2, 4,4,0,0,4,4); return [...x.getImageData(1,1,1,1).data].slice(0,3); });
  await pg.locator('.slidewrap.on [data-pick=device]').click(); await pg.waitForTimeout(150);
  r.devCard = await pg.$eval('.shot-t', e=>e.innerText);
  await pg.screenshot({ path: D+'ja-slide.png' });
  // English vẫn đỏ
  await pg.selectOption('select[aria-label="Language"]', 'en'); await pg.waitForTimeout(200);
  r.enImgColor = await pg.$eval('.slidewrap.on [data-pick=device] img', (im) => { const c=document.createElement('canvas'); c.width=c.height=4; const x=c.getContext('2d'); x.drawImage(im, im.naturalWidth/2, im.naturalHeight/2, 4,4,0,0,4,4); return [...x.getImageData(1,1,1,1).data].slice(0,3); });
  // tải lại: icon + ảnh ja còn
  await pg.reload({ waitUntil: 'networkidle' }); await pg.waitForTimeout(1200);
  r.reload = await pg.evaluate(() => new Promise((res) => { const q = indexedDB.open('pixstall'); q.onsuccess = () => { const t = q.result.transaction(['kv','images']); const a = t.objectStore('kv').get('project'); const c = t.objectStore('images').getAllKeys(); t.oncomplete = () => res({ icon: String(a.result.feature.iconImg).slice(0,4), jaImg: String(a.result.slides[0].imgs?.ja).slice(0,4), images: c.result.length, layout: a.result.feature.layout }); }; }));
  // export: en + ja, iPhone 6.9 only, có feature
  await pg.click('text=Export'); await pg.waitForTimeout(300);
  r.exportLocs = await pg.$$eval('.pill', a=>a.map(x=>x.innerText + (x.classList.contains('on')?'*':'')));
  for (const n of await pg.$$eval('.scard.on .sname', a=>a.map(x=>x.innerText))) if (!n.startsWith('Phone') || n.startsWith('Phone QHD')) await pg.click(`.scard.on:has-text("${n.replace(/"/g,'\\"')}")`);
  for (const l of await pg.$$eval('.pill', a=>a.map(x=>x.innerText+'|'+x.classList.contains('on')))) { const [name, on] = l.split('|'); if ((name==='English'||name==='日本語') !== (on==='true')) await pg.click(`.pill:has-text("${name}")`); }
  if (!(await pg.locator('.scard.on:has-text("Feature graphic")').count())) await pg.click('.scard:has-text("Feature graphic")');
  await pg.evaluate(() => { HTMLAnchorElement.prototype.click = function () { fetch(this.href).then(r=>r.arrayBuffer()).then(buf=>{ let s=''; const u=new Uint8Array(buf); for (let i=0;i<u.length;i+=32768) s+=String.fromCharCode.apply(null,u.subarray(i,i+32768)); window.__zip=btoa(s); }); }; });
  await pg.click('button:has-text("Download ZIP")');
  await pg.waitForFunction(() => window.__zip, null, { timeout: 180000 });
  fs.writeFileSync(D+'out.zip', Buffer.from(await pg.evaluate(() => window.__zip), 'base64'));
  r.errs = errs; console.log(JSON.stringify(r, null, 1)); await b.close();
})();
