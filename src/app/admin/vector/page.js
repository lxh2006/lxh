// src/app/admin/vector/page.js
'use client';

import { useState, useEffect } from 'react';
import API_BASE from '@/config';

export default function VectorPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  // 获取向量库统计
  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/collection/stats`);
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('获取统计失败', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // 重置向量库
  const handleReset = async () => {
    setResetting(true);
    setShowConfirm(false);
    setMessage('');

    try {
      const res = await fetch(`${API_BASE}/api/collection/reset`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.status === 'success') {
        setMessage('✅ ' + data.message);
        fetchStats();
      } else {
        setMessage('❌ 重置失败: ' + data.message);
      }
    } catch (err) {
      setMessage('❌ 网络错误: ' + err.message);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div>
      <h3 style={{ marginBottom: '16px', color: '#fff' }}>🗄️ 向量库管理</h3>

      {/* 操作提示 */}
      {message && (
        <div style={{
          ...styles.messageBox,
          backgroundColor: message.startsWith('✅') ? '#0a2e1a' : '#2e0a0a',
        }}>
          {message}
        </div>
      )}

      {/* 统计信息 */}
      {loading ? (
        <div style={styles.empty}>加载中...</div>
      ) : stats ? (
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statIcon}>📦</div>
            <div style={styles.statValue}>{stats.collection_name}</div>
            <div style={styles.statLabel}>集合名称</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statIcon}>📄</div>
            <div style={styles.statValue}>{stats.document_count}</div>
            <div style={styles.statLabel}>文档片段数</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statIcon}>🔢</div>
            <div style={styles.statValue}>{stats.embedding_dimension}</div>
            <div style={styles.statLabel}>向量维度</div>
          </div>
        </div>
      ) : (
        <div style={styles.empty}>无法获取向量库信息</div>
      )}

      {/* 重置操作区 */}
      <div style={styles.dangerZone}>
        <h4 style={styles.dangerTitle}>⚠️ 危险操作区</h4>
        <p style={styles.dangerDesc}>
          重置向量库将<strong style={{ color: '#ff6b6b' }}>清空所有知识库数据</strong>，
          包括已存储的文档片段和向量索引。此操作不可恢复，请谨慎操作。
        </p>
        <p style={styles.dangerDesc}>
          重置后，需要重新上传文档并处理，才能恢复知识库功能。
        </p>

        {!showConfirm ? (
          <button
            style={styles.dangerBtn}
            onClick={() => setShowConfirm(true)}
          >
            🗑️ 重置向量库
          </button>
        ) : (
          <div style={styles.confirmBox}>
            <p style={{ color: '#ff6b6b', marginBottom: '12px', fontWeight: '600' }}>
              ⚠️ 确认重置向量库？此操作不可恢复！
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                style={styles.confirmBtn}
                onClick={handleReset}
                disabled={resetting}
              >
                {resetting ? '⏳ 重置中...' : '✅ 确认重置'}
              </button>
              <button
                style={styles.cancelBtn}
                onClick={() => setShowConfirm(false)}
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={styles.hint}>
        💡 建议仅在知识库数据异常或需要完全重建时使用重置功能
      </div>
    </div>
  );
}

const styles = {
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  statCard: {
    background: '#111827',
    border: '1px solid #1f2937',
    borderRadius: '12px',
    padding: '20px',
    textAlign: 'center',
  },
  statIcon: {
    fontSize: '32px',
    marginBottom: '8px',
  },
  statValue: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#e0e0e0',
    marginBottom: '4px',
    wordBreak: 'break-all',
  },
  statLabel: {
    fontSize: '12px',
    color: '#888',
  },
  dangerZone: {
    background: '#1a0f0f',
    border: '2px solid #5c1a1a',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '24px',
  },
  dangerTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#ff6b6b',
    marginBottom: '12px',
  },
  dangerDesc: {
    fontSize: '14px',
    color: '#cc9999',
    lineHeight: '1.6',
    marginBottom: '8px',
  },
  dangerBtn: {
    padding: '12px 28px',
    backgroundColor: '#8b1a1a',
    color: '#ff6b6b',
    border: '2px solid #5c1a1a',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '12px',
  },
  confirmBox: {
    marginTop: '16px',
    padding: '16px',
    background: '#1a0a0a',
    borderRadius: '8px',
    border: '1px solid #5c1a1a',
  },
  confirmBtn: {
    padding: '10px 24px',
    backgroundColor: '#8b1a1a',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  cancelBtn: {
    padding: '10px 24px',
    backgroundColor: '#1f2937',
    color: '#ccc',
    border: '1px solid #374151',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer',
  },
  messageBox: {
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '20px',
    fontSize: '14px',
    color: '#e0e0e0',
  },
  empty: {
    textAlign: 'center',
    color: '#666',
    padding: '40px 0',
    fontSize: '14px',
  },
  hint: {
    textAlign: 'center',
    color: '#666',
    fontSize: '13px',
  },
};