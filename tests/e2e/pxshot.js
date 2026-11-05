// Chụp ảnh so sánh giao diện (sáng + tối, tab Slide + Project style + hộp Export) — dùng khi đổi style; tham số 2 = tiền tố tên file
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium-browser' });
  const errs = []; const tag = process.argv[3] || 'shot'; const D = '/home/namcuong/apps/pixstall-shots/v1/';
  const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
  pg.on('pageerror', (e) => errs.push(String(e)));
  await pg.goto(process.argv[2], { waitUntil: 'networkidle' }); await pg.waitForTimeout(800);
  await pg.click('text=Explore the sample first'); await pg.waitForTimeout(600);
  await pg.screenshot({ path: `${D}${tag}-main.png` });
  await pg.click('.tabs button:has-text("Project style")'); await pg.waitForTimeout(400);
  await pg.screenshot({ path: `${D}${tag}-style.png` });
  await pg.click('.top .primary'); await pg.waitForTimeout(600);
  await pg.screenshot({ path: `${D}${tag}-export.png` });
  await pg.click('.box .hd button').catch(() => pg.keyboard.press('Escape')); await pg.waitForTimeout(300);
  await pg.evaluate(() => document.documentElement.classList.add('dark')); await pg.waitForTimeout(300);
  await pg.screenshot({ path: `${D}${tag}-dark.png` });
  console.log(JSON.stringify({ errs }));
  await b.close();
})();
