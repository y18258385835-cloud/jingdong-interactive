import { describe, expect, it } from 'vitest';
import { assessHarnessRequest, createLocalHarnessInterview, isLowValueHarnessQuestion, normalizeHarnessInterviewResponse } from '../src/core/ai/harnessConversation';

describe('Harness interview contract', () => {
  it('keeps one question and at most four options', () => {
    const fallback = assessHarnessRequest('build an equipment dashboard');
    const result = normalizeHarnessInterviewResponse({
      question: 'Which data source should be used?',
      options: ['MQTT', 'Static', 'Third', 'Fourth', 'Dropped'],
      brief: { objective: 'equipment dashboard' },
      ready: true,
    }, fallback);
    expect(result.question).toBe('Which data source should be used?');
    expect(result.options).toHaveLength(4);
    expect(result.ready).toBe(false);
    expect(result.brief.deliverable).toBe(fallback.brief.deliverable);
  });

  it('returns ready when local rules find no missing decision', () => {
    const result = createLocalHarnessInterview('build a dashboard with mqtt data');
    expect(result.ready).toBe(true);
    expect(result.question).toBe('');
  });

  it('replaces implementation questions with a product decision', () => {
    const fallback = assessHarnessRequest('生成一个产品发布主视觉');
    const result = normalizeHarnessInterviewResponse({
      question: '是否需要为上传的文件提供缩略图预览功能？',
      options: ['是', '是'],
      brief: fallback.brief,
      ready: false,
    }, fallback);
    expect(isLowValueHarnessQuestion('是否需要为上传的文件提供缩略图预览功能？')).toBe(true);
    expect(result.ready).toBe(true);
    expect(result.question).toBe('');
  });

  it('asks how attached files should influence the work', () => {
    const result = createLocalHarnessInterview('生成一个产品发布主视觉', '主场景', true);
    expect(result.question).toContain('附件');
    expect(result.options).toContain('作为视觉参考，提取布局和风格');
  });
});
