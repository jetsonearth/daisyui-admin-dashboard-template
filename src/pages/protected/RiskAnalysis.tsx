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

const RiskAnalysis = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('mae-outcome');

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

  // Calculate key risk metrics
  const calculateRiskMetrics = () => {
    const closedTrades = trades.filter(t => t.status === 'Closed');
    
    // Time-based MAE Analysis
    const getTimeBasedMAE = (trade: Trade) => {
      const exitDate = new Date(trade.exit_datetime || '');
      const entryDate = new Date(trade.entry_datetime || '');
      const hoursDiff = (exitDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60);
      
      return {
        firstHour: hoursDiff <= 1,
        firstDay: hoursDiff <= 24,
        multiDay: hoursDiff > 24
      };
    };

    const timeBasedMAE = closedTrades.reduce((acc, trade) => {
      const timePhase = getTimeBasedMAE(trade);
      if (timePhase.firstHour) acc.firstHour.push(trade.mae || 0);
      if (timePhase.firstDay) acc.firstDay.push(trade.mae || 0);
      if (timePhase.multiDay) acc.multiDay.push(trade.mae || 0);
      return acc;
    }, { firstHour: [] as number[], firstDay: [] as number[], multiDay: [] as number[] });

    // Stop Loss Analysis
    const tradesWithStops = closedTrades.filter(t => t.stop_loss_33_percent || t.stop_loss_66_percent);
    const stopsHit = tradesWithStops.filter(t => 
      (t.mae_price || 0) <= (t.stop_loss_33_percent || 0) || 
      (t.mae_price || 0) <= (t.stop_loss_66_percent || 0)
    );

    // Strategy Analysis
    const strategyGroups = closedTrades.reduce((acc, t) => {
      const strategy = t.strategy || 'Unknown';
      if (!acc[strategy]) acc[strategy] = [];
      acc[strategy].push(t);
      return acc;
    }, {} as Record<string, Trade[]>);

    const strategyMAEs = Object.entries(strategyGroups).map(([strategy, trades]) => ({
      strategy,
      avgMAE: (trades.reduce((acc, t) => acc + (t.mae || 0), 0) / trades.length).toFixed(2),
      count: trades.length
    }));

    // Calculate average MAE for different time periods
    const calcAvg = (arr: number[]) => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2) : '0.00';

    return {
      totalTrades: closedTrades.length,
      // MAE Metrics
      avgMAER: (closedTrades.reduce((acc, t) => acc + (t.mae_r || 0), 0) / closedTrades.length).toFixed(2),
      avgMAEPercent: (closedTrades.reduce((acc, t) => acc + (t.mae || 0), 0) / closedTrades.length).toFixed(2),
      avgMAEDollars: (closedTrades.reduce((acc, t) => acc + (t.mae_dollars || 0), 0) / closedTrades.length).toFixed(2),
      // MFE Metrics
      avgMFER: (closedTrades.reduce((acc, t) => acc + (t.mfe_r || 0), 0) / closedTrades.length).toFixed(2),
      avgMFEPercent: (closedTrades.reduce((acc, t) => acc + (t.mfe || 0), 0) / closedTrades.length).toFixed(2),
      avgMFEDollars: (closedTrades.reduce((acc, t) => acc + (t.mfe_dollars || 0), 0) / closedTrades.length).toFixed(2),
      // Stop Loss Metrics
      stopLossHitRate: ((stopsHit.length / tradesWithStops.length) * 100).toFixed(1),
      avgStopDistance: (closedTrades.reduce((acc, t) => acc + (t.open_risk || 0), 0) / closedTrades.length).toFixed(2),
      // Time-based MAE Analysis
      firstHourMAE: calcAvg(timeBasedMAE.firstHour),
      firstDayMAE: calcAvg(timeBasedMAE.firstDay),
      multiDayMAE: calcAvg(timeBasedMAE.multiDay),
      // Strategy MAE Analysis
      strategyMAEs,
    };
  };

  // Common chart options
  const getCommonOptions = () => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      backgroundColor: 'transparent',
      scales: {
        x: {
          grid: {
            color: 'rgba(166, 173, 186, 0.2)',
            drawBorder: true,
            lineWidth: 1,
          },
          ticks: {
            color: '#a6adba',
            font: {
              size: 12
            }
          },
          border: {
            display: true,
            color: 'rgba(166, 173, 186, 0.3)',
          },
          title: {
            display: true,
            color: '#a6adba',
            font: {
              size: 14,
              weight: 'bold'
            }
          },
        },
        y: {
          grid: {
            color: 'rgba(166, 173, 186, 0.2)',
            drawBorder: true,
            lineWidth: 1,
          },
          ticks: {
            color: '#a6adba',
            font: {
              size: 12
            }
          },
          border: {
            display: true,
            color: 'rgba(166, 173, 186, 0.3)',
          },
          title: {
            display: true,
            color: '#a6adba',
            font: {
              size: 14,
              weight: 'bold'
            }
          },
        },
      },
      plugins: {
        legend: {
          labels: {
            color: '#a6adba',
            usePointStyle: true,
            pointStyle: 'circle',
            font: {
              size: 12
            }
          },
        },
        title: {
          display: true,
          color: '#a6adba',
          font: {
            size: 16,
            weight: 'bold'
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#ffffff',
          bodyColor: '#ffffff',
          borderColor: 'rgba(166, 173, 186, 0.3)',
          borderWidth: 1,
          padding: 10,
          displayColors: true,
          callbacks: {
            label: function(context) {
              const point = context.raw;
              return [
                `${point.ticker} (${point.strategy})`,
                `Exit Date: ${point.exitDate}`,
                `MAE: ${point.mae?.toFixed(2)}% / ${point.maeR?.toFixed(2)}R / $${point.maeDollars?.toFixed(2)}`,
                `MFE: ${point.mfe?.toFixed(2)}% / ${point.mfeR?.toFixed(2)}R / $${point.mfeDollars?.toFixed(2)}`,
                `PnL: ${point.pnlPercent?.toFixed(2)}% / $${point.pnl?.toFixed(2)}`,
                `Hold Time: ${point.holdingPeriod} days`,
                point.initialRisk ? `Initial Risk: $${point.initialRisk.toFixed(2)}` : '',
              ].filter(Boolean);
            }
          }
        }
      },
    };
  };

  // Chart configurations
  const chartConfigs = {
    'mae-outcome': {
      title: 'MAE vs Trade Outcome',
      description: 'Analysis of maximum drawdown vs final outcome. Helps identify optimal stop loss placement and risk tolerance.',
      data: {
        datasets: [
          {
            label: 'Winning Trades',
            data: trades
              .filter(t => t.status === 'Closed' && (t.risk_reward_ratio || 0) > 0)
              .map(t => ({
                x: t.risk_reward_ratio || 0,
                y: -(t.mae_r || 0),
                ticker: t.ticker,
                exitDate: new Date(t.exit_datetime || '').toLocaleDateString(),
                strategy: t.strategy || 'Unknown',
                mae: t.mae || 0,
                maeR: t.mae_r || 0,
                maeDollars: t.mae_dollars || 0,
                mfe: t.mfe || 0,
                mfeR: t.mfe_r || 0,
                mfeDollars: t.mfe_dollars || 0,
                pnl: t.realized_pnl || 0,
                pnlPercent: t.realized_pnl_percentage || 0,
                initialRisk: t.initial_risk_amount || 0,
              })),
            backgroundColor: '#34d399',
            borderColor: '#34d399',
            pointRadius: 5,
            pointHoverRadius: 8,
          },
          {
            label: 'Losing Trades',
            data: trades
              .filter(t => t.status === 'Closed' && (t.risk_reward_ratio || 0) <= 0)
              .map(t => ({
                x: t.risk_reward_ratio || 0,
                y: -(t.mae_r || 0),
                ticker: t.ticker,
                exitDate: new Date(t.exit_datetime || '').toLocaleDateString(),
                strategy: t.strategy || 'Unknown',
                mae: t.mae || 0,
                maeR: t.mae_r || 0,
                maeDollars: t.mae_dollars || 0,
                mfe: t.mfe || 0,
                mfeR: t.mfe_r || 0,
                mfeDollars: t.mfe_dollars || 0,
                pnl: t.realized_pnl || 0,
                pnlPercent: t.realized_pnl_percentage || 0,
                slDistance: t.open_risk || 0,
              })),
            backgroundColor: '#fb7185',
            borderColor: '#fb7185',
            pointRadius: 5,
            pointHoverRadius: 8,
          },
        ],
      },
      options: {
        ...getCommonOptions(),
        plugins: {
          ...getCommonOptions().plugins,
          title: {
            display: true,
            text: 'MAE vs Trade Outcome',
            color: '#a6adba',
            font: {
              size: 16,
              weight: 'bold'
            }
          }
        },
        scales: {
          x: {
            ...getCommonOptions().scales.x,
            title: {
              ...getCommonOptions().scales.x.title,
              text: 'Risk-Reward Ratio (R)',
            },
          },
          y: {
            ...getCommonOptions().scales.y,
            title: {
              ...getCommonOptions().scales.y.title,
              text: 'Maximum Adverse Excursion (R)',
            },
          },
        },
      },
    },
    'mae-holding': {
      title: 'MAE vs Holding Period',
      description: 'Analysis of drawdown relative to trade duration. Helps optimize holding periods.',
      data: {
        datasets: [
          {
            label: 'Winning Trades',
            data: trades
              .filter(t => t.status === 'Closed' && (t.risk_reward_ratio || 0) > 0)
              .map(t => ({
                x: t.holding_period || 0,
                y: -(t.mae_r || 0),
                ticker: t.ticker,
                exitDate: new Date(t.exit_datetime || '').toLocaleDateString(),
                strategy: t.strategy || 'Unknown',
                mae: t.mae || 0,
                maeR: t.mae_r || 0,
                maeDollars: t.mae_dollars || 0,
                mfe: t.mfe || 0,
                mfeR: t.mfe_r || 0,
                mfeDollars: t.mfe_dollars || 0,
                pnl: t.realized_pnl || 0,
                pnlPercent: t.realized_pnl_percentage || 0,
                initialRisk: t.initial_risk_amount || 0,
              })),
            backgroundColor: '#34d399',
            borderColor: '#34d399',
            pointRadius: 5,
            pointHoverRadius: 8,
          },
          {
            label: 'Losing Trades',
            data: trades
              .filter(t => t.status === 'Closed' && (t.risk_reward_ratio || 0) <= 0)
              .map(t => ({
                x: t.holding_period || 0,
                y: -(t.mae_r || 0),
                ticker: t.ticker,
                exitDate: new Date(t.exit_datetime || '').toLocaleDateString(),
                strategy: t.strategy || 'Unknown',
                mae: t.mae || 0,
                maeR: t.mae_r || 0,
                maeDollars: t.mae_dollars || 0,
                mfe: t.mfe || 0,
                mfeR: t.mfe_r || 0,
                mfeDollars: t.mfe_dollars || 0,
                pnl: t.realized_pnl || 0,
                pnlPercent: t.realized_pnl_percentage || 0,
                initialRisk: t.initial_risk_amount || 0,
              })),
            backgroundColor: '#fb7185',
            borderColor: '#fb7185',
            pointRadius: 5,
            pointHoverRadius: 8,
          },
        ],
      },
      options: {
        ...getCommonOptions(),
        plugins: {
          ...getCommonOptions().plugins,
          title: {
            display: true,
            text: 'MAE vs Holding Period',
            color: '#a6adba',
            font: {
              size: 16,
              weight: 'bold'
            }
          }
        },
        scales: {
          x: {
            ...getCommonOptions().scales.x,
            title: {
              ...getCommonOptions().scales.x.title,
              text: 'Holding Period (Days)',
            },
          },
          y: {
            ...getCommonOptions().scales.y,
            title: {
              ...getCommonOptions().scales.y.title,
              text: 'Maximum Adverse Excursion (R)',
            },
          },
        },
      },
    },
    'stop-analysis': {
      title: 'Stop Loss Effectiveness',
      description: 'Analysis of stop loss placement and its relationship with MAE',
      data: {
        datasets: [
          {
            label: 'Winning Trades',
            data: trades
              .filter(t => t.status === 'Closed' && (t.risk_reward_ratio || 0) > 0)
              .map(t => ({
                x: t.open_risk || 0,
                y: -(t.mae || 0),
                ticker: t.ticker,
                strategy: t.strategy || 'Unknown',
                exitDate: new Date(t.exit_datetime || '').toLocaleDateString(),
                stopDistance: t.open_risk,
                mae: t.mae,
                maeR: t.mae_r,
                maeDollars: t.mae_dollars,
                initialRisk: t.initial_risk_amount,
                rr: t.risk_reward_ratio,
                stop33: t.stop_loss_33_percent,
                stop66: t.stop_loss_66_percent,
              })),
            backgroundColor: '#34d399',
            borderColor: '#34d399',
            pointRadius: 5,
            pointHoverRadius: 8,
          },
          {
            label: 'Losing Trades',
            data: trades
              .filter(t => t.status === 'Closed' && (t.risk_reward_ratio || 0) <= 0)
              .map(t => ({
                x: t.open_risk || 0,
                y: -(t.mae || 0),
                ticker: t.ticker,
                strategy: t.strategy || 'Unknown',
                exitDate: new Date(t.exit_datetime || '').toLocaleDateString(),
                stopDistance: t.open_risk,
                mae: t.mae,
                maeR: t.mae_r,
                maeDollars: t.mae_dollars,
                initialRisk: t.initial_risk_amount,
                rr: t.risk_reward_ratio,
                stop33: t.stop_loss_33_percent,
                stop66: t.stop_loss_66_percent,
              })),
            backgroundColor: '#fb7185',
            borderColor: '#fb7185',
            pointRadius: 5,
            pointHoverRadius: 8,
          },
        ],
      },
      options: {
        ...getCommonOptions(),
        plugins: {
          ...getCommonOptions().plugins,
          title: {
            display: true,
            text: 'Stop Loss Effectiveness',
            color: '#a6adba',
            font: {
              size: 16,
              weight: 'bold'
            }
          }
        },
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
    'mfe-outcome': {
      title: 'MFE vs Trade Outcome',
      description: 'Analysis of maximum favorable excursion vs final outcome. Helps identify optimal profit targets and trade management.',
      data: {
        datasets: [
          {
            label: 'Winning Trades',
            data: trades
              .filter(t => t.status === 'Closed' && (t.risk_reward_ratio || 0) > 0)
              .map(t => ({
                x: t.risk_reward_ratio || 0,
                y: t.mfe_r || 0,
                ticker: t.ticker,
                exitDate: new Date(t.exit_datetime || '').toLocaleDateString(),
                strategy: t.strategy || 'Unknown',
                mae: t.mae || 0,
                maeR: t.mae_r || 0,
                maeDollars: t.mae_dollars || 0,
                mfe: t.mfe || 0,
                mfeR: t.mfe_r || 0,
                mfeDollars: t.mfe_dollars || 0,
                pnl: t.realized_pnl || 0,
                pnlPercent: t.realized_pnl_percentage || 0,
                initialRisk: t.initial_risk_amount || 0,
              })),
            backgroundColor: '#34d399',
            borderColor: '#34d399',
            pointRadius: 5,
            pointHoverRadius: 8,
          },
          {
            label: 'Losing Trades',
            data: trades
              .filter(t => t.status === 'Closed' && (t.risk_reward_ratio || 0) <= 0)
              .map(t => ({
                x: t.risk_reward_ratio || 0,
                y: t.mfe_r || 0,
                ticker: t.ticker,
                exitDate: new Date(t.exit_datetime || '').toLocaleDateString(),
                strategy: t.strategy || 'Unknown',
                mae: t.mae || 0,
                maeR: t.mae_r || 0,
                maeDollars: t.mae_dollars || 0,
                mfe: t.mfe || 0,
                mfeR: t.mfe_r || 0,
                mfeDollars: t.mfe_dollars || 0,
                pnl: t.realized_pnl || 0,
                pnlPercent: t.realized_pnl_percentage || 0,
                initialRisk: t.initial_risk_amount || 0,
              })),
            backgroundColor: '#fb7185',
            borderColor: '#fb7185',
            pointRadius: 5,
            pointHoverRadius: 8,
          },
        ],
      },
      options: {
        ...getCommonOptions(),
        plugins: {
          ...getCommonOptions().plugins,
          title: {
            display: true,
            text: 'MFE vs Trade Outcome',
            color: '#a6adba',
            font: {
              size: 16,
              weight: 'bold'
            }
          }
        },
        scales: {
          x: {
            ...getCommonOptions().scales.x,
            title: {
              ...getCommonOptions().scales.x.title,
              text: 'Risk-Reward Ratio (R)',
            },
          },
          y: {
            ...getCommonOptions().scales.y,
            title: {
              ...getCommonOptions().scales.y.title,
              text: 'Maximum Favorable Excursion (R)',
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
          <p className="text-base-content/60">Loading risk analysis data...</p>
        </div>
      </div>
    );
  }

  const metrics = calculateRiskMetrics();
  const activeChart = chartConfigs[activeTab];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-base-content mb-2">Risk Analysis</h1>
          <p className="text-base-content/60">Comprehensive analysis of trading risks and outcomes</p>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <div className="stats shadow bg-base-200">
          <div className="stat">
            <div className="stat-title">MAE (R)</div>
            <div className="stat-value text-rose-400 text-2xl">{metrics.avgMAER}</div>
            <div className="stat-desc">Risk Multiple</div>
          </div>
        </div>
        <div className="stats shadow bg-base-200">
          <div className="stat">
            <div className="stat-title">MAE (%)</div>
            <div className="stat-value text-rose-400 text-2xl">{metrics.avgMAEPercent}%</div>
            <div className="stat-desc">Percentage</div>
          </div>
        </div>
        <div className="stats shadow bg-base-200">
          <div className="stat">
            <div className="stat-title">MAE ($)</div>
            <div className="stat-value text-rose-400 text-2xl">${Math.abs(Number(metrics.avgMAEDollars)).toLocaleString()}</div>
            <div className="stat-desc">Dollar Value</div>
          </div>
        </div>
        <div className="stats shadow bg-base-200">
          <div className="stat">
            <div className="stat-title">MFE (R)</div>
            <div className="stat-value text-emerald-400 text-2xl">{metrics.avgMFER}</div>
            <div className="stat-desc">Risk Multiple</div>
          </div>
        </div>
        <div className="stats shadow bg-base-200">
          <div className="stat">
            <div className="stat-title">MFE (%)</div>
            <div className="stat-value text-emerald-400 text-2xl">{metrics.avgMFEPercent}%</div>
            <div className="stat-desc">Percentage</div>
          </div>
        </div>
        <div className="stats shadow bg-base-200">
          <div className="stat">
            <div className="stat-title">MFE ($)</div>
            <div className="stat-value text-emerald-400 text-2xl">${Math.abs(Number(metrics.avgMFEDollars)).toLocaleString()}</div>
            <div className="stat-desc">Dollar Value</div>
          </div>
        </div>
      </div>

      {/* Chart Selection */}
      <div className="tabs tabs-boxed bg-base-200 p-1">
        <a 
          className={`tab ${activeTab === 'mae-outcome' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('mae-outcome')}
        >
          MAE vs Outcome
        </a>
        <a 
          className={`tab ${activeTab === 'mae-holding' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('mae-holding')}
        >
          MAE vs Holding
        </a>
        <a 
          className={`tab ${activeTab === 'stop-analysis' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('stop-analysis')}
        >
          Stop Loss Analysis
        </a>
        <a 
          className={`tab ${activeTab === 'mfe-outcome' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('mfe-outcome')}
        >
          MFE vs Outcome
        </a>
      </div>

      {/* Active Chart */}
      <div className="card bg-base-100 shadow-lg">
        <div className="card-body">
          <h2 className="card-title text-base-content">{activeChart.title}</h2>
          <p className="text-base-content/60">{activeChart.description}</p>
          <div className="h-[600px]">
            <Scatter data={activeChart.data} options={activeChart.options} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default RiskAnalysis;
