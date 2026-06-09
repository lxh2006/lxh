'use client';

import { useState, useRef, useEffect, useReducer } from 'react';
import API_BASE from '@/config';

// ✅ 使用 useReducer 处理流式更新，比 useState 更可靠
function messagesReducer(state, action) {
  switch (action.type) {
    case 'ADD_USER_MESSAGE':
      return [...state, { role: 'user', content: action.payload }];
    case 'ADD_ASSISTANT_MESSAGE':
      return [...state, { role: 'assistant', content: '' }];
    case 'UPDATE_LAST_MESSAGE':
      const updated = [...state];
      updated[updated.length - 1] = {
        ...updated[updated.length - 1],
        content: action.payload,
      };
      return updated;
    default:
      return state;
  }
}

export default function ChatPanel({ onBack, preference, setPreference, preferences, autoGuideOn = false, onAutoGuideToggle }) {

  const [messages, dispatchMessages] = useReducer(messagesReducer, []);
  const [isRecording, setIsRecording] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInputValue, setTextInputValue] = useState('');
  const [showWelcome, setShowWelcome] = useState(true);
  const [chatHistory, setChatHistory] = useState([]);
  const [updateCount, setUpdateCount] = useState(0);
  const [showTagBar, setShowTagBar] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [weather, setWeather] = useState(null);

  const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null);
  const textInputRef = useRef(null);
  const audioPlayedRef = useRef(false);
  const lastAiMessageRef = useRef(null);
  
  // 音频管理相关 refs
  const activeAudiosRef = useRef(new Set());   // 当前正在播放的音频对象
  const lastAudioHashRef = useRef('');         // 最近播放的音频签名（用于去重）
  const lastAudioTimeRef = useRef(0);          // 最近播放时间戳

  // 自动滚动
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 展开文本输入时自动聚焦
  useEffect(() => {
    if (showTextInput) textInputRef.current?.focus();
  }, [showTextInput]);

  // 静音状态变化时，立即对当前所有正在播放的音频生效
  useEffect(() => {
    activeAudiosRef.current.forEach(audio => {
      audio.muted = isMuted;
    });
  }, [isMuted]);
  useEffect(() => {
    fetch(`${API_BASE}/api/weather`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') setWeather(data);
      })
      .catch(() => {});
  }, []);

  // 注入动画样式
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes dotPulse {
        0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
        40% { transform: scale(1); opacity: 1; }
      }
      @keyframes wave {
        0%, 100% { transform: scaleY(0.5); }
        50% { transform: scaleY(1); }
      }
      @keyframes pulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(255,77,77,0.4); }
        50% { box-shadow: 0 0 0 10px rgba(255,77,77,0); }
      }
      .dot:nth-child(2) { animation-delay: 0.2s; }
      .dot:nth-child(3) { animation-delay: 0.4s; }
      .waveBar:nth-child(2) { animation-delay: 0.1s; }
      .waveBar:nth-child(3) { animation-delay: 0.2s; }
      .waveBar:nth-child(4) { animation-delay: 0.3s; }
      .waveBar:nth-child(5) { animation-delay: 0.4s; }
      .quickTag:active {
        transform: scale(0.95);
        background: rgba(43, 108, 78, 0.1);
      }
      .keyboardButton:active, .moreButton:active {
        transform: scale(0.95);
      }
      .messagesContainer::-webkit-scrollbar {
        width: 4px;
      }
      .messagesContainer::-webkit-scrollbar-track {
        background: transparent;
      }
      .messagesContainer::-webkit-scrollbar-thumb {
        background: rgba(43, 108, 78, 0.3);
        border-radius: 2px;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // 监听快速提问事件
  useEffect(() => {
    const handler = (e) => {
      handleSendMessage(e.detail);
    };
    window.addEventListener('quickQuestion', handler);
    return () => window.removeEventListener('quickQuestion', handler);
  }, []);

  // 主动导览触发
  useEffect(() => {
    const handler = (e) => {
      handleSendMessage(e.detail.spotName, true, true);
    };
    window.addEventListener('autoGuide', handler);
    return () => window.removeEventListener('autoGuide', handler);
  }, []);

  // ---------- 音频打断：停止所有正在播放的音频 ----------
  const stopAllAudio = () => {
    activeAudiosRef.current.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
    activeAudiosRef.current.clear();
    // 重置 Live2D 口型
    const coreModel = window.live2dModel?.internalModel?.coreModel;
    if (coreModel) coreModel.setParameterValueById('ParamMouthOpenY', 0);
  };

  // ---------- 播放音频（带打断、去重、自动播放降级、静音控制）----------
  const playAudioWithLipSync = async (audioSrc, phonemes) => {
    if (!audioSrc) return;

    // 去重：500ms 内相同音频跳过
    const audioSignature = audioSrc.slice(0, 50);
    const now = Date.now();
    if (lastAudioHashRef.current === audioSignature && (now - lastAudioTimeRef.current) < 500) {
      console.log('[Audio] 重复音频，跳过');
      return;
    }
    lastAudioHashRef.current = audioSignature;
    lastAudioTimeRef.current = now;

    // 打断：播放新音频前，停止所有旧音频
    stopAllAudio();

    let fullSrc = audioSrc;
    if (!audioSrc.startsWith('data:')) {
      fullSrc = 'data:audio/mp3;base64,' + audioSrc;
    }

    const audio = new Audio(fullSrc);
    const coreModel = window.live2dModel?.internalModel?.coreModel;

    // 自动播放策略：先尝试正常播放，失败则静音播放降级
    try {
      await audio.play();
      audio.muted = isMuted;
    } catch (err) {
      console.warn('[Audio] 自动播放被阻止，尝试静音播放', err);
      audio.muted = true;
      try {
        await audio.play();
      } catch (e) {
        console.error('[Audio] 完全无法播放:', e);
        return;
      }
    }

    // 管理活跃音频集合
    activeAudiosRef.current.add(audio);
    const removeAudio = () => {
      activeAudiosRef.current.delete(audio);
      if (coreModel) coreModel.setParameterValueById('ParamMouthOpenY', 0);
    };
    audio.addEventListener('ended', removeAudio);
    audio.addEventListener('error', removeAudio);

    // 口型同步
    if (phonemes && phonemes.length > 0 && coreModel) {
      const updateMouth = () => {
        const currentTime = audio.currentTime;
        const currentPhoneme = phonemes.find(p => currentTime >= p.start && currentTime <= p.end);
        if (currentPhoneme) {
          const isOpen = /[aoe]/i.test(currentPhoneme.word);
          coreModel.setParameterValueById('ParamMouthOpenY', isOpen ? 0.8 : 0.2);
        } else {
          coreModel.setParameterValueById('ParamMouthOpenY', 0);
        }
      };
      audio.addEventListener('timeupdate', updateMouth);
      audio.addEventListener('ended', () => audio.removeEventListener('timeupdate', updateMouth));
    }
  };

  // 发送消息
  const handleSendMessage = async (text, isAuto = false, isAutoGuide = false) => {
    if (!text.trim()) return;

    setShowMessages(true);
    setShowTextInput(false);
    setTextInputValue('');

    if (!isAuto) {
      dispatchMessages({ type: 'ADD_USER_MESSAGE', payload: text });
    }
    dispatchMessages({ type: 'ADD_ASSISTANT_MESSAGE' });
    setIsThinking(true);

    setChatHistory(prev => {
      const updated = [...prev, { role: 'user', content: text }];
      return updated.slice(-20);
    });

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: isAutoGuide ? text : text,
          preference: preference,
          is_auto_guide: isAutoGuide,
          top_k: 3,
          use_ai: true,
          enable_tts: true,
          tts_voice: 'zh-CN-XiaoxiaoNeural',
          stream: true,
          history: chatHistory.slice(-10)
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullAnswer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        const events = buffer.split('\n\n');
        buffer = events.pop();

        for (const eventStr of events) {
          if (!eventStr.trim()) continue;
          const lines = eventStr.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const jsonStr = line.slice(6).trim();
                if (!jsonStr) continue;
                const data = JSON.parse(jsonStr);

                if (data.type === 'chunk') {
                  if (data.content) {
                    fullAnswer += data.content;
                    if (lastAiMessageRef.current) {
                      lastAiMessageRef.current.textContent = fullAnswer;
                    }
                    dispatchMessages({ type: 'UPDATE_LAST_MESSAGE', payload: fullAnswer });
                  }
                } else if (data.type === 'audio') {
                  playAudioWithLipSync(data.audio_base64, data.phonemes);
                } else if (data.type === 'error') {
                  dispatchMessages({
                    type: 'UPDATE_LAST_MESSAGE',
                    payload: `抱歉，系统出现错误：${data.detail || '未知错误'}`
                  });
                  setIsThinking(false);
                } else if (data.type === 'done') {
                  let phonemes = data.phonemes;
                  if ((!phonemes || phonemes.length === 0) && data.answer) {
                    const words = data.answer.split('');
                    phonemes = words.map((word, i) => ({
                      word,
                      start: i * 0.22,
                      end: (i + 1) * 0.22,
                    }));
                  }
                  if (data.audio_base64) {
                    playAudioWithLipSync(data.audio_base64, phonemes || []);
                  }
                  if (fullAnswer && fullAnswer.trim()) {
                    setChatHistory(prev => {
                      const updated = [
                        ...prev,
                        { role: 'user', content: text },
                        { role: 'assistant', content: fullAnswer }
                      ];
                      return updated.slice(-10);
                    });
                  }
                  setIsThinking(false);
                }
              } catch (parseErr) {
                console.error('SSE 解析失败:', line, parseErr);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('请求失败:', error);
      dispatchMessages({
        type: 'UPDATE_LAST_MESSAGE',
        payload: '抱歉，网络好像不太好，请再试一次~'
      });
      setIsThinking(false);
    }
  };

  // 语音识别
  const startRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setIsRecording(true);
      const recognition = new SpeechRecognition();
      recognition.lang = 'zh-CN';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognitionRef.current = recognition;

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript.trim()) {
          handleSendMessage(transcript);
        }
        setIsRecording(false);
      };

      recognition.onerror = (event) => {
        console.error('语音识别错误:', event.error);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.start();
    } else {
      setShowTextInput(true);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) recognitionRef.current.stop();
    setIsRecording(false);
  };

  const handleTextSubmit = () => {
    handleSendMessage(textInputValue);
  };

  const quickQuestions = [
    { label: '🏞️ 景点', query: '介绍一下主要景点' },
    { label: '🗺️ 路线', query: '推荐游览路线' },
    { label: '⏰ 时间', query: '景区开放时间' },
    { label: '🎫 门票', query: '门票价格和购买方式' },
    { label: '🍜 餐饮', query: '景区内餐饮推荐' },
    { label: '🏠 住宿', query: '附近住宿推荐' },
  ];

  return (
    <div style={styles.container}>
      {/* 顶部导航栏 */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.locationIcon}>📍</span>
          <span style={styles.locationText}>灵山风景区</span>
          <span style={styles.dropdownArrow}>▼</span>
        </div>
        <div style={styles.headerCenter}>
          {weather ? (
            <>
              <span style={styles.weatherIcon}>
                {weather.text === '晴' ? '☀️' : weather.text === '阴' ? '☁️' : weather.text === '雨' ? '🌧️' : '⛅'}
              </span>
              <span style={styles.weatherText}>{weather.text} {weather.temp}°C</span>
            </>
          ) : (
            <>
              <span style={styles.weatherIcon}>🌤️</span>
              <span style={styles.weatherText}>加载中...</span>
            </>
          )}
        </div>
        <div style={styles.headerRightButtons}>
          {/* 静音按钮 */}
          <button
            style={styles.silenceButton}
            onClick={() => setIsMuted(!isMuted)}
            title={isMuted ? "取消静音" : "静音"}
          >
            <span style={styles.silenceIcon}>{isMuted ? '🔇' : '🔊'}</span>
          </button>
          {/* 主动导览按钮 */}
          <button
            style={autoGuideOn ? styles.autoGuideButtonActive : styles.autoGuideButton}
            onClick={() => {
              onAutoGuideToggle && onAutoGuideToggle();
            }}
          >
            <span style={styles.autoGuideIcon}>{autoGuideOn ? '✅' : '🔕'}</span>
            <span style={styles.autoGuideText}>{autoGuideOn ? '导览中' : '开启主动导览'}</span>
          </button>
        </div>
      </div>

      {/* 分类标签栏 */}
      <div style={{ ...styles.tagBar, maxHeight: showTagBar ? '60px' : '0px' }}>
        <div style={styles.tagContainer}>
          {preferences?.map((p) => (
            <button
              key={p.value}
              style={{
                ...styles.tagItem,
                backgroundColor: preference === p.value ? '#2B6C4E' : '#fff',
                color: preference === p.value ? '#fff' : '#2B6C4E',
                borderColor: preference === p.value ? '#2B6C4E' : '#ddd',
              }}
              onClick={() => setPreference?.(preference === p.value ? '' : p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 数字人区域 */}
      <div style={styles.digitalPersonArea}>
        <div style={styles.characterContainer}></div>
      </div>

      {/* 消息展示区域 */}
      <div style={styles.messagesWrapper}>
        {showMessages && (
          <div style={styles.messagesContainer}>
            {messages.map((msg, i) => (
              <div key={i} style={styles.messageWrapper}>
                {msg.role === 'user' ? (
                  <div style={styles.userMessage}>
                    <div style={styles.userAvatar}>👤</div>
                    <div style={styles.userBubble}>{msg.content}</div>
                  </div>
                ) : (
                  <div style={styles.aiMessage}>
                    <div style={styles.aiAvatar}>🧑‍🦰</div>
                    <div
                      style={styles.aiBubble}
                      ref={i === messages.length - 1 ? lastAiMessageRef : null}
                    >{msg.content}</div>
                  </div>
                )}
              </div>
            ))}
            {isThinking && (
              <div style={styles.thinkingMessage}>
                <div style={styles.aiAvatar}>🧑‍🦰</div>
                <div style={styles.thinkingBubble}>
                  <div style={styles.thinkingDots}>
                    <span style={styles.dot}></span>
                    <span style={styles.dot}></span>
                    <span style={styles.dot}></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 底部操作栏 */}
      <div style={styles.bottomBar}>
        <div style={styles.quickQuestionsArea}>
          <div style={styles.quickTags}>
            {quickQuestions.map((item, i) => (
              <button
                key={i}
                style={styles.quickTag}
                onClick={() => handleSendMessage(item.query)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {showTextInput && (
          <div style={styles.textInputContainer}>
            <input
              ref={textInputRef}
              style={styles.textInput}
              placeholder="输入您的问题..."
              value={textInputValue}
              onChange={(e) => setTextInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTextSubmit();
              }}
            />
            <button style={styles.sendButton} onClick={handleTextSubmit}>
              <span style={styles.sendIcon}>➤</span>
            </button>
          </div>
        )}

        <div style={styles.actionsBar}>
          <button
            style={styles.keyboardButton}
            onClick={() => setShowTextInput(!showTextInput)}
          >
            <span style={styles.keyboardIcon}>{showTextInput ? '🔊' : '⌨️'}</span>
          </button>

          <button
            style={{
              ...styles.micButton,
              backgroundColor: isRecording ? '#ff4d4d' : '#2B6C4E',
              boxShadow: isRecording
                ? '0 0 20px rgba(255,77,77,0.6)'
                : '0 4px 16px rgba(43,108,78,0.4)',
              animation: isRecording ? 'pulse 1s infinite' : 'none',
            }}
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
          >
            <span style={styles.micIcon}>{isRecording ? '⏹️' : '🎤'}</span>
            {isRecording ? (
              <span style={styles.recordingText}>说话中...</span>
            ) : (
              <span style={styles.holdToSpeakText}>按住说话</span>
            )}
          </button>

          <button style={styles.moreButton} onClick={() => setShowTagBar(!showTagBar)}>
            <span style={styles.moreIcon}>⋮</span>
          </button>
        </div>
      </div>

      {isRecording && (
        <div style={styles.waveContainer}>
          <div style={styles.waveBar}></div>
          <div style={styles.waveBar}></div>
          <div style={styles.waveBar}></div>
          <div style={styles.waveBar}></div>
          <div style={styles.waveBar}></div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'transparent',
    paddingBottom: '120px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  tagBar: {
    overflow: 'hidden',
    background: '#fff',
    padding: '0 16px',
    transition: 'maxHeight 0.3s ease-in-out',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  },
  tagContainer: {
    display: 'flex',
    gap: '16px',
    overflowX: 'auto',
  },
  tagItem: {
    padding: '8px 16px',
    background: '#f0f4f2',
    border: 'none',
    borderRadius: '20px',
    fontSize: '14px',
    color: '#2B6C4E',
    fontWeight: '500',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'all 0.2s ease',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 16px',
    background: '#fff',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    height: '44px',
    transition: 'margin-top 0.3s ease-in-out',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  locationIcon: {
    fontSize: '14px',
  },
  locationText: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#333',
  },
  dropdownArrow: {
    fontSize: '10px',
    color: '#666',
  },
  headerCenter: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  weatherIcon: {
    fontSize: '14px',
  },
  weatherText: {
    fontSize: '12px',
    color: '#666',
  },
  headerRightButtons: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  silenceButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px 8px',
    background: '#f5f5f5',
    borderRadius: '16px',
    border: '1px solid #e0e0e0',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  silenceIcon: {
    fontSize: '14px',
  },
  autoGuideButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 12px',
    background: '#f5f5f5',
    borderRadius: '16px',
    border: '1px solid #e0e0e0',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  autoGuideButtonActive: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 12px',
    background: '#2B6C4E',
    borderRadius: '16px',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  autoGuideIcon: {
    fontSize: '12px',
  },
  autoGuideText: {
    fontSize: '12px',
    fontWeight: '500',
    color: '#333',
  },
  digitalPersonArea: { padding: '24px', position: 'relative', height: '300px' },
  characterContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' },
  messagesWrapper: {
    position: 'fixed',
    bottom: '108px',
    left: '0',
    right: '0',
    background: 'transparent',
    borderRadius: '20px 20px 0 0',
    padding: '16px',
    paddingBottom: '20px',
    zIndex: 50,
    maxHeight: '280px',
    overflow: 'hidden',
  },
  messagesContainer: { width: '100%', maxHeight: '129px', overflowY: 'auto', paddingRight: '8px' },
  messageWrapper: { marginBottom: '16px' },
  userMessage: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    gap: '10px',
  },
  userAvatar: {
    width: '36px',
    height: '36px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    flexShrink: 0,
  },
  userBubble: {
    background: 'linear-gradient(135deg, #2B6C4E 0%, #3A8F5F 100%)',
    color: '#fff',
    padding: '12px 18px',
    borderRadius: '20px 20px 4px 20px',
    maxWidth: '75%',
    fontSize: '14px',
    lineHeight: '1.5',
    boxShadow: '0 4px 12px rgba(43, 108, 78, 0.3)',
  },
  aiMessage: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
  },
  aiAvatar: {
    width: '36px',
    height: '36px',
    background: 'linear-gradient(135deg, #fff 0%, #f8f9fa 100%)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    flexShrink: 0,
  },
  aiBubble: {
    background: '#fff',
    color: '#333',
    padding: '14px 18px',
    borderRadius: '20px 20px 20px 4px',
    maxWidth: '75%',
    fontSize: '14px',
    lineHeight: '1.6',
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
  },
  thinkingMessage: { display: 'flex', alignItems: 'flex-start', gap: '10px' },
  thinkingBubble: {
    background: '#fff',
    padding: '14px 20px',
    borderRadius: '20px 20px 20px 4px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
  },
  thinkingDots: { display: 'flex', gap: '8px', alignItems: 'center' },
  dot: {
    width: '8px',
    height: '8px',
    background: '#2B6C4E',
    borderRadius: '50%',
    animation: 'dotPulse 1.4s infinite ease-in-out',
  },
  quickQuestionsArea: { padding: '12px 0 8px', overflowX: 'auto', overflowY: 'hidden', whiteSpace: 'nowrap' },
  quickTags: { display: 'inline-flex', gap: '10px', padding: '0 8px' },
  quickTag: {
    background: '#fff',
    border: '1px solid rgba(43, 108, 78, 0.2)',
    borderRadius: '16px',
    padding: '6px 14px',
    fontSize: '12px',
    color: '#2B6C4E',
    fontWeight: '400',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    flexShrink: 0,
  },
  bottomBar: {
    position: 'fixed',
    bottom: '0',
    left: '0',
    right: '0',
    background: 'rgba(255,255,255,0.95)',
    backdropFilter: 'blur(20px)',
    padding: '10px 16px',
    paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
    boxShadow: '0 -4px 20px rgba(0,0,0,0.05)',
    zIndex: 100,
  },
  textInputContainer: {
    display: 'flex',
    alignItems: 'center',
    background: '#f0f4f2',
    borderRadius: '24px',
    padding: '4px 4px 4px 16px',
    marginBottom: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  },
  textInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: '14px',
    color: '#333',
  },
  sendButton: {
    width: '36px',
    height: '36px',
    background: 'linear-gradient(135deg, #2B6C4E 0%, #3A8F5F 100%)',
    borderRadius: '50%',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 3px 10px rgba(43, 108, 78, 0.3)',
  },
  sendIcon: { color: '#fff', fontSize: '16px' },
  actionsBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '20px',
  },
  keyboardButton: {
    width: '44px',
    height: '44px',
    background: '#fff',
    border: '2px solid #e0e0e0',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  keyboardIcon: { fontSize: '20px' },
  micButton: {
    width: '100px',
    height: '56px',
    borderRadius: '28px',
    border: 'none',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  micIcon: { fontSize: '22px' },
  recordingText: { fontSize: '9px', color: '#fff', marginTop: '2px' },
  holdToSpeakText: { fontSize: '11px', color: '#fff', fontWeight: '500', marginTop: '2px' },
  moreButton: {
    width: '44px',
    height: '44px',
    background: '#fff',
    border: '2px solid #e0e0e0',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  moreIcon: { fontSize: '20px', color: '#666' },
  waveContainer: {
    position: 'fixed',
    bottom: 'calc(80px + env(safe-area-inset-bottom))',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
    padding: '10px 16px',
    background: 'rgba(255,77,77,0.9)',
    borderRadius: '20px',
    zIndex: 99,
  },
  waveBar: {
    width: '4px',
    height: '24px',
    background: '#fff',
    borderRadius: '2px',
    animation: 'wave 0.8s infinite ease-in-out',
  },
};