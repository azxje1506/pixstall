# Components dùng chung — Pixstall

Thêm UI mới thì **dùng lại các component dưới đây**, đừng tự viết lại (tự định vị menu bằng toạ độ tay, tự bắt click-outside…).

## Khung nổi — `Popover.tsx`
| Component | Dùng khi | Ví dụ |
|---|---|---|
| `MenuButton` | Nút mở **danh sách lệnh** | `<MenuButton className="gbtn" placement="bottom-end" items={() => addItems(i)}><Plus/>Add text</MenuButton>` |
| `PopoverButton` | Nút mở **nội dung tuỳ ý** (bảng chọn, form nhỏ) | `<PopoverButton className="chip" placement="bottom-center" popClass="tmenu" content={(close) => <Body onDone={close}/>}>…</PopoverButton>` |
| `ContextMenu` | Menu **chuột phải** tại con trỏ | `<ContextMenu x={e.clientX} y={e.clientY} items={…} onClose={…}/>` |
| `Popover` | Khung nổi neo vào một `Anchor` bất kỳ (khi 2 cái trên không vừa) | `<Popover anchor={rectOf(el)} placement="top-start" onClose={…}>…</Popover>` |
| `Menu` | Danh sách lệnh để đặt trong Popover | `<Menu items={items} onDone={close}/>` |

- `placement`: `bottom-start | bottom-end | bottom-center | top-start | top-end | top-center`.
  **Chọn theo vị trí nút**: nút sát mép phải panel → `*-end`; nút ở chân trang → `top-*`.
  Hết chỗ thì tự lật dọc và tự đổi start ⇄ end, luôn cách mép màn hình 8px.
- `MenuItem` = `{ label, icon?, kbd?, onClick, danger?, disabled?, on? }` hoặc `"sep"` (vạch ngăn).
- Tự lo: bấm ra ngoài / Esc / cuộn / đổi cỡ cửa sổ → đóng; bấm lại nút → đóng; nút có class `open` + `aria-expanded`; ↑↓ Enter trong menu.
- Vẽ qua portal vào `.app` (position fixed) → không bị panel cắt, vẫn ăn style `.app …`.
- Style: `.pop` (chung) + class riêng: `.cmenu` (menu), `.tmenu` (Target), `.issues` (bảng lỗi), `.cf-pop` (bảng màu).

## Thuộc tính — `ui.tsx`
`Group` (nhóm thu gọn được, `id` để nhớ trạng thái) · `Prop` (hàng nhãn + điều khiển; `stack` = nhãn ở trên cho ô chọn nhiều lựa chọn; `scrub` = kéo nhãn đổi số; `mark/onReset` = chấm đè style) · `Slider` · `Num` · `Seg` · `Tabs` · `Modal`

## Khác
`ColorField` (ô chọn màu) · `Device` (khung máy 3D) · `SlideCanvas / FeatureCanvas` (vẽ slide, xuất ảnh dùng chung) · `TranslateDialog` · `Dialogs` (Size, Export, Keys, ReplaceDialog)

Kiểm tra sau khi sửa UI: `tests/e2e/pxpop.js` (vị trí mọi popover) + các bài khác trong `tests/e2e/`.
