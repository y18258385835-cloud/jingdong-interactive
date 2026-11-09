import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CLI = path.resolve(__dirname, '..', 'tools', 'aether-cli', 'cli.mjs');

const runCli = (args: string[]) =>
  execFileSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });

const makeProject = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aether-cli-'));
  const file = path.join(dir, 'project.json');
  fs.writeFileSync(file, JSON.stringify({
    meta: { v: 43, title: '测试工程' },
    start: 's1',
    scenes: {
      s1: {
        id: 's1',
        alias: '开场',
        type: 'scene',
        duration: 12,
        els: [
          { id: 't1', type: 'txt', refId: '', x: 10, y: 10, w: 40, h: 10, zIndex: 1, opacity: 100, content: '旧文案' },
          { id: 'i1', type: 'img', refId: 'https://example.com/a.png', x: 0, y: 0, w: 50, h: 50, zIndex: 2, opacity: 100 },
        ],
      },
    },
  }), 'utf8');
  return { dir, file };
};

describe('AETHER CLI', () => {
  it('打印工程概览', () => {
    const { file } = makeProject();
    const out = runCli(['inspect', file, '--json']);
    const summary = JSON.parse(out);
    expect(summary.sceneCount).toBe(1);
    expect(summary.layerCount).toBe(2);
    expect(summary.durationSeconds).toBe(12);
    expect(summary.layerTypes).toEqual({ txt: 1, img: 1 });
  });

  it('校验能发现外链资源并给出警告', () => {
    const { file } = makeProject();
    const out = runCli(['validate', file, '--json']);
    const result = JSON.parse(out);
    expect(result.ok).toBe(true);
    expect(result.externalResources).toHaveLength(1);
    expect(result.warnings.join('\n')).toContain('外链资源');
  });

  it('set-text 只改动目标图层并另存', () => {
    const { dir, file } = makeProject();
    const out = path.join(dir, 'patched.json');
    runCli(['set-text', file, '--layer', 't1', '--text', '新文案', '--out', out]);
    const patched = JSON.parse(fs.readFileSync(out, 'utf8'));
    expect(patched.scenes.s1.els[0].content).toBe('新文案');
    expect(JSON.parse(fs.readFileSync(file, 'utf8')).scenes.s1.els[0].content).toBe('旧文案');
  });

  it('拒绝修改不支持的图层类型', () => {
    const { file } = makeProject();
    expect(() => runCli(['set-text', file, '--layer', 'i1', '--text', 'x'])).toThrow();
  });
});
