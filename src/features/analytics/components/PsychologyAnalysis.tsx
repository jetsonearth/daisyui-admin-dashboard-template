import React from 'react';
import { Trade } from '../../../types';
import { Bar, Line } from 'react-chartjs-2';
import dayjs from 'dayjs';

interface PsychologyAnalysisProps {
    trades: Trade[];
}

const PsychologyAnalysis: React.FC<PsychologyAnalysisProps> = ({ trades }) => {
    // Post Win/Loss Performance
    const getPostResultPerformance = () => {
        const sortedTrades = [...trades].sort((a, b) => 
            new Date(a.exit_datetime || 0).getTime() - new Date(b.exit_datetime || 0).getTime()
        );

        const postWinTrades = [];
        const postLossTrades = [];

        for (let i = 1; i < sortedTrades.length; i++) {
            const prevTrade = sortedTrades[i - 1];
            const currentTrade = sortedTrades[i];
            
            if ((prevTrade.realized_r || 0) > 0) {
                postWinTrades.push(currentTrade);
            } else {
                postLossTrades.push(currentTrade);
            }
        }

        const postWinStats = {
            winRate: postWinTrades.filter(t => (t.realized_r || 0) > 0).length / postWinTrades.length * 100,
            avgR: postWinTrades.reduce((sum, t) => sum + (t.realized_r || 0), 0) / postWinTrades.length,
        };

        const postLossStats = {
            winRate: postLossTrades.filter(t => (t.realized_r || 0) > 0).length / postLossTrades.length * 100,
            avgR: postLossTrades.reduce((sum, t) => sum + (t.realized_r || 0), 0) / postLossTrades.length,
        };

        return {
            labels: ['After Win', 'After Loss'],
            datasets: [
                {
                    label: 'Win Rate (%)',
                    data: [postWinStats.winRate, postLossStats.winRate],
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    yAxisID: 'y',
                },
                {
                    label: 'Average R',
                    data: [postWinStats.avgR, postLossStats.avgR],
                    backgroundColor: 'rgba(255, 99, 132, 0.6)',
                    yAxisID: 'y1',
                }
            ]
        };
    };

    // Trade Frequency Impact
    const getTradeFrequencyImpact = () => {
        const dailyGroups = groupBy(trades, trade => 
            dayjs(trade.entry_datetime).format('YYYY-MM-DD')
        );

        const freqPerformance = Object.values(dailyGroups).map(dayTrades => ({
            count: dayTrades.length,
            avgR: dayTrades.reduce((sum, t) => sum + (t.realized_r || 0), 0) / dayTrades.length,
            winRate: dayTrades.filter(t => (t.realized_r || 0) > 0).length / dayTrades.length * 100,
        }));

        // Group by trade count
        const groupedByCount = groupBy(freqPerformance, 'count');
        const data = Object.entries(groupedByCount).map(([count, days]) => ({
            count: Number(count),
            avgR: days.reduce((sum, d) => sum + d.avgR, 0) / days.length,
            winRate: days.reduce((sum, d) => sum + d.winRate, 0) / days.length,
        }));

        return {
            labels: data.map(d => d.count.toString()),
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
                }
            ]
        };
    };

    // Streak Analysis
    const getStreakAnalysis = () => {
        const sortedTrades = [...trades].sort((a, b) => 
            new Date(a.exit_datetime || 0).getTime() - new Date(b.exit_datetime || 0).getTime()
        );

        let currentStreak = 0;
        let streaks = [];
        let equity = 0;

        sortedTrades.forEach(trade => {
            const r = trade.realized_r || 0;
            equity += r;

            if (r > 0) {
                if (currentStreak >= 0) {
                    currentStreak++;
                } else {
                    streaks.push(currentStreak);
                    currentStreak = 1;
                }
            } else {
                if (currentStreak <= 0) {
                    currentStreak--;
                } else {
                    streaks.push(currentStreak);
                    currentStreak = -1;
                }
            }
        });
        streaks.push(currentStreak);

        const data = streaks.map((streak, index) => ({
            x: index,
            y: streak,
        }));

        return {
            datasets: [{
                label: 'Win/Loss Streaks',
                data: data,
                borderColor: data.map(d => d.y > 0 ? 'rgba(75, 192, 192, 1)' : 'rgba(255, 99, 132, 1)'),
                backgroundColor: data.map(d => d.y > 0 ? 'rgba(75, 192, 192, 0.6)' : 'rgba(255, 99, 132, 0.6)'),
                type: 'bar',
            }]
        };
    };

    return (
        <div className="grid grid-cols-1 gap-6">
            <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                    <h2 className="card-title">Post Win/Loss Performance</h2>
                    <p className="text-sm text-base-content/70">
                        How you perform after wins vs after losses.
                    </p>
                    <div className="h-[400px]">
                        <Bar 
                            data={getPostResultPerformance()}
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
                                    }
                                }
                            }}
                        />
                    </div>
                </div>
            </div>

            <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                    <h2 className="card-title">Trade Frequency Impact</h2>
                    <p className="text-sm text-base-content/70">
                        Performance metrics based on number of trades per day.
                    </p>
                    <div className="h-[400px]">
                        <Bar 
                            data={getTradeFrequencyImpact()}
                            options={{
                                scales: {
                                    x: {
                                        title: {
                                            display: true,
                                            text: 'Trades per Day',
                                        }
                                    },
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
                                    }
                                }
                            }}
                        />
                    </div>
                </div>
            </div>

            <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                    <h2 className="card-title">Win/Loss Streaks</h2>
                    <p className="text-sm text-base-content/70">
                        Visualization of winning and losing streaks over time.
                        Green bars represent winning streaks, red bars represent losing streaks.
                    </p>
                    <div className="h-[400px]">
                        <Bar 
                            data={getStreakAnalysis()}
                            options={{
                                scales: {
                                    y: {
                                        title: {
                                            display: true,
                                            text: 'Streak Length',
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

export default PsychologyAnalysis;
