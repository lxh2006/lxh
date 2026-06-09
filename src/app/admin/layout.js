// src/app/admin/layout.js
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Script from 'next/script';

const menuItems = [
  { name: '知识库管理', path: '/admin/knowledge', icon: '📚' },
  { name: '知识库查询', path: '/admin/query', icon: '🔍' },
  { name: '数字人配置', path: '/admin/config', icon: '🤖' },
  { name: '问答记录', path: '/admin/qa-records', icon: '📋' },
  { name: 'TTS管理', path: '/admin/tts', icon: '🔊' },
  { name: '向量库管理', path: '/admin/vector', icon: '🗄️' },
  { name: '数据大屏', path: '/admin/dashboard', icon: '📈' },
];

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={styles.container}>
      {/* 侧边栏 */}
      <aside style={{ ...styles.sidebar, width: collapsed ? '60px' : '220px' }}>
        <div style={styles.logo}>
          <span style={styles.logoIcon}>🏞️</span>
          {!collapsed && <span style={styles.logoText}>景区管理后台</span>}
        </div>

        <button
          style={styles.collapseBtn}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? '▶' : '◀'}
        </button>

        <nav style={styles.nav}>
          {menuItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              style={{
                ...styles.navItem,
                backgroundColor: pathname === item.path ? 'rgba(43, 108, 78, 0.3)' : 'transparent',
                borderLeft: pathname === item.path ? '3px solid #52c41a' : '3px solid transparent',
              }}
            >
              <span style={styles.navIcon}>{item.icon}</span>
              {!collapsed && <span style={styles.navText}>{item.name}</span>}
            </Link>
          ))}
        </nav>
      </aside>

      {/* 主内容区 */}
      <div style={styles.mainArea}>
        {/* 顶部栏 */}
        <header style={styles.topBar}>
          <h2 style={styles.pageTitle}>
            {menuItems.find((item) => item.path === pathname)?.name || '管理后台'}
          </h2>
          <div style={styles.topRight}>
            <span style={styles.status}>● 系统运行中</span>
          </div>
        </header>

        {/* 内容区 */}
        <main style={styles.content}>
          {children}
        </main>
      </div>

      {/* 移动端调试工具：仅开发环境加载，提交比赛前可删除 */}
      {process.env.NODE_ENV === 'development' && (
        <Script
          src="https://cdn.jsdelivr.net/npm/eruda"
          strategy="afterInteractive"
          onLoad={() => {
            if (typeof window !== 'undefined' && window.eruda) {
              window.eruda.init();
            }
          }}
        />
      )}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    background: '#0a0e17',
    color: '#e0e0e0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  sidebar: {
    background: '#111827',
    borderRight: '1px solid #1f2937',
    transition: 'width 0.3s ease',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative', // 解决 collapseBtn 定位问题
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '20px 16px',
    borderBottom: '1px solid #1f2937',
  },
  logoIcon: { fontSize: '28px' },
  logoText: { fontSize: '16px', fontWeight: '700', color: '#fff', whiteSpace: 'nowrap' },
  collapseBtn: {
    position: 'absolute',
    bottom: '20px',
    left: '16px',
    background: 'none',
    border: 'none',
    color: '#888',
    fontSize: '14px',
    cursor: 'pointer',
  },
  nav: {
    flex: 1,
    padding: '12px 0',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 20px',
    color: '#c0c0c0',
    textDecoration: 'none',
    fontSize: '14px',
    transition: 'all 0.2s',
    whiteSpace: 'nowrap',
  },
  navIcon: { fontSize: '18px', flexShrink: 0 },
  navText: { fontWeight: '500' },
  mainArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    background: '#111827',
    borderBottom: '1px solid #1f2937',
  },
  pageTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#fff',
    margin: 0,
  },
  topRight: {
    display: 'flex',
    alignItems: 'center',
  },
  status: {
    fontSize: '13px',
    color: '#52c41a',
  },
  content: {
    flex: 1,
    padding: '24px',
    overflowY: 'auto',
  },
};