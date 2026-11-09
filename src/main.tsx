import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {ErrorBoundary} from './components/ErrorBoundary.tsx';
import {AppProvider} from './components/AppProvider.tsx';
import {SubscriptionProvider} from './core/auth/hooks.tsx';
import './index.css';
import RealtimeScreen from './components/RealtimeScreen';
import {LanguageProvider} from './i18n/LanguageContext';
import {EXPORT_PLAYER_GLOBAL} from './utils/exportPlayerMode';
import {loadCityMaps} from './components/ui/cityMapRegistry';

// 导出播放器是同步渲染的：地图数据是动态 chunk，先预加载再首帧，
// 避免导出的成品第一帧出现空白地图。
if ((window as unknown as Record<string, unknown>)[EXPORT_PLAYER_GLOBAL] === true) {
  void loadCityMaps();
}

const root = createRoot(document.getElementById('root')!);
root.render(
  <LanguageProvider>
    {window.location.pathname === '/screen' || window.location.pathname === '/app/screen' ? <RealtimeScreen /> : (
      <StrictMode>
        <ErrorBoundary>
          <SubscriptionProvider>
            <AppProvider>
              <App />
            </AppProvider>
          </SubscriptionProvider>
        </ErrorBoundary>
      </StrictMode>
    )}
  </LanguageProvider>,
);
