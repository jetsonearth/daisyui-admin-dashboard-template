import React from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, ChartOptions, ChartData } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip);

interface DeltaGaugeProps {
    risk: number;
    profit: number;
    size?: number;
    type?: 'daily' | 'new' | 'open';
}

export const DeltaGauge: React.FC<DeltaGaugeProps> = ({ 
    risk,
    profit,
    size = 100,
    type = 'daily'
}) => {
    const total = risk + profit;
    const delta = (profit - risk).toFixed(1);

    // If no data, show appropriate message
    if (risk === 0 && profit === 0) {
        const message = type === 'daily' ? 'No trades opened today' :
                       type === 'new' ? 'No new trades' : 'No open trades';
                       
        return (
            <div className="text-sm text-gray-400 text-center py-4">
                {message}
            </div>
        );
    }

    const data: ChartData<'doughnut'> = {
        datasets: [{
            data: [risk, profit],
            backgroundColor: [
                '#f43f5e', // Rose-500 for risk
                '#10b981', // Emerald-500 for profit
            ],
            borderWidth: 0,
            circumference: 180,
            rotation: 270,
            hoverOffset: 5
        }]
    };

    const options: ChartOptions<'doughnut'> = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        animation: {
            animateRotate: true,
            animateScale: true,
            duration: 1000,
            easing: 'easeOutQuart'
        },
        plugins: {
            tooltip: {
                enabled: true,
                position: 'nearest',
                callbacks: {
                    label: (context) => {
                        const value = context.raw as number;
                        return context.dataIndex === 0 ? `Risk: ${value.toFixed(2)}%` : `Profit: ${value.toFixed(2)}%`;
                    }
                },
                backgroundColor: '#1f2937',
                titleColor: '#94a3b8',
                bodyColor: '#f8fafc',
                padding: 12,
                cornerRadius: 8,
                displayColors: false,
                external: function(context) {
                    const tooltipModel = context.tooltip;
                    
                    // Adjust position based on which segment (risk or profit)
                    if (tooltipModel.dataPoints?.[0]?.dataIndex === 0) { // Risk
                        tooltipModel.xAlign = 'left';
                        tooltipModel.yAlign = 'center';
                    } else { // Profit
                        tooltipModel.xAlign = 'right';
                        tooltipModel.yAlign = 'center';
                    }
                }
            },
            legend: {
                display: false
            }
        }
    };

    const textCenter = {
        id: 'textCenter',
        beforeDraw: (chart: ChartJS) => {
            const { ctx, chartArea } = chart;
            const width = chartArea.width;
            const height = chartArea.height;
            
            ctx.save();

            // Draw delta value
            const deltaText = `${delta}%`;
            ctx.font = 'bold 16px Inter';
            ctx.fillStyle = Number(delta) > 0 ? '#10b981' : '#f43f5e';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            const textY = height * 0.6;
            ctx.fillText(deltaText, width / 2, textY);

            ctx.restore();
        }
    };

    return (
        <div style={{ width: size, height: size/2 + 10 }}>
            <Doughnut
                data={data}
                options={options}
                plugins={[textCenter]}
            />
        </div>
    );
};
