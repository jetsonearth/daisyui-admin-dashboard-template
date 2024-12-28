import React from 'react';
import { Trade } from '../../../types';
import { Bar, Pie } from 'react-chartjs-2';
import { groupBy } from 'lodash';

interface LossAnalysisProps {
    trades: Trade[];
}

const LossAnalysis: React.FC<LossAnalysisProps> = ({ trades }) => {
    const losingTrades = trades.filter(trade => (trade.realized_pnl || 0) < 0);

    // Analyze common mistakes
    const getMistakeAnalysis = () => {
        const allMistakes = losingTrades.flatMap(trade => trade.mistakes || []);
        const mistakeCounts = groupBy(allMistakes);
        
        const data = Object.entries(mistakeCounts).map(([mistake, occurrences]) => ({
            mistake,
            count: occurrences.length,
            avgLoss: losingTrades
                .filter(t => t.mistakes?.includes(mistake))
                .reduce((sum, t) => sum + (t.realized_pnl || 0), 0) / occurrences.length
        }));

        return {
            labels: data.map(d => d.mistake),
            datasets: [
                {
                    label: 'Frequency',
                    data: data.map(d => d.count),
                    backgroundColor: 'rgba(255, 99, 132, 0.6)',
                    yAxisID: 'y',
                },
                {
                    label: 'Average Loss ($)',
                    data: data.map(d => Math.abs(d.avgLoss)),
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    yAxisID: 'y1',
                }
            ]
        };
    };

    // Loss Size Distribution
    const getLossSizeDistribution = () => {
        const lossRanges = {
            'Less than $100': 0,
            '$100 to $250': 0,
            '$250 to $500': 0,
            '$500 to $1000': 0,
            'More than $1000': 0
        };

        losingTrades.forEach(trade => {
            const loss = Math.abs(trade.realized_pnl || 0);
            if (loss < 100) lossRanges['Less than $100']++;
            else if (loss < 250) lossRanges['$100 to $250']++;
            else if (loss < 500) lossRanges['$250 to $500']++;
            else if (loss < 1000) lossRanges['$500 to $1000']++;
            else lossRanges['More than $1000']++;
        });

        return {
            labels: Object.keys(lossRanges),
            datasets: [{
                data: Object.values(lossRanges),
                backgroundColor: [
                    'rgba(255, 206, 86, 0.6)',
                    'rgba(75, 192, 192, 0.6)',
                    'rgba(153, 102, 255, 0.6)',
                    'rgba(255, 159, 64, 0.6)',
                    'rgba(255, 99, 132, 0.6)'
                ],
            }]
        };
    };

    // Time to Loss Analysis
    const getTimeToLossAnalysis = () => {
        const holdingPeriods = losingTrades.map(trade => ({
            period: trade.holding_period || 0,
            loss: trade.realized_pnl || 0
        }));

        const periodRanges = {
            'Intraday': { count: 0, totalLoss: 0 },
            '2-3 days': { count: 0, totalLoss: 0 },
            '4-5 days': { count: 0, totalLoss: 0 },
            '1-2 weeks': { count: 0, totalLoss: 0 },
            '2+ weeks': { count: 0, totalLoss: 0 }
        };

        holdingPeriods.forEach(({ period, loss }) => {
            if (period <= 1) {
                periodRanges['Intraday'].count++;
                periodRanges['Intraday'].totalLoss += loss;
            } else if (period <= 3) {
                periodRanges['2-3 days'].count++;
                periodRanges['2-3 days'].totalLoss += loss;
            } else if (period <= 5) {
                periodRanges['4-5 days'].count++;
                periodRanges['4-5 days'].totalLoss += loss;
            } else if (period <= 14) {
                periodRanges['1-2 weeks'].count++;
                periodRanges['1-2 weeks'].totalLoss += loss;
            } else {
                periodRanges['2+ weeks'].count++;
                periodRanges['2+ weeks'].totalLoss += loss;
            }
        });

        return {
            labels: Object.keys(periodRanges),
            datasets: [
                {
                    label: 'Number of Trades',
                    data: Object.values(periodRanges).map(d => d.count),
                    backgroundColor: 'rgba(255, 99, 132, 0.6)',
                    yAxisID: 'y',
                },
                {
                    label: 'Average Loss ($)',
                    data: Object.values(periodRanges).map(d => 
                        d.count > 0 ? Math.abs(d.totalLoss / d.count) : 0
                    ),
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    yAxisID: 'y1',
                }
            ]
        };
    };

    return (
        <div className="grid grid-cols-1 gap-6">
            <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                    <h2 className="card-title">Common Mistakes Analysis</h2>
                    <p className="text-sm text-base-content/70">
                        Frequency and impact of different trading mistakes.
                    </p>
                    <div className="h-[400px]">
                        <Bar 
                            data={getMistakeAnalysis()}
                            options={{
                                scales: {
                                    y: {
                                        type: 'linear',
                                        display: true,
                                        position: 'left',
                                        title: {
                                            display: true,
                                            text: 'Number of Occurrences',
                                        }
                                    },
                                    y1: {
                                        type: 'linear',
                                        display: true,
                                        position: 'right',
                                        title: {
                                            display: true,
                                            text: 'Average Loss ($)',
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

            <div className="grid grid-cols-2 gap-6">
                <div className="card bg-base-100 shadow-xl">
                    <div className="card-body">
                        <h2 className="card-title">Loss Size Distribution</h2>
                        <p className="text-sm text-base-content/70">
                            Distribution of losses by dollar amount.
                        </p>
                        <div className="h-[300px]">
                            <Pie 
                                data={getLossSizeDistribution()}
                                options={{
                                    plugins: {
                                        legend: {
                                            position: 'right',
                                        }
                                    }
                                }}
                            />
                        </div>
                    </div>
                </div>

                <div className="card bg-base-100 shadow-xl">
                    <div className="card-body">
                        <h2 className="card-title">Time to Loss Analysis</h2>
                        <p className="text-sm text-base-content/70">
                            Analysis of holding periods for losing trades.
                        </p>
                        <div className="h-[300px]">
                            <Bar 
                                data={getTimeToLossAnalysis()}
                                options={{
                                    scales: {
                                        y: {
                                            type: 'linear',
                                            display: true,
                                            position: 'left',
                                            title: {
                                                display: true,
                                                text: 'Number of Trades',
                                            }
                                        },
                                        y1: {
                                            type: 'linear',
                                            display: true,
                                            position: 'right',
                                            title: {
                                                display: true,
                                                text: 'Average Loss ($)',
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
            </div>
        </div>
    );
};

export default LossAnalysis;
