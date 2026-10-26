// S1 租房备案：双面复印件，导出 PDF（docs/tests/functional-tests.md S1）
// 需求点：§3-1 至 §3-6、§4-1、§4-2、§6-1、§6-3、§6-4、§6-6、§6-9、§7-1 至 §7-5、§10-3
import { test, expect } from '@playwright/test';
import {
  openApp, makeMockImage, pickImage, makeSide, readCropView, toScreen, drag, exportFile,
  parsePdf, parseJpeg, analyzeImage, analyzePreview, measureCardBorder, diffRegion, watermarkOnFile,
  SHEET, PREVIEW, todayYmd,
} from './helpers.mjs';

test('S1 租房备案：双面、默认水印、导出 PDF，尺寸与版面正确', async ({ page, browser }) => {
  // 3600×2000：比身份证更「宽」，最大框高度顶满、左右留空
  const img = await makeMockImage(browser, { w: 3600, h: 2000 });
  const { errors } = await openApp(page);

  // 1 打开页面
  await expect(page.getByText('所有处理都在本机完成，图片不会上传。')).toBeVisible();
  const titles = await page.locator('section h2').allTextContents();
  expect(titles).toEqual(['正面（人像面）', '反面（国徽面）', '水印', '版面预览', '导出与清除']);
  await expect(page.locator('#back-badge')).toHaveText('未选图');
  await expect(page.locator('#pv-empty')).toHaveText('尚未确认任何一面');
  await expect(page.locator('#ex-pdf')).toBeDisabled();
  await expect(page.locator('#ex-reason')).toHaveText('请先确认至少一面');

  // 2 选正面：进入裁剪，固定提示可见，框是最大框并居中、比例像身份证
  await pickImage(page, 'front', img);
  await expect(page.locator('#front-crop').getByText('歪的照片建议重拍或换一张正的图。')).toBeVisible();
  let v = await readCropView(page, 'front');
  const W = (v) => v.box.x1 - v.box.x0, H = (v) => v.box.y1 - v.box.y0;
  const fw = W(v);
  expect(fw / H(v)).toBeCloseTo(85.6 / 54, 1);
  // 最大框高度顶满，左右留空相等
  expect(v.box.y0).toBeLessThanOrEqual(3);
  expect(v.box.y1).toBeGreaterThanOrEqual(v.canvasH - 4);
  expect(Math.abs(v.box.x0 - (v.canvasW - 1 - v.box.x1))).toBeLessThanOrEqual(4);

  // 3 拖框内部往右拖到图外：框整体移动，停在图片右边缘
  const c = toScreen(v, (v.box.x0 + v.box.x1) / 2, (v.box.y0 + v.box.y1) / 2);
  await drag(page, c, { x: c.x + 2000, y: c.y + 500 });
  v = await readCropView(page, 'front');
  expect(v.box.x1).toBeGreaterThanOrEqual(v.canvasW - 4);
  expect(v.box.y1).toBeGreaterThanOrEqual(v.canvasH - 4); // 向下也停在边缘
  const w2 = W(v);
  expect(Math.abs(w2 - fw)).toBeLessThanOrEqual(3); // 移动不改大小

  // 4 拖左上角点向内：框按比例缩小，形状不变
  const tl = toScreen(v, v.box.x0, v.box.y0);
  await drag(page, tl, { x: tl.x + 120, y: tl.y + 76 }); // 沿对角线向内拖
  v = await readCropView(page, 'front');
  const sw = W(v);
  expect(sw).toBeLessThan(w2 - 50);
  expect(sw / H(v)).toBeCloseTo(85.6 / 54, 1);
  // 右下角是锚点，不动
  expect(v.box.x1).toBeGreaterThanOrEqual(v.canvasW - 4);
  // 再向外拖回去：放大
  const tl2 = toScreen(v, v.box.x0, v.box.y0);
  await drag(page, tl2, { x: tl2.x - 300, y: tl2.y - 300 });
  v = await readCropView(page, 'front');
  expect(W(v)).toBeGreaterThan(sw + 50);
  expect(W(v) / H(v)).toBeCloseTo(85.6 / 54, 1);

  // 5 确认：裁剪区收起，预览上半页出现正面
  await page.locator('#front-confirm').click();
  await expect(page.locator('#front-badge')).toHaveText('已确认');
  await expect(page.locator('#front-crop')).toBeHidden();
  await expect(page.locator('#preview')).toBeVisible();

  // 6 反面
  await pickImage(page, 'back', img);
  await page.locator('#back-confirm').click();
  await expect(page.locator('#back-badge')).toHaveText('已确认');
  await expect(page.locator('#pv-badge')).toHaveText('已生成（正反两面）');

  // 7 水印：默认开，选租房模板，日期默认今天
  await expect(page.locator('#wm-on')).toBeChecked();
  await page.getByLabel('仅用于租房备案，复印无效 日期').check();
  const now = new Date();
  const cnDate = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
  await expect(page.locator('#wm-badge')).toHaveText(`已开启：仅用于租房备案，复印无效 ${cnDate}`);
  await page.waitForTimeout(100);
  const pv = await analyzePreview(page, [
    { name: 'front', ...PREVIEW.front }, { name: 'back', ...PREVIEW.back }, { name: 'margin', ...PREVIEW.margin },
  ]);
  expect(pv.front.nonWhite).toBeGreaterThan(0.9);
  expect(pv.back.nonWhite).toBeGreaterThan(0.9);
  expect(pv.margin.nonWhite).toBe(0);

  // 8 导出 PDF：文件名、导出区提示
  const pdf = await exportFile(page, 'pdf');
  expect(pdf.name).toBe(`身份证复印件_${todayYmd()}.pdf`);

  // 9 打开 PDF：一页 A4（210×297mm = 595.28×841.89pt）
  const p = parsePdf(pdf.bytes);
  expect(p.pages).toBe(1);
  expect(p.mediaBox).toEqual([0, 0, 595.28, 841.89]);
  const j = parseJpeg(p.jpeg);
  expect([j.width, j.height]).toEqual([2480, 3508]);

  // 版面：上正下反，水平居中，间距约 30mm；纸面空白处没有任何东西
  const a = await analyzeImage(page, p.jpeg, 'image/jpeg', [
    { name: 'front', ...SHEET.front }, { name: 'back', ...SHEET.back },
    { name: 'margin', ...SHEET.margin }, { name: 'gap', ...SHEET.gapBetween },
  ]);
  expect(a.front.colorful).toBeGreaterThan(0.5);
  expect(a.back.colorful).toBeGreaterThan(0.5);
  expect(a.margin.nonWhite).toBe(0);
  expect(a.gap.nonWhite).toBe(0);

  // 10 打印尺寸：按 A4 纸 210×297mm 换算边框外缘，卡片 85.6×54mm ±0.5mm；水平居中；两卡间距约 30mm
  const mmX = (px) => px / 2480 * 210, mmY = (px) => px / 3508 * 297;
  const f = await measureCardBorder(page, p.jpeg, 'image/jpeg', { midX: 1240, midY: 1258, x0: 600, x1: 1880, y0: 800, y1: 1700 });
  const b = await measureCardBorder(page, p.jpeg, 'image/jpeg', { midX: 1240, midY: 2250, x0: 600, x1: 1880, y0: 1700, y1: 2700 });
  for (const r of [f, b]) {
    expect(Math.abs(mmX(r.right - r.left + 1) - 85.6)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(mmY(r.bottom - r.top + 1) - 54)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(mmX(r.left) - mmX(2480 - 1 - r.right))).toBeLessThanOrEqual(0.5); // 左右留白相等
  }
  const gapMm = mmY(b.top - f.bottom - 1);
  expect(gapMm).toBeGreaterThan(28);
  expect(gapMm).toBeLessThan(32);
  // 边框为细线：约 0.3mm（4 像素 ≈ 0.34mm）
  const edge = await measureCardBorder(page, p.jpeg, 'image/jpeg', { midX: 1240, midY: 1258, x0: f.left, x1: f.left + 20, y0: 0, y1: 0 });
  expect(mmX(edge.right - edge.left + 1)).toBeLessThanOrEqual(0.5);

  // 水印只在卡片上：关闭水印再导出一次同样的版面，比较两份文件（卡片区不同，纸面空白与两卡之间逐像素相同）
  page.once('dialog', (d) => d.accept());
  await page.locator('#wm-on').uncheck();
  const plain = await exportFile(page, 'pdf');
  const q = parsePdf(plain.bytes).jpeg;
  expect(await diffRegion(page, p.jpeg, q, 'image/jpeg', SHEET.front)).toBeGreaterThan(0.05);
  expect(await diffRegion(page, p.jpeg, q, 'image/jpeg', SHEET.back)).toBeGreaterThan(0.05);
  expect(await diffRegion(page, p.jpeg, q, 'image/jpeg', SHEET.margin)).toBe(0);
  expect(await diffRegion(page, p.jpeg, q, 'image/jpeg', SHEET.gapBetween)).toBe(0);

  // 水印样式（需求 §7-3）：换纯色卡片，让水印能从底图里分离出来，再看颜色、透明度、斜度、行数
  await page.locator('#clear-all').click();
  const flat = await makeMockImage(browser, { w: 2400, h: 1600, plain: '#3a7bd5', type: 'image/png' });
  await makeSide(page, 'front', flat);
  await makeSide(page, 'back', flat);
  await page.getByLabel('仅用于租房备案，复印无效 日期').check();
  // 颜色与透明度在无损的 PNG 上量；PDF 里的 JPEG 压缩会把三个通道拉开十几到二十，只看斜向与行数
  const wmPng = (await exportFile(page, 'png')).bytes;
  const wmPdf = parsePdf((await exportFile(page, 'pdf')).bytes).jpeg;
  for (const r of [SHEET.front, SHEET.back]) {
    const w = await watermarkOnFile(page, wmPng, 'image/png', r);
    expect(w.marked).toBeGreaterThan(0.02);
    expect(Math.max(...w.ink) - Math.min(...w.ink)).toBeLessThan(15);  // 灰色
    expect(w.alpha).toBeGreaterThan(0.2);                              // 约 30%
    expect(w.alpha).toBeLessThan(0.4);
    expect(Math.abs(w.angleDeg)).toBeGreaterThanOrEqual(15);           // 斜向
    expect(Math.abs(w.angleDeg)).toBeLessThanOrEqual(60);
    expect(w.rows).toBeGreaterThanOrEqual(2);                           // 每卡至少 2 到 3 行
    const v = await watermarkOnFile(page, wmPdf, 'image/jpeg', r);
    expect(v.marked).toBeGreaterThan(0.02);
    expect(Math.abs(v.angleDeg)).toBeGreaterThanOrEqual(15);
    expect(v.rows).toBeGreaterThanOrEqual(2);
  }

  expect(errors).toEqual([]);
});
