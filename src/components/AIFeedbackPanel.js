'use client';
import { useState, useEffect } from 'react';
import API_BASE from '@/config';

export default function AIFeedbackPanel({ onBack }) {
  const [step, setStep] = useState('greeting'); // greeting | selecting | questions | analyzing | result
  const [satisfaction, setSatisfaction] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [improvements, setImprovements] = useState([]);
  const [usageData, setUsageData] = useState({});
  const [aiSummary, setAiSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [customSuggestion, setCustomSuggestion] = useState('');

  // 从 localStorage 读取用户行为数据
  useEffect(() => {
    const logs = JSON.parse(localStorage.getItem('qa_logs') || '[]');
    const memories = JSON.parse(localStorage.getItem('travel_memories') || '[]');
    const routes = JSON.parse(localStorage.getItem('route_plans') || '[]');

    setUsageData({
      chatCount: logs.length,
      photoCount: memories.length,
      routeCount: routes.length,
      spots: [...new Set(memories.map(m => m.spot))],
    });
  }, []);

  const satisfactionOptions = [
    { emoji: '😞', label: '不满意', value: 1 },
    { emoji: '😐', label: '一般', value: 2 },
    { emoji: '😊', label: '满意', value: 3 },
    { emoji: '😍', label: '非常满意', value: 4 },
  ];

  const favoriteOptions = ['景点风景', '数字人讲解', 'AI路线规划', '拍照识景', '景区服务'];
  const improvementOptions = ['导览不够清晰', '路线规划不合理', '景区拥挤', '配套设施不足', '数字人回答不准'];

  const handleSatisfactionSelect = (value) => {
    setSatisfaction(value);
    setStep('questions');
  };

  const handleSubmit = async () => {
    setLoading(true);
    setStep('analyzing');
    // 构建提示词，让大模型生成总结
    const prompt = `用户本次游览数据：
- 咨询数字人：${usageData.chatCount}次
- 拍照识景：${usageData.photoCount}次
- 使用路线规划：${usageData.routeCount}次
- 打卡景点：${usageData.spots?.join('、') || '无'}
- 满意度：${satisfaction}/4分
- 喜欢的功能：${favorites.join('、') || '未选择'}
- 改进建议：${improvements.join('、') || '无'}

请根据以上数据，生成一份简短的旅行总结（50字以内），语气亲切，带emoji，像朋友在帮你做旅行回顾。`;

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: prompt,
          use_ai: true,
          stream: false,
          enable_tts: false,
        })
      });
      const data = await res.json();
      const summary = data.answer || '根据您的游览数据，这是一次愉快的旅行！';
      setAiSummary(summary);

        // 把 AI 总结也提交到后端
      try {
        await fetch(`${API_BASE}/api/survey/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
            satisfaction: satisfaction,
            favorites: favorites.join('、'),
            improvements: improvements.join('、'),
            ai_summary: summary,
            suggestion: customSuggestion || '',
            usage_data: usageData,
            })
        });
        } catch (err) {
        console.error('提交反馈失败:', err);
        }
    } catch (err) {
      setAiSummary('根据您的游览数据，这是一次愉快的旅行！');
    } finally {
      setLoading(false);
      setStep('result');
    }
  };

  const renderGreeting = () => (
    <div style={styles.stepContainer}>
      <div style={styles.digitalGuide}>
        <span style={styles.guideAvatar}>🤖</span>
        <div style={styles.guideSpeech}>
          您好！本次游览体验如何呢？点击下方表情告诉我吧～
        </div>
      </div>
      <div style={styles.emojiRow}>
        {satisfactionOptions.map(opt => (
          <button key={opt.value} style={styles.emojiBtn} onClick={() => handleSatisfactionSelect(opt.value)}>
            <span style={styles.emoji}>{opt.emoji}</span>
            <span style={styles.emojiLabel}>{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const renderQuestions = () => (
    <div style={styles.stepContainer}>
      <h3 style={styles.questionTitle}>
        {satisfaction >= 3 ? '太棒了！您最喜欢哪些方面？' : '我们会努力改进，哪些地方需要优化？'}
      </h3>
      <div style={styles.tagGroup}>
        {(satisfaction >= 3 ? favoriteOptions : improvementOptions).map(opt => (
          <button
            key={opt}
            style={{
              ...styles.tag,
              background: (satisfaction >= 3 ? favorites : improvements).includes(opt) ? '#2B6C4E' : '#f0f4f2',
              color: (satisfaction >= 3 ? favorites : improvements).includes(opt) ? '#fff' : '#333',
            }}
            onClick={() => {
              if (satisfaction >= 3) {
                setFavorites(prev => prev.includes(opt) ? prev.filter(i => i !== opt) : [...prev, opt]);
              } else {
                setImprovements(prev => prev.includes(opt) ? prev.filter(i => i !== opt) : [...prev, opt]);
              }
            }}
          >
            {opt}
          </button>
        ))}
      </div>
      <div style={styles.textAreaContainer}>
        <textarea
            style={styles.textArea}
            placeholder="还有想说的？可以在这里留言哦（选填）"
            value={customSuggestion}
            onChange={(e) => setCustomSuggestion(e.target.value)}
            rows={3}
        />
      </div>
      <button style={styles.submitBtn} onClick={handleSubmit}>🤖 生成AI旅行总结</button>
    </div>
  );

  const renderAnalyzing = () => (
    <div style={styles.stepContainer}>
      <div style={styles.analyzingIcon}>🤖</div>
      <div style={styles.analyzingTitle}>AI正在分析您的游览数据...</div>
      <div style={styles.analyzingSub}>综合打卡景点、使用功能、满意度等数据</div>
    </div>
  );

  const renderResult = () => (
    <div style={styles.stepContainer}>
      <div style={styles.reportHeader}>📋 AI游览体验分析报告</div>

      {/* 满意度 */}
      <div style={styles.reportSection}>
        <div style={styles.reportLabel}>😊 整体满意度</div>
        <div style={styles.stars}>{'★'.repeat(satisfaction)}{'☆'.repeat(4 - satisfaction)}</div>
      </div>

      {/* 行为数据 */}
      <div style={styles.reportSection}>
        <div style={styles.reportLabel}>📊 本次游览数据</div>
        <div style={styles.dataGrid}>
          <DataCard icon="🗣️" label="咨询数字人" value={`${usageData.chatCount || 0}次`} />
          <DataCard icon="📸" label="拍照识景" value={`${usageData.photoCount || 0}次`} />
          <DataCard icon="🗺️" label="路线规划" value={`${usageData.routeCount || 0}次`} />
          <DataCard icon="📍" label="打卡景点" value={`${usageData.spots?.length || 0}个`} />
        </div>
      </div>

      {/* 用户偏好 */}
      {(favorites.length > 0 || improvements.length > 0) && (
        <div style={styles.reportSection}>
          <div style={styles.reportLabel}>⭐ 您最{['喜欢', '', '', ''][satisfaction-1] || '关注'}的功能</div>
          <div style={styles.tagGroup}>
            {(favorites.length > 0 ? favorites : improvements).map(item => (
              <span key={item} style={styles.selectedTag}>{item}</span>
            ))}
          </div>
        </div>
      )}

      {/* AI 总结 */}
      {aiSummary && (
        <div style={styles.reportSection}>
          <div style={styles.reportLabel}>🤖 AI旅行总结</div>
          <div style={styles.aiSummary}>{aiSummary}</div>
        </div>
      )}

      {/* 旅行证书 */}
      <div style={styles.certificate}>
        <div style={styles.certTitle}>🏆 景区探索达人</div>
        <div style={styles.certContent}>
          已完成 {usageData.spots?.length || 0} 个景点打卡<br />
          满意度 {satisfaction}/4 分
        </div>
        <div style={styles.certFooter}>AI导游小灵 · 期待您的再次光临</div>
      </div>

      <button style={styles.backBtn} onClick={onBack}>返回首页</button>
    </div>
  );

  return (
    <div style={styles.container}>
      <button style={styles.closeBtn} onClick={onBack}>← 返回</button>
      <div style={styles.header}>🤖 AI游览体验反馈</div>
      {step === 'greeting' && renderGreeting()}
      {step === 'questions' && renderQuestions()}
      {step === 'analyzing' && renderAnalyzing()}
      {step === 'result' && renderResult()}
    </div>
  );
}

// 数据卡片子组件
function DataCard({ icon, label, value }) {
  return (
    <div style={styles.dataCard}>
      <div style={styles.dataIcon}>{icon}</div>
      <div style={styles.dataValue}>{value}</div>
      <div style={styles.dataLabel}>{label}</div>
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed', bottom: 0, left: 0, right: 0, height: '70vh',
    background: 'rgba(255,255,255,0.98)', backdropFilter: 'blur(15px)',
    borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
    display: 'flex', flexDirection: 'column', zIndex: 20,
    boxShadow: '0 -4px 20px rgba(0,0,0,0.08)', overflowY: 'auto', padding: '16px 20px',
  },
  textAreaContainer: {
    marginTop: '16px',
  },
  textArea: {
    width: '100%',
    padding: '12px',
    borderRadius: '12px',
    border: '1px solid #ddd',
    fontSize: '14px',
    resize: 'vertical',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    },
  closeBtn: { background: 'none', border: 'none', fontSize: 15, color: '#2B6C4E', fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start' },
  header: { textAlign: 'center', fontSize: 20, fontWeight: 700, color: '#2B6C4E', marginTop: 8, marginBottom: 16 },
  stepContainer: { flex: 1, display: 'flex', flexDirection: 'column', padding: '10px 0' },
  digitalGuide: { display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 30 },
  guideAvatar: { fontSize: 40, flexShrink: 0 },
  guideSpeech: { background: '#f0f8f4', borderRadius: '16px 16px 16px 4px', padding: '14px 18px', fontSize: 16, color: '#333', lineHeight: 1.6, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
  emojiRow: { display: 'flex', justifyContent: 'center', gap: 20, marginTop: 20 },
  emojiBtn: { background: '#fff', border: '2px solid #eee', borderRadius: 20, padding: '20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s', minWidth: 70 },
  emoji: { fontSize: 36, marginBottom: 8 },
  emojiLabel: { fontSize: 13, color: '#666', fontWeight: 500 },
  questionTitle: { fontSize: 17, fontWeight: 700, color: '#333', marginBottom: 20, textAlign: 'center' },
  tagGroup: { display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 20 },
  tag: { padding: '10px 20px', borderRadius: 20, border: '1px solid #ddd', fontSize: 14, cursor: 'pointer', transition: 'all 0.2s' },
  submitBtn: { width: '100%', padding: 14, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #2B6C4E, #3A8F5F)', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', marginTop: 20, boxShadow: '0 4px 16px rgba(43,108,78,0.3)' },
  analyzingIcon: { fontSize: 60, textAlign: 'center', marginBottom: 16 },
  analyzingTitle: { fontSize: 18, fontWeight: 700, color: '#2B6C4E', textAlign: 'center', marginBottom: 8 },
  analyzingSub: { fontSize: 14, color: '#888', textAlign: 'center' },
  reportHeader: { fontSize: 18, fontWeight: 700, color: '#2B6C4E', textAlign: 'center', marginBottom: 20 },
  reportSection: { background: '#f8f9fa', borderRadius: 12, padding: 14, marginBottom: 14 },
  reportLabel: { fontSize: 14, fontWeight: 700, color: '#333', marginBottom: 8 },
  stars: { fontSize: 24, color: '#f5a623' },
  dataGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  dataCard: { background: '#fff', borderRadius: 10, padding: 12, textAlign: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' },
  dataIcon: { fontSize: 22, marginBottom: 4 },
  dataValue: { fontSize: 16, fontWeight: 700, color: '#2B6C4E' },
  dataLabel: { fontSize: 11, color: '#888', marginTop: 2 },
  selectedTag: { padding: '6px 14px', borderRadius: 14, background: '#e8f5e9', color: '#2B6C4E', fontSize: 13, fontWeight: 500 },
  aiSummary: { fontSize: 15, color: '#333', lineHeight: 1.6, fontStyle: 'italic' },
  certificate: { background: 'linear-gradient(135deg, #fff8e1, #fff3e0)', borderRadius: 16, padding: 20, textAlign: 'center', border: '2px solid #ffcc80', marginTop: 10, marginBottom: 16 },
  certTitle: { fontSize: 20, fontWeight: 700, color: '#f57c00', marginBottom: 8 },
  certContent: { fontSize: 15, color: '#555', lineHeight: 1.6, marginBottom: 12 },
  certFooter: { fontSize: 12, color: '#888' },
  backBtn: { width: '100%', padding: 12, borderRadius: 10, border: '2px solid #2B6C4E', background: '#fff', color: '#2B6C4E', fontSize: 15, fontWeight: 600, cursor: 'pointer', textAlign: 'center' },
};