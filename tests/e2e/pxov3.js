// E2E Pixstall — Đo tràn ngang các panel ở 940/1024/1280/1440px. Chạy: NODE_PATH=<thư mục có playwright>/node_modules node pxov3.js <URL> (mặc định localhost:47811)
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium-browser' });
  for (const w of [940, 1024, 1280, 1440]) {
    const pg = await b.newPage({ viewport: { width: w, height: 800 } });
    await pg.goto(process.argv[2], { waitUntil: 'networkidle' }); await pg.waitForTimeout(600);
    await pg.click('text=Explore the sample first');
    const chk = () => pg.evaluate(() => ['.list', '.right', '.top'].map((s) => { const e = document.querySelector(s); return e.scrollWidth - e.clientWidth; }));
    const res = { slide: await chk() };
    await pg.click('text=Single'); await pg.locator('.slidewrap.on [data-pick=title]').click(); res.text = await chk();
    await pg.locator('.slidewrap.on [data-pick=device]').click(); res.device = await chk();
    await pg.click('.tabs button:has-text("Project style")'); res.style = await chk();
    await pg.click('.tabs button:has-text("Slide")');
    await pg.click('.chip.target'); await pg.click('.tcol:nth-child(2) button:has-text("Phone")'); await pg.click('.item:has-text("Feature graphic")'); res.feature = await chk();
    await pg.click('.lchildren .litem:has-text("Phone 1")'); res.phone = await chk();
    res.lsub = await pg.$$eval('.lchildren .litem .lsub', a => a.map(x => x.innerText).slice(0, 3));
    if (w === 1024) await pg.screenshot({ path: '/home/namcuong/apps/pixstall-shots/v1/fix-1024.png' });
    console.log(w, JSON.stringify(res));
    await pg.close();
  }
  await b.close();
})();
