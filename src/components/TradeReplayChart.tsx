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
import { EMA } from '@debut/indicators';

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
    stopLossPrice?: number;
}

export const TradeReplayChart: React.FC<TradeReplayChartProps> = ({
    data,
    actions,
    containerClassName = 'w-full h-[800px]',
    stopLossPrice
}) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
    const ema8SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const ema21SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const ema50SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const volumeChartRef = useRef<IChartApi | null>(null);

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
            height: chartContainerRef.current.clientHeight * 0.7, // Reduce main chart height to 70%
        });

        // Create volume chart
        const volumeChart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: '#1B1B1B' },
                textColor: '#DDD',
            },
            grid: {
                vertLines: { color: '#2B2B2B' },
                horzLines: { color: '#2B2B2B' },
            },
            rightPriceScale: {
                borderColor: '#2B2B2B',
                scaleMargins: {
                    top: 0.1,
                    bottom: 0.1,
                },
            },
            timeScale: {
                visible: false, // Hide time scale for volume chart
            },
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight * 0.3, // 30% height for volume
        });

        // Add candlestick series
        const candlestickSeries = chart.addCandlestickSeries({
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderVisible: false,
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350',
        });

        // Add stop loss line if provided
        if (stopLossPrice) {
            candlestickSeries.createPriceLine({
                price: stopLossPrice,
                color: 'red',
                lineWidth: 1,
                lineStyle: 2, // Dotted line
                axisLabelVisible: true,
                title: 'Stop Loss',
            });
        }

        // Create EMA series with updated colors and no price line
        const ema8Series = chart.addLineSeries({
            color: '#f48fb1',
            lineWidth: 2,
            title: 'EMA 8',
            priceLineVisible: false,
            lastValueVisible: false,
        });

        const ema21Series = chart.addLineSeries({
            color: '#90caf9',
            lineWidth: 2,
            title: 'EMA 21',
            priceLineVisible: false,
            lastValueVisible: false,
        });

        const ema50Series = chart.addLineSeries({
            color: '#ef5350', // Changed to red
            lineWidth: 2,
            title: 'EMA 50',
            priceLineVisible: false,
            lastValueVisible: false,
        });

        // Add legend
        const legend = document.createElement('div');
        legend.style.position = 'absolute';
        legend.style.left = '12px';
        legend.style.top = '12px';
        legend.style.zIndex = '1';
        legend.style.background = 'rgba(27, 27, 27, 0.8)';
        legend.style.padding = '8px';
        legend.style.borderRadius = '4px';
        legend.style.display = 'flex';
        legend.style.gap = '12px';
        legend.innerHTML = `
            <div style="color: #f48fb1; display: flex; align-items: center;">
                <span style="width: 12px; height: 2px; background: #f48fb1; display: inline-block; margin-right: 4px;"></span>
                EMA 8
            </div>
            <div style="color: #90caf9; display: flex; align-items: center;">
                <span style="width: 12px; height: 2px; background: #90caf9; display: inline-block; margin-right: 4px;"></span>
                EMA 21
            </div>
            <div style="color: #ef5350; display: flex; align-items: center;">
                <span style="width: 12px; height: 2px; background: #ef5350; display: inline-block; margin-right: 4px;"></span>
                EMA 50
            </div>
        `;
        chartContainerRef.current.style.position = 'relative';
        chartContainerRef.current.appendChild(legend);

        // Add volume series to volume chart
        const volumeSeries = chart.addHistogramSeries({
            color: '#26a69a',
            priceFormat: {
                type: 'volume',
            },
            priceScaleId: 'volume',  // Give it a unique ID
            base: 0,  // Base line for the histogram
            priceLineVisible: false,  // Hide the price line
            lastValueVisible: false,  // Hide the last value label
        });

        chart.priceScale('volume').applyOptions({
            scaleMargins: {
                top: 0.75,  // Push volume further down
                bottom: 0,
            },
            visible: false, // Hide the price scale
        });

        // Calculate EMAs
        const ema8 = new EMA(8);
        const ema21 = new EMA(21);
        const ema50 = new EMA(50);

        const ema8Data = [];
        const ema21Data = [];
        const ema50Data = [];

        // Set data
        const chartData = data.map(item => ({
            ...item,
            time: item.time as UTCTimestamp
        }));

        // Calculate EMAs and prepare data
        for (const item of chartData) {
            const ema8Value = ema8.nextValue(item.close);
            const ema21Value = ema21.nextValue(item.close);
            const ema50Value = ema50.nextValue(item.close);
            
            if (ema8Value !== undefined) {
                ema8Data.push({
                    time: item.time,
                    value: ema8Value,
                });
            }
            
            if (ema21Value !== undefined) {
                ema21Data.push({
                    time: item.time,
                    value: ema21Value,
                });
            }
            
            if (ema50Value !== undefined) {
                ema50Data.push({
                    time: item.time,
                    value: ema50Value,
                });
            }
        }
        
        candlestickSeries.setData(chartData);
        
        // Calculate max volume for scaling
        const maxVolume = Math.max(...data.map(item => item.volume));
        const scaleFactor = 0.2; // Reduced from 0.3 to make bars shorter
        
        // Set volume data with more transparency and scaled height
        const volumeData = chartData.map(item => ({
            time: item.time,
            value: item.volume * scaleFactor,  // Scale down the volume bars
            color: item.close > item.open ? '#26a69a20' : '#ef535020',  // Added transparency with 20 hex
        }));
        
        volumeSeries.setData(volumeData);

        // Set EMA data
        ema8Series.setData(ema8Data);
        ema21Series.setData(ema21Data);
        ema50Series.setData(ema50Data);

        // Add markers for all actions
        if (actions.length > 0) {
            console.log('🎯 Adding trade markers:', actions.length);
            
            const markers = actions.map(action => ({
                time: action.time as UTCTimestamp,
                position: action.type === 'BUY' ? 'aboveBar' as SeriesMarkerPosition : 'aboveBar' as SeriesMarkerPosition,
                color: action.type === 'BUY' ? '#2196F3' : '#FF9800',
                shape: action.type === 'BUY' ? 'arrowDown' as SeriesMarkerShape : 'arrowDown' as SeriesMarkerShape,
                text: `${action.type} ${action.shares} shares`,
                yOffset: action.type === 'BUY' ? 35 : -35, // Adjust these values to move the markers as needed
            }));

            candlestickSeries.setMarkers(markers);

            // Find the first buy action
            const firstBuyAction = actions.find(action => action.type === 'BUY');

            if (firstBuyAction) {
                candlestickSeries.createPriceLine({
                    price: firstBuyAction.price,
                    color: '#2196F3', // Color for buy action
                    lineWidth: 1,
                    lineStyle: 2, // Dotted line
                    axisLabelVisible: true,
                    title: 'First Entry',
                });
            }
        }

        // Fit content
        chart.timeScale().fitContent();

        // Store references
        chartRef.current = chart;
        candlestickSeriesRef.current = candlestickSeries;
        volumeSeriesRef.current = volumeSeries;
        ema8SeriesRef.current = ema8Series;
        ema21SeriesRef.current = ema21Series;
        ema50SeriesRef.current = ema50Series;
        volumeChartRef.current = volumeChart;

        // Cleanup
        return () => {
            chart.remove();
            volumeChart.remove();
            if (chartContainerRef.current) {
                const legend = chartContainerRef.current.querySelector('div');
                if (legend) {
                    chartContainerRef.current.removeChild(legend);
                }
            }
        };
    }, [data, actions, stopLossPrice]);

    // Handle resize
    useEffect(() => {
        const handleResize = () => {
            if (chartRef.current && chartContainerRef.current) {
                chartRef.current.applyOptions({
                    width: chartContainerRef.current.clientWidth,
                    height: chartContainerRef.current.clientHeight * 0.7,
                });
            }
            if (volumeChartRef.current && chartContainerRef.current) {
                volumeChartRef.current.applyOptions({
                    width: chartContainerRef.current.clientWidth,
                    height: chartContainerRef.current.clientHeight * 0.3,
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
