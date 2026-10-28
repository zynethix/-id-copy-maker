// S4 照片横着拍 · S5 照片太小 · S6 选错文件（docs/tests/functional-tests.md S4、S5、S6）
// 需求点：§4-3、§4-5、§4-7、§5-2；§4-6、§5-4；§5-3
import { test, expect } from '@playwright/test';
import {
  openApp, makeMockImage, withExif, pickImage, pickFile, makeSide, readCropView, toScreen, drag,
  exportFile, parsePdf, analyzeImage, firstBlueY, SHEET,
} from './helpers.mjs';

test('S4 横拍照片：旋转 90° 转正后导出方向正确；歪照片不强制重拍、不纠斜', async ({ page, browser }) => {
  // 卡片在照片里竖放（顺时针转了 90°，卡片左侧的红块因此在照片上方）；品红标记在原图左上角。
  // 卡片竖着躺在照片里，要再顺时针转 270°（点三次）才是正的：红块回到卡片左侧。
  const img = await makeMockImage(browser, { w: 1800, h: 2600, rotated: true });
  const { errors } = await openApp(page);

  await pickImage(page, 'front', img);
  await expect(page.locator('#front-crop').getByText('歪的照片建议重拍或换一张正的图。')).toBeVisible();
  let v = await readCropView(page, 'front');
  expect(v.canvasH).toBeGreaterThan(v.canvasW); // 竖图
  expect(v.magentaQuadrant).toBe('tl');

  // 每点一次顺时针 90°，标记依次到 右上 → 右下 → 左下 → 回到左上；框回到最大并居中
  const seq = ['tr', 'br', 'bl', 'tl'];
  for (const q of seq) {
    await page.getByRole('button', { name: '旋转 90°' }).first().click();
    await page.waitForTimeout(50);
    v = await readCropView(page, 'front');
    expect(v.magentaQuadrant).toBe(q);
    expect(Math.abs(v.box.x0 - (v.canvasW - 1 - v.box.x1))).toBeLessThanOrEqual(4);
    expect(Math.abs(v.box.y0 - (v.canvasH - 1 - v.box.y1))).toBeLessThanOrEqual(4);
  }
  // 页面上没有任意角度的调节控件
  expect(await page.locator('#sec-front input[type=range], #sec-front input[type=number]').count()).toBe(0);

  // 点三次转正，确认、导出：卡片是横的，且红块在卡片左半（方向正确，没有上下颠倒）
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: '旋转 90°' }).first().click();
  v = await readCropView(page, 'front');
  expect(v.canvasW).toBeGreaterThan(v.canvasH);
  await page.locator('#front-confirm').click();
  await page.locator('#wm-purpose').fill('社保');
  const pdf = await exportFile(page, 'pdf');
  const a = await analyzeImage(page, parsePdf(pdf.bytes).jpeg, 'image/jpeg', [
    { name: 'L', ...SHEET.frontLeft }, { name: 'R', ...SHEET.frontRight },
  ]);
  expect(a.L.red).toBeGreaterThan(0.05);
  expect(a.R.red).toBeLessThan(0.01);

  // 歪约 5° 的照片：不拦截，照样确认与导出；导出里的卡片仍是歪的（按框原样裁，不纠斜、不做透视矫正）
  await page.locator('#clear-all').click();
  const skew = await makeMockImage(browser, { w: 2400, h: 1600, rotated: true, rotate: 5 * Math.PI / 180 });
  await makeSide(page, 'front', skew);
  await page.locator('#wm-purpose').fill('社保');
  await expect(page.locator('#ex-pdf')).toBeEnabled();
  const sk = parsePdf((await exportFile(page, 'pdf')).bytes).jpeg;
  const yL = await firstBlueY(page, sk, 'image/jpeg', 1060, 940, 1576);
  const yR = await firstBlueY(page, sk, 'image/jpeg', 1420, 940, 1576);
  expect(yL).toBeGreaterThan(0);
  expect(yR).toBeGreaterThan(0);
  // 相距 360 像素的两列，5° 的斜边高差约 31 像素；被自动纠斜则接近 0
  expect(Math.abs(yL - yR)).toBeGreaterThan(15);

  expect(errors).toEqual([]);
});

test('S4 手机竖拍原图：带 EXIF 方向标记时，裁剪区方向与相册一致', async ({ page, browser }) => {
  // 像素按横向存储，EXIF Orientation=6（显示时应顺时针转 90°）→ 浏览器纠正后应是竖图，品红标记到右上
  const raw = await makeMockImage(browser, { w: 2400, h: 1600 });
  const img = withExif(raw, { orientation: 6 });
  const { errors } = await openApp(page);
  await pickImage(page, 'front', img);
  const v = await readCropView(page, 'front');
  expect(v.canvasH).toBeGreaterThan(v.canvasW);
  expect(v.magentaQuadrant).toBe('tr');
  expect(errors).toEqual([]);
});

