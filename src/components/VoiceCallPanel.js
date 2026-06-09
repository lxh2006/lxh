'use client';
import { useState, useRef, useCallback, useEffect } from 'react';

export default function VoiceCallPanel() {
  // 注入动画样式
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
      @keyframes dotPulse {
        0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
        40% { transform: scale(1); opacity: 1; }
      }
      .voice-call-dot:nth-child(2) { animation-delay: 0.2s; }
      .voice-call-dot:nth-child(3) { animation-delay: 0.4s; }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  const [callStatus, setCallStatus] = useState('idle'); // idle, connecting, calling, ended
  const [messages, setMessages] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  
  const wsRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const streamRef = useRef(null);
  const audioIntervalRef = useRef(null);

  // 建立 WebSocket 连接
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
    const ws = new WebSocket('ws://localhost:8000/api/ws/voice-chat');
    
    ws.onopen = () => {
      console.log('[VoiceCall] WebSocket 连接成功');
      setCallStatus('calling');
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (err) {
        console.error('[VoiceCall] 消息解析失败:', err);
      }
    };
    
    ws.onerror = (error) => {
      console.error('[VoiceCall] WebSocket 错误:', error);
      setCallStatus('ended');
    };
    
    ws.onclose = () => {
      console.log('[VoiceCall] WebSocket 连接关闭');
      if (callStatus !== 'ended') {
        setCallStatus('ended');
      }
    };
    
    wsRef.current = ws;
  }, [callStatus]);

  // 处理 WebSocket 消息
  const handleWebSocketMessage = useCallback((data) => {
    console.log('[VoiceCall] 收到消息:', data.type);
    
    switch (data.type) {
      case 'text':
        setMessages(prev => [...prev, { type: 'ai', content: data.text }]);
        break;
        
      case 'audio':
        setMessages(prev => [...prev, { type: 'ai', content: '🎤 正在播放回复...' }]);
        playAudio(data.audio_base64);
        break;
        
      case 'error':
        const errorMsg = data.message || data.error || data.msg || '未知错误';
        console.error('[VoiceCall] 服务端错误:', errorMsg);
        setMessages(prev => [...prev, { type: 'system', content: `错误: ${errorMsg}` }]);
        break;
        
      case 'ended':
        console.log('[VoiceCall] 通话结束');
        setCallStatus('ended');
        break;
        
      default:
        console.log('[VoiceCall] 未知消息类型:', data.type);
    }
  }, []);

  // 播放音频
  const playAudio = useCallback((audioBase64) => {
    if (!audioBase64) return;
    
    let audioSrc = audioBase64;
    if (!audioSrc.startsWith('data:')) {
      audioSrc = 'data:audio/mp3;base64,' + audioBase64;
    }
    
    const audio = new Audio(audioSrc);
    audio.play().then(() => {
      console.log('[VoiceCall] 音频播放开始');
    }).catch(err => {
      console.error('[VoiceCall] 音频播放失败:', err);
    });
  }, []);

  // 开始录音
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // 设置音频分析器（用于显示音量）
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;
      dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);
      
      // 录制音频
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      const chunks = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Data = reader.result.split(',')[1];
          sendAudio(base64Data);
        };
        reader.readAsDataURL(blob);
      };
      
      mediaRecorder.start(100); // 每100ms发送一次数据
      setIsRecording(true);
      
      // 更新音量显示
      audioIntervalRef.current = setInterval(() => {
        if (analyserRef.current && dataArrayRef.current) {
          analyserRef.current.getByteFrequencyData(dataArrayRef.current);
          const average = dataArrayRef.current.reduce((a, b) => a + b) / dataArrayRef.current.length;
          setAudioLevel(average / 255);
        }
      }, 50);
      
    } catch (err) {
      console.error('[VoiceCall] 录音启动失败:', err);
      alert('无法访问麦克风，请检查权限设置');
    }
  }, []);

  // 发送音频数据
  const sendAudio = useCallback((base64Data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'audio',
        audio_base64: base64Data,
      }));
    }
  }, []);

  // 停止录音
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    
    if (audioIntervalRef.current) {
      clearInterval(audioIntervalRef.current);
      audioIntervalRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    setIsRecording(false);
    setAudioLevel(0);
  }, []);

  // 开始通话
  const startCall = useCallback(() => {
    setMessages([]);
    setCallStatus('connecting');
    connectWebSocket();
    setTimeout(() => {
      if (callStatus === 'calling') {
        setMessages(prev => [...prev, { type: 'system', content: '🎙️ 通话已连接，开始说话...' }]);
      }
    }, 500);
  }, [connectWebSocket, callStatus]);

  // 结束通话
  const endCall = useCallback(() => {
    stopRecording();
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setCallStatus('ended');
    setMessages(prev => [...prev, { type: 'system', content: '📞 通话已结束' }]);
  }, [stopRecording]);

  // 切换录音状态
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
      setMessages(prev => [...prev, { type: 'user', content: '🎤 已停止录音' }]);
    } else {
      startRecording();
      setMessages(prev => [...prev, { type: 'user', content: '🎤 正在录音...' }]);
    }
  }, [isRecording, startRecording, stopRecording]);

  // 清理资源
  useEffect(() => {
    return () => {
      stopRecording();
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [stopRecording]);

  return (
    <div style={styles.container}>
      {/* 通话状态显示 */}
      <div style={styles.statusBar}>
        <div style={{ ...styles.statusIndicator, backgroundColor: callStatus === 'calling' ? '#2B6C4E' : '#ff4d4d' }} />
        <span style={styles.statusText}>
          {callStatus === 'idle' && '等待连接'}
          {callStatus === 'connecting' && '连接中...'}
          {callStatus === 'calling' && '通话中'}
          {callStatus === 'ended' && '通话结束'}
        </span>
      </div>

      {/* 对话历史 */}
      <div style={styles.messagesContainer}>
        {messages.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📞</div>
            <div style={styles.emptyText}>点击下方按钮开始通话</div>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={index} style={{ ...styles.message, justifyContent: msg.type === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{ ...styles.messageBubble, backgroundColor: getMessageColor(msg.type) }}>
                {msg.content}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 音量指示器（录音时显示） */}
      {isRecording && (
        <div style={styles.volumeContainer}>
          <div style={styles.volumeBar}>
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                style={{
                  ...styles.volumeSegment,
                  height: `${Math.max(4, audioLevel * 100)}%`,
                  opacity: audioLevel > 0.1 ? 0.3 + audioLevel * 0.7 : 0.2,
                }}
              />
            ))}
          </div>
          <span style={styles.volumeText}>🎤 录音中...</span>
        </div>
      )}

      {/* 操作按钮 */}
      <div style={styles.actionsContainer}>
        {callStatus === 'idle' && (
          <button style={styles.callButton} onClick={startCall}>
            <span style={styles.callIcon}>📞</span>
            <span style={styles.callText}>开始通话</span>
          </button>
        )}
        
        {callStatus === 'connecting' && (
          <div style={styles.connectingIndicator}>
            <div style={styles.connectingDots}>
              <span className="voice-call-dot" style={styles.dot}></span>
              <span className="voice-call-dot" style={styles.dot}></span>
              <span className="voice-call-dot" style={styles.dot}></span>
            </div>
            <span style={styles.connectingText}>连接中...</span>
          </div>
        )}
        
        {callStatus === 'calling' && (
          <>
            <button style={{ ...styles.recordButton, backgroundColor: isRecording ? '#ff4d4d' : '#2B6C4E' }} onClick={toggleRecording}>
              <span style={styles.recordIcon}>{isRecording ? '⏹️' : '🎤'}</span>
              <span style={styles.recordText}>{isRecording ? '停止' : '录音'}</span>
            </button>
            
            <button style={styles.hangupButton} onClick={endCall}>
              <span style={styles.hangupIcon}>🔴</span>
              <span style={styles.hangupText}>挂断</span>
            </button>
          </>
        )}
        
        {callStatus === 'ended' && (
          <button style={styles.callButton} onClick={startCall}>
            <span style={styles.callIcon}>📞</span>
            <span style={styles.callText}>再次通话</span>
          </button>
        )}
      </div>
    </div>
  );
}

