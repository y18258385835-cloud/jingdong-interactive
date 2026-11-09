import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
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
  // Dismiss the first-use guide when a clean browser profile shows it.
  await page.keyboard.press('Escape');
  const skipGuide = page.getByRole('button', { name: '跳过引导' });
  if (await skipGuide.isVisible().catch(() => false)) {
    await skipGuide.click();
  }
  // The editor opens directly; project management is an explicit toolbar action.
  await page.getByRole('button', { name: '工程管理' }).click();
  await expect(page.getByRole('dialog', { name: '工程管理' })).toBeVisible();
  await page.getByRole('button', { name: '新建空白工程' }).click();
  await page.getByRole('button', { name: '创建工程' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: '工程管理' }).click();
  await expect(page.getByRole('dialog', { name: '工程管理' })).toBeVisible();
});

test('工程管理弹窗限制键盘焦点，Esc 关闭并恢复焦点', async ({ page }) => {
  const dialog = page.getByRole('dialog', { name: '工程管理' });
  const close = page.getByRole('button', { name: '关闭工程管理窗口' });
  await expect(close).toBeFocused();
  await expect(dialog.getByRole('button', { name: /删除工程/ }).first()).toBeVisible();

  for (let index = 0; index < 24; index += 1) {
    await page.keyboard.press('Tab');
    await expect.poll(() => page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: '工程管理' })).toBeFocused();
});

test('画布设置弹窗可键盘操作并能取消，不创建空白工程', async ({ page }) => {
  await page.getByRole('button', { name: '新建空白工程' }).click();
  const dialog = page.getByRole('dialog', { name: '新建空白工程 · 画布设置' });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('button', { name: '关闭画布设置' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: '创建工程' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: '工程管理' })).toBeFocused();
});

test('1440 与 1920 宽屏展开工作台时页面不产生横向溢出', async ({ page }) => {
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '展开面板' }).click();
  for (const size of [{ width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(size);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(size.width);
  }
});

test('工程管理弹窗没有严重或危急 axe 无障碍问题', async ({ page }) => {
  const results = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
  const highImpact = results.violations.filter(({ impact }) => impact === 'critical' || impact === 'serious');
  expect(highImpact, JSON.stringify(highImpact.map(({ id, help, nodes }) => ({ id, help, count: nodes.length })), null, 2)).toEqual([]);

  await page.getByRole('button', { name: '新建空白工程' }).click();
  const canvasResults = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
  const canvasHighImpact = canvasResults.violations.filter(({ impact }) => impact === 'critical' || impact === 'serious');
  expect(canvasHighImpact, JSON.stringify(canvasHighImpact.map(({ id, help, nodes }) => ({ id, help, count: nodes.length })), null, 2)).toEqual([]);
});

test('空白画布可用键盘入口添加文字并保存后刷新', async ({ page }) => {
  await page.getByRole('button', { name: '关闭工程管理窗口' }).click();
  const addText = page.getByRole('button', { name: '添加文字' });
  await expect(addText).toBeVisible();
  await addText.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: '保存工程' })).toBeVisible();
  await page.getByRole('button', { name: '保存工程' }).click();
  await expect(page.getByText('已保存', { exact: true })).toBeVisible({ timeout: 10000 });
  await page.reload();
  // Startup restores the editor directly; project management is opened on demand.
  await page.getByRole('button', { name: '工程管理' }).click();
  const manager = page.getByRole('dialog', { name: '工程管理' });
  await expect(manager.getByRole('heading', { name: '未命名工程' })).toBeVisible();
  await manager.locator('.project-manager-card').first().click();
  await expect(manager).toHaveCount(0);
  await expect(page.getByText('NEW TEXT', { exact: true })).toBeVisible();
});
