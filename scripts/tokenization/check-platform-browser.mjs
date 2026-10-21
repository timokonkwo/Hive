import { build } from 'esbuild';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../../', import.meta.url)), dir = await mkdtemp(join(tmpdir(), 'hive-platform-browser-'));
let browser, server;
try {
  await build({ entryPoints: [root + 'scripts/tokenization/platform-browser-fixture.jsx'], bundle: true,
    format: 'iife', jsx: 'automatic', outfile: dir + '/app.js', external: ['/redesign/fonts/*'],
    plugins: [{ name: 'aliases', setup(b) { b.onResolve({ filter: /^@\// }, args => ({ path: root + args.path.slice(2) + '.ts' })); } }] });
  const html = `<!doctype html><html lang="en"><head><title>Multi-platform launch fixture</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><style>
    body{margin:0;padding:20px}h1{font-size:24px}
    </style></head><body><div id="root"></div><script src="/app.js"></script></body></html>`;
  server = http.createServer(async (req, res) => {
    if (new URL(req.url, 'http://localhost').pathname === '/') { res.setHeader('Content-Type', 'text/html'); res.end(html); }
    else if (['/app.js', '/app.css'].includes(req.url)) {
      res.setHeader('Content-Type', req.url.endsWith('.js') ? 'application/javascript' : 'text/css'); res.end(await readFile(dir + req.url));
    } else { res.statusCode = 404; res.end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const theme of ['light', 'dark']) for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.evaluate(theme => document.documentElement.dataset.hiveTheme = theme, theme);
    const next = page.getByRole('button', { name: 'Continue', exact: true });
    assert.equal(await next.isDisabled(), true);
    await page.getByRole('button', { name: 'Select all available' }).click();
    assert.equal(await page.getByRole('checkbox', { checked: true }).count(), 3);
    assert.equal(await next.isEnabled(), true);
    assert.equal(await next.evaluate(el => getComputedStyle(el).color), 'rgb(24, 32, 21)');
    await page.getByRole('checkbox', { name: /Robinhood/ }).uncheck();
    assert.equal(await page.getByRole('checkbox', { checked: true }).count(), 2);
    await page.getByRole('button', { name: 'Select all available' }).click();
    const tokenSection = page.getByRole('region', { name: 'Agent tokens' });
    const tradeTrigger = tokenSection.getByRole('button', { name: 'Trade', exact: true });
    assert.equal(await tokenSection.getByRole('link').count(), 0);
    assert.equal(await tradeTrigger.evaluate(el => getComputedStyle(el).color), 'rgb(24, 32, 21)');
    assert.equal(await tradeTrigger.locator('svg').evaluate(el => getComputedStyle(el).color), 'rgb(24, 32, 21)');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    await page.screenshot({ path: `/tmp/hive-platform-selection-${theme}-${width}.png`, fullPage: true });
    await tradeTrigger.click();
    const dialog = page.getByRole('dialog', { name: 'Trade agent token' });
    await dialog.waitFor();
    assert.equal(await dialog.getByRole('listitem').count(), 3);
    const expectedUrls = {
      Pons: 'https://www.ponsfamily.com/launchpad/0x2222222222222222222222222222222222222222',
      Bags: 'https://bags.fm/8CrDTtkdDr54LsB9vQi1PZzVNmAA1KHkcts2EAK9W11z',
      'pump.fun': 'https://pump.fun/coin/CmKcjG6tvNy26z5CVd58mgPTs5RPzeJvmjGDvqXxpwLF',
    };
    for (const [platform, url] of Object.entries(expectedUrls)) {
      const trade = dialog.getByRole('link', { name: `Trade on ${platform}`, exact: true });
      assert.equal(await trade.getAttribute('href'), url);
      assert.equal(await trade.getAttribute('rel'), 'noopener noreferrer');
    }
    assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
    const close = dialog.getByRole('button', { name: 'Close trade dialog' });
    await close.focus();
    await page.keyboard.press('Shift+Tab');
    assert.equal(await dialog.getByRole('button', { name: 'Copy pump.fun token address' }).evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Tab');
    assert.equal(await close.evaluate(el => el === document.activeElement), true);
    assert.equal(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
    await dialog.evaluate(async el => { await Promise.all(el.getAnimations().map(animation => animation.finished)); });
    await page.screenshot({ path: `/tmp/hive-trade-dialog-${theme}-${width}.png`, fullPage: true });
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    assert.equal(await tradeTrigger.evaluate(el => el === document.activeElement), true);
    assert.equal(await page.evaluate(() => document.body.style.overflow), '');
    await tradeTrigger.click();
    await close.click();
    await dialog.waitFor({ state: 'detached' });
    assert.equal(await tradeTrigger.evaluate(el => el === document.activeElement), true);
    await next.click();
    await page.getByRole('heading', { name: 'Launch paused' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Retry launch' }).count(), 1);
    await page.getByRole('button', { name: 'Retry launch' }).click();
    assert.equal(await page.getByRole('button', { name: 'Skip this platform' }).count(), 0);
    await page.getByRole('button', { name: 'Check status' }).click();
    const pending = page.getByRole('button', { name: 'Check status' });
    assert.equal(await pending.isDisabled(), true);
    assert.equal(await pending.locator('svg').count(), 1);
    await page.screenshot({ path: `/tmp/hive-platform-progress-${theme}-${width}.png`, fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  }
  await page.setViewportSize({ width: 390, height: 740 });
  for (const variant of ['none', 'single', 'distinct']) {
    await page.goto(`http://127.0.0.1:${server.address().port}/?tokens=${variant}`);
    const trigger = page.getByRole('button', { name: 'Trade', exact: true });
    assert.equal(await trigger.count(), variant === 'none' ? 0 : 1);
    if (variant === 'none') continue;
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Trade agent token' });
    assert.equal(await dialog.getByRole('link').count(), variant === 'single' ? 1 : 3);
    if (variant === 'distinct') assert.match(await dialog.innerText(), /SAGEAI/);
    await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { window.copiedAddress = value; } } }); });
    await dialog.getByRole('button', { name: 'Copy Pons token address' }).click();
    await dialog.getByText('Address copied', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.copiedAddress), '0x2222222222222222222222222222222222222222');
    await page.keyboard.press('Escape');
    await trigger.click();
    assert.equal(await dialog.getByText('Address copied', { exact: true }).count(), 0);
    await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw Error('Denied'); } } }); });
    await dialog.getByRole('button', { name: 'Copy Pons token address' }).click();
    await dialog.getByText('Could not copy address', { exact: true }).waitFor();
    assert.equal(await dialog.getByRole('link', { name: 'Trade on Pons', exact: true }).isVisible(), true);
    await page.mouse.click(2, 2);
    await dialog.waitFor({ state: 'detached' });
    assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
  }
  assert.deepEqual(errors, []);
  console.log('PASS: platform selection, explicit recovery, trade chooser links, focus trap/return, scroll lock, loaders, contrast and overflow in both themes at 320/390/768/1440.');
} finally {
  await browser?.close();
  if (server?.listening) await new Promise(resolve => server.close(resolve));
  await rm(dir, { recursive: true, force: true });
}
