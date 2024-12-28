import React, { useEffect, useState, useRef } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    TimeScale,
    ScatterController,
    LineController
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import { EMA } from '@debut/indicators';
import { marketDataService } from '../../features/marketData/marketDataService';
import { metricsService } from '../../features/metrics/metricsService';
import { Trade } from '../../types';
import { format } from 'date-fns';

// Register ChartJS components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    TimeScale,
    Title,
    Tooltip,
    Legend,
    ScatterController,
    LineController
);

const TimeRanges = {
    '1M': { label: '1 Month', days: 30 },
    '3M': { label: '3 Months', days: 90 },
    '6M': { label: '6 Months', days: 180 },
    '1Y': { label: '1 Year', days: 365 }
} as const;

type TimeRangeKey = keyof typeof TimeRanges;

interface ChartData {
    x: number;
    y: number;
}

const MarketContextAnalysis = () => {
    const [trades, setTrades] = useState<Trade[]>([]);
    const [qqqData, setQqqData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState<TimeRangeKey>('6M');
    const [stats, setStats] = useState({
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        avgRMultiple: 0,
        winRate: 0
    });

    const chartRef = useRef<ChartJS>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                // Fetch trades
                const fetchedTrades = await metricsService.fetchTrades();
                setTrades(fetchedTrades);

                // Calculate date range
                const endDate = new Date();
                const startDate = new Date();
                startDate.setDate(endDate.getDate() - TimeRanges[timeRange].days);

                // Add 21 more days for EMA calculation
                const extendedStartDate = new Date(startDate);
                extendedStartDate.setDate(startDate.getDate() - 21);

                // Fetch QQQ data
                const qqqOHLCV = await marketDataService.getOHLCVData('QQQ', extendedStartDate, endDate);
                
                // Sort data by time
                const sortedData = [...qqqOHLCV].sort((a, b) => {
                    const timeA = typeof a.time === 'string' ? parseInt(a.time) : a.time;
                    const timeB = typeof b.time === 'string' ? parseInt(b.time) : b.time;
                    return timeA - timeB;
                });

                setQqqData(sortedData);

                // Calculate stats
                const completedTrades = fetchedTrades.filter(t => t.exit_datetime);
                const winners = completedTrades.filter(t => t.exit_price && t.exit_price > t.entry_price);
                const rMultiples = completedTrades.filter(t => t.risk_reward_ratio).map(t => t.risk_reward_ratio || 0);

                setStats({
                    totalTrades: completedTrades.length,
                    winningTrades: winners.length,
                    losingTrades: completedTrades.length - winners.length,
                    avgRMultiple: rMultiples.length ? (rMultiples.reduce((a, b) => a + b, 0) / rMultiples.length) : 0,
                    winRate: completedTrades.length ? (winners.length / completedTrades.length * 100) : 0
                });

            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [timeRange]);

    const chartData = React.useMemo(() => {
        if (!qqqData.length) return { datasets: [] };

        // Calculate EMA
        const ema = new EMA(21);
        const emaData = qqqData.map(candle => ({
            x: candle.time * 1000,
            y: ema.nextValue(candle.close) || candle.close
        }));

        // Split QQQ data into above and below EMA segments with proper segment breaks
        let currentAboveSegment: { x: number; y: number }[] = [];
        let currentBelowSegment: { x: number; y: number }[] = [];
        const qqqAboveEma: { x: number; y: number }[][] = [];
        const qqqBelowEma: { x: number; y: number }[][] = [];
        
        qqqData.forEach((candle, i) => {
            const point = {
                x: candle.time * 1000,
                y: candle.close
            };
            const emaValue = emaData[i]?.y || 0;
            const isAboveEma = candle.close >= emaValue;
            
            // Check if we need to start a new segment
            if (i > 0) {
                const prevWasAbove = qqqData[i-1].close >= (emaData[i-1]?.y || 0);
                
                if (isAboveEma !== prevWasAbove) {
                    // Crossing EMA, calculate intersection
                    const prevX = qqqData[i-1].time * 1000;
                    const prevY = qqqData[i-1].close;
                    const prevEma = emaData[i-1]?.y || 0;
                    
                    const ratio = (prevEma - prevY) / (candle.close - prevY);
                    const intersectX = prevX + (point.x - prevX) * ratio;
                    const intersectPoint = { x: intersectX, y: prevEma };
                    
                    // Add intersection point to current segments and start new ones
                    if (isAboveEma) {
                        if (currentBelowSegment.length > 0) {
                            currentBelowSegment.push(intersectPoint);
                            qqqBelowEma.push([...currentBelowSegment]);
                        }
                        currentBelowSegment = [];
                        currentAboveSegment = [intersectPoint];
                    } else {
                        if (currentAboveSegment.length > 0) {
                            currentAboveSegment.push(intersectPoint);
                            qqqAboveEma.push([...currentAboveSegment]);
                        }
                        currentAboveSegment = [];
                        currentBelowSegment = [intersectPoint];
                    }
                }
            }
            
            // Add point to current segment
            if (isAboveEma) {
                currentAboveSegment.push(point);
            } else {
                currentBelowSegment.push(point);
            }
        });
        
        // Add any remaining segments
        if (currentAboveSegment.length > 0) {
            qqqAboveEma.push(currentAboveSegment);
        }
        if (currentBelowSegment.length > 0) {
            qqqBelowEma.push(currentBelowSegment);
        }

        // Prepare trade markers
        const winningTrades: (ChartData & { trade: Trade, originalRRR: number })[] = [];
        const losingTrades: (ChartData & { trade: Trade, originalRRR: number })[] = [];

        console.log('Processing trades:', trades);

        trades.forEach(trade => {
            if (!trade.exit_datetime || trade.risk_reward_ratio === undefined) {
                console.log('Skipping trade due to missing data:', trade);
                return;
            }

            const tradePoint = {
                x: new Date(trade.exit_datetime!).getTime(),
                y: Math.min(25, trade.risk_reward_ratio!),  // Clamp to 25R
                trade,
                originalRRR: trade.risk_reward_ratio!  // Store original RRR for tooltip
            };

            console.log('Trade point:', tradePoint);

            if (trade.risk_reward_ratio! > 0) {
                winningTrades.push(tradePoint);
            } else {
                losingTrades.push(tradePoint);
            }
        });

        console.log('Winning trades:', winningTrades);
        console.log('Losing trades:', losingTrades);

        return {
            datasets: [
                ...qqqAboveEma.map((segment, i) => ({
                    label: i === 0 ? 'QQQ Above EMA' : 'QQQ Above EMA (hidden)',
                    data: segment,
                    type: 'line' as const,
                    borderColor: '#34d399', // emerald-400
                    backgroundColor: '#34d399',
                    borderWidth: 2,
                    pointRadius: 0,
                    yAxisID: 'y',
                    order: 2,
                    showLine: true
                })),
                ...qqqBelowEma.map((segment, i) => ({
                    label: i === 0 ? 'QQQ Below EMA' : 'QQQ Below EMA (hidden)',
                    data: segment,
                    type: 'line' as const,
                    borderColor: '#fb7185', // rose-400
                    backgroundColor: '#fb7185',
                    borderWidth: 2,
                    pointRadius: 0,
                    yAxisID: 'y',
                    order: 2,
                    showLine: true
                })),
                {
                    label: '21 EMA',
                    data: emaData,
                    type: 'line' as const,
                    borderColor: '#c084fc', // bright purple
                    backgroundColor: '#c084fc',
                    borderWidth: 1.5,
                    pointRadius: 0,
                    yAxisID: 'y',
                    order: 3
                },
                {
                    label: 'Winning Trades',
                    data: winningTrades,
                    type: 'scatter' as const,
                    borderColor: '#34d399',
                    backgroundColor: '#34d399',
                    borderWidth: 2,
                    pointStyle: 'circle',
                    pointRadius: 4,
                    yAxisID: 'rrr', // Use RRR axis
                    order: 1,
                    z: 1000
                },
                {
                    label: 'Losing Trades',
                    data: losingTrades,
                    type: 'scatter' as const,
                    borderColor: '#fb7185',
                    backgroundColor: '#fb7185',
                    borderWidth: 2,
                    pointStyle: 'rectRot',
                    pointRadius: 4,
                    yAxisID: 'rrr', // Use RRR axis
                    order: 1,
                    z: 1000
                }
            ]
        };
    }, [qqqData, trades]);

    const chartOptions = React.useMemo(() => {
        // Calculate price padding
        const prices = qqqData.map(candle => candle.close);
        const maxPrice = Math.max(...prices);
        const minPrice = Math.min(...prices);
        const pricePadding = (maxPrice - minPrice) * 0.2;

        return {
            responsive: true,
            maintainAspectRatio: false,
            backgroundColor: 'transparent',
            interaction: {
                mode: 'nearest' as const,
                axis: 'x' as const,
                intersect: true
            },
            plugins: {
                legend: {
                    position: 'top' as const,
                    labels: {
                        color: '#a6adba',
                        usePointStyle: true,
                        pointStyle: 'rectRot',
                        padding: 20,
                        font: {
                            size: 12
                        },
                        filter: (item: any) => !item.text.includes('QQQ Above') && !item.text.includes('QQQ Below') // Hide QQQ segments from legend
                    }
                },
                tooltip: {
                    mode: 'nearest' as const,
                    intersect: true,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: 'rgba(166, 173, 186, 0.3)',
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: (context: any) => {
                            const dataset = context.dataset;
                            if (dataset.label === 'QQQ Above EMA' || dataset.label === 'QQQ Below EMA' || dataset.label === '21 EMA') {
                                return `${dataset.label}: $${context.parsed.y.toFixed(2)}`;
                            }

                            const trade = dataset.data[context.dataIndex].trade;
                            const originalRRR = dataset.data[context.dataIndex].originalRRR;
                            const pnl = ((trade.exit_price! - trade.entry_price) / trade.entry_price * 100).toFixed(2);
                            const lines = [
                                `${trade.direction} ${trade.ticker}`,
                                `Strategy: ${trade.strategy}`,
                                `Entry: $${trade.entry_price.toFixed(2)}`,
                                `Exit: $${trade.exit_price!.toFixed(2)}`,
                                `RRR: ${originalRRR.toFixed(2)}R`,  // Show original RRR
                                `PNL: ${pnl}%`,
                                `Exit Date: ${format(new Date(trade.exit_datetime!), 'MMM d, yyyy')}`
                            ];
                            return lines;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day',
                        displayFormats: {
                            day: 'MMM d'
                        }
                    },
                    grid: {
                        display: false
                    },
                    border: {
                        display: true,
                        color: 'rgba(166, 173, 186, 0.3)',
                        width: 1
                    }
                },
                y: {
                    position: 'right' as const,
                    min: minPrice - pricePadding,
                    max: maxPrice + pricePadding,
                    grid: {
                        color: 'rgba(166, 173, 186, 0.2)',
                        lineWidth: 0.5,
                        drawBorder: true
                    },
                    ticks: {
                        color: '#a6adba',
                        font: {
                            size: 12
                        },
                        stepSize: 50,
                        callback: (value: number) => `$${value.toFixed(2)}`
                    },
                    border: {
                        display: true,
                        color: 'rgba(166, 173, 186, 0.3)',
                        width: 1
                    }
                },
                rrr: {
                    position: 'left' as const,
                    min: -3,
                    max: 25,
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#a6adba',
                        font: {
                            size: 12
                        },
                        stepSize: 2,
                        callback: (value: number) => value === 25 ? '25R+' : value + 'R'
                    },
                    border: {
                        display: true,
                        color: 'rgba(166, 173, 186, 0.3)',
                        width: 1
                    }
                }
            }
        };
    }, [qqqData, trades]);

    return (
        <div className="flex flex-col gap-4 p-4">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Market Context Analysis</h1>
                    <p className="text-base-content/60">
                    This chart visualizes your trades in relation to market conditions, showing both win/loss outcomes and RRR (Risk-Reward Ratio). The QQQ price action relative to the 21 EMA provides crucial market context - trades, especially breakouts, tend to have lower success rates when QQQ trades below the 21 EMA. Use this visualization to identify optimal market conditions for your trading strategy.</p>
                </div>
                
                {/* Time Range Selector */}
                <div className="join">
                    {Object.entries(TimeRanges).map(([key, value]) => (
                        <button
                            key={key}
                            className={`join-item btn btn-sm ${
                                timeRange === key
                                    ? 'btn-primary'
                                    : 'btn-ghost'
                            }`}
                            onClick={() => setTimeRange(key as TimeRangeKey)}
                        >
                            {key}
                        </button>
                    ))}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="stats shadow">
                    <div className="stat">
                        <div className="stat-title">Total Trades</div>
                        <div className="stat-value">{stats.totalTrades}</div>
                    </div>
                </div>
                
                <div className="stats shadow">
                    <div className="stat">
                        <div className="stat-title">Win Rate</div>
                        <div className="stat-value text-success">{stats.winRate.toFixed(1)}%</div>
                    </div>
                </div>

                <div className="stats shadow">
                    <div className="stat">
                        <div className="stat-title">Winners</div>
                        <div className="stat-value text-success">{stats.winningTrades}</div>
                    </div>
                </div>
                
                <div className="stats shadow">
                    <div className="stat">
                        <div className="stat-title">Losers</div>
                        <div className="stat-value text-error">{stats.losingTrades}</div>
                    </div>
                </div>
                
                <div className="stats shadow">
                    <div className="stat">
                        <div className="stat-title">Avg R Multiple</div>
                        <div className="stat-value">{stats.avgRMultiple.toFixed(2)}</div>
                    </div>
                </div>
            </div>

            {/* Chart */}
            <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                    {loading ? (
                        <div className="flex items-center justify-center h-[700px]">
                            <span className="loading loading-spinner loading-lg text-primary"></span>
                        </div>
                    ) : (
                        <div className="h-[700px]">
                            <Chart
                                ref={chartRef}
                                type="line"
                                data={chartData}
                                options={chartOptions}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MarketContextAnalysis;
