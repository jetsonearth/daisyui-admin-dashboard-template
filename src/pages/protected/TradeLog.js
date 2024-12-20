import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../config/supabaseClient'
import TitleCard from '../../components/Cards/TitleCard'
import { Trade, TRADE_STATUS, DIRECTIONS, ASSET_TYPES, STRATEGIES, SETUPS } from '../../types/index'; 
import { metricsService } from '../../features/metrics/metricsService';
import { marketDataService } from '../../features/marketData/marketDataService';
import { toast } from 'react-toastify'
import TradeHistoryModal from '../../features/user/components/TradeHistory/TradeHistoryModal'; // Import the modal
import './TradeLog.css';

function TradeLog(){
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTrade, setSelectedTrade] = useState(null);

    const navigate = useNavigate()
    const [trades, setTrades] = useState([])
    const [initialLoading, setInitialLoading] = useState(true);
    const [updatingMarketData, setUpdatingMarketData] = useState(false);
    const [isAutoRefresh, setIsAutoRefresh] = useState(true)
    const [lastUpdate, setLastUpdate] = useState(null)
    const [isManualRefreshing, setIsManualRefreshing] = useState(false);

    // Fetch additional trade info when selectedTrade changes
    useEffect(() => {
        if (selectedTrade) {
            console.log('In Tradelog, 😎, Fetching selected trade info for', selectedTrade);
        }
    }, [selectedTrade]);

    const fetchTradeDetails = async (tradeId) => {
        try {
            const { data: trade, error } = await supabase
                .from('trades')
                .select(`
                    *,
                    action_types,
                    action_datetimes,
                    action_prices,
                    action_shares,
                    notes,
                    mistakes
                `)
                .eq('id', tradeId)
                .single();

            if (error) {
                console.error('Error fetching trade details:', error);
                toast.error('Failed to fetch trade details');
                return;
            }

            console.log('Fetched trade details:', trade);
            setSelectedTrade(trade);
            setIsModalOpen(true);
        } catch (error) {
            console.error('Error fetching trade details:', error);
            toast.error('Failed to fetch trade details');
        }
    };

    const handleTradeClick = (tradeId) => {
        console.log("Fetching trade with ID:", tradeId);
        fetchTradeDetails(tradeId);
    };

    // Function to open modal for new trade
    const openNewTradeModal = () => {
        setSelectedTrade(null);
        setIsModalOpen(true);
    };

    // Function to handle closing the modal
    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedTrade(null);
    };

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
            setInitialLoading(true);
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            
            if (userError || !user) {
                toast.error('Please log in to view trades');
                setInitialLoading(false);
                return;
            }
    
            const { data, error } = await supabase
                .from('trades')
                .select('*')
                .eq('user_id', user.id)
                .order('entry_datetime', { ascending: false });
    
            if (error) throw error;
    
            setTrades(data);
            setInitialLoading(false);
    
            // Call updateMarketData after setting trades
            await updateMarketData();
        } catch (err) {
            console.error('Error fetching trades:', err);
            toast.error('Failed to load trades');
            setInitialLoading(false);
        }
    };

    const updateMarketData = async () => {
        const activeTrades = trades.filter(trade => trade.status === TRADE_STATUS.OPEN);
        const closedTrades = trades.filter(trade => trade.status !== TRADE_STATUS.OPEN);
        
        if (!activeTrades || activeTrades.length === 0) {
            return trades;
        }

        try {
            setUpdatingMarketData(true);
            
            // Clear cache for closed trades to prevent them from showing up in logs
            await marketDataService.clearCacheForClosedTrades(trades);
            
            const quotes = await marketDataService.getBatchQuotes(activeTrades.map(trade => trade.ticker));
            
            // Update active trades with current market data
            const updatedActiveTrades = activeTrades.map(trade => {
                const quote = quotes[trade.ticker];
                if (!quote) {
                    console.warn(`No market data available for ${trade.ticker}`);
                    return trade;
                }
                
                return {
                    ...trade,
                    currentPrice: quote.price,
                    lastUpdate: quote.lastUpdate
                };
            });

            // Update only active trades with detailed metrics
            const tradesWithMetrics = await metricsService.updateTradesWithDetailedMetrics(quotes, updatedActiveTrades);
            
            // Combine updated active trades with unchanged closed trades
            const allUpdatedTrades = [...tradesWithMetrics, ...closedTrades];
            
            setTrades(allUpdatedTrades);
            setLastUpdate(new Date().toLocaleTimeString());
            return allUpdatedTrades;
            
        } catch (error) {
            console.error('Error updating market data:', error);
            toast.error(error.message || 'Failed to update market data');
            return trades;
        } finally {
            setUpdatingMarketData(false);
        }
    };

    // Auto-refresh logic
    useEffect(() => {
        let intervalId;
        if (isAutoRefresh) {
            const fetchData = async () => {
                const updatedTrades = await updateMarketData(); // Fetch market data
                setTrades(updatedTrades); // Update state with the new trades
            };
    
            fetchData(); // Initial fetch
            intervalId = setInterval(fetchData, 900000); // 30 minutes
        }
        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [isAutoRefresh]); // Keep only isAutoRefresh in dependencies

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
            
            // Call update market data and get the updated trades
            const updatedTrades = await updateMarketData(); // Fetch market data and return updated trades
            
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
                            onClick={openNewTradeModal} 
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
                            className={`btn btn-primary ${updatingMarketData ? 'loading' : ''}`}
                        >
                            {updatingMarketData ? 'Refreshing...' : 'Sync Now'}
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
                    </div>

                    {initialLoading ? (
                        <div className="w-full h-48 flex items-center justify-center">
                            <span className="loading loading-ring loading-lg"></span>
                            <span className="ml-4">Loading trades...</span>
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
                                        <th className="text-center whitespace-nowrap">Ticker</th>
                                        <th className="text-center whitespace-nowrap">Type</th>
                                        <th className="text-center whitespace-nowrap">Direction</th>
                                        <th className="text-center whitespace-nowrap">Status</th>
                                        <th className="text-center whitespace-nowrap">Entry Date</th>
                                        <th className="text-center whitespace-nowrap">Avg Cost</th>
                                        {/* <th className="text-center whitespace-nowrap">Exit Price</th> */}
                                        <th className="text-center whitespace-nowrap">Unrealized PnL%</th>
                                        <th className="text-center whitespace-nowrap">Unrealized PnL</th>
                                        <th className="text-center whitespace-nowrap">Realized PnL%</th>
                                        <th className="text-center whitespace-nowrap">Realized PnL</th>
                                        <th className="text-center whitespace-nowrap">RRR</th>
                                        <th className="text-center whitespace-nowrap">Current Price</th>
                                        <th className="text-center whitespace-nowrap">Strategy</th>
                                        <th className="text-center whitespace-nowrap">Setups</th>
                                        <th className="text-center whitespace-nowrap">33% SL</th>
                                        <th className="text-center whitespace-nowrap">66% SL</th>
                                        <th className="text-center whitespace-nowrap">Final SL</th>
                                        <th className="text-center whitespace-nowrap">Total Shares</th>
                                        <th className="text-center whitespace-nowrap">Remaining Shares</th>
                                        <th className="text-center whitespace-nowrap">Total Cost</th>
                                        <th className="text-center whitespace-nowrap">Market Value</th>
                                        <th className="text-center whitespace-nowrap">Weight %</th>
                                        <th className="text-center whitespace-nowrap">Trimmed %</th>
                                        <th className="text-center whitespace-nowrap">SL Distance</th>
                                        <th className="text-center whitespace-nowrap">Position Heat</th>
                                        <th className="text-center whitespace-nowrap">Portfolio Impact</th>
                                        <th className="text-center whitespace-nowrap">MAE</th>
                                        <th className="text-center whitespace-nowrap">MFE</th>
                                        <th className="text-center whitespace-nowrap">MAE $</th>
                                        <th className="text-center whitespace-nowrap">MFE $</th>
                                        <th className="text-center whitespace-nowrap">MAE-R</th>
                                        <th className="text-center whitespace-nowrap">MFE-R</th>
                                        <th className="text-center whitespace-nowrap">Exit Date</th>
                                        <th className="text-center whitespace-nowrap">Exit Price</th>
                                        <th className="text-center whitespace-nowrap">% From Entry</th>
                                        {/* <th className="text-center whitespace-nowrap">Commission</th> */}
                                        <th className="text-center whitespace-nowrap">Holding Period</th>
                                        {/* <th className="text-center whitespace-nowrap">Mistakes</th>
                                        <th className="text-center whitespace-nowrap">Notes</th> */}
                                        </tr>
                                    </thead>
                                    <tbody>
                                    {trades.map((trade) => {
                                        // Calculate profitability outside JSX
                                        const totalCost = trade.total_cost;
                                        const unrealizedPnL = trade.unrealized_pnl || 0;
                                        const realizedPnL = trade.realized_pnl || 0;
                                        const isProfitable = (totalCost + unrealizedPnL + realizedPnL) > totalCost;

                                        return (
                                            <tr 
                                                key={trade.id} 
                                                className="hover cursor-pointer"
                                                onClick={() => handleTradeClick(trade.id)}
                                            >
                                                <td className="text-center font-medium">
                                                    {trade.ticker || 'N/A'}
                                                    <span 
                                                        className={`indicator ${isProfitable ? 'bg-green-500' : 'bg-red-500'}`}
                                                        style={{ 
                                                            width: '12px', 
                                                            height: '12px', 
                                                            borderRadius: '50%', 
                                                            display: 'inline-block', 
                                                            marginLeft: '8px' 
                                                        }}
                                                    />
                                                </td>

                                                <td className="text-center">
                                                    {trade.asset_type || 'N/A'}
                                                </td>

                                                <td className="text-center">
                                                    <span className={`
                                                        badge badge-pill 
                                                        ${trade.direction === DIRECTIONS.LONG ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}
                                                    `}>
                                                        {trade.direction || 'N/A'}
                                                    </span>
                                                </td>

                                                {/* Status */}
                                                <td className="text-center">
                                                    <span className={`
                                                        badge badge-pill 
                                                        ${trade.status === TRADE_STATUS.OPEN ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-black'}
                                                    `}>
                                                        {trade.status || 'N/A'}
                                                    </span>
                                                </td>

                                                {/* Dates and Numbers */}
                                                <td className="text-center whitespace-nowrap">
                                                    {trade.entry_datetime ? 
                                                        new Date(trade.entry_datetime).toISOString().split('T')[0] : ''}
                                                </td>
                                                <td className="text-center">
                                                    {formatCurrency(trade.entry_price)}
                                                </td>

                                                {/* PnL and Metrics */}
                                                <td className={`
                                                    text-center font-semibold tabular-nums
                                                    ${trade.unrealized_pnl_percentage > 0 ? 'text-emerald-400' : 'text-rose-400'}
                                                `}>
                                                    {trade.unrealized_pnl === 0 ? (
                                                        <span className="text-white">-</span>
                                                    ) : (
                                                        <>
                                                            {trade.unrealized_pnl_percentage > 0 ? '+' : ''}
                                                            {safeToFixed(trade.unrealized_pnl_percentage)}%
                                                        </>
                                                    )}
                                                </td>
                                                
                                                <td className={`
                                                    text-center font-semibold tabular-nums
                                                    ${trade.unrealized_pnl > 0 ? 'text-emerald-400' : 'text-rose-400'}
                                                `}>
                                                    {trade.unrealized_pnl === 0 ? (
                                                        <span className="text-white">-</span>
                                                    ) : (
                                                        <>
                                                            {trade.unrealized_pnl > 0 ? '+' : ''}
                                                            {formatCurrency(trade.unrealized_pnl)}
                                                        </>
                                                    )}
                                                </td>

                                                <td className={`
                                                    text-center font-semibold tabular-nums
                                                    ${trade.realized_pnl_percentage > 0 ? 'text-emerald-400' : 'text-rose-400'}
                                                `}>
                                                    {trade.realized_pnl_percentage > 0 ? '+' : ''}
                                                    {safeToFixed(trade.realized_pnl_percentage)}%
                                                </td>

                                                <td className={`
                                                    text-center font-semibold tabular-nums
                                                    ${trade.realized_pnl > 0 ? 'text-emerald-400' : 'text-rose-400'}
                                                `}>
                                                    {trade.realized_pnl > 0 ? '+' : ''}
                                                    {formatCurrency(trade.realized_pnl)}
                                                </td>

                                                {/* Risk Metrics */}
                                                <td className={`
                                                    text-center font-semibold tabular-nums
                                                    ${trade.risk_reward_ratio > 1 ? 'text-emerald-400' : 'text-rose-400'}
                                                `}>
                                                    {safeToFixed(trade.risk_reward_ratio, 1)}
                                                </td>

                                                <td className="text-center font-medium">
                                                    {formatCurrency(trade.last_price)}
                                                </td>

                                                {/* Strategy and Setups */}
                                                <td className="text-center">
                                                    {trade.strategy ? (
                                                        <span className="badge badge-pill bg-purple-500 text-white">
                                                            {trade.strategy}
                                                        </span>
                                                    ) : 'N/A'}
                                                </td>
                                                <td className="text-center">
                                                    {trade.setups ? (
                                                        <div className="flex flex-nowrap gap-1 justify-center">
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

                                                {/* Stop Losses */}
                                                <td className="text-center">
                                                    {formatCurrency(trade.stop_loss_33_percent)}
                                                </td>
                                                <td className="text-center">
                                                    {formatCurrency(trade.stop_loss_66_percent)}
                                                </td>
                                                <td className="text-center">
                                                    {formatCurrency(trade.stop_loss_price)}
                                                </td>
                                                <td className="text-center">
                                                    {safeToFixed(trade.total_shares)}
                                                </td>
                                                <td className="text-center">
                                                    {safeToFixed(trade.remaining_shares)}
                                                </td>
                                                <td className="text-center">
                                                    {formatCurrency(trade.total_cost)}
                                                </td>
                                                <td className="text-center">
                                                    {formatCurrency(trade.market_value)}
                                                </td>
                                                <td className="text-center">
                                                    {safeToFixed(trade.portfolio_weight)}%
                                                </td>
                                                <td className="text-center">
                                                    {safeToFixed(trade.trimmed_percentage)}%
                                                </td>

                                                <td className={`
                                                    text-center font-semibold tabular-nums
                                                    ${trade.open_risk > 0 ? 'text-rose-400' : 'text-emerald-400'}
                                                `}>
                                                    {trade.open_risk > 0 ? '-' : ''}{safeToFixed(trade.open_risk, 2)}%
                                                </td>

                                                <td className={`
                                                    text-center font-semibold tabular-nums
                                                    ${trade.portfolio_heat > 0 ? 'text-rose-400' : 'text-emerald-400'}
                                                `}>
                                                    {trade.portfolio_heat === 0 ? (
                                                        <span className="text-white">-</span>
                                                    ) : (
                                                        <>
                                                            {trade.portfolio_heat > 0 ? '+' : ''}
                                                            {safeToFixed(trade.portfolio_heat)}%
                                                        </>
                                                    )}
                                                </td>

                                                <td className={`
                                                    text-center font-semibold tabular-nums
                                                    ${trade.portfolio_impact > 0 ? 'text-emerald-400' : 'text-rose-400'}
                                                `}>
                                                    {trade.portfolio_impact === 0 ? (
                                                        <span className="text-white">-</span>
                                                    ) : (
                                                        <>
                                                            {trade.portfolio_impact > 0 ? '+' : ''}
                                                            {safeToFixed(trade.portfolio_impact)}%
                                                        </>
                                                    )}  
                                                </td>

                                                {/* Percentage MAE/MFE */}
                                                <td className="text-center font-semibold tabular-nums text-rose-400">
                                                    {trade.mae === 0 ? (
                                                        <span className="text-white">-</span>
                                                    ) : (
                                                        `${safeToFixed(trade.mae, 1)}%`
                                                    )}
                                                </td>

                                                <td className="text-center font-semibold tabular-nums text-emerald-400">
                                                    {trade.mfe === 0 ? (
                                                        <span className="text-white">-</span>
                                                    ) : (
                                                        `${safeToFixed(trade.mfe, 1)}%`
                                                    )}
                                                </td>

                                                {/* Dollar MAE/MFE */}
                                                <td className="text-center font-semibold tabular-nums text-rose-400">
                                                    {trade.mae_dollars === 0 ? (
                                                        <span className="text-white">-</span>
                                                    ) : (
                                                        formatCurrency(trade.mae_dollars, 0)
                                                    )}
                                                </td>
                                                <td className="text-center font-semibold tabular-nums text-emerald-400">
                                                    {trade.mfe_dollars === 0 ? (
                                                        <span className="text-white">-</span>
                                                    ) : (
                                                        formatCurrency(trade.mfe_dollars, 0)
                                                    )}
                                                </td>

                                                {/* R-Multiple MAE/MFE */}
                                                <td className="text-center font-semibold tabular-nums text-rose-400">
                                                    {trade.mae_r === 0 ? (
                                                        <span className="text-white">-</span>
                                                    ) : (
                                                        `${safeToFixed(trade.mae_r, 2)}R`
                                                    )}
                                                </td>

                                                <td className="text-center font-semibold tabular-nums text-emerald-400">
                                                    {trade.mfe_r === 0 ? (
                                                        <span className="text-white">-</span>
                                                    ) : (
                                                        `${safeToFixed(trade.mfe_r, 2)}R`
                                                    )}
                                                </td>

                                                {/* Trade Details */}
                                                <td className="text-center whitespace-nowrap">
                                                    {trade.exit_datetime ? 
                                                        new Date(trade.exit_datetime).toISOString().split('T')[0] : ''}
                                                </td>
                                                
                                                <td className="text-center">
                                                    {formatCurrency(trade.exit_price)}
                                                </td>

                                                <td className={`
                                                    text-center font-semibold tabular-nums
                                                    ${trade.percent_from_entry > 0 ? 'text-emerald-400' : 'text-rose-400'}
                                                `}>
                                                    {trade.unrealized_pnl === 0 ? (
                                                        <span className="text-white">-</span>
                                                    ) : (
                                                        <>
                                                            {trade.percent_from_entry > 0 ? '+' : ''}
                                                            {safeToFixed(trade.percent_from_entry)}%
                                                        </>
                                                    )}
                                                </td>
                                                {/* Holding Period */}
                                                <td className="text-center">
                                                    {trade.holding_period ? `${trade.holding_period} days` : 'N/A'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <TradeHistoryModal 
                    isOpen={isModalOpen}
                    onClose={closeModal}
                    onTradeAdded={() => {
                        closeModal();
                        fetchTrades();
                    }}
                    existingTrade={selectedTrade}
                />
            </TitleCard>
        </div>



    );
};

export default TradeLog;