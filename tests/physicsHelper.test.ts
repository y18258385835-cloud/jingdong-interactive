import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { type PhysicsPart, type PhysicsState, updateAi3DModel } from '../src/components/physicsHelper';

function createParts(): PhysicsPart[] {
  return Array.from({ length: 5 }, () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1), new THREE.MeshBasicMaterial());
    return { mesh, originalPos: mesh.position.clone(), center: new THREE.Vector3() };
  });
}

function expectMinimumSeparation(parts: PhysicsPart[], minSeparation: number) {
  for (let first = 0; first < parts.length; first += 1) {
    for (let second = first + 1; second < parts.length; second += 1) {
      expect(parts[first].mesh.position.distanceTo(parts[second].mesh.position)).toBeGreaterThanOrEqual(minSeparation * 0.99);
    }
  }
}

describe('AI 3D 受限拆解动效', () => {
  it('爆炸循环不会随着帧数扩大到模型范围之外', () => {
    const parts = createParts();
    const motionRef: { current: PhysicsState | null } = { current: null };

    for (let frame = 0; frame < 720; frame += 1) {
      updateAi3DModel(parts, new THREE.Group(), { layers: 0, explode: 1, physics: false }, motionRef, 1 / 60);
    }

    const extent = motionRef.current!.extent;
    parts.forEach((part) => {
      expect(part.mesh.position.distanceTo(part.originalPos)).toBeLessThanOrEqual(extent * 0.8);
    });
    expectMinimumSeparation(parts, motionRef.current!.minSeparation);
  });

  it('物理碰撞保持小范围循环回弹，关闭后回到初始姿态', () => {
    const parts = createParts();
    const motionRef: { current: PhysicsState | null } = { current: null };

    for (let frame = 0; frame < 360; frame += 1) {
      updateAi3DModel(parts, new THREE.Group(), { layers: 0, explode: 0, physics: true }, motionRef, 1 / 60);
    }
    const extent = motionRef.current!.extent;
    parts.forEach((part) => {
      expect(part.mesh.position.distanceTo(part.originalPos)).toBeLessThanOrEqual(extent * 0.8);
    });
    expectMinimumSeparation(parts, motionRef.current!.minSeparation);

    for (let frame = 0; frame < 180; frame += 1) {
      updateAi3DModel(parts, new THREE.Group(), { layers: 0, explode: 0, physics: false }, motionRef, 1 / 60);
    }
    parts.forEach((part) => {
      expect(part.mesh.position.distanceTo(part.originalPos)).toBeLessThan(0.001);
      expect(part.mesh.quaternion.angleTo(part.originalQuaternion!)).toBeLessThan(0.001);
    });
  });

  it('方向与距离参数会影响拆解目标', () => {
    const leftParts = createParts();
    const shortParts = createParts();
    const leftRef: { current: PhysicsState | null } = { current: null };
    const shortRef: { current: PhysicsState | null } = { current: null };

    for (let frame = 0; frame < 120; frame += 1) {
      updateAi3DModel(leftParts, new THREE.Group(), {
        layers: 0, explode: 1, physics: false, explodeDirection: 'left', explodeDistance: 1,
      }, leftRef, 1 / 60);
      updateAi3DModel(shortParts, new THREE.Group(), {
        layers: 0, explode: 1, physics: false, explodeDirection: 'left', explodeDistance: 0,
      }, shortRef, 1 / 60);
    }

    expect(leftParts[0].mesh.position.x).toBeLessThan(shortParts[0].mesh.position.x);
  });

  it('关闭循环动画后固定当前相位，重新开启后继续推进', () => {
    const parts = createParts();
    const motionRef: { current: PhysicsState | null } = { current: null };
    const activeState = { layers: 0, explode: 1, physics: false, loopEnabled: true } as const;

    for (let frame = 0; frame < 60; frame += 1) {
      updateAi3DModel(parts, new THREE.Group(), activeState, motionRef, 1 / 60);
    }
    const elapsedBeforePause = motionRef.current!.elapsed;

    for (let frame = 0; frame < 120; frame += 1) {
      updateAi3DModel(parts, new THREE.Group(), { ...activeState, loopEnabled: false }, motionRef, 1 / 60);
    }
    expect(motionRef.current!.elapsed).toBe(elapsedBeforePause);

    updateAi3DModel(parts, new THREE.Group(), activeState, motionRef, 1 / 60);
    expect(motionRef.current!.elapsed).toBeGreaterThan(elapsedBeforePause);
  });

  it('分层从当前姿态渐进展开，而非首帧跳到最终间距', () => {
    const parts = createParts();
    parts.forEach((part, index) => part.center.set(0, (index - 2) * 0.8, 0));
    const motionRef: { current: PhysicsState | null } = { current: null };

    updateAi3DModel(parts, new THREE.Group(), { layers: 1, explode: 0, physics: false }, motionRef, 1 / 60);
    const firstFrameDistance = parts[0].mesh.position.distanceTo(parts[1].mesh.position);
    expect(motionRef.current!.activation).toBeLessThan(0.1);
    expect(firstFrameDistance).toBeLessThan(motionRef.current!.minSeparation * 0.2);

    for (let frame = 0; frame < 180; frame += 1) {
      updateAi3DModel(parts, new THREE.Group(), { layers: 1, explode: 0, physics: false }, motionRef, 1 / 60);
    }
    expect(parts[0].mesh.position.distanceTo(parts[1].mesh.position)).toBeGreaterThan(firstFrameDistance);
  });

  it('同一产品子组件的表面网格不会被爆炸效果强行拆开', () => {
    const parts = createParts().slice(0, 2);
    parts.forEach((part) => {
      part.structuralGroup = 'surface-label';
      part.center.set(0, 0, 0);
    });
    const motionRef: { current: PhysicsState | null } = { current: null };

    for (let frame = 0; frame < 180; frame += 1) {
      updateAi3DModel(parts, new THREE.Group(), { layers: 0, explode: 1, physics: false }, motionRef, 1 / 60);
    }

    expect(parts[0].mesh.position.distanceTo(parts[1].mesh.position)).toBeLessThan(0.0001);
  });

  it('结构件中心重合时分层仍按稳定结构顺序展开', () => {
    const parts = createParts().slice(0, 3);
    const motionRef: { current: PhysicsState | null } = { current: null };

    for (let frame = 0; frame < 180; frame += 1) {
      updateAi3DModel(parts, new THREE.Group(), { layers: 1, explode: 0, physics: false }, motionRef, 1 / 60);
    }

    const yPositions = parts.map((part) => part.mesh.position.y);
    expect(Math.max(...yPositions) - Math.min(...yPositions)).toBeGreaterThan(0.05);
  });
});
