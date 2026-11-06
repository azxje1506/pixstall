// Test 3 sửa lỗi 06/11: (1) phím ] / [ = lên trên cùng / xuống dưới cùng, Ctrl ] [ = 1 lớp (không dùng Ctrl+Shift vì đổi tab);
// (2) Shift-click hàng ở cây Layers trái không bôi đen chữ; (3) nhãn góc khi xoay đứng yên gần núm xoay, không chạy vòng theo chuột
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
    await bg(); const t = pg.locator('.right .dtile[aria-label="Add Heart"]'); await t.scrollIntoViewIfNeeded(); await t.click(); await pg.waitForTimeout(150);
    const tree = () => pg.$$eval('.lchildren .litem[data-lid]', (a) => a.map((x) => x.querySelector('.lname').innerText));
    const row = (n) => pg.locator(`.lchildren .litem[data-lid]:has(.lname:text-is("${n}"))`).first();
    // (1) ] → trên cùng, [ → dưới cùng, Ctrl+] → lên 1
    await row('Heart').click(); await pg.waitForTimeout(100);
    await pg.keyboard.press(']'); await pg.waitForTimeout(150); r.afterFront = await tree();
    await pg.keyboard.press('['); await pg.waitForTimeout(150); r.afterBack = await tree();
    await pg.keyboard.press('Control+BracketRight'); await pg.waitForTimeout(150); r.afterFwd = await tree();
    const n = r.afterFront.length;
    need(r.afterFront[0] === 'Heart' && r.afterBack[n - 1] === 'Heart' && r.afterFwd[n - 2] === 'Heart', 'bracket keys');
    r.menuKbd = await (async () => { await row('Heart').click({ button: 'right' }); await pg.waitForTimeout(120); const x = await pg.locator('.cmenu').innerText(); await pg.keyboard.press('Escape'); return /Bring to front\s*\]/.test(x) && /Send to back\s*\[/.test(x) && !/Shift/.test(x); })();
    need(r.menuKbd, 'menu kbd labels');
    // (2) Shift-click: không có chữ bị bôi đen
    await bg(); await row('Headline').click(); await pg.keyboard.down('Shift'); await row('Device').click(); await row('Heart').click(); await pg.keyboard.up('Shift'); await pg.waitForTimeout(120);
    r.selText = await pg.evaluate(() => String(getSelection()));
    r.picked = await pg.locator('.slidewrap.on .ed-hit.msel').count();
    need(r.selText === '' && r.picked === 3, 'shift-click selects text');
    // (3) Xoay hình trang trí vòng rộng quanh tâm: nhãn đứng yên, gần núm
    await bg(); await row('Heart').click(); await pg.waitForTimeout(120);
    const knob = pg.locator('.slidewrap.on .ed-hit.sel .ed-rot'); const kb = await knob.boundingBox();
    const el = await pg.locator('.slidewrap.on .ed-hit.sel').boundingBox(), cx = el.x + el.width / 2, cy = el.y + el.height / 2;
    await pg.mouse.move(kb.x + kb.width / 2, kb.y + kb.height / 2); await pg.mouse.down();
    const pos = [];
    for (const deg of [30, 90, 150, 210]) {
      const a = (deg - 90) * Math.PI / 180, R = 160;
      await pg.mouse.move(cx + R * Math.cos(a), cy + R * Math.sin(a), { steps: 5 }); await pg.waitForTimeout(60);
      const tb = await pg.locator('.slidewrap.on .ed-tip').boundingBox(); pos.push([Math.round(tb.x + tb.width / 2), Math.round(tb.y + tb.height)]);
    }
    r.tipText = await pg.locator('.slidewrap.on .ed-tip').innerText();
    await pg.screenshot({ path: D + 'rotate-tip.png' });
    await pg.mouse.up();
    r.tipPos = pos;
    const spread = Math.max(...pos.map((p) => Math.hypot(p[0] - pos[0][0], p[1] - pos[0][1])));
    r.tipNearKnob = Math.round(Math.hypot(pos[0][0] - kb.x - kb.width / 2, pos[0][1] - kb.y));
    need(spread < 2 && r.tipNearKnob < 80 && /°$/.test(r.tipText), 'rotate tip moves');
  } catch (e) { errs.push(String(e)); }
  console.log(JSON.stringify({ r, errs }, null, 1));
  await b.close();
})();
