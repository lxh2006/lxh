'use client';
import { useState, useEffect, useRef } from 'react';
import API_BASE from '@/config';

const ALL_SPOTS = ['大佛寺', '天子山', '金鞭溪', '迎客松', '光明顶', '飞来石', '玉屏楼', '莲花峰'];

// 圆角矩形工具
const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

// 文字换行
const wrapText = (ctx, text, maxWidth) => {
  const lines = [];
  let line = '';
  for (let i = 0; i < text.length; i++) {
    const testLine = line + text[i];
    if (ctx.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = text[i];
    } else {
      line = testLine;
    }
  }
  if (line) lines.push(line);
  return lines;
};

export default function TravelMemoryCenter({ onBack, preference }) {
  const [image, setImage] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [memories, setMemories] = useState([]);
  const [poster, setPoster] = useState(null);
  const fileInputRef = useRef(null);
  const currentPhotoRef = useRef(null);


  const [isPlaying, setIsPlaying] = useState(false);
  const [detailAudio, setDetailAudio] = useState(null);
  const [detailPhonemes, setDetailPhonemes] = useState([]);
  const audioRef = useRef(null);

  // 从 localStorage 加载已有记忆
  useEffect(() => {
    const saved = localStorage.getItem('travel_memories');
    if (saved) setMemories(JSON.parse(saved));
  }, []);

  // 拍照
  const handleCapture = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImage(reader.result);
      currentPhotoRef.current = reader.result; 
      recognizeImage(reader.result.split(',')[1]);
    };
    reader.readAsDataURL(file);
  };

  // 识别
  const recognizeImage = async (base64Data) => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/vision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: base64Data, tts_voice: 'zh-CN-XiaoxiaoNeural', preference: preference || '' })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setResult(data);
        // 播放语音
        if (data.audio_base64) playAudio(data.audio_base64, data.phonemes || []);
        // 保存详细讲解的音频和音素，但不自动播放
        setDetailAudio(data.detail_audio_base64);
        setDetailPhonemes(data.detail_phonemes || []);
        // 记录记忆
        addMemory(data);
      } else {
        setResult({ description: '识别失败，请换个角度再试' });
      }
    } catch (err) {
      setResult({ description: '网络错误，请稍后重试' });
    } finally {
      setLoading(false);
    }
  };


  // 播放音频
  const playAudio = (src, phonemes) => {
    const fullSrc = src.startsWith('data:') ? src : `data:audio/mp3;base64,${src}`;
    const audio = new Audio(fullSrc);
    const coreModel = window.live2dModel?.internalModel?.coreModel;
    if (coreModel && phonemes?.length) {
      audio.addEventListener('timeupdate', () => {
        const current = audio.currentTime;
        const w = phonemes.find(p => current >= p.start && current <= p.end);
        coreModel.setParameterValueById('ParamMouthOpenY', w ? (/[aoe]/i.test(w.word) ? 0.8 : 0.2) : 0);
      });
      audio.addEventListener('ended', () => coreModel.setParameterValueById('ParamMouthOpenY', 0));
    }
    audio.play().catch(e => {});
  };
  // 切换讲解音频播放
  const togglePlay = () => {
  if (!detailAudio) return;
  if (isPlaying) {
    // 暂停
    audioRef.current?.pause();
    setIsPlaying(false);
  } else {
    // 播放
    const fullSrc = detailAudio.startsWith('data:') ? detailAudio : `data:audio/mp3;base64,${detailAudio}`;
    const audio = new Audio(fullSrc);
    audioRef.current = audio;

    // 口型同步
    const coreModel = window.live2dModel?.internalModel?.coreModel;
    if (coreModel && detailPhonemes.length > 0) {
      audio.addEventListener('timeupdate', () => {
        const current = audio.currentTime;
        const w = detailPhonemes.find(p => current >= p.start && current <= p.end);
        coreModel.setParameterValueById('ParamMouthOpenY', w ? (/[aoe]/i.test(w.word) ? 0.8 : 0.2) : 0);
      });
      audio.addEventListener('ended', () => {
        coreModel.setParameterValueById('ParamMouthOpenY', 0);
        setIsPlaying(false);
        audioRef.current = null;
      });
    } else {
      audio.addEventListener('ended', () => {
        setIsPlaying(false);
        audioRef.current = null;
      });
    }

    audio.play().catch(() => {});
    setIsPlaying(true);
  }
 };

  // 添加旅行记忆
  const addMemory = (data) => {
    const newMemory = {
      id: Date.now(),
      time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      spot: data.description?.slice(0, 20) || '未知景点',
      description: data.description || '',
      diary: data.contents?.diary || '',
      xiaohongshu: data.contents?.xiaohongshu || '',
      photo: currentPhotoRef.current,
    };
    const updated = [...memories, newMemory];
    setMemories(updated);
    localStorage.setItem('travel_memories', JSON.stringify(updated));
  };

  // 打卡进度
  const checkedInSpots = [...new Set(memories.map(m => m.spot))];
  const progress = Math.min(100, Math.round((checkedInSpots.length / ALL_SPOTS.length) * 100));



  // Canvas 绘制海报
