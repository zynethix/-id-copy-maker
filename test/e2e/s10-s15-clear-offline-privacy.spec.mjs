// S10 用完清除 · S11 断网使用 · S13 大照片 · S14 隐私核对 · S15 浏览器兼容（Chrome 部分）
// （docs/tests/functional-tests.md S10、S11、S13 第 1-2 步、S14、S15 第 1 步 Chrome）
// 需求点：§3-5、§8-4、§10-7；§1-3、§2-1、§2-2、§8-1、§8-5、§10-1、§10-2；§5-1、§10-9；§6-5、§7-6、§8-2、§8-3、§10-4；§2-4
import { test, expect } from '@playwright/test';
import {
  openApp, makeMockImage, withExif, pickImage, pickFile, makeSide, exportFile,
  parsePng, parsePdf, parseJpeg, todayYmd, PAGE_URL,
} from './helpers.mjs';

/** 用户看得见的图像：页面上所有尺寸大于 0 且可见的画布与图片。 */
const visibleImages = (page) => page.evaluate(() =>
  [...document.querySelectorAll('canvas, img')].filter((e) => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && (e.width || e.naturalWidth) > 0;
  }).length);

test('S10 清除全部：立即清空图像、预览与设置；裁剪中、读取中清除也干净', async ({ page, browser }) => {
  const img = await makeMockImage(browser, { w: 2400, h: 1600 });
  const { errors } = await openApp(page);
  let dialogs = 0;
  page.on('dialog', () => { dialogs++; });

  // 1 双面 + 灰度 + 水印各项都改过：填用途、改日期、填自定义文字、关掉水印，再换到银行模板
  await makeSide(page, 'front', img);
  await makeSide(page, 'back', img);
  await page.locator('#wm-purpose').fill('开户');
  await page.locator('#wm-date').fill('2026-01-05');
  await page.getByLabel('自定义', { exact: true }).check();
  await page.locator('#wm-custom').fill('自定义文字');
  await page.getByLabel('仅用于银行开户，复印无效 日期').check();
  page.once('dialog', (d) => d.accept());
  await page.locator('#wm-on').click();
  await expect(page.locator('#wm-on')).not.toBeChecked();
  await page.getByLabel('灰度').check();
  dialogs = 0;
  expect(await visibleImages(page)).toBeGreaterThan(0);
  await page.locator('#clear-all').click();
  expect(dialogs).toBe(0);
  await expect(page.locator('#pv-empty')).toBeVisible();
  await expect(page.locator('#pv-badge')).toHaveText('尚未确认任何一面');
  await expect(page.locator('#front-badge')).toHaveText('未选图');
  await expect(page.locator('#back-badge')).toHaveText('未选图');
  expect(await visibleImages(page)).toBe(0);
  await expect(page.getByLabel('彩色')).toBeChecked();
  await expect(page.locator('#wm-on')).toBeChecked();
  await expect(page.getByLabel('仅供____办理业务使用，他用无效 日期')).toBeChecked();
  await expect(page.locator('#wm-purpose')).toHaveValue('');
  await expect(page.locator('#wm-custom')).toHaveValue('');
  const t = todayYmd();
  await expect(page.locator('#wm-date')).toHaveValue(`${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6)}`);

  // 2 裁剪中途清除
  await pickImage(page, 'front', img);
  await page.locator('#clear-all').click();
  await expect(page.locator('#front-crop')).toBeHidden();
  expect(await visibleImages(page)).toBe(0);

  // 3 读取中清除：选一张大图，徽标一变成「解码中…」就点「清除全部」，等这张图本该读完的时间过去也不会冒出来。
  // 人手点得没那么快，测试里在页面上挂一个一次性的观察者：徽标文字变成「解码中…」的同一刻点按钮，
  // 并记下点击时徽标的文字，证明清除确实发生在读取途中（不是读完才清）。
  const big = await makeMockImage(browser, { w: 5000, h: 3400 });
  await page.evaluate(() => {
    const badge = document.getElementById('front-badge');
    window.__clickedDuring = null;
    const ob = new MutationObserver(() => {
      if (badge.textContent === '解码中…') {
        ob.disconnect();
        window.__clickedDuring = badge.textContent;
        document.getElementById('clear-all').click();
      }
    });
    ob.observe(badge, { childList: true, characterData: true, subtree: true });
  });
  const t0 = Date.now();
  await pickFile(page, 'front', { name: 'big.jpg', mimeType: 'image/jpeg', buffer: big });
  await expect.poll(() => page.evaluate(() => window.__clickedDuring)).toBe('解码中…');
  // 参照：同一张图正常读完要多久，清除后至少等那么久的两倍
  const ref = await browser.newPage();
  await openApp(ref);
  const r0 = Date.now();
  await pickImage(ref, 'front', big);
  const decodeMs = Date.now() - r0;
  await ref.close();
  const left = 2 * decodeMs - (Date.now() - t0);
  if (left > 0) await page.waitForTimeout(left);
  await expect(page.locator('#front-badge')).toHaveText('未选图');
  await expect(page.locator('#front-crop')).toBeHidden();
  expect(await visibleImages(page)).toBe(0);

  // 4 清除后再选同一张图
  await pickImage(page, 'front', img);
  // 读取途中清除：页面按设计撤销了正在读取的本地图片地址（blob:），浏览器随即在控制台记一条
  // 「Not allowed to load local resource: blob:…」。用户看到的结果不受影响（页面保持清空，上面已断言），
  // 所以只放过这一种、且只在这一步之后出现的消息；其它任何控制台错误仍判失败。
  expect(errors.filter((e) => !/^Not allowed to load local resource: blob:/.test(e))).toEqual([]);
  expect(errors.filter((e) => /^Not allowed to load local resource: blob:/.test(e)).length).toBeLessThanOrEqual(1);
});

