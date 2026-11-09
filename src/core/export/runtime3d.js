/**
 * AETHER 导出运行时（3D 模型增强版）
 * 支持 model-3d 元素渲染、分层/爆炸/物理碰撞效果
 * 从 CDN 加载 Three.js + GLTFLoader + cannon-es
 */
(function () {
  'use strict';

  var CDN_THREE = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js';
  var CDN_GLTF = 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/js/loaders/GLTFLoader.js';
  var CDN_ORBIT = 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/js/controls/OrbitControls.js';
  var CDN_CANNON = 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js';

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('加载失败: ' + src)); };
      document.head.appendChild(s);
    });
  }

  function dataURLtoBlob(dataURL) {
    var arr = dataURL.split(',');
    var mime = arr[0].match(/:(.*?);/)[1];
    var bstr = atob(arr[1]);
    var n = bstr.length;
    var u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], { type: mime });
  }

  var AetherRuntime = (function () {
    function AetherRuntime(options) {
      this.container = options.container;
      this.canvas = options.canvas;
      this.project = options.project || {};
      this.assets = options.assets || {};
      this.config = options.config || {};
      this.scenes = this.project.scenes || this.project.pages || [];
      this.currentSceneIndex = 0;
      this.playing = false;
      this.startTime = 0;
      this.pausedTime = 0;
      this.models = [];
      this.physicsWorld = null;
      this.physicsBodies = [];
      this.physicsState = null; // null | 'initing' | 'ready'
      this.THREE = null;
      this.CANNON = null;
      this.scene = null;
      this.camera = null;
      this.renderer = null;
      this.controls = null;
      this.clock = null;
      this._animating = false;
    }

    AetherRuntime.prototype.init = async function () {
      var self = this;
      // 加载依赖库
      await loadScript(CDN_THREE);
      self.THREE = window.THREE;
      await loadScript(CDN_GLTF);
      await loadScript(CDN_ORBIT);
      try { await loadScript(CDN_CANNON); self.CANNON = window.CANNON_ES || window.CANNON; } catch (e) { console.warn('cannon-es 加载失败，物理效果不可用', e); }

      var THREE = self.THREE;
      // 初始化 Three.js
      self.scene = new THREE.Scene();
      self.scene.background = new THREE.Color(0x0a0a0f);

      var w = self.container.clientWidth || window.innerWidth;
      var h = self.container.clientHeight || window.innerHeight;
      self.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 1000);
      self.camera.position.set(0, 1.5, 4);

      self.renderer = new THREE.WebGLRenderer({ canvas: self.canvas, antialias: true, alpha: true });
      self.renderer.setSize(w, h);
      self.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      self.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      self.renderer.toneMappingExposure = 1.2;

      // 灯光
      var ambient = new THREE.AmbientLight(0xffffff, 0.6);
      self.scene.add(ambient);
      var dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
      dirLight.position.set(5, 10, 7);
      self.scene.add(dirLight);
      var rimLight = new THREE.DirectionalLight(0x4488ff, 0.5);
      rimLight.position.set(-5, 3, -5);
      self.scene.add(rimLight);

      // 轨道控制
      if (THREE.OrbitControls) {
        self.controls = new THREE.OrbitControls(self.camera, self.canvas);
        self.controls.enableDamping = true;
        self.controls.dampingFactor = 0.08;
        self.controls.minDistance = 0.5;
        self.controls.maxDistance = 20;
      }

      self.clock = new THREE.Clock();

      // 渲染当前场景
      await self.renderScene(self.currentSceneIndex);

      // 启动动画循环
      self._animating = true;
      self.animate();

      // 自动播放
      if (self.config.autoPlay !== false) {
        self.play();
      }

      // 响应窗口大小
      window.addEventListener('resize', function () { self.onResize(); });
    };

    AetherRuntime.prototype.renderScene = async function (sceneIdx) {
      var self = this;
      var THREE = self.THREE;
      var sceneData = self.scenes[sceneIdx];
      if (!sceneData) return;

      var elements = sceneData.elements || sceneData.children || [];
      for (var i = 0; i < elements.length; i++) {
        var el = elements[i];
        if (el.type === 'model-3d' || el.type === 'model3d' || el.type === '3d-model') {
          await self.loadModel3D(el);
        }
      }
    };

    AetherRuntime.prototype.playModelAction = function (modelData, kind) {
      var current = modelData.controlAction;
      if (!current || current.kind !== kind) {
        modelData.controlAction = { kind: kind, mode: 'play', progress: 0 };
        return true;
      }
      if (current.mode === 'play') current.mode = 'reverse';
      else current.mode = 'play';
      // Keep the current progress so a rapid second tap reverses smoothly.
      return current.mode === 'play';
    };

    AetherRuntime.prototype.createModelControls = function (modelData) {
      var self = this;
      var element = modelData.element;
      var controls = element.ai3dExportControls || {};
      var definitions = [
        { kind: 'layers', label: '分层', icon: '≋', color: '#22d3ee' },
        { kind: 'explode', label: '爆炸', icon: '✦', color: '#fb923c' },
        { kind: 'physics', label: '碰撞', icon: '◎', color: '#c084fc' }
      ];
      var visible = definitions.filter(function (item) { return !controls[item.kind] || controls[item.kind].visible !== false; });
      if (visible.length === 0) return;

      var bar = document.createElement('div');
      bar.style.cssText = 'position:absolute;left:50%;bottom:24px;transform:translateX(-50%);display:flex;gap:8px;z-index:120;pointer-events:auto;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;';
      visible.forEach(function (item) {
        var config = controls[item.kind] || {};
        var variant = config.variant || element.ai3dControlVariant || 'glass';
        var button = document.createElement('button');
        button.type = 'button';
        button.textContent = item.icon + ' ' + (config.label || item.label);
        button.setAttribute('aria-label', config.label || item.label);
        var base = 'height:38px;padding:0 14px;border-radius:7px;cursor:pointer;font-size:13px;font-weight:600;letter-spacing:0;color:#f8fafc;transition:background .18s,border-color .18s,transform .18s;';
        var style = variant === 'solid'
          ? 'background:' + item.color + ';border:1px solid ' + item.color + ';color:#081018;'
          : variant === 'outline'
            ? 'background:transparent;border:1px solid ' + item.color + ';'
            : variant === 'minimal'
              ? 'background:transparent;border:1px solid transparent;'
              : 'background:rgba(3,7,18,.68);border:1px solid rgba(255,255,255,.18);backdrop-filter:blur(12px);';
        button.style.cssText = base + style;
        button.style.touchAction = 'manipulation';
        button.addEventListener('mouseenter', function () { button.style.transform = 'translateY(-1px)'; });
        button.addEventListener('mouseleave', function () { button.style.transform = 'translateY(0)'; });
        button.addEventListener('click', function (event) {
          event.stopPropagation();
          var enabled = self.playModelAction(modelData, item.kind);
          Array.prototype.forEach.call(bar.children, function (child) {
            child.style.boxShadow = 'none';
            child.setAttribute('aria-pressed', 'false');
          });
          if (enabled) {
            button.style.boxShadow = '0 0 0 2px ' + item.color + ', 0 6px 18px rgba(0,0,0,.28)';
            button.setAttribute('aria-pressed', 'true');
          }
        });
        button.addEventListener('pointerdown', function (event) { event.stopPropagation(); });
        bar.appendChild(button);
      });
      self.container.appendChild(bar);
      modelData.controlBar = bar;
    };

    AetherRuntime.prototype.loadModel3D = async function (element) {
      var self = this;
      var THREE = self.THREE;
      var refKey = element.refKey || element.src || element.modelRef;
      var assetData = self.assets[refKey];
      if (!assetData) {
        console.warn('未找到 3D 模型素材:', refKey);
        return;
      }

      try {
        var blob = dataURLtoBlob(assetData);
        var url = URL.createObjectURL(blob);
        var loader = new THREE.GLTFLoader();
        var gltf = await new Promise(function (resolve, reject) {
          loader.load(url, resolve, undefined, reject);
        });
        URL.revokeObjectURL(url);

        var model = gltf.scene;
        // 缩放和定位
        var box = new THREE.Box3().setFromObject(model);
        var size = box.getSize(new THREE.Vector3());
        var center = box.getCenter(new THREE.Vector3());
        var maxDim = Math.max(size.x, size.y, size.z) || 1;
        var scale = (element.scale || 2) / maxDim;
        model.scale.setScalar(scale);
        model.position.set(
          (element.x || 0) - center.x * scale,
          (element.y || 0) - center.y * scale,
          (element.z || 0) - center.z * scale
        );

        // 记录部件（用于分层/爆炸）
        var parts = [];
        var sourceMeshes = [];
        model.traverse(function (node) { if (node.isMesh) sourceMeshes.push(node); });
        if (sourceMeshes.length === 1 && sourceMeshes[0].geometry) {
          var sourceMesh = sourceMeshes[0];
          var sourceMaterials = Array.isArray(sourceMesh.material) ? sourceMesh.material : [sourceMesh.material];
          var splitParent = sourceMesh.parent || model;
          var sourceGroups = sourceMesh.geometry.groups || [];
          if (sourceGroups.length <= 1) {
            var splitPosition = sourceMesh.geometry.getAttribute('position');
            var splitIndex = sourceMesh.geometry.getIndex();
            var splitItemCount = splitIndex ? splitIndex.count : (splitPosition ? splitPosition.count : 0);
            var splitTriangles = Math.floor(splitItemCount / 3);
            var splitChunkCount = Math.min(8, Math.max(2, Math.ceil(splitTriangles / 160)));
            var splitChunkSize = Math.max(3, Math.ceil(splitTriangles / splitChunkCount) * 3);
            sourceGroups = [];
            for (var generatedStart = 0; generatedStart < splitItemCount; generatedStart += splitChunkSize) {
              sourceGroups.push({ start: generatedStart, count: Math.min(splitChunkSize, splitItemCount - generatedStart), materialIndex: 0 });
            }
          }
          if (sourceGroups.length > 1) sourceGroups.forEach(function (group, groupIndex) {
            var splitGeometry = sourceMesh.geometry.clone();
            splitGeometry.clearGroups();
            splitGeometry.addGroup(group.start, group.count, 0);
            var splitMesh = new THREE.Mesh(splitGeometry, sourceMaterials[group.materialIndex] || sourceMaterials[0]);
            splitMesh.name = (sourceMesh.name || 'mesh') + '_part_' + (groupIndex + 1);
            splitMesh.position.copy(sourceMesh.position);
            splitMesh.quaternion.copy(sourceMesh.quaternion);
            splitMesh.scale.copy(sourceMesh.scale);
            splitParent.add(splitMesh);
            var posAttr = sourceMesh.geometry.getAttribute('position');
            var idxAttr = sourceMesh.geometry.getIndex();
            var localMin = new THREE.Vector3(Infinity, Infinity, Infinity);
            var localMax = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
            for (var cursor = group.start; cursor < group.start + group.count; cursor++) {
              var vertexIndex = idxAttr ? idxAttr.getX(cursor) : cursor;
              if (vertexIndex < posAttr.count) {
                var vx = posAttr.getX(vertexIndex), vy = posAttr.getY(vertexIndex), vz = posAttr.getZ(vertexIndex);
                localMin.min(new THREE.Vector3(vx, vy, vz));
                localMax.max(new THREE.Vector3(vx, vy, vz));
              }
            }
            splitMesh.updateMatrixWorld(true);
            splitMesh.userData.__effectCenter = localMin.add(localMax).multiplyScalar(0.5).applyMatrix4(splitMesh.matrixWorld);
            splitMesh.userData.__effectGroup = 'part:' + groupIndex;
          });
          if (sourceGroups.length > 1) sourceMesh.visible = false;
        }
        var modelBoxWorld = new THREE.Box3().setFromObject(model);
        var modelExtent = Math.max.apply(null, modelBoxWorld.getSize(new THREE.Vector3()).toArray().concat([0.1]));
        var meshCounts = new Map();
        model.traverse(function (node) {
          if (!node.isMesh) return;
          var parent = node.parent;
          while (parent && parent !== model) { meshCounts.set(parent, (meshCounts.get(parent) || 0) + 1); parent = parent.parent; }
        });
        model.traverse(function (child) {
          if (child.isMesh) {
            if (!child.visible) return;
            var pBox = new THREE.Box3().setFromObject(child);
            var pCenter = child.userData.__effectCenter ? child.userData.__effectCenter.clone() : pBox.getCenter(new THREE.Vector3());
            var parent = child.parent, groupNode = null;
            while (parent && parent !== model) {
              if (/(body|shell|housing|case|cover|base|assembly|component|wheel|button|screen|handle|label|decal|sticker)/i.test(parent.name || '') || (meshCounts.get(parent) || 0) > 1) { groupNode = parent; break; }
              parent = parent.parent;
            }
            child.geometry.computeBoundingSphere();
            var worldScale = child.getWorldScale(new THREE.Vector3());
            parts.push({
              mesh: child,
              originalPos: child.position.clone(),
              center: pCenter,
              originalWorldPos: child.getWorldPosition(new THREE.Vector3()),
              boundsRadius: (child.geometry.boundingSphere ? child.geometry.boundingSphere.radius : modelExtent * 0.04) * Math.max(worldScale.x, worldScale.y, worldScale.z),
              structuralGroup: child.userData.__effectGroup || (groupNode ? 'node:' + groupNode.uuid : 'spatial:' + Math.round(((pCenter.y - modelBoxWorld.min.y) / modelExtent) * 6))
            });
          }
        });

        self.scene.add(model);
        var modelData = {
          model: model,
          parts: parts,
          element: element,
          ai3d: {
            layers: element.ai3dLayers || 0,
            explode: element.ai3dExplode || 0,
            physics: element.ai3dPhysics || false
            ,layerDirection: element.ai3dLayerDirection || 'up'
            ,layerDistance: element.ai3dLayerDistance == null ? 1 : element.ai3dLayerDistance
            ,explodeDirection: element.ai3dExplodeDirection || 'radial'
            ,explodeDistance: element.ai3dExplodeDistance == null ? 1 : element.ai3dExplodeDistance
            ,explodeSpeed: element.ai3dExplodeSpeed == null ? 1 : element.ai3dExplodeSpeed
            ,explodeSpin: element.ai3dExplodeSpin == null ? 0.5 : element.ai3dExplodeSpin
            ,collisionDirection: element.ai3dCollisionDirection || 'radial'
            ,collisionDistance: element.ai3dCollisionDistance == null ? 1 : element.ai3dCollisionDistance
            ,collisionBounce: element.ai3dCollisionBounce == null ? 0.5 : element.ai3dCollisionBounce
            ,collisionSpeed: element.ai3dCollisionSpeed == null ? 1 : element.ai3dCollisionSpeed
            ,loopEnabled: element.ai3dLoopEnabled !== false
          },
          controlAction: null
        };
        self.models.push(modelData);
        self.createModelControls(modelData);

        // 如果元素有预设效果，应用
        if (element.ai3dLayers > 0 || element.ai3dExplode > 0) {
          // 效果在 animate 循环中持续应用
        }
      } catch (e) {
        console.error('加载 3D 模型失败:', e);
      }
    };

    AetherRuntime.prototype.animate = function () {
      var self = this;
      if (!self._animating) return;
      requestAnimationFrame(function () { self.animate(); });

      var delta = self.clock.getDelta();
      if (self.controls) {
        self.controls.autoRotate = self.models.some(function (m) { return m.element && m.element.modelAutoRotate === true; });
        var rotating = self.models.find(function (m) { return m.element && m.element.modelAutoRotate === true; });
        self.controls.autoRotateSpeed = rotating ? ((rotating.element.modelAutoRotateSpeed || 1) * 2) : 0;
        self.controls.update();
      }

      // 应用 AI 3D 效果
      for (var i = 0; i < self.models.length; i++) {
        var m = self.models[i];
        self.applyAi3DEffects(m, delta);
      }

      self.renderer.render(self.scene, self.camera);
    };

    AetherRuntime.prototype.applyAi3DEffects = function (modelData, delta) {
      var self = this;
      var THREE = self.THREE;
      var { model, parts, ai3d } = modelData;
      if (!parts || parts.length === 0) return;

      var layers = ai3d.layers || 0;
      var explode = ai3d.explode || 0;
      var physics = !!ai3d.physics;
      var layerDistance = Math.max(0, Math.min(2, ai3d.layerDistance == null ? 1 : ai3d.layerDistance));
      var explodeDistance = Math.max(0, Math.min(2, ai3d.explodeDistance == null ? 1 : ai3d.explodeDistance));
      var explodeSpeed = Math.max(0.3, Math.min(3, ai3d.explodeSpeed == null ? 1 : ai3d.explodeSpeed));
      var explodeSpin = Math.max(0, Math.min(1, ai3d.explodeSpin == null ? 0.5 : ai3d.explodeSpin));
      var collisionDistance = Math.max(0, Math.min(2, ai3d.collisionDistance == null ? 1 : ai3d.collisionDistance));
      var collisionBounce = Math.max(0, Math.min(1, ai3d.collisionBounce == null ? 0.5 : ai3d.collisionBounce));
      var collisionSpeed = Math.max(0.3, Math.min(3, ai3d.collisionSpeed == null ? 1 : ai3d.collisionSpeed));
      // 与编辑器预览保持一致：未点击控制按钮时保持产品原始姿态。
      if (!modelData.controlAction) {
        layers = 0;
        explode = 0;
        physics = false;
      }
      if (modelData.controlAction) {
        var action = modelData.controlAction;
        var step = Math.min(Math.max(delta || 0, 0) / 0.7, 0.08);
        if (action.mode === 'reverse') action.progress = Math.max(0, (action.progress == null ? 1 : action.progress) - step);
        else if (action.mode === 'play') action.progress = Math.min(1, (action.progress || 0) + step);
        else action.progress = 0;
        var actionEase = 1 - Math.pow(1 - action.progress, 3);
        var actionKind = action.kind;
        layers = actionKind === 'layers' ? Math.max(layers, 0.7) * actionEase : 0;
        explode = actionKind === 'explode' ? Math.max(explode, 0.65) * actionEase : 0;
        physics = actionKind === 'physics' && action.progress > 0.001 && action.mode !== 'reverse';
        if (action.mode === 'reverse' && action.progress <= 0.001) {
          modelData.controlAction = null;
          if (modelData.controlBar) {
            Array.prototype.forEach.call(modelData.controlBar.children, function (child) {
              child.style.boxShadow = 'none';
              child.setAttribute('aria-pressed', 'false');
            });
          }
        }
      }
      var directionVector = function (direction, fallback) {
        if (direction === 'up') return new THREE.Vector3(0, 1, 0);
        if (direction === 'down') return new THREE.Vector3(0, -1, 0);
        if (direction === 'left') return new THREE.Vector3(-1, 0, 0);
        if (direction === 'right') return new THREE.Vector3(1, 0, 0);
        if (direction === 'front') return new THREE.Vector3(0, 0, 1);
        if (direction === 'back') return new THREE.Vector3(0, 0, -1);
        return fallback;
      };

      // 固定初始布局，绝不从已飞散后的包围盒再计算范围，避免正反馈导致飞出画布。
      if (!modelData.motionLayout || modelData.motionLayout.length !== parts.length) {
        var worldBox = new THREE.Box3().setFromObject(model);
        var origin = worldBox.getCenter(new THREE.Vector3());
        var positionRadius = 0;
        var geometryExtent = 0;
        if (worldBox.isEmpty()) {
          for (var i = 0; i < parts.length; i++) origin.add(parts[i].center);
          origin.multiplyScalar(1 / parts.length);
        }
        modelData.motionLayout = [];
        for (var j = 0; j < parts.length; j++) {
          var basePart = parts[j];
          positionRadius = Math.max(positionRadius, basePart.originalPos.distanceTo(origin));
          basePart.mesh.geometry.computeBoundingBox();
          var geometrySize = basePart.mesh.geometry.boundingBox && basePart.mesh.geometry.boundingBox.getSize(new THREE.Vector3());
          if (geometrySize) geometryExtent = Math.max(geometryExtent, geometrySize.x, geometrySize.y, geometrySize.z);
          basePart.originalQuaternion = basePart.mesh.quaternion.clone();
          var direction = basePart.center.clone().sub(origin);
          if (direction.lengthSq() < 0.0001) {
            var angle = j * 2.399963229728653;
            direction.set(Math.cos(angle), ((j % 3) - 1) * 0.35, Math.sin(angle));
          }
          direction.normalize();
          var phaseKey = basePart.structuralGroup || ('part-' + j);
          var phaseHash = 0;
          for (var phaseIndex = 0; phaseIndex < phaseKey.length; phaseIndex++) phaseHash = (phaseHash * 31 + phaseKey.charCodeAt(phaseIndex)) | 0;
          modelData.motionLayout.push({ direction: direction, layerOffset: 0, phase: Math.abs(phaseHash) * 0.017 });
        }
        modelData.motionOrigin = origin;
        modelData.motionExtent = Math.max(worldBox.getSize(new THREE.Vector3()).length(), positionRadius * 2, geometryExtent, 0.1);
        modelData.motionMinSeparation = Math.max(modelData.motionExtent * 0.12, geometryExtent * 0.28);
        modelData.motionTime = 0;
      }

      if (ai3d.loopEnabled !== false) {
        modelData.motionTime += Math.min(Math.max(delta || 0, 0), 1 / 30);
      }
      var active = layers > 0.001 || explode > 0.001 || physics;
      var positionLerp = 1 - Math.exp(-(delta || 1 / 60) * (active ? 10 : 12));
      var rotationLerp = 1 - Math.exp(-(delta || 1 / 60) * (active ? 8 : 12));

      var targets = [];
      var rotations = [];
      var layerAxis = directionVector(ai3d.layerDirection, new THREE.Vector3(0, 1, 0));
      var layerValues = {};
      var minLayer = Infinity, maxLayer = -Infinity;
      for (var lv = 0; lv < parts.length; lv++) {
        var keyLv = parts[lv].structuralGroup || ('part:' + lv);
        if (layerValues[keyLv] == null) layerValues[keyLv] = parts[lv].center.clone().sub(origin).dot(layerAxis);
        minLayer = Math.min(minLayer, layerValues[keyLv]);
        maxLayer = Math.max(maxLayer, layerValues[keyLv]);
      }
      var layerSpan = Math.max(maxLayer - minLayer, 0.0001);
      for (var k = 0; k < parts.length; k++) {
        var part = parts[k];
        var layout = modelData.motionLayout[k];
        var target = part.originalPos.clone();
        var rotation = new THREE.Euler(0, 0, 0);

        if (layers > 0.001) {
          var axis = ai3d.layerDirection === 'radial' ? layout.direction : directionVector(ai3d.layerDirection, new THREE.Vector3(0, 1, 0));
          var layerKey = part.structuralGroup || ('part:' + k);
          var layerOffset = ((layerValues[layerKey] - minLayer) / layerSpan) - 0.5;
          target.addScaledVector(axis, Math.max(-modelData.motionExtent * 0.48, Math.min(modelData.motionExtent * 0.48, layerOffset * modelData.motionExtent * 0.3)) * layers * layerDistance);
        }

        if (physics) {
          var impact = 0.5 + 0.5 * Math.sin(modelData.motionTime * 2.4 * collisionSpeed + layout.phase);
          target.addScaledVector(ai3d.collisionDirection && ai3d.collisionDirection !== 'radial' ? directionVector(ai3d.collisionDirection, layout.direction) : layout.direction, modelData.motionExtent * (0.12 + impact * (0.18 + collisionBounce * 0.22)) * collisionDistance);
          target.y += Math.sin(modelData.motionTime * 4.8 * collisionSpeed + layout.phase) * modelData.motionExtent * (0.015 + collisionBounce * 0.05);
          rotation.set(
            Math.sin(modelData.motionTime * 2.4 * collisionSpeed + layout.phase) * (0.04 + collisionBounce * 0.1),
            Math.cos(modelData.motionTime * 2.1 * collisionSpeed + layout.phase) * (0.05 + collisionBounce * 0.12),
            Math.sin(modelData.motionTime * 2.7 * collisionSpeed + layout.phase) * (0.03 + collisionBounce * 0.07)
          );
        } else if (explode > 0.001) {
          var open = 0.5 + 0.5 * Math.sin(modelData.motionTime * 1.65 * explodeSpeed + layout.phase * 0.2);
          target.addScaledVector(ai3d.explodeDirection && ai3d.explodeDirection !== 'radial' ? directionVector(ai3d.explodeDirection, layout.direction) : layout.direction, explode * modelData.motionExtent * (0.22 + open * 0.42) * explodeDistance);
          rotation.set(
            Math.sin(modelData.motionTime * 1.65 * explodeSpeed + layout.phase) * explode * explodeSpin * 0.16,
            Math.cos(modelData.motionTime * 1.45 * explodeSpeed + layout.phase) * explode * explodeSpin * 0.2,
            Math.sin(modelData.motionTime * 1.25 * explodeSpeed + layout.phase) * explode * explodeSpin * 0.1
          );
        }

        targets.push(target);
        rotations.push(rotation);
      }

      // Explicit one-axis motion should remain directional; radial motion
      // still uses separation correction so parts cannot collapse together.
      var radialExplode = explode > 0.001 && (!ai3d.explodeDirection || ai3d.explodeDirection === 'radial');
      if (layers > 0.001 || radialExplode || physics) {
        for (var pass = 0; pass < 8; pass++) {
          for (var first = 0; first < targets.length; first++) {
            for (var second = first + 1; second < targets.length; second++) {
              var deltaPos = targets[first].clone().sub(targets[second]);
              var distance = deltaPos.length();
              var clearance = modelData.motionMinSeparation > 0.05 ? ((parts[first].boundsRadius || 0) + (parts[second].boundsRadius || 0)) * 0.2 : 0;
              var requiredDistance = Math.max(modelData.motionMinSeparation, clearance + modelData.motionMinSeparation * 0.2);
              if (distance >= requiredDistance) continue;
              if (distance < 0.00001) {
                deltaPos.copy(modelData.motionLayout[first].direction).sub(modelData.motionLayout[second].direction);
                if (deltaPos.lengthSq() < 0.00001) deltaPos.set(1, 0, 0);
                deltaPos.normalize();
                distance = 0;
              } else {
                deltaPos.multiplyScalar(1 / distance);
              }
              var correction = (requiredDistance - distance) * 0.5;
              targets[first].addScaledVector(deltaPos, correction);
              targets[second].addScaledVector(deltaPos, -correction);
            }
          }
        }
      }

      for (var applyIndex = 0; applyIndex < parts.length; applyIndex++) {
        var targetPart = parts[applyIndex];
        targetPart.mesh.position.lerp(targets[applyIndex], positionLerp);
        var originalQuaternion = targetPart.originalQuaternion || targetPart.mesh.quaternion.clone();
        targetPart.originalQuaternion = originalQuaternion;
        var targetQuaternion = originalQuaternion.clone().multiply(new THREE.Quaternion().setFromEuler(rotations[applyIndex]));
        targetPart.mesh.quaternion.slerp(targetQuaternion, rotationLerp);
      }

      // 插值中的实际位置也执行去重，避免效果开启的一瞬间发生穿插。
      if (active) {
        var currentPositions = [];
        for (var currentIndex = 0; currentIndex < parts.length; currentIndex++) currentPositions.push(parts[currentIndex].mesh.position.clone());
        for (var currentPass = 0; currentPass < 8; currentPass++) {
          for (var currentFirst = 0; currentFirst < currentPositions.length; currentFirst++) {
            for (var currentSecond = currentFirst + 1; currentSecond < currentPositions.length; currentSecond++) {
              var currentDelta = currentPositions[currentFirst].clone().sub(currentPositions[currentSecond]);
              var currentDistance = currentDelta.length();
              if (currentDistance >= modelData.motionMinSeparation) continue;
              if (currentDistance < 0.00001) {
                currentDelta.copy(modelData.motionLayout[currentFirst].direction).sub(modelData.motionLayout[currentSecond].direction);
                if (currentDelta.lengthSq() < 0.00001) currentDelta.set(1, 0, 0);
                currentDelta.normalize();
                currentDistance = 0;
              } else {
                currentDelta.multiplyScalar(1 / currentDistance);
              }
              var currentCorrection = (modelData.motionMinSeparation - currentDistance) * 0.5;
              currentPositions[currentFirst].addScaledVector(currentDelta, currentCorrection);
              currentPositions[currentSecond].addScaledVector(currentDelta, -currentCorrection);
            }
          }
        }
        for (var copyIndex = 0; copyIndex < parts.length; copyIndex++) parts[copyIndex].mesh.position.copy(currentPositions[copyIndex]);
      }
    };

    AetherRuntime.prototype.initPhysics = function (parts, model) {
      var self = this;
      var THREE = self.THREE;
      var CANNON = self.CANNON;
      try {
        var world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
        world.broadphase = new CANNON.SAPBroadphase(world);
        world.allowSleep = true;

        var modelBox = new THREE.Box3().setFromObject(model);
        var modelCenter = modelBox.getCenter(new THREE.Vector3());
        var modelSize = modelBox.getSize(new THREE.Vector3());
        var maxDim = Math.max(modelSize.x, modelSize.y, modelSize.z) || 1;

        var bodies = [];
        for (var i = 0; i < parts.length; i++) {
          var part = parts[i];
          var partBox = new THREE.Box3().setFromObject(part.mesh);
          var partSize = partBox.getSize(new THREE.Vector3());
          var shape = new CANNON.Box(new CANNON.Vec3(
            Math.max(0.02, partSize.x / 2),
            Math.max(0.02, partSize.y / 2),
            Math.max(0.02, partSize.z / 2)
          ));
          var body = new CANNON.Body({ mass: 1, shape: shape });
          var wp = new THREE.Vector3();
          part.mesh.getWorldPosition(wp);
          body.position.set(wp.x, wp.y, wp.z);

          var dir = new THREE.Vector3().subVectors(part.center, modelCenter).normalize();
          if (dir.lengthSq() < 0.001) dir.set(0, 1, 0);
          var force = maxDim * (2.5 + (i % 3) * 0.6);
          body.velocity.set(dir.x * force, dir.y * force + maxDim * 0.8, dir.z * force);
          body.angularVelocity.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);

          world.addBody(body);
          bodies.push(body);
        }

        var groundShape = new CANNON.Plane();
        var groundBody = new CANNON.Body({ mass: 0, shape: groundShape });
        groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        groundBody.position.set(0, modelCenter.y - maxDim * 0.65, 0);
        world.addBody(groundBody);

        self.physicsWorld = world;
        self.physicsBodies = bodies;
        self.physicsState = 'ready';
      } catch (e) {
        console.error('物理世界初始化失败:', e);
        self.physicsState = null;
      }
    };

    AetherRuntime.prototype.disposePhysics = function () {
      var self = this;
      if (self.physicsWorld) {
        try {
          for (var i = 0; i < self.physicsBodies.length; i++) {
            self.physicsWorld.removeBody(self.physicsBodies[i]);
          }
          self.physicsWorld.clearForces();
        } catch (e) { /* ignore */ }
      }
      self.physicsWorld = null;
      self.physicsBodies = [];
      self.physicsState = null;
    };

    AetherRuntime.prototype.play = function () {
      this.playing = true;
      this.startTime = performance.now() - this.pausedTime;
    };

    AetherRuntime.prototype.pause = function () {
      this.playing = false;
      this.pausedTime = performance.now() - this.startTime;
    };

    AetherRuntime.prototype.restart = function () {
      this.currentSceneIndex = 0;
      this.pausedTime = 0;
      this.startTime = performance.now();
      this.playing = true;
      // 重置模型位置
      for (var i = 0; i < this.models.length; i++) {
        var m = this.models[i];
        for (var j = 0; j < m.parts.length; j++) {
          var p = m.parts[j];
          p.mesh.position.copy(p.originalPos);
          p.mesh.rotation.set(0, 0, 0);
        }
      }
      this.disposePhysics();
    };

    AetherRuntime.prototype.onResize = function () {
      if (!this.camera || !this.renderer) return;
      var w = this.container.clientWidth || window.innerWidth;
      var h = this.container.clientHeight || window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };

    return AetherRuntime;
  })();

  window.AetherRuntime = AetherRuntime;
})();
