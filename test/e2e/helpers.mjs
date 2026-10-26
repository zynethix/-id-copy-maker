// 端到端测试公共工具：打开页面、生成 mock 证件图、选图、导出并读取下载文件、解析导出字节。
// 只通过用户可见的操作驱动页面（点按钮、选文件、拖动），不调用页面内部函数，不改产品代码。
import { expect } from '@playwright/test';
import fs from 'node:fs/promises';

export const PAGE_URL = new URL('../../index.html', import.meta.url).href;

/** 打开页面，并记录 console error 与页面异常，供场景末尾断言「页面没出错」。 */
export async function openApp(page) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(PAGE_URL);
  await expect(page.locator('#front-badge')).toHaveText('未选图');
  return { errors };
}

/** 本地日期 YYYYMMDD，用于核对导出文件名。 */
export function todayYmd(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

/**
 * 在一个空白页里用画布画一张假证件照，返回 JPEG/PNG 字节。
 * 画面：浅色背景 + 居中的彩色「卡片」+ 文字与色块，便于肉眼和像素检查方向、颜色。
 * opts: { w, h, type: 'image/jpeg'|'image/png', rotated: 卡片竖放（模拟横拍转 90°）, rotate: 自定义倾斜角（弧度，配合 rotated）,
 *        plain: 纯色整图（传颜色串），用来把水印从底图里分离出来 }
 */
export async function makeMockImage(browser, { w, h, type = 'image/jpeg', rotated = false, rotate = 0, plain = null }) {
  const ctx = await browser.newContext();
  try {
  const p = await ctx.newPage();
  const b64 = await p.evaluate(async ({ w, h, type, rotated, rotate, plain }) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = plain || '#d8e4d0'; g.fillRect(0, 0, w, h);
    if (!plain) {
    g.save();
    g.translate(w / 2, h / 2);
    if (rotated) g.rotate(rotate || Math.PI / 2);
    const cw = Math.min(rotated ? h : w, (rotated ? w : h) * 85.6 / 54) * 0.8;
    const ch = cw * 54 / 85.6;
    g.fillStyle = '#3b82f6'; g.fillRect(-cw / 2, -ch / 2, cw, ch);
    g.fillStyle = '#ef4444'; g.fillRect(-cw / 2 + cw * 0.06, -ch / 2 + ch * 0.1, cw * 0.28, ch * 0.6);
    g.fillStyle = '#facc15'; g.fillRect(cw * 0.05, -ch / 2 + ch * 0.12, cw * 0.38, ch * 0.08);
    // 文字不用纯白：裁剪框边线是纯白，测试靠纯白像素找框
    g.fillStyle = '#e8e8e8'; g.font = `${Math.round(ch * 0.12)}px sans-serif`;
    g.fillText('MOCK ID 样张', cw * 0.02, ch * 0.1);
    g.restore();
    // 左上角品红方块：用来判断画面朝向（旋转后它跑到哪个角）
    const m = Math.round(Math.min(w, h) * 0.08);
    g.fillStyle = '#ff00ff'; g.fillRect(0, 0, m, m);
    }
    const blob = await new Promise((r) => c.toBlob(r, type, 0.9));
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return btoa(s);
  }, { w, h, type, rotated, rotate, plain });
  return Buffer.from(b64, 'base64');
  } finally {
    await ctx.close();
  }
}

/**
 * 在 JPEG 的 SOI 之后插入一个 APP1/Exif 段，模拟手机原图带的元数据：
 * orientation（方向标记，6 = 显示时顺时针转 90°）、gps（相机型号 MOCKCAM + GPS 纬度标记）。
 */
