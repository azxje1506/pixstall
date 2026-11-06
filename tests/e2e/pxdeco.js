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
  // Regression: tay cầm resize thực sự đổi kích thước, Bring to center khôi phục vị trí.
  const handle = el.locator('.ed-handle').last();
  const hb = await handle.boundingBox(), beforeSize = await el.boundingBox();
  if (!hb) throw new Error('Missing resize handle');
  await pg.mouse.move(hb.x + hb.width/2, hb.y + hb.height/2); await pg.mouse.down();
  await pg.mouse.move(hb.x + hb.width/2 + 24, hb.y + hb.height/2 + 24, {steps: 5}); await pg.mouse.up();
  await pg.waitForTimeout(150); const afterSize = await el.boundingBox();
  if (afterSize.width <= beforeSize.width + 3) throw new Error('Resize did not enlarge decoration');
  r.resized = true;
  const edgeStart = await el.boundingBox();
  await pg.mouse.move(edgeStart.x + edgeStart.width/2, edgeStart.y + edgeStart.height/2); await pg.mouse.down();
  await pg.mouse.move(1435, 895, {steps: 8}); await pg.mouse.up(); await pg.waitForTimeout(150);
  const eb = await el.boundingBox(), cb = await pg.locator('.slidewrap.on [data-cv]').boundingBox();
  if (eb.x + eb.width/2 > cb.x + cb.width || eb.y + eb.height/2 > cb.y + cb.height) throw new Error('Decoration escaped canvas');
  r.dragBounded = true;
  await pg.click('.right button[aria-label="Bring to center"]'); await pg.waitForTimeout(150);
  const center = await el.boundingBox(), canvasBox = await pg.locator('.slidewrap.on [data-cv]').boundingBox();
  if (Math.abs(center.x + center.width/2 - canvasBox.x - canvasBox.width/2) > 3) throw new Error('Center failed');
  r.centered = true;
  // Thiết bị: kéo ra xa vẫn còn trong khung; dữ liệu cũ nằm hẳn ngoài → hiện nút Bring to center trên canvas
  const dev = pg.locator('.slidewrap.on [data-pick="device"]'), d0 = await dev.boundingBox();
  await pg.mouse.move(d0.x + d0.width/2, d0.y + d0.height/2); await pg.mouse.down(); await pg.mouse.move(5, 5, {steps: 8}); await pg.mouse.up(); await pg.waitForTimeout(150);
  const d1 = await dev.boundingBox(), cv1 = await pg.locator('.slidewrap.on [data-cv]').boundingBox();
  if (d1.x + d1.width/2 < cv1.x || d1.y + d1.height/2 < cv1.y) throw new Error('Device escaped canvas');
  r.deviceBounded = true;
  await pg.click('.right button[aria-label="Bring to center"]'); await pg.waitForTimeout(150);
  await el.click({ force: true }); await pg.waitForTimeout(100);
  await pg.locator('.right .num').filter({ hasText: 'X' }).last().locator('input').fill('400'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(250);
  r.bringBackPill = await pg.locator('.slidewrap.on .ed-bringback').count();
  if (r.bringBackPill !== 1) throw new Error('No bring-back button for off-canvas layer');
  await pg.click('.slidewrap.on .ed-bringback'); await pg.waitForTimeout(200);
  r.pillGone = (await pg.locator('.slidewrap.on .ed-bringback').count()) === 0;
  await pg.screenshot({ path: D + 'bringback.png' });
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
  await pg.click('.right .seg button:text-is("Color")'); await pg.waitForTimeout(150);
  r.solidPresets = await pg.locator('.right .swatches button[aria-label^="Color #"]').count();
  if (r.solidPresets !== 8) throw new Error('Wrong color presets');
  await pg.locator('.right .swatches button[aria-label="Color #BEF264"]').click();
  if (!(await pg.locator('.right .seg button:text-is("Color")').getAttribute('class') || '').includes('on')) throw new Error('Color preset switched mode');
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
