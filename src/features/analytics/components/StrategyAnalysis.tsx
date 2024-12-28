import React from 'react';
import { Trade } from '../../../types';
import { Bar, Line } from 'react-chartjs-2';
import { groupBy } from 'lodash';

interface StrategyAnalysisProps {
    trades: Trade[];
}

const StrategyAnalysis: React.FC<StrategyAnalysisProps> = ({ trades }) => {
    // Strategy Performance Analysis
    const getStrategyPerformance = () => {
        const strategyGroups = groupBy(trades, 'strategy');
        const strategies = Object.keys(strategyGroups);
        
        const data = strategies.map(strategy => {
            const strategyTrades = strategyGroups[strategy];
            const wins = strategyTrades.filter(t => (t.realized_r || 0) > 0).length;
            const total = strategyTrades.length;
            const winRate = (wins / total) * 100;
            const avgR = strategyTrades.reduce((sum, t) => sum + (t.realized_r || 0), 0) / total;
            const profitFactor = strategyTrades.reduce((sum, t) => sum + Math.max(0, t.realized_r || 0), 0) / 
                               Math.abs(strategyTrades.reduce((sum, t) => sum + Math.min(0, t.realized_r || 0), 0));
            
            return {
                strategy,
                winRate,
                avgR,
                profitFactor,
                count: total,
            };
        });

        return {
            labels: data.map(d => d.strategy),
            datasets: [
                {
                    label: 'Win Rate (%)',
                    data: data.map(d => d.winRate),
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    yAxisID: 'y',
                },
                {
                    label: 'Average R',
                    data: data.map(d => d.avgR),
                    backgroundColor: 'rgba(255, 99, 132, 0.6)',
                    yAxisID: 'y1',
                },
                {
                    label: 'Profit Factor',
                    data: data.map(d => d.profitFactor),
                    backgroundColor: 'rgba(255, 206, 86, 0.6)',
                    yAxisID: 'y2',
                }
            ]
        };
    };

    // Setup Performance Analysis
    const getSetupPerformance = () => {
        const setupPerformance = {};
        trades.forEach(trade => {
            (trade.setups || []).forEach(setup => {
                if (!setupPerformance[setup]) {
                    setupPerformance[setup] = {
                        wins: 0,
                        losses: 0,
                        totalR: 0,
                    };
                }
                
                if ((trade.realized_r || 0) > 0) {
                    setupPerformance[setup].wins++;
                } else {
                    setupPerformance[setup].losses++;
                }
                setupPerformance[setup].totalR += trade.realized_r || 0;
            });
        });

        const data = Object.entries(setupPerformance).map(([setup, stats]) => ({
            setup,
            winRate: (stats.wins / (stats.wins + stats.losses)) * 100,
            avgR: stats.totalR / (stats.wins + stats.losses),
            count: stats.wins + stats.losses,
        }));

        return {
            labels: data.map(d => d.setup),
            datasets: [
                {
                    label: 'Win Rate (%)',
                    data: data.map(d => d.winRate),
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                },
                {
                    label: 'Average R',
                    data: data.map(d => d.avgR),
                    backgroundColor: 'rgba(255, 99, 132, 0.6)',
                }
            ]
        };
    };

    // Strategy Equity Curves
    const getStrategyEquityCurves = () => {
        const strategyGroups = groupBy(trades, 'strategy');
        
        const datasets = Object.entries(strategyGroups).map(([strategy, trades]) => {
            const sortedTrades = [...trades].sort((a, b) => 
                new Date(a.exit_datetime || 0).getTime() - new Date(b.exit_datetime || 0).getTime()
            );

            let equity = 0;
            const data = sortedTrades.map(trade => {
                equity += trade.realized_r || 0;
                return {
                    x: trade.exit_datetime,
                    y: equity,
                };
            });

            return {
                label: strategy,
                data: data,
                fill: false,
                tension: 0.1,
            };
        });

        return {
            datasets,
        };
    };

    return (
        <div className="grid grid-cols-1 gap-6">
            <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                    <h2 className="card-title">Strategy Performance</h2>
                    <p className="text-sm text-base-content/70">
                        Comparison of win rates, average R, and profit factor across different strategies.
                    </p>
                    <div className="h-[400px]">
                        <Bar 
                            data={getStrategyPerformance()}
                            options={{
                                scales: {
                                    y: {
                                        type: 'linear',
                                        display: true,
                                        position: 'left',
                                        title: {
                                            display: true,
                                            text: 'Win Rate (%)',
                                        }
                                    },
                                    y1: {
                                        type: 'linear',
                                        display: true,
                                        position: 'right',
                                        title: {
                                            display: true,
                                            text: 'Average R',
                                        },
                                        grid: {
                                            drawOnChartArea: false,
                                        },
                                    },
                                    y2: {
                                        type: 'linear',
                                        display: true,
                                        position: 'right',
                                        title: {
                                            display: true,
                                            text: 'Profit Factor',
                                        },
                                        grid: {
                                            drawOnChartArea: false,
                                        },
                                    }
                                }
                            }}
                        />
                    </div>
                </div>
            </div>

            <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                    <h2 className="card-title">Setup Performance</h2>
                    <p className="text-sm text-base-content/70">
                        Performance metrics for different trade setups.
                    </p>
                    <div className="h-[400px]">
                        <Bar 
                            data={getSetupPerformance()}
                            options={{
                                scales: {
                                    y: {
                                        beginAtZero: true,
                                        title: {
                                            display: true,
                                            text: 'Value',
                                        }
                                    }
                                }
                            }}
                        />
                    </div>
                </div>
            </div>

            <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                    <h2 className="card-title">Strategy Equity Curves</h2>
                    <p className="text-sm text-base-content/70">
                        Cumulative R multiple over time for each strategy.
                    </p>
                    <div className="h-[400px]">
                        <Line 
                            data={getStrategyEquityCurves()}
                            options={{
                                scales: {
                                    x: {
                                        type: 'time',
                                        time: {
                                            unit: 'day'
                                        },
                                        title: {
                                            display: true,
                                            text: 'Date',
                                        }
                                    },
                                    y: {
                                        title: {
                                            display: true,
                                            text: 'Cumulative R',
                                        }
                                    }
                                }
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StrategyAnalysis;
