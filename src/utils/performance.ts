/**
 * 性能优化工具
 * 大工程渲染优化、内存管理、时间线性能
 */

import React, { useMemo, useCallback, useEffect, useRef } from 'react';

/**
 * 深比较两个对象是否相等（用于React.memo）
 */
export function deepEqual<T>(a: T, b: T): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (typeof a !== 'object') return false;

  const keysA = Object.keys(a as object);
  const keysB = Object.keys(b as object);
  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!deepEqual((a as any)[key], (b as any)[key])) return false;
  }
  return true;
}

/**
 * 记忆化组件（深比较props）
 * 用于大工程中频繁渲染的子组件
 */
export function memoDeep<P extends object>(
  Component: React.FC<P>,
  customCompare?: (prev: P, next: P) => boolean
) {
  return React.memo(Component, customCompare || ((prev, next) => deepEqual(prev, next)));
}

/**
 * 防抖Hook
 * 用于时间线缩放、搜索等高频操作
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * 节流Hook
 * 用于滚动、拖拽等高频事件
 */
export function useThrottle<T>(value: T, limit: number = 100): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastRan = useRef(Date.now());

  useEffect(() => {
    const now = Date.now();
    if (now - lastRan.current >= limit) {
      setThrottledValue(value);
      lastRan.current = now;
    } else {
      const timer = setTimeout(() => {
        setThrottledValue(value);
        lastRan.current = Date.now();
      }, limit - (now - lastRan.current));
      return () => clearTimeout(timer);
    }
  }, [value, limit]);

  return throttledValue;
}

/**
 * ObjectURL 内存管理
 * 自动创建和释放 ObjectURL，防止内存泄漏
 */
export function useObjectURL(blob: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [blob]);

  return url;
}

/**
 * 批量释放 ObjectURL
 * 用于组件卸载时清理
 */
export function useObjectURLCleanup(urls: string[]): void {
  useEffect(() => {
    return () => {
      urls.forEach((url) => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [urls]);
}

/**
 * 虚拟列表计算
 * 用于大工程中元素列表的虚拟滚动
 */
export function useVirtualList<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan: number = 5
) {
  const [scrollTop, setScrollTop] = useState(0);

  const totalHeight = items.length * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );
  const visibleItems = items.slice(startIndex, endIndex);
  const offsetY = startIndex * itemHeight;

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return {
    totalHeight,
    visibleItems,
    offsetY,
    onScroll,
    startIndex,
    endIndex,
  };
}

/**
 * 性能监控Hook
 * 监控组件渲染时间，用于性能分析
 */
export function usePerformanceMonitor(componentName: string, enabled: boolean = false) {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(performance.now());

  if (enabled) {
    renderCount.current++;
    const now = performance.now();
    const delta = now - lastRenderTime.current;
    lastRenderTime.current = now;
    if (delta > 16) {
      console.warn(`[Performance] ${componentName} 渲染间隔 ${delta.toFixed(1)}ms (第${renderCount.current}次渲染)`);
    }
  }

  return {
    renderCount: renderCount.current,
  };
}

/**
 * 大工程检测
 * 当元素数量超过阈值时，启用性能优化模式
 */
export function useLargeProjectMode(elementCount: number, threshold: number = 50) {
  const isLargeProject = elementCount > threshold;

  return {
    isLargeProject,
    shouldVirtualize: isLargeProject,
    shouldLazyLoad: isLargeProject,
    performanceMode: isLargeProject ? 'high-performance' : 'standard',
  };
}

/**
 * requestAnimationFrame 节流
 * 用于拖拽、缩放等需要流畅动画的操作
 */
export function useRafThrottle<T extends (...args: any[]) => void>(callback: T): T {
  const rafRef = useRef<number | null>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  return useCallback((...args: Parameters<T>) => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(() => {
      callbackRef.current(...args);
      rafRef.current = null;
    });
  }, []) as T;
}

// 重新导出 useState（避免重复导入）
import { useState } from 'react';
