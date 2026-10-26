// S7 水印没填完 · S8 自定义水印 · S9 关闭水印（docs/tests/functional-tests.md S7、S8、S9）
// 需求点：§7-1、§7-4、§7-5、§10-5
import { test, expect } from '@playwright/test';
import {
  openApp, makeMockImage, makeSide, exportFile, countDownloads, parsePng, parsePdf,
  watermarkOnFile, watermarkOnPreview, todayYmd, SHEET, PREVIEW,
} from './helpers.mjs';

// 纯色素材：卡片上偏离底色的像素只可能来自水印，用来判断水印有没有、长什么样
const plainCard = (browser) => makeMockImage(browser, { w: 2400, h: 1600, plain: '#3a7bd5', type: 'image/png' });

/** 需求 §7-3：斜向平铺、灰色、约 30% 透明度、每张卡片至少 2 到 3 行。 */
function expectWatermarkStyle(w) {
  expect(w.marked).toBeGreaterThan(0.02);
  const [r, g, b] = w.ink;
  expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(15); // 灰色：三通道接近
  expect(w.alpha).toBeGreaterThan(0.2);
  expect(w.alpha).toBeLessThan(0.4);                               // 约 30%
  expect(Math.abs(w.angleDeg)).toBeGreaterThanOrEqual(15);         // 斜向
  expect(Math.abs(w.angleDeg)).toBeLessThanOrEqual(60);
  expect(w.rows).toBeGreaterThanOrEqual(2);                         // 至少 2 行
}

test('S7 水印没填完：导出被拦，页面写明原因；填好后放行', async ({ page, browser }) => {
  const img = await plainCard(browser);
  const { errors } = await openApp(page);
  const dls = countDownloads(page);

  // 6 两面都没做
  await expect(page.locator('#ex-pdf')).toBeDisabled();
  await expect(page.locator('#ex-badge')).toHaveText('不可导出：请先确认至少一面');

  // 1 模板 1、用途空着
  await makeSide(page, 'front', img);
  await expect(page.getByLabel('仅供____办理业务使用，他用无效 日期')).toBeChecked();
  await expect(page.locator('#ex-pdf')).toBeDisabled();
  await expect(page.locator('#ex-png')).toBeDisabled();
  await expect(page.locator('#ex-reason')).toHaveText('请填写用途');
  await expect(page.locator('#wm-badge')).toHaveText('已开启，待填写：请填写用途');
  await expect(page.locator('#pv-pending')).toHaveText('水印待填写，预览暂不含水印');
  // 用户绕过禁用按钮硬点（去掉 disabled 再点）：仍被拦，不生成文件
  await page.locator('#ex-pdf').evaluate((b) => { b.disabled = false; });
  await page.locator('#ex-pdf').click();
  await expect(page.locator('#ex-msg')).toHaveText('请填写用途');
  await page.waitForTimeout(300);
  expect(dls.n).toBe(0);

  // 预览上没有水印
  await page.waitForTimeout(150);
  expect((await watermarkOnPreview(page, PREVIEW.front)).marked).toBe(0);
  // 2 填用途：预览出现水印
  await page.locator('#wm-purpose').fill('开户');
  await expect(page.locator('#ex-pdf')).toBeEnabled();
  await expect(page.locator('#pv-pending')).toBeHidden();
  const now = new Date();
  await expect(page.locator('#wm-badge')).toHaveText(
    `已开启：仅供开户办理业务使用，他用无效 ${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`);
  await page.waitForTimeout(150);
  expectWatermarkStyle(await watermarkOnPreview(page, PREVIEW.front));

  // 3 用途最多 10 个字
  await page.locator('#wm-purpose').fill('');
  await page.locator('#wm-purpose').pressSequentially('一二三四五六七八九十十一');
  await expect(page.locator('#wm-purpose')).toHaveValue('一二三四五六七八九十');

  // 4 日期清空
  await page.locator('#wm-date').fill('');
  await expect(page.locator('#ex-reason')).toHaveText('请选择水印日期');
  await expect(page.locator('#ex-pdf')).toBeDisabled();

  // 5 改日期：水印日期变，文件名仍是导出当天
  await page.locator('#wm-date').fill('2026-01-05');
  await expect(page.locator('#wm-badge')).toHaveText('已开启：仅供一二三四五六七八九十办理业务使用，他用无效 2026年1月5日');
  const png = await exportFile(page, 'png');
  expect(png.name).toBe(`身份证复印件_${todayYmd()}.png`);

  expect(errors).toEqual([]);
});