const drawPoster = (canvas, posterData, memories) => {
  const ctx = canvas.getContext('2d');
  const W = 750;   // 海报宽度
  const H = 1200;  // 海报高度
  canvas.width = W;
  canvas.height = H;

  // 背景渐变
  const gradient = ctx.createLinearGradient(0, 0, 0, H);
  gradient.addColorStop(0, '#e8f5e9');
  gradient.addColorStop(0.3, '#c8e6c9');
  gradient.addColorStop(1, '#a5d6a7');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  // 顶部装饰条
  ctx.fillStyle = '#2B6C4E';
  ctx.fillRect(0, 0, W, 80);

  // 标题
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 42px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🏞️ 我的景区之旅', W / 2, 55);

  // 日期
  ctx.fillStyle = '#555';
  ctx.font = '24px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillText(`📅 ${posterData.date}`, W / 2, 120);

  // 照片区域（取最近一张照片）
  const lastMemory = memories[memories.length - 1];
  if (lastMemory && lastMemory.photo) {
    const img = new Image();
    img.src = lastMemory.photo;
    img.onload = () => {
      const imgW = 650;
      const imgH = 400;
      const imgX = (W - imgW) / 2;
      const imgY = 150;
      ctx.fillStyle = '#fff';
      ctx.fillRect(imgX - 8, imgY - 8, imgW + 16, imgH + 16);
      ctx.drawImage(img, imgX, imgY, imgW, imgH);
      drawRest(ctx, W, posterData, lastMemory);
    };
    // 同步处理：如果图片已加载，直接绘制
    if (img.complete) {
      const imgW = 650;
      const imgH = 400;
      const imgX = (W - imgW) / 2;
      const imgY = 150;
      ctx.fillStyle = '#fff';
      ctx.fillRect(imgX - 8, imgY - 8, imgW + 16, imgH + 16);
      ctx.drawImage(img, imgX, imgY, imgW, imgH);
      drawRest(ctx, W, posterData, lastMemory);
    }
  } else {
    drawRest(ctx, W, posterData, null, 150);
  }
};

// 绘制剩余部分（打卡列表、日记、进度条）
const drawRest = (ctx, W, posterData, lastMemory, startY = 570) => {
  let y = startY;

  // 打卡列表
  ctx.fillStyle = '#333';
  ctx.font = 'bold 28px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('✅ 已打卡景点', 60, y);
  y += 50;

  ctx.font = '24px "PingFang SC", "Microsoft YaHei", sans-serif';
  posterData.spots.forEach((spot, i) => {
    ctx.fillStyle = '#2B6C4E';
    ctx.fillText(`  ${i + 1}.  ${spot}`, 60, y);
    y += 44;
  });

  y += 30;

  // 旅行感悟
  if (lastMemory?.diary) {
    ctx.fillStyle = '#333';
    ctx.font = 'bold 28px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText('📔 旅行感悟', 60, y);
    y += 50;
    ctx.fillStyle = '#555';
    ctx.font = '22px "PingFang SC", "Microsoft YaHei", sans-serif';
    const lines = wrapText(ctx, lastMemory.diary, W - 120);
    lines.forEach(line => {
      ctx.fillText(line, 60, y);
      y += 38;
    });
  }

  y += 40;

  // 进度条
  ctx.fillStyle = '#333';
  ctx.font = 'bold 28px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillText('🎉 今日探索度', 60, y);
  y += 30;
  // 进度条背景
  ctx.fillStyle = '#e0e0e0';
  ctx.fillRect(60, y, W - 120, 24);
  // 进度条填充
  const progress = posterData.progress / 100;
  ctx.fillStyle = '#2B6C4E';
  ctx.fillRect(60, y, (W - 120) * progress, 24);
  y += 18;
  ctx.fillStyle = '#2B6C4E';
  ctx.font = 'bold 22px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${posterData.progress}%`, W / 2, y + 30);

  // 底部装饰
  y = 1140;
  ctx.fillStyle = '#2B6C4E';
  ctx.fillRect(0, y, W, 60);
  ctx.fillStyle = '#fff';
  ctx.font = '20px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('AI导游小灵 · 陪伴您的每一次旅行', W / 2, y + 38);
};

