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
  const cvb = () => pg.locator('.slidewrap.on [data-cv]').boundingBox();
  // Kéo trang trí ra ngoài khung: được phép; hiện khung ma ở phần ngoài; kéo khung ma để đưa lại vào
  const e0 = await el.boundingBox(), c0 = await cvb();
  await pg.mouse.move(e0.x + e0.width/2, e0.y + e0.height/2); await pg.mouse.down();
  await pg.mouse.move(c0.x + c0.width + 4, e0.y + e0.height/2, {steps: 8}); await pg.mouse.up(); await pg.waitForTimeout(200);
  const e1 = await el.boundingBox();
  r.decoOut = e1.x + e1.width/2 > c0.x + c0.width - 1;
  if (!r.decoOut) throw new Error('Decoration could not leave the frame');
  r.ghost = await pg.locator('.slidewrap.on .ed-ghost').count();
  if (r.ghost !== 1) throw new Error('No selection box outside the frame');
  const gb = await pg.locator('.slidewrap.on .ed-ghost').boundingBox();
  await pg.screenshot({ path: D + 'ghost.png' });
  await pg.mouse.move(gb.x + gb.width - 4, gb.y + gb.height/2); await pg.mouse.down();
  await pg.mouse.move(gb.x + gb.width - 4 - c0.width/2, gb.y + gb.height/2, {steps: 8}); await pg.mouse.up(); await pg.waitForTimeout(200);
  const e2 = await el.boundingBox();
  r.ghostDragBack = e2.x + e2.width < c0.x + c0.width && (await pg.locator('.slidewrap.on .ed-ghost').count()) === 0;
  if (!r.ghostDragBack) throw new Error('Could not drag back via ghost');
  // Align: trái / phải / dưới khớp mép khung
  await pg.click('.right button[aria-label="Align left"]'); await pg.waitForTimeout(150);
  let a = await el.boundingBox(); r.alignLeft = Math.round(a.x - c0.x);
  await pg.click('.right button[aria-label="Align right"]'); await pg.waitForTimeout(150);
  a = await el.boundingBox(); r.alignRight = Math.round(c0.x + c0.width - a.x - a.width);
  await pg.click('.right button[aria-label="Align bottom"]'); await pg.waitForTimeout(150);
  a = await el.boundingBox(); r.alignBottom = Math.round(c0.y + c0.height - a.y - a.height);
  if (Math.abs(r.alignLeft) > 1 || Math.abs(r.alignRight) > 1 || Math.abs(r.alignBottom) > 1) throw new Error('Align off ' + [r.alignLeft, r.alignRight, r.alignBottom]);
  await pg.click('.right button[aria-label="Bring to center"]'); await pg.waitForTimeout(150);
  const center = await el.boundingBox();
  if (Math.abs(center.x + center.width/2 - c0.x - c0.width/2) > 3) throw new Error('Center failed');
  r.centered = true;
  // Máy: kéo hẳn ra ngoài → khung ma + nút Bring to center trên slide; bấm → về lại, nút biến mất
  const dev = pg.locator('.slidewrap.on [data-pick="device"]'), d0 = await dev.boundingBox();
  await pg.mouse.move(d0.x + d0.width/2, d0.y + d0.height/2); await pg.mouse.down(); await pg.mouse.move(d0.x + d0.width/2 + c0.width * 1.1, d0.y + d0.height/2, {steps: 10}); await pg.mouse.up(); await pg.waitForTimeout(250);
  r.bringBackPill = await pg.locator('.slidewrap.on .ed-bringback').count();
  await pg.screenshot({ path: D + 'bringback.png' });
  if (r.bringBackPill !== 1) throw new Error('No bring-back button for off-canvas layer');
  await pg.click('.slidewrap.on .ed-bringback'); await pg.waitForTimeout(200);
  r.pillGone = (await pg.locator('.slidewrap.on .ed-bringback').count()) === 0 && (await pg.locator('.slidewrap.on .ed-ghost').count()) === 0;
  if (!r.pillGone) throw new Error('Bring back did not restore device');
  await el.click({ force: true }); await pg.waitForTimeout(100); r.selAfter = await pg.locator('.right .crumb').innerText().catch(()=>'');
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
  r.blurLayers = await pg.locator('.slidewrap.on [data-cv] .cv-clip > div[style*="blur("]').count();
  await pg.screenshot({ path: D + 'deco-blur.png' });
  await pg.click('.right .seg button:text-is("Color")'); await pg.waitForTimeout(150);
  r.solidPresets = await pg.locator('.right .swatches button[aria-label^="Color #"]').count();
  if (r.solidPresets !== 8) throw new Error('Wrong color presets');
  r.swatchRing = await pg.locator('.right .swatches button.on').first().evaluate((e) => getComputedStyle(e).outlineWidth + '+' + getComputedStyle(e).outlineOffset).catch(() => 'none');
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
