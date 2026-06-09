// src/app/admin/knowledge/page.js
'use client';

import { useState, useEffect, useRef } from 'react';
import API_BASE from '@/config';

export default function KnowledgePage() {
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const fileInputRef = useRef(null);

  // 获取文档列表
  const fetchList = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/documents/list`);
      const data = await res.json();
      if (data.documents) {
        setDocuments(data.documents);
      }
    } catch (err) {
      console.error('获取列表失败', err);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  // 上传单个文件
  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    setMessage('');

    try {
      const res = await fetch(`${API_BASE}/api/documents/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.status === 'success') {
        setMessage(`✅ ${data.message}（${(data.file_size / 1024).toFixed(1)}KB）`);
        fetchList();
      } else {
        setMessage(`❌ 上传失败: ${data.message}`);
      }
    } catch (err) {
      setMessage(`❌ 网络错误: ${err.message}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 批量上传文件
  const handleBatchUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    setUploading(true);
    setMessage('');

    try {
      const res = await fetch(`${API_BASE}/api/documents/upload-batch`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.status === 'success') {
        setMessage(`✅ ${data.message}`);
        fetchList();
      } else {
        setMessage(`❌ 上传失败: ${data.message}`);
      }
    } catch (err) {
      setMessage(`❌ 网络错误: ${err.message}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 处理单个文档
  const handleProcess = async (filename) => {
    setProcessing(true);
    setMessage('');

    try {
      const res = await fetch(`${API_BASE}/api/documents/${encodeURIComponent(filename)}/process`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.status === 'success') {
        setMessage(`✅ ${data.message}`);
        fetchList();
      } else {
        setMessage(`❌ 处理失败: ${data.message}`);
      }
    } catch (err) {
      setMessage(`❌ 网络错误: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  // 批量处理所有文档
  const handleProcessAll = async () => {
    setProcessing(true);
    setMessage('');

    try {
      const res = await fetch(`${API_BASE}/api/documents/process-all`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.status === 'success') {
        setMessage(`✅ ${data.message}`);
        fetchList();
      } else {
        setMessage(`❌ 处理失败: ${data.message}`);
      }
    } catch (err) {
      setMessage(`❌ 网络错误: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  // 删除文档
  const handleDelete = async (filename) => {
    if (!confirm(`确定要删除 ${filename} 吗？此操作不可恢复。`)) return;

    try {
      const res = await fetch(`${API_BASE}/api/documents/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.status === 'success') {
        setMessage(`✅ ${data.message}`);
        fetchList();
      } else {
        setMessage(`❌ 删除失败: ${data.message}`);
      }
    } catch (err) {
      setMessage(`❌ 网络错误: ${err.message}`);
    }
  };

  // 统计未处理文档数
  const unprocessedCount = documents.filter(d => !d.processed).length;

  return (
    <div>
      <h3 style={{ marginBottom: '16px', color: '#fff' }}>📚 知识库管理</h3>

      {/* 提示信息 */}
      {message && (
        <div style={{
          ...styles.messageBox,
          backgroundColor: message.startsWith('✅') ? '#0a2e1a' : '#2e0a0a',
        }}>
          {message}
        </div>
      )}

      {/* 上传区域 */}
      <div style={styles.uploadArea}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleUpload}
          accept=".txt,.pdf,.docx"
          style={{ display: 'none' }}
          id="single-upload"
        />
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleBatchUpload}
          accept=".txt,.pdf,.docx"
          multiple
          style={{ display: 'none' }}
          id="batch-upload"
        />
        <div style={styles.uploadBtns}>
          <label htmlFor="single-upload" style={styles.uploadLabel}>
            📁 上传文件
          </label>
          <label htmlFor="batch-upload" style={styles.uploadLabel}>
            📦 批量上传
          </label>
        </div>
        <p style={styles.uploadHint}>支持 TXT、PDF、Word 格式，单文件最大 50MB</p>
      </div>

      {/* 批量操作 */}
      {documents.length > 0 && (
        <div style={styles.batchBar}>
          <span style={{ color: '#888', fontSize: '14px' }}>
            共 {documents.length} 个文档，{unprocessedCount} 个未处理
          </span>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              style={styles.processAllBtn}
              onClick={handleProcessAll}
              disabled={processing || unprocessedCount === 0}
            >
              {processing ? '⏳ 处理中...' : `⚡ 批量处理全部（${unprocessedCount}）`}
            </button>
            <button style={styles.refreshBtn} onClick={fetchList}>
              🔄 刷新
            </button>
          </div>
        </div>
      )}

      {/* 文档列表 */}
      <div style={styles.listArea}>
        {documents.length === 0 ? (
          <div style={styles.empty}>
            <p style={{ fontSize: '40px', marginBottom: '12px' }}>📭</p>
            <p>暂无文档，请上传景区相关资料</p>
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>文件名</th>
                <th style={styles.th}>大小</th>
                <th style={styles.th}>上传时间</th>
                <th style={styles.th}>状态</th>
                <th style={styles.th}>操作</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.filename} style={styles.tr}>
                  <td style={styles.td}>
                    <span style={{ marginRight: '8px' }}>📄</span>
                    {doc.filename}
                  </td>
                  <td style={styles.td}>{formatFileSize(doc.file_size)}</td>
                  <td style={styles.td}>{formatTime(doc.upload_time)}</td>
                  <td style={styles.td}>
                    <span style={{
                      ...styles.statusBadge,
                      backgroundColor: doc.processed ? '#0a2e1a' : '#2e1a0a',
                      color: doc.processed ? '#52c41a' : '#fa8c16',
                    }}>
                      {doc.processed ? '✅ 已处理' : '⏳ 未处理'}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {!doc.processed && (
                        <button
                          style={styles.actionBtn}
                          onClick={() => handleProcess(doc.filename)}
                          disabled={processing}
                        >
                          处理
                        </button>
                      )}
                      <button
                        style={styles.deleteBtn}
                        onClick={() => handleDelete(doc.filename)}
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={styles.hint}>
        💡 上传文件后，需点击“处理”按钮将文档内容加入知识库，才能被数字人检索
      </div>
    </div>
  );
}

// 工具函数：格式化文件大小
function formatFileSize(bytes) {
  if (!bytes) return '-';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// 工具函数：格式化时间
function formatTime(timeStr) {
  if (!timeStr) return '-';
  try {
    const date = new Date(timeStr);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  } catch {
    return timeStr;
  }
}

const styles = {
  uploadArea: {
    background: '#111827',
    border: '2px dashed #1f2937',
    borderRadius: '12px',
    padding: '30px',
    textAlign: 'center',
    marginBottom: '20px',
  },
  uploadBtns: {
    display: 'flex',
    justifyContent: 'center',
    gap: '16px',
    marginBottom: '12px',
  },
  uploadLabel: {
    padding: '12px 28px',
    backgroundColor: '#2B6C4E',
    color: '#fff',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    border: 'none',
  },
  uploadHint: {
    color: '#888',
    fontSize: '13px',
    margin: 0,
  },
  batchBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    background: '#111827',
    border: '1px solid #1f2937',
    borderRadius: '8px',
    marginBottom: '20px',
  },
  processAllBtn: {
    padding: '8px 18px',
    backgroundColor: '#fa8c16',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  refreshBtn: {
    padding: '8px 16px',
    backgroundColor: '#1f2937',
    color: '#ccc',
    border: '1px solid #374151',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer',
  },
  listArea: {
    background: '#111827',
    border: '1px solid #1f2937',
    borderRadius: '12px',
    padding: '20px',
  },
  empty: {
    textAlign: 'center',
    color: '#666',
    padding: '60px 0',
    fontSize: '15px',
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
  },
  td: {
    padding: '12px',
    borderBottom: '1px solid #1a1f2b',
    color: '#ccc',
    fontSize: '14px',
  },
  tr: {
    transition: 'background 0.1s',
  },
  statusBadge: {
    padding: '3px 10px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '500',
  },
  actionBtn: {
    padding: '5px 14px',
    backgroundColor: '#2B6C4E',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  deleteBtn: {
    padding: '5px 14px',
    backgroundColor: '#8b1a1a',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
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
    marginTop: '16px',
  },
};