import React, { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { supabase } from '../../config/supabaseClient'
import { toast } from 'react-toastify'
import TitleCard from '../../components/Cards/TitleCard'
import dayjs from 'dayjs'
import { TRADE_STATUS } from '../../features/trades/tradeModel'
import { marketDataService } from '../../features/marketData/marketDataService'
import { capitalService } from '../../services/capitalService';
import { closeTrade } from '../../features/trades/tradesSlice'
import { calculatePortfolioMetrics } from '../../features/metrics/metricsService'
import { userSettingsService } from '../../services/userSettingsService'

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
    const [startingCapital, setStartingCapital] = useState(0)
    const [currentCapital, setCurrentCapital] = useState(0);
    
    // Calculate metrics
    const calculateMetrics = () => {
        const metrics = calculatePortfolioMetrics(allTrades, startingCapital)
        console.log("starting capital:", startingCapital);
        console.log("current capital:", currentCapital);
        
        // Override currentCapital with the state value
        metrics.currentCapital = currentCapital;
        
        return metrics
    }

    const metrics = calculateMetrics()

    // Fetch active trades from Supabase
    useEffect(() => {
        const fetchActiveTrades = async () => {
            try {
                const { data: { user }, error: userError } = await supabase.auth.getUser()
                
                if (userError || !user) {
                    console.error('Authentication error:', userError)
                    toast.error('Authentication required')
                    return
                }

                console.log('Authenticated User:', user.id)

                const { data, error } = await supabase
                    .from('trades')
                    .select('*')
                    .eq('user_id', user.id)
                    .or(`status.eq.Open`)
                    .order('entry_datetime', { ascending: false });

                if (error) {
                    console.error('Error fetching active trades:', error)
                    toast.error('Failed to fetch active trades')
                    return
                }

                console.log('Raw Trades Fetched:', {
                    count: data.length,
                    trades: data.map(trade => ({
                        id: trade.id,
                        ticker: trade.ticker,
                        status: trade.status,
                        shares_remaining: trade.shares_remaining,
                        entry_date: dayjs(trade.entry_datetime).format('YYYY-MM-DD'), // Extract just the date
                        full_entry_datetime: trade.entry_datetime
                    }))
                });

                if (data.length === 0) {
                    toast.info('No active trades found')
                }

                setTrades(data || [])
            } catch (error) {
                console.error('Unexpected error fetching active trades:', error)
                toast.error('Unexpected error occurred')
            }
        }

        fetchActiveTrades()
    }, [])

    // Fetch starting capital from user settings
    useEffect(() => {
        const fetchStartingCapital = async () => {
            try {
                const userSettings = await userSettingsService.getUserSettings()
                setStartingCapital(userSettings.starting_cash || 0)
            } catch (error) {
                console.error('Failed to fetch starting capital:', error)
            }
        }

        fetchStartingCapital()
    }, [])


    useEffect(() => {
        const fetchCurrentCapital = async () => {
            try {
                // Change this line to use capitalService
                const capital = await capitalService.getCurrentCapital();
                setCurrentCapital(capital);
                
                // Optional: track capital change if needed
                await capitalService.trackCapitalChange(allTrades);
            } catch (error) {
                console.error('Failed to fetch current capital:', error);
            }
        }
    
        fetchCurrentCapital();
    }, [allTrades, startingCapital]);

    // Function to handle trade closure
    const handleCloseTrade = (trade) => {
        dispatch(closeTrade({
            id: trade.id,
            exitPrice: trade.last_price,
            exitDate: new Date().toISOString()
        }))
    }

    // Function to update market data
    const updateMarketData = async () => {
        try {
            if (trades.length === 0) {
                console.log('No active trades to update');
                return;
            }
    
            console.log('Trades before update:', trades);
    
            const updatedTrades = await marketDataService.updateTradesWithMarketData(trades);
            
            console.log('Trades after update:', updatedTrades);
    
            
            // Batch update trades in Supabase
            const updatePromises = updatedTrades.map(async (trade) => {
                const { error } = await supabase
                    .from('trades')
                    .update({
                        current_price: trade.last_price,
                        market_value: trade.market_value,
                        unrealized_pnl: trade.unrealized_pnl,
                        unrealized_pnl_percentage: trade.unrealized_pnl_percentage,
                        trimmed_percentage: trade.trimmed_percentage,
                        portfolio_weight: trade.portfolio_weight,
                        portfolio_impact: trade.portfolio_impact,
                        portfolio_heat: trade.portfolio_heat,
                        realized_pnl: trade.realized_pnl,
                        realized_pnl_percentage: trade.realized_pnl_percentage,
                        risk_reward_ratio: trade.risk_reward_ratio,
                        last_update: trade.last_update
                    })
                    .eq('id', trade.id)

                if (error) {
                    console.error(`Error updating trade ${trade.id}:`, error)
                }
            })

            await Promise.all(updatePromises)

            // Refetch active trades after update
            const { data: { user }, error: userError } = await supabase.auth.getUser()
            
            if (userError || !user) {
                console.error('Authentication error:', userError)
                toast.error('Authentication required')
                return
            }

            const { data, error } = await supabase
                .from('trades')
                .select('*')
                .eq('user_id', user.id)
                .or(`status.eq.Open`)
                .order('entry_datetime', { ascending: false });

            if (error) {
                console.error('Error refetching trades:', error)
                toast.error('Failed to refresh trades')
                return
            }

            setTrades(data || [])
            setLastUpdate(new Date().toLocaleTimeString());
        } catch (error) {
            console.error('Error updating market data:', error);
            toast.error('Failed to update market data');
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
                </div>
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-5 gap-4 mb-7">
                {/* Each metric card with better overflow handling */}
                <div className="bg-base-100 p-3 rounded-lg shadow flex flex-col h-[110px]">
                    <div className="text-xs text-gray-500 truncate mb-1">Current Capital</div>
                    <div className="text-2xl font-semibold truncate">
                        ${currentCapital.toLocaleString(undefined, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0
                        })}
                    </div>
                    <div className="text-xs text-green-500 truncate mt-auto">
                        {startingCapital > 0 
                            ? ((currentCapital - startingCapital) / startingCapital * 100).toFixed(1) 
                            : '0.0'}% from start
                    </div>
                </div>
                <div className="bg-base-100 p-3 rounded-lg shadow flex flex-col h-[110px]">
                    <div className="text-xs text-gray-500 truncate mb-1">Profit Factor</div>
                    <div className="text-2xl font-semibold truncate">
                        {typeof metrics.profitFactor === 'number' 
                            ? metrics.profitFactor.toFixed(2) 
                            : '0.00'}
                    </div>
                    <div className="text-xs text-green-500 truncate mt-auto">+8.1% from last</div>
                </div>

                <div className="bg-base-100 p-3 rounded-lg shadow flex flex-col h-[110px]">
                    <div className="text-xs text-gray-500 truncate mb-1">RRR</div>
                    <div className="text-2xl font-semibold truncate">
                        {typeof metrics.rrr === 'number' 
                            ? metrics.rrr.toFixed(2) 
                            : '0.00'}
                    </div>
                    <div className="text-xs text-green-500 truncate mt-auto">+4.2% from last</div>
                </div>

                <div className="bg-base-100 p-3 rounded-lg shadow flex flex-col h-[110px]">
                    <div className="text-xs text-gray-500 truncate mb-1">Max Drawdown</div>
                    <div className="text-2xl font-semibold text-red-500 truncate">
                        {typeof metrics.maxDrawdown === 'number' 
                            ? metrics.maxDrawdown.toFixed(2) 
                            : '0.00'}%
                    </div>
                </div>
                <div className="bg-base-100 p-3 rounded-lg shadow flex flex-col h-[110px]">
                    <div className="text-xs text-gray-500 truncate mb-1">Max Runup</div>
                    <div className="text-2xl font-semibold text-green-500 truncate">
                        {typeof metrics.maxRunup === 'number' 
                            ? metrics.maxRunup.toFixed(2) 
                            : '0.00'}%
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-12 gap-6">
                {/* Equity Curve - Spans 5 columns */}
                <div className="col-span-6 bg-base-100 p-6 rounded-lg shadow">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold">Equity Curve</h2>
                        <div className="text-sm text-gray-500 bg-base-200 px-3 py-1 rounded-full">
                            Starting Capital: <span className="font-semibold text-primary">${startingCapital.toLocaleString()}</span>
                        </div>
                    </div>
                    <div className="h-[300px] flex items-center justify-center text-gray-500">
                        Equity curve visualization placeholder...
                    </div>
                </div>

                {/* Right Side Stats - Spans 7 columns */}
                <div className="col-span-6 space-y-4">
                    {/* Win Rate, PnL and Streak Grid */}
                    <div className="grid grid-cols-3 gap-4">
                        {/* Win Rate Box */}
                        <div className="bg-base-100 p-3 rounded-lg shadow flex flex-col h-[170px]">
                            <div className="text-xs text-gray-500 truncate mb-1">Win Rate</div>
                            <div className="text-4xl font-semibold text-green-500 truncate flex items-center justify-center w-full h-full">
                                {typeof metrics.winRate === 'number' 
                                    ? metrics.winRate.toFixed(1) 
                                    : '0.0'}%
                            </div>
                        </div>

                        {/* PnL Box */}
                        <div className="bg-base-100 p-4 rounded-lg shadow">
                            <div className="mb-3">
                                <div className="text-gray-500 text-sm mb-1">Total Realized PnL</div>
                                <div className="text-lg font-bold">
                                    ${typeof metrics.totalGrossProfits === 'number'
                                        ? metrics.totalGrossProfits.toLocaleString()
                                        : '0'}
                                </div>
                            </div>
                            <div>
                                <div className="text-gray-500 text-sm mb-1">Total Unrealized PnL</div>
                                <div className="text-lg font-bold">
                                    ${typeof metrics.totalGrossLosses === 'number'
                                        ? metrics.totalGrossLosses.toLocaleString()
                                        : '0'}
                                </div>
                            </div>
                        </div>

                        {/* Current Streak */}
                        <div className="bg-base-100 p-4 rounded-lg shadow">
                            <div className="text-gray-500 text-sm mb-2">Current Streak</div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <div className="text-xs text-gray-500">Win</div>
                                    <div className="text-lg font-bold text-green-500">
                                        {typeof metrics.winCount === 'number' 
                                            ? metrics.winCount 
                                            : '0'}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500">Lose</div>
                                    <div className="text-lg font-bold text-red-500">
                                        {typeof metrics.loseCount === 'number' 
                                            ? metrics.loseCount 
                                            : '0'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Average Win and Exposure Metrics */}

                    <div className="grid grid-cols-3 gap-4">

                        {/* Avg Win */}
                        <div className="bg-base-100 p-4 rounded-lg shadow">
                            <div className="text-gray-500 text-sm mb-2">Avg Win</div>
                            <div className="text-4xl font-semibold truncate flex items-center justify-center w-full h-full">
                                {/* <div className="flex justify-between">
                                    <div className="text-xs text-gray-500">Gross</div>
                                    <div className="text-sm font-bold">${metrics.dailyExposure?.gross || 0}</div>
                                </div> */}
                            </div>
                        </div>


                        {/* Daily Exposure */}
                        <div className="bg-base-100 p-4 rounded-lg shadow">
                            <div className="text-gray-500 text-sm mb-2">Daily Exposure</div>
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <div className="text-xs text-gray-500">Risk</div>
                                    <div className="text-sm font-bold">{metrics.dailyExposure?.risk || 0}%</div>
                                </div>
                                <div className="flex justify-between">
                                    <div className="text-xs text-gray-500">Profit</div>
                                    <div className="text-sm font-bold">{metrics.dailyExposure?.profit || 0}%</div>
                                </div>
                                <div className="flex justify-between">
                                    <div className="text-xs text-gray-500">Delta</div>
                                    <div className="text-sm font-bold">{metrics.dailyExposure?.delta || 0}%</div>
                                </div>
                            </div>
                        </div>

                        {/* Period Returns */}
                        <div className="bg-base-100 p-4 rounded-lg shadow">
                            <div className="text-gray-500 text-sm mb-2">Period Returns</div>
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <div className="text-xs text-gray-500">Weekly</div>
                                    <div className="text-sm font-bold">{metrics.weeklyReturn}%</div>
                                </div>
                                <div className="flex justify-between">
                                    <div className="text-xs text-gray-500">Monthly</div>
                                    <div className="text-sm font-bold">{metrics.monthlyReturn}%</div>
                                </div>
                                <div className="flex justify-between">
                                    <div className="text-xs text-gray-500">Quarterly</div>
                                    <div className="text-sm font-bold">{metrics.quarterlyReturn}%</div>
                                </div>
                            </div>
                        </div>
                    </div>




                    {/* Average Loss, New and Open Exposure */}
                    <div className="grid grid-cols-3 gap-4">


                        {/* Average Loss */}
                        <div className="bg-base-100 p-4 rounded-lg shadow">
                            <div className="text-gray-500 text-sm mb-2">Avg Loss</div>
                            <div className="text-4xl font-semibold truncate flex items-center justify-center w-full h-full">
                                {/* <div className="flex justify-between">
                                    <div className="text-xs text-gray-500">Gross</div>
                                    <div className="text-sm font-bold">${metrics.dailyExposure?.gross || 0}</div>
                                </div> */}
                            </div>
                        </div>

                        {/* New Exposure */}
                        <div className="bg-base-100 p-4 rounded-lg shadow">
                            <div className="text-gray-500 text-sm mb-2">New Exposure</div>
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <div className="text-xs text-gray-500">Risk</div>
                                    <div className="text-sm font-bold">{metrics.newExposure?.risk || 0}%</div>
                                </div>
                                <div className="flex justify-between">
                                    <div className="text-xs text-gray-500">Profit</div>
                                    <div className="text-sm font-bold">{metrics.newExposure?.profit || 0}%</div>
                                </div>
                                <div className="flex justify-between">
                                    <div className="text-xs text-gray-500">Delta</div>
                                    <div className="text-sm font-bold">{metrics.newExposure?.delta || 0}%</div>
                                </div>
                            </div>
                        </div>

                        {/* Open Exposure */}
                        <div className="bg-base-100 p-4 rounded-lg shadow">
                            <div className="text-gray-500 text-sm mb-2">Open Exposure</div>
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <div className="text-xs text-gray-500">Risk</div>
                                    <div className="text-sm font-bold">{metrics.openExposure?.risk || 0}%</div>
                                </div>
                                <div className="flex justify-between">
                                    <div className="text-xs text-gray-500">Profit</div>
                                    <div className="text-sm font-bold">{metrics.openExposure?.profit || 0}%</div>
                                </div>
                                <div className="flex justify-between">
                                    <div className="text-xs text-gray-500">Delta</div>
                                    <div className="text-sm font-bold">{metrics.openExposure?.delta || 0}%</div>
                                </div>
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
                                <th>Entry Date</th>
                                <th>Strategy</th>
                                <th>Avg Cost</th>
                                <th>Current Price</th>
                                <th>Unrealized PnL</th>
                                <th>Realized PnL</th>
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
                                        <td>{dayjs(trade.entry_datetime).format('YYYY-MM-DD')}</td>
                                        <td>{trade.strategy}</td>
                                        <td>${trade.entry_price?.toFixed(2) || 'N/A'}</td>
                                        <td>${trade.last_price?.toFixed(2) || 'N/A'}</td>
                                        <td>${trade.unrealized_pnl?.toFixed(2) || '0.00'}</td>
                                        <td>${trade.realized_pnl?.toFixed(2) || '0.00'}</td>
                                        <td>{trade.trimmed_percentage?.toFixed(2) || '0'}%</td>
                                        <td>{trade.open_risk?.toFixed(2) || 'N/A'}%</td>
                                        <td>{trade.portfolio_weight?.toFixed(2) || 'N/A'}%</td>
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
