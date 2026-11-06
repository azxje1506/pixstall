// Test Group: Ctrl+G gom 3 hình, bấm 1 con = chọn cả nhóm, kéo nhóm bằng chuột thật, hover viền nhóm, double-click vào trong + kéo riêng con,
// Esc lùi về nhóm, Align nhóm theo khung (giữ bố cục), Alt+A, cây Layers (dòng nhóm + con thụt, Shift-click), xoá con → nhóm tự tỉa,
// Ungroup + Undo, đổi template giữ đúng nhóm; chụp ảnh từng bước
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
    const cv = pg.locator('.slidewrap.on [data-cv]');
    const bg = () => cv.click({ position: { x: 4, y: 4 } });
    for (const k of ['Sparkle', 'Heart', 'Star']) {
      await bg(); const t = pg.locator(`.right .dtile[aria-label="Add ${k}"]`); await t.scrollIntoViewIfNeeded(); await t.click(); await pg.waitForTimeout(120);
      const top = pg.locator('.right .seg button:has-text("On top")'); await top.scrollIntoViewIfNeeded(); await top.click(); await pg.waitForTimeout(80);
    }
    const ids = await pg.locator('.slidewrap.on [data-pick^="d:"]').evaluateAll((els) => els.slice(-3).map((e) => e.dataset.pick));
    const L = (id) => pg.locator(`.slidewrap.on [data-pick="${id}"]`), box = (id) => L(id).boundingBox();
    const ctr = async (id) => { const q = await box(id); return [q.x + q.width / 2, q.y + q.height / 2]; };
    const click = async (id, shift) => { const [x, y] = await ctr(id); if (shift) await pg.keyboard.down('Shift'); await pg.mouse.click(x, y); if (shift) await pg.keyboard.up('Shift'); await pg.waitForTimeout(150); };
    const crumb = () => pg.locator('.right .crumb').innerText();
    // 1) Chọn 3 hình → Ctrl+G
    await click(ids[0]); await click(ids[1], true); await click(ids[2], true);
    await pg.keyboard.press('Control+g'); await pg.waitForTimeout(200);
    r.crumbGroup = (await crumb()).replace(/\n/g, ' ');
    need(/Group 1/.test(r.crumbGroup), 'Ctrl+G failed');
    r.treeGroupRow = await pg.locator('.left .litem.lgrp, aside .litem.lgrp').count();
    r.treeNested = await pg.locator('.litem.nested').count();
    need(r.treeGroupRow >= 1 && r.treeNested === 3, 'tree group rows missing');
    // 2) Bỏ chọn, bấm 1 con → chọn cả nhóm
    await bg(); await click(ids[2]);
    r.clickSelectsGroup = (await crumb()).includes('Group 1') && (await pg.locator('.slidewrap.on .ed-hit.msel').count()) === 3;
    need(r.clickSelectsGroup, 'click member did not select group');
    // 3) Hover con khi chưa chọn → khung nhóm nét đứt
    await bg(); const [hx, hy] = await ctr(ids[1]); await pg.mouse.move(hx, hy); await pg.waitForTimeout(120);
    r.hoverBox = await pg.locator('.slidewrap.on .ed-ghover').count();
    need(r.hoverBox === 1, 'no group hover box');
    await pg.screenshot({ path: D + 'group-hover.png' });
    // 4) Kéo nhóm từ trạng thái chưa chọn (bấm giữ con rồi kéo) → cả 3 dời đều
    const b0 = await Promise.all(ids.map(box));
    await pg.mouse.down(); await pg.mouse.move(hx + 50, hy + 30, { steps: 8 }); await pg.mouse.up(); await pg.waitForTimeout(200);
    const b1 = await Promise.all(ids.map(box));
    const dx = b1.map((q, i) => Math.round(q.x - b0[i].x)), dy = b1.map((q, i) => Math.round(q.y - b0[i].y));
    r.groupDrag = dx.join('/') + ' ' + dy.join('/');
    need(dx[0] > 20 && Math.max(...dx) - Math.min(...dx) <= 1 && Math.max(...dy) - Math.min(...dy) <= 1, 'group drag');
    await pg.screenshot({ path: D + 'group-select.png' });
    // 5) Double-click con → vào trong, chọn riêng; kéo riêng con đó, 2 con kia đứng yên
    const [cx, cy] = await ctr(ids[0]); await pg.mouse.dblclick(cx, cy); await pg.waitForTimeout(200);
    r.crumbInside = (await crumb()).replace(/\n/g, ' ');
    need(/Group 1/.test(r.crumbInside) && (await pg.locator('.slidewrap.on .ed-hit.sel').count()) === 1, 'enter group');
    const s0 = await Promise.all(ids.map(box));
    await pg.mouse.move(cx, cy); await pg.mouse.down(); await pg.mouse.move(cx - 40, cy + 10, { steps: 6 }); await pg.mouse.up(); await pg.waitForTimeout(150);
    const s1 = await Promise.all(ids.map(box));
    r.childOnly = [0, 1, 2].map((i) => Math.round(s1[i].x - s0[i].x)).join('/');
    need(Math.abs(s1[0].x - s0[0].x) > 20 && Math.abs(s1[1].x - s0[1].x) < 1 && Math.abs(s1[2].x - s0[2].x) < 1, 'child drag inside group');
    await pg.screenshot({ path: D + 'group-inside.png' });
    // 6) Esc → lại chọn cả nhóm
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(150);
    r.escToGroup = (await pg.locator('.slidewrap.on .ed-hit.msel').count()) === 3 && !(await crumb()).includes('Sparkle');
    need(r.escToGroup, 'esc back to group');
    // 7) Align nhóm theo khung (trái): khung bao chạm mép trái, khoảng cách giữa các con giữ nguyên
    const c0 = await cv.boundingBox(), g0 = await Promise.all(ids.map(box));
    await pg.click('.right button[aria-label="Align left"]'); await pg.waitForTimeout(350);
    const g1 = await Promise.all(ids.map(box));
    r.alignUnitLeft = Math.round(Math.min(...g1.map((q) => q.x)) - c0.x);
    r.layoutKept = Math.round(Math.max(...g1.map((q, i) => Math.abs((q.x - g1[0].x) - (g0[i].x - g0[0].x)))));
    need(Math.abs(r.alignUnitLeft) <= 1.5 && r.layoutKept <= 1, 'align group as unit');
    // 8) Alt+D → căn phải bằng phím
    await pg.keyboard.press('Alt+d'); await pg.waitForTimeout(350);
    const g2 = await Promise.all(ids.map(box));
    r.altRight = Math.round(c0.x + c0.width - Math.max(...g2.map((q) => q.x + q.width)));
    need(Math.abs(r.altRight) <= 1.5, 'Alt+D');
    // 9) Đổi tên nhóm trong panel
    // đổi tên ở cây Layers bên trái: double-click tên nhóm → ô nhập → Enter
    await pg.locator('.litem.lgrp .lname').first().dblclick(); await pg.locator('.litem .lrename').fill('Sparkles'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(150);
    r.renamed = (await pg.locator('.litem.lgrp .lname').first().innerText()) === 'Sparkles';
    need(r.renamed, 'rename in tree');
    // 10) Cây Layers: Shift-click thêm Device vào chọn (panel phải đã ở dạng nhóm → dùng cây bên trái)
    await bg(); await pg.waitForTimeout(100);
    const devRow = pg.locator('.litem:not(.nested):has(.lname:text-is("Device"))').first(); await devRow.scrollIntoViewIfNeeded();
    const titleRow = pg.locator('.litem:has(.lname:text-is("Headline"))').first();
    await titleRow.click(); await pg.keyboard.down('Shift'); await devRow.click(); await pg.keyboard.up('Shift'); await pg.waitForTimeout(150);
    r.treeShift = await pg.locator('.slidewrap.on .ed-hit.msel').count();
    need(r.treeShift === 2, 'tree shift-click');
    // 11) Bấm dòng nhóm trên cây → chọn cả nhóm
    await pg.locator('.litem.lgrp').first().click(); await pg.waitForTimeout(150);
    r.treeGroupClick = await pg.locator('.slidewrap.on .ed-hit.msel').count();
    need(r.treeGroupClick === 3, 'tree group click');
    // 12) Xoá 1 con (vào trong rồi Delete) → nhóm còn 2; xoá thêm 1 → nhóm tự giải tán
    const [ex, ey] = await ctr(ids[2]); await pg.mouse.dblclick(ex, ey); await pg.waitForTimeout(150); await pg.keyboard.press('Delete'); await pg.waitForTimeout(200);
    r.after1 = await pg.locator('.litem.nested').count();
    const [fx, fy] = await ctr(ids[1]); await pg.mouse.dblclick(fx, fy); await pg.waitForTimeout(150); await pg.keyboard.press('Delete'); await pg.waitForTimeout(200);
    r.after2 = await pg.locator('.litem.lgrp').count();
    need(r.after1 === 2 && r.after2 === 0, 'prune groups on delete');
    await pg.keyboard.press('Control+z'); await pg.keyboard.press('Control+z'); await pg.waitForTimeout(200);
    r.undoBack = await pg.locator('.litem.nested').count();
    need(r.undoBack === 3, 'undo restores group');
    // 13) Ungroup (Ctrl+Shift+G) → hết dòng nhóm, vẫn chọn 3; Undo → nhóm về
    await click(ids[0]); await pg.keyboard.press('Control+Shift+g'); await pg.waitForTimeout(200);
    r.ungroup = (await pg.locator('.litem.lgrp').count()) === 0 && (await pg.locator('.slidewrap.on .ed-hit.msel').count()) === 3;
    await pg.keyboard.press('Control+z'); await pg.waitForTimeout(200);
    r.ungroupUndo = await pg.locator('.litem.lgrp').count();
    need(r.ungroup && r.ungroupUndo === 1, 'ungroup/undo');
    // 14) Phím tắt có trong bảng ?
    await bg(); await pg.keyboard.press('?'); await pg.waitForTimeout(200);
    r.keysDialog = await pg.locator('.keys').innerText().then((t) => /Group selection/.test(t) && /Alt/.test(t));
    await pg.keyboard.press('Escape');
  } catch (e) { errs.push(String(e)); }
  console.log(JSON.stringify({ r, errs }, null, 1));
  await b.close();
})();
