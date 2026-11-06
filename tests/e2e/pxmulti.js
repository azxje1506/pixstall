// Test chọn nhiều layer: Shift-click canvas, kéo vùng (marquee), khung nhóm, Align theo nhóm/khung, Distribute,
// kéo cả nhóm bằng chuột thật, bấm-thả = chọn riêng, mũi tên nhích nhóm, Ctrl+A, Delete nhóm + Undo; chụp ảnh từng bước
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium-browser' });
  const errs = [], r = {}, D = '/home/namcuong/apps/pixstall-shots/v1/';
  const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
  pg.on('pageerror', (e) => errs.push(String(e))); pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  try {
    await pg.goto(process.argv[2], { waitUntil: 'networkidle' }); await pg.waitForTimeout(600);
    await pg.click('text=Explore the sample first');
    const cv = pg.locator('.slidewrap.on [data-cv]');
    const bg = () => cv.click({ position: { x: 4, y: 4 } });
    // Thêm 3 hình trang trí
    for (const k of ['Sparkle', 'Heart', 'Star']) {
      await bg(); const t = pg.locator(`.right .dtile[aria-label="Add ${k}"]`); await t.scrollIntoViewIfNeeded(); await t.click(); await pg.waitForTimeout(150);
      const top = pg.locator('.right .seg button:has-text("On top")'); await top.scrollIntoViewIfNeeded(); await top.click(); await pg.waitForTimeout(100); // nằm trên chữ để bấm trúng
    }
    const D3 = pg.locator('.slidewrap.on [data-pick^="d:"]');
    r.decos = await D3.count(); if (r.decos < 3) throw new Error('need 3 decos');
    const ids = await D3.evaluateAll((els) => els.slice(-3).map((e) => e.dataset.pick));
    const L = (id) => pg.locator(`.slidewrap.on [data-pick="${id}"]`);
    const box = async (id) => L(id).boundingBox();
    const click = async (id, mod) => { const q = await box(id); if (mod) await pg.keyboard.down('Shift'); await pg.mouse.click(q.x + q.width / 2, q.y + q.height / 2); if (mod) await pg.keyboard.up('Shift'); await pg.waitForTimeout(150); };
    // 1) Shift-click 3 hình → khung nhóm "3 layers" + panel nhóm
    await click(ids[0]); await click(ids[1], true); await click(ids[2], true);
    r.mbox = await pg.locator('.slidewrap.on .ed-multibox').innerText().catch(() => '');
    r.crumb = await pg.locator('.right .crumb').innerText();
    r.msel = await pg.locator('.slidewrap.on .ed-hit.msel').count();
    if (!/3 layers/.test(r.mbox) || r.msel !== 3 || !/3 layers/.test(r.crumb)) throw new Error('multi select failed ' + JSON.stringify(r));
    await pg.screenshot({ path: D + 'multi-select.png' });
    // 2) Align left theo nhóm: mép trái bằng nhau = mép trái nhỏ nhất ban đầu
    const lefts0 = await Promise.all(ids.map(async (i) => (await box(i)).x));
    await pg.click('.right button[aria-label="Align left"]'); await pg.waitForTimeout(350);
    const lefts = await Promise.all(ids.map(async (i) => (await box(i)).x));
    r.alignLeftSpread = Math.round(Math.max(...lefts) - Math.min(...lefts)); r.alignLeftAnchor = Math.round(Math.min(...lefts) - Math.min(...lefts0));
    if (r.alignLeftSpread > 1.5 || Math.abs(r.alignLeftAnchor) > 1.5) throw new Error('align-left group off');
    // 3) Distribute dọc: khoảng trống giữa các hình bằng nhau
    await pg.click('.right button[aria-label="Distribute vertical spacing"]'); await pg.waitForTimeout(350);
    const bs = (await Promise.all(ids.map(box))).sort((a, c) => a.y - c.y);
    const gaps = [bs[1].y - bs[0].y - bs[0].height, bs[2].y - bs[1].y - bs[1].height];
    r.vgaps = gaps.map(Math.round); if (Math.abs(gaps[0] - gaps[1]) > 1.5) throw new Error('distribute off ' + r.vgaps);
    // 4) Align to Slide + căn giữa ngang: tâm mỗi hình = tâm khung
    await pg.locator('.right [role=tab]', { hasText: 'Slide' }).last().click(); await pg.click('.right button[aria-label="Align horizontal center"]'); await pg.waitForTimeout(350);
    const c0 = await cv.boundingBox();
    r.centerOff = Math.round(Math.max(...(await Promise.all(ids.map(box))).map((q) => Math.abs(q.x + q.width / 2 - c0.x - c0.width / 2))));
    if (r.centerOff > 1.5) throw new Error('align-to-frame off');
    await pg.screenshot({ path: D + 'multi-align.png' });
    // 5) Kéo cả nhóm bằng chuột thật: mọi hình dời cùng một khoảng
    const before = await Promise.all(ids.map(box)), q = before[1];
    await pg.mouse.move(q.x + q.width / 2, q.y + q.height / 2); await pg.mouse.down();
    await pg.mouse.move(q.x + q.width / 2 - 70, q.y + q.height / 2 + 37, { steps: 8 }); await pg.mouse.up(); await pg.waitForTimeout(200);
    const after = await Promise.all(ids.map(box));
    const dx = after.map((a, i) => Math.round(a.x - before[i].x)), dy = after.map((a, i) => Math.round(a.y - before[i].y));
    r.groupDrag = dx.join('/') + ' ' + dy.join('/');
    if (Math.abs(dx[0]) < 20 || new Set(dx).size > 1 && Math.max(...dx) - Math.min(...dx) > 1 || Math.max(...dy) - Math.min(...dy) > 1) throw new Error('group drag not uniform ' + r.groupDrag);
    r.stillMulti = await pg.locator('.slidewrap.on .ed-multibox').count();
    // 6) Mũi tên nhích cả nhóm
    const n0 = await Promise.all(ids.map(box)); await pg.keyboard.press('Shift+ArrowRight'); await pg.waitForTimeout(150);
    const n1 = await Promise.all(ids.map(box)); r.nudge = n1.map((a, i) => Math.round(a.x - n0[i].x)).join('/');
    if (n1.some((a, i) => a.x - n0[i].x < 5)) throw new Error('nudge group failed');
    // 7) Bấm-thả không kéo vào 1 hình → chọn riêng hình đó
    await click(ids[0]);
    r.afterClickSingle = await pg.locator('.slidewrap.on .ed-multibox').count();
    if (r.afterClickSingle !== 0 || (await pg.locator('.slidewrap.on .ed-hit.sel').count()) !== 1) throw new Error('click did not collapse to single');
    // 8) Kéo vùng (marquee) trên nền: chọn được ≥2 layer, có khung xanh khi đang kéo
    await bg(); const cb = await cv.boundingBox();
    await pg.mouse.move(cb.x + 4, cb.y + 4); await pg.mouse.down(); await pg.mouse.move(cb.x + cb.width * 0.9, cb.y + cb.height * 0.35, { steps: 8 });
    r.marqueeBox = await pg.locator('.slidewrap.on .ed-marquee').count(); r.prePreview = await pg.locator('.slidewrap.on .ed-hit.pre').count();
    await pg.screenshot({ path: D + 'multi-marquee.png' });
    await pg.mouse.up(); await pg.waitForTimeout(200);
    r.marqueeSel = await pg.locator('.slidewrap.on .ed-hit.msel').count();
    if (r.marqueeBox !== 1 || r.marqueeSel < 2) throw new Error('marquee failed');
    // 10) Ctrl+A → chọn mọi layer đang hiện; Delete xoá chữ + trang trí (giữ máy); Undo khôi phục
    await bg(); await pg.keyboard.press('Control+a'); await pg.waitForTimeout(150);
    const all = await pg.locator('.slidewrap.on [data-pick]').evaluateAll((els) => els.filter((e) => getComputedStyle(e).visibility !== 'hidden').length);
    r.selectAll = (await pg.locator('.slidewrap.on .ed-hit.msel').count()) + '/' + all;
    if (!r.selectAll.startsWith(all + '/')) throw new Error('select all failed');
    const nd0 = await D3.count();
    await pg.keyboard.press('Delete'); await pg.waitForTimeout(200);
    r.afterDelete = await D3.count(); r.deviceKept = await pg.locator('.slidewrap.on [data-pick="device"]').count();
    await pg.keyboard.press('Control+z'); await pg.waitForTimeout(200);
    r.afterUndo = await D3.count();
    if (r.afterDelete !== 0 || r.deviceKept !== 1 || r.afterUndo !== nd0) throw new Error('delete/undo group failed');
    // 11) Esc bỏ nhóm
    await pg.keyboard.press('Control+a'); await pg.keyboard.press('Escape'); await pg.waitForTimeout(100);
    r.escClears = (await pg.locator('.slidewrap.on .ed-hit.msel').count()) === 0;
  } catch (e) { errs.push(String(e)); }
  console.log(JSON.stringify({ r, errs }, null, 1));
  await b.close();
})();
