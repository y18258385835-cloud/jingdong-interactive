/**
 * AI 3D 模型的受限拆解动效。
 *
 * 编辑器中的模型部件并不适合直接作为不受边界约束的刚体：包围盒会随飞散扩大，
 * 导致下一帧施加更大的力。这里固定以模型初始布局为基准，生成可循环、可预测的
 * 拆解与碰撞回弹，始终限制在模型本身附近。
 */
import * as THREE from 'three';

export interface PhysicsPart {
  mesh: THREE.Mesh;
  originalPos: THREE.Vector3;
  center: THREE.Vector3;
  /** 模型初始世界坐标中的网格原点；所有动效目标均以此坐标计算。 */
  originalWorldPos?: THREE.Vector3;
  /** 结构件在世界坐标中的包围球半径，用于分层时计算安全间隔。 */
  boundsRadius?: number;
  /** 同一产品子组件的多个渲染网格应共享位移，不能在碰撞去重时被拆开。 */
  structuralGroup?: string;
  originalQuaternion?: THREE.Quaternion;
}

export type Ai3dDirection = 'up' | 'down' | 'left' | 'right' | 'front' | 'back' | 'radial';

interface PartMotionLayout {
  direction: THREE.Vector3;
  layerOffset: number;
  phase: number;
}

function directionVector(direction: Ai3dDirection | undefined, fallback: THREE.Vector3): THREE.Vector3 {
  switch (direction) {
    case 'up': return new THREE.Vector3(0, 1, 0);
    case 'down': return new THREE.Vector3(0, -1, 0);
    case 'left': return new THREE.Vector3(-1, 0, 0);
    case 'right': return new THREE.Vector3(1, 0, 0);
    case 'front': return new THREE.Vector3(0, 0, 1);
    case 'back': return new THREE.Vector3(0, 0, -1);
    default: return fallback;
  }
}

export interface PhysicsState {
  elapsed: number;
  /** 动效从静止到目标姿态的渐进量，避免防重叠逻辑把部件瞬间推到终点。 */
  activation: number;
  /** 所有结构件绝对中心的平均点。 */
  origin: THREE.Vector3;
  extent: number;
  minSeparation: number;
  layout: PartMotionLayout[];
}

