// Test thứ tự lớp 06/11: cây Layers xếp theo lớp (trên cùng trước), kéo thả hàng bằng chuột thật đổi z thật trên canvas,
// kéo vào/ra nhóm, kéo cả nhóm, Ctrl+] / Ctrl+Shift+[ , menu chuột phải Bring to front, Undo; nhóm đang chọn không còn viền con/khung hover thừa
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium-browser' });
  const errs = [], r = {}, D = '/home/namcuong/apps/pixstall-shots/v1/';
  const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
  pg.on('pageerror', (e) => errs.push(String(e))); pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  const need = (ok, msg) => { if (!ok) throw new Error(msg + ' ' + JSON.stringify(r)); };
  try {
    await pg.goto(process.argv[2], { waitUntil: 'networkidle' }); await pg.waitForTimeout(600);
    await pg.click('text=Explore the sample first');
    const cv = pg.locator('.slidewrap.on [data-cv]'), bg = () => cv.click({ position: { x: 4, y: 4 } });
    for (const k of ['Sparkle', 'Heart']) { await bg(); const t = pg.locator(`.right .dtile[aria-label="Add ${k}"]`); await t.scrollIntoViewIfNeeded(); await t.click(); await pg.waitForTimeout(120); }
    const ids = await pg.locator('.slidewrap.on [data-pick^="d:"]').evaluateAll((els) => els.map((e) => e.dataset.pick));
    const tree = () => pg.$$eval('.lchildren .litem[data-lid]', (a) => a.map((x) => (x.classList.contains('nested') ? '  ' : '') + x.querySelector('.lname').innerText));
    const z = (id) => pg.locator(`.slidewrap.on [data-pick="${id}"]`).evaluate((e) => +getComputedStyle(e).zIndex);
    const row = (name) => pg.locator(`.lchildren .litem[data-lid]:has(.lname:text-is("${name}"))`).first();
    // Kéo hàng A tới nửa trên/dưới hàng B bằng chuột thật
    const dragRow = async (from, to, low) => {
      const a = await from.boundingBox(), c = await to.boundingBox();
      await pg.mouse.move(a.x + 40, a.y + a.height / 2); await pg.mouse.down();
      await pg.mouse.move(a.x + 40, a.y + a.height / 2 + 6, { steps: 3 });
      await pg.mouse.move(c.x + 40, c.y + (low ? c.height * 0.8 : c.height * 0.2), { steps: 8 });
      r.lastDropCls = await to.getAttribute('class');
      await pg.mouse.up(); await pg.waitForTimeout(200);
    };
    r.tree0 = await tree();
    need(r.tree0.indexOf('Device') < r.tree0.indexOf('Sparkle') && r.tree0.indexOf('Headline') < r.tree0.indexOf('Subtitle'), 'default order');
    // 1) Kéo Sparkle lên trên Headline → z Sparkle > z Headline và > Device
    await dragRow(row('Sparkle'), row('Headline'), false);
    r.tree1 = await tree(); r.z1 = { spark: await z(ids[0]), title: await z('title'), dev: await z('device') };
    need(r.tree1[0] === 'Sparkle' && r.z1.spark > r.z1.title && r.z1.spark > r.z1.dev && /drop-before/.test(r.lastDropCls), 'drag to top');
    // Thật sự nằm trên: điểm giữa Sparkle trên canvas trúng Sparkle
    const hitTop = async (id) => { const q = await pg.locator(`.slidewrap.on [data-pick="${id}"]`).boundingBox(); return pg.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('[data-pick]')?.dataset.pick, [q.x + q.width / 2, q.y + q.height / 2]); };
    // 2) Undo → về như cũ
    await pg.keyboard.press('Control+z'); await pg.waitForTimeout(200);
    r.treeUndo = await tree(); need(JSON.stringify(r.treeUndo) === JSON.stringify(r.tree0), 'undo reorder');
    // 3) Phím tắt: chọn Heart (đang dưới máy) → Ctrl+Shift+] lên trên cùng
    await pg.locator('.lchildren .litem[data-lid]:has(.lname:text-is("Heart"))').first().click(); await pg.waitForTimeout(100);
    await pg.keyboard.press('BracketRight'); await pg.waitForTimeout(150);
    r.tree3 = await tree(); r.heartTop = await hitTop(ids[1]);
    need(r.tree3[0] === 'Heart' && r.heartTop === ids[1], 'Ctrl+Shift+]');
    await pg.keyboard.press('Control+BracketLeft'); await pg.waitForTimeout(150);
    r.tree3b = await tree(); need(r.tree3b[1] === 'Heart', 'Ctrl+[');
    // 4) Menu chuột phải → Send to back
    await row('Heart').click({ button: 'right' }); await pg.waitForTimeout(120);
    r.menu = (await pg.locator('.cmenu').innerText()).split('\n').filter((x) => /Bring|Send/.test(x));
    await pg.locator('.cmenu button:has-text("Send to back")').click(); await pg.waitForTimeout(150);
    r.tree4 = await tree(); need(r.tree4[r.tree4.length - 1] === 'Heart', 'menu send to back');
    // 4b) Heart đang dưới cùng, bị tiêu đề che: chọn Heart (cây) → kéo tại chỗ bị che vẫn kéo Heart; bấm-thả không kéo → chọn tiêu đề
    await row('Heart').click(); await pg.waitForTimeout(120);
    // đưa Heart vào giữa tiêu đề bằng phím (Shift+mũi tên = 2em) để có vùng bị che rõ ràng
    { const H0 = await pg.locator(`.slidewrap.on [data-pick="${ids[1]}"]`).boundingBox(), T0 = await pg.locator('.slidewrap.on [data-pick="title"]').boundingBox(), em = (await cv.boundingBox()).width / 50;
      const nx = Math.round((T0.x + T0.width / 2 - H0.x - H0.width / 2) / em), ny = Math.round((T0.y + T0.height / 2 - H0.y - H0.height / 2) / em);
      for (let k = 0; k < Math.abs(nx); k++) await pg.keyboard.press(nx > 0 ? 'Shift+ArrowRight' : 'Shift+ArrowLeft');
      for (let k = 0; k < Math.abs(ny); k++) await pg.keyboard.press(ny > 0 ? 'Shift+ArrowDown' : 'Shift+ArrowUp');
      await pg.waitForTimeout(150); }
    const H = pg.locator(`.slidewrap.on [data-pick="${ids[1]}"]`), hb = await H.boundingBox(), tb0 = await pg.locator('.slidewrap.on [data-pick="title"]').boundingBox();
    // điểm nằm trong Heart nhưng elementFromPoint ra tiêu đề (vùng bị che)
    const pt = await pg.evaluate(([b, id]) => { for (let fy = 0.3; fy < 0.75; fy += 0.05) for (let fx = 0.3; fx < 0.75; fx += 0.05) { const x = b.x + b.width * fx, y = b.y + b.height * fy; if (document.elementFromPoint(x, y)?.closest('[data-pick]')?.dataset.pick === 'title') return [x, y]; } return null; }, [hb, ids[1]]);
    need(!!pt, 'no covered point');
    const [px, py] = pt;
    r.coveredBy = await pg.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('[data-pick]')?.dataset.pick, [px, py]);
    await pg.mouse.move(px, py); await pg.mouse.down(); await pg.mouse.move(px + 10, py, { steps: 6 }); await pg.mouse.up(); await pg.waitForTimeout(150);
    const hb2 = await H.boundingBox(), tb1 = await pg.locator('.slidewrap.on [data-pick="title"]').boundingBox();
    r.coveredDrag = [Math.round(hb2.x - hb.x), Math.round(tb1.x - tb0.x)];
    need(r.coveredBy === 'title' && r.coveredDrag[0] > 6 && r.coveredDrag[1] === 0, 'drag selected layer under another');
    const pt2 = await pg.evaluate(([b]) => { for (let fy = 0.3; fy < 0.75; fy += 0.05) for (let fx = 0.3; fx < 0.75; fx += 0.05) { const x = b.x + b.width * fx, y = b.y + b.height * fy; if (document.elementFromPoint(x, y)?.closest('[data-pick]')?.dataset.pick === 'title') return [x, y]; } return null; }, [hb2]);
    need(!!pt2, 'no covered point 2');
    await pg.mouse.click(pt2[0], pt2[1]); await pg.waitForTimeout(200);
    r.crumbAfterClick = await pg.locator('.right .crumb').innerText(); r.clickPicksTop = r.crumbAfterClick.includes('Headline');
    need(r.clickPicksTop, 'click selects top layer');
    await pg.keyboard.press('Control+z'); await pg.waitForTimeout(150);
    // 5) Nhóm Headline + Subtitle; kéo Sparkle vào nhóm (thả dưới Headline đang thụt) → Sparkle thành con
    await bg(); await row('Headline').click(); await pg.keyboard.down('Shift'); await row('Subtitle').click(); await pg.keyboard.up('Shift');
    await pg.keyboard.press('Control+g'); await pg.waitForTimeout(200);
    r.tree5 = await tree();
    await dragRow(row('Sparkle'), row('Headline'), true);
    r.tree5b = await tree();
    need(r.tree5b.includes('  Sparkle') && r.tree5b.filter((x) => x.startsWith('  ')).length === 3, 'drag into group');
    // 6) Kéo Sparkle ra khỏi nhóm (thả dưới Device, hàng ngoài nhóm)
    await dragRow(row('Sparkle'), row('Device'), true);
    r.tree6 = await tree(); need(r.tree6.includes('Sparkle') && r.tree6.filter((x) => x.startsWith('  ')).length === 2, 'drag out of group');
    // 7) Kéo cả nhóm (dòng nhóm) xuống dưới Device → cả Headline, Subtitle nằm dưới máy
    await dragRow(pg.locator('.lchildren .litem.lgrp').first(), row('Device'), true);
    r.tree7 = await tree(); r.z7 = { title: await z('title'), sub: await z('sub'), dev: await z('device') };
    need(r.z7.title < r.z7.dev && r.z7.sub < r.z7.dev, 'drag group below device');
    await pg.screenshot({ path: D + 'order-group-below.png' });
    await pg.keyboard.press('Control+z'); await pg.waitForTimeout(200);
    // 8) Nhóm đang chọn: rê lên 1 con → không có khung hover thừa, con không có viền riêng
    await pg.locator('.lchildren .litem.lgrp').first().click(); await pg.waitForTimeout(150);
    const tb = await pg.locator('.slidewrap.on [data-pick="title"]').boundingBox(); await pg.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2); await pg.waitForTimeout(150);
    r.ghover = await pg.locator('.slidewrap.on .ed-ghover').count();
    r.childOutline = await pg.locator('.slidewrap.on [data-pick="title"]').evaluate((e) => getComputedStyle(e).outlineColor);
    need(r.ghover === 0 && /rgba\(0, 0, 0, 0\)|transparent/.test(r.childOutline), 'no extra hover frame');
    await pg.screenshot({ path: D + 'order-group-hover.png' });
  } catch (e) { errs.push(String(e)); }
  console.log(JSON.stringify({ r, errs }, null, 1));
  await b.close();
})();
