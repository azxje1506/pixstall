// E2E Pixstall — mọi menu/popover (Popover chung): không đè nút mở, nằm trong màn, căn đúng mép, đóng bằng Esc/bấm ngoài/bấm lại, phím ↑↓ trong menu, chuột phải sát mép, kéo trong bảng màu. Chạy: NODE_PATH=<playwright>/node_modules node pxpop.js <URL>
// E2E: mọi menu/popover dùng Popover chung — vị trí không đè nút mở, nằm trong màn, đóng bằng Esc/bấm ngoài, bấm lại nút để tắt
const { chromium } = require('playwright');
(async () => {
  const URL = process.argv[2] || 'http://localhost:47811', D = '/home/namcuong/apps/pixstall-shots/pop/';
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium-browser' });
  const res = {};
  for (const [W, H] of [[1440, 900], [1024, 700]]) {
    const pg = await b.newPage({ viewport: { width: W, height: H } });
    const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => m.type() === 'error' && errs.push(m.text()));
    await pg.goto(URL, { waitUntil: 'networkidle' }); await pg.waitForTimeout(700);
    await pg.click('text=Explore the sample first');
    await pg.click('text=Single'); await pg.locator('.slidewrap.on [data-cv]').click({ position: { x: 6, y: 6 } }); await pg.waitForTimeout(200);
    // Kiểm 1 popover: mở bằng trigger, đo khung, so với nút; rồi thử đóng
    const check = async (name, trigger, closeHow = 'esc') => {
      const t = pg.locator(trigger).first();
      const tb = await t.boundingBox();
      await t.click(); await pg.waitForTimeout(250);
      const pop = pg.locator('.pop').last();
      const pb = await pop.boundingBox();
      if (!pb) return res[`${W}/${name}`] = 'NOT OPEN';
      const overlapsTrigger = !(pb.x + pb.width <= tb.x || pb.x >= tb.x + tb.width || pb.y + pb.height <= tb.y || pb.y >= tb.y + tb.height);
      const inView = pb.x >= 7 && pb.y >= 7 && pb.x + pb.width <= W - 7 && pb.y + pb.height <= H - 7;
      const side = await pop.getAttribute('data-side'), align = await pop.getAttribute('data-align');
      const edgeAligned = align === 'end' ? Math.abs((pb.x + pb.width) - (tb.x + tb.width)) < 1.5 : align === 'start' ? Math.abs(pb.x - tb.x) < 1.5 : Math.abs(pb.x + pb.width / 2 - (tb.x + tb.width / 2)) < 1.5;
      const expanded = await t.getAttribute('aria-expanded');
      await pg.screenshot({ path: `${D}${W}-${name}.png` });
      if (closeHow === 'esc') await pg.keyboard.press('Escape');
      else if (closeHow === 'toggle') await t.click();
      else await pg.mouse.click(W / 2, 60);
      await pg.waitForTimeout(150);
      const closed = await pg.locator('.pop').count() === 0;
      res[`${W}/${name}`] = { side, align, overlapsTrigger, inView, edgeAligned, expanded, closed };
    };
    await check('add-text-panel', '.right .gbtn:has-text("Add text")', 'esc');
    await check('add-text-tree', '.lchildren .ladd', 'outside');
    await check('file', '[aria-label="File menu"]', 'toggle');
    await check('target', '.chip.target', 'esc');
    await check('zoom', '.zval', 'esc');
    await check('issues', '.check', 'toggle');
    await pg.click('.tabs button:has-text("Project style")'); await pg.waitForTimeout(150);
    await check('color', '.right .cf-btn', 'esc');
    // Menu: chọn mục bằng bàn phím trong Add text → thêm Badge
    await pg.click('.tabs button:has-text("Slide")');
    await pg.locator('.slidewrap.on [data-cv]').click({ position: { x: 6, y: 6 } });
    await pg.click('.right .gbtn:has-text("Add text")'); await pg.waitForTimeout(150);
    for (let i = 0; i < 3; i++) await pg.keyboard.press('ArrowDown');
    const focused = await pg.evaluate(() => document.activeElement?.innerText);
    await pg.keyboard.press('Enter'); await pg.waitForTimeout(200);
    res[`${W}/keyboard`] = { focused, crumb: await pg.$eval('.crumb', e => e.innerText.replace(/\n/g, ' ')) };
    // Chuột phải sát mép phải dưới → menu phải lật vào trong
    const cv = await pg.locator('.slidewrap.on [data-cv]').boundingBox();
    await pg.mouse.click(cv.x + cv.width - 4, cv.y + cv.height - 4, { button: 'right' }); await pg.waitForTimeout(200);
    const cb = await pg.locator('.pop.cmenu').boundingBox();
    res[`${W}/context`] = cb ? { inView: cb.x >= 7 && cb.y >= 7 && cb.x + cb.width <= W - 7 && cb.y + cb.height <= H - 7, items: await pg.locator('.pop.cmenu button').count() } : 'NOT OPEN';
    await pg.keyboard.press('Escape');
    // Màu: kéo trong bảng màu không làm đóng bảng
    await pg.click('.tabs button:has-text("Project style")'); await pg.waitForTimeout(150);
    res[`${W}/before-color`] = { pops: await pg.locator('.pop').count(), cfbtn: await pg.locator('.right .cf-btn').count(), tab: await pg.$eval('.tabs .on', e => e.innerText) };
    await pg.locator('.right .cf-btn').first().click(); await pg.waitForTimeout(250);
    res[`${W}/after-click`] = { pops: await pg.locator('.pop').count(), exp: await pg.locator('.right .cf-btn').first().getAttribute('aria-expanded') };
    if (!(await pg.locator('.cf-sv').count())) { console.log(JSON.stringify(res, null, 1)); process.exit(1); }
    const sv = await pg.locator('.cf-sv').boundingBox();
    await pg.mouse.move(sv.x + 20, sv.y + 20); await pg.mouse.down(); await pg.mouse.move(sv.x + 100, sv.y + 60, { steps: 5 }); await pg.mouse.up();
    res[`${W}/color-drag`] = { stillOpen: await pg.locator('.cf-pop').count(), recentSaved: null };
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(100);
    res[`${W}/color-drag`].recentSaved = await pg.evaluate(() => (JSON.parse(localStorage.getItem('pixstall:recent-colors') || '[]')).length);
    res[`${W}/errs`] = errs;
    await pg.close();
  }
  console.log(JSON.stringify(res, null, 1));
  await b.close();
})();
