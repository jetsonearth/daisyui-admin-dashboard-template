import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../config/supabaseClient'
import TitleCard from '../../components/Cards/TitleCard'
import { TRADE_STATUS, ASSET_TYPES, DIRECTIONS, STRATEGIES } from '../../features/trades/tradeModel'
import { metricsService } from '../../features/metrics/metricsService';
import { toast } from 'react-toastify'
import TradeHistoryModal from '../../features/user/components/TradeHistory/TradeHistoryModal'; // Import the modal
import './TradeLog.css';

function TradeLog(){
    const [isModalOpen, setIsModalOpen] = useState(false);

    const navigate = useNavigate()
    const [trades, setTrades] = useState([])
    const [loading, setLoading] = useState(true)
    const [isAutoRefresh, setIsAutoRefresh] = useState(true)
    const [lastUpdate, setLastUpdate] = useState(null)
    const [isManualRefreshing, setIsManualRefreshing] = useState(false);
    const [selectedTrade, setSelectedTrade] = useState(null);

    // Function to handle opening the modal
    const openModal = () => {
        setIsModalOpen(true);
    };

    // Function to handle closing the modal
    const closeModal = () => {
        setIsModalOpen(false);
    };

    // Keep your existing helper functions
    const safeToFixed = (number, decimals = 2) => {
        if (number === undefined || number === null) return '0.00';
        return Number(number).toFixed(decimals);
    };

    const formatCurrency = (amount) => {
        if (amount === undefined || amount === null) return '$0.00';
        return `$${safeToFixed(amount)}`;
    };

    // Fetch trades from Supabase
    const fetchTrades = async () => {
        try {
            const { data: { user }, error: userError } = await supabase.auth.getUser()
            
            if (userError || !user) {
                toast.error('Please log in to view trades')
                setLoading(false)
                return
            }

            const { data, error } = await supabase
                .from('trades')
                .select('*')
                .eq('user_id', user.id)
                .order('entry_datetime', { ascending: false })

            console.log('Fetched trades:', data) // Debug log

            if (error) throw error

            setTrades(data)
            setLoading(false)
        } catch (err) {
            console.error('Error fetching trades:', err)
            toast.error('Failed to load trades')
            setLoading(false)
        }
    }

    // Modified updateMarketData to work with Supabase data

    const updateMarketData = async () => {
        console.log('🔄 Starting market data update. Current trades:', trades.length);
        try {
            const activeTrades = trades.filter(trade => 
                trade.status !== TRADE_STATUS.CLOSED
            );
    
            console.log(`🔍 Filtering active trades. Total: ${trades.length}, Active: ${activeTrades.length}`);
    
            if (activeTrades.length === 0) {
                console.log('🚫 No active trades to update');
                return;
            }
    
            const updatedTrades = await metricsService.updateTradesWithDetailedMetrics(activeTrades);

            console.log('🎯 Updated Trades:', updatedTrades.map(trade => ({
                ticker: trade.ticker,
                unrealized_pnl: trade.unrealized_pnl,
                realized_pnl: trade.realized_pnl,
                total_shares: trade.total_shares,
                risk_reward_ratio: trade.risk_reward_ratio,
                openRisk: trade.open_risk
            })));
    
            // Continue with Supabase update for active trades
            const currentTimestamp = new Date().toISOString();
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError) {
                throw new Error(`Auth error: ${userError.message}`);
            }
    
            for (const trade of updatedTrades) {
                if (trade.status === TRADE_STATUS.CLOSED) {
                    console.log(`🚫 Skipping Supabase update for closed trade: ${trade.ticker}`);
                    continue;
                }
    
                console.log(`Trade ${trade.ticker} update details:`, {
                    unrealized_pnl: trade.unrealized_pnl,
                    unrealized_pnl_percentage: trade.unrealized_pnl_percentage,
                    realized_pnl: trade.realized_pnl,
                    realized_pnl_percentage: trade.realized_pnl_percentage,
                    total_shares: trade.total_shares,
                    entry_price: trade.entry_price
                });
    
                const { data, error } = await supabase
                    .from('trades')
                    .update({
                        last_price: trade.last_price,
                        market_value: trade.market_value,
                        unrealized_pnl: trade.unrealized_pnl,
                        unrealized_pnl_percentage: trade.unrealized_pnl_percentage,
                        risk_reward_ratio: trade.risk_reward_ratio,
                        mae: trade.mae,
                        mfe: trade.mfe,
                        portfolio_impact: trade.portfolio_impact,
                        portfolio_weight: trade.weight_percentage,
                        trimmed_percentage: trade.trimmed_percentage,
                        realized_pnl: trade.realized_pnl,
                        realized_pnl_percentage: trade.realized_pnl_percentage,
                        updated_at: currentTimestamp
                    })
                    .eq('id', trade.id)
                    .eq('user_id', user.id)
                    .select();
    
                console.log(`Supabase update result for ${trade.ticker}:`, { data, error });
            }
        } catch (error) {
            console.error('❌ Full error in updateMarketData:', error);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
        }
    };
    
    // Auto-refresh logic
    useEffect(() => {
        let intervalId;
        if (isAutoRefresh) {
            const fetchData = async () => {
                await updateMarketData(); // Fetch market data
                const updatedTrades = await metricsService.updateTradesWithDetailedMetrics(trades); // Compute metrics
                setTrades(updatedTrades); // Update state with new trades
            };
    
            fetchData(); // Initial fetch
            intervalId = setInterval(fetchData, 1800000); // 30 minutes
        }
        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [isAutoRefresh]); // Keep only isAutoRefresh in dependencies

    // const updateMarketData = async () => {
    //     console.log('🔄 Starting market data update. Current trades:', trades.length);
    //     try {
    //         // Filter out closed trades before updating
    //         const activeTrades = trades.filter(trade => 
    //             trade.status !== TRADE_STATUS.CLOSED
    //         );

    //         console.log(`🔍 Filtering active trades. Total: ${trades.length}, Active: ${activeTrades.length}`);

    //         // If no active trades, skip update
    //         if (activeTrades.length === 0) {
    //             console.log('🚫 No active trades to update');
    //             return;
    //         }


    //         const updatedTrades = await metricsService.updateTradesWithDetailedMetrics(activeTrades);
                

    //         console.log('🎯 Updated Trades:', updatedTrades.map(trade => ({
    //             ticker: trade.ticker,
    //             unrealized_pnl: trade.unrealized_pnl,
    //             realized_pnl: trade.realized_pnl,
    //             total_shares: trade.total_shares,
    //             risk_reward_ratio: trade.risk_reward_ratio,
    //             openRisk: trade.open_risk
    //         })));

            
    //         if (updatedTrades && updatedTrades.length > 0) {
    //             // Merge updated trades with original trades, keeping closed trades unchanged
    //             const mergedTrades = trades.map(originalTrade => {
    //                 const updatedTrade = updatedTrades.find(ut => ut.id === originalTrade.id);
                    
    //                 // If trade is closed, return original trade
    //                 if (
    //                     originalTrade.status === TRADE_STATUS.CLOSED 
    //                 ) {
    //                     console.log(`🔒 Skipping update for closed trade: ${originalTrade.ticker}`);
    //                     return originalTrade;
    //                 }

    //                 // If updatedTrade exists, merge with original trade, preserving open_risk
    //                 if (updatedTrade) {
    //                     return {
    //                         ...updatedTrade,
    //                         open_risk: originalTrade.open_risk
    //                     };
    //                 }                
    //             });

    //             // Update trades state with merged trades
    //             setTrades(mergedTrades);

    //             // Continue with Supabase update for active trades
    //             const currentTimestamp = new Date().toISOString();
                
    //             const { data: { user }, error: userError } = await supabase.auth.getUser();
    //             if (userError) {
    //                 throw new Error(`Auth error: ${userError.message}`);
    //             }
    
    //             for (const trade of updatedTrades) {
    //                 // Skip updates for closed trades
    //                 if (
    //                     trade.status === TRADE_STATUS.CLOSED
    //                 ) {
    //                     console.log(`🚫 Skipping Supabase update for closed trade: ${trade.ticker}`);
    //                     continue;
    //                 }

    //                 console.log(`Trade ${trade.ticker} update details:`, {
    //                     unrealized_pnl: trade.unrealized_pnl,
    //                     unrealized_pnl_percentage: trade.unrealized_pnl_percentage,
    //                     realized_pnl: trade.realized_pnl,
    //                     realized_pnl_percentage: trade.realized_pnl_percentage,
    //                     total_shares: trade.total_shares,
    //                     entry_price: trade.entry_price
    //                 });

    //                 const { data, error } = await supabase
    //                     .from('trades')
    //                     .update({
    //                         last_price: trade.last_price,
    //                         market_value: trade.market_value,
    //                         unrealized_pnl: trade.unrealized_pnl,
    //                         unrealized_pnl_percentage: trade.unrealized_pnl_percentage,
    //                         risk_reward_ratio: trade.risk_reward_ratio,
    //                         mae: trade.mae,
    //                         mfe: trade.mfe,
    //                         portfolio_impact: trade.portfolio_impact,
    //                         portfolio_weight: trade.weight_percentage,
    //                         trimmed_percentage: trade.trimmed_percentage,
    //                         realized_pnl: trade.realized_pnl,
    //                         realized_pnl_percentage: trade.realized_pnl_percentage,
    //                         updated_at: currentTimestamp
    //                     })
    //                     .eq('id', trade.id)
    //                     .eq('user_id', user.id)
    //                     .select();

    //                 console.log(`Supabase update result for ${trade.ticker}:`, { data, error });
    //             }
    //         } else {
    //             console.warn('🚨 No trades returned from market data update');
    //         }
    //     } catch (error) {
    //         console.error('❌ Full error in updateMarketData:', error);
    //         console.error('Error message:', error.message);
    //         console.error('Error stack:', error.stack);
    //     }
    // };

    // // Keep your existing useEffect for auto-refresh
    // useEffect(() => {
    //     let intervalId;
    //     if (isAutoRefresh) {
    //         const fetchData = async () => {
    //             await updateMarketData(); // Fetch market data
    //             const updatedTrades = await metricsService.updateTradesWithDetailedMetrics(trades); // Compute metrics
    //             setTrades(updatedTrades); // Update state with new trades
    //         };
    
    //         fetchData(); // Initial fetch
    //         intervalId = setInterval(fetchData, 1800000); // 30 minutes
    //     }
    //     return () => {
    //         if (intervalId) clearInterval(intervalId);
    //     };
    // }, [isAutoRefresh]); // Remove trades from dependencies


    // Add useEffect for initial data fetch
    useEffect(() => {
        fetchTrades()
    }, [])

    // Keep your existing UI handlers
    const toggleAutoRefresh = () => {
        setIsAutoRefresh(!isAutoRefresh);
    };

    const handleRefreshNow = async () => {
        try {
            // Set manual refresh state to true
            setIsManualRefreshing(true);
            
            // Call update market data
            await updateMarketData();

            // After updating market data, compute trade-level metrics
            const updatedTrades = await metricsService.updateTradesWithDetailedMetrics(trades);
            
            // Update state with the newly computed trades
            setTrades(updatedTrades);

        } catch (error) {
            console.error('Manual refresh error:', error);
            toast.error('Failed to refresh market data');
        } finally {
            // Always reset manual refresh state
            setIsManualRefreshing(false);
        }
    };

    const handleReset = () => {
        fetchTrades(); // Modified to fetch from Supabase
        setIsAutoRefresh(true);
        setLastUpdate(null);
    };


    return (
        <div className="p-4">
            <TitleCard title="Trade Log" topMargin="mt-2">
                <div className="flex flex-col">
                <div className="flex items-center gap-6 mb-5">
                        <button 
                            onClick={openModal} 
                            className="btn btn-secondary"
                        >
                            🌟 Log Historical Trades
                        </button>
                        {/* Auto-refresh Button */}
                        <button 
                            onClick={toggleAutoRefresh}
                            className={`btn ${isAutoRefresh ? 'btn-error' : 'btn-success'}`}
                        >
                            {isAutoRefresh ? 'Stop Auto-Sync' : 'Start Auto-Sync'}
                        </button>
                        <button 
                            onClick={handleRefreshNow}
                            className={`btn btn-primary ${isManualRefreshing ? 'loading' : ''}`}
                        >
                            {isManualRefreshing ? 'Refreshing...' : 'Sync Now'}
                        </button>

                        {/* Last Updated Text */}
                        {lastUpdate && (
                            <div className="text-xs text-gray-500 ml-2 mt-1">
                                Last updated at {lastUpdate}
                            </div>
                        )}

                        {/* New Reset Button */}
                        {/* <button 
                            onClick={handleReset}
                            className="btn btn-secondary"
                        >
                            Reset
                        </button> */}

                        <span className="text-gray-400">
                            Auto-syncing real-time market data every 30 minutes
                        </span>
                        {lastUpdate && (
                            <span className="text-gray-400">
                                Last update: {lastUpdate}
                            </span>
                        )}
                    </div>

                    {loading ? (
                        <div className="text-center py-10">
                            <span className="loading loading-spinner loading-lg"></span>
                            <p>Loading trades...</p>
                        </div>
                    ) : trades.length === 0 ? (
                        <div className="text-center py-10 text-gray-500">
                            <div className="mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-semibold mb-2">No Trades Recorded</h3>
                            <p className="text-gray-400 mb-6">Start tracking your trading journey by adding your first trade.</p>
                            <button 
                                onClick={() => navigate('/app/planner')}  
                                className="btn btn-primary"
                            >
                                Add First Trade
                            </button>
                        </div>
                    ) : (
                            <div className="overflow-x-auto w-full">
                                <table className="table table-s table-zebra table-pin-rows">
                                    <thead>
                                        <tr>
                                            <th className="text-center w-20">Ticker</th>
                                            <th className="text-center w-24">Type</th>
                                            <th className="text-center w-24">Direction</th>
                                            <th className="text-center w-20">Status</th>
                                            <th className="text-center w-32">Entry Date</th>
                                            <th className="text-center w-28">Avg Cost</th>
                                            <th className="text-center w-28">Current Price</th>
                                            <th className="text-center w-24">Total Shares</th>
                                            <th className="text-center w-24">Remaining Shares</th>
                                            <th className="text-center w-32">Total Cost</th>
                                            <th className="text-center w-32">Market Value</th>
                                            <th className="text-center w-20">Weight %</th>
                                            <th className="text-center w-24">Trimmed %</th>
                                            <th className="text-center whitespace-normal min-w-[80px]">Strategy</th>
                                            <th className="text-center whitespace-normal min-w-[120px]">Setups</th>
                                            <th className="text-center w-24">33% SL</th>
                                            <th className="text-center w-24">66% SL</th>
                                            <th className="text-center w-24">Final SL</th>
                                            <th className="text-center w-28">Unrealized PnL%</th>
                                            <th className="text-center w-28">Unrealized PnL</th>
                                            <th className="text-center w-28">Realized PnL%</th>
                                            <th className="text-center w-28">Realized PnL</th>
                                            <th className="text-center w-20">RRR</th>
                                            <th className="text-center w-24">Open Risk</th>
                                            <th className="text-center w-24">Portfolio Heat</th>
                                            <th className="text-center w-32">Portfolio Impact</th>
                                            <th className="text-center w-20">MAE</th>
                                            <th className="text-center w-20">MFE</th>
                                            <th className="text-center w-32">Exit Date</th>
                                            <th className="text-center w-24">Commission</th>
                                            <th className="text-center w-32">Holding Period</th>
                                            <th className="text-center w-32">Mistakes</th>
                                            <th className="text-center w-32">Notes</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {trades && trades.map((trade, k) => (
                                            <tr 
                                                key={trade.id} 
                                                className="hover cursor-pointer"
                                                onClick={() => setSelectedTrade(trade)}
                                            >
                                                <td className="text-center font-medium">{trade.ticker || 'N/A'}</td>
                                                <td className="text-center">{trade.asset_type || 'N/A'}</td>
                                                <td className="text-center">
                                                    <span className={`
                                                        badge badge-pill 
                                                        ${trade.direction === DIRECTIONS.LONG ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}
                                                    `}>
                                                        {trade.direction || 'N/A'}
                                                    </span>
                                                </td>
                                                <td className="text-center">
                                                    <span className={`
                                                        badge badge-pill 
                                                        ${trade.status === TRADE_STATUS.OPEN ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-black'}
                                                    `}>
                                                        {trade.status || 'N/A'}
                                                    </span>
                                                </td>
                                                <td className="text-center whitespace-nowrap">
                                                    {trade.entry_datetime ? new Date(trade.entry_datetime).toISOString().split('T')[0] : ''}
                                                </td>
                                                <td className="text-center">{formatCurrency(trade.entry_price)}</td>
                                                <td className="text-center font-medium">{formatCurrency(trade.last_price)}</td>
                                                <td className="text-center">{safeToFixed(trade.total_shares)}</td>
                                                <td className="text-center">{safeToFixed(trade.remaining_shares)}</td>
                                                <td className="text-center">{formatCurrency(trade.total_cost)}</td>
                                                <td className="text-center">{formatCurrency(trade.market_value)}</td>
                                                <td className="text-center">{safeToFixed(trade.portfolio_weight)}%</td>
                                                <td className="text-center">{safeToFixed(trade.trimmed_percentage)}%</td>
                                                <td className="text-center">
                                                    {trade.strategy ? (
                                                        <span className="badge badge-pill bg-purple-500 text-white">
                                                            {trade.strategy}
                                                        </span>
                                                    ) : 'N/A'}
                                                </td>
                                                <td className="text-center">
                                                    {trade.setups ? (
                                                        <div className="flex flex-wrap gap-1 justify-center">
                                                            {trade.setups.map((setup, index) => (
                                                                <span 
                                                                    key={index} 
                                                                    className="badge badge-pill bg-indigo-500 text-white"
                                                                >
                                                                    {setup}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : 'N/A'}
                                                </td>
                                                <td className="text-center">{formatCurrency(trade.stop_loss_33_percent)}</td>
                                                <td className="text-center">{formatCurrency(trade.stop_loss_66_percent)}</td>
                                                <td className="text-center">{formatCurrency(trade.stop_loss_price)}</td>

                                                {/* Numeric columns with color coding */}
                                                <td className={`
                                                    text-center font-semibold tabular-nums
                                                    ${trade.unrealized_pnl_percentage > 0 ? 'text-emerald-400' : 'text-rose-400'}
                                                `}>
                                                    {trade.unrealized_pnl_percentage > 0 ? '+' : ''}{safeToFixed(trade.unrealized_pnl_percentage)}%
                                                </td>
                                                <td className={`
                                                    text-center font-semibold tabular-nums
                                                    ${trade.unrealized_pnl > 0 ? 'text-emerald-400' : 'text-rose-400'}
                                                `}>
                                                    {trade.unrealized_pnl > 0 ? '+' : ''}{formatCurrency(trade.unrealized_pnl)}
                                                </td>
                                                <td className={`
                                                    text-center font-semibold tabular-nums
                                                    ${trade.realized_pnl_percentage > 0 ? 'text-emerald-400' : 'text-rose-400'}
                                                `}>
                                                    {trade.realized_pnl_percentage > 0 ? '+' : ''}{safeToFixed(trade.realized_pnl_percentage)}%
                                                </td>
                                                <td className={`
                                                    text-center font-semibold tabular-nums
                                                    ${trade.realized_pnl > 0 ? 'text-emerald-400' : 'text-rose-400'}
                                                `}>
                                                    {trade.realized_pnl > 0 ? '+' : ''}{formatCurrency(trade.realized_pnl)}
                                                </td>
                                                <td className={`
                                                    text-center font-semibold tabular-nums
                                                    ${trade.risk_reward_ratio > 1 ? 'text-emerald-400' : 'text-rose-400'}
                                                `}>
                                                    {safeToFixed(trade.risk_reward_ratio, 1)}
                                                </td>
                                                <td className={`
                                                    text-center font-semibold tabular-nums
                                                    ${trade.open_risk > 0 ? 'text-rose-400' : 'text-emerald-400'}
                                                `}>
                                                    {safeToFixed(trade.open_risk, 1)}%
                                                </td>
                                                <td className={`
                                                    text-center font-semibold tabular-nums
                                                    ${trade.portfolio_heat > 0 ? 'text-rose-400' : 'text-emerald-400'}
                                                `}>
                                                    {safeToFixed(trade.portfolio_heat, 3)}%
                                                </td>
                                                <td className={`
                                                    text-center font-semibold tabular-nums
                                                    ${trade.portfolio_impact > 0 ? 'text-emerald-400' : 'text-rose-400'}
                                                `}>
                                                    {trade.portfolio_impact > 0 ? '+' : ''}{safeToFixed(trade.portfolio_impact, 1)}%
                                                </td>
                                                <td className="text-center font-semibold tabular-nums text-rose-400">
                                                    {safeToFixed(trade.mae, 1)}%
                                                </td>
                                                <td className="text-center font-semibold tabular-nums text-emerald-400">
                                                    {safeToFixed(trade.mfe, 1)}%
                                                </td>
                                                <td className="text-center">{trade.exit_date || 'N/A'}</td>
                                                <td className="text-center">{formatCurrency(trade.commission)}</td>
                                                <td className="text-center">{trade.holding_period || 'N/A'}</td>
                                                <td className="text-center">{trade.mistakes || 'N/A'}</td>
                                                <td className="text-center">{trade.notes || 'N/A'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                    )}
                </div>

                <TradeHistoryModal 
                    isOpen={isModalOpen}
                    onClose={closeModal}
                    onTradeAdded={() => {
                        fetchTrades(); // Refresh the trades list
                    }}
                />
            </TitleCard>

            {/* {selectedTrade && (
                <TradeManager
                    trade={selectedTrade}
                    onClose={() => setSelectedTrade(null)}
                    onUpdate={fetchTrades}
                />
            )} */}
        </div>
    )
}

export default TradeLog
