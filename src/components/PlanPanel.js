'use client';
import { useState } from 'react';
import API_BASE from '@/config';

// 可选景区列表（可替换为你们的真实景区名）
const SCENIC_AREAS = [
  { 
    name: '大佛寺', 
    center: { lat: 39.9042, lng: 116.4074 }, 
    spots: ['大佛寺', '阿育王柱', '降魔浮雕', '祥符禅寺'] 
  },
  { 
    name: '鼋头渚', 
    center: { lat: 31.5235, lng: 120.2203 }, 
    spots: ['充山大门', '充山隐秀', '江南兰苑', '鼋渚春涛', '太湖仙岛', '鹿顶迎晖'] 
  },
  { 
    name: '拈花湾', 
    center: { lat: 31.4728, lng: 120.0793 }, 
    spots: ['入口', '唐风商业街', '梵天花海', '鸣谷湖', '灵山胜境'] 
  },
  { name: '不限景区（自定义）', center: null, spots: [] },
];

const DURATIONS = ['1小时', '2小时', '3小时', '半天', '全天'];
const COMPANIONS = ['独自', '情侣', '亲子', '老人', '朋友'];
const INTERESTS = ['历史', '拍照', '自然', '美食', '祈福', '网红'];
const BUDGETS = ['100元以下', '100-200元', '200-300元', '300元以上', '不限'];