// 说明：页面是 file:// 本地文件，浏览器离线模式不影响它的加载。离线模式在这里的作用是：页面若去访问网络，
// 请求会失败并暴露出来。真正的判据是：除页面文件本身外，浏览器没有产生任何请求，资源计时条目为 0，
// 控制台没有报错（被 CSP 拦下的请求会在控制台报错）。导出用的 blob: 是本机内存地址，不算网络请求。
test('S11 断网使用：离线打开、刷新并走完全流程，页面不发出任何请求', async ({ page, context, browser }) => {
  const img = await makeMockImage(browser, { w: 2400, h: 1600 });
  const requests = [];
  page.on('request', (r) => { if (r.url() !== PAGE_URL) requests.push(r.url()); });
  await context.setOffline(true);

  const { errors } = await openApp(page);
  // 2 刷新一次：仍只有页面文件本身
  await page.reload();
  await expect(page.locator('#front-badge')).toHaveText('未选图');
  // 样式完整（离线也加载了内联样式）
  expect(await page.locator('section').first().evaluate((e) => getComputedStyle(e).borderRadius)).toBe('10px');

  await makeSide(page, 'front', img);
  await makeSide(page, 'back', img);
  await page.getByLabel('仅用于租房备案，复印无效 日期').check();
  await exportFile(page, 'pdf');
  await exportFile(page, 'png');
  await page.locator('#clear-all').click();

  // 页面文件之外：无任何请求
  const network = requests.filter((u) => !u.startsWith('blob:') && !u.startsWith('data:'));
  expect(network).toEqual([]);
  expect(await page.evaluate(() => performance.getEntriesByType('resource')
    .filter((e) => !e.name.startsWith('blob:') && !e.name.startsWith('data:')).length)).toBe(0);
  expect(errors).toEqual([]);
});

test('S13 大照片：12MP 双面导出与超大图裁剪都不出错', async ({ page, browser }) => {
  test.setTimeout(240_000);
  const m12 = await makeMockImage(browser, { w: 4000, h: 3000 });
  const huge = await makeMockImage(browser, { w: 6000, h: 4000 });
  const { errors } = await openApp(page);

  await makeSide(page, 'front', m12);
  await makeSide(page, 'back', m12);
  await page.locator('#wm-purpose').fill('开户');
  const pdf = await exportFile(page, 'pdf');
  expect(parseJpeg(parsePdf(pdf.bytes).jpeg).width).toBe(2480);
  const png = await exportFile(page, 'png');
  expect(parsePng(png.bytes).height).toBe(3508);

  await pickImage(page, 'front', huge);
  // 裁剪区响应正常：能拖动、能确认
  const cv = page.locator('#front-wrap canvas.view');
  const bb = await cv.boundingBox();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.mouse.down();
  await page.mouse.move(bb.x + bb.width / 2 + 40, bb.y + bb.height / 2, { steps: 5 });
  await page.mouse.up();
  await page.locator('#front-confirm').click();
  await expect(page.locator('#front-badge')).toHaveText('已确认');
  expect(errors).toEqual([]);
});