// 文字换行
const wrapText = (ctx, text, maxWidth) => {
  const lines = [];
  let line = '';
  for (let i = 0; i < text.length; i++) {
    const testLine = line + text[i];
    if (ctx.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = text[i];
    } else {
      line = testLine;
    }
  }
  if (line) lines.push(line);
  return lines;
  };
  //清空记忆
  const clearMemories = () => {
  if (confirm('确定要清空所有旅行记录吗？此操作不可恢复。')) {
    localStorage.removeItem('travel_memories');
    setMemories([]);
    setPoster(null);
  }
};


  // 生成海报
  const generatePoster = () => {
    const today = new Date().toLocaleDateString('zh-CN');
    const checkedSpots = [...new Set(memories.map(m => m.spot))];
    // 取最近6张有照片的记忆
    const recentMemories = memories.filter(m => m.photo).slice(-6);
    
    if (recentMemories.length === 0) {
        alert('还没有拍照记录，请先拍照识景');
        return;
    }

    // 预加载所有照片
    const images = [];
    let loaded = 0;
    recentMemories.forEach((mem, index) => {
        const img = new Image();
        img.src = mem.photo;
        img.onload = () => {
        loaded++;
        if (loaded === recentMemories.length) {
            // 全部加载完再绘制
            drawMultiPoster(images, { date: today, spots: checkedSpots, progress }, recentMemories);
        }
        };
        images.push(img);
    });

    // 如果图片已缓存（complete），直接绘制
    if (images.every(img => img.complete)) {
        drawMultiPoster(images, { date: today, spots: checkedSpots, progress }, recentMemories);
    }
    };



    const drawMultiPoster = (images, posterData, memories) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const W = 750;
        const photoCount = images.length;
        // 动态计算高度
        const headerH = 120;
        const photoAreaH = photoCount <= 3 ? 300 : 500; // 最多3张一行，多行增加高度
        const textAreaH = 600;
        const H = headerH + photoAreaH + textAreaH + 80;
        canvas.width = W;
        canvas.height = H;

        // 背景暖白
        ctx.fillStyle = '#fef9f3';
        ctx.fillRect(0, 0, W, H);

        // 装饰边框
        ctx.strokeStyle = 'rgba(43,108,78,0.15)';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.strokeRect(20, 20, W - 40, H - 40);
        ctx.setLineDash([]);

        // 标题
        ctx.fillStyle = '#2B6C4E';
        ctx.font = 'bold 40px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🏞️ 我的景区之旅', W / 2, 65);
        ctx.fillStyle = '#888';
        ctx.font = '22px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillText(`📅 ${posterData.date}`, W / 2, 105);

        // 照片网格
        const cols = Math.min(3, photoCount); // 每行最多3张
        const rows = Math.ceil(photoCount / cols);
        const photoWidth = (W - 120) / cols - 20;
        const photoHeight = photoWidth * 0.75;
        const gridStartY = 140;
        const gridStartX = 60;

        // 绘制照片（胶卷风格）
        images.forEach((img, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = gridStartX + col * (photoWidth + 20) + 10;
            const y = gridStartY + row * (photoHeight + 60);

            // 白色胶片背景
            ctx.fillStyle = '#fff';
            ctx.shadowColor = 'rgba(0,0,0,0.1)';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 3;
            roundRect(ctx, x - 5, y - 5, photoWidth + 10, photoHeight + 10, 8);
            ctx.fill();
            ctx.shadowColor = 'transparent';

            // 照片
            ctx.fillStyle = '#eee';
            roundRect(ctx, x, y, photoWidth, photoHeight, 4);
            ctx.fill();
            ctx.save();
            roundRect(ctx, x, y, photoWidth, photoHeight, 4);
            ctx.clip();
            ctx.drawImage(img, x, y, photoWidth, photoHeight);
            ctx.restore();

            // 照片下方景点名
            ctx.fillStyle = '#555';
            ctx.font = '20px "PingFang SC", "Microsoft YaHei", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(memories[i]?.spot || '景点', x + photoWidth/2, y + photoHeight + 30);
        });

        // 下方起始 Y 坐标
        let y = gridStartY + rows * (photoHeight + 60) + 40;

        // 旅行日记（取最后一条记忆的日记）
        const lastDiary = memories[memories.length - 1]?.diary;
        if (lastDiary) {
            ctx.fillStyle = '#2B6C4E';
            ctx.font = 'bold 28px "PingFang SC", "Microsoft YaHei", sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText('📔 旅行感悟', 60, y);
            y += 50;

            ctx.fillStyle = '#444';
            ctx.font = '23px "PingFang SC", "Microsoft YaHei", sans-serif';
            const lines = wrapText(ctx, lastDiary, W - 120);
            lines.forEach(line => {
            ctx.fillText(line, 60, y);
            y += 40;
            });
            y += 20;
        }

        // 打卡进度
        ctx.fillStyle = '#2B6C4E';
        ctx.font = 'bold 28px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('🎉 今日探索度', 60, y);
        y += 40;

        const barX = 60, barW = W - 120, barH = 20;
        ctx.fillStyle = '#e8e0d5';
        roundRect(ctx, barX, y, barW, barH, 10);
        ctx.fill();
        const progress = posterData.progress / 100;
        const gradient = ctx.createLinearGradient(barX, 0, barX + barW * progress, 0);
        gradient.addColorStop(0, '#2B6C4E');
        gradient.addColorStop(1, '#52c41a');
        ctx.fillStyle = gradient;
        roundRect(ctx, barX, y, barW * progress, barH, 10);
        ctx.fill();
        y += 15;
        ctx.fillStyle = '#2B6C4E';
        ctx.font = 'bold 20px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${posterData.progress}%`, W / 2, y + 25);
        y += 60;

        // 打卡景点列表
        ctx.textAlign = 'left';
        ctx.fillStyle = '#2B6C4E';
        ctx.font = 'bold 24px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillText('✅ 已打卡景点', 60, y);
        y += 45;
        ctx.fillStyle = '#555';
        ctx.font = '22px "PingFang SC", "Microsoft YaHei", sans-serif';
        posterData.spots.forEach((spot, i) => {
            ctx.fillText(`  ${i + 1}.  ${spot}`, 60, y);
            y += 38;
        });
        // 将 canvas 转为图片 dataURL 保存到 state
        setPoster(canvas.toDataURL('image/png'));
        };



  const copyText = (text) => { navigator.clipboard.writeText(text).then(() => alert('已复制')); };

  return (
    <div style={styles.container}>
      <button style={styles.backBtn} onClick={onBack}>← 返回</button>
      <div style={styles.header}>📸 AI旅行记忆</div>

      {/* 拍照区域 */}
      <div style={styles.captureArea}>
        <input type="file" ref={fileInputRef} onChange={handleCapture} accept="image/*" capture="environment" style={{ display: 'none' }} />
        <button style={styles.captureBtn} onClick={() => fileInputRef.current.click()}>
          {loading ? '🔍 AI识别中...' : '📷 拍照识景'}
        </button>
        {image && <img src={image} style={styles.preview} alt="拍摄" />}
      </div>

      {/* 识别结果 */}
      {result && (
        <div style={styles.resultArea}>
          <div style={styles.resultTitle}>🏞️ {result.description}</div>
          {result.contents && (
            <div style={styles.contentCards}>
              <ContentCard title="📔 旅行日记" text={result.contents.diary} onCopy={() => copyText(result.contents.diary)} />
              <ContentCard title="💬 朋友圈文案" text={result.contents.friend_circle} onCopy={() => copyText(result.contents.friend_circle)} />
              <ContentCard title="🍠 小红书文案" text={result.contents.xiaohongshu} onCopy={() => copyText(result.contents.xiaohongshu)} />
            </div>
          )}
        </div>
      )}
      {result && result.detail_description && (
        <div style={styles.detailSection}>
            <div style={styles.detailTitle}>📖 详细讲解</div>
            <div style={styles.detailText}>{result.detail_description}</div>
            <button style={styles.playBtn} onClick={togglePlay}>
            {isPlaying ? '⏸️ 暂停讲解' : '▶️ 播放讲解'}
            </button>
        </div>
     )}

      {/* 打卡进度 */}
      <div style={styles.progressSection}>
        <div style={styles.progressTitle}>今日探索进度 {progress}%</div>
        <div style={styles.progressBar}><div style={{ ...styles.progressFill, width: `${progress}%` }}></div></div>
        <div style={styles.badgeRow}>
          {ALL_SPOTS.map(s => (
            <span key={s} style={{ ...styles.badge, background: checkedInSpots.includes(s) ? '#2B6C4E' : '#eee', color: checkedInSpots.includes(s) ? '#fff' : '#999' }}>
              {checkedInSpots.includes(s) ? '✅' : '⬜'} {s}
            </span>
          ))}
        </div>
      </div>

      {/* 时间轴 */}
      {memories.length > 0 && (
        <div style={styles.timeline}>
          {memories.map((m, i) => (
            <div key={m.id} style={styles.timelineItem}>
              <div style={styles.dot}></div>
              <div style={styles.timelineContent}>
                <span style={styles.time}>{m.time}</span> 📍 {m.spot.length > 12 ? m.spot.slice(0, 12) + '…' : m.spot}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 海报 */}
      {memories.length > 0 && !poster && (
        <button style={styles.posterBtn} onClick={generatePoster}>🎨 生成旅行海报</button>
      )}
      {poster && (
        <div style={styles.posterPreview}>
            <div style={styles.posterTitle}>🎨 旅行海报已生成</div>
            <img src={poster} style={styles.posterImage} alt="旅行海报" />
            <div style={styles.posterActions}>
            <button style={styles.downloadBtn} onClick={() => {
                const link = document.createElement('a');
                link.download = '我的景区之旅.png';
                link.href = poster;
                link.click();
            }}>💾 保存图片</button>
            </div>
        </div>
      )}

              {/* 清空记录按钮 */}
      {memories.length > 0 && (
        <button style={styles.clearBtn} onClick={clearMemories}>
          🗑️ 清空记录
        </button>
      )}
    </div>
  );
}

// 文案卡片
function ContentCard({ title, text, onCopy }) {
  if (!text) return null;
  return (
    <div style={styles.card}>
      <div style={styles.cardTitle}>{title}</div>
      <div style={styles.cardText}>{text}</div>
      <button style={styles.copyBtn} onClick={onCopy}>📋 复制</button>
    </div>
  );
}

const styles = {
  
  container: { position: 'fixed', bottom: 0, left: 0, right: 0, height: '75vh', background: 'rgba(255,255,255,0.98)', backdropFilter: 'blur(15px)', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', display: 'flex', flexDirection: 'column', zIndex: 20, boxShadow: '0 -4px 20px rgba(0,0,0,0.08)', overflowY: 'auto', padding: '16px 20px' },
  backBtn: { background: 'none', border: 'none', fontSize: '15px', color: '#2B6C4E', fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start' },
  header: { textAlign: 'center', fontSize: '20px', fontWeight: 700, color: '#2B6C4E', marginTop: '8px', marginBottom: '12px' },
  captureArea: { textAlign: 'center', marginBottom: '16px' },
  captureBtn: { padding: '14px 32px', background: 'linear-gradient(135deg, #2B6C4E, #3A8F5F)', color: '#fff', border: 'none', borderRadius: '25px', fontSize: '16px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(43,108,78,0.3)' },
  preview: { width: '100%', maxHeight: '180px', objectFit: 'contain', borderRadius: '12px', marginTop: '10px' },
  resultArea: { marginBottom: '12px' },
  resultTitle: { fontSize: '15px', color: '#333', lineHeight: '1.6', background: '#f0f8f4', borderRadius: '12px', padding: '12px', marginBottom: '8px' },
  contentCards: { display: 'flex', flexDirection: 'column', gap: '8px' },
  card: { background: '#fff', borderRadius: '12px', padding: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid #f0f0f0' },
  cardTitle: { fontSize: '13px', fontWeight: 700, color: '#2B6C4E', marginBottom: '6px' },
  cardText: { fontSize: '13px', color: '#333', lineHeight: '1.6', marginBottom: '8px' },
  copyBtn: { background: '#2B6C4E', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', cursor: 'pointer' },
  progressSection: { background: '#f8f9fa', borderRadius: '12px', padding: '12px', marginBottom: '12px' },
  progressTitle: { fontSize: '14px', fontWeight: 700, color: '#333', marginBottom: '8px' },
  progressBar: { height: '6px', background: '#eee', borderRadius: '3px', marginBottom: '8px' },
  progressFill: { height: '6px', background: 'linear-gradient(90deg, #2B6C4E, #52c41a)', borderRadius: '3px', transition: 'width 0.5s' },
  badgeRow: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  badge: { padding: '3px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 500 },
  timeline: { marginBottom: '12px' },
  timelineItem: { display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: '1px solid #f0f0f0' },
  dot: { width: '8px', height: '8px', borderRadius: '50%', background: '#2B6C4E', flexShrink: 0 },
  timelineContent: { fontSize: '13px', color: '#555' },
  time: { color: '#888', marginRight: '8px' },
  clearBtn: {
  width: '100%',
  padding: '12px',
  marginTop: '10px',
  background: '#fff',
  border: '1px solid #ff4d4d',
  borderRadius: '12px',
  color: '#ff4d4d',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer'
},
  posterBtn: { width: '100%', padding: '14px', background: 'linear-gradient(135deg, #ff9800, #f57c00)', color: '#fff', border: 'none', borderRadius: '25px', fontSize: '16px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(255,152,0,0.3)', marginBottom: '12px' },
  posterPreview: { background: '#fff', borderRadius: '16px', padding: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', textAlign: 'center', marginBottom: '12px' },
  posterTitle: { fontSize: '18px', fontWeight: 700, color: '#2B6C4E', marginBottom: '6px' },
  posterDate: { fontSize: '12px', color: '#888', marginBottom: '8px' },
  posterSpots: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px', marginBottom: '8px' },
  posterDiary: { fontSize: '13px', color: '#555', lineHeight: '1.6', marginBottom: '8px', whiteSpace: 'pre-wrap' },
  posterProgress: { fontSize: '14px', fontWeight: 700, color: '#ff9800', marginBottom: '10px' },
  posterImage: {width: '100%',borderRadius: '12px',boxShadow: '0 4px 20px rgba(0,0,0,0.15)',marginBottom: '12px'},
  downloadBtn: {padding: '12px 24px',background: '#2B6C4E',color: '#fff',border: 'none',borderRadius: '8px',fontSize: '15px',fontWeight: 700,cursor: 'pointer'},
  posterActions: {display: 'flex',justifyContent: 'center',gap: '10px'},
  detailSection: {background: '#f8f9fa',borderRadius: '12px',padding: '14px',marginBottom: '12px'},
  detailTitle: {fontSize: '16px',fontWeight: 700,color: '#2B6C4E',marginBottom: '8px'},
  detailText: {fontSize: '14px',color: '#333',lineHeight: '1.8',marginBottom: '12px',whiteSpace: 'pre-wrap'},
  playBtn: {padding: '10px 20px',background: '#1677ff',color: '#fff',border: 'none',borderRadius: '20px',fontSize: '14px',fontWeight: 600,cursor: 'pointer'}
};