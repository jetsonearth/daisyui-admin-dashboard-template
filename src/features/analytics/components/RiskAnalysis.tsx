import React from 'react';
import { Trade } from '../../../types';
import { Scatter, Bar } from 'react-chartjs-2';
import { groupBy } from 'lodash';

interface RiskAnalysisProps {
    trades: Trade[];
}

const RiskAnalysis: React.FC<RiskAnalysisProps> = ({ trades }) => {
    // MAE vs Outcome Analysis
    const getMaeScatterData = () => {
        const data = trades.map(trade => ({
            x: trade.mae_r || 0,
            y: trade.realized_r || 0,
            strategy: trade.strategy,
        }));

        return {
            datasets: [{
                label: 'MAE vs Trade Outcome',
                data: data,
                backgroundColor: data.map(point => 
                    point.y > 0 ? 'rgba(75, 192, 192, 0.6)' : 'rgba(255, 99, 132, 0.6)'
                ),
            }]
        };
    };

    // Risk Distribution Analysis
    const getRiskDistribution = () => {
        const riskBuckets = groupBy(trades, trade => {
            const risk = trade.initial_position_risk || 0;
            return Math.floor(risk * 10) / 10; // Round to nearest 0.1
        });

        const labels = Object.keys(riskBuckets).sort((a, b) => Number(a) - Number(b));
        const data = labels.map(risk => ({
            risk: Number(risk),
            count: riskBuckets[risk].length,
            winRate: riskBuckets[risk].filter(t => (t.realized_r || 0) > 0).length / riskBuckets[risk].length * 100,
        }));

        return {
            labels: data.map(d => d.risk.toFixed(1) + '%'),
            datasets: [
                {
                    label: 'Trade Count',
                    data: data.map(d => d.count),
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    yAxisID: 'y',
                },
                {
                    label: 'Win Rate',
                    data: data.map(d => d.winRate),
                    backgroundColor: 'rgba(255, 99, 132, 0.6)',
                    yAxisID: 'y1',
                    type: 'line',
                }
            ]
        };
    };

    // Heat Map Analysis
    const getHeatMapData = () => {
        const heatData = trades.map(trade => ({
            mae: trade.mae_r || 0,
            mfe: trade.mfe_r || 0,
            outcome: trade.realized_r || 0,
        }));

        // Calculate average outcome for different MAE/MFE combinations
        const heatMap = {};
        heatData.forEach(point => {
            const maeKey = Math.floor(point.mae * 2) / 2; // Round to nearest 0.5
            const mfeKey = Math.floor(point.mfe * 2) / 2;
            
            if (!heatMap[maeKey]) heatMap[maeKey] = {};
            if (!heatMap[maeKey][mfeKey]) {
                heatMap[maeKey][mfeKey] = {
                    sum: 0,
                    count: 0,
                };
            }
            
            heatMap[maeKey][mfeKey].sum += point.outcome;
            heatMap[maeKey][mfeKey].count += 1;
        });

        // Convert to chart.js format
        const data = [];
        Object.keys(heatMap).forEach(mae => {
            Object.keys(heatMap[mae]).forEach(mfe => {
                const avg = heatMap[mae][mfe].sum / heatMap[mae][mfe].count;
                data.push({
                    x: Number(mae),
                    y: Number(mfe),
                    v: avg,
                });
            });
        });

        return {
            datasets: [{
                label: 'Average Outcome',
                data: data,
                backgroundColor: data.map(point => 
                    point.v > 0 
                        ? `rgba(75, 192, 192, ${Math.min(Math.abs(point.v) / 2, 1)})`
                        : `rgba(255, 99, 132, ${Math.min(Math.abs(point.v) / 2, 1)})`
                ),
            }]
        };
    };

    return (
        <div className="grid grid-cols-1 gap-6">
            <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                    <h2 className="card-title">MAE vs Trade Outcome</h2>
                    <p className="text-sm text-base-content/70">
                        Scatter plot showing the relationship between Maximum Adverse Excursion (MAE) 
                        and final trade outcome. Green dots represent winning trades, red dots represent losing trades.
                    </p>
                    <div className="h-[400px]">
                        <Scatter 
                            data={getMaeScatterData()}
                            options={{
                                scales: {
                                    x: {
                                        title: {
                                            display: true,
                                            text: 'MAE (R)',
                                        }
                                    },
                                    y: {
                                        title: {
                                            display: true,
                                            text: 'Trade Outcome (R)',
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
                    <h2 className="card-title">Risk Distribution</h2>
                    <p className="text-sm text-base-content/70">
                        Distribution of initial risk per trade and corresponding win rates.
                    </p>
                    <div className="h-[400px]">
                        <Bar 
                            data={getRiskDistribution()}
                            options={{
                                scales: {
                                    y: {
                                        type: 'linear',
                                        display: true,
                                        position: 'left',
                                        title: {
                                            display: true,
                                            text: 'Trade Count',
                                        }
                                    },
                                    y1: {
                                        type: 'linear',
                                        display: true,
                                        position: 'right',
                                        title: {
                                            display: true,
                                            text: 'Win Rate (%)',
                                        },
                                        grid: {
                                            drawOnChartArea: false,
                                        },
                                    },
                                }
                            }}
                        />
                    </div>
                </div>
            </div>

            <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                    <h2 className="card-title">Risk Heat Map</h2>
                    <p className="text-sm text-base-content/70">
                        Heat map showing average trade outcomes for different MAE/MFE combinations.
                        Darker green indicates better outcomes, darker red indicates worse outcomes.
                    </p>
                    <div className="h-[400px]">
                        <Scatter 
                            data={getHeatMapData()}
                            options={{
                                scales: {
                                    x: {
                                        title: {
                                            display: true,
                                            text: 'MAE (R)',
                                        }
                                    },
                                    y: {
                                        title: {
                                            display: true,
                                            text: 'MFE (R)',
                                        }
                                    }
                                },
                                plugins: {
                                    tooltip: {
                                        callbacks: {
                                            label: (context) => {
                                                const point = context.raw as any;
                                                return `MAE: ${point.x.toFixed(2)}R, MFE: ${point.y.toFixed(2)}R, Avg Outcome: ${point.v.toFixed(2)}R`;
                                            }
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

export default RiskAnalysis;
