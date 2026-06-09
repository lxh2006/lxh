// src/app/admin/tts/page.js
'use client';

import { useState, useEffect } from 'react';
import API_BASE from '@/config';

export default function TtsPage() {
  const [voices, setVoices] = useState([]);
  const [cacheStats, setCacheStats] = useState(null);
  const [selectedVoice, setSelectedVoice] = useState('zh-CN-XiaoxiaoNeural');
  const [text, setText] = useState('');
  const [audioBase64, setAudioBase64] = useState(null);
  const [synthesizing, setSynthesizing] = useState(false);
  const [message, setMessage] = useState('');

  // 获取可用语音列表
  const fetchVoices = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/tts/voices`);
      const data = await res.json();
      if (data.voices) {
        setVoices(data.voices);
        if (data.voices.length > 0 && !data.voices.includes(selectedVoice)) {
          setSelectedVoice(data.voices[0]);
        }
      }
    } catch (err) {
      console.error('获取语音列表失败', err);
    }
  };

  // 获取缓存统计
  const fetchCacheStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/tts/cache/stats`);
      const data = await res.json();
      setCacheStats(data);
    } catch (err) {
      console.error('获取缓存统计失败', err);
    }
  };

  useEffect(() => {
    fetchVoices();
    fetchCacheStats();
  }, []);

  // 独立 TTS 合成
  const handleSynthesize = async () => {
    if (!text.trim()) {
      setMessage('❌ 请输入要合成的文本');
      return;
    }

    setSynthesizing(true);
    setMessage('');
    setAudioBase64(null);

    try {
      const res = await fetch(`${API_BASE}/api/tts/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          voice: selectedVoice,
        }),
      });
      const data = await res.json();

      if (data.success && data.audio_base64) {
        setAudioBase64(data.audio_base64);
        setMessage(`✅ 合成成功（时长: ${data.duration?.toFixed(1)}秒）`);
        fetchCacheStats(); // 刷新缓存统计
      } else {
        setMessage(`❌ 合成失败: ${data.error || '未知错误'}`);
      }
    } catch (err) {
      setMessage('❌ 网络错误: ' + err.message);
    } finally {
      setSynthesizing(false);
    }
  };

  // 播放音频
  const handlePlay = () => {
    if (!audioBase64) return;
    const audio = new Audio(audioBase64);
    audio.play().catch(err => console.error('播放失败:', err));
  };

  // 清空缓存
  const handleClearCache = async () => {
    if (!confirm('确定要清空 TTS 缓存吗？')) return;

    try {
      const res = await fetch(`${API_BASE}/api/tts/cache/clear`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.status === 'success') {
        setMessage('✅ ' + data.message);
        fetchCacheStats();
      } else {
        setMessage('❌ 清空失败');
      }
    } catch (err) {
      setMessage('❌ 网络错误: ' + err.message);
    }
  };

  return (
    <div>
      <h3 style={{ marginBottom: '16px', color: '#fff' }}>🔊 TTS 语音管理</h3>

      {/* 操作提示 */}
      {message && (
        <div style={{
          ...styles.messageBox,
          backgroundColor: message.startsWith('✅') ? '#0a2e1a' : '#2e0a0a',
        }}>
          {message}
        </div>
      )}

      {/* 缓存统计卡片 */}
      {cacheStats && (
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{cacheStats.cache_size}</div>
            <div style={styles.statLabel}>当前缓存数</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{cacheStats.max_cache_size}</div>
            <div style={styles.statLabel}>最大缓存数</div>
          </div>
          <div style={styles.statCard}>
            <div style={{ ...styles.statValue, color: '#52c41a' }}>
              {cacheStats.hit_rate != null ? `${(cacheStats.hit_rate * 100).toFixed(1)}%` : '-'}
            </div>
            <div style={styles.statLabel}>命中率</div>
          </div>
        </div>
      )}

      {/* 语音选择 + 文本输入 + 合成测试 */}
      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>🎤 TTS 合成测试</h4>

        {/* 语音选择 */}
        <div style={styles.formGroup}>
          <label style={styles.label}>选择语音：</label>
          <select
            style={styles.select}
            value={selectedVoice}
            onChange={(e) => setSelectedVoice(e.target.value)}
          >
            {voices.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          <span style={styles.voiceCount}>共 {voices.length} 种语音</span>
        </div>

        {/* 文本输入 */}
        <div style={styles.formGroup}>
          <label style={styles.label}>合成文本：</label>
          <textarea
            style={styles.textarea}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="输入要合成的文本内容..."
            rows={3}
          />
        </div>

        {/* 操作按钮 */}
        <div style={styles.btnRow}>
          <button
            style={styles.primaryBtn}
            onClick={handleSynthesize}
            disabled={synthesizing || !text.trim()}
          >
            {synthesizing ? '⏳ 合成中...' : '🔊 合成语音'}
          </button>
          {audioBase64 && (
            <button style={styles.playBtn} onClick={handlePlay}>
              ▶ 播放试听
            </button>
          )}
        </div>

        {/* 可用语音列表 */}
        {voices.length > 0 && (
          <div style={styles.voiceList}>
            <span style={styles.label}>可用语音列表：</span>
            <div style={styles.tagList}>
              {voices.map((v) => (
                <span
                  key={v}
                  style={{
                    ...styles.voiceTag,
                    backgroundColor: v === selectedVoice ? '#0a2e1a' : '#1a2a3a',
                    borderColor: v === selectedVoice ? '#52c41a' : '#1f2937',
                  }}
                  onClick={() => setSelectedVoice(v)}
                >
                  {v}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 缓存管理 */}
      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>💾 缓存管理</h4>
        <p style={styles.desc}>
          TTS 合成结果会被缓存以提高重复请求的响应速度。清空缓存将删除所有已缓存的音频。
        </p>
        <button style={styles.clearBtn} onClick={handleClearCache}>
          🗑️ 清空 TTS 缓存
        </button>
      </div>

      <div style={styles.hint}>
        💡 TTS 缓存可提高重复文本的响应速度，建议定期清理以释放存储空间
      </div>
    </div>
  );
}

const styles = {
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  statCard: {
    background: '#111827',
    border: '1px solid #1f2937',
    borderRadius: '12px',
    padding: '16px 20px',
  },
  statValue: {
    fontSize: '26px',
    fontWeight: '700',
    color: '#1677ff',
    marginBottom: '4px',
  },
  statLabel: {
    fontSize: '13px',
    color: '#888',
  },
  section: {
    background: '#111827',
    border: '1px solid #1f2937',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '20px',
  },
  sectionTitle: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#e0e0e0',
    marginBottom: '16px',
  },
  formGroup: {
    marginBottom: '12px',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    color: '#888',
    marginBottom: '6px',
  },
  select: {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #1f2937',
    background: '#0d1117',
    color: '#e0e0e0',
    fontSize: '14px',
    outline: 'none',
    minWidth: '280px',
  },
  voiceCount: {
    marginLeft: '10px',
    fontSize: '12px',
    color: '#666',
  },
  textarea: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid #1f2937',
    background: '#0d1117',
    color: '#e0e0e0',
    fontSize: '14px',
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  btnRow: {
    display: 'flex',
    gap: '10px',
    marginBottom: '16px',
  },
  primaryBtn: {
    padding: '10px 24px',
    backgroundColor: '#2B6C4E',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  playBtn: {
    padding: '10px 24px',
    backgroundColor: '#1a3a5c',
    color: '#8ab4f8',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  voiceList: {
    marginTop: '8px',
  },
  tagList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '6px',
  },
  voiceTag: {
    padding: '4px 12px',
    borderRadius: '14px',
    border: '1px solid',
    fontSize: '12px',
    cursor: 'pointer',
    color: '#ccc',
    transition: 'all 0.2s',
  },
  desc: {
    fontSize: '13px',
    color: '#888',
    lineHeight: '1.6',
    marginBottom: '12px',
  },
  clearBtn: {
    padding: '10px 20px',
    backgroundColor: '#3a2a1a',
    color: '#fa8c16',
    border: '1px solid #5c3a1a',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  messageBox: {
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '20px',
    fontSize: '14px',
    color: '#e0e0e0',
  },
  hint: {
    textAlign: 'center',
    color: '#666',
    fontSize: '13px',
  },
};