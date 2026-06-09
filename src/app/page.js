'use client';
import { useState, useEffect } from 'react';
import Live2DViewer from '@/components/Live2DViewer';
import ChatPanel from '@/components/ChatPanel';
import VoiceCallPanel from '@/components/VoiceCallPanel';
import dynamic from 'next/dynamic';
const MapPanel = dynamic(() => import('@/components/MapPanel'), { ssr: false });
import PlanPanel from '@/components/PlanPanel';
import TravelMemoryCenter from '@/components/TravelMemoryCenter';
import AIFeedbackPanel from '@/components/AIFeedbackPanel';

export default function Home() {
  const [mode, setMode] = useState('chat');
  const [autoGuideOn, setAutoGuideOn] = useState(false);
  const [preference, setPreference] = useState('');
  const [routeData, setRouteData] = useState(null);
  const [showTogglePanel, setShowTogglePanel] = useState(false);

  // 阻止页面滚动
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.body.style.height = '100vh';
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.height = '100vh';
    return () => {
      document.body.style.overflow = '';
      document.body.style.height = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.height = '';
    };
  }, []);

  const [autoSpots] = useState([
    { name: '大佛寺', lat: 39.9042, lng: 116.4074 },
    { name: '天子山', lat: 29.345, lng: 110.456 },
    { name: '金鞭溪', lat: 29.346, lng: 110.458 },
  ]);

  // 处理地图“让导游介绍”回调
  const handleAskGuide = (poiName) => {
    setMode('chat');
    setTimeout(() => {
      const event = new CustomEvent('quickQuestion', { detail: `请介绍一下${poiName}` });
      window.dispatchEvent(event);
    }, 300);
  };
  const navigateToChatWithMessage = (message) => {
  setMode('chat');
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('quickQuestion', { detail: message }));
  }, 300);
  };
  const triggerSpotGuide = (spotName) => {
    const event = new CustomEvent('autoGuide', { 
      detail: { 
        spotName: spotName,
        action: 'auto_guide' 
      }
    });
    window.dispatchEvent(event);
};

  // 偏好标签配置
  const preferences = [
    { label: '📜 历史文化', value: 'history' },
    { label: '🏔️ 自然风光', value: 'nature' },
    { label: '👨‍👩‍👧 亲子家庭', value: 'family' },
    { label: '🎒 毕业旅行', value: 'youth' },
    { label: '💎 豪华深度', value: 'luxury' },
  ];

  return (
    <main style={styles.mainContainer}>
      <Live2DViewer modelPath="/models/runtime/kei_basic_free.model3.json" />

      {/* 模拟景点打卡点（仅开启主动导览时显示） */}
      {autoGuideOn && (
        <div style={styles.spotsContainer}>
          {autoSpots.map(spot => (
            <button
              key={spot.name}
              style={styles.spotBtn}
              onClick={() => triggerSpotGuide(spot.name)}
            >
              📍 {spot.name}
            </button>
          ))}
        </div>
      )}

        {/* 可收缩的模式切换按钮面板 */}
      <div style={{ ...styles.toggleContainer, right: showTogglePanel ? '0px' : '-105px' }}>
        {[
          { label: '💬 文本对话', value: 'chat' },
          { label: '📞 语音通话', value: 'voice' },
          { label: '🗺️ 地图导航', value: 'map' },
          { label: '📋 满意度调查', value: 'survey' },
          { label: '🤖 AI规划路线', value: 'plan' },
          { label: '📸 AI旅行记忆', value: 'memory' }
        ].map((item) => (
          <button
            key={item.value}
            style={{
              ...styles.toggleButton,
              backgroundColor: mode === item.value ? '#2B6C4E' : '#f0f0f0',
              color: mode === item.value ? '#fff' : '#666',
            }}
            onClick={() => {
              setMode(item.value);
              setShowTogglePanel(false);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
 
      {/* 独立的箭头触发按钮 */}
      <button
        style={{ ...styles.toggleTrigger, right: showTogglePanel ? '105px' : '0px' }}
        onClick={() => setShowTogglePanel(!showTogglePanel)}
      >
        {showTogglePanel ? '◀' : '▶'}
      </button>
 

      

      {/* 根据模式显示不同面板 */}
      {mode === 'chat' && <ChatPanel preference={preference} setPreference={setPreference} preferences={preferences} autoGuideOn={autoGuideOn} onAutoGuideToggle={() => setAutoGuideOn(!autoGuideOn)} />}
      {mode === 'voice' && <VoiceCallPanel preference={preference} />}
      {mode === 'map' && (
        <MapPanel 
          onBack={() => { setMode('chat'); setRouteData(null); }} 
          onAskGuide={handleAskGuide} 
          routeData={routeData}
          onDiary={navigateToChatWithMessage}
        />
      )}
      {mode === 'survey' && <AIFeedbackPanel onBack={() => setMode('chat')} />}
      {mode === 'plan' && (
        <PlanPanel 
          onBack={() => setMode('chat')} 
          preference={preference}
          onStartGuide={(plan) => {
            setMode('chat');
            setTimeout(() => {
              const names = plan.schedule.map(s => s.name).join('、');
              const event = new CustomEvent('quickQuestion', { detail: `请帮我讲解一下这条路线：${names}` });
              window.dispatchEvent(event);
            }, 300);
          }}
          onNavigate={(schedule) => {
            setRouteData(schedule);
            setMode('map');
          }}
        />
      )}
      {mode === 'memory' && <TravelMemoryCenter onBack={() => setMode('chat')} preference={preference} />}
    </main>
  );
}

const styles = {
  mainContainer: {
    minHeight: '100vh',
    position: 'relative',
    backgroundImage: 'url("/images/background.jpg")',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundAttachment: 'fixed',
    overflow: 'hidden',
  },
  toggleContainer: {
    position: 'fixed',
    top: '25%',
    transform: 'translateY(-50%)',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    zIndex: 100,
    background: 'rgba(255,255,255,0.95)',
    padding: '6px',
    borderRadius: '12px',
    boxShadow: '0 3px 16px rgba(0,0,0,0.12)',
    transition: 'right 0.3s ease',
    
  },
  toggleButton: {
    padding: '6px 12px',
    border: 'none',
    borderRadius: '10px',
    fontSize: '11px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap',
  },
  toggleTrigger: {
    position: 'fixed',
    top: '25%',
    transform: 'translateY(-50%)',
    width: '22px',
    height: '36px',
    background: 'rgba(255,255,255,0.95)',
    border: '1px solid rgba(43, 108, 78, 0.2)',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#2B6C4E',
    fontWeight: 'normal',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0',
    transition: 'right 0.3s ease',
    zIndex: 99,
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  preferenceContainer: {
    position: 'fixed',
    top: '160px',
    right: '20px',
    display: 'flex',
    gap: '6px',
    zIndex: 100,
    background: 'rgba(255,255,255,0.9)',
    padding: '6px',
    borderRadius: '20px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    maxWidth: 'calc(100% - 40px)',
  },
  preferenceTag: {
    padding: '8px 14px',
    borderRadius: '14px',
    border: '1.5px solid #ddd',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
    whiteSpace: 'nowrap',
  },
  autoGuideToggle: {
    position: 'fixed',
    top: '220px',
    right: '20px',
    zIndex: 100,
  },
  autoGuideBtn: {
    padding: '10px 20px',
    border: 'none',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
  },
  spotsContainer: {
    position: 'fixed',
    bottom: '100px',
    left: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    zIndex: 101,
  },
  spotBtn: {
    padding: '12px 20px',
    background: '#fff',
    border: '2px solid #2B6C4E',
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: '600',
    color: '#2B6C4E',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  },
};
