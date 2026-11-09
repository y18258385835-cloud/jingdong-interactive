import React, { useRef, useEffect, useState } from 'react';
import { updateAi3DModel } from './physicsHelper';
import * as THREE from 'three';
import { runThreeJsCode } from '../utils/codeRunner';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SceneElement, Hotspot } from '../types';

/** 热点投影结果：容器内像素坐标 + 是否在相机前方可见 */
export interface HotspotScreenPos {
  x: number;
  y: number;
  visible: boolean;
}

/** 投影函数类型：将热点 3D 坐标投影到屏幕像素坐标 */
export type HotspotProjector = (pos: Hotspot['position']) => HotspotScreenPos | null;

/** 反投影函数类型：将屏幕像素坐标转换为 3D 坐标（用于拖动热点） */
export type HotspotScreenTo3D = (screenX: number, screenY: number) => Hotspot['position'] | null;

export type Ai3DPreviewAction = {
  kind: 'layers' | 'explode' | 'physics';
  token: number;
  /** 当前按钮的开关意图；实际动效会从当前进度连续过渡。 */
  active: boolean;
};

interface ThreeCanvasProps {
  element: SceneElement;
  assetUrl?: string;
  isEditing?: boolean;
  /** 仅作为缩略图/图标渲染时关闭画布事件，避免抢占外层热点交互。 */
  interactive?: boolean;
  /** 是否被选中（选中时才能旋转视角/缩放/添加热点；未选中时仅渲染，不拦截鼠标事件） */
  isSelected?: boolean;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  /** Timeline playback gate for panorama video textures. */
  isPlaying?: boolean;
  /** 非编辑预览中由三个动作按钮触发的 3D 动效。 */
  previewAction?: Ai3DPreviewAction | null;
  fov?: number;
  /** 编辑模式下滚轮缩放 FOV 后回调（防抖），用于同步到元素属性 */
  onFovChange?: (fov: number) => void;
  /** 模型经轨道控制器操作后的可持久化展示姿态 */
  onModelViewChange?: (view: { azimuth: number; elevation: number; distance: number }) => void;
  /** 编辑模式下点击 3D 画面时回调，返回反投影后的 3D 坐标（用于添加热点） */
  onCanvasClick?: (screenX: number, screenY: number, coords: Hotspot['position']) => void;
  /** 通过 ref 向外暴露投影函数（3D 坐标→屏幕像素），供 HotspotOverlay 每帧调用 */
  projectionRef?: React.MutableRefObject<HotspotProjector | null>;
  /** 通过 ref 向外暴露反投影函数（屏幕像素→3D 坐标），供拖动热点时调用 */
  screenTo3DRef?: React.MutableRefObject<HotspotScreenTo3D | null>;
  videoElementRef?: React.MutableRefObject<HTMLVideoElement | null>;
}

/**
 * 统一 WebGL 渲染层：全景图 / 全景视频 / 3D模型 / 高斯泼溅
 * 复用现有 2D div 框架，内部用 Three.js 渲染
 */

/**
 * 收集模型原生结构件。
 *
 * 不按三角面或几何高度人为切片：这样的“分层”无法表达产品结构，还会把标签、
 * 外壳等本应保持关联的部件拆散。只有模型生成器明确给出的 mesh 才作为动效部件。
 */
function getStructuralModelParts(model: THREE.Object3D): { mesh: THREE.Mesh; originalPos: THREE.Vector3; center: THREE.Vector3; structuralGroup?: string }[] {
  const allMeshes: THREE.Mesh[] = [];
  model.updateMatrixWorld(true);
  model.traverse((child) => {
    // img2threejs 的代码可能从独立 Three.js 模块创建 Mesh，instanceof 会失败；
    // 使用 Three.js 的结构标记才能可靠识别并拆分这些模型部件。
    if ((child as THREE.Mesh).isMesh) allMeshes.push(child as THREE.Mesh);
  });
  return allMeshes.map((mesh) => {
    const box = new THREE.Box3().setFromObject(mesh);
    const name = mesh.name.toLowerCase();
    // 标签纸、印刷、贴花通常用多个网格叠加渲染，但物理上属于同一产品子组件。
    // 它们共享动效位移，避免碰撞算法把同一张标签拆成彼此独立的碎片。
    const structuralGroup = /(label|print|decal|sticker)/.test(name) ? 'surface-label' : undefined;
    return { mesh, originalPos: mesh.position.clone(), center: box.getCenter(new THREE.Vector3()), structuralGroup };
  });
}

