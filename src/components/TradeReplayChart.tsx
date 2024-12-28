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
    maePrice?: number;  // Maximum Adverse Excursion price
    mfePrice?: number;  // Maximum Favorable Excursion price
}

export const TradeReplayChart: React.FC<TradeReplayChartProps> = ({
    data,
    actions,
    containerClassName = 'w-full h-[800px]',
    stopLossPrice,
    maePrice,
    mfePrice
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

        // Create a price line group for trade metrics
        const tradeMetricsGroup = {
            title: 'Trade Metrics',
            toolTipVisible: true,
            lines: [] as any[]
        };

        // Add stop loss line if provided
        if (stopLossPrice) {
            tradeMetricsGroup.lines.push({
                price: stopLossPrice,
                color: '#ff4444',
                lineWidth: 1,
                lineStyle: 2, // Dotted line
                axisLabelVisible: true,
                title: 'Stop Loss',
            });
        }

        // Add MAE line if provided
        if (maePrice) {
            tradeMetricsGroup.lines.push({
                price: maePrice,
                color: '#ef5350', // Red
                lineWidth: 1,
                lineStyle: 1, // Solid line
                axisLabelVisible: true,
                title: 'MAE',
            });
        }

        // Add MFE line if provided
        if (mfePrice) {
            tradeMetricsGroup.lines.push({
                price: mfePrice,
                color: '#26a69a', // Green
                lineWidth: 1,
                lineStyle: 1, // Solid line
                axisLabelVisible: true,
                title: 'MFE',
            });
        }

        // Add all lines with proper spacing
        tradeMetricsGroup.lines.forEach((line, index) => {
            const priceLine = candlestickSeries.createPriceLine({
                ...line,
                axisLabelVisible: true,
                title: `${line.title} ${line.price.toFixed(2)}`,
            });
        });

        // Add markers for trade actions
        const markers = actions.map(action => ({
            time: action.time,
            position: (action.type === 'BUY' ? 'belowBar' : 'aboveBar') as SeriesMarkerPosition,
            color: action.type === 'BUY' ? '#26a69a' : '#ef5350',
            shape: (action.type === 'BUY' ? 'arrowUp' : 'arrowDown') as SeriesMarkerShape,
            text: `${action.type} ${action.shares} @ ${action.price}`,
            size: 2,
        }));
        candlestickSeries.setMarkers(markers);

        // Add legend with trade metrics
        const legend = document.createElement('div');
        legend.style.position = 'absolute';
        legend.style.left = '12px';
        legend.style.top = '12px';
        legend.style.zIndex = '1';
        legend.style.background = 'rgba(27, 27, 27, 0.8)';
        legend.style.padding = '8px';
        legend.style.borderRadius = '4px';
        legend.style.display = 'flex';
        legend.style.flexDirection = 'column';
        legend.style.gap = '8px';
        
        // Add trade metrics to legend
        const metrics = [
            { title: 'Stop Loss', price: stopLossPrice, color: '#ff4444' },
            { title: 'MAE', price: maePrice, color: '#ef5350' },
            { title: 'MFE', price: mfePrice, color: '#26a69a' },
        ].filter(m => m.price);

        legend.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 4px;">Trade Metrics</div>
            ${metrics.map(m => `
                <div style="color: ${m.color}; display: flex; align-items: center; justify-content: space-between; min-width: 150px;">
                    <span style="display: flex; align-items: center;">
                        <span style="width: 12px; height: 2px; background: ${m.color}; display: inline-block; margin-right: 4px;"></span>
                        ${m.title}
                    </span>
                    <span>${m.price.toFixed(2)}</span>
                </div>
            `).join('')}
            <div style="margin-top: 8px; font-weight: bold;">EMAs</div>
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

        // Add volume series to volume chart
        const volumeSeries = volumeChart.addHistogramSeries({
            color: '#26a69a',
            priceFormat: {
                type: 'volume',
            },
            priceScaleId: 'volume',  // Give it a unique ID
            base: 0,  // Base line for the histogram
            priceLineVisible: false,  // Hide the price line
            lastValueVisible: false,  // Hide the last value label
        });

        volumeChart.priceScale('volume').applyOptions({
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
