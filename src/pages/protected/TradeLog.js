import React, { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'; 
import { useNavigate } from 'react-router-dom'
import TitleCard from '../../components/Cards/TitleCard'
import { TRADE_STATUS, ASSET_TYPES, DIRECTIONS, STRATEGIES, SAMPLE_TRADES } from '../../features/trades/tradeModel'
import { marketDataService } from '../../features/marketData/marketDataService'

function TradeLog(){
    const dispatch = useDispatch(); // Add this line
    const navigate = useNavigate()
    const tradesFromStore = useSelector(state => state.trades.trades); 
    const [trades, setTrades] = useState(tradesFromStore);
    const [isAutoRefresh, setIsAutoRefresh] = useState(true)
    const [lastUpdate, setLastUpdate] = useState(null)

    // Function to safely format number with toFixed
    const safeToFixed = (number, decimals = 2) => {
        if (number === undefined || number === null) return '0.00';
        return Number(number).toFixed(decimals);
    };

    // Function to safely format currency
    const formatCurrency = (amount) => {
        if (amount === undefined || amount === null) return '$0.00';
        return `$${safeToFixed(amount)}`;
    };

    // Function to update market data
    const updateMarketData = async () => {
        try {
            const updatedTrades = await marketDataService.updateTradesWithMarketData(trades);
            setTrades(updatedTrades);
            setLastUpdate(new Date().toLocaleTimeString());
        } catch (error) {
            console.error('Error updating market data:', error);
        }
    };

    // Auto-refresh every 30 minutes
    useEffect(() => {
        let intervalId;
        if (isAutoRefresh) {
            updateMarketData(); // Initial update
            intervalId = setInterval(updateMarketData, 1800000); // 30 minutes
        }
        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [isAutoRefresh]); // Only re-run when autoRefresh changes

    const toggleAutoRefresh = () => {
        setIsAutoRefresh(!isAutoRefresh);
    };

    const handleRefreshNow = () => {
        updateMarketData();
    };

    // New reset function
    const handleReset = () => {
        // Reset trades to the original store trades
        setTrades(tradesFromStore);
        
        // Reset auto-refresh to true
        setIsAutoRefresh(true);
        
        // Clear last update
        setLastUpdate(null);
    };

    return (
        <div className="p-4">
            <TitleCard title="Trade Log" topMargin="mt-2">
                <div className="flex flex-col">
                    <div className="flex items-center gap-4 mb-4">
                        <button 
                            onClick={toggleAutoRefresh}
                            className={`btn ${isAutoRefresh ? 'btn-error' : 'btn-success'}`}
                        >
                            {isAutoRefresh ? 'Stop Auto-Refresh' : 'Start Auto-Refresh'}
                        </button>
                        <button 
                            onClick={handleRefreshNow}
                            className="btn btn-primary"
                        >
                            Refresh Now
                        </button>

                        {/* New Reset Button */}
                        <button 
                            onClick={handleReset}
                            className="btn btn-secondary"
                        >
                            Reset
                        </button>

                        <span className="text-gray-400">
                            Auto-refreshing every 30 minutes
                        </span>
                        {lastUpdate && (
                            <span className="text-gray-400">
                                Last update: {lastUpdate}
                            </span>
                        )}
                    </div>

                    {trades.length === 0 ? (
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
                            <table className="table w-full">
                                <thead>
                                    <tr>
                                        <th className="w-20">Ticker</th>
                                        <th className="w-24">Type</th>
                                        <th className="w-24">Direction</th>
                                        <th className="w-20">Status</th>
                                        <th className="w-32">Entry Date</th>
                                        <th className="w-28">Entry Price</th>
                                        <th className="w-28">Current Price</th>
                                        <th className="w-24">Total Shares</th>
                                        <th className="w-24">Remaining Shares</th>
                                        <th className="w-32">Total Cost</th>
                                        <th className="w-32">Market Value</th>
                                        <th className="w-20">Weight %</th>
                                        <th className="w-24">Trimmed %</th>
                                        <th className="whitespace-normal min-w-[80px]">Strategy</th>
                                        <th className="whitespace-normal min-w-[200px]">Setups</th>
                                        <th className="w-24">Initial SL</th>
                                        <th className="w-24">33% SL</th>
                                        <th className="w-24">66% SL</th>
                                        <th className="w-28">Unrealized PnL%</th>
                                        <th className="w-28">Unrealized PnL</th>
                                        <th className="w-28">Realized PnL%</th>
                                        <th className="w-28">Realized PnL</th>
                                        <th className="w-20">RRR</th>
                                        <th className="w-24">Open Risk</th>
                                        <th className="w-32">Portfolio Impact</th>
                                        <th className="w-20">MAE</th>
                                        <th className="w-20">MFE</th>
                                        <th className="w-32">Exit Date</th>
                                        <th className="w-24">Commission</th>
                                        <th className="w-32">Holding Period</th>
                                        <th className="w-32">Mistakes</th>
                                        <th className="w-32">Notes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {
                                        trades && trades.map((trade, k) => (
                                            <tr key={k}>
                                                <td className="font-medium">{trade.ticker || 'N/A'}</td>
                                                <td>{trade.asset_type || 'N/A'}</td>
                                                <td>
                                                    <span className={`
                                                        badge badge-pill 
                                                        ${trade.direction === DIRECTIONS.LONG ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}
                                                    `}>
                                                        {trade.direction || 'N/A'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`
                                                        badge badge-pill 
                                                        ${trade.status === TRADE_STATUS.OPEN ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-black'}
                                                    `}>
                                                        {trade.status || 'N/A'}
                                                    </span>
                                                </td>
                                                <td className="whitespace-nowrap">
                                                    {trade.entry_date || 'N/A'}
                                                </td>
                                                <td>{formatCurrency(trade.avg_cost)}</td>
                                                <td className="font-medium">{formatCurrency(trade.last_price)}</td>
                                                <td>{safeToFixed(trade.total_shares)}</td>
                                                <td>{trade.shares_remaining}</td>
                                                <td>{formatCurrency(trade.total_cost)}</td>
                                                <td>{formatCurrency(trade.market_value)}</td>
                                                <td>{safeToFixed(trade.weight_percentage)}%</td>
                                                <td>{safeToFixed(trade.trimmed_percentage)}%</td>
                                                <td>
                                                    {trade.strategy ? (
                                                        <span 
                                                            className="badge badge-pill bg-purple-500 text-white"
                                                        >
                                                            {trade.strategy}
                                                        </span>
                                                    ) : 'N/A'}
                                                </td>
                                                <td>
                                                    {trade.setups ? (
                                                        <div className="flex flex-wrap gap-1">
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
                                                <td>{formatCurrency(trade.stop_loss_price)}</td>
                                                <td>{formatCurrency(trade.stop_loss_33_percent)}</td>
                                                <td>{formatCurrency(trade.stop_loss_66_percent)}</td>
                                                <td className={`
                                                    font-semibold tabular-nums text-right
                                                    ${trade.unrealized_percentage > 0 ? 'text-emerald-400' : 'text-rose-400'}
                                                `}>
                                                    {trade.unrealized_percentage > 0 ? '+' : ''}{safeToFixed(trade.unrealized_percentage)}%
                                                </td>
                                                <td className={`
                                                    font-semibold tabular-nums text-right
                                                    ${trade.unrealized_pnl > 0 ? 'text-emerald-400' : 'text-rose-400'}
                                                `}>
                                                    {trade.unrealized_pnl > 0 ? '+' : ''}{formatCurrency(trade.unrealized_pnl)}
                                                </td>
                                                <td className={`
                                                    font-semibold tabular-nums text-right
                                                    ${trade.realized_percentage > 0 ? 'text-emerald-400' : 'text-rose-400'}
                                                `}>
                                                    {trade.realized_percentage > 0 ? '+' : ''}{safeToFixed(trade.realized_percentage)}%
                                                </td>
                                                <td className={`
                                                    font-semibold tabular-nums text-right
                                                    ${trade.realized_pnl > 0 ? 'text-emerald-400' : 'text-rose-400'}
                                                `}>
                                                    {trade.realized_pnl > 0 ? '+' : ''}{formatCurrency(trade.realized_pnl)}
                                                </td>
                                                <td className={`
                                                    font-semibold tabular-nums text-right
                                                    ${trade.risk_reward_ratio > 1 ? 'text-emerald-400' : 'text-rose-400'}
                                                `}>
                                                    {safeToFixed(trade.risk_reward_ratio, 1)}
                                                </td>
                                                <td className={`
                                                    font-semibold tabular-nums text-right
                                                    ${trade.open_risk > 0 ? 'text-rose-400' : 'text-emerald-400'}
                                                `}>
                                                    {safeToFixed(trade.open_risk, 1)}%
                                                </td>
                                                <td className={`
                                                    font-semibold tabular-nums text-right
                                                    ${trade.portfolio_impact > 0 ? 'text-emerald-400' : 'text-rose-400'}
                                                `}>
                                                    {trade.portfolio_impact > 0 ? '+' : ''}{safeToFixed(trade.portfolio_impact, 1)}%
                                                </td>
                                                <td className="font-semibold tabular-nums text-right text-rose-400">
                                                    {safeToFixed(trade.mae, 1)}%
                                                </td>
                                                <td className="font-semibold tabular-nums text-right text-emerald-400">
                                                    {safeToFixed(trade.mfe, 1)}%
                                                </td>
                                                <td>{trade.exit_date || 'N/A'}</td>
                                                <td>{formatCurrency(trade.commission)}</td>
                                                <td>{trade.holding_period || 'N/A'}</td>
                                                <td>{trade.mistakes || 'N/A'}</td>
                                                <td>{trade.notes || 'N/A'}</td>
                                            </tr>
                                        ))
                                    }
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </TitleCard>
        </div>
    )
}

export default TradeLog
