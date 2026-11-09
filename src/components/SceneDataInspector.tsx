import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Folder, FolderPlus, Eye, EyeOff, Lock, Unlock, ChevronDown, ChevronRight,
  Database, Plus, Trash2, Play, Pause, RefreshCw, Wifi, WifiOff, Radio,
  Activity, Layers, Layers2, Save, Copy, Check, Sparkles, Zap, ArrowRight, CornerDownRight,
  Sliders, Link as LinkIcon, Send, AlertTriangle, CheckCircle2, Box, Info,
  SlidersHorizontal, Terminal, HardDrive, Unlink
} from 'lucide-react';
import { ProjectData, Scene, SceneElement, LayerGroup, GlobalVariable, ComponentPreset } from '../types';
import { FOLDER_COLORS, getGroupColorConfig } from './LeftSidebar';
import { getOfficialComponentDefaults } from './ui/officialComponentModel';
import { createInstanceGroup, deleteMaster } from '../utils/componentMasters';

export interface SceneDataInspectorProps {
  projectData: ProjectData;
  activeSceneId: string;
  activeScene: Scene;
  selectedElement: SceneElement | null | undefined;
  collapsedSections: Record<string, boolean>;
  toggleSection: (key: string) => void;
  onUpdateProject: (
    updater: (prev: ProjectData) => ProjectData,
    actionTitle?: string,
    actionType?: any,
    details?: string,
    recordHistory?: boolean
  ) => void;
  onUpdateElement: (
    elId: string,
    updater: Partial<SceneElement>,
    actionTitle?: string,
    recordHistory?: boolean
  ) => void;
  onSelectElement: (id: string | null) => void;
}

// 工业/商业物联网大屏常用模板预设
interface VariablePresetGroup {
  id: string;
  name: string;
  icon: string;
  badge: string;
  desc: string;
  vars: Array<{
    name: string;
    value: string | number;
    type: 'text' | 'number';
    unit: string;
    mqttTopic: string;
    min?: number;
    max?: number;
    step?: number;
  }>;
}

const VARIABLE_PRESETS: VariablePresetGroup[] = [
  {
    id: 'factory',
    name: '工业制造产线',
    icon: '🏭',
    badge: '产线节拍/良率',
    desc: '车间大屏、设备健康与数字孪生看板',
    vars: [
      { name: '实时产线节拍', value: 98.5, type: 'number', unit: 'pcs/m', mqttTopic: 'factory/line1/speed', min: 80, max: 120, step: 0.5 },
      { name: '整线良品率', value: 99.4, type: 'number', unit: '%', mqttTopic: 'factory/line1/yield', min: 98, max: 100, step: 0.1 },
      { name: '主轴轴承温度', value: 42.6, type: 'number', unit: '℃', mqttTopic: 'factory/device/temp', min: 38, max: 65, step: 0.3 },
      { name: '产线运行状态', value: '正常运行', type: 'text', unit: '', mqttTopic: 'factory/device/status' },
    ],
  },
  {
    id: 'energy',
    name: '园区智慧能源',
    icon: '⚡',
    badge: '负荷/电耗/碳排',
    desc: '微电网大屏、光储充与高压配电监控',
    vars: [
      { name: '总负载功率', value: 458.2, type: 'number', unit: 'kW', mqttTopic: 'energy/grid/power', min: 400, max: 550, step: 2.5 },
      { name: '今日累计用电', value: 1280.5, type: 'number', unit: 'kWh', mqttTopic: 'energy/grid/daily_kwh', min: 1000, max: 3000, step: 1.0 },
      { name: '电网母线电压', value: 380.2, type: 'number', unit: 'V', mqttTopic: 'energy/grid/voltage', min: 375, max: 385, step: 0.2 },
      { name: '绿电节能率', value: 88.6, type: 'number', unit: '%', mqttTopic: 'energy/grid/green_rate', min: 80, max: 95, step: 0.2 },
    ],
  },
  {
    id: 'cleanroom',
    name: '洁净车间环境',
    icon: '🌡️',
    badge: '恒温恒湿/微压差',
    desc: '半导体、医药受控洁净环境指标',
    vars: [
      { name: '车间恒温', value: 22.5, type: 'number', unit: '℃', mqttTopic: 'cleanroom/env/temp', min: 20, max: 26, step: 0.2 },
      { name: '相对湿度', value: 45.2, type: 'number', unit: '%RH', mqttTopic: 'cleanroom/env/humidity', min: 40, max: 60, step: 0.4 },
      { name: '洁净微压差', value: 15.5, type: 'number', unit: 'Pa', mqttTopic: 'cleanroom/env/pressure', min: 10, max: 25, step: 0.3 },
      { name: '空气质量指数', value: 12, type: 'number', unit: 'AQI', mqttTopic: 'cleanroom/env/aqi', min: 8, max: 35, step: 1 },
    ],
  },
  {
    id: 'warehouse',
    name: '仓储物流调度',
    icon: '🚨',
    badge: '在库量/AGV稼动',
    desc: '自动化立体仓、AGV小车作业监控',
    vars: [
      { name: '在库托盘数', value: 3420, type: 'number', unit: '箱', mqttTopic: 'warehouse/stock/count', min: 3000, max: 4000, step: 5 },
      { name: 'AGV作业率', value: 96.2, type: 'number', unit: '%', mqttTopic: 'warehouse/agv/rate', min: 90, max: 100, step: 0.3 },
      { name: '待处理订单', value: 18, type: 'number', unit: '单', mqttTopic: 'warehouse/orders/pending', min: 5, max: 50, step: 1 },
      { name: '系统告警等级', value: '正常', type: 'text', unit: '', mqttTopic: 'warehouse/alert/level' },
    ],
  },
];

// 图2组件库中支持联动 MQTT 的自带 UI 组件候选清单
export interface MqttCompatibleUiComponent {
  id: string;
  name: string;
  category: '仪表盘' | '指标卡片' | '进度环' | '状态卡片' | '走势图' | '控制开关';
  icon: string;
  uiComponentType: string;
  modaoId?: string;
  defaultW: number;
  defaultH: number;
  accentColor: string;
}

