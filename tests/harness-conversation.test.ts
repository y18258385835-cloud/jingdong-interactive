import { describe, expect, it } from 'vitest';
import { appendHarnessReply, assessHarnessRequest, summarizeHarnessBrief } from '../src/core/ai/harnessConversation';

describe('Harness requirement bridge', () => {
  it('asks for the highest-impact missing data decision', () => {
    const assessment = assessHarnessRequest('做一个工业设备监控大屏');
    expect(assessment.question).toContain('数据');
    expect(assessment.suggestions).toEqual(['绑定现有 MQTT 样例', '先使用静态占位数据', '稍后由我手动绑定']);
    expect(assessment.brief.deliverable).toBe('数据监控场景');
  });

  it('turns a clarification reply into a complete brief', () => {
    const prompt = appendHarnessReply('做一个工业设备监控大屏', '绑定现有 MQTT 样例');
    const assessment = assessHarnessRequest(prompt, '主监控场景');
    expect(assessment.question).toBeUndefined();
    expect(assessment.brief.dataStrategy).toContain('MQTT');
    expect(assessment.brief.constraints).toContain('当前工作场景：主监控场景');
    expect(summarizeHarnessBrief(assessment.brief)).toContain('数据监控场景');
  });

  it('asks for asset policy before planning asset-dependent work', () => {
    const assessment = assessHarnessRequest('做一个 3D 产品展示');
    expect(assessment.question).toContain('素材策略');
    expect(assessment.suggestions).toContain('优先使用工程已有素材');
  });
});
