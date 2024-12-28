import React, { useEffect, useState } from 'react';
import { metricsService } from '../../features/metrics/metricsService';
import { Trade } from '../../types';
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  TimeScale,
  CategoryScale,
} from 'chart.js';
import { Scatter } from 'react-chartjs-2';
import 'chart.js/auto';

ChartJS.register(
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  TimeScale,
  CategoryScale
);

const Analytics = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('stop-analysis');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const fetchedTrades = await metricsService.fetchTrades();
        setTrades(fetchedTrades);
      } catch (error) {
        console.error('Error fetching trade data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Calculate advanced risk metrics
  const calculateAdvancedMetrics = () => {
    const closedTrades = trades.filter(t => t.status === 'Closed');
    
    // Stop Loss Analysis
    const tradesWithStops = closedTrades.filter(t => t.stop_loss_33_percent || t.stop_loss_66_percent);
    const stopsHit = tradesWithStops.filter(t => 
      (t.mae_price || 0) <= (t.stop_loss_33_percent || 0) || 
      (t.mae_price || 0) <= (t.stop_loss_66_percent || 0)
    );

    // Risk Management Analysis
    const avgInitialRisk = closedTrades.reduce((acc, t) => acc + (t.initial_risk_amount || 0), 0) / closedTrades.length;
    const avgPortfolioRisk = closedTrades.reduce((acc, t) => acc + (t.portfolio_risk || 0), 0) / closedTrades.length;
    
    // Trailing Stop Analysis
    const tradesWithTrailing = closedTrades.filter(t => t.trailing_stoploss);
    const trailingStopSuccess = tradesWithTrailing.filter(t => (t.risk_reward_ratio || 0) > 0);

    return {
      // Stop Loss Metrics
      stopLossHitRate: ((stopsHit.length / tradesWithStops.length) * 100).toFixed(1),
      avgStopDistance: (closedTrades.reduce((acc, t) => acc + (t.open_risk || 0), 0) / closedTrades.length).toFixed(2),
      
      // Risk Management Metrics
      avgInitialRisk: avgInitialRisk.toFixed(2),
      avgPortfolioRisk: avgPortfolioRisk.toFixed(2),
      maxPortfolioRisk: Math.max(...closedTrades.map(t => t.portfolio_risk || 0)).toFixed(2),
      
      // Trailing Stop Metrics
      trailingStopWinRate: ((trailingStopSuccess.length / tradesWithTrailing.length) * 100).toFixed(1),
      trailingStopUsage: ((tradesWithTrailing.length / closedTrades.length) * 100).toFixed(1),
    };
  };

  const getCommonOptions = () => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      backgroundColor: 'transparent',
      scales: {
        x: {
          grid: {
            color: 'rgba(166, 173, 186, 0.2)',
          },
          ticks: {
            color: '#a6adba',
            font: { size: 12 }
          },
          title: {
            display: true,
            color: '#a6adba',
            font: { size: 14, weight: 'bold' }
          },
        },
        y: {
          grid: {
            color: 'rgba(166, 173, 186, 0.2)',
          },
          ticks: {
            color: '#a6adba',
            font: { size: 12 }
          },
          title: {
            display: true,
            color: '#a6adba',
            font: { size: 14, weight: 'bold' }
          },
        },
      },
      plugins: {
        legend: {
          labels: {
            color: '#a6adba',
            font: { size: 12 }
          },
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#ffffff',
          bodyColor: '#ffffff',
          callbacks: {
            label: (context) => {
              const point = context.raw;
              return [
                `${point.ticker} (${point.strategy})`,
                `Exit Date: ${point.exitDate}`,
                `Stop Distance: ${point.stopDistance?.toFixed(2)}%`,
                `MAE: ${point.mae?.toFixed(2)}%`,
                `Final RR: ${point.rr?.toFixed(2)}`,
              ];
            }
          }
        }
      },
    };
  };

  const chartConfigs = {
    'stop-analysis': {
      title: 'Stop Loss Analysis',
      description: 'Analysis of stop loss placement effectiveness and MAE relationship',
      data: {
        datasets: [
          {
            label: 'Trades',
            data: trades
              .filter(t => t.status === 'Closed')
              .map(t => ({
                x: t.open_risk || 0,
                y: -(t.mae || 0),
                ticker: t.ticker,
                strategy: t.strategy || 'Unknown',
                exitDate: new Date(t.exit_datetime || '').toLocaleDateString(),
                stopDistance: t.open_risk,
                mae: t.mae,
                rr: t.risk_reward_ratio,
              })),
            backgroundColor: (context) => {
              const mae = context.raw?.mae || 0;
              const stopDistance = context.raw?.stopDistance || 0;
              return -mae >= stopDistance ? '#fb7185' : '#34d399';
            },
            borderColor: (context) => {
              const mae = context.raw?.mae || 0;
              const stopDistance = context.raw?.stopDistance || 0;
              return -mae >= stopDistance ? '#fb7185' : '#34d399';
            },
            pointRadius: 5,
            pointHoverRadius: 8,
          },
        ],
      },
      options: {
        ...getCommonOptions(),
        scales: {
          x: {
            ...getCommonOptions().scales.x,
            title: {
              ...getCommonOptions().scales.x.title,
              text: 'Initial Stop Distance (%)',
            },
          },
          y: {
            ...getCommonOptions().scales.y,
            title: {
              ...getCommonOptions().scales.y.title,
              text: 'Maximum Adverse Excursion (%)',
            },
          },
        },
      },
    },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-4">
          <span className="loading loading-spinner loading-lg"></span>
          <p className="text-base-content/60">Loading analytics data...</p>
        </div>
      </div>
    );
  }

  const metrics = calculateAdvancedMetrics();

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-base-content mb-2">Advanced Risk Analytics</h1>
          <p className="text-base-content/60">Detailed analysis of risk management effectiveness</p>
        </div>
      </div>

      {/* Risk Management Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <div className="stats shadow bg-base-200">
          <div className="stat">
            <div className="stat-title">Stop Hit Rate</div>
            <div className="stat-value text-rose-400 text-2xl">{metrics.stopLossHitRate}%</div>
            <div className="stat-desc">Of trades with stops</div>
          </div>
        </div>
        <div className="stats shadow bg-base-200">
          <div className="stat">
            <div className="stat-title">Avg Stop Distance</div>
            <div className="stat-value text-rose-400 text-2xl">{metrics.avgStopDistance}%</div>
            <div className="stat-desc">Initial risk</div>
          </div>
        </div>
        <div className="stats shadow bg-base-200">
          <div className="stat">
            <div className="stat-title">Avg Initial Risk</div>
            <div className="stat-value text-rose-400 text-2xl">${metrics.avgInitialRisk}</div>
            <div className="stat-desc">Per trade</div>
          </div>
        </div>
        <div className="stats shadow bg-base-200">
          <div className="stat">
            <div className="stat-title">Portfolio Risk</div>
            <div className="stat-value text-emerald-400 text-2xl">{metrics.avgPortfolioRisk}%</div>
            <div className="stat-desc">Average exposure</div>
          </div>
        </div>
        <div className="stats shadow bg-base-200">
          <div className="stat">
            <div className="stat-title">Trailing Success</div>
            <div className="stat-value text-emerald-400 text-2xl">{metrics.trailingStopWinRate}%</div>
            <div className="stat-desc">Win rate with trailing</div>
          </div>
        </div>
        <div className="stats shadow bg-base-200">
          <div className="stat">
            <div className="stat-title">Trailing Usage</div>
            <div className="stat-value text-emerald-400 text-2xl">{metrics.trailingStopUsage}%</div>
            <div className="stat-desc">Of total trades</div>
          </div>
        </div>
      </div>

      {/* Chart Selection */}
      <div className="tabs tabs-boxed bg-base-200 p-1">
        <a 
          className={`tab ${activeTab === 'stop-analysis' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('stop-analysis')}
        >
          Stop Loss Analysis
        </a>
      </div>

      {/* Active Chart */}
      <div className="card bg-base-100 shadow-lg">
        <div className="card-body">
          <h2 className="card-title text-base-content">{chartConfigs[activeTab].title}</h2>
          <p className="text-base-content/60">{chartConfigs[activeTab].description}</p>
          <div className="h-[600px]">
            <Scatter data={chartConfigs[activeTab].data} options={chartConfigs[activeTab].options} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