export const MQTT_COMPATIBLE_UI_COMPONENTS: MqttCompatibleUiComponent[] = [
  { id: 'gauge', name: '全息科技仪表盘', category: '仪表盘', icon: '🎛️', uiComponentType: 'official-modao', modaoId: 'gauge', defaultW: 22, defaultH: 22, accentColor: '#38bdf8' },
  { id: 'progress-ring', name: '发光进度圆环', category: '进度环', icon: '⭕', uiComponentType: 'official-modao', modaoId: 'progress-ring', defaultW: 20, defaultH: 22, accentColor: '#22d3ee' },
  { id: 'metric-card', name: 'Galaxy 科技指标卡', category: '指标卡片', icon: '📊', uiComponentType: 'metric-card', defaultW: 24, defaultH: 16, accentColor: '#34d399' },
  { id: 'metric-1', name: '数字动效面板', category: '指标卡片', icon: '📈', uiComponentType: 'official-modao', modaoId: 'metric-1', defaultW: 24, defaultH: 18, accentColor: '#3b82f6' },
  { id: 'metric-2', name: '动态大数字翻牌器', category: '指标卡片', icon: '🔢', uiComponentType: 'official-modao', modaoId: 'metric-2', defaultW: 24, defaultH: 18, accentColor: '#a855f7' },
  { id: 'card-stat', name: '业务状态统计卡', category: '状态卡片', icon: '📑', uiComponentType: 'official-modao', modaoId: 'card-stat', defaultW: 24, defaultH: 18, accentColor: '#f59e0b' },
  { id: 'status-badge', name: '发光状态指示徽章', category: '状态卡片', icon: '🏷️', uiComponentType: 'official-modao', modaoId: 'status-badge', defaultW: 18, defaultH: 10, accentColor: '#10b981' },
  { id: 'trend-line', name: '实时走势折线图', category: '走势图', icon: '📉', uiComponentType: 'trend-line', defaultW: 30, defaultH: 22, accentColor: '#06b6d4' },
  { id: 'water-wave', name: '水波百分比球', category: '进度环', icon: '🌊', uiComponentType: 'official-modao', modaoId: 'water-wave', defaultW: 20, defaultH: 22, accentColor: '#0ea5e9' },
  { id: 'progress-bar', name: '科技水平进度条', category: '进度环', icon: '➖', uiComponentType: 'official-modao', modaoId: 'progress-bar', defaultW: 26, defaultH: 9, accentColor: '#6366f1' },
  { id: 'switch-ios', name: '科技控制开关', category: '控制开关', icon: '🔘', uiComponentType: 'official-modao', modaoId: 'switch-ios', defaultW: 16, defaultH: 10, accentColor: '#10b981' },
];

/** 根据变量属性智能推荐最匹配的自带 UI 组件 */
export function getRecommendedUiComponent(v: GlobalVariable): MqttCompatibleUiComponent {
  const combined = `${v.name} ${v.unit || ''}`.toLowerCase();

  // 1. 状态 / 等级 / 模式 / 阶段 / 文本型
  if (v.type === 'text' || /状态|等级|模式|告警|健康|阶段/.test(combined)) {
    return MQTT_COMPATIBLE_UI_COMPONENTS.find((c) => c.id === 'card-stat')!;
  }

  // 2. 开关 / 启停 / 阀门
  if (/开关|启停|阀门|使能/.test(combined)) {
    return MQTT_COMPATIBLE_UI_COMPONENTS.find((c) => c.id === 'switch-ios')!;
  }

  // 3. 百分比 / 良率 / 稼动率 / 节能率 / 湿度
  if (v.unit === '%' || v.unit === '%rh' || /率|比|湿度/.test(combined)) {
    return MQTT_COMPATIBLE_UI_COMPONENTS.find((c) => c.id === 'progress-ring')!;
  }

  // 4. 温度 / 压力 / 压差 / 功率 / 电压 / 节拍 / 速度 / 转速 / 频率
  if (/温|℃|°c|压|pa|kpa|功率|kw|电压|v\b|节拍|速度|pcs|rpm|hz/.test(combined)) {
    return MQTT_COMPATIBLE_UI_COMPONENTS.find((c) => c.id === 'gauge')!;
  }

  // 5. 在库 / 托盘 / 订单 / 箱 / 数量 / 吞吐 / 计数 / 用电
  if (/数|箱|托盘|在库|单|kwh|用电|吞吐|件|条|次/.test(combined)) {
    return MQTT_COMPATIBLE_UI_COMPONENTS.find((c) => c.id === 'metric-card')!;
  }

  // 默认数值：数字动效面板
  return MQTT_COMPATIBLE_UI_COMPONENTS.find((c) => c.id === 'metric-1')!;
}

