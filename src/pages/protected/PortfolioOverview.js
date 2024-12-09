import React, { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import TitleCard from '../../components/Cards/TitleCard'
import dayjs from 'dayjs'
import { TRADE_STATUS } from '../../features/trades/tradeModel'
import { marketDataService } from '../../features/marketData/marketDataService'
import { closeTrade } from '../../features/trades/tradesSlice'
import { calculatePortfolioMetrics } from '../../features/metrics/metricsService'

// Time filter buttons configuration
const timeFilters = [
    { label: "Today", days: 0 },
    { label: "Yesterday", days: 1 },
    { label: "Last Week", days: 7 },
    { label: "Last Month", days: 30 },
    { label: "All Time", days: null }
];

function PortfolioOverview(){
    const dispatch = useDispatch()
    const allTrades = useSelector(state => state.trades.trades)
    const [trades, setTrades] = useState([])
    const [currentDate] = useState(dayjs().format('MMMM D, YYYY'))
    const [selectedTimeFilter, setSelectedTimeFilter] = useState(timeFilters[0])
    const [isAutoRefresh, setIsAutoRefresh] = useState(true)
    const [lastUpdate, setLastUpdate] = useState(null)

    // Calculate metrics
    const calculateMetrics = () => {
        const metrics = calculatePortfolioMetrics(allTrades, 50000)
        return metrics
    }

    const metrics = calculateMetrics()

    // Update trades when Redux store changes
    useEffect(() => {
        const openTrades = allTrades.filter(trade => trade.status === 'open')
        setTrades(openTrades)
    }, [allTrades])

    // Function to handle trade closure
    const handleCloseTrade = (trade) => {
        dispatch(closeTrade({
            id: trade.id,
            exitPrice: trade.current_price,
            exitDate: new Date().toISOString()
        }))
    }

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

    return(
        <div className="p-4">
            {/* Top Header with Date and Time Filters */}
            <div className="flex justify-between items-center mb-6">
                <div className="text-2xl font-bold">{currentDate}</div>
                <div className="flex items-center gap-4">
                    <div className="flex gap-2">
                        {timeFilters.map((filter, index) => (
                            <button
                                key={index}
                                onClick={() => setSelectedTimeFilter(filter)}
                                className={`btn btn-sm ${selectedTimeFilter === filter ? 'btn-primary' : 'btn-ghost'}`}
                            >
                                {filter.label}
                            </button>
                        ))}
                    </div>
                    <button className="btn btn-ghost btn-circle">
                        <div className="avatar">
                            <div className="w-8 rounded-full">
                                <img src="/avatar-placeholder.png" alt="user" />
                            </div>
                        </div>
                    </button>
                </div>
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-8 gap-4 mb-6">
                <div className="bg-base-100 p-4 rounded-lg shadow">
                    <div className="text-sm text-gray-500">Current Capital</div>
                    <div className="text-2xl font-bold">${metrics.currentCapital.toLocaleString()}</div>
                    <div className="text-xs text-green-500">+12.5% from last month</div>
                </div>
                <div className="bg-base-100 p-4 rounded-lg shadow">
                    <div className="text-sm text-gray-500">Profit Factor</div>
                    <div className="text-2xl font-bold">{metrics.profitFactor}</div>
                    <div className="text-xs text-green-500">+8.1% from last</div>
                </div>
                <div className="bg-base-100 p-4 rounded-lg shadow">
                    <div className="text-sm text-gray-500">Win Rate</div>
                    <div className="text-2xl font-bold">{metrics.winRate}%</div>
                    <div className="text-xs text-red-500">-2.4% from last month</div>
                </div>
                <div className="bg-base-100 p-4 rounded-lg shadow">
                    <div className="text-sm text-gray-500">RRR</div>
                    <div className="text-2xl font-bold">{metrics.rrr}</div>
                    <div className="text-xs text-green-500">+4.2% from last</div>
                </div>
                <div className="bg-base-100 p-4 rounded-lg shadow">
                    <div className="text-sm text-gray-500">Avg Win</div>
                    <div className="text-2xl font-bold text-green-500">${metrics.avgWin}</div>
                </div>
                <div className="bg-base-100 p-4 rounded-lg shadow">
                    <div className="text-sm text-gray-500">Avg Loss</div>
                    <div className="text-2xl font-bold text-red-500">${metrics.avgLoss}</div>
                </div>
                <div className="bg-base-100 p-4 rounded-lg shadow">
                    <div className="text-sm text-gray-500">Max Drawdown</div>
                    <div className="text-2xl font-bold text-red-500">{metrics.maxDrawdown}%</div>
                </div>
                <div className="bg-base-100 p-4 rounded-lg shadow">
                    <div className="text-sm text-gray-500">Max Runup</div>
                    <div className="text-2xl font-bold text-green-500">{metrics.maxRunup}%</div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-12 gap-6">
                {/* Equity Curve - Spans 7 columns */}
                <div className="col-span-7 bg-base-100 p-6 rounded-lg shadow">
                    <div className="text-lg font-bold mb-4">Equity Curve</div>
                    <div className="h-[300px] flex items-center justify-center text-gray-500">
                        Equity curve visualization placeholder...
                    </div>
                </div>

                {/* Stats Column - Spans 2 columns */}
                <div className="col-span-2 space-y-6">
                    {/* PnL Box */}
                    <div className="bg-base-100 p-4 rounded-lg shadow">
                        <div className="mb-4">
                            <div className="text-gray-500 text-sm">Total Realized PnL</div>
                            <div className="text-xl font-bold">${metrics.totalGrossProfits.toLocaleString()}</div>
                        </div>
                        <div>
                            <div className="text-gray-500 text-sm">Total Unrealized</div>
                            <div className="text-xl font-bold">${metrics.totalGrossLosses.toLocaleString()}</div>
                        </div>
                    </div>

                    {/* Current Streak */}
                    <div className="bg-base-100 p-4 rounded-lg shadow">
                        <div className="text-gray-500 text-sm mb-2">Current Streak</div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="text-xs text-gray-500">Win</div>
                                <div className="text-xl font-bold text-green-500">{metrics.winCount}</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500">Lose</div>
                                <div className="text-xl font-bold text-red-500">{metrics.loseCount}</div>
                            </div>
                        </div>
                    </div>

                    {/* Period Returns */}
                    <div className="bg-base-100 p-4 rounded-lg shadow">
                        <div className="text-gray-500 text-sm mb-2">Period Returns</div>
                        <div className="space-y-2">
                            <div>
                                <div className="text-xs text-gray-500">Weekly</div>
                                <div className="text-sm font-bold">{metrics.weeklyReturn}%</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500">Monthly</div>
                                <div className="text-sm font-bold">{metrics.monthlyReturn}%</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500">Quarterly</div>
                                <div className="text-sm font-bold">{metrics.quarterlyReturn}%</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500">Yearly</div>
                                <div className="text-sm font-bold">{metrics.yearlyReturn}%</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Exposure Metrics - Spans 3 columns */}
                <div className="col-span-3 space-y-6">
                    {/* Daily Exposure */}
                    <div className="bg-base-100 p-4 rounded-lg shadow">
                        <div className="text-gray-500 text-sm mb-2">Daily Exposure</div>
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <div className="text-xs text-gray-500">Gross</div>
                                <div className="text-sm font-bold">$10,000</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500">Net</div>
                                <div className="text-sm font-bold">$5,000</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500">Util</div>
                                <div className="text-sm font-bold">25%</div>
                            </div>
                        </div>
                    </div>

                    {/* New Exposure */}
                    <div className="bg-base-100 p-4 rounded-lg shadow">
                        <div className="text-gray-500 text-sm mb-2">New Exposure</div>
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <div className="text-xs text-gray-500">Long</div>
                                <div className="text-sm font-bold">$8,000</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500">Short</div>
                                <div className="text-sm font-bold">$2,000</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500">Ratio</div>
                                <div className="text-sm font-bold">4:1</div>
                            </div>
                        </div>
                    </div>

                    {/* Open Exposure */}
                    <div className="bg-base-100 p-4 rounded-lg shadow">
                        <div className="text-gray-500 text-sm mb-2">Open Exposure</div>
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <div className="text-xs text-gray-500">Risk</div>
                                <div className="text-sm font-bold">$1,200</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500">R-Mult</div>
                                <div className="text-sm font-bold">2.5R</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500">Heat</div>
                                <div className="text-sm font-bold">15%</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Active Trades */}
            <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="text-lg font-bold">Active Trades</div>
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => setIsAutoRefresh(!isAutoRefresh)}
                            className={`btn btn-sm ${isAutoRefresh ? 'btn-error' : 'btn-success'}`}
                        >
                            {isAutoRefresh ? 'Stop Auto Update' : 'Start Auto Update'}
                        </button>
                        <button 
                            onClick={updateMarketData}
                            className="btn btn-sm btn-primary"
                        >
                            Update Prices
                        </button>
                        {lastUpdate && <span className="text-sm text-gray-500">Last update: {lastUpdate}</span>}
                    </div>
                </div>
                <div className="bg-base-100 rounded-lg shadow overflow-x-auto">
                    <table className="table w-full">
                        <thead>
                            <tr>
                                <th>Ticker</th>
                                <th>Asset Type</th>
                                <th>Strategy</th>
                                <th>Entry Date</th>
                                <th>Avg Cost</th>
                                <th>Shares Remaining</th>
                                <th>% Trimmed</th>
                                <th>Open Risk</th>
                                <th>Position Weight</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {trades.length === 0 ? (
                                <tr>
                                    <td colSpan="10" className="text-center text-gray-500">No active positions</td>
                                </tr>
                            ) : (
                                trades.map((trade, index) => (
                                    <tr key={index}>
                                        <td className="font-medium">{trade.ticker}</td>
                                        <td>{trade.asset_type}</td>
                                        <td>{trade.strategy}</td>
                                        <td>{trade.entry_date}</td>
                                        <td>${trade.avg_cost?.toFixed(2)}</td>
                                        <td>{trade.shares_remaining}</td>
                                        <td>{trade.trimmed || '0'}%</td>
                                        <td>${trade.open_risk?.toFixed(2)}</td>
                                        <td>{trade.portfolio_weight?.toFixed(2)}%</td>
                                        <td>
                                            <div className="dropdown dropdown-end">
                                                <label tabIndex={0} className="btn btn-ghost btn-xs">•••</label>
                                                <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52">
                                                    <li><a onClick={() => handleCloseTrade(trade)}>Close Position</a></li>
                                                    <li><a onClick={() => handleCloseTrade({ ...trade, shares: trade.shares_remaining * 0.5 })}>Close Half</a></li>
                                                    <li><a onClick={() => handleCloseTrade({ ...trade, shares: trade.shares_remaining * 0.33 })}>Close Third</a></li>
                                                </ul>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

export default PortfolioOverview
