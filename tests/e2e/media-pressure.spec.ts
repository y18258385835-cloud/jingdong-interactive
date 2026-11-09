import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test.describe.configure({ timeout: 150_000 });

async function openBlankProject(page: Page) {
  await page.goto('/');
  await page.evaluate(async () => {
    const databases = await indexedDB.databases();
    await Promise.all(databases.map((database) => new Promise<void>((resolve) => {
      if (!database.name) return resolve();
      const request = indexedDB.deleteDatabase(database.name);
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    })));
  });
  await page.reload();
  await page.keyboard.press('Escape');
  const skipGuide = page.getByRole('button', { name: '跳过引导' });
  if (await skipGuide.isVisible().catch(() => false)) await skipGuide.click();
  await page.getByRole('button', { name: '工程管理' }).click();
  await expect(page.getByRole('dialog', { name: '工程管理' })).toBeVisible();
  await page.getByRole('button', { name: '新建空白工程' }).click();
  await page.getByRole('button', { name: '创建工程' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test('多视频导入与素材缩略图压力门禁', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await openBlankProject(page);

  const fixture = path.resolve('tmp/original-export-playback-e2e/assets/video/sample-video.mp4');
  expect(fs.existsSync(fixture), `missing video fixture: ${fixture}`).toBe(true);
  const buffer = fs.readFileSync(fixture);
  const input = page.locator('input[aria-label="导入媒体素材"]');
  await expect(input).toHaveCount(1);

  await page.evaluate(() => {
    performance.clearMarks();
    performance.clearMeasures();
  });
  for (const count of [8, 16, 32]) {
    const files = Array.from({ length: count }, (_, index) => ({
      name: `pressure-${count}-${index}.mp4`,
      mimeType: 'video/mp4',
      buffer,
    }));
    await input.setInputFiles(files);
    const videoCountLocator = page.locator('video[data-aether-video]');
    await expect.poll(() => videoCountLocator.count(), { timeout: 20_000, intervals: [250, 500, 1000] }).toBeGreaterThanOrEqual(count);
    const videoCount = await videoCountLocator.count();
    expect(videoCount, `expected at least ${count} canvas videos after import`).toBeGreaterThanOrEqual(count);

    // Exercise real browser media/layout work: scroll the document and hover
    // every visible video thumbnail without starting all decoders at once.
    await page.evaluate(() => {
      document.querySelectorAll<HTMLElement>('[class*="overflow-y-auto"]').forEach((element) => {
        element.scrollTop = element.scrollHeight;
      });
    });
    const thumbnails = page.locator('video[data-aether-asset-thumbnail="true"]');
    const thumbnailCount = await thumbnails.count();
    for (let index = Math.max(0, thumbnailCount - 8); index < thumbnailCount; index += 1) {
      await thumbnails.nth(index).hover({ timeout: 5000 }).catch(() => undefined);
      await page.waitForTimeout(35);
    }
  }

  const metrics = await page.evaluate(() => ({
    longTasks: performance.getEntriesByType('longtask').length,
    memory: 'memory' in performance
      ? (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize || 0
      : 0,
    videos: document.querySelectorAll('video[data-aether-video]').length,
  }));
  expect(pageErrors, pageErrors.join('\n')).toEqual([]);
  // This is a regression tripwire, not a fixed FPS claim. A single import
  // can legitimately perform a few long tasks while media metadata is read.
  expect(metrics.longTasks).toBeLessThan(120);
  expect(metrics.videos).toBeGreaterThanOrEqual(32);
});
