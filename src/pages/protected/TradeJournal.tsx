import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../config/supabaseClient';
import TitleCard from '../../components/Cards/TitleCard';
import JournalCalendar from '../../components/calendar/JournalCalendar';
import TradingViewWidget from '../../components/TradingViewWidget';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import MissedTradeModal from '../../components/modals/MissedTradeModal';

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

interface MissedOpportunity {
    id: string;
    ticker: string;
    setup_type: string;
    entry_price: number;
    target_price: number;
    stop_price: number;
    potential_reward: number;
    reason: string;
    lessons: string;
}

function TradeJournal() {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [currentEntry, setCurrentEntry] = useState<JournalEntry | null>(null);
    const [missedOpportunities, setMissedOpportunities] = useState<MissedOpportunity[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showMissedTradeModal, setShowMissedTradeModal] = useState(false);
    const [selectedMissedTrade, setSelectedMissedTrade] = useState<MissedOpportunity | null>(null);

    useEffect(() => {
        fetchJournalData();
    }, []);

    useEffect(() => {
        fetchEntryForDate(selectedDate);
    }, [selectedDate]);

    const fetchJournalData = async () => {
        try {
            setIsLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                toast.error('Please log in to view journal');
                return;
            }

            const { data, error } = await supabase
                .from('trade_journal')
                .select('*')
                .eq('user_id', user.id);

            if (error) throw error;
            setEntries(data || []);
        } catch (error) {
            console.error('Error fetching journal data:', error);
            toast.error('Failed to fetch journal entries');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchEntryForDate = async (date: Date) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const dateStr = format(date, 'yyyy-MM-dd');

            // Fetch journal entry
            const { data: entryData, error: entryError } = await supabase
                .from('trade_journal')
                .select('*')
                .eq('user_id', user.id)
                .eq('date', dateStr)
                .single();

            if (entryError && entryError.code !== 'PGRST116') {
                throw entryError;
            }

            // Fetch missed opportunities
            const { data: missedData, error: missedError } = await supabase
                .from('missed_opportunities')
                .select('*')
                .eq('user_id', user.id)
                .eq('date', dateStr);

            if (missedError) throw missedError;

            setCurrentEntry(entryData || null);
            setMissedOpportunities(missedData || []);
        } catch (error) {
            console.error('Error fetching data for date:', error);
            toast.error('Failed to fetch data for selected date');
        }
    };

    const handleJournalEntry = async (field: string, value: string) => {
        // First update the local state immediately for responsive UI
        setCurrentEntry(prev => ({
            ...prev,
            [field]: value,
            updated_at: new Date().toISOString()
        }));

        // Then save to database with debounce
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const updates = {
                user_id: user.id,
                date: format(selectedDate, 'yyyy-MM-dd'),
                [field]: value,
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase
                .from('trade_journal')
                .upsert(updates, {
                    onConflict: 'user_id,date'
                });

            if (error) throw error;
        } catch (error) {
            console.error('Error saving journal entry:', error);
            toast.error('Failed to save journal entry');
        }
    };

    const saveJournalEntry = async (updates: Partial<JournalEntry>) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                toast.error('Please log in to save journal');
                return;
            }

            const dateStr = format(selectedDate, 'yyyy-MM-dd');
            const entry = {
                user_id: user.id,
                date: dateStr,
                ...updates
            };

            const { error } = await supabase
                .from('trade_journal')
                .upsert([entry], {
                    onConflict: 'user_id,date'
                });

            if (error) throw error;
            await fetchJournalData();
            await fetchEntryForDate(selectedDate);
            toast.success('Journal entry saved');
        } catch (error) {
            console.error('Error saving journal:', error);
            toast.error('Failed to save journal entry');
        }
    };

    const RatingSelector = ({ value, onChange }: { value: number; onChange: (val: number) => void }) => (
        <div className="rating rating-md">
            {[1, 2, 3, 4, 5].map((rating) => (
                <input
                    key={rating}
                    type="radio"
                    name="rating-2"
                    className={`mask mask-star-2 ${rating <= 3 ? 'bg-orange-400' : 'bg-green-400'}`}
                    checked={value === rating}
                    onChange={() => onChange(rating)}
                />
            ))}
        </div>
    );

    const memoizedTradingView = useMemo(() => (
        <TradingViewWidget symbol="NASDAQ:QQQ" studies={['STD;EMA']} />
    ), []);

    return (
        <div className="flex flex-col space-y-6">
            {/* Top Row - Calendar and Chart */}
            <div className="grid grid-cols-12 gap-6">
                {/* Calendar */}
                <div className="card col-span-5 bg-base-100 shadow-xl rounded-lg hover:shadow-lg hover:shadow-primary/10">
                    <TitleCard 
                        title="Trading Calendar" 
                        topMargin="mt-0"
                        TopSideButtons={<div></div>}
                    >
                        <JournalCalendar
                            entries={entries}
                            selectedDate={selectedDate}
                            onDateSelect={setSelectedDate}
                        />
                    </TitleCard>
                </div>

                {/* Chart */}
                <div className="card col-span-7 bg-base-100 shadow-xl rounded-lg hover:shadow-lg hover:shadow-primary/10">
                    <TitleCard 
                        title="Market Overview - QQQ" 
                        topMargin="mt-0"
                        TopSideButtons={<div></div>}
                    >
                        <div className="w-full h-[450px] rounded-lg overflow-hidden">
                            {memoizedTradingView}
                        </div>
                    </TitleCard>
                </div>
            </div>

            {/* Bottom Row - Journal Entry and Missed Trades */}
            <div className="grid grid-cols-12 gap-6">
                {/* Journal Entry */}
                <div className="card col-span-6 bg-base-100 shadow-xl rounded-lg hover:shadow-lg hover:shadow-primary/10">
                    <TitleCard 
                        title={`Journal Entry - ${format(selectedDate, 'MMMM d, yyyy')}`}
                        topMargin="mt-0"
                        TopSideButtons={
                            <div className="text-sm text-base-content/60">
                                Last updated: {currentEntry?.updated_at ? format(new Date(currentEntry.updated_at), 'h:mm a') : 'Not saved yet'}
                            </div>
                        }
                    >
                        <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                            {/* Market Summary */}
                            <div className="form-control w-full">
                                <label className="label">
                                    <span className="label-text font-medium text-lg">Market Summary</span>
                                    <span className="label-text-alt text-base-content/60">
                                        Document significant market moves and sector rotations
                                    </span>
                                </label>
                                <textarea
                                    className="textarea textarea-bordered min-h-[100px] w-full focus:textarea-primary
                                        bg-base-200/50 text-base
                                        transition-all duration-200 ease-in-out
                                        hover:shadow-md hover:border-primary/50
                                        focus:shadow-lg focus:shadow-primary/20
                                        focus:bg-base-100"
                                    placeholder="Note down important market events, trends, and observations..."
                                    value={currentEntry?.market_summary || ''}
                                    onChange={(e) => handleJournalEntry('market_summary', e.target.value)}
                                />
                            </div>

                            {/* Daily Reflection */}
                            <div className="form-control w-full">
                                <label className="label">
                                    <span className="label-text font-medium text-lg">Trading Reflection</span>
                                    <span className="label-text-alt text-base-content/60">
                                        What went well? What could be improved?
                                    </span>
                                </label>
                                <textarea
                                    className="textarea textarea-bordered min-h-[200px] w-full focus:textarea-primary
                                        bg-base-200/50 text-base
                                        transition-all duration-200 ease-in-out
                                        hover:shadow-md hover:border-primary/50
                                        focus:shadow-lg focus:shadow-primary/20
                                        focus:bg-base-100"
                                    placeholder="Reflect on your trading decisions, emotions, and execution..."
                                    value={currentEntry?.reflection || ''}
                                    onChange={(e) => handleJournalEntry('reflection', e.target.value)}
                                />
                            </div>

                            {/* Lessons Learned */}
                            <div className="form-control w-full">
                                <label className="label">
                                    <span className="label-text font-medium text-lg">Key Lessons</span>
                                    <span className="label-text-alt text-base-content/60">
                                        What did you learn today?
                                    </span>
                                </label>
                                <textarea
                                    className="textarea textarea-bordered min-h-[100px] w-full focus:textarea-primary
                                        bg-base-200/50 text-base
                                        transition-all duration-200 ease-in-out
                                        hover:shadow-md hover:border-primary/50
                                        focus:shadow-lg focus:shadow-primary/20
                                        focus:bg-base-100"
                                    placeholder="Document key lessons and insights from today's trading..."
                                    value={currentEntry?.lessons_learned || ''}
                                    onChange={(e) => handleJournalEntry('lessons_learned', e.target.value)}
                                />
                            </div>
                        </form>
                    </TitleCard>
                </div>

                {/* Missed Opportunities */}
                <div className="col-span-12 rounded-lg lg:col-span-6">
                    <TitleCard 
                        title="Missed Opportunities"
                        topMargin="mt-0"
                        TopSideButtons={
                            <button
                                className="btn btn-primary btn-sm gap-2"
                                onClick={() => setShowMissedTradeModal(true)}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                </svg>
                                Add Trade
                            </button>
                        }
                    >
                        <div className="overflow-x-auto bg-base-200/50 rounded-lg p-4">
                            <table className="table table-sm w-full">
                                <thead className="bg-base-100/50">
                                    <tr>
                                        <th className="font-bold">Ticker</th>
                                        <th className="font-bold">Setup</th>
                                        <th className="font-bold">Entry</th>
                                        <th className="font-bold">Target</th>
                                        <th className="font-bold">Stop</th>
                                        <th className="font-bold">R</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {missedOpportunities.map((trade) => (
                                        <tr key={trade.id} className="hover:bg-base-100 transition-colors duration-150">
                                            <td className="font-medium text-primary">{trade.ticker}</td>
                                            <td>{trade.setup_type}</td>
                                            <td>${trade.entry_price.toFixed(2)}</td>
                                            <td>${trade.target_price.toFixed(2)}</td>
                                            <td>${trade.stop_price.toFixed(2)}</td>
                                            <td className="font-medium text-accent">${trade.potential_reward.toFixed(2)}</td>
                                            <td>
                                                <button
                                                    className="btn btn-ghost btn-xs"
                                                    onClick={() => {
                                                        setSelectedMissedTrade(trade);
                                                        setShowMissedTradeModal(true);
                                                    }}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                                    </svg>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {missedOpportunities.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="text-center text-base-content/60 py-8">
                                                No missed opportunities recorded
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </TitleCard>
                </div>
            </div>

            {/* Missed Trade Modal */}
            {showMissedTradeModal && (
                <MissedTradeModal
                    isOpen={showMissedTradeModal}
                    onClose={() => setShowMissedTradeModal(false)}
                    selectedDate={selectedDate}
                    selectedTrade={selectedMissedTrade}
                    onSave={() => {
                        fetchEntryForDate(selectedDate);
                    }}
                />
            )}
        </div>
    );
}

export default TradeJournal;
