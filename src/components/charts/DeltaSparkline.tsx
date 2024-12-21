import React from 'react';
import ReactApexChart from 'react-apexcharts';

interface DeltaSparklineProps {
    data: Array<{
        date: string;
        value: number;
    }>;
    height?: number;
}

export const DeltaSparkline: React.FC<DeltaSparklineProps> = ({ 
    data,
    height = 50 
}) => {
    const options = {
        chart: {
            type: 'area',
            sparkline: {
                enabled: true
            },
            animations: {
                enabled: true,
                easing: 'easeinout',
                speed: 800,
                animateGradually: {
                    enabled: true,
                    delay: 150
                }
            },
            toolbar: {
                show: false
            }
        },
        tooltip: {
            enabled: true,
            fixed: {
                enabled: true,
                position: 'topRight',
                offsetX: -10,
                offsetY: 5,
            },
            x: {
                show: true,
                formatter: function(val: number, opts: any) {
                    return data[val]?.date || '';
                }
            },
            y: {
                formatter: function(val: number) {
                    return val.toFixed(2) + '%';
                }
            },
            marker: {
                show: false
            }
        },
        stroke: {
            curve: 'smooth',
            width: 2
        },
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.45,
                opacityTo: 0.05,
                stops: [50, 100]
            }
        },
        colors: ['#4ade80'],
        grid: {
            show: false,
            padding: {
                top: 0,
                right: 0,
                bottom: 0,
                left: 0
            }
        },
        xaxis: {
            type: 'category',
            crosshairs: {
                show: false
            }
        },
        yaxis: {
            min: function(min: number) { return min < 0 ? min : 0 },
            max: function(max: number) { return max > 0 ? max : 0 },
            show: false
        }
    };

    // Transform data for ApexCharts
    const series = [{
        name: 'Delta',
        data: data.map(d => d.value)
    }];

    // Dynamically set colors based on values
    if (data.length > 0) {
        const lastValue = data[data.length - 1]?.value;
        if (lastValue < 0) {
            options.colors = ['#ef4444']; // Red for negative trend
        } else if (lastValue === 0) {
            options.colors = ['#facc15']; // Yellow for neutral
        }
    }

    return (
        <div style={{ height }}>
            <ReactApexChart
                options={options}
                series={series}
                type="area"
                height={height}
            />
        </div>
    );
};