export function withExif(jpeg, { orientation = 0, gps = false } = {}) {
  // 小端 TIFF。IFD0 条目按标签号升序：0x0110 Model、0x0112 Orientation、0x8825 GPSInfo 指针
  const entries = [];
  if (gps) entries.push({ tag: 0x0110, type: 2, count: 8, data: Buffer.from('MOCKCAM\0', 'latin1') });
  if (orientation) entries.push({ tag: 0x0112, type: 3, count: 1, inline: orientation });
  if (gps) entries.push({ tag: 0x8825, type: 4, count: 1, gpsPtr: true });
  const ifd0Size = 2 + entries.length * 12 + 4;
  let extra = 8 + ifd0Size; // IFD0 之后放外置数据
  const head = Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00]);
  const ifd = Buffer.alloc(ifd0Size);
  ifd.writeUInt16LE(entries.length, 0);
  const blobs = [];
  const modelOff = extra;
  if (gps) { blobs.push(entries[0].data); extra += 8; }
  const gpsOff = extra;
  entries.forEach((e, i) => {
    const o = 2 + i * 12;
    ifd.writeUInt16LE(e.tag, o); ifd.writeUInt16LE(e.type, o + 2); ifd.writeUInt32LE(e.count, o + 4);
    if (e.data) ifd.writeUInt32LE(modelOff, o + 8);
    else if (e.gpsPtr) ifd.writeUInt32LE(gpsOff, o + 8);
    else ifd.writeUInt16LE(e.inline, o + 8);
  });
  if (gps) {
    // GPS IFD 一项：GPSLatitudeRef = 'N'
    const g = Buffer.alloc(2 + 12 + 4);
    g.writeUInt16LE(1, 0);
    g.writeUInt16LE(0x0001, 2); g.writeUInt16LE(2, 4); g.writeUInt32LE(2, 6); g.write('N\0', 10, 'latin1');
    blobs.push(g);
  }
  const tiff = Buffer.concat([head, ifd, ...blobs]);
  const body = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), tiff]);
  const seg = Buffer.concat([Buffer.from([0xff, 0xe1, (body.length + 2) >> 8, (body.length + 2) & 0xff]), body]);
  return Buffer.concat([jpeg.subarray(0, 2), seg, jpeg.subarray(2)]);
}

/** 选图：点「选图」按钮弹出文件选择器，交给它一个内存文件。 */
export async function pickFile(page, side, { name, mimeType, buffer }) {
  const chooser = page.waitForEvent('filechooser');
  await page.locator(`#${side}-pick`).click();
  await (await chooser).setFiles({ name, mimeType, buffer });
}

/** 选图并等到进入裁剪状态。 */
export async function pickImage(page, side, buffer, name = 'card.jpg', mimeType = 'image/jpeg') {
  await pickFile(page, side, { name, mimeType, buffer });
  await expect(page.locator(`#${side}-badge`)).toHaveText('裁剪中，请调整后点"确认裁剪"');
  await expect(page.locator(`#${side}-wrap canvas.view`)).toBeVisible();
}

/** 选图 → 默认最大框 → 确认。 */
export async function makeSide(page, side, buffer) {
  await pickImage(page, side, buffer);
  await page.locator(`#${side}-confirm`).click();
  await expect(page.locator(`#${side}-badge`)).toHaveText(/^已确认/);
}

/**
 * 读用户在裁剪区看到的画面：裁剪框是纯白边线加四个角点方块。
 * 返回 { screen: 画布在屏幕上的位置, canvasW, canvasH, box: 裁剪框白色边线的位置 {x0,x1,y0,y1}（画布像素）,
 *        magentaQuadrant: 品红标记所在的象限 'tl'|'tr'|'bl'|'br'|null }。
 */
export async function readCropView(page, side) {
  const loc = page.locator(`#${side}-wrap canvas.view`);
  const screen = await loc.boundingBox();
  const info = await loc.evaluate((cv) => {
    const g = cv.getContext('2d');
    const d = g.getImageData(0, 0, cv.width, cv.height).data;
    let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1, mx = 0, my = 0, mn = 0;
    for (let y = 0; y < cv.height; y++) {
      for (let x = 0; x < cv.width; x++) {
        const i = (y * cv.width + x) * 4, R = d[i], G = d[i + 1], B = d[i + 2];
        if (R >= 250 && G >= 250 && B >= 250) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        if (R > 100 && G < 50 && B > 100 && Math.abs(R - B) < 40) { mx += x; my += y; mn++; }
      }
    }
    // 角点方块在图边缘会被画布截掉，所以不用外接框，改为过框中心各扫一行一列找白色边线
    const cx = Math.round((x0 + x1) / 2), cy = Math.round((y0 + y1) / 2);
    const isW = (x, y) => { const i = (y * cv.width + x) * 4; return d[i] >= 250 && d[i + 1] >= 250 && d[i + 2] >= 250; };
    let bl = -1, br = -1, bt = -1, bb = -1;
    for (let x = 0; x < cv.width; x++) if (isW(x, cy)) { if (bl < 0) bl = x; br = x; }
    for (let y = 0; y < cv.height; y++) if (isW(cx, y)) { if (bt < 0) bt = y; bb = y; }
    let q = null;
    if (mn > 20) q = (my / mn < cv.height / 2 ? 't' : 'b') + (mx / mn < cv.width / 2 ? 'l' : 'r');
    return { canvasW: cv.width, canvasH: cv.height, box: { x0: bl, x1: br, y0: bt, y1: bb }, magentaQuadrant: q };
  });
  return { screen, ...info };
}

