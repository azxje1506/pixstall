// Test 06/11: (1) chọn layer XUYÊN SLIDE bằng Shift-click trên slide khác rồi căn — tiêu đề slide 1-3 về cùng độ cao, 1 Undo;
// (2) cây Layers trái: hover chỉ còn mắt, chuột phải mở menu (ẩn/hiện, nhóm, xoá), đổi tên nhóm tại chỗ, mắt của nhóm ẩn cả nhóm;
// (3) chọn ≥2 layer = MỘT khung bao liền (không còn nét đứt), khớp đúng hợp của các layer
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium-browser' });
  const errs = [], r = {}, D = '/home/namcuong/apps/pixstall-shots/v1/';
  const pg = await b.newPage({ viewport: { width: 1600, height: 900 } });
  pg.on('pageerror', (e) => errs.push(String(e))); pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  const need = (ok, msg) => { if (!ok) throw new Error(msg + ' ' + JSON.stringify(r)); };
  try {
    await pg.goto(process.argv[2], { waitUntil: 'networkidle' }); await pg.waitForTimeout(600);
    await pg.click('text=Explore the sample first'); await pg.waitForTimeout(300);
    const W = (i) => pg.locator(`.slidewrap[data-idx="${i}"]`);
    const T = (i) => W(i).locator('[data-pick="title"]');
    // Lệch tiêu đề slide 2 và 3 cho khác nhau (kéo bằng chuột thật trên slide đó)
    for (const [i, dy] of [[1, 40], [2, -25]]) {
      await W(i).click({ position: { x: 4, y: 4 } }); await pg.waitForTimeout(200);
      const q = await T(i).boundingBox(); await pg.mouse.move(q.x + q.width / 2, q.y + q.height / 2); await pg.mouse.down();
      await pg.mouse.move(q.x + q.width / 2 + 3, q.y + q.height / 2 + dy, { steps: 6 }); await pg.mouse.up(); await pg.waitForTimeout(150);
    }
    const rel = async (i) => { const c = await W(i).locator('[data-cv]').boundingBox(), q = await T(i).boundingBox(); return { top: q.y - c.y, left: q.x - c.x }; };
    const before = await Promise.all([0, 1, 2].map(rel));
    r.topsBefore = before.map((x) => Math.round(x.top));
    need(Math.max(...r.topsBefore) - Math.min(...r.topsBefore) > 20, 'setup offsets');
    // 1) Chọn tiêu đề slide 1 (slide đang sửa), Shift-click tiêu đề slide 2, 3
    await W(0).click({ position: { x: 4, y: 4 } }); await pg.waitForTimeout(200);
    const q0 = await T(0).boundingBox(); await pg.mouse.click(q0.x + q0.width / 2, q0.y + q0.height / 2); await pg.waitForTimeout(150);
    for (const i of [1, 2]) { const q = await T(i).boundingBox(); await pg.keyboard.down('Shift'); await pg.mouse.click(q.x + q.width / 2, q.y + q.height / 2); await pg.keyboard.up('Shift'); await pg.waitForTimeout(150); }
    r.crumb = (await pg.locator('.right .crumb').innerText()).trim();
    r.xMarks = await pg.locator('.slidewrap:not(.on) .ed-hit.xsel').count();
    r.stillSlide1 = await pg.locator('.slidewrap.on').getAttribute('data-idx');
    need(/3 layers · 3 slides/.test(r.crumb) && r.xMarks === 2 && r.stillSlide1 === '0', 'cross select');
    await pg.screenshot({ path: D + 'cross-select.png' });
    // Align top (theo khung bao chung) → mọi tiêu đề cùng độ cao trong khung slide của nó
    await pg.click('.right button[aria-label="Align top"]'); await pg.waitForTimeout(350);
    const after = await Promise.all([0, 1, 2].map(rel));
    r.topsAfter = after.map((x) => Math.round(x.top));
    need(Math.max(...r.topsAfter) - Math.min(...r.topsAfter) <= 1 && Math.abs(Math.min(...r.topsAfter) - Math.min(...r.topsBefore)) <= 1, 'cross align top');
    await pg.screenshot({ path: D + 'cross-aligned.png' });
    // Undo 1 lần → về như cũ ở cả 3 slide
    await pg.keyboard.press('Control+z'); await pg.waitForTimeout(250);
    r.topsUndo = (await Promise.all([0, 1, 2].map(rel))).map((x) => Math.round(x.top));
    need(r.topsUndo.every((t, i) => Math.abs(t - r.topsBefore[i]) <= 1), 'cross undo');
    // Alt+W (căn trên bằng phím) cũng chạy xuyên slide; Esc bỏ chọn xuyên slide
    await pg.keyboard.press('Alt+w'); await pg.waitForTimeout(350);
    r.topsAltW = (await Promise.all([0, 1, 2].map(rel))).map((x) => Math.round(x.top));
    need(Math.max(...r.topsAltW) - Math.min(...r.topsAltW) <= 1, 'Alt+W cross');
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(150);
    r.escClears = await pg.locator('.slidewrap .ed-hit.xsel').count();
    need(r.escClears === 0, 'esc cross');

    // 3) Khung bao chung: thêm 2 hình, chọn chúng + tiêu đề → 1 khung liền, khớp hợp các layer, không nét đứt
    const cv = W(0).locator('[data-cv]');
    for (const k of ['Sparkle', 'Heart']) {
      await cv.click({ position: { x: 4, y: 4 } }); const t = pg.locator(`.right .dtile[aria-label="Add ${k}"]`); await t.scrollIntoViewIfNeeded(); await t.click(); await pg.waitForTimeout(120);
      const top = pg.locator('.right .seg button:has-text("On top")'); await top.scrollIntoViewIfNeeded(); await top.click(); await pg.waitForTimeout(80);
    }
    const ids = await W(0).locator('[data-pick^="d:"]').evaluateAll((els) => els.slice(-2).map((e) => e.dataset.pick));
    const L = (id) => W(0).locator(`[data-pick="${id}"]`);
    const ck = async (id, sh) => { const q = await L(id).boundingBox(); if (sh) await pg.keyboard.down('Shift'); await pg.mouse.click(q.x + q.width / 2, q.y + q.height / 2); if (sh) await pg.keyboard.up('Shift'); await pg.waitForTimeout(150); };
    await ck(ids[0]); await ck(ids[1], true);
    const mb = pg.locator('.slidewrap.on .ed-multibox');
    r.boxStyle = await mb.evaluate((e) => { const c = getComputedStyle(e); return c.borderTopStyle + '/' + c.outlineStyle; });
    const bb = await mb.boundingBox(), rs = await Promise.all(ids.map((i) => L(i).boundingBox()));
    const u = { l: Math.min(...rs.map((q) => q.x)), t: Math.min(...rs.map((q) => q.y)), r: Math.max(...rs.map((q) => q.x + q.width)), b: Math.max(...rs.map((q) => q.y + q.height)) };
    r.boxFit = [bb.x - u.l, bb.y - u.t, bb.x + bb.width - u.r, bb.y + bb.height - u.b].map((v) => Math.round(v));
    r.corners = await mb.locator('i').count();
    need(r.boxStyle.startsWith('solid') && !r.boxStyle.includes('dashed') && r.boxFit.every((v) => Math.abs(v) <= 2) && r.corners === 4, 'union box');
    await pg.screenshot({ path: D + 'union-box.png' });

    // 2) Cây Layers trái: hover hàng chỉ có nút mắt (không còn thùng rác)
    const row = pg.locator('.lchildren .litem:has(.lname:text-is("Sparkle"))').first(); await row.hover(); await pg.waitForTimeout(80);
    r.hoverButtons = await row.locator('button:visible').evaluateAll((bs) => bs.map((x) => x.getAttribute('aria-label')));
    need(r.hoverButtons.length === 1 && /^Hide/.test(r.hoverButtons[0]), 'hover only eye');
    // Chuột phải trên hàng (đang nằm trong vùng chọn 2 hình) → menu có Group selection → bấm
    await row.click({ button: 'right' }); await pg.waitForTimeout(150);
    r.menu1 = await pg.locator('.cmenu').innerText().then((t) => t.split('\n').filter(Boolean));
    need(r.menu1.some((x) => /Group selection/.test(x)) && r.menu1.some((x) => /Hide layer/.test(x)) && r.menu1.some((x) => /^Delete/.test(x)), 'layer menu');
    await pg.locator('.cmenu button:has-text("Group selection")').click(); await pg.waitForTimeout(200);
    r.grouped = await pg.locator('.lchildren .litem.lgrp').count();
    need(r.grouped === 1, 'group via menu');
    // Đổi tên tại chỗ bằng menu Rename
    await pg.locator('.lchildren .litem.lgrp').click({ button: 'right' }); await pg.waitForTimeout(150);
    r.menuGroup = await pg.locator('.cmenu').innerText().then((t) => t.split('\n').filter(Boolean));
    await pg.locator('.cmenu button:has-text("Rename")').click(); await pg.waitForTimeout(100);
    await pg.locator('.litem .lrename').fill('Decor'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(150);
    r.groupName = await pg.locator('.lchildren .litem.lgrp .lname').innerText();
    need(r.groupName === 'Decor', 'rename via menu');
    r.boxLabel = await pg.locator('.slidewrap.on .ed-multibox span').innerText().catch(() => '');
    // Mắt của nhóm: ẩn cả 2 hình; bấm lại hiện
    await pg.locator('.lchildren .litem.lgrp').hover(); await pg.locator('.lchildren .litem.lgrp button[aria-label^="Hide"]').click(); await pg.waitForTimeout(150);
    r.hiddenBoth = await Promise.all(ids.map((i) => L(i).evaluate((e) => getComputedStyle(e).visibility)));
    need(r.hiddenBoth.every((v) => v === 'hidden') && (await pg.locator('.lchildren .litem.lgrp.off').count()) === 1, 'group eye hide');
    await pg.locator('.lchildren .litem.lgrp button[aria-label^="Show"]').click(); await pg.waitForTimeout(150);
    r.shownBoth = await Promise.all(ids.map((i) => L(i).evaluate((e) => getComputedStyle(e).visibility)));
    need(r.shownBoth.every((v) => v === 'visible'), 'group eye show');
    // Panel phải không còn ô đổi tên nhóm
    r.rightRename = await pg.locator('.right input[aria-label="Group name"]').count();
    need(r.rightRename === 0, 'no rename on right');
    // Menu nhóm → Delete group → 2 hình mất; Undo về
    await pg.locator('.lchildren .litem.lgrp').click({ button: 'right' }); await pg.locator('.cmenu button:has-text("Delete group")').click(); await pg.waitForTimeout(200);
    r.afterDel = await W(0).locator('[data-pick^="d:"]').count();
    await pg.keyboard.press('Control+z'); await pg.waitForTimeout(200);
    r.afterUndo = await W(0).locator('[data-pick^="d:"]').count();
    need(r.afterUndo - r.afterDel === 2, 'delete group + undo');
  } catch (e) { errs.push(String(e)); }
  console.log(JSON.stringify({ r, errs }, null, 1));
  await b.close();
})();