/** Build effect parts from product-level nodes, with a spatial fallback for flat/generated scenes. */
function getStructuralModelPartsBetter(model: THREE.Object3D): { mesh: THREE.Mesh; originalPos: THREE.Vector3; center: THREE.Vector3; originalWorldPos: THREE.Vector3; boundsRadius: number; structuralGroup: string }[] {
  const meshes: THREE.Mesh[] = [];
  const counts = new Map<THREE.Object3D, number>();
  model.updateMatrixWorld(true);
  model.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) meshes.push(child as THREE.Mesh);
  });
  // 部分 GLB 将多个产品部件合并为一个 Mesh，但仍保留 geometry.groups/materials。
  // 将每个材质组复制为独立子 Mesh，后续分层/爆炸即可按部件移动。
  if (meshes.length === 1) {
    const source = meshes[0];
    const groups = source.geometry?.groups || [];
    const materials = Array.isArray(source.material) ? source.material : [source.material];
    // Some GLB exporters flatten the whole product into one mesh without
    // material groups. Split its triangles into spatially independent chunks
    // so explode/collision still has visible parts to move.
    const splitGroups = groups.length > 1
      ? groups
      : (() => {
        const position = source.geometry.getAttribute('position');
        const indexAttr = source.geometry.getIndex();
        const itemCount = indexAttr ? indexAttr.count : position?.count || 0;
        const triangleCount = Math.floor(itemCount / 3);
        const chunkCount = Math.min(8, Math.max(2, Math.ceil(triangleCount / 160)));
        const chunkSize = Math.max(3, Math.ceil(triangleCount / chunkCount) * 3);
        return Array.from({ length: Math.ceil(itemCount / chunkSize) }, (_, index) => ({
          start: index * chunkSize,
          count: Math.min(chunkSize, itemCount - index * chunkSize),
          materialIndex: 0,
        }));
      })();
    if (splitGroups.length > 1) {
      const parent = source.parent || model;
      const splitMeshes: THREE.Mesh[] = [];
      splitGroups.forEach((group, index) => {
        const geometry = source.geometry.clone();
        geometry.clearGroups();
        geometry.addGroup(group.start, group.count, 0);
        const part = new THREE.Mesh(geometry, materials[group.materialIndex] || materials[0]);
        part.name = `${source.name || 'mesh'}_part_${index + 1}`;
        part.position.copy(source.position);
        part.quaternion.copy(source.quaternion);
        part.scale.copy(source.scale);
        part.castShadow = source.castShadow;
        part.receiveShadow = source.receiveShadow;
        const position = source.geometry.getAttribute('position');
        const indexAttr = source.geometry.getIndex();
        const localBox = new THREE.Box3();
        for (let cursor = group.start; cursor < group.start + group.count; cursor += 1) {
          const vertexIndex = indexAttr ? indexAttr.getX(cursor) : cursor;
          if (vertexIndex < position.count) localBox.expandByPoint(new THREE.Vector3().fromBufferAttribute(position, vertexIndex));
        }
        parent.add(part);
        part.updateMatrixWorld(true);
        part.userData.__effectCenter = localBox.getCenter(new THREE.Vector3()).applyMatrix4(part.matrixWorld);
        part.userData.__effectGroup = `part:${index}`;
        splitMeshes.push(part);
      });
      source.visible = false;
      meshes.splice(0, 1, ...splitMeshes);
    }
  }
  meshes.forEach((mesh) => {
    let node: THREE.Object3D | null = mesh.parent;
    while (node && node !== model) {
      counts.set(node, (counts.get(node) || 0) + 1);
      node = node.parent;
    }
  });
  const modelBox = new THREE.Box3().setFromObject(model);
  const modelSize = modelBox.getSize(new THREE.Vector3());
  const extent = Math.max(modelSize.x, modelSize.y, modelSize.z, 0.1);
  const semantic = /(body|shell|housing|case|cover|base|top|bottom|assembly|component|wheel|button|screen|handle|label|print|decal|sticker)/i;
  return meshes.map((mesh) => {
    const box = new THREE.Box3().setFromObject(mesh);
    const center = (mesh.userData.__effectCenter as THREE.Vector3 | undefined)?.clone() || box.getCenter(new THREE.Vector3());
    let node: THREE.Object3D | null = mesh.parent;
    let groupNode: THREE.Object3D | null = null;
    while (node && node !== model) {
      if (semantic.test(node.name || '') || (counts.get(node) || 0) > 1) {
        groupNode = node;
        break;
      }
      node = node.parent;
    }
    mesh.geometry.computeBoundingSphere();
    const worldScale = mesh.getWorldScale(new THREE.Vector3());
    const radius = (mesh.geometry.boundingSphere?.radius || extent * 0.04) * Math.max(worldScale.x, worldScale.y, worldScale.z);
    const fallbackGroup = `spatial:${Math.round(((center.y - modelBox.min.y) / extent) * 6)}`;
    return {
      mesh,
      originalPos: mesh.position.clone(),
      center,
      originalWorldPos: mesh.getWorldPosition(new THREE.Vector3()),
      boundsRadius: radius,
      structuralGroup: mesh.userData.__effectGroup || (groupNode ? `node:${groupNode.uuid}` : fallbackGroup),
    };
  });
}