function createMotionState(parts: PhysicsPart[], model?: THREE.Object3D): PhysicsState {
  // 使用结构件的实际空间中心，而不是 mesh 的局部原点。
  // 多数过程化模型把所有 mesh 放在同一个局部原点，按 originalPos 会变成随机飞散。
  const modelBox = model ? new THREE.Box3().setFromObject(model) : null;
  const origin = modelBox && !modelBox.isEmpty()
    ? modelBox.getCenter(new THREE.Vector3())
    : new THREE.Vector3();
  if (!modelBox || modelBox.isEmpty()) {
    parts.forEach((part) => origin.add(part.center));
    if (parts.length > 0) origin.multiplyScalar(1 / parts.length);
  }

  let positionRadius = 0;
  let geometryExtent = 0;
  let minCenterY = Infinity;
  let maxCenterY = -Infinity;
  parts.forEach((part) => {
    positionRadius = Math.max(positionRadius, part.center.distanceTo(origin));
    minCenterY = Math.min(minCenterY, part.center.y);
    maxCenterY = Math.max(maxCenterY, part.center.y);
    part.mesh.geometry.computeBoundingBox();
    const size = part.mesh.geometry.boundingBox?.getSize(new THREE.Vector3());
    if (size) geometryExtent = Math.max(geometryExtent, size.x, size.y, size.z);
    part.originalQuaternion ??= part.mesh.quaternion.clone();
    part.originalWorldPos ??= part.mesh.getWorldPosition(new THREE.Vector3());
    part.mesh.geometry.computeBoundingSphere();
    const worldScale = part.mesh.getWorldScale(new THREE.Vector3());
    const scaleMax = Math.max(worldScale.x, worldScale.y, worldScale.z);
    part.boundsRadius ??= (part.mesh.geometry.boundingSphere?.radius ?? geometryExtent * 0.5) * scaleMax;
  });

  // 过程化模型的子部件可能都以原点为父节点，仍保留稳定的可见活动范围。
  const modelSize = modelBox && !modelBox.isEmpty() ? modelBox.getSize(new THREE.Vector3()) : null;
  const extent = Math.max(modelSize ? Math.max(modelSize.x, modelSize.y, modelSize.z) : 0, positionRadius * 2, geometryExtent, 0.1);
  const verticalSpan = maxCenterY - minCenterY;
  // 以产品结构组为单位建立稳定层级。优先使用真实 Y 坐标；当过程化模型的
  // 子件都挂在同一原点时，按生成器提供的确定性顺序回退，避免分层按钮无可见效果。
  const groupKey = (part: PhysicsPart, index: number) => part.structuralGroup || `part-${index}`;
  const groups = new Map<string, { center: THREE.Vector3; order: number }>();
  parts.forEach((part, index) => {
    const key = groupKey(part, index);
    if (!groups.has(key)) groups.set(key, { center: part.center.clone(), order: index });
  });
  const orderedGroups = Array.from(groups.entries()).sort(([, first], [, second]) => {
    if (Math.abs(first.center.y - second.center.y) > 0.0001) return first.center.y - second.center.y;
    if (Math.abs(first.center.z - second.center.z) > 0.0001) return first.center.z - second.center.z;
    if (Math.abs(first.center.x - second.center.x) > 0.0001) return first.center.x - second.center.x;
    return first.order - second.order;
  });
  const groupOffsets = new Map<string, number>();
  const groupCount = orderedGroups.length;
  orderedGroups.forEach(([key, entry], index) => {
    const offset = verticalSpan > 0.0001
      ? THREE.MathUtils.clamp((entry.center.y - origin.y) / verticalSpan, -0.5, 0.5)
      : (index - (groupCount - 1) / 2) / Math.max(groupCount - 1, 1) * 0.5;
    groupOffsets.set(key, offset);
  });
  const layout = parts.map((part, partIndex) => {
    const direction = part.center.clone().sub(origin);
    if (direction.lengthSq() < 0.0001) {
      // 重叠的结构件保持在原产品结构内，不再伪造随机方向把它们拆开。
      const key = groupKey(part, partIndex);
      let hash = 0;
      for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) | 0;
      const angle = Math.abs(hash) * 2.399963229728653;
      direction.set(Math.cos(angle), 0.18 * Math.sin(angle), Math.sin(angle)).normalize();
    } else {
      direction.normalize();
    }
    let phaseHash = 0;
    const phaseKey = groupKey(part, partIndex);
    for (let i = 0; i < phaseKey.length; i += 1) phaseHash = (phaseHash * 31 + phaseKey.charCodeAt(i)) | 0;
    return {
      direction,
      // 分层优先遵从产品的真实上下结构，例如盖体、主体、底座。
      layerOffset: groupOffsets.get(groupKey(part, parts.indexOf(part))) ?? 0,
      // Keep each part on its own phase.  A shared phase makes collision look
      // like the whole model is moving as one object instead of colliding parts.
      // Surface labels share one phase so they continue to move as a single
      // structural unit during explode/collision.
      phase: Math.abs(phaseHash) * 0.017,
    };
  });

  // 以部件最大初始尺寸和整个模型初始尺寸共同决定安全间距。
  const minSeparation = Math.max(extent * 0.12, geometryExtent * 0.28);
  return { elapsed: 0, activation: 0, origin, extent, minSeparation, layout };
}

/** 在目标位置层执行固定轮数的去重，保证效果开启时部件中心不会相互重合。 */
function enforceMinimumSeparation(
  targets: THREE.Vector3[],
  layout: PartMotionLayout[],
  minSeparation: number,
  parts: PhysicsPart[]
): void {
  for (let pass = 0; pass < 8; pass += 1) {
    for (let first = 0; first < targets.length; first += 1) {
      for (let second = first + 1; second < targets.length; second += 1) {
        if (parts[first].structuralGroup && parts[first].structuralGroup === parts[second].structuralGroup) continue;
        // targets 是网格原点，比较时换算为结构件的绝对中心，避免局部原点重合
        // 导致错误的碰撞推开或实际包围盒仍然重叠。
        const firstCenter = targets[first].clone().add(
          parts[first].center.clone().sub(parts[first].originalWorldPos ?? parts[first].originalPos),
        );
        const secondCenter = targets[second].clone().add(
          parts[second].center.clone().sub(parts[second].originalWorldPos ?? parts[second].originalPos),
        );
        const delta = firstCenter.sub(secondCenter);
        let distance = delta.length();
        const radiusGap = (parts[first].boundsRadius ?? 0) + (parts[second].boundsRadius ?? 0);
        // 仅在效果充分展开时施加包围球间距；激活初期保持平滑过渡，避免首帧被推开。
        const radiusClearance = minSeparation > 0.05 ? radiusGap * 0.2 : 0;
        const requiredDistance = Math.max(minSeparation, radiusClearance + minSeparation * 0.2);
        if (distance >= requiredDistance) continue;

        if (distance < 0.00001) {
          delta.copy(layout[first].direction).sub(layout[second].direction);
          if (delta.lengthSq() < 0.00001) delta.set(1, 0, 0);
          delta.normalize();
          distance = 0;
        } else {
          delta.multiplyScalar(1 / distance);
        }
        const correction = (requiredDistance - distance) * 0.5;
        targets[first].addScaledVector(delta, correction);
        targets[second].addScaledVector(delta, -correction);
      }
    }
  }
}

