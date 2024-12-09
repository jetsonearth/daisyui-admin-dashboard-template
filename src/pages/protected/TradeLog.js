import React, { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'; 
import TitleCard from '../../components/Cards/TitleCard'
import { TRADE_STATUS, ASSET_TYPES, DIRECTIONS, STRATEGIES, SAMPLE_TRADES } from '../../features/trades/tradeModel'
import { marketDataService } from '../../features/marketData/marketDataService'

function TradeLog(){
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
                                <th className="w-28">Price Change</th>
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
                                        <td className={trade.last_price ? (trade.last_price > trade.avg_cost ? 'text-green-500' : 'text-red-500') : ''}>
                                            {trade.last_price ? ((trade.last_price - trade.avg_cost) / trade.avg_cost * 100).toFixed(2) + '%' : '-'}
                                        </td>
                                        <td>{safeToFixed(trade.total_shares)}</td>
                                        <td>{trade.shares_remaining}</td>
                                        <td>{formatCurrency(trade.total_cost)}</td>
                                        <td>{formatCurrency(trade.market_value)}</td>
                                        <td>{safeToFixed(trade.weight)}%</td>
                                        <td>{safeToFixed(trade.trimmed)}%</td>
                                        <td className="whitespace-normal">{trade.strategy}</td>
                                        <td className="whitespace-normal">
                                            <div className="flex flex-wrap gap-1">
                                                {trade.setups?.map((setup, i) => (
                                                    <span key={i} className="badge badge-sm">{setup}</span>
                                                ))}
                                            </div>
                                        </td>
                                        <td>{formatCurrency(trade.initial_sl)}</td>
                                        <td>{formatCurrency(trade.sl_33)}</td>
                                        <td>{formatCurrency(trade.sl_66)}</td>
                                        <td className={trade.unrealized_pnl_percentage >= 0 ? 'text-green-500' : 'text-red-500'}>
                                            {safeToFixed(trade.unrealized_pnl_percentage)}%
                                        </td>
                                        <td className={trade.unrealized_pnl >= 0 ? 'text-green-500' : 'text-red-500'}>
                                            {formatCurrency(trade.unrealized_pnl)}
                                        </td>
                                        <td className={trade.realized_pnl_percentage >= 0 ? 'text-green-500' : 'text-red-500'}>
                                            {safeToFixed(trade.realized_pnl_percentage)}%
                                        </td>
                                        <td className={trade.realized_pnl >= 0 ? 'text-green-500' : 'text-red-500'}>
                                            {formatCurrency(trade.realized_pnl)}
                                        </td>
                                        <td>{trade.rrr || '-'}</td>
                                        <td>{formatCurrency(trade.open_risk)}</td>
                                        <td>{safeToFixed(trade.portfolio_impact)}%</td>
                                        <td className="text-red-500">{safeToFixed(trade.mae)}%</td>
                                        <td className="text-green-500">{safeToFixed(trade.mfe)}%</td>
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
