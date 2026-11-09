import { describe, expect, it } from 'vitest';
import { createShareStore, SHARE_TOKEN_PATTERN } from '../server/share-store.js';

const tokenFactory = () => {
  let index = 0;
  return () => (++index).toString(16).padStart(24, '0');
};

describe('LAN share store', () => {
  it('publishes a snapshot and serves it by token', () => {
    const store = createShareStore({ now: () => 1_000, createToken: tokenFactory() });
    const result = store.publish('<html>hello</html>', '季度汇报');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.token).toMatch(SHARE_TOKEN_PATTERN);
    expect(result.expiresAt).toBe(1_000 + 2 * 60 * 60 * 1000);

    const item = store.get(result.token);
    expect(item?.html).toBe('<html>hello</html>');
    expect(item?.title).toBe('季度汇报');
    expect(store.size).toBe(1);
  });

  it('rejects empty and oversized snapshots', () => {
    const store = createShareStore({ maxBytes: 5, createToken: tokenFactory() });
    expect(store.publish('   ', '空')).toMatchObject({ ok: false, status: 400 });
    expect(store.publish('123456', '大')).toMatchObject({ ok: false, status: 413 });
    expect(store.size).toBe(0);
  });

  it('expires snapshots and rejects malformed tokens', () => {
    let now = 10_000;
    const store = createShareStore({ ttlMs: 1_000, now: () => now, createToken: tokenFactory() });
    const result = store.publish('<html>soon</html>', '临时');
    if (!result.ok) throw new Error('publish failed');

    expect(store.get('not-a-token')).toBeNull();
    expect(store.get(result.token)?.html).toBe('<html>soon</html>');

    now += 1_001;
    expect(store.get(result.token)).toBeNull();
    expect(store.size).toBe(0);
  });

  it('truncates long titles to 120 characters', () => {
    const store = createShareStore({ createToken: tokenFactory() });
    const result = store.publish('<html />', 'A'.repeat(200));
    if (!result.ok) throw new Error('publish failed');
    expect(store.get(result.token)?.title).toHaveLength(120);
  });

  it('evicts the oldest snapshot when the item cap is reached', () => {
    const store = createShareStore({ maxItems: 2, createToken: tokenFactory() });
    const first = store.publish('<html>1</html>', '1');
    const second = store.publish('<html>2</html>', '2');
    const third = store.publish('<html>3</html>', '3');
    if (!first.ok || !second.ok || !third.ok) throw new Error('publish failed');

    expect(store.size).toBe(2);
    expect(store.get(first.token)).toBeNull();
    expect(store.get(second.token)).not.toBeNull();
    expect(store.get(third.token)).not.toBeNull();
  });

  it('evicts the oldest snapshot when the total byte cap is exceeded', () => {
    const store = createShareStore({ maxTotalBytes: 10, createToken: tokenFactory() });
    const first = store.publish('123456', '1');
    const second = store.publish('123456', '2');
    if (!first.ok || !second.ok) throw new Error('publish failed');

    expect(store.size).toBe(1);
    expect(store.totalBytes).toBe(6);
    expect(store.get(first.token)).toBeNull();
    expect(store.get(second.token)).not.toBeNull();
  });
});
