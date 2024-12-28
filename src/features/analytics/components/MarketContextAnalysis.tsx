import React, { useEffect, useRef, useState } from 'react';
import { Trade } from '../../../types';
import { marketDataService } from '../../../features/marketData/marketDataService';
import dayjs from 'dayjs';
import { createChart, ColorType, CrosshairMode, IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';

interface MarketContextAnalysisProps {
    trades: Trade[];
}

interface QQQData {
    time: UTCTimestamp;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
}

const MarketContextAnalysis: React.FC<MarketContextAnalysisProps> = ({ trades }) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const [chart, setChart] = useState<IChartApi | null>(null);
    const [candlestickSeries, setCandlestickSeries] = useState<ISeriesApi<"Candlestick"> | null>(null);
    const [selectedPeriod, setSelectedPeriod] = useState('1Y');
    const [qqqData, setQqqData] = useState<QQQData[]>([]);

    useEffect(() => {
        const initChart = () => {
            if (!chartContainerRef.current) return;

            const chartInstance = createChart(chartContainerRef.current, {
                layout: {
                    background: { color: 'transparent' },
                    textColor: '#D9D9D9',
                },
                grid: {
                    vertLines: { color: '#404040' },
                    horzLines: { color: '#404040' },
                },
                crosshair: {
                    mode: CrosshairMode.Normal,
                },
                rightPriceScale: {
                    borderColor: '#404040',
                },
                timeScale: {
                    borderColor: '#404040',
                    timeVisible: true,
                },
                width: chartContainerRef.current.clientWidth,
                height: 600,
            });

            const candleSeries = chartInstance.addCandlestickSeries({
                upColor: '#26a69a',
                downColor: '#ef5350',
                borderVisible: false,
                wickUpColor: '#26a69a',
                wickDownColor: '#ef5350',
            });

            // Add SMA 20
            const sma20Series = chartInstance.addLineSeries({
                color: '#2962FF',
                lineWidth: 2,
                title: 'SMA 20',
            });

            // Add SMA 50
            const sma50Series = chartInstance.addLineSeries({
                color: '#FF6B6B',
                lineWidth: 2,
                title: 'SMA 50',
            });

            setChart(chartInstance);
            setCandlestickSeries(candleSeries);

            // Handle resize
            const handleResize = () => {
                if (chartContainerRef.current) {
                    chartInstance.applyOptions({
                        width: chartContainerRef.current.clientWidth,
                    });
                }
            };

            window.addEventListener('resize', handleResize);

            return () => {
                window.removeEventListener('resize', handleResize);
                chartInstance.remove();
            };
        };

        initChart();
    }, []);

    useEffect(() => {
        const fetchQQQData = async () => {
            try {
                let startDate = new Date();
                switch (selectedPeriod) {
                    case '1M':
                        startDate.setMonth(startDate.getMonth() - 1);
                        break;
                    case '3M':
                        startDate.setMonth(startDate.getMonth() - 3);
                        break;
                    case '6M':
                        startDate.setMonth(startDate.getMonth() - 6);
                        break;
                    case '1Y':
                        startDate.setFullYear(startDate.getFullYear() - 1);
                        break;
                    case 'ALL':
                        startDate = new Date(Math.min(...trades.map(t => new Date(t.entry_datetime).getTime())));
                        break;
                }

                // Fetch QQQ data from your market data service
                const data = await marketDataService.getHistoricalData('QQQ', startDate, new Date());
                const formattedData = data.map(d => ({
                    time: dayjs(d.date).unix() as UTCTimestamp,
                    open: d.open,
                    high: d.high,
                    low: d.low,
                    close: d.close,
                    volume: d.volume,
                }));

                setQqqData(formattedData);

                if (candlestickSeries && chart) {
                    candlestickSeries.setData(formattedData);

                    // Add trade markers
                    trades.forEach(trade => {
                        const time = dayjs(trade.entry_datetime).unix() as UTCTimestamp;
                        const price = trade.entry_price || 0;
                        const isWin = (trade.realized_pnl || 0) > 0;

                        candlestickSeries.createPriceLine({
                            time,
                            price,
                            color: isWin ? '#4CAF50' : '#FF5252',
                            lineWidth: 2,
                            lineStyle: 2,
                            axisLabelVisible: true,
                            title: `${trade.ticker} ($${trade.realized_pnl?.toFixed(2)})`,
                        });
                    });

                    // Calculate and add SMAs
                    const sma20Data = calculateSMA(formattedData, 20);
                    const sma50Data = calculateSMA(formattedData, 50);

                    chart.addLineSeries({
                        color: '#2962FF',
                        lineWidth: 2,
                        title: 'SMA 20',
                    }).setData(sma20Data);

                    chart.addLineSeries({
                        color: '#FF6B6B',
                        lineWidth: 2,
                        title: 'SMA 50',
                    }).setData(sma50Data);

                    // Fit content
                    chart.timeScale().fitContent();
                }
            } catch (error) {
                console.error('Error fetching QQQ data:', error);
            }
        };

        fetchQQQData();
    }, [selectedPeriod, candlestickSeries, chart, trades]);

    const calculateSMA = (data: QQQData[], period: number) => {
        return data.map((_, index) => {
            if (index < period - 1) return null;
            const sum = data.slice(index - period + 1, index + 1).reduce((acc, curr) => acc + curr.close, 0);
            return {
                time: data[index].time,
                value: sum / period,
            };
        }).filter((item): item is { time: UTCTimestamp; value: number } => item !== null);
    };

    // Market Phase Analysis
    const getMarketPhaseStats = () => {
        const stats = {
            uptrend: { wins: 0, losses: 0 },
            downtrend: { wins: 0, losses: 0 },
            sideways: { wins: 0, losses: 0 },
        };

        trades.forEach(trade => {
            const tradeDate = dayjs(trade.entry_datetime);
            const isWin = (trade.realized_pnl || 0) > 0;
            
            // Determine market phase based on SMAs
            const tradeIndex = qqqData.findIndex(d => d.time === tradeDate.unix() as UTCTimestamp);
            if (tradeIndex >= 0 && tradeIndex >= 50) { // Need at least 50 days of data for SMAs
                const sma20 = calculateSMA(qqqData.slice(0, tradeIndex + 1), 20).pop()?.value || 0;
                const sma50 = calculateSMA(qqqData.slice(0, tradeIndex + 1), 50).pop()?.value || 0;
                
                let phase: 'uptrend' | 'downtrend' | 'sideways';
                if (sma20 > sma50 * 1.02) {
                    phase = 'uptrend';
                } else if (sma20 < sma50 * 0.98) {
                    phase = 'downtrend';
                } else {
                    phase = 'sideways';
                }
                
                if (isWin) {
                    stats[phase].wins++;
                } else {
                    stats[phase].losses++;
                }
            }
        });

        return stats;
    };

    return (
        <div className="grid grid-cols-1 gap-6">
            <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                    <h2 className="card-title">Market Context Analysis</h2>
                    <p className="text-sm text-base-content/70">
                        Your trades plotted on QQQ chart. Green markers represent winning trades, red markers represent losing trades.
                    </p>
                    <div className="flex gap-2 mb-4">
                        {['1M', '3M', '6M', '1Y', 'ALL'].map(period => (
                            <button
                                key={period}
                                className={`btn btn-sm ${selectedPeriod === period ? 'btn-primary' : 'btn-ghost'}`}
                                onClick={() => setSelectedPeriod(period)}
                            >
                                {period}
                            </button>
                        ))}
                    </div>
                    <div ref={chartContainerRef} className="h-[600px]" />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
                <div className="card bg-base-100 shadow-xl">
                    <div className="card-body">
                        <h2 className="card-title">Market Phase Performance</h2>
                        <p className="text-sm text-base-content/70">
                            Win rate and P&L in different market phases (based on 20/50 SMA crossovers).
                        </p>
                        <div className="stats shadow">
                            {Object.entries(getMarketPhaseStats()).map(([phase, stats]) => (
                                <div key={phase} className="stat">
                                    <div className="stat-title capitalize">{phase}</div>
                                    <div className="stat-value text-primary">
                                        {((stats.wins / (stats.wins + stats.losses)) * 100).toFixed(1)}%
                                    </div>
                                    <div className="stat-desc">
                                        {stats.wins + stats.losses} trades
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MarketContextAnalysis;
