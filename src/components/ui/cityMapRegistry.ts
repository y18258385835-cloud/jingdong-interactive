import { useEffect, useReducer } from 'react';
import type { OfficialCityMap } from './officialCityMapData';

/**
 * 城市地图几何数据的按需加载器。
 *
 * `officialCityMapData.ts` 约 1.8 MB（38 个城市的 SVG 路径），如果静态引入
 * 会全部进入首屏主包。这里改为动态 `import()`，只有真正渲染城市地图组件时
 * 才加载对应 chunk。
 */
export type CityMaps = Record<string, OfficialCityMap>;

let cache: CityMaps | null = null;
let loading: Promise<CityMaps> | null = null;
const listeners = new Set<() => void>();

export function getLoadedCityMaps(): CityMaps {
  return cache ?? {};
}

export function getLoadedCityMap(id: string): OfficialCityMap | undefined {
  return cache?.[id];
}

export function loadCityMaps(): Promise<CityMaps> {
  if (cache) return Promise.resolve(cache);
  if (!loading) {
    loading = import('./officialCityMapData')
      .then((module) => {
        cache = module.OFFICIAL_CITY_MAPS;
        listeners.forEach((listener) => listener());
        return cache;
      })
      .catch((error) => {
        loading = null;
        throw error;
      });
  }
  return loading;
}

/** 组件内使用：首次渲染触发加载，加载完成后自动重渲染。 */
export function useCityMaps(): CityMaps {
  const [, force] = useReducer((value: number) => value + 1, 0);
  useEffect(() => {
    let active = true;
    const notify = () => { if (active) force(); };
    listeners.add(notify);
    loadCityMaps().catch(() => { /* 地图数据缺失时保持空白，不影响其他图层 */ });
    return () => {
      active = false;
      listeners.delete(notify);
    };
  }, []);
  return cache ?? {};
}
