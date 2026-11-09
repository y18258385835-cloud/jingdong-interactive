/**
 * 浏览器端代码执行器
 * 执行 AI 生成的 Three.js 过程化代码（ES Module 格式）
 * 用 blob URL + dynamic import 沙箱执行
 */
import * as THREE from 'three';

export interface CodeRunResult {
  group: THREE.Group;
  cleanup: () => void;
}

/**
 * 执行生成的 Three.js 代码，返回 THREE.Group
 * @param code ES Module 格式的 JavaScript 代码，需导出 createModel() 函数
 * @param textureData 可选的纹理图片 base64 数据，会传递给 createModel(textureData)
 * @returns THREE.Group
 */
export async function runThreeJsCode(code: string, textureData?: string): Promise<CodeRunResult> {
  // Three.js CDN 地址（与项目使用的版本一致）
  const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.185.0/build/three.module.js';
  const THREE_EXAMPLES_CDN = 'https://cdn.jsdelivr.net/npm/three@0.185.0/examples/jsm/';

  // 清理代码中的所有 three 相关 import，替换为 CDN URL
  let cleanedCode = code
    // 替换 import * as THREE from 'three'
    .replace(/import\s+\*\s+as\s+THREE\s+from\s+['"]three['"];?/g, `import * as THREE from '${THREE_CDN}';`)
    // 替换命名导入 from 'three'
    .replace(/import\s+\{([^}]+)\}\s+from\s+['"]three['"];?/g, `import {$1} from '${THREE_CDN}';`)
    // 替换 three/examples/jsm/... 导入
    .replace(/from\s+['"]three\/examples\/jsm\/([^'"]+)['"];?/g, `from '${THREE_EXAMPLES_CDN}$1';`)
    // 移除任何剩余的裸 'three' 导入（防御性）
    .replace(/import\s+.*\s+from\s+['"]three['"];?/g, `import * as THREE from '${THREE_CDN}';`);

  // 确保代码开头有 THREE 的导入（如果代码中没有）
  if (!cleanedCode.includes("from 'https://cdn.jsdelivr.net/npm/three")) {
    cleanedCode = `import * as THREE from '${THREE_CDN}';\n${cleanedCode}`;
  }

  const wrappedCode = cleanedCode;

  // 创建 blob URL
  const blob = new Blob([wrappedCode], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);

  try {
    // 动态 import 执行模块
    const module = await import(/* @vite-ignore */ url);

    // 查找 createModel 函数（可能是 default export 或命名 export）
    const createModel = module.createModel || module.default || module.default?.createModel;
    if (!createModel || typeof createModel !== 'function') {
      throw new Error('代码中未找到 createModel() 函数');
    }

    // 执行创建模型（传递纹理数据）
    const group = createModel(textureData);
    if (!group || !(group instanceof THREE.Group || group.isGroup || group.isObject3D)) {
      throw new Error('createModel() 未返回有效的 THREE.Group');
    }

    console.log('[CodeRunner] 模型创建成功, 子对象数:', group.children?.length || 0);

    return {
      group: group as THREE.Group,
      cleanup: () => {
        URL.revokeObjectURL(url);
      },
    };
  } catch (e: any) {
    URL.revokeObjectURL(url);
    console.error('[CodeRunner] 代码执行失败:', e);
    throw new Error(`代码执行失败: ${e.message || e}`);
  }
}

/**
 * 统计模型中的 Mesh 数量（用于部件拆分）
 */
export function countMeshes(group: THREE.Object3D): number {
  let count = 0;
  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) count++;
  });
  return count;
}

/**
 * 获取模型中的所有顶层 Mesh（用于爆炸/分层）
 * 如果模型是 Group 嵌套结构，返回所有叶子 Mesh
 */
export function getModelParts(group: THREE.Object3D): THREE.Mesh[] {
  const parts: THREE.Mesh[] = [];
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      parts.push(mesh);
    }
  });
  return parts;
}
