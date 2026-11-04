// E2E Pixstall — Cột trái sắp xếp, tên dự án, Target, bảng lỗi nhảy slide, phím tắt, Export nhớ lựa chọn + huỷ. Chạy: NODE_PATH=<thư mục có playwright>/node_modules node pxp4.js <URL> (mặc định localhost:47811)
const { chromium } = require('playwright');
(async () => {
  const URL = process.argv[2] || 'http://localhost:47811', D='/home/namcuong/apps/pixstall-shots/p4/';
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium-browser' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const pg = await ctx.newPage(); const errs=[]; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => m.type()==='error' && errs.push(m.text()));
  const r = {};
  await pg.goto(URL, { waitUntil: 'networkidle' }); await pg.waitForTimeout(700);
  await pg.click('text=Explore the sample first').catch(()=>{});
  r.samplebar = await pg.$eval('.samplebar', e=>e.innerText).catch(()=>null);
  r.sampleTags = await pg.locator('.item .tag.soft').count();
  r.rowBtns = await pg.locator('.item').first().locator('.rowact button').count();
  // kéo hàng 0 xuống dưới hàng 2 → kiểm tra thứ tự
  const t0 = await pg.$$eval('.list > .lgroup > .item .sub', a=>a.map(x=>x.innerText));
  await pg.locator('.list > .lgroup > .item').nth(0).dragTo(pg.locator('.list > .lgroup > .item').nth(2), { targetPosition: { x: 60, y: 60 } });
  await pg.waitForTimeout(200);
  r.reorder = [t0.slice(0,3), await pg.$$eval('.list > .lgroup > .item .sub', a=>a.slice(0,3).map(x=>x.innerText))];
  // tên dự án
  await pg.click('.pname'); await pg.keyboard.press('Control+a'); await pg.keyboard.type('Bloom Launch'); await pg.keyboard.press('Enter');
  r.pname = await pg.$eval('.pname input', e=>e.value);
  // menu target → Google Play Tablet 10"
  await pg.click('.chip.target'); await pg.waitForTimeout(150);
  await pg.screenshot({ path: D+'01-target.png' });
  await pg.click('.tcol:nth-child(2) button:has-text("Tablet 10")'); await pg.click('text=Store view').catch(()=>{}); await pg.waitForTimeout(250);
  r.target = await pg.$eval('.chip.target', e=>e.innerText.replace(/\n/g,' '));
  r.feature = await pg.locator('text=Feature graphic').count();
  await pg.click('.chip.target'); await pg.click('.tcol:nth-child(1) button:has-text("iPhone 6.9")'); await pg.waitForTimeout(200);
  // tạo lỗi: xoá headline slide 3 → mở issues → nhảy
  await pg.locator('.list > .lgroup > .item').nth(2).click(); await pg.click('text=Single').catch(()=>{}); await pg.locator('.slidewrap.on [data-pick=title]').click(); await pg.fill('.right textarea', ''); await pg.locator('.list > .lgroup > .item').nth(0).click();
  await pg.click('.check'); await pg.waitForTimeout(150);
  r.issues = await pg.$$eval('.issues .irow', a=>a.map(x=>x.innerText));
  await pg.screenshot({ path: D+'02-issues.png' });
  await pg.click('.irow.link'); await pg.waitForTimeout(200);
  r.jumped = await pg.$eval('.list .item.on .idx', e=>e.innerText);
  await pg.keyboard.press('Control+z');
  // phím tắt
  await pg.mouse.click(720, 450); await pg.keyboard.press('Escape'); await pg.keyboard.press('Shift+Slash'); await pg.waitForTimeout(200);
  r.keys = await pg.locator('.keys .krow').count();
  await pg.screenshot({ path: D+'03-keys.png' });
  await pg.keyboard.press('Escape'); await pg.click('.modal', { position: { x: 5, y: 5 } }).catch(()=>{});
  // nền canvas tối
  await pg.click('[aria-label="Toggle canvas background"]'); await pg.waitForTimeout(150);
  r.cvDark = await pg.locator('.main.cv-dark').count();
  await pg.screenshot({ path: D+'04-cvdark.png' });
  // export: chọn iPhone 6.9 only, PNG, thật
  await pg.click('text=Export'); await pg.waitForTimeout(300);
  await pg.screenshot({ path: D+'05-export.png' });
  const on = await pg.$$eval('.scard.on .sname', a=>a.map(x=>x.innerText));
  for (const n of on) if (!n.startsWith('iPhone 6.9')) await pg.click(`.scard.on:has-text("${n.replace(/"/g,'\\"')}")`);
  r.exportPicked = await pg.$$eval('.scard.on .sname', a=>a.map(x=>x.innerText));
  // thử huỷ: bật thêm iPad rồi bắt đầu, huỷ ngay
  await pg.click('.scard:has-text("iPad 13")'); await pg.click('button:has-text("Download ZIP")'); await pg.waitForTimeout(400);
  r.cancelBtn = await pg.locator('button:has-text("Cancel")').count();
  await pg.click('button:has-text("Cancel")'); await pg.waitForTimeout(1500);
  r.afterCancel = await pg.locator('button:has-text("Download ZIP")').count();
  await pg.click('.scard:has-text("iPad 13")');
  await pg.evaluate(() => { HTMLAnchorElement.prototype.click = function () { window.__name = this.download; fetch(this.href).then(r=>r.arrayBuffer()).then(buf=>{ let s=''; const u=new Uint8Array(buf); for (let i=0;i<u.length;i+=32768) s+=String.fromCharCode.apply(null,u.subarray(i,i+32768)); window.__zip=btoa(s); }); }; });
  await pg.click('button:has-text("Download ZIP")');
  await pg.waitForFunction(() => window.__zip, null, { timeout: 180000 });
  const b64 = await pg.evaluate(() => window.__zip); require('fs').writeFileSync(D+'out.zip', Buffer.from(b64, 'base64'));
  r.zipName = await pg.evaluate(() => window.__name);
  await pg.waitForTimeout(400); r.toast = await pg.$eval('.toast', e=>e.innerText).catch(()=>null);
  // mở lại export → nhớ lựa chọn
  await pg.click('text=Export'); await pg.waitForTimeout(200);
  r.remembered = await pg.$$eval('.scard.on .sname', a=>a.map(x=>x.innerText));
  r.errs = errs; console.log(JSON.stringify(r,null,1)); await b.close();
})();
