import React, { useEffect, useRef } from 'react';
import { widget } from '../charting_library/charting_library';
import { OHLCVData } from '../features/marketData/marketDataService';

interface TradeAction {
    type: 'BUY' | 'SELL';
    price: number;
    time: number;
    shares: number;
}

interface AdvancedTradeChartProps {
    data: OHLCVData[];
    actions: TradeAction[];
    containerClassName?: string;
}

export const AdvancedTradeChart: React.FC<AdvancedTradeChartProps> = ({
    data,
    actions,
    containerClassName = 'w-full h-[600px]'
}) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const tvWidgetRef = useRef<any>(null);

    useEffect(() => {
        if (!chartContainerRef.current || !data.length) return;

        const widgetOptions = {
            symbol: 'Custom Chart',
            interval: '1D',
            container: chartContainerRef.current,
            library_path: '/charting_library/',
            locale: 'en',
            disabled_features: ['use_localstorage_for_settings'],
            enabled_features: ['study_templates'],
            charts_storage_url: 'https://saveload.tradingview.com',
            client_id: 'tradingview.com',
            user_id: 'public_user_id',
            fullscreen: false,
            autosize: true,
            studies_overrides: {},
            theme: 'Dark',
            custom_indicators_getter: function(PineJS: any) {
                return Promise.resolve([
                    {
                        name: "ATR",
                        metainfo: {
                            _metainfoVersion: 51,
                            id: "ATR@tv-basicstudies-1",
                            name: "ATR",
                            description: "Average True Range",
                            shortDescription: "ATR",
                            is_price_study: false,
                            isCustomIndicator: true,
                            plots: [{ id: "plot_0", type: "line" }],
                            defaults: {
                                inputs: { length: 14 },
                                palettes: {
                                    palette_0: {
                                        colors: ["#FF0000"],
                                        widths: [1],
                                        styles: ["solid"]
                                    }
                                }
                            },
                            inputs: [
                                {
                                    id: "length",
                                    name: "Length",
                                    type: "integer",
                                    defval: 14,
                                    min: 1,
                                    max: 100
                                }
                            ],
                            format: {
                                type: "price",
                                precision: 4
                            }
                        },
                        constructor: function() {
                            this.init = function(context: any, inputCallback: any) {
                                this._context = context;
                                this._input = inputCallback;
                                const length = this._input(0);
                                this._atr = new ATR(length);
                            };

                            this.main = function(context: any, inputCallback: any) {
                                this._context = context;
                                this._input = inputCallback;
                                const length = this._input(0);
                                const high = this._context.new_var(this._context.high[0]);
                                const low = this._context.new_var(this._context.low[0]);
                                const close = this._context.new_var(this._context.close[0]);
                                return [this._atr.calculate(high, low, close)];
                            };
                        }
                    }
                ]);
            }
        };

        const tvWidget = new widget(widgetOptions);
        tvWidgetRef.current = tvWidget;

        tvWidget.onChartReady(() => {
            const chart = tvWidget.chart();

            // Set up chart data
            const formattedData = data.map(item => ({
                time: item.time,
                open: item.open,
                high: item.high,
                low: item.low,
                close: item.close,
                volume: item.volume
            }));

            // Create main series (candlesticks)
            const mainSeries = chart.createSeries('candlestick', {
                priceFormat: { type: 'price', precision: 2 },
                overlay: false,
                scaleMargins: {
                    top: 0.1,
                    bottom: 0.3
                }
            });
            mainSeries.setData(formattedData);

            // Create volume series
            const volumeSeries = chart.createSeries('volume', {
                priceFormat: { type: 'volume' },
                overlay: false,
                scaleMargins: {
                    top: 0.7,
                    bottom: 0
                }
            });
            volumeSeries.setData(formattedData);

            // Add ATR indicator
            chart.createStudy('ATR', false, false, [14]);

            // Add trade markers
            actions.forEach(action => {
                const markerColor = action.type === 'BUY' ? '#2196F3' : '#FF9800';
                const markerText = `${action.type} ${action.shares}`;
                const markerPosition = action.type === 'BUY' ? 'belowBar' : 'aboveBar';

                mainSeries.createShape({
                    time: action.time,
                    price: action.price,
                    text: markerText,
                    shape: action.type === 'BUY' ? 'arrow_up' : 'arrow_down',
                    color: markerColor,
                    size: 2
                });

                // Add price line
                mainSeries.createPriceLine({
                    price: action.price,
                    color: markerColor,
                    lineWidth: 1,
                    lineStyle: 2,
                    axisLabelVisible: true,
                    title: `${action.type} ${action.shares}`
                });
            });

            // Enable drawings
            chart.enableDrawing();
        });

        return () => {
            if (tvWidgetRef.current) {
                tvWidgetRef.current.remove();
                tvWidgetRef.current = null;
            }
        };
    }, [data, actions]);

    return (
        <div className={containerClassName} ref={chartContainerRef} />
    );
};
