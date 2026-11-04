// E2E Pixstall — Chân trang không lọt ra ngoài ở các cỡ màn. Chạy: NODE_PATH=<thư mục có playwright>/node_modules node pxfoot2.js <URL> (mặc định localhost:47811)
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium-browser' });
  for (const w of [940, 1024, 1200, 1440]) {
    const pg = await b.newPage({ viewport: { width: w, height: 800 } });
    await pg.goto(process.argv[2], { waitUntil: 'networkidle' }); await pg.waitForTimeout(600);
    await pg.click('text=Explore the sample first');
    const r = await pg.evaluate(() => { const f = document.querySelector('.foot').getBoundingClientRect(); return [...document.querySelectorAll('.foot *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > f.right + 0.5 || r.left < f.left - 0.5); }).map(e => e.className || e.tagName).slice(0, 4); });
    const h = await pg.$$eval('.foot > *', a => a.filter(x => x.offsetParent).map(x => Math.round(x.getBoundingClientRect().height)));
    console.log(w, 'outside:', JSON.stringify(r), 'heights:', JSON.stringify(h));
    if (w === 1024) await pg.screenshot({ path: '/home/namcuong/apps/pixstall-shots/v1/foot-1024.png', clip: { x: 200, y: 740, width: 560, height: 60 } });
    await pg.close();
  }
  await b.close();
})();