/** 画布像素坐标 → 屏幕坐标。 */
export function toScreen(view, x, y) {
  return { x: view.screen.x + x * view.screen.width / view.canvasW, y: view.screen.y + y * view.screen.height / view.canvasH };
}

/** 用鼠标从 a 拖到 b（屏幕坐标），分多步移动，像真人拖动。 */
export async function drag(page, a, b) {
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(50); // 等 requestAnimationFrame 重绘
}

/** 点导出按钮，返回 { name, bytes }（下载文件名与内容）。 */
export async function exportFile(page, kind) {
  const dl = page.waitForEvent('download');
  await page.locator(kind === 'pdf' ? '#ex-pdf' : '#ex-png').click();
  const d = await dl;
  const p = await d.path();
  const bytes = await fs.readFile(p);
  await expect(page.locator('#ex-msg')).toHaveText(`已导出：${d.suggestedFilename()}`);
  return { name: d.suggestedFilename(), bytes };
}

/** 统计导出期间的下载事件数（用于「被拦下、没生成文件」的断言）。 */
export function countDownloads(page) {
  const box = { n: 0 };
  page.on('download', () => { box.n += 1; });
  return box;
}

// ===== 导出字节解析（Node 侧，只读文件内容，不依赖页面代码）=====

/** PNG：返回 { width, height, chunks:[type...] }。 */
export function parsePng(buf) {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  sig.forEach((b, i) => { if (buf[i] !== b) throw new Error('not a PNG'); });
  const chunks = [];
  let o = 8, width = 0, height = 0, phys = null;
  while (o < buf.length) {
    const len = buf.readUInt32BE(o);
    const type = buf.toString('latin1', o + 4, o + 8);
    if (type === 'IHDR') { width = buf.readUInt32BE(o + 8); height = buf.readUInt32BE(o + 12); }
    if (type === 'pHYs') phys = { x: buf.readUInt32BE(o + 8), y: buf.readUInt32BE(o + 12), unit: buf[o + 16] };
    chunks.push(type);
    o += 12 + len;
  }
  return { width, height, chunks, phys };
}

/** JPEG：返回 { width, height, components, hasExif }。 */
export function parseJpeg(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error('not a JPEG');
  let o = 2, info = null, hasExif = false;
  while (o + 4 <= buf.length) {
    if (buf[o] !== 0xff) break;
    const m = buf[o + 1];
    if (m === 0xd9 || m === 0xda) break;
    const len = buf.readUInt16BE(o + 2);
    if (m === 0xe1 && buf.toString('latin1', o + 4, o + 8) === 'Exif') hasExif = true;
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      info = { height: buf.readUInt16BE(o + 5), width: buf.readUInt16BE(o + 7), components: buf[o + 9] };
    }
    o += 2 + len;
  }
  return { ...info, hasExif };
}

/** PDF：返回 { pages, mediaBox:[...], jpeg: Buffer, text }（text 为 latin1 全文，便于查 /Info、/Author 等）。 */
export function parsePdf(buf) {
  const text = buf.toString('latin1');
  if (!text.startsWith('%PDF-')) throw new Error('not a PDF');
  const mb = /\/MediaBox\s*\[\s*([\d.\s-]+)\]/.exec(text);
  const pages = (text.match(/\/Type\s*\/Page(?![s\w])/g) || []).length;
  const s = text.indexOf('stream', text.indexOf('/Subtype /Image'));
  let start = s + 'stream'.length;
  if (text[start] === '\r') start += 1;
  if (text[start] === '\n') start += 1;
  const end = text.indexOf('endstream', start);
  let jpeg = buf.subarray(start, end);
  while (jpeg.length && (jpeg[jpeg.length - 1] === 0x0a || jpeg[jpeg.length - 1] === 0x0d)) jpeg = jpeg.subarray(0, jpeg.length - 1);
  return { pages, mediaBox: mb ? mb[1].trim().split(/\s+/).map(Number) : null, jpeg, text };
}

