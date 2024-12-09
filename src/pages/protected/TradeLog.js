import React, { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'; 
import TitleCard from '../../components/Cards/TitleCard'
import { TRADE_STATUS, ASSET_TYPES, DIRECTIONS, STRATEGIES, SAMPLE_TRADES } from '../../features/trades/tradeModel'
import { marketDataService } from '../../features/marketData/marketDataService'

function TradeLog(){
    const dispatch = useDispatch(); // Add this line
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

    return(
        <div className="p-4">
            <TitleCard title="Trade Log" topMargin="mt-2">
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
                                <th className="w-24">Remaining</th>
                                <th className="w-32">Total Cost</th>
                                <th className="w-32">Market Value</th>
                                <th className="w-20">Weight %</th>
                                <th className="w-24">Trimmed %</th>
                                <th className="whitespace-normal min-w-[200px]">Strategy</th>
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
                                        <td>{trade.direction || 'N/A'}</td>
                                        <td>
                                            <div className={`badge ${trade.status === TRADE_STATUS.OPEN ? 'badge-success' : 'badge-warning'}`}>
                                                {trade.status || 'N/A'}
                                            </div>
                                        </td>
                                        <td>{trade.entry_date || 'N/A'}</td>
                                        <td>{formatCurrency(trade.avg_cost)}</td>
                                        <td className="font-medium">{formatCurrency(trade.last_price)}</td>
                                        <td>{safeToFixed(trade.total_shares)}</td>
                                        <td>{trade.shares_remaining}</td>
                                        <td>{formatCurrency(trade.total_cost)}</td>
                                        <td>{formatCurrency(trade.market_value)}</td>
                                        <td>{safeToFixed(trade.weight_percentage)}%</td>
                                        <td>{safeToFixed(trade.trimmed_percentage)}%</td>
                                        <td>{trade.strategy || 'N/A'}</td>
                                        <td>{trade.setups ? trade.setups.join(', ') : 'N/A'}</td>
                                        <td>{formatCurrency(trade.stop_loss_price)}</td>
                                        <td>{formatCurrency(trade.stop_loss_33_percent)}</td>
                                        <td>{formatCurrency(trade.stop_loss_66_percent)}</td>
                                        <td>{safeToFixed(trade.unrealized_percentage)}%</td>
                                        <td>{formatCurrency(trade.unrealized_pnl)}</td>
                                        <td>{safeToFixed(trade.realized_percentage)}%</td>
                                        <td>{formatCurrency(trade.realized_pnl)}</td>
                                        <td>{safeToFixed(trade.risk_reward_ratio)}</td>
                                        <td>{safeToFixed(trade.open_risk)}%</td>
                                        <td>{safeToFixed(trade.portfolio_impact)}%</td>
                                        <td className="text-red-500">{safeToFixed(trade.mae)}%</td>
                                        <td className="text-green-500">{safeToFixed(trade.mfe)}%</td>
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

                {/* Add Trade Button */}
                <div className="mt-4">
                    <button className="btn btn-primary">
                        Add New Trade
                    </button>
                </div>
            </TitleCard>
        </div>
    )
}

export default TradeLog