test('S8 自定义水印：原样使用、不加日期；24 字整句仍斜排多行显示；最多 24 字', async ({ page, browser }) => {
  const img = await plainCard(browser);
  const { errors } = await openApp(page);
  await makeSide(page, 'front', img);

  await page.getByLabel('自定义', { exact: true }).check();
  await expect(page.locator('#wm-date-row')).toBeHidden();
  await expect(page.locator('#ex-reason')).toHaveText('请填写水印文字');

  await page.locator('#wm-custom').fill('仅限本人办理社保使用');
  await expect(page.locator('#wm-badge')).toHaveText('已开启：仅限本人办理社保使用');
  await expect(page.locator('#ex-pdf')).toBeEnabled();
  const short = await exportFile(page, 'png');
  expectWatermarkStyle(await watermarkOnFile(page, short.bytes, 'image/png', SHEET.front));

  const long24 = '仅限本人办理社会保险登记及相关业务使用他用无效复'; // 24 字
  await page.locator('#wm-custom').fill('');
  await page.locator('#wm-custom').pressSequentially(long24 + '印无效');
  await expect(page.locator('#wm-custom')).toHaveValue(long24);
  const long = await exportFile(page, 'png');
  await expect(page.locator('#wm-badge')).toHaveText(`已开启：${long24}`);
  // 24 字整句仍以斜排、多行的水印铺在卡片上；纸面空白处没有水印
  expectWatermarkStyle(await watermarkOnFile(page, long.bytes, 'image/png', SHEET.front));
  expect((await watermarkOnFile(page, long.bytes, 'image/png', SHEET.margin)).marked).toBe(0);
  expect(parsePng(long.bytes).width).toBe(2480);

  expect(errors).toEqual([]);
});

test('S9 关闭水印：提示一次，取消则保持开启；确定后预览与两种导出文件都没有水印', async ({ page, browser }) => {
  // 偏离底色的像素为 0 即「没有水印」
  const img = await plainCard(browser);
  const { errors } = await openApp(page);
  await expect(page.getByLabel('添加水印（默认开启）')).toBeChecked();
  await makeSide(page, 'front', img);
  await makeSide(page, 'back', img);
  await page.locator('#wm-purpose').fill('开户');
  await page.waitForTimeout(150);
  expect((await watermarkOnPreview(page, PREVIEW.front)).marked).toBeGreaterThan(0.02);
  // 开着水印的导出：两张卡片上都有符合 §7-3 的水印，纸面空白处没有
  const on = await exportFile(page, 'png');
  for (const r of [SHEET.front, SHEET.back]) expectWatermarkStyle(await watermarkOnFile(page, on.bytes, 'image/png', r));
  const onPdf = parsePdf((await exportFile(page, 'pdf')).bytes).jpeg;
  expectWatermarkStyle(await watermarkOnFile(page, onPdf, 'image/jpeg', SHEET.front));

  const dialogs = [];
  // 3 点取消：保持开启，预览水印还在
  page.once('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
  await page.locator('#wm-on').click();
  await expect(page.locator('#wm-on')).toBeChecked();
  await expect(page.locator('#wm-badge')).toHaveText(/^已开启：/);
  expect(dialogs).toEqual(['关闭水印后，导出的复印件上将没有任何防挪用文字。确定关闭吗？']);
  await page.waitForTimeout(150);
  expect((await watermarkOnPreview(page, PREVIEW.front)).marked).toBeGreaterThan(0.02);

  // 4 再关，点确定：预览上没有水印
  page.once('dialog', (d) => { dialogs.push(d.message()); d.accept(); });
  await page.locator('#wm-on').click();
  await expect(page.locator('#wm-on')).not.toBeChecked();
  await expect(page.locator('#wm-badge')).toHaveText('已关闭');
  expect(dialogs.length).toBe(2); // 每次关闭各一次，不重复弹
  await page.waitForTimeout(150);
  expect((await watermarkOnPreview(page, PREVIEW.front)).marked).toBe(0);
  expect((await watermarkOnPreview(page, PREVIEW.back)).marked).toBe(0);

  // 5 导出 PDF 与 PNG：两张卡片上都没有任何水印像素
  const png = await exportFile(page, 'png');
  expect(parsePng(png.bytes).height).toBe(3508);
  for (const r of [SHEET.front, SHEET.back]) expect((await watermarkOnFile(page, png.bytes, 'image/png', r)).marked).toBe(0);
  const pdf = await exportFile(page, 'pdf');
  const jpeg = parsePdf(pdf.bytes).jpeg;
  for (const r of [SHEET.front, SHEET.back]) expect((await watermarkOnFile(page, jpeg, 'image/jpeg', r)).marked).toBe(0);

  // 6 重新勾选：不弹框，水印恢复
  await page.locator('#wm-on').click();
  await expect(page.locator('#wm-on')).toBeChecked();
  expect(dialogs.length).toBe(2);
  await page.waitForTimeout(150);
  expect((await watermarkOnPreview(page, PREVIEW.front)).marked).toBeGreaterThan(0.02);
  expect(errors).toEqual([]);
});