/**
 * 在页面里把图像字节解码成像素，回传按区域统计的结果，用于检查导出画面：
 * regions: [{name, x, y, w, h}] → { name: { mean:[r,g,b], nonWhite: 比例, gray: 是否 R=G=B, colorful: 比例 } }
 */
export async function analyzeImage(page, bytes, mime, regions) {
  return page.evaluate(async ({ b64, mime, regions }) => {
    const bin = atob(b64); const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const bmp = await createImageBitmap(new Blob([u], { type: mime }));
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const g = c.getContext('2d'); g.drawImage(bmp, 0, 0);
    const out = { width: bmp.width, height: bmp.height };
    for (const r of regions) {
      const d = g.getImageData(r.x, r.y, r.w, r.h).data;
      let sr = 0, sg = 0, sb = 0, nonWhite = 0, colorful = 0, red = 0, grayAll = true, n = 0;
      for (let i = 0; i < d.length; i += 16) { // 每 4 个像素取 1 个
        const R = d[i], G = d[i + 1], B = d[i + 2];
        sr += R; sg += G; sb += B; n++;
        if (R < 245 || G < 245 || B < 245) nonWhite++;
        if (R > 170 && G < 110 && B < 110) red++;
        const spread = Math.max(R, G, B) - Math.min(R, G, B);
        if (spread > 24) colorful++;
        if (spread > 6) grayAll = false; // JPEG 有色度误差，容许极小差值
      }
      out[r.name] = { mean: [sr / n, sg / n, sb / n], nonWhite: nonWhite / n, colorful: colorful / n, red: red / n, gray: grayAll };
    }
    return out;
  }, { b64: bytes.toString('base64'), mime, regions });
}

/**
 * 在导出图上找卡片的黑色边框：沿卡片中线横向、纵向扫描深色像素，返回外缘位置（像素）。
 * 用来换算打印尺寸：mm = 像素 / 2480 * 210（横向），像素 / 3508 * 297（纵向）。
 */
export async function measureCardBorder(page, bytes, mime, { midX, midY, x0, x1, y0, y1 }) {
  return page.evaluate(async ({ b64, mime, midX, midY, x0, x1, y0, y1 }) => {
    const bin = atob(b64); const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const bmp = await createImageBitmap(new Blob([u], { type: mime }));
    const c = new OffscreenCanvas(bmp.width, bmp.height); const g = c.getContext('2d'); g.drawImage(bmp, 0, 0);
    const dark = (x, y) => { const d = g.getImageData(x, y, 1, 1).data; return d[0] < 80 && d[1] < 80 && d[2] < 80; };
    let left = -1, right = -1, top = -1, bottom = -1;
    for (let x = x0; x <= x1; x++) if (dark(x, midY)) { if (left < 0) left = x; right = x; }
    for (let y = y0; y <= y1; y++) if (dark(midX, y)) { if (top < 0) top = y; bottom = y; }
    return { left, right, top, bottom };
  }, { b64: bytes.toString('base64'), mime, midX, midY, x0, x1, y0, y1 });
}

/** 预览画布像素统计（预览是用户看见的画面）。区域坐标按预览内部像素 900×1273 计。 */
export async function analyzePreview(page, regions) {
  return page.evaluate((regions) => {
    const cv = document.getElementById('preview');
    const g = cv.getContext('2d');
    const out = { width: cv.width, height: cv.height };
    for (const r of regions) {
      const d = g.getImageData(r.x, r.y, r.w, r.h).data;
      let colorful = 0, nonWhite = 0, n = 0, grayAll = true;
      for (let i = 0; i < d.length; i += 4) {
        const R = d[i], G = d[i + 1], B = d[i + 2]; n++;
        const spread = Math.max(R, G, B) - Math.min(R, G, B);
        if (spread > 24) colorful++;
        if (spread > 0) grayAll = false;
        if (R < 245 || G < 245 || B < 245) nonWhite++;
      }
      out[r.name] = { colorful: colorful / n, nonWhite: nonWhite / n, gray: grayAll };
    }
    return out;
  }, regions);
}

