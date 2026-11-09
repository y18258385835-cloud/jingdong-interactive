/**
 * AETHER 官方旗舰工程 · 原生超清矢量艺术背景 (Apple Pro Bespoke Artwork)
 * 纯矢量数学渲染，8K 无损缩放，零外部网络依赖，极致纯净通透
 */

/** 篇章 01：深空折射视界 (Deep Void Illumination) - Apple Vision Pro 空间光晕风格 */
export const bgVoidIllumination = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="100%" height="100%">
  <defs>
    <radialGradient id="voidCore" cx="68%" cy="42%" r="58%">
      <stop offset="0%" stop-color="#0284c7" stop-opacity="0.32" />
      <stop offset="35%" stop-color="#6366f1" stop-opacity="0.18" />
      <stop offset="65%" stop-color="#3b0764" stop-opacity="0.12" />
      <stop offset="100%" stop-color="#02040a" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="topGlow" cx="20%" cy="15%" r="45%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.16" />
      <stop offset="60%" stop-color="#02040a" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="orbitLineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.4" />
      <stop offset="50%" stop-color="#818cf8" stop-opacity="0.15" />
      <stop offset="100%" stop-color="#c084fc" stop-opacity="0.02" />
    </linearGradient>
    <filter id="blurAtmosphere" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="80" />
    </filter>
  </defs>

  <!-- 纯黑深空背景基底 -->
  <rect width="1920" height="1080" fill="#020409" />

  <!-- 氛围光晕层 -->
  <circle cx="1320" cy="460" r="540" fill="url(#voidCore)" filter="url(#blurAtmosphere)" />
  <circle cx="380" cy="220" r="420" fill="url(#topGlow)" filter="url(#blurAtmosphere)" />

  <!-- 空间同心轨道矢量线 -->
  <g opacity="0.35">
    <ellipse cx="1300" cy="480" rx="580" ry="240" fill="none" stroke="url(#orbitLineGrad)" stroke-width="1.2" stroke-dasharray="8 6" transform="rotate(-18 1300 480)" />
    <ellipse cx="1300" cy="480" rx="420" ry="170" fill="none" stroke="url(#orbitLineGrad)" stroke-width="1" stroke-dasharray="4 8" transform="rotate(-18 1300 480)" />
    <ellipse cx="1300" cy="480" rx="260" ry="100" fill="none" stroke="#38bdf8" stroke-opacity="0.45" stroke-width="1.4" transform="rotate(-18 1300 480)" />
  </g>

  <!-- 极微细微星光节点 -->
  <g fill="#bae6fd" opacity="0.6">
    <circle cx="1180" cy="360" r="1.5" />
    <circle cx="1460" cy="520" r="2.2" />
    <circle cx="1220" cy="610" r="1.2" />
    <circle cx="950" cy="280" r="1.8" />
    <circle cx="780" cy="740" r="1.4" />
    <circle cx="420" cy="640" r="1.6" />
    <circle cx="280" cy="380" r="2" />
    <circle cx="1680" cy="320" r="1.8" />
    <circle cx="1520" cy="780" r="1.2" />
  </g>
</svg>`)}`;

/** 篇章 02：时间聚焦与光线焦散 (Chronos Caustics) - 电影级变形宽银幕光斑风格 */
export const bgChronosOptics = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="100%" height="100%">
  <defs>
    <radialGradient id="lensCore" cx="72%" cy="48%" r="52%">
      <stop offset="0%" stop-color="#ec4899" stop-opacity="0.32" />
      <stop offset="35%" stop-color="#8b5cf6" stop-opacity="0.22" />
      <stop offset="65%" stop-color="#1e1b4b" stop-opacity="0.1" />
      <stop offset="100%" stop-color="#02040a" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="anamorphicStreak" x1="0%" y1="50%" x2="100%" y2="50%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0" />
      <stop offset="40%" stop-color="#38bdf8" stop-opacity="0.35" />
      <stop offset="50%" stop-color="#ffffff" stop-opacity="0.85" />
      <stop offset="60%" stop-color="#c084fc" stop-opacity="0.35" />
      <stop offset="100%" stop-color="#ec4899" stop-opacity="0" />
    </linearGradient>
    <filter id="streakGlow" x="-20%" y="-100%" width="140%" height="300%">
      <feGaussianBlur stdDeviation="35" />
    </filter>
  </defs>

  <rect width="1920" height="1080" fill="#03040b" />

  <!-- 电影镜头焦散光晕 -->
  <circle cx="1380" cy="520" r="500" fill="url(#lensCore)" opacity="0.8" />

  <!-- 变形宽银幕横向水平耀斑 (Anamorphic Lens Flare) -->
  <rect x="0" y="516" width="1920" height="8" fill="url(#anamorphicStreak)" filter="url(#streakGlow)" />
  <rect x="200" y="519" width="1520" height="2" fill="url(#anamorphicStreak)" opacity="0.9" />

  <!-- 多边形光阑叶片与色散光环 -->
  <g opacity="0.25">
    <polygon points="1200,420 1260,380 1340,400 1380,480 1340,560 1260,580 1200,530" fill="none" stroke="#ec4899" stroke-width="1.2" />
    <polygon points="1120,440 1170,400 1240,420 1270,490 1240,560 1170,580 1120,530" fill="none" stroke="#38bdf8" stroke-width="1" />
  </g>
