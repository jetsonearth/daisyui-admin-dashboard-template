import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import dayjs from 'dayjs';
import { capitalService } from '../../services/capitalService';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

const EquityMetricsChart = ({ userId }) => {
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchMetrics = async () => {
            try {
                setLoading(true);
                const detailedMetrics = await capitalService.getDetailedCapitalMetrics(userId);
                setMetrics(detailedMetrics);
            } catch (err) {
                console.error('Error fetching metrics:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchMetrics();
    }, [userId]);

    if (loading) return <div className="animate-pulse h-[300px] bg-base-200 rounded-lg"></div>;
    if (error) return <div className="text-error">Error loading metrics: {error}</div>;
    if (!metrics) return null;

    const data = {
        labels: metrics.equity_curve.map(point => dayjs(point.date).format('MMM DD')),
        datasets: [
            {
                label: 'Equity',
                data: metrics.equity_curve.map(point => point.capital),
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                borderWidth: 2
            },
            {
                label: 'Drawdown',
                data: metrics.equity_curve.map(point => point.drawdown),
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgba(255, 99, 132, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                borderWidth: 2,
                yAxisID: 'y1'
            }
        ]
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            intersect: false,
        },
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    usePointStyle: true,
                    padding: 20
                }
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        const label = context.dataset.label;
                        const value = context.raw;
                        return `${label}: ${value.toLocaleString('en-US', {
                            style: 'currency',
                            currency: 'USD'
                        })}`;
                    }
                }
            }
        },
        scales: {
            x: {
                grid: {
                    display: false
                },
                ticks: {
                    maxTicksLimit: 8,
                    color: '#9CA3AF'
                }
            },
            y: {
                position: 'left',
                grid: {
                    color: 'rgba(156, 163, 175, 0.1)'
                },
                ticks: {
                    color: '#9CA3AF',
                    callback: value => new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0
                    }).format(value)
                }
            },
            y1: {
                position: 'right',
                grid: {
                    drawOnChartArea: false
                },
                ticks: {
                    color: '#9CA3AF',
                    callback: value => `${value.toFixed(2)}%`
                }
            }
        }
    };

    return (
        <div className="w-full">
            <div className="flex justify-between items-center mb-4">
                <div className="stats">
                    <div className="stat px-4">
                        <div className="stat-title text-xs text-gray-500">Max Drawdown</div>
                        <div className="stat-value text-2xl font-semibold text-error">
                            {metrics.max_drawdown.toFixed(2)}%
                        </div>
                        <div className="stat-desc text-xs mt-1">
                            Avg Recovery: {Math.round(metrics.recovery_time_avg)} days
                        </div>
                    </div>
                    <div className="stat px-4">
                        <div className="stat-title text-xs text-gray-500">Max Runup</div>
                        <div className="stat-value text-2xl font-semibold text-emerald-500">
                            {metrics.max_runup.toFixed(2)}%
                        </div>
                        <div className="stat-desc text-xs mt-1">
                            From {dayjs(metrics.equity_curve[0].date).format('MMM DD')}
                        </div>
                    </div>
                    <div className="stat px-4">
                        <div className="stat-title text-xs text-gray-500">Current Return</div>
                        <div className="stat-value text-2xl font-semibold">
                            {metrics.current_runup.toFixed(2)}%
                        </div>
                        <div className="stat-desc text-xs mt-1">
                            {metrics.current_drawdown > 0 ? 
                                `${metrics.current_drawdown.toFixed(2)}% from high` : 
                                'At All-Time High'}
                        </div>
                    </div>
                </div>
            </div>
            <div className="h-[300px]">
                <Line data={data} options={options} />
            </div>
        </div>
    );
};

export default EquityMetricsChart;