function applyPartPose(
  part: PhysicsPart,
  targetPosition: THREE.Vector3,
  targetRotation: THREE.Euler,
  positionLerp: number,
  rotationLerp: number
): void {
  const targetLocal = targetPosition.clone();
  if (part.mesh.parent) {
    part.mesh.parent.updateWorldMatrix(true, false);
    part.mesh.parent.worldToLocal(targetLocal);
  }
  part.mesh.position.lerp(targetLocal, positionLerp);
  const originalQuaternion = part.originalQuaternion ?? part.mesh.quaternion.clone();
  part.originalQuaternion ??= originalQuaternion.clone();
  const targetQuaternion = originalQuaternion.clone().multiply(
    new THREE.Quaternion().setFromEuler(targetRotation)
  );
  part.mesh.quaternion.slerp(targetQuaternion, rotationLerp);
}

/**
 * 每帧更新拆解动画。explode 为受限开合循环；physics 为受限碰撞回弹循环。
 */
export function updateAi3DModel(
  parts: PhysicsPart[],
  model: THREE.Object3D,
  state: {
    layers: number;
    explode: number;
    physics: boolean;
    layerDirection?: Ai3dDirection;
    layerDistance?: number;
    explodeDirection?: Ai3dDirection;
    explodeDistance?: number;
    explodeSpeed?: number;
    explodeSpin?: number;
    collisionDirection?: Ai3dDirection;
    collisionDistance?: number;
    collisionBounce?: number;
    collisionSpeed?: number;
    /** 关闭时固定当前爆炸/碰撞相位，不再继续循环。 */
    loopEnabled?: boolean;
  },
  physicsStateRef: { current: PhysicsState | null },
  deltaTime: number = 1 / 60
): PhysicsState | null {
  if (parts.length === 0) return null;

  let motion = physicsStateRef.current;
  if (!motion || motion.layout.length !== parts.length) {
    motion = createMotionState(parts, model);
    physicsStateRef.current = motion;
  }
  if (state.loopEnabled !== false) {
    motion.elapsed += Math.min(Math.max(deltaTime, 0), 1 / 30);
  }

  const { layers, explode, physics } = state;
  const layerDistance = THREE.MathUtils.clamp(state.layerDistance ?? 1, 0, 2);
  const explodeDistance = THREE.MathUtils.clamp(state.explodeDistance ?? 1, 0, 2);
  const explodeSpeed = THREE.MathUtils.clamp(state.explodeSpeed ?? 1, 0.3, 3);
  const explodeSpin = THREE.MathUtils.clamp(state.explodeSpin ?? 0.5, 0, 1);
  const collisionDistance = THREE.MathUtils.clamp(state.collisionDistance ?? 1, 0, 2);
  const collisionBounce = THREE.MathUtils.clamp(state.collisionBounce ?? 0.5, 0, 1);
  const collisionSpeed = THREE.MathUtils.clamp(state.collisionSpeed ?? 1, 0.3, 3);
  const hasEffect = layers > 0.001 || explode > 0.001 || physics;
  const activationTarget = hasEffect ? 1 : 0;
  motion.activation += (activationTarget - motion.activation) * (1 - Math.exp(-deltaTime * 5.5));
  const positionLerp = 1 - Math.exp(-deltaTime * (hasEffect ? 10 : 12));
  const rotationLerp = 1 - Math.exp(-deltaTime * (hasEffect ? 8 : 12));

  const groupKey = (part: PhysicsPart, index: number) => part.structuralGroup || `part-${index}`;
  const layerAxis = directionVector(state.layerDirection, new THREE.Vector3(0, 1, 0));
  const layerProjections = new Map<string, { value: number; order: number; radius: number }>();
  parts.forEach((part, index) => {
    const key = groupKey(part, index);
    const value = part.center.clone().sub(motion!.origin).dot(layerAxis);
    const radius = part.boundsRadius ?? motion!.extent * 0.12;
    const existing = layerProjections.get(key);
    if (!existing) {
      layerProjections.set(key, { value, order: index, radius });
    } else {
      existing.radius = Math.max(existing.radius, radius);
    }
  });
  const orderedLayerGroups = Array.from(layerProjections.entries()).sort(([, a], [, b]) => a.value - b.value || a.order - b.order);
  // 将每个结构组沿选定的绝对轴线重新排成不重叠的阶梯；整体以模型绝对中心为 0。
  // 目标位置按包围球半径留出间隔，因此盖体、主板、电池等大部件不会互相穿插。
  const layerGap = Math.max(motion!.extent * 0.08, 0.01);
  const totalLayerSpan = orderedLayerGroups.reduce((sum, [, entry]) => sum + entry.radius * 2, 0)
    + Math.max(orderedLayerGroups.length - 1, 0) * layerGap;
  let cursor = -totalLayerSpan * 0.5;
  const layerDisplacements = new Map<string, number>();
  orderedLayerGroups.forEach(([key, entry]) => {
    const desiredCenter = cursor + entry.radius;
    layerDisplacements.set(key, desiredCenter - entry.value);
    cursor = desiredCenter + entry.radius + layerGap;
  });
  const maxLayerOffset = Math.max(...Array.from(layerDisplacements.values()).map((value) => Math.abs(value)), 0.0001);
  const layerOffsetScale = Math.min(1, (motion!.extent * 0.42) / maxLayerOffset);
  const singleGroupOffset = orderedLayerGroups.length === 1 ? motion!.extent * 0.18 : 0;

  const targets: THREE.Vector3[] = [];
  const rotations: THREE.Euler[] = [];
  parts.forEach((part, index) => {
    const layout = motion!.layout[index];
    const target = (part.originalWorldPos ?? part.originalPos).clone();
    let rotation = new THREE.Euler(0, 0, 0);

    // 分层只移动原生结构件，不破坏本应贴合的标签、表面装饰等结构关系。
    if (layers > 0.001) {
      if (state.layerDirection === 'radial') {
        target.addScaledVector(layout.direction, layers * motion!.extent * 0.24 * layerDistance * motion!.activation);
      } else {
        const axis = directionVector(state.layerDirection, new THREE.Vector3(0, 1, 0));
        target.addScaledVector(
          axis,
          ((layerDisplacements.get(groupKey(part, index)) ?? 0) || singleGroupOffset)
            * layerOffsetScale * layers * layerDistance * motion!.activation,
        );
      }
    }

    if (physics) {
      // 物理碰撞：小范围、多相位回弹，不使用会掉出画布的重力刚体。
      const cycleTime = state.loopEnabled === false ? 0 : motion!.elapsed;
      const impact = state.loopEnabled === false ? 1 : 0.5 + 0.5 * Math.sin(cycleTime * 2.4 * collisionSpeed + layout.phase);
      const rebound = state.loopEnabled === false ? 0 : Math.sin(cycleTime * 4.8 * collisionSpeed + layout.phase) * motion!.extent * (0.015 + collisionBounce * 0.05);
      const distance = motion!.extent * (0.12 + impact * (0.18 + collisionBounce * 0.22)) * collisionDistance;
      target.addScaledVector(state.collisionDirection && state.collisionDirection !== 'radial' ? directionVector(state.collisionDirection, layout.direction) : layout.direction, distance);
      target.y += rebound;
      rotation = new THREE.Euler(
        Math.sin(motion!.elapsed * 2.4 * collisionSpeed + layout.phase) * (0.04 + collisionBounce * 0.1),
        Math.cos(motion!.elapsed * 2.1 * collisionSpeed + layout.phase) * (0.05 + collisionBounce * 0.12),
        Math.sin(motion!.elapsed * 2.7 * collisionSpeed + layout.phase) * (0.03 + collisionBounce * 0.07),
      );
    } else if (explode > 0.001) {
      // Explode from the model's absolute bounding-box center.  The motion
      // layout direction is derived from that same origin for every part.
      const cycleTime = state.loopEnabled === false ? 0 : motion!.elapsed;
      const open = state.loopEnabled === false ? 1 : 0.5 + 0.5 * Math.sin(cycleTime * 1.65 * explodeSpeed + layout.phase * 0.2);
      const distance = explode * motion!.extent * (0.22 + open * 0.42) * explodeDistance;
      target.addScaledVector(state.explodeDirection && state.explodeDirection !== 'radial' ? directionVector(state.explodeDirection, layout.direction) : layout.direction, distance);
      rotation = new THREE.Euler(
        Math.sin(motion!.elapsed * 1.65 * explodeSpeed + layout.phase) * explode * explodeSpin * 0.16,
        Math.cos(motion!.elapsed * 1.45 * explodeSpeed + layout.phase) * explode * explodeSpin * 0.2,
        Math.sin(motion!.elapsed * 1.25 * explodeSpeed + layout.phase) * explode * explodeSpin * 0.1,
      );
    }

    targets.push(target);
    rotations.push(rotation);
  });

  // 目标间距留出少量插值余量，使动态回弹时实际姿态仍保持可读间隔。
  // 分层保留原结构相对关系；仅爆炸和碰撞需要避免部件中心重叠。
  const minimumSeparation = motion.minSeparation * motion.activation * 1.06;
  const radialExplode = explode > 0.001 && (!state.explodeDirection || state.explodeDirection === 'radial');
  if ((layers > 0.001 || radialExplode || physics) && minimumSeparation > 0.0001) {
    enforceMinimumSeparation(targets, motion.layout, minimumSeparation, parts);
  }

  parts.forEach((part, index) => {
    applyPartPose(part, targets[index], rotations[index], positionLerp, rotationLerp);
  });

  return motion;
}
