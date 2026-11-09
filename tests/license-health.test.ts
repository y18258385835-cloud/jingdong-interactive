import { describe, expect, it } from 'vitest';
import { LicenseService } from '../server/license-service.js';

describe('license deployment guardrails', () => {
  it('does not report a shared store when the JSON adapter is used', () => {
    const service = new LicenseService({ secret: 'test-secret', adminPassword: 'test-admin-password' });
    expect(service.isSharedStoreConfigured()).toBe(false);
  });
});