// A4 版面上用户看得见的几个区域（导出图 2480×3508 像素，300 DPI）：
// 上半页卡片区、下半页卡片区、卡片外的纸面空白。数值是「85.6×54mm 卡片居中、上下两张间距约 30mm」在 300 DPI 下的位置，
// 取区域时向内各收 20 像素，避开边框线。
export const SHEET = {
  front: { x: 754, y: 959, w: 971, h: 598 },
  back: { x: 754, y: 1951, w: 971, h: 598 },
  // 卡片位置向外扩 30 像素：用来确认「没选的一面」连边框、占位框都没有
  frontOuter: { x: 704, y: 909, w: 1071, h: 698 },
  backOuter: { x: 704, y: 1901, w: 1071, h: 698 },
  // 上半页卡片的左半、右半：mock 卡片的红块在卡片左侧，用来判断导出方向
  frontLeft: { x: 754, y: 959, w: 485, h: 598 },
  frontRight: { x: 1240, y: 959, w: 485, h: 598 },
  margin: { x: 40, y: 40, w: 600, h: 800 },
  gapBetween: { x: 754, y: 1620, w: 971, h: 260 },
};

export const PREVIEW = (() => {
  const k = 900 / 2480;
  const s = (r) => ({ x: Math.round(r.x * k), y: Math.round(r.y * k), w: Math.round(r.w * k), h: Math.round(r.h * k) });
  return { front: s(SHEET.front), back: s(SHEET.back), margin: s(SHEET.margin) };
})();

// ===== 水印分析：只对纯色素材（makeMockImage 的 plain）做出的卡片有意义 =====
// 纯色卡片上偏离底色的像素只可能来自水印，所以「偏离像素为 0」就是「没有水印」的正向证据。
// 页面只负责把像素取出来（页面的 CSP 不允许在页内执行字符串代码），分析在 Node 侧做，导出文件与预览画布共用。

/** 在 Node 侧分析一块像素（RGBA），返回 { base, marked, maxDev, alpha, ink, angleDeg, rows }。 */
export function analyzeInk(d, W, H) {
  const med = (k) => { const a = []; for (let i = k; i < d.length; i += 4) a.push(d[i]); a.sort((x, y) => x - y); return a[a.length >> 1]; };
  const base = [med(0), med(1), med(2)];
  const dev = new Float32Array(W * H);
  let marked = 0, maxDev = 0;
  for (let p = 0; p < W * H; p++) {
    const i = p * 4;
    const v = Math.max(Math.abs(d[i] - base[0]), Math.abs(d[i + 1] - base[1]), Math.abs(d[i + 2] - base[2]));
    dev[p] = v; if (v > 12) marked++; if (v > maxDev) maxDev = v;
  }
  const out = { base, marked: marked / (W * H), maxDev };
  if (marked < 50) return out;
  // 墨色与不透明度：取偏离最大的一批像素（字笔画中间，完全被水印覆盖），
  // 按「像素 = 底色×(1−a) + 墨色×a」从底色差异最大的两个通道解出 a，再反算三个通道的墨色
  const s = [0, 0, 0]; let n = 0;
  for (let p = 0; p < W * H; p++) if (dev[p] >= maxDev * 0.92) { const i = p * 4; s[0] += d[i]; s[1] += d[i + 1]; s[2] += d[i + 2]; n++; }
  const px = s.map((v) => v / n);
  let bi = 0, bj = 1, best = -1;
  for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) { const g = Math.abs(base[i] - base[j]); if (g > best) { best = g; bi = i; bj = j; } }
  const a = 1 - (px[bi] - px[bj]) / (base[bi] - base[bj]);
  out.alpha = a;
  out.ink = [0, 1, 2].map((c) => (px[c] - base[c] * (1 - a)) / a);
  // 文字方向与行数：把水印像素投影到「垂直于文字方向」的轴上，方向对了投影会分成一条条清楚的带
  const pts = [];
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (dev[y * W + x] > 12) pts.push(x, y);
  const hist = (deg) => {
    const t = deg * Math.PI / 180, sn = Math.sin(t), cs = Math.cos(t);
    const off = W + H, h = new Float32Array(Math.ceil((2 * off) / 3) + 1);
    for (let k = 0; k < pts.length; k += 2) h[Math.floor((-pts[k] * sn + pts[k + 1] * cs + off) / 3)]++;
    return h;
  };
  let bestDeg = 0, bestScore = -1;
  for (let deg = -85; deg <= 85; deg += 1) {
    const h = hist(deg); let m = 0, q = 0; for (const v of h) { m += v; q += v * v; }
    const score = q / (m || 1);
    if (score > bestScore) { bestScore = score; bestDeg = deg; }
  }
  out.angleDeg = bestDeg;
  const h = hist(bestDeg);
  const sm = Array.from(h, (_, i) => (h[i - 1] || 0) + h[i] + (h[i + 1] || 0));
  const top = Math.max(...sm);
  let rows = 0, inRun = false, gap = 99;
  for (const v of sm) {
    if (v > top * 0.15) { if (!inRun && gap >= 12) rows++; inRun = true; gap = 0; }
    else { inRun = false; gap++; }
  }
  out.rows = rows;
  return out;
}

