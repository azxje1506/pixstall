// E2E Pixstall — Xuất ZIP có ảnh thật, kiểm pixel từng slide. Chạy: NODE_PATH=<thư mục có playwright>/node_modules node pxczip.js <URL> (mặc định localhost:47811)
const { chromium } = require('playwright');
(async () => {
  const D='/home/namcuong/apps/pixstall-shots/pc/';
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium-browser' });
  const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs=[]; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(process.argv[2], { waitUntil: 'networkidle' }); await pg.waitForTimeout(700);
  await pg.setInputFiles('input[type=file][multiple]', [D+'red.png', D+'green.png', D+'blue.png']); await pg.waitForTimeout(1500);
  // slide 4 duo: máy 2 dùng ảnh riêng (đỏ)
  await pg.click('text=Single'); await pg.locator('.list > .lgroup').nth(3).locator('.item').click(); await pg.waitForTimeout(200);
  await pg.locator('.slidewrap.on [data-pick=device2]').click();
  const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('button:has-text("Use own image")')]); await fc.setFiles(D+'red.png'); await pg.waitForTimeout(800);
  await pg.click('text=Export'); await pg.waitForTimeout(300);
  for (const n of await pg.$$eval('.scard.on .sname', a=>a.map(x=>x.innerText))) if (!n.startsWith('iPhone 6.9')) await pg.click(`.scard.on:has-text("${n.replace(/"/g,'\\"')}")`);
  for (const l of await pg.$$eval('.pill.on', a=>a.map(x=>x.innerText))) if (l !== 'English') await pg.click(`.pill.on:has-text("${l}")`);
  await pg.evaluate(() => { HTMLAnchorElement.prototype.click = function () { fetch(this.href).then(r=>r.arrayBuffer()).then(buf=>{ let s=''; const u=new Uint8Array(buf); for (let i=0;i<u.length;i+=32768) s+=String.fromCharCode.apply(null,u.subarray(i,i+32768)); window.__zip=btoa(s); }); }; });
  await pg.click('button:has-text("Download ZIP")');
  await pg.waitForFunction(() => window.__zip, null, { timeout: 180000 });
  require('fs').writeFileSync(D+'out.zip', Buffer.from(await pg.evaluate(() => window.__zip), 'base64'));
  console.log('errs', JSON.stringify(errs)); await b.close();
})();
