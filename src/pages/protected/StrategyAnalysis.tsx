import React, { useEffect, useState } from 'react';
import { metricsService } from '../../features/metrics/metricsService';
import { Trade, STRATEGIES, SETUPS } from '../../types';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  RadialLinearScale,
} from 'chart.js';
import { Bar, Line, Radar } from 'react-chartjs-2';
import 'chart.js/auto';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend
);

interface StrategyMetrics {
  winRate: number;
  profitFactor: number;
  averageR: number;
  avgHoldingPeriod: number;
  totalTrades: number;
  avgCommission: number;
  avgPortfolioRisk: number;
  bestRMultiple: number;
  worstRMultiple: number;
  targetAchievementRate: number;
  mfeAverage: number;
  maeAverage: number;
  avgTimeToMfe: number;
  avgTimeToMae: number;
  trimmingEfficiency: number;
}

const StrategyAnalysis = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStrategy, setSelectedStrategy] = useState<string>('All');
  const [selectedSetup, setSelectedSetup] = useState<string>('All');
  const [strategyMetrics, setStrategyMetrics] = useState<Record<string, StrategyMetrics>>({});
  const [activeTab, setActiveTab] = useState('performance');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const fetchedTrades = await metricsService.fetchTrades();
        setTrades(fetchedTrades);
        const metrics = calculateMetrics(fetchedTrades);
        setStrategyMetrics(metrics);
      } catch (error) {
        console.error('Error fetching trade data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const calculateMetrics = (trades: Trade[]): Record<string, StrategyMetrics> => {
    const metrics: Record<string, StrategyMetrics> = {};
    
    // Group trades by strategy
    const strategyGroups = trades.reduce((acc, trade) => {
      const strategy = trade.strategy || 'Unknown';
      if (!acc[strategy]) acc[strategy] = [];
      acc[strategy].push(trade);
      return acc;
    }, {} as Record<string, Trade[]>);

    // Calculate metrics for each strategy
    Object.entries(strategyGroups).forEach(([strategy, strategyTrades]) => {
      const winningTrades = strategyTrades.filter(t => (t.risk_reward_ratio || 0) > 0);
      const losingTrades = strategyTrades.filter(t => (t.risk_reward_ratio || 0) <= 0);
      
      const grossProfit = winningTrades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0);
      const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0));
      
      metrics[strategy] = {
        winRate: (winningTrades.length / strategyTrades.length) * 100,
        profitFactor: grossLoss === 0 ? grossProfit : grossProfit / grossLoss,
        averageR: strategyTrades.reduce((sum, t) => sum + (t.risk_reward_ratio || 0), 0) / strategyTrades.length,
        avgHoldingPeriod: strategyTrades.reduce((sum, t) => sum + (t.holding_period || 0), 0) / strategyTrades.length,
        totalTrades: strategyTrades.length,
        avgCommission: strategyTrades.reduce((sum, t) => sum + (t.commission || 0), 0) / strategyTrades.length,
        avgPortfolioRisk: strategyTrades.reduce((sum, t) => sum + (t.portfolio_risk || 0), 0) / strategyTrades.length,
        bestRMultiple: Math.max(...strategyTrades.map(t => t.risk_reward_ratio || 0)),
        worstRMultiple: Math.min(...strategyTrades.map(t => t.risk_reward_ratio || 0)),
        targetAchievementRate: calculateTargetAchievement(strategyTrades),
        mfeAverage: strategyTrades.reduce((sum, t) => sum + (t.mfe || 0), 0) / strategyTrades.length,
        maeAverage: strategyTrades.reduce((sum, t) => sum + (t.mae || 0), 0) / strategyTrades.length,
        avgTimeToMfe: calculateAvgTimeToExtreme(strategyTrades, true),
        avgTimeToMae: calculateAvgTimeToExtreme(strategyTrades, false),
        trimmingEfficiency: calculateTrimmingEfficiency(strategyTrades),
      };
    });

    return metrics;
  };

  const calculateTargetAchievement = (trades: Trade[]): number => {
    const tradesWithTargets = trades.filter(t => t.r_target_2);
    if (tradesWithTargets.length === 0) return 0;
    
    const achievedTargets = tradesWithTargets.filter(t => 
      (t.mfe_r || 0) >= (t.r_target_2 || 0)
    ).length;
    
    return (achievedTargets / tradesWithTargets.length) * 100;
  };

  const calculateAvgTimeToExtreme = (trades: Trade[], isMfe: boolean): number => {
    const validTrades = trades.filter(t => t.entry_datetime && t.exit_datetime);
    if (validTrades.length === 0) return 0;

    return validTrades.reduce((sum, t) => {
      const entryDate = new Date(t.entry_datetime!);
      const exitDate = new Date(t.exit_datetime!);
      const holdingPeriodHours = (exitDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60);
      
      // Assume MFE/MAE occurred proportionally to the final outcome
      const multiplier = isMfe ? (t.mfe || 0) / (t.realized_pnl_percentage || 1) : (t.mae || 0) / (t.realized_pnl_percentage || 1);
      return sum + (holdingPeriodHours * multiplier);
    }, 0) / validTrades.length;
  };

  const calculateTrimmingEfficiency = (trades: Trade[]): number => {
    const trimmedTrades = trades.filter(t => t.trimmed_percentage);
    if (trimmedTrades.length === 0) return 0;

    return trimmedTrades.reduce((sum, t) => {
      const trimmedPct = t.trimmed_percentage || 0;
      const mfe = t.mfe || 0;
      return sum + (trimmedPct / mfe);
    }, 0) / trimmedTrades.length * 100;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-4">
          <span className="loading loading-spinner loading-lg"></span>
          <p className="text-base-content/60">Loading strategy analysis data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-base-content mb-2">Strategy Analysis</h1>
          <p className="text-base-content/60">Detailed analysis of trading strategies and their performance</p>
        </div>
      </div>

      {/* Strategy and Setup Selectors */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="form-control w-full max-w-xs">
          <label className="label">
            <span className="label-text">Strategy</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={selectedStrategy}
            onChange={(e) => setSelectedStrategy(e.target.value)}
          >
            <option value="All">All Strategies</option>
            {Object.values(STRATEGIES).map((strategy) => (
              <option key={strategy} value={strategy}>
                {strategy}
              </option>
            ))}
          </select>
        </div>
        <div className="form-control w-full max-w-xs">
          <label className="label">
            <span className="label-text">Setup</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={selectedSetup}
            onChange={(e) => setSelectedSetup(e.target.value)}
          >
            <option value="All">All Setups</option>
            {SETUPS.map((setup) => (
              <option key={setup} value={setup}>
                {setup}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Analysis Tabs */}
      <div className="tabs tabs-boxed mb-6">
        <button
          className={`tab ${activeTab === 'performance' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('performance')}
        >
          Performance
        </button>
        <button
          className={`tab ${activeTab === 'entry' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('entry')}
        >
          Entry Analysis
        </button>
        <button
          className={`tab ${activeTab === 'exit' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('exit')}
        >
          Exit Analysis
        </button>
        <button
          className={`tab ${activeTab === 'risk' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('risk')}
        >
          Risk Management
        </button>
      </div>

      {/* Performance Metrics */}
      {activeTab === 'performance' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(strategyMetrics).map(([strategy, metrics]) => (
            <div key={strategy} className="card bg-base-200 shadow-xl">
              <div className="card-body">
                <h2 className="card-title text-base-content">{strategy}</h2>
                <div className="stats stats-vertical shadow">
                  <div className="stat">
                    <div className="stat-title">Win Rate</div>
                    <div className="stat-value text-2xl">{metrics.winRate.toFixed(1)}%</div>
                    <div className="stat-desc">{metrics.totalTrades} Total Trades</div>
                  </div>
                  <div className="stat">
                    <div className="stat-title">Average R</div>
                    <div className="stat-value text-2xl">{metrics.averageR.toFixed(2)}R</div>
                    <div className="stat-desc">Best: {metrics.bestRMultiple.toFixed(2)}R</div>
                  </div>
                  <div className="stat">
                    <div className="stat-title">Profit Factor</div>
                    <div className="stat-value text-2xl">{metrics.profitFactor.toFixed(2)}</div>
                    <div className="stat-desc">Gross Profit / Gross Loss</div>
                  </div>
                  <div className="stat">
                    <div className="stat-title">Avg Holding Period</div>
                    <div className="stat-value text-2xl">{metrics.avgHoldingPeriod.toFixed(1)}d</div>
                    <div className="stat-desc">In Days</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StrategyAnalysis;
