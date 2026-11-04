// Tìm mọi nút segmented (.seg button) / tabs bị cắt chữ trong panel phải ở các trạng thái chính
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium-browser' });
  for (const w of [940, 1440]) {
    const pg = await b.newPage({ viewport: { width: w, height: 800 } });
    await pg.goto(process.argv[2], { waitUntil: 'networkidle' }); await pg.waitForTimeout(600);
    await pg.click('text=Explore the sample first');
    const out = new Set();
    const scan = async (tag) => (await pg.evaluate(() => [...document.querySelectorAll('.right .seg button, .right .tabs button, .right .layouts button, .right .presets button')]
      .filter(e => e.offsetParent && (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1))
      .map(e => (e.innerText || e.title) + '(' + e.clientWidth + '/' + e.scrollWidth + ')'))).forEach(x => out.add(tag + ':' + x));
    await pg.click('text=Single');
    await pg.locator('.slidewrap.on [data-cv]').click({ position: { x: 6, y: 6 } }); await scan('slide');
    await pg.locator('.slidewrap.on [data-pick=title]').click(); await scan('text');
    await pg.locator('.slidewrap.on [data-pick=device]').click(); await scan('device');
    await pg.click('.tabs button:has-text("Project style")'); await scan('style');
    await pg.click('.prop:has(.plab:text("Color")) button[title="Black"]').catch(()=>{}); 
    await pg.click('.tabs button:has-text("Slide")');
    await pg.click('.chip.target'); await pg.click('.tcol:nth-child(2) button:has-text("Phone")'); await pg.click('.item:has-text("Feature graphic")'); await scan('feature');
    await pg.click('.lchildren .litem:has-text("Phone 1")'); await scan('phone');
    if (true) { await pg.click('.tabs button:has-text("Project style")'); await pg.waitForTimeout(500); await pg.screenshot({ path: `/home/namcuong/apps/pixstall-shots/v1/seg-${w}.png`, clip: { x: w - 330, y: 40, width: 330, height: 760 } }); }
    console.log(w, JSON.stringify([...out]));
    await pg.close();
  }
  await b.close();
})();