export const SceneDataInspector: React.FC<SceneDataInspectorProps> = ({
  projectData,
  activeSceneId,
  activeScene,
  selectedElement,
  collapsedSections,
  toggleSection,
  onUpdateProject,
  onUpdateElement,
  onSelectElement,
}) => {
  // ====== 1. 变量与 MQTT 状态管理 ======
  const [isSimulating, setIsSimulating] = useState(false);
  const [mqttConnected, setMqttConnected] = useState(false);
  const [mqttConnecting, setMqttConnecting] = useState(false);
  const [showMqttDrawer, setShowMqttDrawer] = useState(false);
  const [showInjectSandbox, setShowInjectSandbox] = useState(false);
  const [brokerUrl, setBrokerUrl] = useState('ws://broker.emqx.io:8083/mqtt');
  const [topicPrefix, setTopicPrefix] = useState('factory/line1/#');
  const [packetCount, setPacketCount] = useState(0);
  const [recentFlashVarId, setRecentFlashVarId] = useState<string | null>(null);
  const [sandboxVarId, setSandboxVarId] = useState<string>('');
  const [sandboxValue, setSandboxValue] = useState<string>('');
  const [copiedVarName, setCopiedVarName] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // 模拟数据跳动引擎（平滑微幅波动，不超限，不污染撤销历史）
  useEffect(() => {
    if (!isSimulating) return;
    const interval = setInterval(() => {
      onUpdateProject(
        (prev) => {
          const vars = prev.variables || [];
          if (vars.length === 0) return prev;
          let changedId: string | null = null;
          const nextVars = vars.map((v) => {
            if (v.mockSimulated === false) return v;
            if (v.type === 'number') {
              const cur = typeof v.value === 'number' ? v.value : parseFloat(String(v.value)) || 0;
              const step = v.step ?? (cur > 100 ? 1 : 0.2);
              const min = v.min ?? (cur > 100 ? cur * 0.8 : 0);
              const max = v.max ?? (cur > 100 ? cur * 1.2 : 100);
              const delta = (Math.random() - 0.5) * 2 * step;
              let nextVal = Number((cur + delta).toFixed(step < 1 ? 1 : 0));
              if (nextVal < min) nextVal = min;
              if (nextVal > max) nextVal = max;
              changedId = v.id;
              return { ...v, value: nextVal };
            } else {
              // 文本型状态偶发波动
              if (Math.random() < 0.12) {
                const statuses = ['正常运行', '正常运行', '巡检中', '高效生产', '正常运行'];
                const nextVal = statuses[Math.floor(Math.random() * statuses.length)];
                if (nextVal !== v.value) changedId = v.id;
                return { ...v, value: nextVal };
              }
              return v;
            }
          });

          if (changedId) {
            setRecentFlashVarId(changedId);
            setTimeout(() => setRecentFlashVarId(null), 850);
            setPacketCount((c) => c + 1);
          }
          return { ...prev, variables: nextVars };
        },
        undefined,
        undefined,
        undefined,
        false // recordHistory = false, 保证自动仿真跳动不塞爆撤销历史！
      );
    }, 2000);

    return () => clearInterval(interval);
  }, [isSimulating, onUpdateProject]);

  // MQTT WebSocket 连接/断开处理
  const toggleMqttConnection = () => {
    if (mqttConnected || mqttConnecting) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setMqttConnected(false);
      setMqttConnecting(false);
      return;
    }

    try {
      setMqttConnecting(true);
      const ws = new WebSocket(brokerUrl);
      wsRef.current = ws;

      const timeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          setMqttConnecting(false);
          setMqttConnected(false);
        }
      }, 5000);

      ws.onopen = () => {
        clearTimeout(timeout);
        setMqttConnecting(false);
        setMqttConnected(true);
      };

      ws.onmessage = (event) => {
        setPacketCount((c) => c + 1);
        try {
          const data = JSON.parse(event.data);
          // 若为 JSON 键值对，匹配变量名或 topic 进行更新
          onUpdateProject(
            (prev) => {
              const vars = prev.variables || [];
              let changedId: string | null = null;
              const nextVars = vars.map((v) => {
                if (data[v.name] !== undefined) {
                  changedId = v.id;
                  return { ...v, value: data[v.name] };
                }
                if (v.mqttTopic && data[v.mqttTopic] !== undefined) {
                  changedId = v.id;
                  return { ...v, value: data[v.mqttTopic] };
                }
                return v;
              });
              if (changedId) {
                setRecentFlashVarId(changedId);
                setTimeout(() => setRecentFlashVarId(null), 850);
              }
              return { ...prev, variables: nextVars };
            },
            undefined,
            undefined,
            undefined,
            false
          );
        } catch {
          // 非 JSON，如纯文本或单值
        }
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        setMqttConnecting(false);
        setMqttConnected(false);
      };

      ws.onclose = () => {
        clearTimeout(timeout);
        setMqttConnecting(false);
        setMqttConnected(false);
      };
    } catch {
      setMqttConnecting(false);
      setMqttConnected(false);
    }
  };

  // 卸载时关闭 WebSocket
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // 一键应用变量预设模板
  const handleApplyPreset = (preset: VariablePresetGroup) => {
    const newVars: GlobalVariable[] = preset.vars.map((pv, idx) => ({
      id: `var_${preset.id}_${Date.now()}_${idx}`,
      name: pv.name,
      value: pv.value,
      type: pv.type,
      unit: pv.unit,
      mqttTopic: pv.mqttTopic,
      mockSimulated: true,
      min: pv.min,
      max: pv.max,
      step: pv.step,
    }));

    onUpdateProject((prev) => ({
      ...prev,
      variables: [...(prev.variables || []).filter((v) => !preset.vars.some((pv) => pv.name === v.name)), ...newVars],
    }));

    // 自动激活模拟，给用户最直观的即时视觉反馈
    setIsSimulating(true);
  };

  // 核心辅助方法：为变量构建绑定的官方/自带 UI 组件图元
  const buildUiComponentForVariable = (
    v: GlobalVariable,
    targetComp: MqttCompatibleUiComponent,
    placement?: { x: number; y: number; w?: number; h?: number },
    maxZ: number = 10
  ): SceneElement => {
    const isOfficial = targetComp.uiComponentType === 'official-modao';
    const modaoId = targetComp.modaoId || targetComp.id;
    const numVal = typeof v.value === 'number' ? v.value : parseFloat(String(v.value)) || 0;

    let uiData: Record<string, unknown> = {};
    if (isOfficial) {
      uiData = {
        ...getOfficialComponentDefaults(modaoId, `${v.name}看板`, targetComp.accentColor),
        modaoId,
        label: v.name,
        title: v.name,
        value: numVal,
        unit: v.unit || '',
        min: v.min ?? 0,
        max: v.max ?? 100,
        status: String(v.value),
        content: String(v.value),
      };
    } else {
      uiData = {
        title: v.name,
        value: numVal,
        unit: v.unit || '',
        status: String(v.value),
        content: `${v.name}: {{${v.name}}}`,
        accentColor: targetComp.accentColor,
        color: targetComp.accentColor,
      };
    }

    const elId = `el_uic_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    return {
      id: elId,
      type: 'ui-component',
      refId: '',
      sourceName: `${v.name} (${targetComp.name})`,
      uiComponentType: targetComp.uiComponentType as any,
      uiComponentData: uiData,
      bindValue: v.type === 'number' ? v.name : undefined,
      bindText: v.name,
      x: placement?.x ?? 35,
      y: placement?.y ?? 35,
      w: placement?.w ?? targetComp.defaultW,
      h: placement?.h ?? targetComp.defaultH,
      opacity: 100,
      zIndex: maxZ + 1,
      startTime: 0,
      duration: activeScene.duration || 10,
    };
  };

  // 一键在画布上生成绑定该变量的图2自带 UI 组件
  const handleCreateUiComponentCard = (
    v: GlobalVariable,
    targetComponentId?: string,
    placement?: { x: number; y: number; w?: number; h?: number }
  ) => {
    const comp = targetComponentId
      ? MQTT_COMPATIBLE_UI_COMPONENTS.find((c) => c.id === targetComponentId) || getRecommendedUiComponent(v)
      : getRecommendedUiComponent(v);

    const maxZ = Math.max(0, ...(activeScene.els || []).map((e) => e.zIndex ?? 0));
    const randomOffset = (Math.random() - 0.5) * 6;
    const finalPlacement = placement || {
      x: Math.min(75, Math.max(10, 36 + randomOffset)),
      y: Math.min(75, Math.max(10, 32 + randomOffset)),
      w: comp.defaultW,
      h: comp.defaultH,
    };

    const newEl = buildUiComponentForVariable(v, comp, finalPlacement, maxZ);

    onUpdateProject(
      (prev) => ({
        ...prev,
        scenes: {
          ...prev.scenes,
          [activeSceneId]: {
            ...activeScene,
            els: [...(activeScene.els || []), newEl],
          },
        },
      }),
      `生成 ${comp.name} (${v.name})`
    );
    onSelectElement(newEl.id);
  };

  // 一键导入预设并在画布上以 2x2 网格直接铺设 4 套联动的精美 UI 组件
  const handleCreatePresetDashboard = (preset: VariablePresetGroup) => {
    // 1. 注入变量
    const newVars: GlobalVariable[] = preset.vars.map((pv, idx) => ({
      id: `var_${preset.id}_${Date.now()}_${idx}`,
      name: pv.name,
      value: pv.value,
      type: pv.type,
      unit: pv.unit,
      mqttTopic: pv.mqttTopic,
      mockSimulated: true,
      min: pv.min,
      max: pv.max,
      step: pv.step,
    }));

    // 2. 规划 2x2 优雅看板布局位置
    const gridPositions = [
      { x: 10, y: 14 },
      { x: 54, y: 14 },
      { x: 10, y: 54 },
      { x: 54, y: 54 },
    ];

    let currentZ = Math.max(0, ...(activeScene.els || []).map((e) => e.zIndex ?? 0));
    const newElements: SceneElement[] = newVars.map((v, idx) => {
      currentZ += 1;
      const comp = getRecommendedUiComponent(v);
      const pos = gridPositions[idx % gridPositions.length];
      return buildUiComponentForVariable(v, comp, { x: pos.x, y: pos.y, w: comp.defaultW, h: comp.defaultH }, currentZ);
    });

    onUpdateProject(
      (prev) => ({
        ...prev,
        variables: [...(prev.variables || []).filter((v) => !preset.vars.some((pv) => pv.name === v.name)), ...newVars],
        scenes: {
          ...prev.scenes,
          [activeSceneId]: {
            ...activeScene,
            els: [...(activeScene.els || []), ...newElements],
          },
        },
      }),
      `一键生成 ${preset.name} 大屏看板`
    );

    // 激活实时仿真
    setIsSimulating(true);
    if (newElements.length > 0) {
      onSelectElement(newElements[0].id);
    }
  };

  // 一键绑定/解除当前选中图层（增强：若是 ui-component，立即同步对应属性与数据）
  const handleToggleBindToSelectedElement = (v: GlobalVariable) => {
    if (!selectedElement) return;
    const isBound = selectedElement.bindText === v.name || selectedElement.bindValue === v.name;
    if (isBound) {
      onUpdateElement(selectedElement.id, {
        bindText: selectedElement.bindText === v.name ? undefined : selectedElement.bindText,
        bindValue: selectedElement.bindValue === v.name ? undefined : selectedElement.bindValue,
      });
    } else {
      const updates: Partial<SceneElement> = {
        bindText: v.name,
      };
      if (v.type === 'number') {
        updates.bindValue = v.name;
      }
      if (selectedElement.type === 'ui-component') {
        const nextData = { ...(selectedElement.uiComponentData || {}) };
        if (v.type === 'number') {
          nextData.value = v.value;
          nextData.counterValue = v.value;
          nextData.currentValue = v.value;
          if (v.unit) nextData.unit = v.unit;
          if (v.min !== undefined) nextData.min = v.min;
          if (v.max !== undefined) nextData.max = v.max;
        } else {
          nextData.status = String(v.value);
          nextData.content = String(v.value);
        }
        updates.uiComponentData = nextData;
      }
      onUpdateElement(selectedElement.id, updates);
    }
  };

  // 手动推送沙盒测试
  const handleInjectSandbox = () => {
    if (!sandboxVarId) return;
    const targetVar = (projectData.variables || []).find((v) => v.id === sandboxVarId);
    if (!targetVar) return;
    const nextVal = targetVar.type === 'number' ? parseFloat(sandboxValue) || 0 : sandboxValue;
    onUpdateProject(
      (prev) => ({
        ...prev,
        variables: (prev.variables || []).map((x) => (x.id === sandboxVarId ? { ...x, value: nextVal } : x)),
      }),
      undefined,
      undefined,
      undefined,
      false
    );
    setRecentFlashVarId(sandboxVarId);
    setTimeout(() => setRecentFlashVarId(null), 850);
    setPacketCount((c) => c + 1);
  };

  // 复制占位符 {{变量名}}
  const handleCopyVarTag = (name: string) => {
    const tag = `{{${name}}}`;
    navigator.clipboard?.writeText(tag);
    setCopiedVarName(name);
    setTimeout(() => setCopiedVarName(null), 1500);
  };

  // ====== 2. 场景图层组辅助操作 ======
  // 选中的图层快速建组
  const handleGroupSelectedElement = () => {
    if (!selectedElement) return;
    const existingGroups = activeScene.groups || [];
    const colorKeys = Object.keys(FOLDER_COLORS);
    const color = colorKeys[existingGroups.length % colorKeys.length] || 'sky';
    const newGroupId = `grp_${Date.now()}`;
    const newGroup: LayerGroup = {
      id: newGroupId,
      name: `${selectedElement.sourceName || '图层'} 专属组`,
      collapsed: false,
      visible: true,
      locked: false,
      color,
    };

    onUpdateProject((prev) => ({
      ...prev,
      scenes: {
        ...prev.scenes,
        [activeSceneId]: {
          ...activeScene,
          groups: [...existingGroups, newGroup],
          els: activeScene.els.map((e) => (e.id === selectedElement.id ? { ...e, groupId: newGroupId } : e)),
        },
      },
    }));
  };

  // 智能一键分组（按元素类型分类）
  const handleSmartAutoGroup = () => {
    const els = activeScene.els || [];
    if (els.length === 0) return;

    const groupDefs = [
      { id: `grp_txt_${Date.now()}`, name: '文本标题层', match: (e: SceneElement) => e.type === 'txt', color: 'sky' },
      { id: `grp_shapes_${Date.now()}`, name: '几何形状与背景', match: (e: SceneElement) => e.type === 'shape', color: 'emerald' },
      { id: `grp_ui_${Date.now()}`, name: '可视化看板组件', match: (e: SceneElement) => e.type === 'ui-component' || e.type === 'chart', color: 'amber' },
      { id: `grp_media_${Date.now()}`, name: '影像与多媒体', match: (e: SceneElement) => e.type === 'vid' || e.type === 'img', color: 'purple' },
    ];

    const activeGroups: LayerGroup[] = [];
    const updatedEls = els.map((el) => {
      const g = groupDefs.find((gd) => gd.match(el));
      if (g) {
        if (!activeGroups.some((ag) => ag.id === g.id)) {
          activeGroups.push({ id: g.id, name: g.name, color: g.color, visible: true, locked: false });
        }
        return { ...el, groupId: g.id };
      }
      return el;
    });

    onUpdateProject((prev) => ({
      ...prev,
      scenes: {
        ...prev.scenes,
        [activeSceneId]: {
          ...activeScene,
          groups: activeGroups,
          els: updatedEls,
        },
      },
    }));
  };

  // 全选该组内所有图层
  const handleSelectGroupElements = (grpId: string) => {
    const grpEls = (activeScene.els || []).filter((e) => e.groupId === grpId);
    if (grpEls.length > 0) {
      onSelectElement(grpEls[0].id);
    }
  };

  return (
    <div className="space-y-4 pb-8">
      {/* ========================================================= */}
      {/* 项目 1: 场景图层组与颜色标记 (SCENE GROUPS & COLOR TAGS) */}
      {/* ========================================================= */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 shadow-sm">
        <button
          type="button"
          onClick={() => toggleSection('scene-groups')}
          className="w-full flex items-center justify-between group cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400">
              <Folder size={13} />
            </div>
            <div className="text-left">
              <div className="text-xs font-bold text-slate-200 group-hover:text-sky-300 transition-colors">
                场景图层组与颜色标记
              </div>
              <div className="text-[10px] text-slate-400">多图层批量显隐、加锁与颜色标识</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-300 font-mono">
              {(activeScene.groups || []).length} 个组
            </span>
            <ChevronDown
              size={13}
              className={`transition-transform text-slate-400 group-hover:text-slate-200 ${
                collapsedSections['scene-groups'] ? '' : 'rotate-180'
              }`}
            />
          </div>
        </button>

        <div className={`pt-3 space-y-3 ${collapsedSections['scene-groups'] ? 'hidden' : ''}`}>
          {/* 快捷操作条 */}
          <div className="grid grid-cols-2 gap-1.5">
            {selectedElement ? (
              <button
                type="button"
                onClick={handleGroupSelectedElement}
                className="col-span-2 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border border-sky-500/40 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-[11px] font-semibold transition-all shadow-sm"
              >
                <FolderPlus size={13} />
                <span>将选中的「{selectedElement.sourceName || '图层'}」编入新组</span>
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => {
                const existingGroups = activeScene.groups || [];
                const colorKeys = Object.keys(FOLDER_COLORS);
                const color = colorKeys[existingGroups.length % colorKeys.length] || 'sky';
                const newGroup: LayerGroup = {
                  id: `grp_${Date.now()}`,
                  name: `分组 ${existingGroups.length + 1}`,
                  collapsed: false,
                  visible: true,
                  locked: false,
                  color,
                };
                onUpdateProject((prev) => ({
                  ...prev,
                  scenes: {
                    ...prev.scenes,
                    [activeSceneId]: {
                      ...activeScene,
                      groups: [...existingGroups, newGroup],
                    },
                  },
                }));
              }}
              className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 text-[11px] transition-colors"
            >
              <Plus size={12} className="text-sky-400" />
              <span>新建空白组</span>
            </button>

            <button
              type="button"
              onClick={handleSmartAutoGroup}
              title="按文本、几何图形、看板组件自动归组"
              className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 text-[11px] transition-colors"
            >
              <Sparkles size={12} className="text-amber-400" />
              <span>智能一键分组</span>
            </button>
          </div>

          {/* 分组列表卡片 */}
          {(activeScene.groups || []).length === 0 ? (
            <div className="p-3 bg-white/[0.015] border border-dashed border-white/10 rounded-xl text-center space-y-1.5">
              <p className="text-[11px] text-slate-400">当前场景暂无图层分组</p>
              <p className="text-[10px] text-slate-500">
                可点击上方「智能一键分组」将场景元素按类型归整，或选中图层后一键建组。
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {(activeScene.groups || []).map((grp) => {
                const cDef = getGroupColorConfig(grp.color);
                const grpEls = (activeScene.els || []).filter((e) => e.groupId === grp.id);
                return (
                  <div
                    key={grp.id}
                    className={`p-2.5 rounded-xl border ${cDef.border} ${cDef.bg} space-y-2 transition-all`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full ring-2 ring-white/30 shrink-0 shadow-sm"
                          style={{ backgroundColor: cDef.tag }}
                        />
                        <input
                          type="text"
                          value={grp.name}
                          onChange={(e) => {
                            const newName = e.target.value;
                            onUpdateProject((prev) => ({
                              ...prev,
                              scenes: {
                                ...prev.scenes,
                                [activeSceneId]: {
                                  ...activeScene,
                                  groups: (activeScene.groups || []).map((g) =>
                                    g.id === grp.id ? { ...g, name: newName } : g
                                  ),
                                },
                              },
                            }));
                          }}
                          className="bg-transparent text-xs font-bold text-white outline-none w-28 border-b border-transparent focus:border-white/40 truncate"
                        />
                        <button
                          type="button"
                          onClick={() => handleSelectGroupElements(grp.id)}
                          className="text-[9px] font-mono px-1.5 py-0.5 bg-black/40 hover:bg-black/60 text-slate-300 hover:text-white rounded transition-colors"
                          title="在画布上选中组内图层"
                        >
                          {grpEls.length} 图层
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        {/* 显隐 */}
                        <button
                          type="button"
                          onClick={() => {
                            const nextVis = grp.visible === false ? true : false;
                            onUpdateProject((prev) => ({
                              ...prev,
                              scenes: {
                                ...prev.scenes,
                                [activeSceneId]: {
                                  ...activeScene,
                                  groups: (activeScene.groups || []).map((g) =>
                                    g.id === grp.id ? { ...g, visible: nextVis } : g
                                  ),
                                  els: activeScene.els.map((e) =>
                                    e.groupId === grp.id ? { ...e, visible: nextVis } : e
                                  ),
                                },
                              },
                            }));
                          }}
                          title={grp.visible !== false ? '隐藏整组' : '显示整组'}
                          className={`p-1 rounded-md ${
                            grp.visible !== false ? 'text-slate-300 hover:text-white' : 'text-slate-600'
                          }`}
                        >
                          {grp.visible !== false ? <Eye size={13} /> : <EyeOff size={13} />}
                        </button>

                        {/* 锁定 */}
                        <button
                          type="button"
                          onClick={() => {
                            const nextLock = !grp.locked;
                            onUpdateProject((prev) => ({
                              ...prev,
                              scenes: {
                                ...prev.scenes,
                                [activeSceneId]: {
                                  ...activeScene,
                                  groups: (activeScene.groups || []).map((g) =>
                                    g.id === grp.id ? { ...g, locked: nextLock } : g
                                  ),
                                  els: activeScene.els.map((e) =>
                                    e.groupId === grp.id ? { ...e, locked: nextLock } : e
                                  ),
                                },
                              },
                            }));
                          }}
                          title={grp.locked ? '解锁整组' : '锁定整组'}
                          className={`p-1 rounded-md ${
                            grp.locked ? 'text-amber-400' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {grp.locked ? <Lock size={13} /> : <Unlock size={13} />}
                        </button>

                        {/* 解散组（保留元素） */}
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateProject((prev) => ({
                              ...prev,
                              scenes: {
                                ...prev.scenes,
                                [activeSceneId]: {
                                  ...activeScene,
                                  groups: (activeScene.groups || []).filter((g) => g.id !== grp.id),
                                  els: activeScene.els.map((e) =>
                                    e.groupId === grp.id ? { ...e, groupId: undefined } : e
                                  ),
                                },
                              },
                            }));
                          }}
                          title="解散此组（保留图层内容）"
                          className="p-1 rounded-md text-slate-500 hover:text-red-400 transition-colors"
                        >
                          <Unlink size={13} />
                        </button>
                      </div>
                    </div>

                    {/* 颜色标记胶囊条 */}
                    <div className="flex items-center justify-between pt-1.5 border-t border-white/5">
                      <span className="text-[10px] text-slate-400">标签颜色:</span>
                      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                        {['sky', 'emerald', 'amber', 'purple', 'rose', 'cyan'].map((cKey) => {
                          const cItem = FOLDER_COLORS[cKey] || FOLDER_COLORS.sky;
                          const isCurrent = (grp.color || 'sky') === cKey;
                          return (
                            <button
                              key={cKey}
                              type="button"
                              onClick={() => {
                                onUpdateProject((prev) => ({
                                  ...prev,
                                  scenes: {
                                    ...prev.scenes,
                                    [activeSceneId]: {
                                      ...activeScene,
                                      groups: (activeScene.groups || []).map((g) =>
                                        g.id === grp.id ? { ...g, color: cKey } : g
                                      ),
                                    },
                                  },
                                }));
                              }}
                              title={cItem.label}
                              style={{ backgroundColor: cItem.tag }}
                              className={`w-3.5 h-3.5 rounded-full border border-white/20 transition-transform ${
                                isCurrent ? 'ring-2 ring-white scale-125 shadow-md' : 'hover:scale-110 opacity-75'
                              }`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 项目 2: 全局变量 (DATA) 与 MQTT 物联网接入 (重点重构) */}
      {/* ========================================================= */}
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.03] p-3 shadow-md space-y-3">
        <button
          type="button"
          onClick={() => toggleSection('scene-data')}
          className="w-full flex items-center justify-between group cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
              <Database size={13} />
            </div>
            <div className="text-left">
              <div className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors flex items-center gap-1.5">
                <span>全局变量 (DATA) & MQTT</span>
                <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-400/20 text-emerald-300 font-normal">
                  实时数据
                </span>
              </div>
              <div className="text-[10px] text-slate-400">IoT 物联网、数字孪生动态指标流</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-mono">
              {(projectData.variables || []).length} 个变量
            </span>
            <ChevronDown
              size={13}
              className={`transition-transform text-slate-400 group-hover:text-slate-200 ${
                collapsedSections['scene-data'] ? '' : 'rotate-180'
              }`}
            />
          </div>
        </button>

        <div className={`space-y-3 ${collapsedSections['scene-data'] ? 'hidden' : ''}`}>
          {/* 实时运行控制中枢 (Live Hub Status) */}
          <div className="rounded-xl border border-white/10 bg-black/40 p-2.5 space-y-2.5">
            {/* 状态徽标与心跳 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  {(isSimulating || mqttConnected) && (
                    <span
                      className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                        mqttConnected ? 'bg-emerald-400' : 'bg-amber-400'
                      }`}
                    />
                  )}
                  <span
                    className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                      mqttConnected
                        ? 'bg-emerald-500'
                        : isSimulating
                        ? 'bg-amber-400'
                        : 'bg-slate-600'
                    }`}
                  />
                </span>
                <span className="text-xs font-bold text-white">
                  {mqttConnected ? (
                    <span className="text-emerald-400">MQTT 现场网关已连接</span>
                  ) : isSimulating ? (
                    <span className="text-amber-300">工业仿真动态跳动中</span>
                  ) : (
                    <span className="text-slate-400">数据源待命中 (静态)</span>
                  )}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400 font-mono">
                  已收帧: <b className="text-white">{packetCount}</b>
                </span>
              </div>
            </div>

            {/* 双核心主控开关 */}
            <div className="grid grid-cols-2 gap-1.5">
              {/* 仿真跳动总开关 */}
              <button
                type="button"
                onClick={() => setIsSimulating((v) => !v)}
                className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm ${
                  isSimulating
                    ? 'border border-amber-500/50 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30'
                    : 'border border-emerald-500/40 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                }`}
              >
                {isSimulating ? <Pause size={13} /> : <Play size={13} />}
                <span>{isSimulating ? '暂停实时模拟' : '🚀 一键开启实时跳动'}</span>
              </button>

              {/* MQTT 网关设置抽屉开关 */}
              <button
                type="button"
                onClick={() => setShowMqttDrawer((v) => !v)}
                className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  mqttConnected
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-slate-300'
                }`}
              >
                <Radio size={13} className={mqttConnected ? 'text-emerald-400 animate-pulse' : 'text-slate-400'} />
                <span>MQTT现场接入</span>
                <ChevronDown size={11} className={`transition-transform ${showMqttDrawer ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* MQTT 设置抽屉 */}
            {showMqttDrawer && (
              <div className="pt-2 border-t border-white/10 space-y-2">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Broker 服务端地址 (WebSocket)</label>
                  <input
                    type="text"
                    value={brokerUrl}
                    onChange={(e) => setBrokerUrl(e.target.value)}
                    placeholder="ws://broker.emqx.io:8083/mqtt"
                    className="w-full bg-black/60 border border-white/15 rounded-md px-2 py-1 text-[11px] text-emerald-300 font-mono outline-none focus:border-emerald-400"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">监听主题前缀 (Topic)</label>
                  <input
                    type="text"
                    value={topicPrefix}
                    onChange={(e) => setTopicPrefix(e.target.value)}
                    placeholder="factory/line1/#"
                    className="w-full bg-black/60 border border-white/15 rounded-md px-2 py-1 text-[11px] text-emerald-300 font-mono outline-none focus:border-emerald-400"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-slate-500">
                    支持标准 MQTT 与 JSON 格式报文
                  </span>
                  <button
                    type="button"
                    onClick={toggleMqttConnection}
                    disabled={mqttConnecting}
                    className={`px-3 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-all ${
                      mqttConnected
                        ? 'bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                    }`}
                  >
                    {mqttConnecting ? (
                      <>
                        <RefreshCw size={11} className="animate-spin" />
                        <span>连接中...</span>
                      </>
                    ) : mqttConnected ? (
                      <>
                        <WifiOff size={11} />
                        <span>断开连接</span>
                      </>
                    ) : (
                      <>
                        <Wifi size={11} />
                        <span>一键连接测试</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 傻瓜式一键行业模板预设 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                <Sparkles size={12} className="text-amber-400" />
                <span>傻瓜式一键预设注入（开箱即用）</span>
              </span>
              <span className="text-[10px] text-slate-500">点击自动填入成套变量</span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {VARIABLE_PRESETS.map((pst) => (
                <div
                  key={pst.id}
                  className="p-2 rounded-xl border border-white/10 bg-white/[0.03] hover:border-emerald-400/40 transition-all group flex flex-col justify-between space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base">{pst.icon}</span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-white/10 text-slate-300 font-mono">
                      {pst.vars.length} 项
                    </span>
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-white group-hover:text-emerald-300 transition-colors">
                      {pst.name}
                    </div>
                    <div className="text-[9px] text-slate-400 truncate">{pst.badge}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-1 pt-1 border-t border-white/5">
                    <button
                      type="button"
                      onClick={() => handleApplyPreset(pst)}
                      title="仅向变量列表注入这组数据"
                      className="px-1.5 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 text-[10px] transition-colors"
                    >
                      导入变量
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCreatePresetDashboard(pst)}
                      title="导入变量并在画布上以 2x2 网格直接铺设 4 套联动的精美 UI 组件"
                      className="px-1.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-bold transition-colors flex items-center justify-center gap-0.5 border border-emerald-400/30"
                    >
                      <Sparkles size={10} />
                      <span>生成看板</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 变量列表卡片流 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-300">
                当前变量清单 ({(projectData.variables || []).length})
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowInjectSandbox((v) => !v)}
                  className="text-[10px] text-slate-400 hover:text-emerald-300 flex items-center gap-1"
                >
                  <Terminal size={11} />
                  <span>手动推流测试</span>
                </button>
              </div>
            </div>

            {/* 手动推流测试沙盒 */}
            {showInjectSandbox && (
              <div className="p-2.5 rounded-xl border border-emerald-500/20 bg-emerald-950/20 space-y-2">
                <div className="text-[10px] text-emerald-300 font-semibold flex items-center gap-1">
                  <Terminal size={11} />
                  <span>手动模拟向网关推送一帧数据</span>
                </div>
                <div className="grid grid-cols-[1fr_1fr_auto] gap-1.5 items-center">
                  <select
                    value={sandboxVarId}
                    onChange={(e) => {
                      setSandboxVarId(e.target.value);
                      const sel = (projectData.variables || []).find((x) => x.id === e.target.value);
                      if (sel) setSandboxValue(String(sel.value));
                    }}
                    className="bg-black/60 border border-white/15 rounded px-2 py-1 text-[11px] text-white outline-none"
                  >
                    <option value="">选择目标变量...</option>
                    {(projectData.variables || []).map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={sandboxValue}
                    onChange={(e) => setSandboxValue(e.target.value)}
                    placeholder="输入模拟值"
                    className="bg-black/60 border border-white/15 rounded px-2 py-1 text-[11px] text-white font-mono outline-none focus:border-emerald-400"
                  />
                  <button
                    type="button"
                    onClick={handleInjectSandbox}
                    disabled={!sandboxVarId}
                    className="px-2 py-1 rounded bg-emerald-500 text-black font-bold text-[11px] hover:bg-emerald-400 transition-colors disabled:opacity-40"
                  >
                    <Send size={11} />
                  </button>
                </div>
              </div>
            )}

            {(projectData.variables || []).length === 0 ? (
              <div className="p-3 bg-white/[0.015] border border-dashed border-white/10 rounded-xl text-center space-y-1.5">
                <p className="text-[11px] text-slate-400">暂无全局变量</p>
                <p className="text-[10px] text-slate-500">点击上方「一键预设注入」或下方「新增变量」开始使用</p>
              </div>
            ) : (
              (projectData.variables || []).map((v) => {
                const isFlashing = recentFlashVarId === v.id;
                const isBoundToSelected =
                  selectedElement &&
                  (selectedElement.bindText === v.name || selectedElement.bindValue === v.name);
                const rec = getRecommendedUiComponent(v);

                return (
                  <div
                    key={v.id}
                    className={`p-2.5 rounded-xl border transition-all space-y-2 ${
                      isFlashing
                        ? 'border-emerald-400 bg-emerald-500/15 animate-var-flash'
                        : isBoundToSelected
                        ? 'border-emerald-400/60 bg-emerald-500/[0.08]'
                        : 'border-white/10 bg-black/40 hover:border-white/20'
                    }`}
                  >
                    {/* 卡片顶部：变量名、类型胶囊、模拟开关、删除 */}
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <span className="text-slate-400 font-mono text-[11px]">#</span>
                        <input
                          type="text"
                          value={v.name}
                          onChange={(e) => {
                            const newName = e.target.value;
                            onUpdateProject((prev) => ({
                              ...prev,
                              variables: (prev.variables || []).map((x) =>
                                x.id === v.id ? { ...x, name: newName } : x
                              ),
                            }));
                          }}
                          className="bg-transparent text-xs font-bold text-white outline-none w-28 border-b border-transparent focus:border-white/30 truncate"
                        />
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                            v.type === 'number'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-sky-500/20 text-sky-300'
                          }`}
                        >
                          {v.type === 'number' ? '数值' : '文本'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        {/* 仿真跳动参与开关 */}
                        <button
                          type="button"
                          onClick={() => {
                            const nextSim = v.mockSimulated === false ? true : false;
                            onUpdateProject((prev) => ({
                              ...prev,
                              variables: (prev.variables || []).map((x) =>
                                x.id === v.id ? { ...x, mockSimulated: nextSim } : x
                              ),
                            }));
                          }}
                          title={v.mockSimulated !== false ? '正在参与实时跳动模拟' : '已停用跳动模拟'}
                          className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${
                            v.mockSimulated !== false
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-white/5 text-slate-500 border border-white/5'
                          }`}
                        >
                          {v.mockSimulated !== false ? '● 模拟中' : '○ 静态'}
                        </button>

                        {/* 删除 */}
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateProject((prev) => ({
                              ...prev,
                              variables: (prev.variables || []).filter((x) => x.id !== v.id),
                            }));
                          }}
                          className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                          title="删除变量"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {/* 卡片核心数值区：大字号突出呈现 + 微调步进 */}
                    <div className="flex items-center justify-between bg-black/40 rounded-lg p-2 border border-white/5">
                      <div className="flex items-baseline gap-1.5">
                        <span
                          className={`font-mono font-black tracking-tight transition-all ${
                            isFlashing
                              ? 'text-emerald-300 text-lg scale-105'
                              : 'text-white text-base'
                          }`}
                        >
                          {String(v.value)}
                        </span>
                        {/* 物理单位编辑 */}
                        <input
                          type="text"
                          value={v.unit || ''}
                          onChange={(e) => {
                            const u = e.target.value;
                            onUpdateProject((prev) => ({
                              ...prev,
                              variables: (prev.variables || []).map((x) =>
                                x.id === v.id ? { ...x, unit: u } : x
                              ),
                            }));
                          }}
                          placeholder="单位"
                          className="w-10 bg-transparent text-[11px] text-slate-400 outline-none border-b border-transparent focus:border-white/20 font-mono"
                        />
                      </div>

                      {/* 快速加减微调器（若为数值型） */}
                      {v.type === 'number' && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const cur = typeof v.value === 'number' ? v.value : parseFloat(String(v.value)) || 0;
                              const step = v.step ?? (cur > 100 ? 1 : 0.5);
                              const nextVal = Number((cur - step).toFixed(step < 1 ? 1 : 0));
                              onUpdateProject((prev) => ({
                                ...prev,
                                variables: (prev.variables || []).map((x) =>
                                  x.id === v.id ? { ...x, value: nextVal } : x
                                ),
                              }));
                            }}
                            className="w-5 h-5 rounded bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center"
                          >
                            -
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const cur = typeof v.value === 'number' ? v.value : parseFloat(String(v.value)) || 0;
                              const step = v.step ?? (cur > 100 ? 1 : 0.5);
                              const nextVal = Number((cur + step).toFixed(step < 1 ? 1 : 0));
                              onUpdateProject((prev) => ({
                                ...prev,
                                variables: (prev.variables || []).map((x) =>
                                  x.id === v.id ? { ...x, value: nextVal } : x
                                ),
                              }));
                            }}
                            className="w-5 h-5 rounded bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 画布图层绑定与图2自带 UI 组件生成 (核心直观反馈) */}
                    <div className="pt-1 space-y-1.5">
                      {selectedElement ? (
                        <div className="space-y-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleBindToSelectedElement(v)}
                            className={`w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                              isBoundToSelected
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 hover:bg-emerald-500/30'
                                : 'bg-sky-500/15 text-sky-300 border border-sky-400/30 hover:bg-sky-500/25'
                            }`}
                          >
                            {isBoundToSelected ? (
                              <>
                                <CheckCircle2 size={12} className="text-emerald-400" />
                                <span>已绑定选中「{selectedElement.sourceName || '图层'}」(点击解绑)</span>
                              </>
                            ) : (
                              <>
                                <LinkIcon size={12} />
                                <span>👉 绑定到当前选中的「{selectedElement.sourceName || '图层'}」</span>
                              </>
                            )}
                          </button>

                          {/* 即使选了图层，也可直接新建匹配的自带组件 */}
                          <div className="flex items-center gap-1 pt-0.5">
                            <button
                              type="button"
                              onClick={() => handleCreateUiComponentCard(v)}
                              className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 text-emerald-300 text-[10px] font-medium transition-colors"
                            >
                              <span>{rec.icon}</span>
                              <span className="truncate">画布新建「{rec.name}」</span>
                            </button>
                            <select
                              value=""
                              onChange={(e) => {
                                if (e.target.value) handleCreateUiComponentCard(v, e.target.value);
                              }}
                              className="bg-black/60 border border-white/15 rounded px-1.5 py-1 text-[10px] text-slate-300 outline-none hover:border-white/30"
                            >
                              <option value="">或换组件...</option>
                              {MQTT_COMPATIBLE_UI_COMPONENTS.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.icon} {c.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {/* 智能推荐匹配生成组件按钮 + 复制标签 */}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleCreateUiComponentCard(v)}
                              title={`自动匹配并生成「${rec.name}」并绑定数据，MQTT/仿真跳动时实时联动`}
                              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-[11px] font-semibold transition-all shadow-sm"
                            >
                              <span className="text-xs">{rec.icon}</span>
                              <span className="truncate">一键匹配生成「{rec.name}」</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopyVarTag(v.name)}
                              title="复制在文本中引用的 {{标签}}"
                              className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-[10px] flex items-center gap-1 font-mono transition-colors border border-white/10"
                            >
                              {copiedVarName === v.name ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                              <span>{`{{${v.name}}}`}</span>
                            </button>
                          </div>

                          {/* 可自选图2中的任意自带UI组件 */}
                          <div className="flex items-center justify-between gap-1 text-[10px] text-slate-400 px-0.5">
                            <span className="flex items-center gap-1 text-[10px] text-slate-400">
                              <Layers2 size={11} className="text-cyan-400" />
                              <span>自选图2组件:</span>
                            </span>
                            <select
                              value=""
                              onChange={(e) => {
                                if (e.target.value) handleCreateUiComponentCard(v, e.target.value);
                              }}
                              className="bg-black/60 border border-white/15 rounded px-2 py-0.5 text-[10px] text-cyan-300 outline-none hover:border-cyan-400/40 max-w-[130px]"
                            >
                              <option value="">选择图2组件库...</option>
                              {MQTT_COMPATIBLE_UI_COMPONENTS.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.icon} {c.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* MQTT Topic 映射 */}
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-white/5">
                      <span className="flex items-center gap-1 font-mono">
                        <Radio size={10} className="text-emerald-400" />
                        <span>Topic:</span>
                      </span>
                      <input
                        type="text"
                        value={v.mqttTopic || ''}
                        onChange={(e) => {
                          const topic = e.target.value;
                          onUpdateProject((prev) => ({
                            ...prev,
                            variables: (prev.variables || []).map((x) =>
                              x.id === v.id ? { ...x, mqttTopic: topic } : x
                            ),
                          }));
                        }}
                        placeholder="如 factory/line1/speed"
                        className="bg-transparent text-slate-300 font-mono text-[10px] outline-none text-right flex-1 ml-2 border-b border-transparent focus:border-white/20 truncate"
                      />
                    </div>
                  </div>
                );
              })
            )}

            {/* 新增自定义变量 */}
            <button
              type="button"
              onClick={() => {
                const name = `变量${(projectData.variables || []).length + 1}`;
                onUpdateProject((prev) => ({
                  ...prev,
                  variables: [
                    ...(prev.variables || []),
                    {
                      id: 'var_' + Date.now(),
                      name,
                      value: 100,
                      type: 'number',
                      unit: '',
                      mqttTopic: `topic/${name}`,
                      mockSimulated: true,
                    },
                  ],
                }));
              }}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-semibold transition-all"
            >
              <Plus size={13} />
              <span>新增自定义变量</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 项目 3: 组件库 (COMPONENTS / 可复用模块) */}
      {/* ========================================================= */}
      <div className="rounded-xl border border-violet-500/30 bg-violet-500/[0.03] p-3 shadow-md space-y-3">
        <button
          type="button"
          onClick={() => toggleSection('scene-comps')}
          className="w-full flex items-center justify-between group cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-violet-500/20 border border-violet-400/40 flex items-center justify-center text-violet-400">
              <Layers size={13} />
            </div>
            <div className="text-left">
              <div className="text-xs font-bold text-white group-hover:text-violet-300 transition-colors flex items-center gap-1.5">
                <span>旧版组件预设（兼容）</span>
                <span className="text-[9px] px-1 py-0.2 rounded bg-violet-400/20 text-violet-300 font-normal">
                  兼容旧工程
                </span>
              </div>
              <div className="text-[10px] text-slate-400">新版母版组件在左侧「组件」面板；这里保留旧工程预设</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 font-mono">
              {(projectData.components || []).length} 个组件
            </span>
            <ChevronDown
              size={13}
              className={`transition-transform text-slate-400 group-hover:text-slate-200 ${
                collapsedSections['scene-comps'] ? '' : 'rotate-180'
              }`}
            />
          </div>
        </button>

        <div className={`space-y-3 ${collapsedSections['scene-comps'] ? 'hidden' : ''}`}>
          {/* 保存组件按钮 */}
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => {
                const name = `组件 ${(projectData.components || []).length + 1} (${activeScene.alias || activeScene.id})`;
                onUpdateProject((prev) => ({
                  ...prev,
                  components: [
                    ...(prev.components || []),
                    {
                      id: 'comp_' + Date.now(),
                      name,
                      createdAt: Date.now(),
                      elements: JSON.parse(JSON.stringify(activeScene.els || [])),
                    },
                  ],
                }));
              }}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-violet-500/40 bg-violet-500/20 hover:bg-violet-500/30 text-violet-200 text-xs font-semibold transition-all shadow-sm"
            >
              <Save size={13} />
              <span>将当前场景全部 ({activeScene.els.length} 个图层) 存为组件</span>
            </button>

            {selectedElement && (
              <button
                type="button"
                onClick={() => {
                  const name = `组件 · ${selectedElement.sourceName || '选定图元'}`;
                  onUpdateProject((prev) => ({
                    ...prev,
                    components: [
                      ...(prev.components || []),
                      {
                        id: 'comp_' + Date.now(),
                        name,
                        createdAt: Date.now(),
                        elements: [JSON.parse(JSON.stringify(selectedElement))],
                      },
                    ],
                  }));
                }}
                className="w-full flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 text-[11px] transition-colors"
              >
                <Sparkles size={12} className="text-violet-400" />
                <span>仅将选中的「{selectedElement.sourceName || selectedElement.id}」存为独立组件</span>
              </button>
            )}
          </div>

          {/* 组件库列表 */}
          {(projectData.components || []).length === 0 ? (
            <div className="p-3 bg-white/[0.015] border border-dashed border-white/10 rounded-xl text-center space-y-1.5">
              <p className="text-[11px] text-slate-400">组件库暂无保存的模块</p>
              <p className="text-[10px] text-slate-500">
                将常用的标题栏、指标卡片、图表组合存为组件，可在任何场景一键复用。
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {(projectData.components || []).map((c) => {
                // 统计元素构成
                const typeCounts: Record<string, number> = {};
                c.elements.forEach((el) => {
                  const t = el.type === 'txt' ? '文本' : el.type === 'shape' ? '图形' : el.type === 'ui-component' ? '看板' : el.type;
                  typeCounts[t] = (typeCounts[t] || 0) + 1;
                });
                const summary = Object.entries(typeCounts)
                  .map(([t, count]) => `${count} ${t}`)
                  .join(' · ');

                return (
                  <div
                    key={c.id}
                    className="p-2.5 rounded-xl border border-white/10 bg-black/40 hover:border-violet-500/40 transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="text-xs font-bold text-white truncate" title={c.name}>
                          {c.name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                          {summary || `${c.elements.length} 个元素`}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const maxZ = Math.max(0, ...activeScene.els.map((e) => e.zIndex ?? 0)) + 1;
                            const instanceNumber = activeScene.els.filter((e) => e.componentInstance?.masterId === c.id).length + 1;
                            const offset = ((instanceNumber - 1) % 5) * 2;
                            const group = createInstanceGroup(c, {
                              x: 34 + offset,
                              y: 32 + offset,
                              zIndex: maxZ,
                              startTime: 0,
                              duration: 5,
                            });
                            group.sourceName = `${c.name} · 副本 ${instanceNumber}`;
                            onUpdateProject((prev) => {
                              const scene = prev.scenes[activeSceneId];
                              if (!scene) return prev;
                              return {
                                ...prev,
                                scenes: {
                                  ...prev.scenes,
                                  [activeSceneId]: {
                                    ...scene,
                                    els: [...scene.els, group],
                                    duration: Math.max(scene.duration || 10, 5),
                                  },
                                },
                              };
                            }, `插入组件副本「${c.name}」`);
                            onSelectElement(group.id);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-sky-500 hover:bg-sky-400 text-black font-bold text-[11px] transition-colors shadow-sm flex items-center gap-1"
                        >
                          <Zap size={11} />
                          <span>一键插入</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            onUpdateProject((prev) => deleteMaster(prev, c.id), `删除组件母版「${c.name}」`);
                          }}
                          className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                          title="删除此组件"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