test('S14 隐私核对：导出文件无拍摄信息；刷新与重开后不保留任何输入', async ({ page, browser, context }) => {
  const gpsJpeg = withExif(await makeMockImage(browser, { w: 2400, h: 1600 }), { gps: true });
  // 素材本身确实带 EXIF/GPS
  expect(parseJpeg(gpsJpeg).hasExif).toBe(true);
  expect(gpsJpeg.includes(Buffer.from('MOCKCAM'))).toBe(true);

  const { errors } = await openApp(page);
  await makeSide(page, 'front', gpsJpeg);
  await page.locator('#wm-purpose').fill('开户');

  // 2 PNG：2480×3508，无 EXIF 与文字信息块，无相机型号
  const png = await exportFile(page, 'png');
  const pp = parsePng(png.bytes);
  expect([pp.width, pp.height]).toEqual([2480, 3508]);
  for (const t of ['eXIf', 'tEXt', 'iTXt', 'zTXt']) expect(pp.chunks).not.toContain(t);
  expect(pp.phys).toEqual({ x: 11811, y: 11811, unit: 1 }); // 300 DPI
  expect(png.bytes.includes(Buffer.from('MOCKCAM'))).toBe(false);

  // 3 PDF：A4，无作者、生成程序信息；嵌入的图片无 EXIF
  const pdf = await exportFile(page, 'pdf');
  const p = parsePdf(pdf.bytes);
  expect(p.mediaBox).toEqual([0, 0, 595.28, 841.89]);
  for (const k of ['/Info', '/Author', '/Creator', '/Producer']) expect(p.text).not.toContain(k);
  expect(parseJpeg(p.jpeg).hasExif).toBe(false);
  expect(pdf.bytes.includes(Buffer.from('MOCKCAM'))).toBe(false);

  // 6 文件名只有前缀和日期
  expect(pdf.name).toMatch(/^身份证复印件_\d{8}\.pdf$/);

  // 4 刷新：用途、模板、照片都没了
  await page.getByLabel('自定义', { exact: true }).check();
  await page.locator('#wm-custom').fill('自定义文字');
  await page.reload();
  await expect(page.locator('#front-badge')).toHaveText('未选图');
  await expect(page.getByLabel('仅供____办理业务使用，他用无效 日期')).toBeChecked();
  await expect(page.locator('#wm-purpose')).toHaveValue('');
  await expect(page.locator('#wm-custom')).toHaveValue('');
  await expect(page.locator('#pv-empty')).toBeVisible();

  // 5 关掉页面再打开（同一浏览器配置）：同样什么都没保留
  await page.close();
  const p2 = await context.newPage();
  const { errors: errors2 } = await openApp(p2);
  await expect(p2.locator('#wm-purpose')).toHaveValue('');
  await expect(p2.locator('#pv-empty')).toBeVisible();
  // 浏览器存储里也没有任何东西
  expect(await p2.evaluate(() => [window.localStorage.length, window.sessionStorage.length])).toEqual([0, 0]);
  expect(errors).toEqual([]);
  expect(errors2).toEqual([]);
});

test('S15 支持范围内的 Chrome：页面不显示「浏览器过旧」提示', async ({ page }) => {
  const { errors } = await openApp(page);
  // 页面里确有这条提示，只是当前浏览器不显示
  const warn = page.locator('#old-warn');
  await expect(warn).toHaveCount(1);
  await expect(warn).toHaveText('此浏览器版本过旧，可能无法正常使用，建议升级后再试', { useInnerText: false });
  await expect(warn).toBeHidden();
  expect(errors).toEqual([]);
});