export default function PlanPanel({ onBack, preference, onStartGuide, onNavigate  }) {
  const [step, setStep] = useState('area'); // 'area' 选择景区, 'condition' 选条件, 'result' 展示路线
  const [selectedArea, setSelectedArea] = useState(null); // 景区对象
  const [duration, setDuration] = useState('');
  const [companion, setCompanion] = useState('');
  const [interests, setInterests] = useState([]);
  const [budget, setBudget] = useState('');
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);

    // ========== 第二步：位置获取相关 ==========
  const [userLocation, setUserLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');

  // 距离计算
  const getDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) ** 2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLng/2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // 匹配最近景区
  const matchNearestArea = (lat, lng) => {
    let minDist = Infinity;
    let nearest = null;
    SCENIC_AREAS.forEach(area => {
      if (area.center) {
        const dist = getDistance(lat, lng, area.center.lat, area.center.lng);
        if (dist < minDist) {
          minDist = dist;
          nearest = area;
        }
      }
    });
    if (minDist > 10000) return null;
    return nearest;
  };
  const toggleInterest = (item) => {
    setInterests(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
  };


    // 获取位置
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('浏览器不支持定位');
      return;
    }
    setLocating(true);
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setLocating(false);
        const nearest = matchNearestArea(latitude, longitude);
        if (nearest) {
          setSelectedArea(nearest);
          setTimeout(() => setStep('condition'), 800);
        } else {
          setLocationError('未找到附近景区，已使用自定义模式');
          setSelectedArea({ name: '不限景区（自定义）', center: null, spots: [] });
          setTimeout(() => setStep('condition'), 1000);
        }
      },
      (err) => {
        setLocating(false);
        setLocationError('定位失败：' + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleGenerate = async () => {
    if (!duration || !companion) {
      alert('请至少选择游玩时间和同行人员');
      return;
    }
    setLoading(true);
    const areaName = selectedArea?.name || '';
    const spotsConstraint = selectedArea && selectedArea.spots.length > 0
      ? `请严格从以下【${areaName}】景区内的景点中选择：${selectedArea.spots.join('、')}。`
      : '';

    const query = `请根据以下条件规划一条最优游览路线：
- 游玩景区：${areaName || '不限'}
- 游玩时间：${duration}
- 同行人员：${companion}
- 兴趣爱好：${interests.join('、') || '不限'}
- 预算：${budget || '不限'}
- 偏好类型：${preference || '未指定'}
${spotsConstraint}

请以JSON格式返回规划结果（只返回JSON，不要任何其他文字）：
{
  "summary": {
    "total_time": "预估总时长",
    "total_distance": "预估总距离（公里）",
    "spot_count": 景点数量,
    "total_cost": "预估总花费",
    "score": 推荐指数(1-100)
  },
  "schedule": [
    {"time": "建议时间点", "name": "景点名称", "duration": 游玩分钟数, "tags": ["标签1","标签2"], "desc": "一句话推荐理由"}
  ],
  "reason": "根据用户条件，说明为什么这样安排路线（50字以内）"
}`;

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          is_route_plan: true,
          top_k: 8,
          use_ai: true,
          enable_tts: false,
          stream: false,
          preference: preference || '',
        })
      });
      const data = await res.json();
      try {
        const jsonMatch = data.answer.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const planData = JSON.parse(jsonMatch[0]);
          setPlan(planData);
          setStep('result');
        } else {
          throw new Error('No JSON found');
        }
      } catch (parseErr) {
        // 如果解析失败，使用模拟数据兜底（基于选择的景区）
        setPlan(getMockPlan(selectedArea, duration, companion, interests, budget, preference));
        setStep('result');
      }
    } catch (err) {
      console.error('规划失败:', err);
      setPlan(getMockPlan(selectedArea, duration, companion, interests, budget, preference));
      setStep('result');
    } finally {
      setLoading(false);
    }
  };

  const getMockPlan = (area, dur, comp, ints, bud, pref) => {
    const defaultSpots = area?.spots?.length > 0 ? area.spots.slice(0, 4) : ['景点A', '景点B', '景点C', '景点D'];
    const schedule = defaultSpots.map((name, i) => ({
      time: `${9 + i * 2}:00`,
      name,
      duration: 45,
      tags: ints.slice(0, 2).length ? ints.slice(0, 2) : ['游览'],
      desc: '推荐游览',
    }));
    return {
      summary: {
        total_time: dur || '3小时',
        total_distance: '2.5',
        spot_count: schedule.length,
        total_cost: '120',
        score: 89,
      },
      schedule,
      reason: `根据您选择${area?.name || '当前景区'}，结合${comp}出行和${ints.join('、')}兴趣，为您推荐最顺路的游览顺序。`
    };
  };

  const formatDuration = (minutes) => {
    if (minutes < 60) return `${minutes}分钟`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}小时${m}分钟` : `${h}小时`;
  };

  // ========== 选择景区步骤 ==========
  if (step === 'area') {
    return (
      <div style={styles.container}>
        <button style={styles.backBtn} onClick={onBack}>← 返回</button>
        <div style={styles.header}>🤖 AI路线规划</div>
        <div style={styles.subHeader}>请先选择您所在的景区</div>
        <div style={styles.formArea}>
          {/* ========== 插入：位置获取区域 ========== */}
          <div style={styles.locationArea}>
            {!userLocation ? (
              <button
                style={styles.locationBtn}
                onClick={handleGetLocation}
                disabled={locating}
              >
                {locating ? '📍 正在获取位置...' : '📍 使用当前位置'}
              </button>
            ) : (
              <div style={styles.locationInfo}>
                <span>📍 当前位置已获取</span>
                <button style={styles.reLocateBtn} onClick={handleGetLocation}>重新定位</button>
              </div>
            )}
            {locationError && <div style={styles.locationError}>{locationError}</div>}
          </div>
          {/* ========== 插入结束 ========== */}
          <div style={styles.areaGrid}>
            {SCENIC_AREAS.map(area => (
              <button
                key={area.name}
                style={{
                  ...styles.areaCard,
                  borderColor: selectedArea?.name === area.name ? '#2B6C4E' : '#eee',
                  background: selectedArea?.name === area.name ? '#e8f5e9' : '#fff',
                }}
                onClick={() => {
                  setSelectedArea(area);
                  setStep('condition');
                }}
              >
                <div style={styles.areaName}>{area.name}</div>
                {area.spots.length > 0 && (
                  <div style={styles.areaSpots}>{area.spots.slice(0, 3).join('、')}等</div>
                )}
              </button>
            ))}
          </div>
          {/* 自定义景区：直接进入条件，不加约束 */}
          <button
            style={styles.customBtn}
            onClick={() => {
              setSelectedArea({ name: '自定义', spots: [] });
              setStep('condition');
            }}
          >
            或选择“自定义景区”（不限范围）
          </button>
        </div>
      </div>
    );
  }

  // ========== 选择条件步骤 ==========
  if (step === 'condition' && !plan) {
    return (
      <div style={styles.container}>
        <button style={styles.backBtn} onClick={() => setStep('area')}>← 重选景区</button>
        <div style={styles.header}>📍 当前景区：{selectedArea?.name}</div>
        <div style={styles.formArea}>
          <FormGroup label="游玩时间" options={DURATIONS} value={duration} onChange={setDuration} />
          <FormGroup label="同行人员" options={COMPANIONS} value={companion} onChange={setCompanion} />
          <MultiFormGroup label="兴趣爱好（可多选）" options={INTERESTS} selected={interests} onToggle={toggleInterest} />
          <FormGroup label="预算" options={BUDGETS} value={budget} onChange={setBudget} />
          <button style={styles.generateBtn} onClick={handleGenerate} disabled={loading}>
            {loading ? '⏳ AI正在规划路线...' : '🚀 生成专属路线'}
          </button>
        </div>
      </div>
    );
  }

  // ========== 加载中 ==========
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingArea}>
          <div style={styles.loadingIcon}>🤖</div>
          <div style={styles.loadingTitle}>AI正在为您规划最优路线...</div>
          <div style={styles.loadingSub}>综合分析时间、偏好、预算等因素</div>
        </div>
      </div>
    );
  }

  // ========== 结果展示 ==========
  return (
    <div style={styles.container}>
      <button style={styles.backBtn} onClick={() => { setStep('area'); setPlan(null); }}>← 重新规划</button>
      <div style={styles.header}>📋 您的专属游览路线</div>

      <div style={styles.summaryGrid}>
        <SummaryCard icon="⏰" label="总时长" value={plan.summary.total_time} />
        <SummaryCard icon="🚶" label="总距离" value={`${plan.summary.total_distance}km`} />
        <SummaryCard icon="🎯" label="推荐景点" value={`${plan.summary.spot_count}个`} />
        <SummaryCard icon="💰" label="预计花费" value={`${plan.summary.total_cost}元`} />
        <SummaryCard icon="⭐" label="推荐指数" value={`${plan.summary.score}%`} highlight />
      </div>

      <div style={styles.timeline}>
        <div style={styles.timelineTitle}>🗓️ 推荐行程</div>
        {plan.schedule.map((item, i) => (
          <div key={i} style={styles.timelineItem}>
            <div style={styles.timelineDot}>
              <div style={styles.dot}></div>
              {i < plan.schedule.length - 1 && <div style={styles.dotLine}></div>}
            </div>
            <div style={styles.timelineContent}>
              <div style={styles.timelineTime}>{item.time}</div>
              <div style={styles.timelineName}>{item.name}</div>
              <div style={styles.timelineMeta}>
                <span style={styles.tag}>🕐 {formatDuration(item.duration)}</span>
                {item.tags.map(t => <span key={t} style={styles.tag}>{t}</span>)}
              </div>
              <div style={styles.timelineDesc}>{item.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {plan.reason && (
        <div style={styles.reasonBox}>
          <div style={styles.reasonTitle}>💡 AI规划理由</div>
          <div style={styles.reasonText}>{plan.reason}</div>
        </div>
      )}

      <div style={styles.actionRow}>
        <button style={styles.guideBtn} onClick={() => onStartGuide && onStartGuide(plan)}>
          🎙️ 数字人讲解路线
        </button>
        <button style={styles.navBtn} onClick={() => onNavigate && onNavigate(plan.schedule)}>
          🗺️ 开始导航
        </button>
      </div>
    </div>
  );
}

// ===== 通用表单组件 =====
function FormGroup({ label, options, value, onChange }) {
  return (
    <div style={styles.formGroup}>
      <label style={styles.label}>{label}</label>
      <div style={styles.tagGroup}>
        {options.map(opt => (
          <button key={opt} style={{
            ...styles.tag,
            backgroundColor: value === opt ? '#2B6C4E' : '#f0f4f2',
            color: value === opt ? '#fff' : '#333'
          }} onClick={() => onChange(opt)}>{opt}</button>
        ))}
      </div>
    </div>
  );
}

function MultiFormGroup({ label, options, selected, onToggle }) {
  return (
    <div style={styles.formGroup}>
      <label style={styles.label}>{label}</label>
      <div style={styles.tagGroup}>
        {options.map(opt => (
          <button key={opt} style={{
            ...styles.tag,
            backgroundColor: selected.includes(opt) ? '#2B6C4E' : '#f0f4f2',
            color: selected.includes(opt) ? '#fff' : '#333'
          }} onClick={() => onToggle(opt)}>{opt}</button>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value, highlight }) {
  return (
    <div style={{ ...styles.summaryCard, ...(highlight ? styles.highlightCard : {}) }}>
      <div style={styles.summaryIcon}>{icon}</div>
      <div style={styles.summaryValue}>{value}</div>
      <div style={styles.summaryLabel}>{label}</div>
    </div>
  );
}

// ===== 样式 =====
const styles = {
  container: {
    position: 'fixed', bottom: 0, left: 0, right: 0, height: '70vh',
    background: 'rgba(255,255,255,0.98)', backdropFilter: 'blur(15px)',
    borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
    display: 'flex', flexDirection: 'column', zIndex: 20,
    boxShadow: '0 -4px 20px rgba(0,0,0,0.08)', overflowY: 'auto',
  },
  backBtn: {
    position: 'absolute', top: '14px', left: '16px',
    background: 'none', border: 'none', fontSize: '15px',
    color: '#2B6C4E', fontWeight: 600, cursor: 'pointer', zIndex: 10,
  },
  header: {
    textAlign: 'center', padding: '16px 0 8px', fontSize: '18px',
    fontWeight: 700, color: '#2B6C4E',
  },
  subHeader: {
    textAlign: 'center', fontSize: '14px', color: '#888', marginBottom: '12px',
  },
  formArea: { padding: '16px 20px' },
  areaGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px',
  },
  locationArea: {
  marginBottom: '16px',
  },
  locationBtn: {
    width: '100%',
    padding: '14px',
    background: '#1677ff',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(22,119,255,0.3)',
    marginBottom: '12px',
  },
  locationInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    background: '#e8f5e9',
    borderRadius: '8px',
    marginBottom: '12px',
    color: '#2B6C4E',
    fontWeight: 600,
  },
  reLocateBtn: {
    background: 'none',
    border: '1px solid #2B6C4E',
    borderRadius: '6px',
    padding: '4px 12px',
    color: '#2B6C4E',
    cursor: 'pointer',
    fontSize: '13px',
  },
  locationError: {
    color: '#ff4d4d',
    fontSize: '13px',
    marginTop: '4px',
  },
  areaCard: {
    padding: '16px', borderRadius: '12px', border: '2px solid #eee',
    cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
  },
  areaName: { fontSize: '16px', fontWeight: 700, color: '#333', marginBottom: '6px' },
  areaSpots: { fontSize: '12px', color: '#888' },
  customBtn: {
    width: '100%', marginTop: '16px', padding: '12px',
    background: '#f5f5f5', border: '1px dashed #ccc', borderRadius: '8px',
    color: '#666', fontSize: '14px', cursor: 'pointer', textAlign: 'center',
  },
  formGroup: { marginBottom: '16px' },
  label: { display: 'block', fontSize: '15px', fontWeight: 600, color: '#333', marginBottom: '8px' },
  tagGroup: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  tag: { padding: '8px 16px', borderRadius: '20px', border: '1px solid #ddd', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s' },
  generateBtn: {
    width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
    background: 'linear-gradient(135deg, #2B6C4E, #3A8F5F)', color: '#fff',
    fontSize: '16px', fontWeight: 700, cursor: 'pointer', marginTop: '10px',
    boxShadow: '0 4px 16px rgba(43,108,78,0.3)',
  },
  loadingArea: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', padding: '40px',
  },
  loadingIcon: { fontSize: '60px', marginBottom: '16px' },
  loadingTitle: { fontSize: '18px', fontWeight: 700, color: '#2B6C4E', marginBottom: '8px' },
  loadingSub: { fontSize: '14px', color: '#888' },
  summaryGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
    gap: '10px', padding: '16px 20px',
  },
  summaryCard: {
    background: '#f8f9fa', borderRadius: '12px', padding: '12px',
    textAlign: 'center', border: '1px solid #eee',
  },
  highlightCard: {
    background: 'linear-gradient(135deg, rgba(43,108,78,0.1), rgba(43,108,78,0.05))',
    borderColor: '#2B6C4E',
  },
  navBtn: {
  flex: 1, padding: '14px', borderRadius: '12px', border: 'none',
  background: '#1677ff', color: '#fff', fontSize: '15px', fontWeight: 700,
  cursor: 'pointer', boxShadow: '0 4px 16px rgba(22,119,255,0.3)',
 },
  summaryIcon: { fontSize: '20px', marginBottom: '4px' },
  summaryValue: { fontSize: '16px', fontWeight: 700, color: '#2B6C4E' },
  summaryLabel: { fontSize: '11px', color: '#888', marginTop: '2px' },
  timeline: { padding: '0 20px' },
  timelineTitle: { fontSize: '16px', fontWeight: 700, color: '#333', marginBottom: '16px' },
  timelineItem: { display: 'flex', gap: '12px', paddingBottom: '16px' },
  timelineDot: { display: 'flex', flexDirection: 'column', alignItems: 'center', width: '20px', flexShrink: 0 },
  dot: { width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#2B6C4E', marginTop: '4px' },
  dotLine: { width: '2px', flex: 1, backgroundColor: '#2B6C4E', opacity: 0.3, marginTop: '4px' },
  timelineContent: { flex: 1, background: '#f8f9fa', borderRadius: '12px', padding: '12px', border: '1px solid #eee' },
  timelineTime: { fontSize: '13px', fontWeight: 700, color: '#2B6C4E', marginBottom: '4px' },
  timelineName: { fontSize: '15px', fontWeight: 600, color: '#333', marginBottom: '6px' },
  timelineMeta: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' },
  tag: { padding: '2px 8px', borderRadius: '10px', background: '#e8f5e9', color: '#2B6C4E', fontSize: '11px', fontWeight: 500 },
  timelineDesc: { fontSize: '13px', color: '#666' },
  reasonBox: { margin: '16px 20px', padding: '16px', background: '#fff8e1', borderRadius: '12px', border: '1px solid #ffecb3' },
  reasonTitle: { fontSize: '14px', fontWeight: 700, color: '#f57c00', marginBottom: '8px' },
  reasonText: { fontSize: '14px', color: '#555', lineHeight: '1.6' },
  actionRow: { display: 'flex', gap: '12px', padding: '16px 20px' },
  guideBtn: {
    flex: 1, padding: '14px', borderRadius: '12px', border: 'none',
    background: 'linear-gradient(135deg, #2B6C4E, #3A8F5F)', color: '#fff',
    fontSize: '15px', fontWeight: 700, cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(43,108,78,0.3)',
  },
};