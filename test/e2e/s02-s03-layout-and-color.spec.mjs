// S2 只交正面（单面）· S3 复印机效果（灰度）（docs/tests/functional-tests.md S2、S3）
// 需求点：§3-2、§6-2、§10-6；§3-4、§6-7、§6-8
import { test, expect } from '@playwright/test';
import {
  openApp, makeMockImage, makeSide, exportFile, parsePdf, parsePng,
  analyzeImage, analyzePreview, SHEET, PREVIEW,
} from './helpers.mjs';

const regions = [
  { name: 'front', ...SHEET.front }, { name: 'back', ...SHEET.back },
  // 整张卡片位置向外扩 30 像素：没选的一面连边框、占位框都不应有
  { name: 'frontOuter', ...SHEET.frontOuter }, { name: 'backOuter', ...SHEET.backOuter },
];
const fillPurpose = (page) => page.locator('#wm-purpose').fill('开户');

test('S2 只交正面或只交反面：位置不变，另一半全白', async ({ page, browser }) => {
  const img = await makeMockImage(browser, { w: 2400, h: 1600 });
  const { errors } = await openApp(page);

  await makeSide(page, 'front', img);
  await expect(page.locator('#back-sub')).toHaveText('可只做一面');
  await expect(page.locator('#back-badge')).toHaveText('未选图');
  await expect(page.locator('#pv-badge')).toHaveText('已生成（只含正面）');
  await fillPurpose(page);
  await expect(page.locator('#ex-png')).toBeEnabled();

  const png = await exportFile(page, 'png');
  let a = await analyzeImage(page, png.bytes, 'image/png', regions);
  expect(a.front.colorful).toBeGreaterThan(0.5);
  expect(a.backOuter.nonWhite).toBe(0); // 下半页没有边框、没有占位

  await page.locator('#clear-all').click();
  await makeSide(page, 'back', img);
  await expect(page.locator('#pv-badge')).toHaveText('已生成（只含反面）');
  await fillPurpose(page);
  const pdf = await exportFile(page, 'pdf');
  a = await analyzeImage(page, parsePdf(pdf.bytes).jpeg, 'image/jpeg', regions);
  expect(a.back.colorful).toBeGreaterThan(0.5);
  expect(a.frontOuter.nonWhite).toBe(0);

  expect(errors).toEqual([]);
});

test('S3 复印机效果：选灰度后预览与导出都是黑白，切回彩色恢复', async ({ page, browser }) => {
  const img = await makeMockImage(browser, { w: 2400, h: 1600 });
  const { errors } = await openApp(page);

  // 1 导出颜色在预览区块内、画布下方，默认彩色；导出区里没有颜色选项
  const pv = page.locator('#sec-preview');
  await expect(pv.getByRole('group', { name: '导出颜色' })).toBeVisible();
  const labels = await pv.locator('fieldset label').allTextContents();
  expect(labels).toEqual(['灰度', '彩色']);
  await expect(pv.getByLabel('彩色')).toBeChecked();
  expect(await page.locator('#sec-export input[type=radio]').count()).toBe(0);

  await makeSide(page, 'front', img);
  await makeSide(page, 'back', img);
  await fillPurpose(page);
  const cv = await page.locator('#preview').boundingBox();
  const fs = await pv.locator('fieldset').boundingBox();
  expect(fs.y).toBeGreaterThanOrEqual(cv.y + cv.height - 1);

  // 2 选灰度：预览立即变黑白（含水印）
  await pv.getByLabel('灰度').check();
  await expect(pv.getByLabel('彩色')).not.toBeChecked();
  await page.waitForTimeout(100);
  let p = await analyzePreview(page, [{ name: 'f', ...PREVIEW.front }, { name: 'b', ...PREVIEW.back }]);
  expect(p.f.gray).toBe(true);
  expect(p.b.gray).toBe(true);

  // 3 导出 PNG 与 PDF 都是黑白
  const png = await exportFile(page, 'png');
  let a = await analyzeImage(page, png.bytes, 'image/png', regions);
  expect(a.front.gray && a.back.gray).toBe(true);
  expect(a.front.nonWhite).toBeGreaterThan(0.9);
  const pdf = await exportFile(page, 'pdf');
  a = await analyzeImage(page, parsePdf(pdf.bytes).jpeg, 'image/jpeg', regions);
  expect(a.front.gray && a.back.gray).toBe(true);

  // 4 改回彩色：预览与新导出的文件恢复彩色
  await pv.getByLabel('彩色').check();
  await page.waitForTimeout(100);
  p = await analyzePreview(page, [{ name: 'f', ...PREVIEW.front }]);
  expect(p.f.colorful).toBeGreaterThan(0.5);
  const png2 = await exportFile(page, 'png');
  expect(parsePng(png2.bytes).width).toBe(2480);
  a = await analyzeImage(page, png2.bytes, 'image/png', regions);
  expect(a.front.colorful).toBeGreaterThan(0.5);

  // 5 来回切换：任何时候只有一个选中，预览跟着变
  for (const l of ['灰度', '彩色', '灰度', '彩色']) {
    await pv.getByLabel(l).check();
    expect(await pv.locator('input[name=ex-color]:checked').count()).toBe(1);
    await page.waitForTimeout(100);
    const q = await analyzePreview(page, [{ name: 'f', ...PREVIEW.front }]);
    if (l === '灰度') expect(q.f.gray).toBe(true);
    else expect(q.f.colorful).toBeGreaterThan(0.5);
  }

  expect(errors).toEqual([]);
});
