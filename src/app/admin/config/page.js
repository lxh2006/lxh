// src/app/admin/config/page.js
'use client';

import { useState, useEffect } from 'react';
import API_BASE from '@/config';

const MODEL_OPTIONS = [
  { label: 'Kei 基础版（女）', value: '/models/runtime/kei_basic_free.model3.json' },
  { label: '京（女·口型优化）', value: '/models/京/jing.model3.json' },
  { label: '自定义...', value: '__custom__' },
];

const VOICE_OPTIONS = [
  { label: '晓晓（女·活泼）', value: 'zh-CN-XiaoxiaoNeural' },
  { label: '云希（男·稳重）', value: 'zh-CN-YunxiNeural' },
  { label: '云扬（男·新闻风）', value: 'zh-CN-YunyangNeural' },
  { label: '晓伊（女·温柔）', value: 'zh-CN-XiaoyiNeural' },
  { label: '云健（男·老成）', value: 'zh-CN-YunjianNeural' },
  { label: '晓辰（女·自然）', value: 'zh-CN-XiaochenNeural' },
];

export default function ConfigPage() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('');
  const [isCustom, setIsCustom] = useState(false);

  // 加载当前配置
  useEffect(() => {
    fetch(`${API_BASE}/api/bot-config`)
      .then(res => res.json())
      .then(data => {
        setConfig(data);
        setSelectedVoice(data.tts_voice || 'zh-CN-XiaoxiaoNeural');
        // 判断模型路径是否在预设列表中
        const preset = MODEL_OPTIONS.find(m => m.value === data.model_path);
        if (preset && preset.value !== '__custom__') {
          setSelectedModel(data.model_path);
          setIsCustom(false);
        } else {
          setSelectedModel('__custom__');
          setCustomModel(data.model_path || '');
          setIsCustom(true);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('获取配置失败', err);
        setLoading(false);
      });
  }, []);

  // 保存配置
  const handleSave = async () => {
    setSaving(true);
    setMessage('');

    const modelPath = isCustom ? customModel : selectedModel;
    if (!modelPath.trim()) {
      setMessage('❌ 请输入模型路径');
      setSaving(false);
      return;
    }

    const newConfig = {
      model_path: modelPath,
      tts_voice: selectedVoice,
    };

    try {
      const res = await fetch(`${API_BASE}/api/bot-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });
      const data = await res.json();
      if (data.status === 'success') {
        setMessage('✅ 配置已保存，游客端刷新页面后生效');
        setConfig(data.config);
      } else {
        setMessage('❌ 保存失败');
      }
    } catch (err) {
      setMessage('❌ 网络错误: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ color: '#888', padding: '40px', textAlign: 'center' }}>加载中...</div>;
  }

  return (
    <div>
      <h3 style={{ marginBottom: '20px', color: '#fff' }}>🤖 数字人形象配置</h3>

      {/* 提示信息 */}
      {message && (
        <div style={{
          ...styles.messageBox,
          backgroundColor: message.startsWith('✅') ? '#0a2e1a' : '#2e0a0a',
        }}>
          {message}
        </div>
      )}

      {/* 模型选择 */}
      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>👤 Live2D 模型</h4>
        <p style={styles.sectionDesc}>选择数字人的外观形象</p>

        <div style={styles.radioGroup}>
          {MODEL_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              style={{
                ...styles.radioLabel,
                borderColor: selectedModel === opt.value && !isCustom ? '#52c41a' : '#1f2937',
                backgroundColor: selectedModel === opt.value && !isCustom ? 'rgba(82, 196, 26, 0.1)' : '#0d1117',
              }}
            >
              <input
                type="radio"
                name="model"
                value={opt.value}
                checked={selectedModel === opt.value && !isCustom}
                onChange={() => {
                  setSelectedModel(opt.value);
                  if (opt.value === '__custom__') {
                    setIsCustom(true);
                  } else {
                    setIsCustom(false);
                  }
                }}
                style={{ marginRight: '8px' }}
              />
              {opt.label}
            </label>
          ))}
        </div>

        {/* 自定义模型路径 */}
        {isCustom && (
          <div style={styles.customRow}>
            <span style={{ color: '#888', fontSize: '13px', marginRight: '10px' }}>自定义路径：</span>
            <input
              style={styles.textInput}
              placeholder="/models/你的模型/model3.json"
              value={customModel}
              onChange={(e) => setCustomModel(e.target.value)}
            />
          </div>
        )}

        {/* 当前生效 */}
        <div style={styles.currentInfo}>
          <span style={{ color: '#888' }}>当前：</span>
          <code style={styles.currentPath}>{config?.model_path}</code>
        </div>
      </div>

      {/* 音色选择 */}
      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>🔊 TTS 语音音色</h4>
        <p style={styles.sectionDesc}>选择数字人的说话声音</p>

        <div style={styles.radioGroup}>
          {VOICE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              style={{
                ...styles.radioLabel,
                borderColor: selectedVoice === opt.value ? '#52c41a' : '#1f2937',
                backgroundColor: selectedVoice === opt.value ? 'rgba(82, 196, 26, 0.1)' : '#0d1117',
              }}
            >
              <input
                type="radio"
                name="voice"
                value={opt.value}
                checked={selectedVoice === opt.value}
                onChange={() => setSelectedVoice(opt.value)}
                style={{ marginRight: '8px' }}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {/* 保存按钮 */}
      <button
        style={styles.saveBtn}
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? '⏳ 保存中...' : '💾 保存配置'}
      </button>

      <div style={styles.hint}>
        💡 保存后，游客端刷新页面即可看到新形象和音色
      </div>
    </div>
  );
}

const styles = {
  section: {
    background: '#111827',
    border: '1px solid #1f2937',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '20px',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#e0e0e0',
    marginBottom: '4px',
  },
  sectionDesc: {
    fontSize: '13px',
    color: '#888',
    marginBottom: '16px',
  },
  radioGroup: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    marginBottom: '12px',
  },
  radioLabel: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 16px',
    borderRadius: '8px',
    border: '2px solid #1f2937',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#ccc',
    transition: 'all 0.2s',
  },
  customRow: {
    display: 'flex',
    alignItems: 'center',
    marginTop: '8px',
  },
  textInput: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #1f2937',
    background: '#0d1117',
    color: '#e0e0e0',
    fontSize: '13px',
    outline: 'none',
    fontFamily: 'monospace',
  },
  currentInfo: {
    marginTop: '12px',
    fontSize: '13px',
  },
  currentPath: {
    background: '#0d1117',
    padding: '4px 8px',
    borderRadius: '4px',
    color: '#52c41a',
    fontSize: '12px',
    fontFamily: 'monospace',
  },
  saveBtn: {
    width: '100%',
    padding: '14px',
    backgroundColor: '#2B6C4E',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    marginBottom: '12px',
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