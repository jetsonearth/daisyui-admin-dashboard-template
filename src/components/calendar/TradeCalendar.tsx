import React, { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, parseISO } from 'date-fns';
import { Trade as TradeType } from '../../types';

interface TradeCalendarProps {
    trades: TradeType[];
    startingCapital: number;
    onDateClick?: (date: Date, trades: TradeType[]) => void;
    onMonthChange?: (start: Date, end: Date) => void;
}

const TradeCalendar: React.FC<TradeCalendarProps> = ({
    trades,
    startingCapital,
    onDateClick,
    onMonthChange
}) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [currentView, setCurrentView] = useState<'month' | 'week'>('month');

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Group trades by date and calculate metrics
    const tradesByDate = trades.reduce((acc, trade) => {
        if (trade.status !== 'Closed' || !trade.exit_datetime) return acc;
        
        const date = new Date(trade.exit_datetime).toISOString().split('T')[0];
        if (!acc[date]) {
            acc[date] = {
                trades: [],
                metrics: {
                    numTrades: 0,
                    totalPnL: 0,
                    avgR: 0,
                    winRate: 0,
                    volume: 0
                }
            };
        }
        acc[date].trades.push(trade);
        acc[date].metrics.numTrades++;
        acc[date].metrics.totalPnL += trade.realized_pnl || 0;
        acc[date].metrics.avgR += trade.risk_reward_ratio || 0;
        acc[date].metrics.winRate += (trade.realized_pnl || 0) > 0 ? 1 : 0;
        acc[date].metrics.volume += trade.total_shares || 0;
        return acc;
    }, {} as Record<string, { 
        trades: TradeType[], 
        metrics: { 
            numTrades: number, 
            totalPnL: number, 
            avgR: number,
            winRate: number,
            volume: number
        } 
    }>);

    // Calculate final averages
    Object.values(tradesByDate).forEach(dayData => {
        dayData.metrics.avgR = dayData.metrics.avgR / dayData.metrics.numTrades;
        dayData.metrics.winRate = (dayData.metrics.winRate / dayData.metrics.numTrades) * 100;
    });

    const handlePrevMonth = () => {
        const newDate = new Date(currentDate.setMonth(currentDate.getMonth() - 1));
        setCurrentDate(newDate);
        onMonthChange?.(startOfMonth(newDate), endOfMonth(newDate));
    };

    const handleNextMonth = () => {
        const newDate = new Date(currentDate.setMonth(currentDate.getMonth() + 1));
        setCurrentDate(newDate);
        onMonthChange?.(startOfMonth(newDate), endOfMonth(newDate));
    };

    const handleDateClick = (date: Date) => {
        const dateStr = date.toISOString().split('T')[0];
        const dayData = tradesByDate[dateStr];
        if (dayData && dayData.trades.length > 0) {
            onDateClick?.(date, dayData.trades);
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    };

    return (
        <div className="bg-base-100 rounded-lg">
            <div className="flex justify-between items-center gap-3 mb-5 p-4">
                <div className="flex items-center gap-4">
                    <h5 className="text-xl font-semibold">{format(currentDate, 'MMMM yyyy')}</h5>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setCurrentDate(new Date())}
                            className="btn btn-sm btn-ghost gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M11.3333 3L11.3333 3.65L11.3333 3ZM4.66666 3.00002L4.66666 2.35002L4.66666 3.00002ZM5.36719 9.98333C5.72617 9.98333 6.01719 9.69232 6.01719 9.33333C6.01719 8.97435 5.72617 8.68333 5.36719 8.68333V9.98333ZM5.33385 8.68333C4.97487 8.68333 4.68385 8.97435 4.68385 9.33333C4.68385 9.69232 4.97487 9.98333 5.33385 9.98333V8.68333ZM5.36719 11.9833C5.72617 11.9833 6.01719 11.6923 6.01719 11.3333C6.01719 10.9743 5.72617 10.6833 5.36719 10.6833V11.9833ZM5.33385 10.6833C4.97487 10.6833 4.68385 10.9743 4.68385 11.3333C4.68385 11.6923 4.97487 11.9833 5.33385 11.9833V10.6833Z" fill="currentColor"/>
                            </svg>
                            Today
                        </button>
                        <button 
                            onClick={handlePrevMonth}
                            className="btn btn-sm btn-ghost"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M10.0002 11.9999L6 7.99971L10.0025 3.99719" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </button>
                        <button 
                            onClick={handleNextMonth}
                            className="btn btn-sm btn-ghost"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M6.00236 3.99707L10.0025 7.99723L6 11.9998" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div className="join">
                    <button 
                        className={`join-item btn btn-sm ${currentView === 'month' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setCurrentView('month')}
                    >
                        Month
                    </button>
                    <button 
                        className={`join-item btn btn-sm ${currentView === 'week' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setCurrentView('week')}
                    >
                        Week
                    </button>
                </div>
            </div>

            <div className="border border-base-300">
                <div className="grid grid-cols-7 divide-x divide-base-300 border-b border-base-300">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                        <div key={day} className="p-3.5 flex items-center justify-between">
                            <span className="text-sm font-medium opacity-60">{day}</span>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7 divide-x divide-base-300 grid-rows-5">
                    {Array.from({ length: 35 }).map((_, idx) => {
                        const day = new Date(currentDate);
                        day.setDate(1); // Start from first of month
                        day.setDate(1 - day.getDay() + idx); // Adjust to start from first Sunday

                        const dateStr = day.toISOString().split('T')[0];
                        const dayData = tradesByDate[dateStr];
                        const hasTrades = dayData && dayData.trades.length > 0;
                        const isCurrentMonth = isSameMonth(day, currentDate);
                        const isCurrentDay = isToday(day);

                        return (
                            <div 
                                key={dateStr}
                                onClick={() => handleDateClick(day)}
                                className={`
                                    p-3.5 h-[120px] flex flex-col justify-between transition-all relative
                                    ${hasTrades ? 'hover:bg-base-200 cursor-pointer' : ''}
                                    ${!isCurrentMonth ? 'bg-base-200/50' : ''}
                                    ${isCurrentDay ? 'bg-primary/5' : ''}
                                    ${idx % 7 !== 6 ? 'border-r' : ''} 
                                    ${Math.floor(idx / 7) !== 4 ? 'border-b' : ''} 
                                    border-base-300
                                `}
                            >
                                <span className={`
                                    text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full
                                    ${isToday(day) ? 'bg-primary text-primary-content' : ''}
                                    ${!isCurrentMonth ? 'opacity-40' : ''}
                                `}>
                                    {format(day, 'd')}
                                </span>
                                {hasTrades && (
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs opacity-60">Trades</span>
                                            <span className="text-xs font-medium">{dayData.metrics.numTrades}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs opacity-60">PnL</span>
                                            <span className={`text-xs font-medium ${dayData.metrics.totalPnL >= 0 ? 'text-success' : 'text-error'}`}>
                                                {dayData.metrics.totalPnL >= 0 ? '+' : ''}{formatCurrency(dayData.metrics.totalPnL)}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs opacity-60">Avg R</span>
                                            <span className={`text-xs font-medium ${dayData.metrics.avgR >= 1 ? 'text-success' : 'text-error'}`}>
                                                {dayData.metrics.avgR.toFixed(1)}R
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs opacity-60">Win Rate</span>
                                            <span className={`text-xs font-medium ${dayData.metrics.winRate >= 50 ? 'text-success' : 'text-error'}`}>
                                                {dayData.metrics.winRate.toFixed(0)}%
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default TradeCalendar;
