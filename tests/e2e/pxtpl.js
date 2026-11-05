// Test v1.1 #2 Template: áp 4 template ở tab Project style, kiểm thẻ "on", nền slide đổi, style riêng bị xoá, Undo trả lại; chụp ảnh từng template
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium-browser' });
  const errs = [], res = {};
  const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
  pg.on('pageerror', (e) => errs.push(String(e))); pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await pg.goto(process.argv[2], { waitUntil: 'networkidle' }); await pg.waitForTimeout(600);
  await pg.click('text=Explore the sample first');
  const bgOf = () => pg.evaluate(() => { const e = document.querySelector('.slidewrap [data-cv]'); return getComputedStyle(e).backgroundImage + '|' + getComputedStyle(e).backgroundColor; });
  // Tạo style riêng cho slide 1: chọn slide → đổi nền sang Color
  await pg.locator('.slidewrap.on [data-cv]').click({ position: { x: 6, y: 6 } });
  await pg.click('.right .seg button:has-text("Color")').catch((e) => errs.push('no Color seg: ' + e.message));
  await pg.click('.tabs button:has-text("Project style")'); await pg.waitForTimeout(300);
  res.ownBefore = await pg.locator('.ownnote').count();
  res.cards = await pg.locator('.tcard').allInnerTexts();
  const bg0 = await bgOf();
  // Chiều ngang thẻ: không tràn panel
  res.overflow = await pg.evaluate(() => [...document.querySelectorAll('.tcard, .tgrid')].filter((e) => e.scrollWidth > e.clientWidth + 1).length);
  for (const name of ['Minimal', 'Bold', 'Dark', 'Playful', 'Candy', 'Editorial', 'Neon Dusk', 'Olive Noir']) {
    await pg.click(`.tcard:has-text("${name}")`); await pg.waitForTimeout(350);
    res[name] = { on: await pg.locator('.tcard.on').innerText().catch(() => ''), toast: await pg.locator('.toast').innerText().catch(() => ''), bg: (await bgOf()).slice(0, 70) };
    await pg.screenshot({ path: `/home/namcuong/apps/pixstall-shots/v1/tpl-${name.toLowerCase()}.png` });
  }
  res.ownAfter = await pg.locator('.ownnote').count();
  // Undo 4 lần → về style ban đầu (kể cả style riêng slide 1)
  for (let i = 0; i < 8; i++) { await pg.keyboard.press('Control+z'); await pg.waitForTimeout(150); }
  res.undoBack = (await bgOf()) === bg0; res.ownUndo = await pg.locator('.ownnote').count();
  // Sửa 1 thông số sau khi áp → thẻ hết "on"
  await pg.click('.tcard:has-text("Dark")'); await pg.waitForTimeout(200);
  await pg.click('.swatches button[title="Silver"]'); await pg.waitForTimeout(200);
  res.onAfterEdit = await pg.locator('.tcard.on').count();
  // Reload: theme đã lưu
  await pg.waitForTimeout(800); await pg.reload({ waitUntil: 'networkidle' }); await pg.waitForTimeout(800);
  await pg.click('.tabs button:has-text("Project style")').catch(() => {});
  res.persistSilver = await pg.locator('.swatches button[title="Silver"].on').count();
  await pg.screenshot({ path: '/home/namcuong/apps/pixstall-shots/v1/tpl-panel.png', clip: { x: 1440 - 330, y: 40, width: 330, height: 520 } });
  console.log(JSON.stringify({ ...res, errs }, null, 1));
  await b.close();
})();