// 获取消息气泡颜色
function getMessageColor(type) {
  switch (type) {
    case 'user':
      return '#2B6C4E';
    case 'ai':
      return '#fff';
    case 'system':
      return '#f0f0f0';
    default:
      return '#fff';
  }
}

const styles = {
  container: {
    position: 'fixed',
    bottom: '0',
    left: '0',
    right: '0',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(245,240,232,0.98) 100%)',
    borderRadius: '24px 24px 0 0',
    padding: '20px 24px',
    paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
    boxShadow: '0 -4px 30px rgba(0,0,0,0.1)',
    zIndex: 1000,
    maxHeight: '70vh',
    display: 'flex',
    flexDirection: 'column',
  },
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
    padding: '10px 16px',
    background: 'rgba(43, 108, 78, 0.1)',
    borderRadius: '20px',
  },
  statusIndicator: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    animation: 'pulse 2s infinite',
  },
  statusText: {
    fontSize: '14px',
    color: '#2B6C4E',
    fontWeight: '500',
  },
  messagesContainer: {
    flex: 1,
    overflowY: 'auto',
    marginBottom: '16px',
    maxHeight: '300px',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '30px',
    color: '#999',
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '12px',
  },
  emptyText: {
    fontSize: '14px',
  },
  message: {
    display: 'flex',
    marginBottom: '12px',
  },
  messageBubble: {
    padding: '12px 18px',
    borderRadius: '20px',
    maxWidth: '70%',
    fontSize: '14px',
    lineHeight: '1.5',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  },
  volumeContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    background: 'rgba(255,77,77,0.1)',
    borderRadius: '16px',
    marginBottom: '16px',
  },
  volumeBar: {
    display: 'flex',
    gap: '3px',
    height: '40px',
    width: '100%',
    alignItems: 'flex-end',
  },
  volumeSegment: {
    flex: 1,
    background: '#ff4d4d',
    borderRadius: '2px',
    transition: 'height 0.1s ease',
  },
  volumeText: {
    fontSize: '12px',
    color: '#ff4d4d',
    fontWeight: '500',
    flexShrink: 0,
  },
  actionsContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '20px',
  },
  callButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    padding: '16px 40px',
    background: 'linear-gradient(135deg, #2B6C4E 0%, #3A8F5F 100%)',
    border: 'none',
    borderRadius: '24px',
    color: '#fff',
    cursor: 'pointer',
    boxShadow: '0 8px 24px rgba(43, 108, 78, 0.4)',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  callIcon: {
    fontSize: '28px',
  },
  callText: {
    fontSize: '14px',
    fontWeight: '500',
  },
  connectingIndicator: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '20px 40px',
  },
  connectingDots: {
    display: 'flex',
    gap: '8px',
  },
  dot: {
    width: '8px',
    height: '8px',
    background: '#2B6C4E',
    borderRadius: '50%',
    animation: 'dotPulse 1.4s infinite ease-in-out',
  },
  connectingText: {
    fontSize: '14px',
    color: '#2B6C4E',
  },
  recordButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    padding: '14px 32px',
    border: 'none',
    borderRadius: '20px',
    color: '#fff',
    cursor: 'pointer',
    boxShadow: '0 6px 20px rgba(43, 108, 78, 0.3)',
    transition: 'transform 0.2s',
  },
  recordIcon: {
    fontSize: '24px',
  },
  recordText: {
    fontSize: '13px',
    fontWeight: '500',
  },
  hangupButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    padding: '14px 32px',
    background: '#ff4d4d',
    border: 'none',
    borderRadius: '20px',
    color: '#fff',
    cursor: 'pointer',
    boxShadow: '0 6px 20px rgba(255,77,77,0.4)',
    transition: 'transform 0.2s',
  },
  hangupIcon: {
    fontSize: '24px',
  },
  hangupText: {
    fontSize: '13px',
    fontWeight: '500',
  },
};
