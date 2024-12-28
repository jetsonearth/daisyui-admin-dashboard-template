import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay } from 'date-fns';

interface JournalEntry {
    id: string;
    date: string;
    market_summary: string;
    reflection: string;
    lessons_learned: string;
    emotions_rating: number;
    focus_rating: number;
    discipline_rating: number;
}

interface JournalCalendarProps {
    entries: JournalEntry[];
    selectedDate: Date;
    onDateSelect: (date: Date) => void;
}

const JournalCalendar: React.FC<JournalCalendarProps> = ({
    entries,
    selectedDate,
    onDateSelect
}) => {
    const [currentDate, setCurrentDate] = useState(selectedDate);
    
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const entriesByDate = entries.reduce((acc, entry) => {
        acc[entry.date] = entry;
        return acc;
    }, {} as Record<string, JournalEntry>);

    const getDayClass = (day: Date) => {
        let classes = "h-14 w-14 rounded-lg flex flex-col items-center justify-center relative cursor-pointer ";
        
        if (!isSameMonth(day, currentDate)) {
            classes += "text-base-content/30 ";
        } else {
            classes += "hover:bg-base-200 ";
        }

        if (isToday(day)) {
            classes += "border-2 border-primary ";
        }

        if (isSameDay(day, selectedDate)) {
            classes += "bg-primary/10 text-primary font-medium ";
        }

        return classes.trim();
    };

    const hasEntry = (day: Date) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        return dateStr in entriesByDate;
    };

    const getEmotionColor = (entry: JournalEntry) => {
        const avgRating = (entry.emotions_rating + entry.focus_rating + entry.discipline_rating) / 3;
        if (avgRating >= 4) return 'bg-success';
        if (avgRating >= 3) return 'bg-warning';
        return 'bg-error';
    };

    return (
        <div className="p-4 bg-base-100 rounded-xl shadow-lg">
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">
                    {format(currentDate, 'MMMM yyyy')}
                </h2>
                <div className="flex gap-2">
                    <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1))}
                    >
                        ←
                    </button>
                    <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => setCurrentDate(new Date())}
                    >
                        Today
                    </button>
                    <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1))}
                    >
                        →
                    </button>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
                {/* Day headers */}
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="h-10 flex items-center justify-center text-sm font-medium">
                        {day}
                    </div>
                ))}

                {/* Calendar days */}
                {daysInMonth.map(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const entry = entriesByDate[dateStr];

                    return (
                        <div
                            key={dateStr}
                            className={getDayClass(day)}
                            onClick={() => onDateSelect(day)}
                        >
                            <span>{format(day, 'd')}</span>
                            {hasEntry(day) && (
                                <div 
                                    className={`absolute bottom-1 w-2 h-2 rounded-full ${getEmotionColor(entry)}`}
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default JournalCalendar;