</svg>`)}`;

/** 篇章 03：神经网络与数字孪生矩阵 (Cybernetic Horizon) - 工业指挥中枢风格 */
export const bgCyberGrid = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="100%" height="100%">
  <defs>
    <radialGradient id="cyberCore" cx="70%" cy="40%" r="55%">
      <stop offset="0%" stop-color="#10b981" stop-opacity="0.26" />
      <stop offset="40%" stop-color="#06b6d4" stop-opacity="0.18" />
      <stop offset="70%" stop-color="#022c22" stop-opacity="0.08" />
      <stop offset="100%" stop-color="#010408" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="gridFade" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#06b6d4" stop-opacity="0" />
      <stop offset="45%" stop-color="#06b6d4" stop-opacity="0.12" />
      <stop offset="100%" stop-color="#10b981" stop-opacity="0.45" />
    </linearGradient>
  </defs>

  <rect width="1920" height="1080" fill="#010409" />

  <!-- 中枢能量场 -->
  <circle cx="1340" cy="440" r="540" fill="url(#cyberCore)" />

  <!-- 三维透视地平线网格 (Cyber Perspective Grid) -->
  <g stroke="url(#gridFade)" stroke-width="1.2" opacity="0.6">
    <!-- 纵深透视辐向线（收敛于 x:960, y:560） -->
    <line x1="960" y1="560" x2="-200" y2="1080" />
    <line x1="960" y1="560" x2="100" y2="1080" />
    <line x1="960" y1="560" x2="400" y2="1080" />
    <line x1="960" y1="560" x2="700" y2="1080" />
    <line x1="960" y1="560" x2="960" y2="1080" />
    <line x1="960" y1="560" x2="1220" y2="1080" />
    <line x1="960" y1="560" x2="1520" y2="1080" />
    <line x1="960" y1="560" x2="1820" y2="1080" />
    <line x1="960" y1="560" x2="2120" y2="1080" />

    <!-- 水平横向网格线（指数递增间距） -->
    <line x1="0" y1="620" x2="1920" y2="620" opacity="0.3" />
    <line x1="0" y1="690" x2="1920" y2="690" opacity="0.4" />
    <line x1="0" y1="780" x2="1920" y2="780" opacity="0.55" />
    <line x1="0" y1="890" x2="1920" y2="890" opacity="0.75" />
    <line x1="0" y1="1020" x2="1920" y2="1020" opacity="0.95" />
  </g>
</svg>`)}`;

/** 篇章 04：全端无界视野 (Universal Horizon) - 极简晨曦冷辉风格 */
export const bgUniversalHorizon = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="100%" height="100%">
  <defs>
    <radialGradient id="horizonSun" cx="65%" cy="38%" r="50%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.28" />
      <stop offset="35%" stop-color="#818cf8" stop-opacity="0.18" />
      <stop offset="65%" stop-color="#4f46e5" stop-opacity="0.08" />
      <stop offset="100%" stop-color="#020409" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="horizonLine" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.05" />
      <stop offset="50%" stop-color="#ffffff" stop-opacity="0.5" />
      <stop offset="100%" stop-color="#818cf8" stop-opacity="0.05" />
    </linearGradient>
  </defs>

  <rect width="1920" height="1080" fill="#020308" />

  <!-- 宏大天际弧光 -->
  <circle cx="1280" cy="420" r="520" fill="url(#horizonSun)" />

  <!-- 地平线弧线 -->
  <path d="M 0 760 Q 960 700 1920 760" fill="none" stroke="url(#horizonLine)" stroke-width="1.6" />
</svg>`)}`;
