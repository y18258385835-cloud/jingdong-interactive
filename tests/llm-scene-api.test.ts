import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../server/index.js';

describe('LLM scene API guardrails', () => {
  it('validates the connection test payload before making an upstream request', async () => {
    const response = await request(app).post('/api/llm/test').send({ apiKey: '', endpoint: '', model: '' });
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ success: false });
  });

  it('rejects scene generation without a usable prompt', async () => {
    const response = await request(app).post('/api/llm/scene-generate').send({ apiKey: 'test', endpoint: 'https://example.com/v1/chat/completions', model: 'test', prompt: '' });
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ success: false });
  });

  it('validates interview payload before contacting an upstream model', async () => {
    const response = await request(app).post('/api/llm/interview').send({ apiKey: '', endpoint: '', model: '', prompt: '' });
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ success: false });
  });

  it('validates interview payload before contacting an upstream model', async () => {
    const response = await request(app).post('/api/llm/interview').send({ apiKey: '', endpoint: '', model: '', prompt: '' });
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ success: false });
  });

  it('validates background removal input before contacting a provider', async () => {
    const unsupported = await request(app).post('/api/image/remove-background').send({ provider: 'unknown', apiKey: 'test', imageDataUrl: 'data:image/png;base64,AA==' });
    expect(unsupported.status).toBe(400);
    expect(unsupported.body).toMatchObject({ success: false });

    const invalidImage = await request(app).post('/api/image/remove-background').send({ provider: 'remove-bg', apiKey: 'test', imageDataUrl: 'not-an-image' });
    expect(invalidImage.status).toBe(400);
    expect(invalidImage.body).toMatchObject({ success: false });
  });

  it('handles extract-controls gracefully when no endpoint or code is provided', async () => {
    const emptyResponse = await request(app).post('/api/llm/extract-controls').send({});
    expect(emptyResponse.status).toBe(200);
    expect(emptyResponse.body).toEqual({ success: true, controls: [] });
  });

  it('handles extract-controls for UI components when endpoint is absent', async () => {
    const response = await request(app).post('/api/llm/extract-controls').send({
      componentType: 'card-stat',
      componentData: { title: '总产值', value: 98.6 },
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, controls: [] });
  });
});
