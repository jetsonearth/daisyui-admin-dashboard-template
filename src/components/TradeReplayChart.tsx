import React, { useEffect, useRef } from 'react';
import { 
    createChart, 
    ColorType, 
    CrosshairMode, 
    UTCTimestamp, 
    SeriesMarkerPosition,
    SeriesMarkerShape,
    IChartApi,
    ISeriesApi,
    HistogramData 
} from 'lightweight-charts';
import { OHLCVData } from '../features/marketData/marketDataService';

interface TradeAction {
    type: 'BUY' | 'SELL';
    price: number;
    time: UTCTimestamp;
    shares: number;
}

interface TradeReplayChartProps {
    data: OHLCVData[];
    actions: TradeAction[];
    containerClassName?: string;
}

export const TradeReplayChart: React.FC<TradeReplayChartProps> = ({
    data,
    actions,
    containerClassName = 'w-full h-[400px]'
}) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);

    useEffect(() => {
        if (!chartContainerRef.current || !data.length) return;

        console.log('📊 Rendering chart with data:', {
            dataPoints: data.length,
            firstDate: new Date(data[0].time * 1000).toISOString(),
            lastDate: new Date(data[data.length - 1].time * 1000).toISOString(),
            actions: actions.map(a => ({
                type: a.type,
                time: new Date(a.time * 1000).toISOString(),
                price: a.price,
                shares: a.shares
            }))
        });

        // Create chart
        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: '#1B1B1B' },
                textColor: '#DDD',
            },
            grid: {
                vertLines: { color: '#2B2B2B' },
                horzLines: { color: '#2B2B2B' },
            },
            crosshair: {
                mode: CrosshairMode.Normal,
            },
            rightPriceScale: {
                borderColor: '#2B2B2B',
            },
            timeScale: {
                borderColor: '#2B2B2B',
                timeVisible: true,
                secondsVisible: false,
            },
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight,
        });

        // Add candlestick series
        const candlestickSeries = chart.addCandlestickSeries({
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderVisible: false,
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350',
        });

        // Add volume series
        const volumeSeries = chart.addHistogramSeries({
            color: '#26a69a',
            priceFormat: {
                type: 'volume',
            },
            priceScaleId: '', // Empty string makes it an overlay
        });

        // Set data
        const chartData = data.map(item => ({
            ...item,
            time: item.time as UTCTimestamp
        }));
        
        console.log('📈 Setting chart data:', {
            candlesticks: chartData.length,
            sampleData: chartData[0]
        });
        
        candlestickSeries.setData(chartData);
        
        const volumeData = chartData.map(item => ({
            time: item.time as UTCTimestamp,
            value: item.volume,
            color: item.close >= item.open ? '#26a69a50' : '#ef535050'
        })) as HistogramData[];
        
        volumeSeries.setData(volumeData);

        // Add markers for all actions
        if (actions.length > 0) {
            console.log('🎯 Adding trade markers:', actions.length);
            
            const markers = actions.map(action => ({
                time: action.time as UTCTimestamp,
                position: action.type === 'BUY' ? 'belowBar' as SeriesMarkerPosition : 'aboveBar' as SeriesMarkerPosition,
                color: action.type === 'BUY' ? '#2196F3' : '#FF9800',
                shape: action.type === 'BUY' ? 'arrowUp' as SeriesMarkerShape : 'arrowDown' as SeriesMarkerShape,
                text: `${action.type} ${action.shares}`,
            }));

            candlestickSeries.setMarkers(markers);

            // Add price lines for each action
            actions.forEach((action, index) => {
                candlestickSeries.createPriceLine({
                    price: action.price,
                    color: action.type === 'BUY' ? '#2196F3' : '#FF9800',
                    lineWidth: 2,
                    lineStyle: 2,
                    axisLabelVisible: true,
                    title: `${action.type} ${index + 1}`,
                });
            });
        }

        // Fit content
        chart.timeScale().fitContent();

        // Store chart reference
        chartRef.current = chart;

        // Cleanup
        return () => {
            chart.remove();
        };
    }, [data, actions]);

    // Handle resize
    useEffect(() => {
        const handleResize = () => {
            if (chartRef.current && chartContainerRef.current) {
                chartRef.current.applyOptions({
                    width: chartContainerRef.current.clientWidth,
                    height: chartContainerRef.current.clientHeight,
                });
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div className={containerClassName} ref={chartContainerRef} />
    );
};
