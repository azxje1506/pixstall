// Test trang trí + 3 sửa lỗi 05/11: thêm hình từ kho, kéo, đổi cỡ, Delete/Undo, template thay bộ trang trí (giữ hình user thêm),
// nền Blur khác gradient, màu chữ menu khi hover không trắng, không còn lớp mờ hai bên canvas; chụp ảnh từng bước
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium-browser' });
  const errs = [], r = {}, D = '/home/namcuong/apps/pixstall-shots/v1/';
  const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
  pg.on('pageerror', (e) => errs.push(String(e))); pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await pg.goto(process.argv[2], { waitUntil: 'networkidle' }); await pg.waitForTimeout(600);
  await pg.click('text=Explore the sample first');
  r.edgefade = await pg.locator('.edgefade').count();
  const decos = () => pg.locator('.slidewrap.on [data-pick^="d:"]').count();
  // 1) Thêm Sparkle từ kho (panel cấp slide)
  await pg.locator('.slidewrap.on [data-cv]').click({ position: { x: 6, y: 6 } });
  const tile = pg.locator('.right .dtile[aria-label="Add Sparkle"]'); await tile.scrollIntoViewIfNeeded(); await tile.click(); await pg.waitForTimeout(250);
  r.added = await decos();
  r.crumb = await pg.locator('.right .crumb, .right .bc').first().innerText().catch(() => '');
  const el = pg.locator('.slidewrap.on [data-pick^="d:"]').first(), b0 = await el.boundingBox();
  // 2) Kéo
  await pg.mouse.move(b0.x + b0.width / 2, b0.y + b0.height / 2); await pg.mouse.down(); await pg.mouse.move(b0.x + b0.width / 2 - 60, b0.y + b0.height / 2 + 80, { steps: 6 }); await pg.mouse.up(); await pg.waitForTimeout(150);
  const b1 = await el.boundingBox(); r.moved = Math.round(b1.x - b0.x) + ',' + Math.round(b1.y - b0.y);
  // 3) Đổi hình + lớp trên cùng
  await pg.click('.right .dtile[aria-label="Change to Heart"]'); await pg.waitForTimeout(150);
  await pg.click('.right .seg button:has-text("On top")'); await pg.waitForTimeout(150);
  r.zTop = await el.evaluate((e) => getComputedStyle(e).zIndex);
  await pg.screenshot({ path: D + 'deco-add.png' });
  // 4) Delete + Undo
  await pg.keyboard.press('Delete'); await pg.waitForTimeout(150); r.afterDel = await decos();
  await pg.keyboard.press('Control+z'); await pg.waitForTimeout(150); r.afterUndo = await decos();
  // 5) Template: Candy thêm bộ trang trí, Minimal thay bộ đó, hình user vẫn còn
  await pg.click('.tabs button:has-text("Project style")'); await pg.waitForTimeout(200);
  await pg.click('.tcard:has-text("Candy")'); await pg.waitForTimeout(300); r.candy = await decos();
  await pg.screenshot({ path: D + 'deco-candy.png' });
  await pg.click('.tcard:has-text("Neon Dusk")'); await pg.waitForTimeout(300); await pg.screenshot({ path: D + 'deco-neon.png' });
  await pg.click('.tcard:has-text("Olive Noir")'); await pg.waitForTimeout(300); r.olive = await decos(); await pg.screenshot({ path: D + 'deco-olive.png' });
  await pg.click('.tcard:has-text("Minimal")'); await pg.waitForTimeout(300); r.minimal = await decos();
  r.userKept = await pg.locator('.slidewrap.on [data-pick^="d:"]').evaluateAll((a) => a.length);
  // 6) Nền Blur: khác gradient (có lớp ảnh mờ)
  await pg.click('.tcard:has-text("Violet Night")'); await pg.waitForTimeout(200);
  await pg.click('.right .seg button:has-text("Blur")'); await pg.waitForTimeout(400);
  r.blurLayers = await pg.locator('.slidewrap.on [data-cv] > div[style*="blur("]').count();
  await pg.screenshot({ path: D + 'deco-blur.png' });
  // 7) Hover menu File: chữ không trắng (sáng + tối)
  const hoverColor = async () => { await pg.click('.top button[aria-haspopup="menu"]'); await pg.waitForTimeout(200); const it = pg.locator('.pop button:has-text("Open")').first(); await it.hover(); await pg.waitForTimeout(150);
    const c = await it.evaluate((e) => [getComputedStyle(e).color, getComputedStyle(e.querySelector('.cico') || e).color]); await pg.keyboard.press('Escape'); return c.join(' / '); };
  r.hoverLight = await hoverColor().catch((e) => 'ERR ' + e.message);
  await pg.evaluate(() => document.documentElement.classList.add('dark')); await pg.waitForTimeout(200);
  r.hoverDark = await hoverColor().catch((e) => 'ERR ' + e.message);
  // 8) Lưu lại sau reload
  await pg.evaluate(() => document.documentElement.classList.remove('dark'));
  await pg.waitForTimeout(800); await pg.reload({ waitUntil: 'networkidle' }); await pg.waitForTimeout(800); r.persist = await decos();
  console.log(JSON.stringify({ ...r, errs }, null, 1));
  await b.close();
})();
