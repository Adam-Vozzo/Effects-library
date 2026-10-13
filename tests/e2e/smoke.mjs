// End-to-end smoke test (headless Chromium):
//  1. builds every effect in the harness and fails on any shader/registration error,
//  2. drives the editor: adds layers, tweaks a param, undoes, exports PNG/JPG and checks the downloads.
// Usage: npm run test:e2e   (starts its own Vite dev server)
// Env: CHROMIUM_PATH to use a specific browser binary; HEADED=1 to watch.
import { spawn } from 'node:child_process';
import { mkdtempSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT || 5199);
const base = `http://localhost:${PORT}`;
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, E2E: '1' },
});
let failures = 0;
const fail = (msg) => {
  failures++;
  console.error('FAIL', msg);
};

async function waitForServer() {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(base + '/');
      if (r.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Vite did not start');
}

try {
  await waitForServer();
  const browser = await chromium.launch({
    headless: !process.env.HEADED,
    executablePath: process.env.CHROMIUM_PATH || undefined,
    // Software GL so the test runs on machines without a GPU.
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });

  // 1. Every effect compiles and renders.
  {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${base}/harness.html?all=1&size=200`);
    await page.waitForFunction(() => window.__done === true, null, { timeout: 600_000 });
    const harnessErrors = await page.evaluate(() => window.__errors);
    const count = await page.locator('.cell').count();
    console.log(`harness: rendered ${count} effects`);
    for (const e of [...harnessErrors, ...errors]) fail(e.split('\n')[0]);
    if (count < 70) fail(`expected at least 70 effects, got ${count}`);
    await page.close();
  }

  // 2. Editor flow + exports.
  {
    const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => fail('pageerror: ' + e.message));
    await page.goto(base + '/');
    await page.waitForFunction(() => window.__app?.renderer.hasSource, null, { timeout: 30_000 });
    await page.locator('.card', { hasText: 'Duotone' }).first().click();
    await page.locator('.card', { hasText: 'Gaussian blur' }).first().click();
    const n = await page.evaluate(() => window.__app.store.state.project.layers.length);
    if (n !== 2) fail(`expected 2 layers, got ${n}`);
    await page.keyboard.press('Control+z');
    const n2 = await page.evaluate(() => window.__app.store.state.project.layers.length);
    if (n2 !== 1) fail(`undo: expected 1 layer, got ${n2}`);

    // Blend modes preview on hover / arrow keys without touching the project or its history.
    {
      const sig = () =>
        page.evaluate(() => {
          const t = document.createElement('canvas');
          t.width = t.height = 16;
          const x = t.getContext('2d');
          x.drawImage(document.querySelector('.stage__canvas'), 0, 0, 16, 16);
          return Array.from(x.getImageData(0, 0, 16, 16).data);
        });
      const diff = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0);
      const until = async (pred) => {
        for (let i = 0; i < 150; i++) {
          if (await pred()) return true;
          await page.waitForTimeout(100);
        }
        return false;
      };
      const state = () =>
        page.evaluate(() => {
          const st = window.__app.store;
          return { blend: st.state.project.layers[0].blend, preview: st.state.preview, history: st.undoStack.length };
        });
      const base = await sig();
      const before = await state();
      const group = page.locator('.param-group--layer');
      await group.locator('summary').click();
      await group.locator('.dropdown').click();
      await page.locator('.menu .menu__item', { hasText: 'Difference' }).hover();
      if (!(await until(async () => diff(await sig(), base) > 2000))) fail('blend hover: canvas did not change');
      let st = await state();
      if (st.blend !== 'normal' || st.preview?.blend !== 'difference' || st.history !== before.history) fail(`blend hover changed the project: ${JSON.stringify(st)}`);
      await page.mouse.move(4, 4);
      if (!(await until(async () => diff(await sig(), base) < 200))) fail('blend hover: leaving the menu did not restore the canvas');
      // Focus followed the pointer, so the arrow key continues from Difference.
      await page.keyboard.press('ArrowDown');
      st = await state();
      if (st.preview?.blend !== 'exclusion') fail(`blend arrow key: expected an exclusion preview, got ${JSON.stringify(st.preview)}`);
      await page.locator('.menu .menu__item', { hasText: 'Screen' }).click();
      st = await state();
      if (st.blend !== 'screen' || st.preview !== null || st.history !== before.history + 1) fail(`blend pick: ${JSON.stringify(st)}`);
      await page.keyboard.press('Control+z');
      st = await state();
      if (st.blend !== 'normal') fail(`blend undo: expected normal, got ${st.blend}`);
      console.log('blend preview: hover, arrow keys, pick and undo OK');
    }
    const dir = mkdtempSync(join(tmpdir(), 'fx-export-'));
    for (const [fmt, label] of [
      ['PNG', 'png'],
      ['JPG', 'jpg'],
    ]) {
      await page.locator('.toolbar__export').click();
      await page.locator('.export .switcher__item', { hasText: fmt }).click();
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 120_000 }), page.locator('.export .button--primary').click()]);
      const file = join(dir, dl.suggestedFilename());
      await dl.saveAs(file);
      const size = statSync(file).size;
      console.log(`export ${label}: ${dl.suggestedFilename()} ${(size / 1024).toFixed(0)} KB`);
      if (!file.endsWith('.' + label) || size < 10_000) fail(`bad ${label} export`);
    }
    await ctx.close();
  }
  await browser.close();
} catch (e) {
  fail(e.stack || String(e));
} finally {
  vite.kill();
}
if (failures) {
  console.error(`${failures} failure(s)`);
  process.exit(1);
}
console.log('e2e smoke: OK');
