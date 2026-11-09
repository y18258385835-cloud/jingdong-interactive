import { writeFile } from 'node:fs/promises';

const base = 'https://geo.datav.aliyun.com/areas_v3/bound';

// Use the source's current China → province → prefecture hierarchy instead of
// maintaining a hand-picked city list that silently misses most regions.
const nationalResponse = await fetch(`${base}/100000_full.json`);
if (!nationalResponse.ok) throw new Error(`China administrative index fetch failed: ${nationalResponse.status}`);
const provinces = await nationalResponse.json();
const cities = [];
for (const province of provinces.features || []) {
  const provinceCode = String(province.properties.adcode);
  if (['110000', '120000', '310000', '500000'].includes(provinceCode)) {
    cities.push({ id: `map-${provinceCode}`, adcode: provinceCode, name: province.properties.name, feature: province });
    continue;
  }
  const response = await fetch(`${base}/${provinceCode}_full.json`);
  if (!response.ok) continue;
  const collection = await response.json();
  for (const feature of collection.features || []) {
    const adcode = String(feature.properties.adcode);
    if (!/^\d{6}$/.test(adcode) || !adcode.endsWith('00')) continue;
    cities.push({ id: `map-${adcode}`, adcode, name: feature.properties.name, feature });
  }
}
const uniqueCities = Array.from(new Map(cities.map((city) => [city.adcode, city])).values());
console.log(`Found ${uniqueCities.length} prefecture-level administrative regions.`);
const legacyIds = new Map([
  ['110000', 'map-beijing'], ['310000', 'map-shanghai'], ['440100', 'map-guangzhou'],
  ['440300', 'map-shenzhen'], ['510100', 'map-chengdu'], ['500000', 'map-chongqing'],
]);
for (const city of uniqueCities) city.id = legacyIds.get(city.adcode) || `map-${city.adcode}`;

function rings(geometry) {
  if (!geometry) return [];
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
  return polygons.map((polygon) => polygon[0]).filter((ring) => ring?.length > 3);
}

function simplify(points, epsilon) {
  if (points.length <= 4) return points;
  const start = points[0];
  const end = points.at(-1);
  let maxDistance = 0;
  let split = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    const [x, y] = points[index];
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const t = dx === 0 && dy === 0 ? 0 : Math.max(0, Math.min(1, ((x - start[0]) * dx + (y - start[1]) * dy) / (dx * dx + dy * dy)));
    const distance = Math.hypot(x - (start[0] + t * dx), y - (start[1] + t * dy));
    if (distance > maxDistance) { maxDistance = distance; split = index; }
  }
  if (maxDistance <= epsilon) return [start, end];
  return [...simplify(points.slice(0, split + 1), epsilon).slice(0, -1), ...simplify(points.slice(split), epsilon)];
}

function area(points) {
  return Math.abs(points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point[0] * next[1] - next[0] * point[1];
  }, 0)) / 2;
}

function projectRing(ring, centerLongitude, latitudeCosine) {
  return ring.map(([longitude, latitude]) => [(longitude - centerLongitude) * latitudeCosine, latitude]);
}

function pathFor(points, bounds, width, height, padding = 28) {
  const scale = Math.min((width - padding * 2) / (bounds.maxX - bounds.minX), (height - padding * 2) / (bounds.maxY - bounds.minY));
  const offsetX = (width - (bounds.maxX - bounds.minX) * scale) / 2;
  const offsetY = (height - (bounds.maxY - bounds.minY) * scale) / 2;
  const coordinates = points.map(([x, y]) => [offsetX + (x - bounds.minX) * scale, height - offsetY - (y - bounds.minY) * scale]);
  return `M${coordinates.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L')}Z`;
}

function pointFor(center, bounds, width, height, padding = 28) {
  const scale = Math.min((width - padding * 2) / (bounds.maxX - bounds.minX), (height - padding * 2) / (bounds.maxY - bounds.minY));
  const offsetX = (width - (bounds.maxX - bounds.minX) * scale) / 2;
  const offsetY = (height - (bounds.maxY - bounds.minY) * scale) / 2;
  return { x: +(offsetX + (center[0] - bounds.minX) * scale).toFixed(1), y: +(height - offsetY - (center[1] - bounds.minY) * scale).toFixed(1) };
}

const output = {};
for (const { id, adcode, feature } of uniqueCities) {
  const districtsResponse = await fetch(`${base}/${adcode}_full.json`);
  const districtCollection = districtsResponse.ok ? await districtsResponse.json() : { features: [] };
  if (!feature) throw new Error(`Missing city feature: ${id}`);
  const centerLongitude = Number(feature.properties.center?.[0] || feature.properties.centroid?.[0]);
  const latitudeCosine = Math.cos(Number(feature.properties.center?.[1] || feature.properties.centroid?.[1]) * Math.PI / 180);
  const cityRings = rings(feature.geometry).map((ring) => projectRing(ring, centerLongitude, latitudeCosine)).filter((ring) => area(ring) > 0.00002);
  const allPoints = cityRings.flat();
  const bounds = {
    minX: Math.min(...allPoints.map(([x]) => x)), maxX: Math.max(...allPoints.map(([x]) => x)),
    minY: Math.min(...allPoints.map(([, y]) => y)), maxY: Math.max(...allPoints.map(([, y]) => y)),
  };
  const scaleArea = (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY);
  const city = {
    name: feature.properties.name,
    outline: cityRings.map((ring) => pathFor(simplify(ring, 0.0012), bounds, 1000, 640)).join(''),
    districts: [],
  };
  for (const district of districtCollection.features || []) {
    const districtRings = rings(district.geometry).map((ring) => projectRing(ring, centerLongitude, latitudeCosine))
      .filter((ring) => area(ring) > scaleArea * 0.00008)
      .map((ring) => simplify(ring, 0.0012));
    if (!districtRings.length) continue;
    const center = district.properties.centroid || district.properties.center;
    const label = center ? pointFor([(center[0] - centerLongitude) * latitudeCosine, center[1]], bounds, 1000, 640) : null;
    city.districts.push({
      name: district.properties.name,
      path: districtRings.map((ring) => pathFor(ring, bounds, 1000, 640)).join(''),
      ...(label && { label }),
      area: +districtRings.reduce((sum, ring) => sum + area(ring), 0).toFixed(4),
    });
  }
  output[id] = city;
  console.log(`${id}: ${city.districts.length} district features`);
}

const source = `// Generated from public administrative-boundary GeoJSON (Aliyun DataV areas_v3); see tools/generate-official-city-maps.mjs.\nexport interface OfficialCityDistrict { name: string; path: string; label?: { x: number; y: number }; area: number }\nexport interface OfficialCityMap { name: string; outline: string; districts: OfficialCityDistrict[] }\nexport const OFFICIAL_CITY_MAPS: Record<string, OfficialCityMap> = ${JSON.stringify(output)};\n`;
await writeFile(new URL('../src/components/ui/officialCityMapData.ts', import.meta.url), source, 'utf8');
console.log(`Wrote ${source.length.toLocaleString()} bytes of offline city map data.`);