/** 在页面里解码图像字节，取出一块区域的 RGBA 像素（base64 回传）。 */
async function pixelsOfFile(page, bytes, mime, r) {
  const b64 = await page.evaluate(async ({ b64, mime, r }) => {
    const bin = atob(b64); const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const bmp = await createImageBitmap(new Blob([u], { type: mime }));
    const c = new OffscreenCanvas(bmp.width, bmp.height); const g = c.getContext('2d'); g.drawImage(bmp, 0, 0);
    const d = g.getImageData(r.x, r.y, r.w, r.h).data;
    let s = ''; for (let i = 0; i < d.length; i += 0x8000) s += String.fromCharCode.apply(null, d.subarray(i, i + 0x8000));
    return btoa(s);
  }, { b64: bytes.toString('base64'), mime, r });
  return Buffer.from(b64, 'base64');
}

/**
 * 分析导出文件里一张纯色卡片上的水印。
 * 返回 { marked: 水印像素占比, alpha: 水印不透明度, ink: 水印颜色 [r,g,b], angleDeg: 文字斜度, rows: 卡片内的行数 }。
 */
export async function watermarkOnFile(page, bytes, mime, region) {
  return analyzeInk(await pixelsOfFile(page, bytes, mime, region), region.w, region.h);
}

/** 同上，分析用户看到的预览画布（区域按预览内部像素 900×1273 计）。 */
export async function watermarkOnPreview(page, region) {
  const b64 = await page.evaluate((r) => {
    const d = document.getElementById('preview').getContext('2d').getImageData(r.x, r.y, r.w, r.h).data;
    let s = ''; for (let i = 0; i < d.length; i += 0x8000) s += String.fromCharCode.apply(null, d.subarray(i, i + 0x8000));
    return btoa(s);
  }, region);
  return analyzeInk(Buffer.from(b64, 'base64'), region.w, region.h);
}

/** 在导出图的某一列里从上往下找第一个蓝色（mock 卡片底色）像素的 y，用来量卡片上边是否倾斜；找不到返回 -1。 */
export async function firstBlueY(page, bytes, mime, x, y0, y1) {
  const d = await pixelsOfFile(page, bytes, mime, { x, y: y0, w: 1, h: y1 - y0 });
  for (let i = 0; i < d.length; i += 4) if (d[i + 2] > 180 && d[i] < 120) return y0 + i / 4;
  return -1;
}

/** 两张导出图同一区域逐像素是否完全相同（用于「关闭水印后与原图一致」「纸面空白处没有水印」）。 */
export async function diffRegion(page, bytesA, bytesB, mime, region) {
  return page.evaluate(async ({ a, b, mime, r }) => {
    const dec = async (b64) => {
      const bin = atob(b64); const u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      const bmp = await createImageBitmap(new Blob([u], { type: mime }));
      const c = new OffscreenCanvas(bmp.width, bmp.height); const g = c.getContext('2d'); g.drawImage(bmp, 0, 0);
      return g.getImageData(r.x, r.y, r.w, r.h).data;
    };
    const A = await dec(a), B = await dec(b);
    let diff = 0;
    for (let i = 0; i < A.length; i += 4) if (A[i] !== B[i] || A[i + 1] !== B[i + 1] || A[i + 2] !== B[i + 2]) diff++;
    return diff / (A.length / 4);
  }, { a: bytesA.toString('base64'), b: bytesB.toString('base64'), mime, r: region });
}
