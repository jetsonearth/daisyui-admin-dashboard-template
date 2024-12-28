import React from 'react';
import { Trade } from '../../../types';
import { Bar, Line } from 'react-chartjs-2';
import { groupBy } from 'lodash';
import dayjs from 'dayjs';

interface TimeAnalysisProps {
    trades: Trade[];
}

const TimeAnalysis: React.FC<TimeAnalysisProps> = ({ trades }) => {
    // Time of Day Analysis
    const getTimeOfDayPerformance = () => {
        const hourlyPerformance = Array(24).fill(null).map(() => ({
            trades: 0,
            wins: 0,
            totalR: 0,
        }));

        trades.forEach(trade => {
            const hour = dayjs(trade.entry_datetime).hour();
            hourlyPerformance[hour].trades++;
            if ((trade.realized_r || 0) > 0) {
                hourlyPerformance[hour].wins++;
            }
            hourlyPerformance[hour].totalR += trade.realized_r || 0;
        });

        return {
            labels: Array(24).fill(null).map((_, i) => `${i}:00`),
            datasets: [
                {
                    label: 'Win Rate (%)',
                    data: hourlyPerformance.map(h => h.trades > 0 ? (h.wins / h.trades) * 100 : 0),
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    yAxisID: 'y',
                },
                {
                    label: 'Average R',
                    data: hourlyPerformance.map(h => h.trades > 0 ? h.totalR / h.trades : 0),
                    backgroundColor: 'rgba(255, 99, 132, 0.6)',
                    yAxisID: 'y1',
                }
            ]
        };
    };

    // Day of Week Analysis
    const getDayOfWeekPerformance = () => {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayPerformance = days.map(day => ({
            day,
            trades: 0,
            wins: 0,
            totalR: 0,
        }));

        trades.forEach(trade => {
            const dayIndex = dayjs(trade.entry_datetime).day();
            dayPerformance[dayIndex].trades++;
            if ((trade.realized_r || 0) > 0) {
                dayPerformance[dayIndex].wins++;
            }
            dayPerformance[dayIndex].totalR += trade.realized_r || 0;
        });

        return {
            labels: days,
            datasets: [
                {
                    label: 'Win Rate (%)',
                    data: dayPerformance.map(d => d.trades > 0 ? (d.wins / d.trades) * 100 : 0),
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    yAxisID: 'y',
                },
                {
                    label: 'Average R',
                    data: dayPerformance.map(d => d.trades > 0 ? d.totalR / d.trades : 0),
                    backgroundColor: 'rgba(255, 99, 132, 0.6)',
                    yAxisID: 'y1',
                }
            ]
        };
    };

    // Monthly Performance
    const getMonthlyPerformance = () => {
        const monthlyGroups = groupBy(trades, trade => 
            dayjs(trade.exit_datetime).format('YYYY-MM')
        );

        const sortedMonths = Object.keys(monthlyGroups).sort();
        const data = sortedMonths.map(month => {
            const monthTrades = monthlyGroups[month];
            const totalR = monthTrades.reduce((sum, t) => sum + (t.realized_r || 0), 0);
            const wins = monthTrades.filter(t => (t.realized_r || 0) > 0).length;
            
            return {
                month,
                totalR,
                winRate: (wins / monthTrades.length) * 100,
                tradeCount: monthTrades.length,
            };
        });

        return {
            labels: data.map(d => d.month),
            datasets: [
                {
                    label: 'Total R',
                    data: data.map(d => d.totalR),
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    yAxisID: 'y',
                    fill: true,
                },
                {
                    label: 'Trade Count',
                    data: data.map(d => d.tradeCount),
                    borderColor: 'rgba(255, 99, 132, 1)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    yAxisID: 'y1',
                    type: 'bar',
                }
            ]
        };
    };

    return (
        <div className="grid grid-cols-1 gap-6">
            <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                    <h2 className="card-title">Time of Day Performance</h2>
                    <p className="text-sm text-base-content/70">
                        Win rate and average R multiple by hour of day.
                    </p>
                    <div className="h-[400px]">
                        <Bar 
                            data={getTimeOfDayPerformance()}
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
                    <h2 className="card-title">Day of Week Performance</h2>
                    <p className="text-sm text-base-content/70">
                        Trading performance metrics by day of the week.
                    </p>
                    <div className="h-[400px]">
                        <Bar 
                            data={getDayOfWeekPerformance()}
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
                    <h2 className="card-title">Monthly Performance</h2>
                    <p className="text-sm text-base-content/70">
                        Monthly performance showing total R and trade count.
                    </p>
                    <div className="h-[400px]">
                        <Line 
                            data={getMonthlyPerformance()}
                            options={{
                                scales: {
                                    y: {
                                        type: 'linear',
                                        display: true,
                                        position: 'left',
                                        title: {
                                            display: true,
                                            text: 'Total R',
                                        }
                                    },
                                    y1: {
                                        type: 'linear',
                                        display: true,
                                        position: 'right',
                                        title: {
                                            display: true,
                                            text: 'Trade Count',
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
    );
};

export default TimeAnalysis;
