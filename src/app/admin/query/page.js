// src/app/admin/query/page.js
'use client';

import { useState } from 'react';
import API_BASE from '@/config';

export default function QueryPage() {
  const [query, setQuery] = useState('');
  const [topK, setTopK] = useState(3);
  const [results, setResults] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 查询知识库
  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError('');
    setResults(null);

    try {
      const res = await fetch(`${API_BASE}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), top_k: topK }),
      });
      const data = await res.json();
      if (data.results) {
        setResults(data);
      } else {
        setError('返回数据格式异常');
      }
    } catch (err) {
      setError('请求失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 获取向量库统计
  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/collection/stats`);
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('获取统计失败', err);
    }
  };

  // 页面加载时获取统计
  useState(() => {
    fetchStats();
  }, []);

  return (
    <div>
      <h3 style={{ marginBottom: '16px', color: '#fff' }}>🔍 知识库查询</h3>

      {/* 向量库统计卡片 */}
      {stats && (
        <div style={styles.statsBar}>
          <div style={styles.statItem}>
            <span style={styles.statLabel}>集合名称</span>
            <span style={styles.statValue}>{stats.collection_name}</span>
          </div>
          <div style={styles.divider} />
          <div style={styles.statItem}>
            <span style={styles.statLabel}>文档片段数</span>
            <span style={styles.statValue}>{stats.document_count}</span>
          </div>
          <div style={styles.divider} />
          <div style={styles.statItem}>
            <span style={styles.statLabel}>向量维度</span>
            <span style={styles.statValue}>{stats.embedding_dimension}</span>
          </div>
        </div>
      )}

      {/* 查询区域 */}
      <div style={styles.searchArea}>
        <div style={styles.searchRow}>
          <input
            style={styles.searchInput}
            placeholder="输入查询内容，例如：开放时间"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearch();
            }}
          />
          <button style={styles.searchBtn} onClick={handleSearch} disabled={loading}>
            {loading ? '⏳' : '🔍 搜索'}
          </button>
        </div>
        <div style={styles.searchOptions}>
          <span style={{ color: '#888', fontSize: '13px' }}>返回数量：</span>
          {[1, 3, 5, 10].map((k) => (
            <button
              key={k}
              style={{
                ...styles.topkBtn,
                backgroundColor: topK === k ? '#2B6C4E' : '#1f2937',
              }}
              onClick={() => setTopK(k)}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div style={styles.errorBox}>
          ❌ {error}
        </div>
      )}

      {/* 搜索结果 */}
      {results && (
        <div style={styles.resultArea}>
          <div style={styles.resultHeader}>
            共找到 <strong>{results.total}</strong> 条结果
          </div>
          {results.results.length === 0 ? (
            <div style={styles.empty}>未找到相关内容</div>
          ) : (
            results.results.map((item, i) => (
              <div key={i} style={styles.resultItem}>
                <div style={styles.resultMeta}>
                  <span style={styles.scoreBadge}>
                    相关度: {(item.score * 100).toFixed(1)}%
                  </span>
                  <span style={styles.sourceFile}>
                    📄 {item.source_file} (第{item.chunk_index}块)
                  </span>
                </div>
                <div style={styles.resultContent}>{item.content}</div>
              </div>
            ))
          )}
        </div>
      )}

      <div style={styles.hint}>
        💡 此处查询直接检索向量库，用于验证知识库内容是否被正确索引
      </div>
    </div>
  );
}

const styles = {
  statsBar: {
    display: 'flex',
    alignItems: 'center',
    background: '#111827',
    border: '1px solid #1f2937',
    borderRadius: '12px',
    padding: '16px 24px',
    marginBottom: '20px',
    gap: '20px',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  statLabel: {
    fontSize: '12px',
    color: '#888',
  },
  statValue: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#e0e0e0',
  },
  divider: {
    width: '1px',
    height: '40px',
    background: '#1f2937',
  },
  searchArea: {
    background: '#111827',
    border: '1px solid #1f2937',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '20px',
  },
  searchRow: {
    display: 'flex',
    gap: '10px',
    marginBottom: '12px',
  },
  searchInput: {
    flex: 1,
    padding: '10px 16px',
    borderRadius: '8px',
    border: '1px solid #1f2937',
    background: '#0d1117',
    color: '#e0e0e0',
    fontSize: '15px',
    outline: 'none',
  },
  searchBtn: {
    padding: '10px 24px',
    backgroundColor: '#2B6C4E',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  searchOptions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  topkBtn: {
    padding: '4px 12px',
    borderRadius: '14px',
    border: '1px solid #374151',
    color: '#ccc',
    fontSize: '13px',
    cursor: 'pointer',
  },
  errorBox: {
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '20px',
    backgroundColor: '#2e0a0a',
    color: '#ff6b6b',
    fontSize: '14px',
  },
  resultArea: {
    background: '#111827',
    border: '1px solid #1f2937',
    borderRadius: '12px',
    padding: '20px',
  },
  resultHeader: {
    color: '#ccc',
    fontSize: '14px',
    marginBottom: '12px',
  },
  empty: {
    textAlign: 'center',
    color: '#666',
    padding: '30px 0',
  },
  resultItem: {
    padding: '14px',
    background: '#0d1117',
    borderRadius: '8px',
    marginBottom: '10px',
    border: '1px solid #1a1f2b',
  },
  resultMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  scoreBadge: {
    padding: '2px 10px',
    borderRadius: '10px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#52c41a',
    backgroundColor: '#0a2e1a',
  },
  sourceFile: {
    fontSize: '12px',
    color: '#888',
  },
  resultContent: {
    color: '#d0d0d0',
    fontSize: '14px',
    lineHeight: '1.6',
  },
  hint: {
    textAlign: 'center',
    color: '#666',
    fontSize: '13px',
    marginTop: '16px',
  },
};