// src/app/admin/dashboard/page.js
'use client';

import { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import API_BASE from '@/config';

// 动态导入词云插件，避免服务端渲染报错
let wordCloudRegistered = false;
async function registerWordCloud() {
  if (!wordCloudRegistered && typeof window !== 'undefined') {
    await import('echarts-wordcloud');
    wordCloudRegistered = true;
  }
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [keywords, setKeywords] = useState([]);
  const [touristData, setTouristData] = useState(null);
  const [costData, setCostData] = useState(null);
  const [satisfactionData, setSatisfactionData] = useState(null);
  const [surveySuggestions, setSurveySuggestions] = useState([]);

  useEffect(() => {
    // 注册词云插件
    registerWordCloud();

    // 获取概览数据
    fetch(`${API_BASE}/api/stats/overview`)
      .then(res => res.json())
      .then(setData)
      .catch(err => console.error('获取概览失败', err));

    // 获取热词数据
    fetch(`${API_BASE}/api/stats/hot-keywords`)
      .then(res => res.json())
      .then(setKeywords)
      .catch(err => console.error('获取热词失败', err));

    // 获取游客画像数据
    fetch(`${API_BASE}/api/stats/tourists`)
      .then(res => res.json())
      .then(setTouristData)
      .catch(err => console.error('获取游客画像失败', err));

    // 获取消费分析数据
    fetch(`${API_BASE}/api/stats/costs`)
      .then(res => res.json())
      .then(setCostData)
      .catch(err => console.error('获取消费分析失败', err));

    // 获取满意度数据
    fetch(`${API_BASE}/api/stats/satisfaction`)
      .then(res => res.json())
      .then(setSatisfactionData)
      .catch(err => console.error('获取满意度失败', err));

    fetch(`${API_BASE}/api/survey/suggestions`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          setSurveySuggestions(data.suggestions);
        }
      })
      .catch(err => console.error('获取用户建议失败', err));
      }, []);

  if (!data) {
    return <div style={{ color: '#888', padding: '40px', textAlign: 'center' }}>加载中...</div>;
  }

  // ========== 基础数字卡片（适配后端返回的字段） ==========
  const statCards = [
    { label: '今日服务人次', value: data.today_service_count ?? 0, color: '#1677ff' },
    { label: '平均响应时间', value: data.avg_response_time ? `${data.avg_response_time}s` : 'N/A', color: '#fa8c16' },
    { label: '问答准确率', value: data.accuracy_rate ? `${data.accuracy_rate}%` : '--', color: '#52c41a' },
    { label: '文档总数', value: data.document_count ?? 0, color: '#722ed1' },
    { label: '历史服务人次', value: data.total_service_count ?? 0, color: '#13c2c2' },
    { label: '平均满意度', value: data.avg_satisfaction ? `${data.avg_satisfaction} ⭐` : '--', color: '#eb2f96' },
  ];

  // ========== 24小时趋势图 ==========
  const hourlyTrend = data.hourly_trend;
  const hourlyOption = (hourlyTrend && Array.isArray(hourlyTrend)) ? {
    tooltip: { trigger: 'axis' },
    grid: { top: 20, right: 30, bottom: 30, left: 40 },
    xAxis: {
      type: 'category',
      data: hourlyTrend.map(h => `${h.hour}时`),
      axisLabel: { color: '#999', fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      name: '提问数',
      axisLabel: { color: '#999' },
      splitLine: { lineStyle: { color: '#1f2937' } },
    },
    series: [{
      data: hourlyTrend.map(h => h.count),
      type: 'line',
      smooth: true,
      lineStyle: { color: '#1677ff', width: 2 },
      areaStyle: { color: 'rgba(22,119,255,0.1)' },
      itemStyle: { color: '#1677ff' },
    }],
  } : null;

  // ========== 热门问题词云 ==========
  const wordCloudOption = (keywords && keywords.length > 0) ? {
    tooltip: { show: true },
    series: [{
      type: 'wordCloud',
      shape: 'circle',
      left: 'center',
      top: 'center',
      width: '90%',
      height: '90%',
      sizeRange: [12, 40],
      rotationRange: [-45, 45],
      textStyle: {
        normal: {
          color: function () {
            const colors = ['#1677ff', '#52c41a', '#fa8c16', '#722ed1', '#eb2f96', '#13c2c2'];
            return colors[Math.floor(Math.random() * colors.length)];
          },
        },
      },
      data: keywords,
    }],
  } : null;

  // ========== 游客画像：性别饼图 ==========
  const genderDistribution = touristData?.gender_distribution;
  const genderOption = (genderDistribution && Array.isArray(genderDistribution)) ? {
    tooltip: { trigger: 'item' },
    legend: { orient: 'vertical', left: 'left', textStyle: { color: '#999' } },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      data: genderDistribution,
      label: { color: '#999' },
    }],
  } : null;

  // ========== 游客画像：年龄柱状图 ==========
  const ageDistribution = touristData?.age_distribution;
  const ageOption = (ageDistribution && Array.isArray(ageDistribution)) ? {
    tooltip: { trigger: 'axis' },
    grid: { top: 20, right: 30, bottom: 30, left: 40 },
    xAxis: {
      type: 'category',
      data: ageDistribution.map(d => d.name),
      axisLabel: { color: '#999' },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#999' },
      splitLine: { lineStyle: { color: '#1f2937' } },
    },
    series: [{
      data: ageDistribution.map(d => d.value),
      type: 'bar',
      itemStyle: { color: '#722ed1' },
    }],
  } : null;

  // ========== 消费结构饼图 ==========
  const costBreakdown = costData?.cost_breakdown;
  const costOption = (costBreakdown && Array.isArray(costBreakdown)) ? {
    tooltip: { trigger: 'item' },
    legend: { orient: 'vertical', left: 'left', textStyle: { color: '#999' } },
    series: [{
      type: 'pie',
      radius: '70%',
      data: costBreakdown,
      label: { color: '#999' },
    }],
  } : null;

  // ========== 满意度柱状图 ==========
  const satisfactionDistribution = satisfactionData?.satisfaction_distribution;
  const satisfactionOption = (satisfactionDistribution && Array.isArray(satisfactionDistribution)) ? {
    tooltip: { trigger: 'axis' },
    grid: { top: 20, right: 30, bottom: 30, left: 40 },
    xAxis: {
      type: 'category',
      data: satisfactionDistribution.map(d => d.name),
      axisLabel: { color: '#999' },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#999' },
      splitLine: { lineStyle: { color: '#1f2937' } },
    },
    series: [{
      data: satisfactionDistribution.map(d => d.value),
      type: 'bar',
      itemStyle: { color: '#52c41a' },
    }],
  } : null;

  return (
    <div>
      <h3 style={{ marginBottom: '20px', color: '#fff' }}>📈 数据大屏</h3>

      {/* 数字卡片 */}
      <div style={{ ...styles.cardGrid, gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {statCards.map((card, i) => (
          <div key={i} style={styles.statCard}>
            <div style={{ ...styles.statValue, color: card.color }}>{card.value}</div>
            <div style={styles.statLabel}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* 24小时趋势图 */}
      {hourlyOption && (
        <div style={styles.chartBox}>
          <h4 style={styles.chartTitle}>📊 24小时服务趋势</h4>
          <ReactECharts option={hourlyOption} style={{ height: '300px' }} />
        </div>
      )}

      {/* 游客画像 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        {genderOption && (
          <div style={styles.chartBox}>
            <h4 style={styles.chartTitle}>👥 性别分布</h4>
            <ReactECharts option={genderOption} style={{ height: '250px' }} />
          </div>
        )}
        {ageOption && (
          <div style={styles.chartBox}>
            <h4 style={styles.chartTitle}>📊 年龄分布</h4>
            <ReactECharts option={ageOption} style={{ height: '250px' }} />
          </div>
        )}
      </div>

      {/* 消费分析 */}
      {costData && costOption && (
        <div style={styles.chartBox}>
          <h4 style={styles.chartTitle}>💰 消费结构分析（人均：¥{costData.avg_total_cost ?? '--'}）</h4>
          <ReactECharts option={costOption} style={{ height: '300px' }} />
        </div>
      )}

      {/* 满意度 */}
      {satisfactionData && satisfactionOption && (
        <div style={styles.chartBox}>
          <h4 style={styles.chartTitle}>⭐ 满意度分布（平均：{satisfactionData.avg_satisfaction ?? '--'}分）</h4>
          <ReactECharts option={satisfactionOption} style={{ height: '250px' }} />
        </div>
      )}

      {/* 用户反馈建议 */}
      <div style={styles.chartBox}>
        <h4 style={styles.chartTitle}>💬 近期用户反馈</h4>
        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {surveySuggestions.length === 0 ? (
            <p style={{ color: '#666', textAlign: 'center', padding: '20px' }}>暂无用户反馈</p>
          ) : (
            surveySuggestions.map((item, i) => (
              <div key={i} style={{
                padding: '12px',
                borderBottom: '1px solid #1f2937',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#f5a623' }}>{'★'.repeat(item.satisfaction)}{'☆'.repeat(5 - item.satisfaction)}</span>
                  <span style={{ color: '#888', fontSize: '12px' }}>{item.time}</span>
                </div>
                {item.favorites && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {item.favorites.split('、').map((tag, idx) => (
                      <span key={idx} style={{
                        padding: '2px 8px',
                        background: '#0a2e1a',
                        borderRadius: '10px',
                        color: '#52c41a',
                        fontSize: '11px'
                      }}>👍 {tag}</span>
                    ))}
                  </div>
                )}
                {item.improvements && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {item.improvements.split('、').map((tag, idx) => (
                      <span key={idx} style={{
                        padding: '2px 8px',
                        background: '#2e1a0a',
                        borderRadius: '10px',
                        color: '#fa8c16',
                        fontSize: '11px'
                      }}>💡 {tag}</span>
                    ))}
                  </div>
                )}
                {item.ai_summary && (
                  <div style={{
                    background: '#1a1f2b',
                    padding: '8px',
                    borderRadius: '8px',
                    color: '#ccc',
                    fontSize: '13px',
                    fontStyle: 'italic',
                    lineHeight: '1.5'
                  }}>🤖 {item.ai_summary}</div>
                )}
                {/* 用户自定义建议（始终显示，如果有的话） */}
                {item.suggestion && (
                  <div style={{ 
                    color: '#ffd666', 
                    fontSize: '13px', 
                    background: 'rgba(255,214,102,0.1)', 
                    padding: '8px', 
                    borderRadius: '8px', 
                    marginTop: '4px' 
                  }}>
                    ✍️ {item.suggestion}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 热门问题词云 */}
      {wordCloudOption && (
        <div style={styles.chartBox}>
          <h4 style={styles.chartTitle}>🔥 热门问题词云</h4>
          <ReactECharts option={wordCloudOption} style={{ height: '300px' }} />
        </div>
      )}

      <div style={styles.hint}>
        💡 数据实时更新，刷新页面获取最新数据
      </div>
    </div>
  );
}

const styles = {
  cardGrid: {
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
  },
  statValue: {
    fontSize: '28px',
    fontWeight: '700',
    marginBottom: '8px',
  },
  statLabel: {
    fontSize: '13px',
    color: '#888',
  },
  chartBox: {
    background: '#111827',
    border: '1px solid #1f2937',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '20px',
  },
  chartTitle: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#e0e0e0',
    marginBottom: '12px',
  },
  hint: {
    textAlign: 'center',
    color: '#666',
    fontSize: '13px',
    marginTop: '10px',
  },
};