// src/app/admin/qa-records/page.js
'use client';

import { useState, useEffect } from 'react';
import API_BASE from '@/config';

export default function QaRecordsPage() {
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [detail, setDetail] = useState(null);
  const pageSize = 20;

  // 获取统计信息
  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/qa/stats`);
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('获取统计失败', err);
    }
  };

  // 获取记录列表
  const fetchRecords = async () => {
    setLoading(true);
    try {
      let url = `${API_BASE}/api/qa/records?page=${page}&page_size=${pageSize}`;
      if (searchKeyword) {
        url += `&keyword=${encodeURIComponent(searchKeyword)}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      setRecords(data.records || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('获取记录失败', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [page, searchKeyword]);

  // 查看详情
  const handleViewDetail = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/qa/records/${id}`);
      const data = await res.json();
      setDetail(data);
    } catch (err) {
      console.error('获取详情失败', err);
    }
  };

  // 删除记录
  const handleDelete = async (id) => {
    if (!confirm('确定要删除这条记录吗？')) return;
    try {
      const res = await fetch(`${API_BASE}/api/qa/records/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.status === 'success') {
        fetchRecords();
        fetchStats();
      }
    } catch (err) {
      console.error('删除失败', err);
    }
  };

  // 搜索
  const handleSearch = () => {
    setPage(1);
    setSearchKeyword(keyword);
  };

  // 回车搜索
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  // 分页
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <h3 style={{ marginBottom: '16px', color: '#fff' }}>📋 问答记录管理</h3>

      {/* 统计卡片 */}
      {stats && (
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{stats.total_records}</div>
            <div style={styles.statLabel}>总记录数</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{stats.ai_generated_count}</div>
            <div style={styles.statLabel}>AI 生成</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{stats.tts_enabled_count}</div>
            <div style={styles.statLabel}>TTS 启用</div>
          </div>
          <div style={styles.statCard}>
            <div style={{ ...styles.statValue, color: '#52c41a' }}>{stats.today_records}</div>
            <div style={styles.statLabel}>今日新增</div>
          </div>
        </div>
      )}

      {/* 搜索栏 */}
      <div style={styles.searchBar}>
        <input
          style={styles.searchInput}
          placeholder="搜索问题关键词..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button style={styles.searchBtn} onClick={handleSearch}>🔍 搜索</button>
      </div>

      {/* 记录表格 */}
      <div style={styles.tableArea}>
        {loading ? (
          <div style={styles.empty}>加载中...</div>
        ) : records.length === 0 ? (
          <div style={styles.empty}>暂无问答记录</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>问题</th>
                <th style={styles.th}>回答</th>
                <th style={styles.th}>方式</th>
                <th style={styles.th}>操作</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} style={styles.tr}>
                  <td style={styles.td} title={r.query}>{truncateText(r.query, 30)}</td>
                  <td style={styles.td} title={r.answer}>{truncateText(r.answer, 50)}</td>
                  <td style={styles.td}>
                    <span style={styles.tag}>{r.use_ai ? '🤖 AI' : '📋 检索'}</span>
                    {r.enable_tts && <span style={styles.tag}>🔊 TTS</span>}
                  </td>
                  <td style={styles.td}>
                    <div style={styles.actions}>
                      <button style={styles.viewBtn} onClick={() => handleViewDetail(r.id)}>详情</button>
                      <button style={styles.deleteBtn} onClick={() => handleDelete(r.id)}>删除</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div style={styles.pagination}>
          <button
            style={styles.pageBtn}
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            上一页
          </button>
          <span style={styles.pageInfo}>{page} / {totalPages}（共 {total} 条）</span>
          <button
            style={styles.pageBtn}
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            下一页
          </button>
        </div>
      )}

      {/* 详情弹窗 */}
      {detail && (
        <div style={styles.modalOverlay} onClick={() => setDetail(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h4 style={styles.modalTitle}>📝 问答详情</h4>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>问题：</span>
              <span style={styles.detailValue}>{detail.query}</span>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>回答：</span>
              <span style={styles.detailValue}>{detail.answer}</span>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>AI生成：</span>
              <span style={styles.detailValue}>{detail.use_ai ? '是' : '否'}</span>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>TTS：</span>
              <span style={styles.detailValue}>{detail.enable_tts ? detail.tts_voice || '已启用' : '未启用'}</span>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>知识来源数：</span>
              <span style={styles.detailValue}>{detail.total_sources || 0}</span>
            </div>
            <button style={styles.closeBtn} onClick={() => setDetail(null)}>关闭</button>
          </div>
        </div>
      )}
    </div>
  );
}

// 工具函数：文本截断
function truncateText(text, maxLen) {
  if (!text) return '-';
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
}

const styles = {
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '16px',
    marginBottom: '20px',
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
  searchBar: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px',
  },
  searchInput: {
    flex: 1,
    padding: '10px 16px',
    borderRadius: '8px',
    border: '1px solid #1f2937',
    background: '#111827',
    color: '#e0e0e0',
    fontSize: '14px',
    outline: 'none',
  },
  searchBtn: {
    padding: '10px 24px',
    backgroundColor: '#2B6C4E',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  tableArea: {
    background: '#111827',
    border: '1px solid #1f2937',
    borderRadius: '12px',
    padding: '16px',
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    borderBottom: '1px solid #1f2937',
    color: '#999',
    fontSize: '13px',
    fontWeight: '500',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '12px',
    borderBottom: '1px solid #1a1f2b',
    color: '#ccc',
    fontSize: '13px',
    maxWidth: '250px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  tr: {
    transition: 'background 0.1s',
  },
  tag: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '11px',
    fontWeight: '500',
    marginRight: '6px',
    backgroundColor: '#1a2a3a',
    color: '#8ab4f8',
  },
  actions: {
    display: 'flex',
    gap: '8px',
  },
  viewBtn: {
    padding: '5px 12px',
    backgroundColor: '#1a3a5c',
    color: '#8ab4f8',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  deleteBtn: {
    padding: '5px 12px',
    backgroundColor: '#3a1a1a',
    color: '#ff6b6b',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  empty: {
    textAlign: 'center',
    color: '#666',
    padding: '40px 0',
    fontSize: '14px',
  },
  pagination: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '16px',
    marginTop: '20px',
  },
  pageBtn: {
    padding: '8px 20px',
    backgroundColor: '#1f2937',
    color: '#ccc',
    border: '1px solid #374151',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  pageInfo: {
    color: '#888',
    fontSize: '14px',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  modal: {
    background: '#111827',
    border: '1px solid #1f2937',
    borderRadius: '12px',
    padding: '24px',
    width: '90%',
    maxWidth: '600px',
    maxHeight: '80vh',
    overflowY: 'auto',
  },
  modalTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#fff',
    marginBottom: '16px',
  },
  detailRow: {
    marginBottom: '12px',
  },
  detailLabel: {
    fontSize: '13px',
    color: '#888',
    display: 'block',
    marginBottom: '4px',
  },
  detailValue: {
    fontSize: '14px',
    color: '#e0e0e0',
    lineHeight: '1.6',
    wordBreak: 'break-all',
  },
  closeBtn: {
    marginTop: '12px',
    padding: '8px 20px',
    backgroundColor: '#1f2937',
    color: '#ccc',
    border: '1px solid #374151',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
  },
};