import { describe, expect, it } from 'vitest';
import { withExportTimeout } from '../src/utils/exportAsync';

describe('bounded export waits', () => {
  it('rejects a task that never settles instead of keeping the export UI pending', async () => {
    await expect(withExportTimeout(new Promise<never>(() => undefined), 5, '测试任务'))
      .rejects.toThrow('测试任务超过1秒');
  });

  it('rejects promptly when the export is cancelled', async () => {
    const controller = new AbortController();
    const pending = withExportTimeout(new Promise<never>(() => undefined), 60_000, '测试任务', controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});
