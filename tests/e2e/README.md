# Test tự động Pixstall (playwright, chạy trên máy agentk1)

- Playwright có sẵn ở `~/projects/no-floor-city/node_modules`, trình duyệt `/usr/bin/chromium-browser`.
- Chạy 1 bài: `cd ~/projects/no-floor-city && NODE_PATH=$PWD/node_modules node ~/apps/pixstall/tests/e2e/pxe.js https://pixstall.vercel.app`
- Bài đạt khi in ra `"errs": []` và không có `TimeoutError`.
- Một số bài cần ảnh mẫu ở `~/apps/pixstall-shots/pc/` (red/green/blue.png): chạy `pxc.js` trước để tạo.
- Tải ZIP: Chromium bản snap không lưu được file tải về, nên test bắt blob bằng cách ghi đè `HTMLAnchorElement.click`.
