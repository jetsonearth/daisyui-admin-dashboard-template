import React, { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, Time, UTCTimestamp } from 'lightweight-charts';

interface OHLCVData {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

interface TradeMarker {
    timestamp: number;
    price: number;
    type: 'entry' | 'exit';
}

interface TradeChartProps {
    data: OHLCVData[];
    trades?: TradeMarker[];
}

const TradeChart: React.FC<TradeChartProps> = ({ data, trades }) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

    useEffect(() => {
        if (!chartContainerRef.current) return;

        // Create chart
        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { color: '#1e1e2d' },
                textColor: '#DDD',
            },
            grid: {
                vertLines: { color: '#2B2B43' },
                horzLines: { color: '#2B2B43' },
            },
            crosshair: {
                mode: 0,
            },
            rightPriceScale: {
                borderColor: '#2B2B43',
            },
            timeScale: {
                borderColor: '#2B2B43',
                timeVisible: true,
            },
            handleScroll: {
                mouseWheel: true,
                pressedMouseMove: true,
            },
            handleScale: {
                mouseWheel: true,
                pinch: true,
            },
        });

        // Create candlestick series
        const candlestickSeries = chart.addCandlestickSeries({
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderVisible: false,
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350',
        });

        // Create volume series
        const volumeSeries = chart.addHistogramSeries({
            color: '#26a69a',
            priceFormat: {
                type: 'volume',
            },
            priceScaleId: '', // Set as an overlay
        });

        // Add data
        candlestickSeries.setData(data.map(item => ({
            time: (item.timestamp / 1000) as UTCTimestamp,
            open: item.open,
            high: item.high,
            low: item.low,
            close: item.close,
        })));

        volumeSeries.setData(data.map(item => ({
            time: (item.timestamp / 1000) as UTCTimestamp,
            value: item.volume,
            color: item.close > item.open ? '#26a69a' : '#ef5350',
        })));

        // Add trade markers if provided
        if (trades) {
            trades.forEach(trade => {
                candlestickSeries.createPriceLine({
                    price: trade.price,
                    color: trade.type === 'entry' ? '#26a69a' : '#ef5350',
                    lineWidth: 2,
                    lineStyle: 2,
                    axisLabelVisible: true,
                    title: trade.type === 'entry' ? 'Entry' : 'Exit',
                });
            });
        }

        // Fit content
        chart.timeScale().fitContent();

        // Store references
        chartRef.current = chart;
        candlestickSeriesRef.current = candlestickSeries;
        volumeSeriesRef.current = volumeSeries;

        // Cleanup
        return () => {
            chart.remove();
        };
    }, [data, trades]);

    return (
        <div ref={chartContainerRef} style={{ width: '100%', height: '400px' }} />
    );
};

export default TradeChart;
