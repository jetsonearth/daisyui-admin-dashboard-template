import React, { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday } from 'date-fns';

interface Trade {
    id: string;
    pnl: number;
    numTrades: number;
    entry_datetime: string;
}

interface TradeCalendarProps {
    trades: Trade[];
    startingCapital: number;
    onDateClick?: (date: Date) => void;
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

    // Group trades by date
    const tradesByDate = trades.reduce((acc, trade) => {
        const date = new Date(trade.entry_datetime).toISOString().split('T')[0];
        if (!acc[date]) {
            acc[date] = [];
        }
        acc[date].push(trade);
        return acc;
    }, {} as Record<string, Trade[]>);

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

    return (
        <div className="bg-base-100 rounded-lg shadow-lg">
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

                <div className="grid grid-cols-7 divide-x divide-base-300 grid-rows-6">
                    {Array.from({ length: 42 }).map((_, idx) => {
                        const day = new Date(currentDate);
                        day.setDate(1); // Start from first of month
                        day.setDate(1 - day.getDay() + idx); // Adjust to start from first Sunday

                        const dateStr = format(day, 'yyyy-MM-dd');
                        const dayTrades = tradesByDate[dateStr] || [];
                        const totalPnL = dayTrades.reduce((sum, trade) => sum + trade.pnl, 0);
                        const isCurrentMonth = isSameMonth(day, currentDate);
                        
                        return (
                            <div 
                                key={dateStr}
                                onClick={() => onDateClick?.(day)}
                                className={`
                                    p-3.5 h-[100px] flex flex-col justify-between transition-all hover:bg-base-200 cursor-pointer
                                    ${!isCurrentMonth ? 'bg-base-200/50' : ''}
                                    ${isToday(day) ? 'bg-primary/5' : ''}
                                    ${idx % 7 !== 6 ? 'border-r' : ''} 
                                    ${Math.floor(idx / 7) !== 5 ? 'border-b' : ''} 
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
                                {dayTrades.length > 0 && (
                                    <div className={`
                                        text-sm font-medium
                                        ${totalPnL > 0 ? 'text-success' : 'text-error'}
                                    `}>
                                        {totalPnL > 0 ? '+' : ''}{totalPnL.toFixed(2)}%
                                        <div className="text-xs opacity-60">
                                            {dayTrades.length} trade{dayTrades.length !== 1 ? 's' : ''}
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
