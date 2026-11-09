import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LicenseService, LicenseServiceError } from '../server/license-service.js';

const temporaryDirectories: string[] = [];

function createService() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'aether-license-test-'));
  temporaryDirectories.push(directory);
  return new LicenseService({
    secret: 'test-license-secret',
    adminPassword: 'test-admin-password',
    dataPath: path.join(directory, 'licenses.json'),
    envPath: path.join(directory, '.env'),
    licenseTokenTtlMs: 60_000,
    exportTokenTtlMs: 60_000,
  });
}

afterEach(() => {
  while (temporaryDirectories.length) {
    fs.rmSync(temporaryDirectories.pop()!, { recursive: true, force: true });
  }
});

describe('LicenseService', () => {
  it('provides and persists a validated free experience URL', () => {
    const service = createService();
    expect(service.getFreeExperienceUrl()).toBe('https://www.capcut.cn/');
    expect(service.setFreeExperienceUrl('https://example.com/free-trial')).toEqual(expect.objectContaining({
      url: 'https://example.com/free-trial',
      updatedAt: expect.any(Number),
    }));
    expect(service.getFreeExperienceUrl()).toBe('https://example.com/free-trial');
    const reloaded = new LicenseService({ secret: 'test-license-secret', adminPassword: 'test-admin-password', dataPath: service.dataPath });
    expect(reloaded.getFreeExperienceUrl()).toBe('https://example.com/free-trial');
    expect(() => service.setFreeExperienceUrl('javascript:alert(1)')).toThrow(LicenseServiceError);
    expect(() => service.setFreeExperienceUrl('/relative-path')).toThrow(LicenseServiceError);
    expect(() => service.setFreeExperienceUrl('https://')).toThrow(LicenseServiceError);
  });

  it('provides and persists editable bilingual free experience content', () => {
    const service = createService();
    expect(service.getFreeExperienceConfig()).toMatchObject({ titleZh: '免费体验', buttonEn: 'View Free Trial' });
    const saved = service.setFreeExperienceConfig({
      url: 'https://example.com/trial',
      titleZh: '产品体验', titleEn: 'Product Trial',
      descriptionZh: '查看中文体验说明', descriptionEn: 'Read the trial guide',
      buttonZh: '立即体验', buttonEn: 'Start Trial',
    });
    expect(saved).toMatchObject({ titleZh: '产品体验', titleEn: 'Product Trial', buttonZh: '立即体验', buttonEn: 'Start Trial' });
    const reloaded = new LicenseService({ secret: 'test-license-secret', adminPassword: 'test-admin-password', dataPath: service.dataPath });
    expect(reloaded.getFreeExperienceConfig()).toMatchObject({ url: 'https://example.com/trial', descriptionZh: '查看中文体验说明', descriptionEn: 'Read the trial guide' });
    expect(() => service.setFreeExperienceConfig({ url: 'https://example.com', titleZh: '', titleEn: 'T', descriptionZh: 'D', descriptionEn: 'D', buttonZh: 'B', buttonEn: 'B' })).toThrow(LicenseServiceError);
  });

  it('creates, publishes, filters, and persists bilingual notifications', () => {
    const service = createService();
    const draft = service.createNotification({ titleZh: '版本更新', titleEn: 'Version update', bodyZh: '新增通知中心。', bodyEn: 'Added notifications.' });
    expect(draft.status).toBe('draft');
    expect(service.listPublishedNotifications()).toHaveLength(0);
    service.publishNotification(draft.id);
    expect(service.listPublishedNotifications()).toEqual([expect.objectContaining({ id: draft.id, titleEn: 'Version update' })]);
    service.withdrawNotification(draft.id);
    expect(service.listPublishedNotifications()).toHaveLength(0);
    expect(() => service.createNotification({ titleZh: '', titleEn: 'x', bodyZh: 'x', bodyEn: 'x' })).toThrow(LicenseServiceError);
    const reloaded = new LicenseService({ secret: 'test-license-secret', adminPassword: 'test-admin-password', dataPath: service.dataPath });
    expect(reloaded.listNotifications()).toHaveLength(1);
  });

  it('generates a durable code, binds it to a device, and authorizes export', () => {
    const service = createService();
    const generated = service.generate({ count: 1, plan: 'pro', termCode: 'monthly', durationDays: 30, deviceLimit: 1 });
    expect(generated.codes[0].code).toMatch(/^AETHER-(?:[A-Z0-9]{4}-){3}[A-Z0-9]{4}$/);

    const redeemed = service.redeem({ licenseKey: generated.codes[0].code, deviceId: 'device_primary_1234' });
    expect(redeemed.license.expiresAt).toBeGreaterThan(Date.now());
    const licensePayload = JSON.parse(Buffer.from(redeemed.token.split('.')[0], 'base64url').toString('utf8'));
    expect(licensePayload.exp).toBeLessThanOrEqual(redeemed.license.expiresAt);
    expect(licensePayload.exp).toBeLessThanOrEqual(Date.now() + 60_000 + 100);
    expect(service.verifyLicenseToken(redeemed.token).response.plan).toBe('pro');
    const authorization = service.authorizeExport(redeemed.token, 'zip');
    expect(authorization.exportToken).toContain('.');
    expect(authorization.proof.exportId).toMatch(/^exp_/);
    expect(authorization.proof.signature).toHaveLength(64);
    expect(service.list()[0].exportCount).toBe(1);
    expect(service.data.licenses[0].exportReceipts).toHaveLength(1);

    const reloaded = new LicenseService({ secret: 'test-license-secret', adminPassword: 'test-admin-password', dataPath: service.dataPath });
    expect(reloaded.list()).toHaveLength(1);
    expect(reloaded.list()[0]).not.toHaveProperty('code');
  });

  it('authorizes watermarked free export without a license token', () => {
    const service = createService();
    const authorization = service.authorizeFreeExport('zip', 'device_free_export_1');
    expect(authorization.plan).toBe('free');
    expect(authorization.watermarkRequired).toBe(true);
    expect(authorization.maxResolution).toBe('1080p');
    expect(authorization.exportToken).toContain('.');
    expect(authorization.proof.licenseRef).toMatch(/^free-[a-f0-9]{20}$/);
    expect(authorization.proof.signature).toHaveLength(64);
    // 免费导出不写入卡密账本
    expect(service.list()).toHaveLength(0);
    expect(() => service.authorizeFreeExport('exe', 'device_free_export_1')).toThrow(LicenseServiceError);
  });

  it('allows three free exports per device, then refuses but keeps JSON backup free', () => {
    const service = createService();
    const first = service.authorizeFreeExport('zip', 'device_free_quota_1');
    expect(first.freeExports).toEqual({ used: 1, limit: 3, remaining: 2 });
    service.authorizeFreeExport('single-html', 'device_free_quota_1');
    const third = service.authorizeFreeExport('video', 'device_free_quota_1');
    expect(third.freeExports.remaining).toBe(0);
    expect(() => service.authorizeFreeExport('zip', 'device_free_quota_1')).toThrow(LicenseServiceError);
    // JSON 工程备份不占额度
    expect(service.authorizeFreeExport('json', 'device_free_quota_1').freeExports.used).toBe(3);
    // 其他设备独立计数
    expect(service.freeExportQuota('device_free_quota_2')).toEqual({ used: 0, limit: 3, remaining: 3 });
  });

  it('清空设备 ID 但指纹相同仍然受限', () => {
    const service = createService();
    for (let index = 0; index < 3; index += 1) {
      service.authorizeFreeExport('zip', `device_fp_${index}`, 'same-fingerprint');
    }
    // 换一个 deviceId（等价于清空 localStorage），但指纹不变
    expect(() => service.authorizeFreeExport('zip', 'device_fp_new', 'same-fingerprint')).toThrow(LicenseServiceError);
    // 指纹不同才重新计数
    expect(service.authorizeFreeExport('zip', 'device_fp_other', 'other-fingerprint').freeExports.remaining).toBe(2);
  });

  it('enforces device limits and immediately invalidates a revoked code', () => {
    const service = createService();
    const [{ code, id }] = service.generate({ count: 1, termCode: 'monthly', durationDays: 30, deviceLimit: 1 }).codes;
    const { token } = service.redeem({ licenseKey: code, deviceId: 'device_primary_1234' });
    expect(() => service.redeem({ licenseKey: code, deviceId: 'device_secondary_5678' })).toThrow(LicenseServiceError);
    service.revoke(id);
    expect(() => service.verifyLicenseToken(token)).toThrow(LicenseServiceError);
  });

  it('rotates license tokens and invalidates the previous token for that device', () => {
    const service = createService();
    const [{ code }] = service.generate({ count: 1, termCode: 'monthly', durationDays: 30, deviceLimit: 1 }).codes;
    const { token } = service.redeem({ licenseKey: code, deviceId: 'device_primary_1234' });
    const rotated = service.verifyLicenseToken(token, { rotate: true, deviceId: 'device_primary_1234' });
    expect(rotated.token).toContain('.');
    expect(() => service.verifyLicenseToken(token)).toThrow(LicenseServiceError);
    expect(service.verifyLicenseToken(rotated.token).response.plan).toBe('pro');
    expect(() => service.verifyLicenseToken(rotated.token, { deviceId: 'other-device-1234' })).toThrow(LicenseServiceError);
  });

  it('invalidates the active device token on logout', () => {
    const service = createService();
    const [{ code }] = service.generate({ count: 1, termCode: 'monthly', deviceLimit: 1 }).codes;
    const { token } = service.redeem({ licenseKey: code, deviceId: 'device_primary_1234' });
    expect(service.invalidateToken(token, 'device_primary_1234')).toMatchObject({ deviceHash: expect.any(String) });
    expect(() => service.verifyLicenseToken(token, { deviceId: 'device_primary_1234' })).toThrow(LicenseServiceError);
  });

  it('uses server-defined durations for trial, monthly, quarterly, and yearly terms', () => {
    const service = createService();
    const terms = [
      ['trial_1d', 1],
      ['trial_7d', 7],
      ['monthly', 30],
      ['quarterly', 90],
      ['yearly', 365],
    ];

    for (const [termCode, durationDays] of terms) {
      const generated = service.generate({ count: 1, termCode, durationDays: 999, deviceLimit: 1 });
      expect(generated.codes[0]).toMatchObject({ termCode, durationDays });
    }
    expect(() => service.generate({ count: 1, termCode: 'invalid-term' })).toThrow(LicenseServiceError);
  });

  it('requires the configured administrator password', () => {
    const service = createService();
    expect(() => service.loginAdmin('wrong-password')).toThrow(LicenseServiceError);
    const session = service.loginAdmin('test-admin-password');
    expect(() => service.verifyAdmin(session.token)).not.toThrow();
  });

  it('changes and persists the administrator password while invalidating sessions', () => {
    const service = createService();
    const session = service.loginAdmin('test-admin-password');
    expect(() => service.changeAdminPassword('wrong-password', 'new-admin-password-123')).toThrow(LicenseServiceError);
    expect(service.changeAdminPassword('test-admin-password', 'new-admin-password-123')).toEqual(expect.objectContaining({ changedAt: expect.any(Number) }));
    expect(() => service.verifyAdmin(session.token)).toThrow(LicenseServiceError);
    expect(() => service.loginAdmin('test-admin-password')).toThrow(LicenseServiceError);
    const next = service.loginAdmin('new-admin-password-123');
    expect(() => service.verifyAdmin(next.token)).not.toThrow();
    expect(fs.readFileSync(service.envPath, 'utf8')).toContain('LICENSE_ADMIN_PASSWORD="new-admin-password-123"');
  });

  it('falls back to a direct env write when Windows blocks rename-overwrite', () => {
    const service = createService();
    fs.writeFileSync(service.envPath, 'LICENSE_ADMIN_PASSWORD="test-admin-password"\n');
    const rename = vi.spyOn(fs, 'renameSync').mockImplementationOnce(() => {
      const error = new Error('operation not permitted');
      (error as NodeJS.ErrnoException).code = 'EPERM';
      throw error;
    });
    try {
      service.changeAdminPassword('test-admin-password', 'fallback-password-2026');
      expect(fs.readFileSync(service.envPath, 'utf8')).toContain('LICENSE_ADMIN_PASSWORD="fallback-password-2026"');
      expect(() => service.loginAdmin('fallback-password-2026')).not.toThrow();
    } finally {
      rename.mockRestore();
    }
  });
});
