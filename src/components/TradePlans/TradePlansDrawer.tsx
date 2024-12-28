import React from 'react';
import { WatchlistTrade } from '../../types';
import { supabase } from '../../config/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { DIRECTIONS } from '../../types';

interface TradePlansDrawerProps {
    showWatchlist: boolean;
    setShowWatchlist: (show: boolean) => void;
    plannedTrades: WatchlistTrade[];
    onTradesUpdate: (trades: WatchlistTrade[]) => void;
}

const TradePlansDrawer: React.FC<TradePlansDrawerProps> = ({
    showWatchlist,
    setShowWatchlist,
    plannedTrades,
    onTradesUpdate
}) => {
    const navigate = useNavigate();
    
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString();
    };

    const handleDeleteTrade = async (tradeId: string) => {
        try {
            const { error } = await supabase
                .from('trades')
                .delete()
                .eq('id', tradeId);

            if (error) throw error;

            // Update local state
            const updatedTrades = plannedTrades.filter(trade => trade.id !== tradeId);
            onTradesUpdate(updatedTrades);
        } catch (error) {
            console.error('Error deleting trade:', error);
        }
    };

    const handleLoadTrade = (trade: WatchlistTrade) => {
        console.log('Loading trade:', trade);
        const state = {
            ticker: trade.ticker,
            direction: trade.direction,
            entryPrice: trade.entry_price?.toString(),
            atr: trade.atr?.toString(),
            lowOfDay: trade.lod?.toString(),
            positionRisk: trade.initial_position_risk?.toString(),
            strategy: trade.strategy || '',
            setups: trade.setups || [],
            notes: trade.notes || ''
        };
        console.log('Navigation state:', state);
        navigate('/app/planner', { state, replace: true });
        setShowWatchlist(false); // Close the drawer after loading
    };

    return (
        <div className="drawer drawer-end z-50">
            <input 
                id="watchlist-drawer" 
                type="checkbox" 
                className="drawer-toggle" 
                checked={showWatchlist}
                onChange={(e) => setShowWatchlist(e.target.checked)}
            />
            <div className="drawer-side">
                <label htmlFor="watchlist-drawer" className="drawer-overlay"></label>
                <div className="p-6 w-[420px] min-h-full bg-base-100">
                    {/* Header */}
                    <div className="relative mb-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-bold">Trade Plans</h2>
                                <p className="text-base-content/60 text-sm mt-1">Track and manage your planned trades</p>
                            </div>
                            <label htmlFor="watchlist-drawer" className="btn btn-ghost btn-sm">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </label>
                        </div>
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 overflow-y-auto space-y-3">
                        {plannedTrades.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-base-content/60">
                                <div className="w-16 h-16 mb-4 rounded-xl bg-base-200 flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                </div>
                                <p className="text-lg font-medium">No trade ideas yet</p>
                                <p className="text-sm opacity-75 mb-4">Start planning your next trade</p>
                                <button 
                                    onClick={() => {
                                        navigate('/app/planner');
                                        setShowWatchlist(false);
                                    }}
                                    className="btn btn-primary btn-sm gap-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                    </svg>
                                    Plan New Trade
                                </button>
                            </div>
                        ) : (
                            plannedTrades.map((trade) => (
                                <div key={trade.id} className="collapse collapse-arrow bg-base-200 hover:bg-base-200/70 transition-colors duration-200 rounded-xl">
                                    <input type="checkbox" className="peer" /> 
                                    <div className="collapse-title py-4 px-5">
                                        {/* Trade Header */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`px-2.5 py-1 rounded-lg text-sm font-medium ${
                                                    trade.direction === DIRECTIONS.LONG 
                                                    ? 'bg-emerald-400/10 text-emerald-400'
                                                    : 'bg-rose-400/10 text-rose-400'
                                                }`}>
                                                    {trade.direction}
                                                </div>
                                                <span className="text-xl font-bold">{trade.ticker}</span>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-4 mt-3 text-sm text-base-content/60">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{trade.strategy === 'None' ? 'No Strategy' : trade.strategy}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span>{formatDate(trade.created_at!)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="collapse-content px-5">
                                        <div className="pt-2 pb-4 space-y-4">
                                            {/* Position Details */}
                                            <div className="grid grid-cols-3 gap-3">
                                                <div className="bg-base-100 p-3 rounded-lg">
                                                    <div className="text-base-content/60 text-sm mb-1">Position Size</div>
                                                    <div className="font-semibold">{trade.total_shares?.toLocaleString()} shares</div>
                                                </div>
                                                <div className="bg-rose-400/10 p-3 rounded-lg">
                                                    <div className="text-base-content/60 text-sm mb-1">Risk Amount</div>
                                                    <div className="font-semibold text-rose-400">${trade.initial_risk_amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                                </div>
                                                <div className="bg-emerald-400/10 p-3 rounded-lg">
                                                    <div className="text-base-content/60 text-sm mb-1">2R Target</div>
                                                    <div className="font-semibold text-emerald-400">${trade.r_target_2?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                                </div>
                                            </div>

                                            {/* Notes */}
                                            {trade.notes && (
                                                <div className="bg-base-100 p-3 rounded-lg">
                                                    <div className="text-base-content/60 text-sm mb-2">Notes</div>
                                                    <div className="text-base-content/80 text-sm">
                                                        {trade.notes}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Action Buttons */}
                                            <div className="flex gap-3 pt-2">
                                                <button
                                                    className="btn btn-error btn-sm btn-outline flex-1 gap-2"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        handleDeleteTrade(trade.id!);
                                                    }}
                                                >
                                                    Delete
                                                </button>
                                                <button
                                                    className="btn btn-primary btn-sm flex-1 gap-2"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        handleLoadTrade(trade);
                                                    }}
                                                >
                                                    Load Trade
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TradePlansDrawer;
