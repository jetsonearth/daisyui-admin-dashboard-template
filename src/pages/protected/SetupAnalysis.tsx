import React, { useEffect, useState } from 'react';
import { metricsService } from '../../features/metrics/metricsService';
import { Trade, SETUPS } from '../../types';
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
  ArcElement,
} from 'chart.js';
import { Bar, Line, Radar, Pie } from 'react-chartjs-2';
import 'chart.js/auto';
import TitleCard from '../../components/Cards/TitleCard';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  RadialLinearScale,
  ArcElement
);

interface SetupMetrics {
  winRate: number;
  avgRMultiple: number;
  frequency: number;
  totalTrades: number;
  profitableTrades: number;
  avgWin: number;
  avgLoss: number;
  rrr: number;
}

const SetupAnalysis: React.FC = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [setupMetrics, setSetupMetrics] = useState<Record<string, SetupMetrics>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const fetchedTrades = await metricsService.fetchTrades();
        const closedTrades = fetchedTrades.filter(trade => trade.status === 'Closed');
        setTrades(closedTrades);
        
        // Calculate metrics for each setup
        const metrics: Record<string, SetupMetrics> = {};
        
        SETUPS.forEach(setup => {
          const setupTrades = closedTrades.filter(trade => trade.setups?.includes(setup));
          const totalTrades = setupTrades.length;
          if (totalTrades === 0) return;

          const profitableTrades = setupTrades.filter(trade => trade.realized_pnl > 0).length;
          const winRate = (profitableTrades / totalTrades) * 100;
          
          const rMultiples = setupTrades.map(trade => {
            const riskAmount = trade.stop_loss_price 
              ? Math.abs(trade.entry_price - trade.stop_loss_price) * trade.total_shares
              : trade.initial_position_risk || 0;
            return riskAmount !== 0 ? trade.realized_pnl / riskAmount : 0;
          });

          const avgRMultiple = rMultiples.reduce((acc, curr) => acc + curr, 0) / totalTrades;
          const frequency = (totalTrades / closedTrades.length) * 100;

          const wins = setupTrades.filter(t => t.realized_pnl > 0);
          const losses = setupTrades.filter(t => t.realized_pnl < 0);
          
          const avgWin = wins.length > 0 
            ? wins.reduce((acc, t) => acc + t.realized_pnl, 0) / wins.length 
            : 0;
          const avgLoss = losses.length > 0 
            ? Math.abs(losses.reduce((acc, t) => acc + t.realized_pnl, 0)) / losses.length 
            : 0;
          
          const rrr = avgLoss !== 0 ? avgWin / avgLoss : 0;

          metrics[setup] = {
            winRate,
            avgRMultiple,
            frequency,
            totalTrades,
            profitableTrades,
            avgWin,
            avgLoss,
            rrr
          };
        });

        setSetupMetrics(metrics);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching trade data:', error);
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const setupLabels = Object.keys(setupMetrics);
  const colors = [
    'rgba(255, 99, 132, 0.6)',
    'rgba(54, 162, 235, 0.6)',
    'rgba(255, 206, 86, 0.6)',
    'rgba(75, 192, 192, 0.6)',
    'rgba(153, 102, 255, 0.6)',
    'rgba(255, 159, 64, 0.6)',
  ];

  const winRateData = {
    labels: setupLabels,
    datasets: [{
      label: 'Win Rate (%)',
      data: setupLabels.map(setup => setupMetrics[setup].winRate),
      backgroundColor: colors[0],
      borderColor: colors[0].replace('0.6', '1'),
      borderWidth: 1,
    }]
  };

  const rMultipleData = {
    labels: setupLabels,
    datasets: [{
      label: 'Average R-Multiple',
      data: setupLabels.map(setup => setupMetrics[setup].avgRMultiple),
      backgroundColor: colors[1],
      borderColor: colors[1].replace('0.6', '1'),
      borderWidth: 1,
    }]
  };

  const frequencyData = {
    labels: setupLabels,
    datasets: [{
      label: 'Setup Usage (%)',
      data: setupLabels.map(setup => setupMetrics[setup].frequency),
      backgroundColor: colors.slice(0, setupLabels.length),
      borderColor: colors.slice(0, setupLabels.length).map(c => c.replace('0.6', '1')),
      borderWidth: 1,
    }]
  };

  const radarData = {
    labels: setupLabels,
    datasets: [{
      label: 'Win Rate',
      data: setupLabels.map(setup => setupMetrics[setup].winRate),
      backgroundColor: colors[0].replace('0.6', '0.2'),
      borderColor: colors[0].replace('0.6', '1'),
      borderWidth: 2,
    }, {
      label: 'R/R Ratio',
      data: setupLabels.map(setup => setupMetrics[setup].rrr * 10), // Scale up for visibility
      backgroundColor: colors[1].replace('0.6', '0.2'),
      borderColor: colors[1].replace('0.6', '1'),
      borderWidth: 2,
    }, {
      label: 'Frequency',
      data: setupLabels.map(setup => setupMetrics[setup].frequency),
      backgroundColor: colors[2].replace('0.6', '0.2'),
      borderColor: colors[2].replace('0.6', '1'),
      borderWidth: 2,
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            label += Math.round(context.parsed.y * 100) / 100;
            return label;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
      }
    }
  };

  const radarOptions = {
    ...chartOptions,
    scales: undefined,
    elements: {
      line: {
        tension: 0.2
      }
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="grid grid-cols-2 gap-4 p-4">
      <TitleCard title="Win Rate by Setup">
        <div className="h-80">
          <Bar data={winRateData} options={chartOptions} />
        </div>
      </TitleCard>

      <TitleCard title="Average R-Multiple by Setup">
        <div className="h-80">
          <Bar data={rMultipleData} options={chartOptions} />
        </div>
      </TitleCard>

      <TitleCard title="Setup Usage Distribution">
        <div className="h-80">
          <Pie data={frequencyData} options={chartOptions} />
        </div>
      </TitleCard>

      <TitleCard title="Setup Performance Comparison">
        <div className="h-80">
          <Radar data={radarData} options={radarOptions} />
        </div>
      </TitleCard>

      <TitleCard title="Setup Performance Summary" className="col-span-2">
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-4 py-2">Setup</th>
                <th className="px-4 py-2">Win Rate</th>
                <th className="px-4 py-2">Avg R-Multiple</th>
                <th className="px-4 py-2">R/R Ratio</th>
                <th className="px-4 py-2">Total Trades</th>
                <th className="px-4 py-2">Usage %</th>
              </tr>
            </thead>
            <tbody>
              {setupLabels.map(setup => (
                <tr key={setup} className="border-b">
                  <td className="px-4 py-2">{setup}</td>
                  <td className="px-4 py-2">{setupMetrics[setup].winRate.toFixed(2)}%</td>
                  <td className="px-4 py-2">{setupMetrics[setup].avgRMultiple.toFixed(2)}R</td>
                  <td className="px-4 py-2">{setupMetrics[setup].rrr.toFixed(2)}</td>
                  <td className="px-4 py-2">{setupMetrics[setup].totalTrades}</td>
                  <td className="px-4 py-2">{setupMetrics[setup].frequency.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TitleCard>
    </div>
  );
};

export default SetupAnalysis;