test('S5 照片太小：警告画质不足但仍能导出；换大图后警告消失', async ({ page, browser }) => {
  const small = await makeMockImage(browser, { w: 800, h: 500 });
  const big = await makeMockImage(browser, { w: 3600, h: 2000 });
  const { errors } = await openApp(page);

  await makeSide(page, 'front', small);
  await expect(page.locator('#front-badge')).toHaveText('已确认，画质不足');
  await expect(page.locator('#front-warn')).toHaveText(
    '画质不足：所选区域只有 500 像素高，低于输出所需的 638 像素，已放大，打印可能发糊。仍可继续导出。');
  await page.locator('#wm-purpose').fill('开户');
  const pdf = await exportFile(page, 'pdf');
  const a = await analyzeImage(page, parsePdf(pdf.bytes).jpeg, 'image/jpeg', [{ name: 'f', ...SHEET.front }]);
  expect(a.f.nonWhite).toBeGreaterThan(0.9); // 卡片照常铺满卡片区

  // 大图但把框缩到很小：也警告
  await pickImage(page, 'front', big);
  let v = await readCropView(page, 'front');
  const tl = toScreen(v, v.box.x0, v.box.y0);
  await drag(page, tl, { x: tl.x + 360, y: tl.y + 227 });
  await page.locator('#front-confirm').click();
  await expect(page.locator('#front-badge')).toHaveText('已确认，画质不足');
  await expect(page.locator('#front-warn')).toBeVisible();

  // 大图最大框：警告消失
  await pickImage(page, 'front', big);
  await page.locator('#front-confirm').click();
  await expect(page.locator('#front-badge')).toHaveText('已确认');
  await expect(page.locator('#front-warn')).toBeHidden();
  expect(errors).toEqual([]);
});

test('S6 选错文件：非图片与 HEIC 给出明确提示，原来的卡片保留，能重选', async ({ page, browser }) => {
  const img = await makeMockImage(browser, { w: 2400, h: 1600 });
  const { errors } = await openApp(page);
  await makeSide(page, 'front', img);
  await page.waitForTimeout(100);
  const preview = () => page.locator('#preview').evaluate((c) => c.toDataURL());
  const pv0 = await preview();

  await pickFile(page, 'front', { name: 'note.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') });
  await expect(page.locator('#front-msg')).toHaveText('无法读取这张图片。请换一张 JPG 或 PNG 图。');
  await expect(page.locator('#front-msg')).toHaveClass(/error/);
  await expect(page.locator('#front-badge')).toHaveText('已确认');
  await expect(page.locator('#pv-badge')).toHaveText('已生成（只含正面）');
  expect(await preview()).toBe(pv0); // 预览画面不变

  // HEIC：桌面 Chrome 读不了（这里用 HEIC 文件头的假数据）
  const heic = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypheic'), Buffer.alloc(64)]);
  await pickFile(page, 'front', { name: 'IMG_0001.HEIC', mimeType: 'image/heic', buffer: heic });
  await expect(page.locator('#front-msg')).toHaveText(
    '这张图是 HEIC 格式，当前浏览器无法读取。请在手机相册里用兼容格式（JPG）导出，或换一张 JPG、PNG 图。');
  await expect(page.locator('#front-badge')).toHaveText('已确认');
  expect(await preview()).toBe(pv0);

  await pickImage(page, 'front', img);
  await expect(page.locator('#front-msg')).toBeHidden();
  // 读不了的文件由页面自己提示用户，不应抛出未处理的异常。
  // 放过两类消息：加载失败的资源报错（坏文件本身读不了）；trace 录制在页面里读取 blob 地址、被产品 CSP
  // 的 connect-src 'none' 拦下的消息（关闭 trace 时不出现，产品行为符合需求 §8-1）。其它控制台错误仍判失败。
  // 这条规则也会放过产品自己对 blob: 发出的请求；需求 §8-1「无网络请求」由 S11 的请求计数兜底，这里放过不会漏掉产品外发。
  const traceCsp = (e) => /^Connecting to 'blob:/.test(e) && e.includes("connect-src 'none'");
  expect(errors.filter((e) => !/Failed to load resource|net::/.test(e) && !traceCsp(e))).toEqual([]);
});