export const ThreeCanvas: React.FC<ThreeCanvasProps> = ({
  element,
  assetUrl,
  isEditing = false,
  interactive = true,
  isSelected = false,
  autoRotate = false,
  autoRotateSpeed = 1,
  isPlaying = false,
  previewAction = null,
  fov = 75,
  onFovChange,
  onModelViewChange,
  onCanvasClick,
  projectionRef,
  screenTo3DRef,
  videoElementRef,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loadError, setLoadError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // FOV 变化防抖定时器（编辑模式下滚轮缩放后同步到元素属性）
  const fovDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modelViewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Three.js 引用（用 ref 保持跨渲染周期）
  const threeRef = useRef<{
    renderer?: THREE.WebGLRenderer;
    scene?: THREE.Scene;
    camera?: THREE.PerspectiveCamera;
    mesh?: THREE.Mesh;
    texture?: THREE.Texture;
    videoEl?: HTMLVideoElement;
    model?: THREE.Group;
    modelParts?: { mesh: THREE.Mesh; originalPos: THREE.Vector3; center: THREE.Vector3; originalWorldPos?: THREE.Vector3; boundsRadius?: number; structuralGroup?: string; }[];
    physicsWorld?: any;
    physicsBodies?: any[];
    physicsEnabled?: boolean;
    animId?: number;
    theta: number;   // 水平旋转角
    phi: number;     // 垂直旋转角
    radius: number;
    targetTheta: number;
    targetPhi: number;
    isDragging: boolean;
    lastX: number;
    lastY: number;
    // 惯性效果（720yun式拖拽松开后惯性减速）
    velocityTheta: number;  // 水平旋转速度（弧度/帧）
    velocityPhi: number;    // 垂直旋转速度（弧度/帧）
    hasInertia: boolean;    // 是否正在惯性运动
    resizeObserver?: ResizeObserver;
    orbitControls?: OrbitControls;
    fittedModelDistance?: number;
    splatViewer?: any;
    splatContainer?: HTMLDivElement;
  }>({
    theta: 0,
    phi: 0,
    radius: 0,
    targetTheta: 0,
    targetPhi: 0,
    isDragging: false,
    lastX: 0,
    lastY: 0,
    velocityTheta: 0,
    velocityPhi: 0,
    hasInertia: false,
  });

  const type = element.type;

  // 初始化只执行一次的渲染循环必须读取实时参数，不能捕获首次渲染的旧值。
  const autoRotateRef = useRef({ enabled: autoRotate, speed: autoRotateSpeed });
  autoRotateRef.current = { enabled: autoRotate, speed: autoRotateSpeed };
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const previewActionRef = useRef<{ kind: Ai3DPreviewAction['kind'] | null; token: number; active: boolean; progress: number }>({
    kind: null,
    token: 0,
    active: false,
    progress: 0,
  });

  // 初始化 Three.js 的 effect 只运行一次，使用 ref 读取最新交互状态与回调。
  const needsRenderRef = useRef<number>(10);
  const isLoopActiveRef = useRef<boolean>(false);
  const startRenderLoopRef = useRef<() => void>(() => {});
  const requestRender = (frames = 6) => {
    needsRenderRef.current = Math.max(needsRenderRef.current, frames);
    if (!isLoopActiveRef.current && threeRef.current.renderer) {
      isLoopActiveRef.current = true;
      startRenderLoopRef.current();
    }
  };

  const isEditingRef = useRef(isEditing);
  const isSelectedRef = useRef(isSelected);
  const onModelViewChangeRef = useRef(onModelViewChange);
  isEditingRef.current = isEditing;
  isSelectedRef.current = isSelected;
  onModelViewChangeRef.current = onModelViewChange;

  // 回调 ref 镜像：让 pointer 监听器（空/少依赖）始终调用最新回调，避免监听器反复重注册
  // AI 3D 控制参数（分层/爆炸/碰撞）的实时引用，供 animate 循环读取
  const ai3dStateRef = useRef<{
    layers: number;
    explode: number;
    physics: boolean;
    layerDirection?: SceneElement['ai3dLayerDirection'];
    layerDistance?: number;
    explodeDirection?: SceneElement['ai3dExplodeDirection'];
    explodeDistance?: number;
    explodeSpeed?: number;
    explodeSpin?: number;
    collisionDirection?: SceneElement['ai3dCollisionDirection'];
    collisionDistance?: number;
    collisionBounce?: number;
    collisionSpeed?: number;
    loopEnabled?: boolean;
  }>({ layers: 0, explode: 0, physics: false });
  // 物理世界状态引用（null | 'initing' | PhysicsState）
  const physicsStateRef = useRef<any>(null);
  if (previewAction && previewAction.token !== previewActionRef.current.token) {
    const previous = previewActionRef.current;
    const isSameAction = previous.kind === previewAction.kind;
    previewActionRef.current = {
      kind: previewAction.kind,
      token: previewAction.token,
      active: previewAction.active,
      progress: isSameAction ? previous.progress : 0,
    };
    if (!isSameAction) physicsStateRef.current = null;
  } else if (!isEditing && !previewAction && previewActionRef.current.kind) {
    previewActionRef.current = { kind: null, token: 0, active: false, progress: 0 };
    physicsStateRef.current = null;
  }
  // 动画循环只读取 ref；在渲染期间同步最新参数，不创建会受热更新影响的依赖数组。
  ai3dStateRef.current = {
    layers: element.ai3dLayers || 0,
    explode: element.ai3dExplode || 0,
    physics: element.ai3dPhysics || false,
    layerDirection: element.ai3dLayerDirection,
    layerDistance: element.ai3dLayerDistance,
    explodeDirection: element.ai3dExplodeDirection,
    explodeDistance: element.ai3dExplodeDistance,
    explodeSpeed: element.ai3dExplodeSpeed,
    explodeSpin: element.ai3dExplodeSpin,
    collisionDirection: element.ai3dCollisionDirection,
    collisionDistance: element.ai3dCollisionDistance,
    collisionBounce: element.ai3dCollisionBounce,
    collisionSpeed: element.ai3dCollisionSpeed,
    loopEnabled: element.ai3dLoopEnabled !== false,
  };

  const onCanvasClickRef = useRef(onCanvasClick);
  onCanvasClickRef.current = onCanvasClick;

  const applySavedModelView = (distance: number, azimuth: number, elevation: number) => {
    const t = threeRef.current;
    if (!t.camera || !t.orbitControls) return;
    const theta = THREE.MathUtils.degToRad(azimuth);
    const phi = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(elevation, -85, 85));
    t.orbitControls.target.set(0, 0, 0);
    t.camera.position.set(
      distance * Math.sin(theta) * Math.cos(phi),
      distance * Math.sin(phi),
      distance * Math.cos(theta) * Math.cos(phi)
    );
    t.camera.lookAt(0, 0, 0);
    t.orbitControls.update();
  };

  // 安全获取容器尺寸（避免布局未完成时为 0 导致相机 aspect=NaN）
  const getContainerSize = () => {
    const c = containerRef.current;
    const cv = canvasRef.current;
    // 优先用 canvas 的 clientWidth（canvas 有 width:100%，能正确反映父元素尺寸）
    let w = cv?.clientWidth || c?.clientWidth || c?.offsetWidth || 0;
    let h = cv?.clientHeight || c?.clientHeight || c?.offsetHeight || 0;
    // 如果都为 0，用 getBoundingClientRect（排除 CSS transform 影响）
    if (w === 0 || h === 0) {
      const rect = c?.getBoundingClientRect();
      if (rect && rect.width > 0 && rect.height > 0) {
        w = rect.width;
        h = rect.height;
      }
    }
    return { w: Math.max(1, w || 300), h: Math.max(1, h || 150) };
  };

  // —— 热点坐标转换：屏幕像素 ↔ 3D 空间 ——

  /** 将屏幕坐标（相对于视口）反投影为 3D 空间坐标（用于添加热点） */
  const screenTo3D = (screenX: number, screenY: number): Hotspot['position'] | null => {
    const t = threeRef.current;
    const container = containerRef.current;
    if (!t.camera || !container) return null;
    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const ndc = new THREE.Vector2(
      ((screenX - rect.left) / rect.width) * 2 - 1,
      -((screenY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, t.camera);

    // 全景图/全景视频：球面内表面（半径 500，相机在球心）
    if (type === 'panorama-img' || type === 'panorama-vid') {
      const sphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 500);
      const hit = new THREE.Vector3();
      if (raycaster.ray.intersectSphere(sphere, hit)) {
        const theta = Math.atan2(hit.x, hit.z);
        const phi = Math.asin(Math.max(-1, Math.min(1, hit.y / 500)));
        return { coordType: 'spherical', theta, phi };
      }
      return null;
    }

    // 3D模型：射线求交模型表面
    if (type === 'model-3d' && t.model) {
      const intersects = raycaster.intersectObject(t.model, true);
      if (intersects.length > 0) {
        const p = intersects[0].point;
        return { coordType: 'cartesian', x: p.x, y: p.y, z: p.z };
      }
      // 未命中模型：退化为模型前方 1 单位处的点
      const dir = raycaster.ray.direction.clone().normalize();
      const p = raycaster.ray.origin.clone().add(dir.multiplyScalar(3));
      return { coordType: 'cartesian', x: p.x, y: p.y, z: p.z };
    }

    // 高斯泼溅：无网格，用虚拟球面近似（半径 3，相机围绕中心点旋转）
    if (type === 'gaussian-splat') {
      const sphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 3);
      const hit = new THREE.Vector3();
      if (raycaster.ray.intersectSphere(sphere, hit)) {
        const theta = Math.atan2(hit.x, hit.z);
        const phi = Math.asin(Math.max(-1, Math.min(1, hit.y / 3)));
        return { coordType: 'spherical', theta, phi };
      }
      return null;
    }

    return null;
  };

  /** 将 3D 空间坐标投影为容器内像素坐标（供 HotspotOverlay 每帧调用） */
  const projectToScreen: HotspotProjector = (pos) => {
    const t = threeRef.current;
    const container = containerRef.current;
    if (!t.camera || !container) return null;
    // 关键：用 CSS 大小（clientWidth）而非 getBoundingClientRect()（显示大小）。
    // 因为 CanvasViewport 的 stage 父容器可能有 transform: scale() 缩放（1920x1080 → 显示大小），
    // HotspotOverlay 的绝对定位在 CSS 坐标系中，必须用未缩放的 CSS 尺寸计算。
    const w = container.clientWidth || container.offsetWidth || 0;
    const h = container.clientHeight || container.offsetHeight || 0;
    if (w === 0 || h === 0) return null;

    let vec: THREE.Vector3;
    if (pos.coordType === 'spherical') {
      const theta = pos.theta ?? 0;
      const phi = pos.phi ?? 0;
      // 全景图半径 500，高斯泼溅近似半径 3
      const r = type === 'gaussian-splat' ? 3 : 500;
      vec = new THREE.Vector3(
        Math.sin(theta) * Math.cos(phi) * r,
        Math.sin(phi) * r,
        Math.cos(theta) * Math.cos(phi) * r
      );
    } else {
      vec = new THREE.Vector3(pos.x ?? 0, pos.y ?? 0, pos.z ?? 0);
    }

    // 3D 模型热点不是简单的 DOM 置顶层：先从相机向热点坐标发射射线，
    // 若模型表面在热点之前命中，则认为热点被模型遮挡。
    let occluded = false;
    if (type === 'model-3d' && t.model && pos.coordType === 'cartesian') {
      t.model.updateMatrixWorld(true);
      const origin = t.camera.position.clone();
      const toPoint = vec.clone().sub(origin);
      const pointDistance = toPoint.length();
      if (pointDistance > 0.001) {
        const raycaster = new THREE.Raycaster(origin, toPoint.normalize());
        const hit = raycaster.intersectObject(t.model, true).find((item) => item.object.visible);
        // 允许少量浮点误差，否则贴在模型表面的热点会被自己的三角面隐藏。
        occluded = !!hit && hit.distance < pointDistance - Math.max(0.015, pointDistance * 0.002);
      }
    }

    vec.project(t.camera);
    const x = (vec.x * 0.5 + 0.5) * w;
    const y = (-vec.y * 0.5 + 0.5) * h;
    // z < 1 表示在相机视锥内（前方可见）；z >= 1 表示在相机后方
    const visible = vec.z < 1 && vec.z > -1 && !occluded;
    return { x, y, visible };
  };

  // 初始化 Three.js 场景（延迟到布局完成后）
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const canvas = canvasRef.current;
    const t = threeRef.current;
    let disposed = false;
    let handleContextLost: ((e: Event) => void) | undefined;
    let handleContextRestored: (() => void) | undefined;

    const init = () => {
      if (disposed || !canvasRef.current || !containerRef.current) return;

      const { w, h } = getContainerSize();

      // 创建渲染器
      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(w, h, false);
      t.renderer = renderer;

      // 场景
      const scene = new THREE.Scene();
      t.scene = scene;

      // 相机
      const camera = new THREE.PerspectiveCamera(fov, w / h, 0.1, 5000);
      camera.position.set(0, 0, 0); // 全景图：相机在球心
      t.camera = camera;

      // 环境光（3D模型用）
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
      scene.add(ambientLight);
      const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
      dirLight.position.set(5, 10, 7);
      scene.add(dirLight);

      // 3D模型：使用 OrbitControls 轨道控制（围绕模型中心旋转），替代VR全景式球坐标控制
      if (type === 'model-3d') {
        const controls = new OrbitControls(camera, canvas);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.minDistance = 0.5;
        controls.maxDistance = 500;
        controls.target.set(0, 0, 0);
        controls.enablePan = true;
        const persistModelView = () => {
          t.isDragging = false;
          if (!isEditingRef.current || !isSelectedRef.current || !onModelViewChangeRef.current) return;
          if (modelViewDebounceRef.current) clearTimeout(modelViewDebounceRef.current);
          modelViewDebounceRef.current = setTimeout(() => {
            const offset = camera.position.clone().sub(controls.target);
            const distance = offset.length();
            if (distance < 0.001) return;
            onModelViewChangeRef.current?.({
              azimuth: THREE.MathUtils.radToDeg(Math.atan2(offset.x, offset.z)),
              elevation: THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(offset.y / distance, -1, 1))),
              distance,
            });
          }, 220);
        };
        controls.addEventListener('start', () => { t.isDragging = true; requestRender(6); });
        controls.addEventListener('change', () => { requestRender(4); });
        controls.addEventListener('end', persistModelView);
        t.orbitControls = controls;
      }

      // 帧率无关动画：记录上一帧时间
      let lastFrameTime = performance.now();
      // 渲染循环（raf + setTimeout 双后备，确保后台标签页也能渲染）
      const animate = () => {
        if (disposed) {
          isLoopActiveRef.current = false;
          return;
        }

        // 仅在存在动态交互或动效时维持 60FPS；画面静止时在补全缓冲帧后休眠，减少 90%+ 无谓 GPU 开销
        const rotationConfig = autoRotateRef.current;
        const isAutoRotating = rotationConfig.enabled && !t.isDragging;
        const isUserDragging = t.isDragging;
        const isDecelerating = t.hasInertia;
        const isInterpolating = Math.abs(t.targetTheta - t.theta) > 0.0001 || Math.abs(t.targetPhi - t.phi) > 0.0001;
        const isVideoPlaying = Boolean(t.videoEl && isPlayingRef.current && !t.videoEl.paused);
        const isPreviewActionRunning = Boolean(previewActionRef.current.kind);
        const isContinuousActive = isAutoRotating || isUserDragging || isDecelerating || isInterpolating || isVideoPlaying || isPreviewActionRunning;

        if (isContinuousActive) {
          needsRenderRef.current = 6;
        } else if (needsRenderRef.current > 0) {
          needsRenderRef.current -= 1;
        }

        if (!isContinuousActive && needsRenderRef.current <= 0) {
          isLoopActiveRef.current = false;
          t.animId = undefined;
          return;
        }
        // 优先用 requestAnimationFrame，后台标签页用 setTimeout 后备
        // 计算帧率无关的 deltaTime（秒）
        const now = performance.now();
        const deltaTime = Math.min((now - lastFrameTime) / 1000, 1 / 30);
        lastFrameTime = now;
        if (typeof requestAnimationFrame === 'function' && !document.hidden) {
          t.animId = requestAnimationFrame(animate);
        } else {
          t.animId = setTimeout(animate, 16) as unknown as number;
        }

        // 自动检测尺寸变化并更新（处理布局延迟、窗口 resize 等）
        // 注意：domElement.width 是 drawing buffer 尺寸（已乘 pixelRatio），需与 CSS 像素尺寸换算后比较
        if (canvasRef.current && t.renderer && t.camera) {
          const cw = canvasRef.current.clientWidth;
          const ch = canvasRef.current.clientHeight;
          if (cw > 0 && ch > 0) {
            const pixelRatio = t.renderer.getPixelRatio();
            const expectedBufferW = Math.floor(cw * pixelRatio);
            const expectedBufferH = Math.floor(ch * pixelRatio);
            if (t.renderer.domElement.width !== expectedBufferW || t.renderer.domElement.height !== expectedBufferH) {
              t.renderer.setSize(cw, ch, false);
              t.camera.aspect = cw / ch;
              t.camera.updateProjectionMatrix();
            }
          }
        }

        // 平滑插值旋转
        // 3D模型：OrbitControls 轨道控制（围绕模型中心旋转）

        if (type === 'model-3d' && t.orbitControls) {
          t.orbitControls.autoRotate = rotationConfig.enabled && !t.isDragging;
          t.orbitControls.autoRotateSpeed = rotationConfig.speed * 2;
          t.orbitControls.update();
        } else {
        t.theta += (t.targetTheta - t.theta) * 0.1;
        t.phi += (t.targetPhi - t.phi) * 0.1;

        // 惯性运动（720yun式拖拽松开后惯性减速）
        if (t.hasInertia && !t.isDragging) {
          t.targetTheta += t.velocityTheta;
          t.targetPhi += t.velocityPhi;
          t.targetPhi = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, t.targetPhi));
          // 指数衰减：每帧保留 94% 的速度，约 0.5-1 秒后停止
          t.velocityTheta *= 0.94;
          t.velocityPhi *= 0.94;
          // 速度足够小时停止惯性
          if (Math.abs(t.velocityTheta) < 0.0001 && Math.abs(t.velocityPhi) < 0.0001) {
            t.hasInertia = false;
            t.velocityTheta = 0;
            t.velocityPhi = 0;
          }
        }

        // 自动旋转（惯性运动结束后才开始，避免冲突）
        if (rotationConfig.enabled && !t.isDragging && !t.hasInertia) {
          t.targetTheta += rotationConfig.speed * 0.005;
        }

        // 限制垂直角度
        const phiClamped = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, t.phi));

        // 更新相机朝向（球坐标方向向量）
        if (t.camera) {
          const lookX = Math.sin(t.theta) * Math.cos(phiClamped);
          const lookY = Math.sin(phiClamped);
          const lookZ = Math.cos(t.theta) * Math.cos(phiClamped);
          t.camera.lookAt(
            t.camera.position.x + lookX,
            t.camera.position.y + lookY,
            t.camera.position.z + lookZ
          );
        }

        }
        // 视频纹理更新
        if (t.videoEl && t.texture && t.videoEl.readyState >= 2) {
          t.texture.needsUpdate = true;
        }

        // 模型自动旋转
        if (t.model && rotationConfig.enabled && !t.isDragging && type !== 'model-3d') {
          t.model.rotation.y += rotationConfig.speed * 0.01 * deltaTime * 60;
        }

        // AI 3D 模型分层/爆炸/物理碰撞效果
        if (t.model && t.modelParts && t.modelParts.length > 0) {
          const baseState = ai3dStateRef.current;
          let effectState = baseState;
          const action = previewActionRef.current;
          if (!isEditingRef.current) {
            if (!action.kind) {
              effectState = { ...baseState, layers: 0, explode: 0, physics: false };
            } else {
              const step = Math.min(deltaTime / 0.7, 0.08);
              action.progress = action.active
                ? Math.min(1, action.progress + step)
                : Math.max(0, action.progress - step);
              const easeOut = 1 - Math.pow(1 - action.progress, 3);
              effectState = {
                ...baseState,
                layers: action.kind === 'layers' ? Math.max(baseState.layers, 0.7) * easeOut : 0,
                explode: action.kind === 'explode' ? Math.max(baseState.explode, 0.65) * easeOut : 0,
                physics: action.kind === 'physics' && action.active && action.progress > 0.001,
              };
            }
          }
          updateAi3DModel(t.modelParts, t.model, effectState, physicsStateRef, deltaTime);
        }
        renderer.render(scene, camera);
      };
      startRenderLoopRef.current = () => {
        if (disposed || !t.renderer || !t.camera || !t.scene) return;
        lastFrameTime = performance.now();
        if (typeof requestAnimationFrame === 'function' && !document.hidden) {
          t.animId = requestAnimationFrame(animate);
        } else {
          t.animId = setTimeout(animate, 16) as unknown as number;
        }
      };
      isLoopActiveRef.current = true;
      animate();

      handleContextLost = (e: Event) => {
        e.preventDefault();
        console.warn('[ThreeCanvas] WebGL 上下文丢失:', element.id);
        isLoopActiveRef.current = false;
        if (t.animId) {
          cancelAnimationFrame(t.animId);
          clearTimeout(t.animId as unknown as number);
          t.animId = undefined;
        }
      };
      handleContextRestored = () => {
        console.info('[ThreeCanvas] WebGL 上下文已恢复:', element.id);
        requestRender(10);
      };
      canvas.addEventListener('webglcontextlost', handleContextLost, false);
      canvas.addEventListener('webglcontextrestored', handleContextRestored, false);

      // 尺寸监听
      const resizeObserver = new ResizeObserver(() => {
        if (disposed || !t.renderer || !t.camera) return;
        const { w: rw, h: rh } = getContainerSize();
        t.renderer.setSize(rw, rh, false);
        t.camera.aspect = rw / rh;
        t.camera.updateProjectionMatrix();
        requestRender(6);
      });
      resizeObserver.observe(container);
      t.resizeObserver = resizeObserver;

      // 额外确保：再等一帧后强制更新尺寸（处理布局延迟）
      requestAnimationFrame(() => {
        if (disposed || !t.renderer || !t.camera) return;
        const { w: rw, h: rh } = getContainerSize();
        t.renderer.setSize(rw, rh, false);
        t.camera.aspect = rw / rh;
        t.camera.updateProjectionMatrix();
        requestRender(6);
      });

      // 标记初始化完成，触发素材加载
      setIsReady(true);
    };

    // 直接初始化（渲染循环中会自动检测并更新尺寸）
    init();

    // 清理
    return () => {
      disposed = true;
      if (t.animId) {
        cancelAnimationFrame(t.animId);
        clearTimeout(t.animId as unknown as number);
      }
      t.resizeObserver?.disconnect();
      if (modelViewDebounceRef.current) clearTimeout(modelViewDebounceRef.current);
      t.orbitControls?.dispose();
      if (handleContextLost) canvas.removeEventListener('webglcontextlost', handleContextLost);
      if (handleContextRestored) canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      disposeResources();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 释放 Three.js 资源
  const disposeResources = () => {
    const t = threeRef.current;
    if (t.mesh) {
      t.mesh.geometry?.dispose();
      const mat = t.mesh.material as THREE.Material | THREE.Material[];
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
      t.mesh = undefined;
    }
    if (t.texture) {
      t.texture.dispose();
      t.texture = undefined;
    }
    if (t.model) {
      t.model.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          const mat = obj.material as THREE.Material | THREE.Material[];
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat?.dispose();
        }
      });
      t.model = undefined;
      t.modelParts = undefined;
      physicsStateRef.current = null;
    }
    if (t.videoEl) {
      t.videoEl.pause();
      t.videoEl.src = '';
      t.videoEl = undefined;
      if (videoElementRef) videoElementRef.current = null;
    }
    if (t.renderer) {
      t.renderer.dispose();
      t.renderer = undefined;
    }
    // 清理高斯泼溅 Viewer
    if (t.splatViewer) {
      try { t.splatViewer.dispose(); } catch (e) { /* ignore */ }
      t.splatViewer = undefined;
    }
    if (t.splatContainer) {
      t.splatContainer.remove();
      t.splatContainer = undefined;
    }
    if (canvasRef.current) canvasRef.current.style.display = '';
    t.scene = undefined;
    t.camera = undefined;
  };

  // 加载素材（全景图/全景视频/3D模型/高斯泼溅）
  useEffect(() => {
    if ((!assetUrl && !element.ai3dCode) || !isReady || !threeRef.current.scene) return;

    const t = threeRef.current;
    setIsLoading(true);
    setLoadError('');
    // 动效布局以每一份模型自己的初始位置和尺寸为基准，不能跨模型复用。
    t.modelParts = undefined;
    physicsStateRef.current = null;

    // 清理旧资源
    if (t.mesh) {
      t.scene?.remove(t.mesh);
      t.mesh.geometry?.dispose();
      const mat = t.mesh.material as THREE.Material | THREE.Material[];
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
      t.mesh = undefined;
    }
    if (t.texture) {
      t.texture.dispose();
      t.texture = undefined;
    }
    if (t.videoEl) {
      t.videoEl.pause();
      t.videoEl.src = '';
      t.videoEl = undefined;
      if (videoElementRef) videoElementRef.current = null;
    }
    if (t.model) {
      t.scene?.remove(t.model);
      t.model.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          const mat = obj.material as THREE.Material | THREE.Material[];
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat?.dispose();
        }
      });
      t.model = undefined;
    }
    // 清理高斯泼溅 Viewer（素材变化时）
    if (t.splatViewer) {
      try { t.splatViewer.dispose(); } catch (e) { /* ignore */ }
      t.splatViewer = undefined;
    }
    if (t.splatContainer) {
      t.splatContainer.remove();
      t.splatContainer = undefined;
    }
    if (canvasRef.current) canvasRef.current.style.display = '';

    if (type === 'panorama-img') {
      // 全景图：球体内表面 + 纹理
      const loader = new THREE.TextureLoader();
      loader.load(
        assetUrl,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          // 关键：SphereGeometry 默认 UV 中 +Z(相机正前方) 对应纹理 u=0.25，
          // 偏移 0.25 使纹理中心(u=0.5)对齐正前方，确保热点球面坐标与全景内容精确锚定
          texture.wrapS = THREE.RepeatWrapping;
          texture.offset.x = 0.25;
          t.texture = texture;

          const geometry = new THREE.SphereGeometry(500, 64, 32);
          const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide });
          const mesh = new THREE.Mesh(geometry, material);
          t.mesh = mesh;
          t.scene?.add(mesh);
          setIsLoading(false);
        },
        undefined,
        (err) => {
          console.error('全景图加载失败:', err);
          setLoadError('全景图加载失败');
          setIsLoading(false);
        }
      );
    } else if (type === 'panorama-vid') {
      // 全景视频：球体内表面 + VideoTexture
      const video = document.createElement('video');
      video.src = assetUrl;
      video.crossOrigin = 'anonymous';
      video.loop = true;
      video.muted = element.muted === true;
      video.playsInline = true;
      video.autoplay = false;
      t.videoEl = video;
      if (videoElementRef) videoElementRef.current = video;

      const texture = new THREE.VideoTexture(video);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.offset.x = 0.25; // 同全景图：纹理中心对齐正前方
      t.texture = texture;

      const geometry = new THREE.SphereGeometry(500, 64, 32);
      const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide });
      const mesh = new THREE.Mesh(geometry, material);
      t.mesh = mesh;
      t.scene?.add(mesh);

      if (isPlayingRef.current) video.play().catch(() => {});
      setIsLoading(false);
    } else if (type === 'model-3d') {
      // 3D模型：支持两种模式 - Seed3D GLB / img2threejs 过程化代码
      (async () => {
        try {
          let model: THREE.Group;
          const isCodeModel = !!element.ai3dCode;

          if (isCodeModel) {
            // img2threejs 代码生成的模型：执行代码创建 THREE.Group
            console.log('[ThreeCanvas] 加载代码生成的模型 (img2threejs)...');
            const result = await runThreeJsCode(element.ai3dCode!, element.ai3dTexture);
            model = result.group;
          } else {
            // Seed3D GLB 模型：用 GLTFLoader 加载
            console.log('[ThreeCanvas] 加载 GLB 模型 (Seed3D)...');
            const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
            const loader = new GLTFLoader();
            const gltf = await new Promise<any>((resolve, reject) => {
              loader.load(assetUrl, resolve, undefined, reject);
            });
            model = gltf.scene;
          }

          // 先应用模型缩放，再采样绝对中心，确保动效基准与最终显示姿态一致。
          model.scale.setScalar(element.modelScale ?? 1);

          // 计算包围盒，调整模型位置和相机距离
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);

          // 将模型居中
          model.position.sub(center);

          // 调整相机距离（基于模型最大尺寸）
          const fovRad = (fov * Math.PI) / 180;
          const fittedDistance = (maxDim / 2) / Math.tan(fovRad / 2) * 1.5;
          t.fittedModelDistance = fittedDistance;
          const distance = element.modelCameraDistance && element.modelCameraDistance > 0
            ? element.modelCameraDistance
            : fittedDistance;
          applySavedModelView(
            distance,
            element.modelViewAzimuth ?? 0,
            element.modelViewElevation ?? 0
          );

          // 调整光照强度
          const ambient = t.scene?.children.find((c) => c instanceof THREE.AmbientLight) as THREE.AmbientLight;
          if (ambient) ambient.intensity = 1.0;
          const dir = t.scene?.children.find((c) => c instanceof THREE.DirectionalLight) as THREE.DirectionalLight;
          if (dir) {
            dir.intensity = 0.8;
            dir.position.set(fittedDistance, fittedDistance * 0.8, fittedDistance);
          }

          // 初始化 AI 3D 模型部件
          let parts: { mesh: THREE.Mesh; originalPos: THREE.Vector3; center: THREE.Vector3; originalWorldPos?: THREE.Vector3; boundsRadius?: number; structuralGroup?: string }[];
          parts = getStructuralModelPartsBetter(model);
          console.log('[ThreeCanvas] 产品结构部件数:', parts.length, parts.map((p, i) => i + ':' + p.mesh.name).join(', '));
          t.modelParts = parts;
          t.model = model;
          t.scene?.add(model);
          setIsLoading(false);
        } catch (e: any) {
          console.error('[ThreeCanvas] 3D模型加载失败:', e);
          setLoadError('3D模型加载失败: ' + (e?.message || '未知错误'));
          setIsLoading(false);
        }
      })();
    } else if (type === 'gaussian-splat') {
      // 高斯泼溅：使用 @mkkellogg/gaussian-splats-3d 库的 Viewer
      (async () => {
        try {
          const GaussianSplats3D = await import('@mkkellogg/gaussian-splats-3d');

          // 隐藏默认 canvas，创建独立容器
          if (canvasRef.current) canvasRef.current.style.display = 'none';

          const splatContainer = document.createElement('div');
          splatContainer.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
          containerRef.current?.appendChild(splatContainer);
          t.splatContainer = splatContainer;

          const viewer = new GaussianSplats3D.Viewer({
            rootElement: splatContainer,
            cameraUp: [0, -1, 0],
            initialCameraPosition: [0, 1, -3],
            initialCameraLookAt: [0, 0, 0],
            sharedMemoryForWorkers: false,
            useBuiltInControls: isEditing,
          });
          t.splatViewer = viewer;

          // 根据原始文件名判断格式（blob URL 不包含扩展名）
          const sourceName = (element?.sourceName || '').toLowerCase();
          const isPly = sourceName.endsWith('.ply') || assetUrl.toLowerCase().endsWith('.ply');
          if (isPly) {
            await viewer.addSplatScene(assetUrl, {
              splatAlphaRemovalThreshold: 5,
              showLoadingUI: false,
              progressiveLoad: true,
            });
          } else {
            await viewer.addSplatScene(assetUrl, {
              showLoadingUI: false,
              progressiveLoad: true,
            });
          }

          setIsLoading(false);
        } catch (e) {
          console.error('高斯泼溅加载失败:', e);
          setLoadError('高斯泼溅加载失败');
          setIsLoading(false);
          if (canvasRef.current) canvasRef.current.style.display = '';
        }
      })();
    }

    return () => {
      // 素材变化时的清理在下次加载开头处理
    };
  }, [assetUrl, type, isReady]);

  // Keep the off-DOM panorama video texture aligned with the timeline transport.
  useEffect(() => {
    const video = threeRef.current.videoEl;
    if (!video) return;
    if (isPlaying) void video.play().catch(() => {});
    else video.pause();
  }, [isPlaying]);

  useEffect(() => {
    const video = threeRef.current.videoEl;
    if (!video || type !== 'panorama-vid') return;
    video.muted = element.muted === true;
  }, [element.muted, isReady, type]);

  // 右侧属性面板和画布浮层的展示参数应立即生效，无须重新加载模型。
  useEffect(() => {
    if (type !== 'model-3d') return;
    const t = threeRef.current;
    if (t.model) t.model.scale.setScalar(element.modelScale ?? 1);
    const distance = element.modelCameraDistance && element.modelCameraDistance > 0
      ? element.modelCameraDistance
      : t.fittedModelDistance;
    if (distance) {
      applySavedModelView(
        distance,
        element.modelViewAzimuth ?? 0,
        element.modelViewElevation ?? 0
      );
    }
  }, [
    type,
    element.modelCameraDistance,
    element.modelScale,
    element.modelViewAzimuth,
    element.modelViewElevation,
  ]);

  // 交互：拖动旋转 + 滚轮缩放
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const t = threeRef.current;

    // 编辑模式下区分点击（添加热点）与拖动（旋转视角）的阈值
    const CLICK_THRESHOLD = 6; // 像素
    let pointerStartX = 0;
    let pointerStartY = 0;
    let pointerMoved = false;

    const onPointerDown = (e: PointerEvent) => {
      // 编辑模式下：仅选中时才接收交互（旋转/添加热点）；未选中时事件冒泡到父元素用于选中
  if (type === 'model-3d' && t.orbitControls) return; // 3D模型由 OrbitControls 接管
      if (isEditing && !isSelected) return;
      pointerStartX = e.clientX;
      pointerStartY = e.clientY;
      pointerMoved = false;
      t.isDragging = true;
      t.hasInertia = false;  // 开始新拖拽时清除旧惯性
      t.velocityTheta = 0;
      t.velocityPhi = 0;
      t.lastX = e.clientX;
      t.lastY = e.clientY;
      try { container.setPointerCapture(e.pointerId); } catch {}
      requestRender(6);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (isEditing && !isSelected) return;
  if (type === 'model-3d' && t.orbitControls) return;
      if (!t.isDragging) return;
      const dx = e.clientX - t.lastX;
      const dy = e.clientY - t.lastY;
      t.lastX = e.clientX;
      t.lastY = e.clientY;

      // 检测是否超过点击阈值（区分单击与拖动）
      if (!pointerMoved) {
        const totalDx = e.clientX - pointerStartX;
        const totalDy = e.clientY - pointerStartY;
        if (Math.sqrt(totalDx * totalDx + totalDy * totalDy) > CLICK_THRESHOLD) {
          pointerMoved = true;
        }
      }

      // 旋转视角：演示模式始终旋转；编辑模式仅在超过拖动阈值后旋转
      if (!isEditing || pointerMoved) {
        const deltaTheta = -dx * 0.005;
        const deltaPhi = dy * 0.005;
        t.targetTheta += deltaTheta;
        t.targetPhi += deltaPhi;
        t.targetPhi = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, t.targetPhi));
        // 记录惯性速度（指数移动平均，平滑最后几帧的速度）
        t.velocityTheta = t.velocityTheta * 0.7 + deltaTheta * 0.3;
        t.velocityPhi = t.velocityPhi * 0.7 + deltaPhi * 0.3;
        requestRender(6);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (isEditing && !isSelected) return;
  if (type === 'model-3d' && t.orbitControls) return;
      t.isDragging = false;
      try { container.releasePointerCapture(e.pointerId); } catch {}
      // 启动惯性：如果最后几帧的平均速度足够大，拖拽松开后继续惯性减速
      const speed = Math.sqrt(t.velocityTheta * t.velocityTheta + t.velocityPhi * t.velocityPhi);
      if (speed > 0.001) {
        t.hasInertia = true;
      } else {
        t.velocityTheta = 0;
        t.velocityPhi = 0;
      }
      // 注意：单击不再添加热点，改为双击添加（见 onDblClick）
    };

    // 双击添加热点（编辑模式且选中时）
    const onDblClick = (e: MouseEvent) => {
      if (!isEditing || !isSelected) return;
      const coords = screenTo3D(e.clientX, e.clientY);
      if (coords && onCanvasClickRef.current) {
        onCanvasClickRef.current(e.clientX, e.clientY, coords);
      }
    };

    const onWheel = (e: WheelEvent) => {
      // 编辑模式下：仅选中时才缩放 FOV；未选中时不拦截滚轮事件
  if (type === 'model-3d' && t.orbitControls) return;
      if (isEditing && !isSelected) return;
      e.preventDefault();
      if (t.camera) {
        const newFov = Math.max(30, Math.min(120, t.camera.fov + e.deltaY * 0.05));
        t.camera.fov = newFov;
        t.camera.updateProjectionMatrix();
        requestRender(6);
        // 编辑模式下：防抖同步 FOV 到元素属性（避免每次滚轮都触发 setState）
        if (isEditing && onFovChange) {
          if (fovDebounceRef.current) clearTimeout(fovDebounceRef.current);
          fovDebounceRef.current = setTimeout(() => {
            onFovChange(Math.round(newFov * 10) / 10);
          }, 300);
        }
      }
    };

    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);
    container.addEventListener('pointercancel', onPointerUp);
    container.addEventListener('dblclick', onDblClick);
    container.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('pointercancel', onPointerUp);
      container.removeEventListener('dblclick', onDblClick);
      container.removeEventListener('wheel', onWheel);
    };
  }, [isEditing, isSelected]);

  // FOV 变化
  useEffect(() => {
    if (threeRef.current.camera) {
      threeRef.current.camera.fov = fov;
      threeRef.current.camera.updateProjectionMatrix();
    }
  }, [fov]);

  // 当配置参数、素材加载完成或交互状态变更时唤醒按需渲染
  useEffect(() => {
    requestRender(10);
  }, [autoRotate, autoRotateSpeed, isPlaying, previewAction, isReady, element.visible]);

  // 向父组件暴露投影函数（3D 坐标→屏幕像素），供 HotspotOverlay 每帧调用
  useEffect(() => {
    if (!projectionRef) return;
    if (isReady && threeRef.current.camera) {
      projectionRef.current = projectToScreen;
    } else {
      projectionRef.current = null;
    }
    return () => {
      if (projectionRef) projectionRef.current = null;
    };
  }, [isReady, projectionRef]);

  // 向父组件暴露反投影函数（屏幕像素→3D 坐标），供拖动热点时调用
  useEffect(() => {
    if (!screenTo3DRef) return;
    if (isReady && threeRef.current.camera) {
      screenTo3DRef.current = screenTo3D;
    } else {
      screenTo3DRef.current = null;
    }
    return () => {
      if (screenTo3DRef) screenTo3DRef.current = null;
    };
  }, [isReady, screenTo3DRef]);

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{
        position: 'absolute',
        inset: 0,
        touchAction: 'none',
        // 关键：未选中时 pointer-events: none，不拦截鼠标事件（事件冒泡到父元素用于选中）；
        // 选中时才接收交互事件（旋转视角/缩放/添加热点）。
        pointerEvents: interactive ? (isSelected || !isEditing ? 'auto' : 'none') : 'none',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: 'block', position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-sm">
          加载中...
        </div>
      )}
      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-red-400 text-sm">
          {loadError}
        </div>
      )}
      {!assetUrl && !element.ai3dCode && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-xs border border-dashed border-white/20">
          未添加素材
        </div>
      )}
      {!isEditing && assetUrl && (
        <div className="absolute bottom-2 left-2 text-white/60 text-[10px] bg-black/40 px-2 py-0.5 rounded pointer-events-none">
          拖动旋转 · 滚轮缩放
        </div>
      )}
    </div>
  );
};
