import React, { useState, useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { supabase } from '../../config/supabaseClient'
import { toast } from 'react-toastify'
import TitleCard from '../../components/Cards/TitleCard'
import Chart from 'chart.js/auto'
import dayjs from 'dayjs'
import { metricsService } from '../../features/metrics/metricsService';
import { closeTrade } from '../../features/trades/tradesSlice'
import TradeHistoryModal from '../../features/user/components/TradeHistory/TradeHistoryModal';
import { Trade, TRADE_STATUS, DIRECTIONS, ASSET_TYPES, STRATEGIES, SETUPS } from '../../types/index';
import { capitalService } from '../../services/capitalService'
import { marketDataService } from '../../features/marketData/marketDataService'
import { userSettingsService } from '../../services/userSettingsService'
import { DeltaGauge } from '../../components/charts/DeltaGauge';
import { DeltaSparkline } from '../../components/charts/DeltaSparkline';
import TradeCalendar from '../../components/calendar/TradeCalendar';
import EquityMetricsChart from '../../components/charts/EquityMetricsChart';

// Time filter buttons configuration
const timeFilters = [
    { label: "Today", days: 0 },
    { label: "Yesterday", days: 1 },
    { label: "Last Week", days: 7 },
    { label: "Last Month", days: 30 },
    { label: "All Time", days: null }
];

function PortfolioOverview() {
    const dispatch = useDispatch()
    const allTrades = useSelector(state => state.trades.trades)
    const [trades, setTrades] = useState([])
    const [activeTrades, setActiveTrades] = useState([])
    const [currentDate] = useState(dayjs().format('MMMM D, YYYY'))
    const [selectedTimeFilter, setSelectedTimeFilter] = useState(timeFilters[0])
    const [selectedTradeDetails, setSelectedTradeDetails] = useState(null);  // Add this line
    const [isAutoRefresh, setIsAutoRefresh] = useState(true)
    const [lastUpdate, setLastUpdate] = useState(null)
    const [startingCapital, setStartingCapital] = useState(0)
    const [currentCapital, setCurrentCapital] = useState(0);
    const [loading, setLoading] = useState(false);
    const [metricsLoading, setMetricsLoading] = useState(false);
    const [historicalMetrics, setHistoricalMetrics] = useState([]);
    const [capitalHistory, setCapitalHistory] = useState([]);
    const capitalChartRef = useRef(null);
    const capitalChartInstance = useRef(null);

    useEffect(() => {
        const fetchUserSettings = async () => {
            try {
                const settings = await userSettingsService.getUserSettings();
                setStartingCapital(settings.starting_cash ?? 25000); // Fallback to 25000 if not set
            } catch (error) {
                console.error('Error fetching user settings:', error);
                // Optionally handle the error, e.g., show a toast notification
            }
        };

        fetchUserSettings();
    }, []); // Empty dependency array to run only once on mount

    // Initialize metrics with default values
    const [metrics, setMetrics] = useState({
        exposureMetrics: null,
        maxDrawdown: 0,
        maxRunup: 0,
        profitFactor: 0,
        avgRRR: 0,
        winRate: 0,
        expectancy: 0,
        totalTrades: 0,
        profitableTradesCount: 0,
        lossTradesCount: 0,
        currentStreak: 0,
        longestWinStreak: 0,
        longestLossStreak: 0
    });

    const [selectedTrade, setSelectedTrade] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Modified useEffect
    useEffect(() => {
        if (selectedTrade) {
            console.log('In Overview, Fetching selected trade info for', selectedTrade);
            fetchTradeDetails(selectedTrade.id);
        }
    }, [selectedTrade?.id]); // Only depend on the ID

    // Function to fetch the details of a specific trade to display in a modal, usually when a trade is clicked 
    const fetchTradeDetails = async (tradeId) => {
        console.log(`----- Processing fetchTradeDetails for trade ID ----- : ${tradeId}`); // Noticeable log statement

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
            setSelectedTradeDetails(trade);
            setIsModalOpen(true); // Move this here to avoid flicker
        } catch (error) {
            console.error('Error fetching trade details:', error);
            toast.error('Failed to fetch trade details');
        }
    };

    // Function to handle closing the modal
    const closeModal = () => {
        setIsModalOpen(false);
        // Instead of resetting selectedTrade to null, update it with latest market data
        if (selectedTrade) {
            updateMarketData();
        }
        setSelectedTrade(null);
    };

    const handleTradeClick = (trade) => {
        console.log("Fetching trade with ID:", trade.id);
        fetchTradeDetails(trade.id);
    };

    const safeToFixed = (number, decimals = 2) => {
        if (number === undefined || number === null) return '0.00';
        return Number(number).toFixed(decimals);
    };

    const formatCurrency = (amount) => {
        if (amount === undefined || amount === null) return '$0.00';
        return `$${safeToFixed(amount)}`;
    };

    const TitleCard = ({ title, headerContent, children, topMargin }) => {
        return (
            <div className={`card w-full bg-base-100 shadow-lg ${topMargin}`}>
                <div className="card-body">
                    <div className="flex justify-between items-center border-b border-base-300 pb-2">
                        <h2 className="card-title">{title}</h2>
                        {headerContent}
                    </div>
                    {children}
                </div>
            </div>
        );
    };

    // Initial load and auto-refresh
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                setLoading(true);
                setMetricsLoading(true);

                // Check cache first
                const cachedData = localStorage.getItem('portfolioMetricsCache');
                if (cachedData) {
                    const { timestamp, data } = JSON.parse(cachedData);
                    const cacheAge = Date.now() - timestamp;
                    const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

                    if (cacheAge < CACHE_DURATION) {
                        console.log('🟢 Using cached portfolio metrics');
                        setCurrentCapital(data.currentCapital);
                        setActiveTrades(data.activeTrades || []);
                        setMetrics(data.metrics);
                        setLastUpdate(data.lastUpdate);
                        setLoading(false);
                        setMetricsLoading(false);
                        return;
                    }
                }

                // Fetch user authentication once
                const { data: { user }, error: userError } = await supabase.auth.getUser();
                if (userError || !user) {
                    console.error('Authentication error:', userError);
                    return;
                }

                // Parallel fetch of all initial data
                console.log('----------- Fetching initial data... -----------');
                const [
                    currentCapital,
                    { data: openTrades },
                    { data: allTrades },
                    latestMetrics
                ] = await Promise.all([
                    capitalService.calculateCurrentCapital(), // Use calculateCurrentCapital instead of getCurrentCapital
                    supabase
                        .from('trades')
                        .select('*')
                        .eq('user_id', user.id)
                        .eq('status', 'Open')  // Match the enum value exactly
                        .order('entry_datetime', { ascending: false }),
                    supabase
                        .from('trades')
                        .select('*')
                        .eq('user_id', user.id)
                        .order('entry_datetime', { ascending: false }),
                    metricsService.fetchLatestPortfolioMetrics(user.id, false)
                ]);
                console.log("Initial fetch curr cap:", currentCapital);
                console.log('----------- Latest Portfolio Metrics Fetched: -----------', latestMetrics);

                // Calculate fresh exposure metrics
                const freshExposureMetrics = await metricsService.calculateExposureMetrics(openTrades || [], currentCapital);
                console.log('----------- Fresh Exposure Metrics Calculated: -----------', freshExposureMetrics);

                // Merge fresh exposure metrics into latestMetrics
                const updatedLatestMetrics = {
                    ...latestMetrics,
                    delta_de: freshExposureMetrics.deltaDE,
                    delta_ne: freshExposureMetrics.deltaNE,
                    delta_oe: freshExposureMetrics.deltaOE,
                    dep: freshExposureMetrics.dep,
                    der: freshExposureMetrics.der,
                    nep: freshExposureMetrics.nep,
                    ner: freshExposureMetrics.ner,
                    oep: freshExposureMetrics.oep,
                    oer: freshExposureMetrics.oer
                };
                console.log('----------- Updated Latest Metrics: -----------', updatedLatestMetrics);

                // Update all states
                setCurrentCapital(currentCapital);
                setActiveTrades(openTrades || []);
                setTrades(allTrades || []);

                if (latestMetrics) {
                    setMetrics(prevMetrics => ({
                        ...prevMetrics,
                        profitFactor: updatedLatestMetrics.profit_factor ?? prevMetrics.profitFactor,
                        avgRRR: updatedLatestMetrics.avg_rrr ?? prevMetrics.avgRRR,
                        winRate: updatedLatestMetrics.win_rate ?? prevMetrics.winRate,
                        expectancy: updatedLatestMetrics.expectancy ?? prevMetrics.expectancy,
                        totalTrades: updatedLatestMetrics.total_trades ?? prevMetrics.totalTrades,
                        profitableTradesCount: updatedLatestMetrics.profitable_trades_count ?? prevMetrics.profitableTradesCount,
                        lossTradesCount: updatedLatestMetrics.loss_trades_count ?? prevMetrics.lossTradesCount,
                        currentStreak: updatedLatestMetrics.current_streak ?? prevMetrics.currentStreak,
                        longestWinStreak: updatedLatestMetrics.longest_win_streak ?? prevMetrics.longestWinStreak,
                        longestLossStreak: updatedLatestMetrics.longest_loss_streak ?? prevMetrics.longestLossStreak,
                        maxDrawdown: updatedLatestMetrics.max_drawdown ?? prevMetrics.maxDrawdown,
                        maxRunup: updatedLatestMetrics.max_runup ?? prevMetrics.maxRunup,
                        // Map exposure metrics to UI structure
                        dailyExposure: {
                            risk: freshExposureMetrics.der.toFixed(2),
                            profit: freshExposureMetrics.dep.toFixed(2),
                            delta: freshExposureMetrics.deltaDE.toFixed(2)
                        },
                        newExposure: {
                            risk: freshExposureMetrics.ner.toFixed(2),
                            profit: freshExposureMetrics.nep.toFixed(2),
                            delta: freshExposureMetrics.deltaNE.toFixed(2)
                        },
                        openExposure: {
                            risk: freshExposureMetrics.oer.toFixed(2),
                            profit: freshExposureMetrics.oep.toFixed(2),
                            delta: freshExposureMetrics.deltaOE.toFixed(2)
                        }
                    }));
                }

                // If we have trades, filter for active ones and fetch their market data
                if (openTrades && openTrades.length > 0) {
                    const quotes = await marketDataService.getBatchQuotes(openTrades.map(trade => trade.ticker));

                    const updatedTrades = openTrades.map(trade => {
                        const quote = quotes[trade.ticker];
                        if (!quote) return trade;

                        const unrealizedPnL = (quote.price - trade.entry_price) * trade.remaining_shares;
                        const unrealizedPnLPercent = (unrealizedPnL / (trade.entry_price * trade.remaining_shares)) * 100;

                        return {
                            ...trade,
                            currentPrice: quote.price,
                            lastUpdate: quote.lastUpdate,
                            unrealized_pnl: unrealizedPnL,
                            unrealized_pnl_percent: unrealizedPnLPercent
                        };
                    });

                    setActiveTrades(updatedTrades);
                    setLastUpdate(new Date().toLocaleTimeString());
                }

                // Cache the current state
                const cacheData = {
                    timestamp: Date.now(),
                    data: {
                        currentCapital,
                        activeTrades: openTrades || [],
                        metrics,
                        lastUpdate: new Date().toLocaleTimeString()
                    }
                };
                localStorage.setItem('portfolioMetricsCache', JSON.stringify(cacheData));
                console.log('🔵 Cached fresh portfolio metrics');

            } catch (error) {
                console.error('Error fetching initial data:', error);
                toast.error('Error loading portfolio data');
            } finally {
                setLoading(false);
                setMetricsLoading(false);
            }
        };

        fetchInitialData();
    }, []);

    // Add this useEffect for auto-refresh
    useEffect(() => {
        let intervalId;
        if (isAutoRefresh) {
            const fetchData = async () => {
                await updateMarketData();
            };
            fetchData(); // Initial fetch
            intervalId = setInterval(fetchData, 900000); // 15 minutes
        }
        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [isAutoRefresh]);

    // Function to update market data
    const updateMarketData = async () => {
        if (!activeTrades || activeTrades.length === 0) return;

        try {
            setLoading(true);
            setMetricsLoading(true);
            
            // Get fresh market data
            const quotes = await marketDataService.getBatchQuotes(activeTrades.map(trade => trade.ticker));
            const updatedTrades = await metricsService.updateTradesWithDetailedMetrics(quotes, activeTrades);
            setActiveTrades(updatedTrades);
            setLastUpdate(new Date().toLocaleTimeString());

            // Update metrics with loading state
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                // Get fresh capital calculation
                const freshCapital = await capitalService.calculateCurrentCapital();
                setCurrentCapital(freshCapital);

                // Record capital snapshot with trade details
                await capitalService.recordCapitalChange(freshCapital, {
                    type: 'interim_snapshot',
                    trades_count: updatedTrades.length,
                    trade_details: updatedTrades.map(trade => ({
                        ticker: trade.ticker,
                        unrealized_pnl: trade.unrealized_pnl || 0
                    })),
                    high_watermark: freshCapital
                });

                // Calculate exposure metrics with updated market prices
                const exposureMetrics = await metricsService.calculateExposureMetrics(
                    updatedTrades,
                    freshCapital,
                    quotes
                );

                // Upsert exposure metrics
                await metricsService.upsertExposureMetrics(user.id, exposureMetrics);

                const latestMetrics = await metricsService.fetchLatestPortfolioMetrics(user.id, true);

                console.log('---------------- 🚀🚀 Latest Metrics:', exposureMetrics);
                if (latestMetrics) {
                    const newMetrics = {
                        ...metrics,
                        profitFactor: latestMetrics.profit_factor ?? metrics.profitFactor,
                        avgRRR: latestMetrics.avg_rrr ?? metrics.avgRRR,
                        winRate: latestMetrics.win_rate ?? metrics.winRate,
                        expectancy: latestMetrics.expectancy ?? metrics.expectancy,
                        totalTrades: latestMetrics.total_trades ?? metrics.totalTrades,
                        profitableTradesCount: latestMetrics.profitable_trades_count ?? metrics.profitableTradesCount,
                        lossTradesCount: latestMetrics.loss_trades_count ?? metrics.lossTradesCount,
                        currentStreak: latestMetrics.current_streak ?? metrics.currentStreak,
                        longestWinStreak: latestMetrics.longest_win_streak ?? metrics.longestWinStreak,
                        longestLossStreak: latestMetrics.longest_loss_streak ?? metrics.longestLossStreak,
                        maxDrawdown: latestMetrics.max_drawdown ?? metrics.maxDrawdown,
                        maxRunup: latestMetrics.max_runup ?? metrics.maxRunup,
                        // Map exposure metrics to UI structure
                        dailyExposure: {
                            risk: exposureMetrics.der.toFixed(2),
                            profit: exposureMetrics.dep.toFixed(2),
                            delta: exposureMetrics.deltaDE.toFixed(2)
                        },
                        newExposure: {
                            risk: exposureMetrics.ner.toFixed(2),
                            profit: exposureMetrics.nep.toFixed(2),
                            delta: exposureMetrics.deltaNE.toFixed(2)
                        },
                        openExposure: {
                            risk: exposureMetrics.oer.toFixed(2),
                            profit: exposureMetrics.oep.toFixed(2),
                            delta: exposureMetrics.deltaOE.toFixed(2)
                        }
                    };
                    setMetrics(newMetrics);

                    console.log(" ===== Metrics after update ===== :", metrics);

                    // Update cache with new data
                    const cacheData = {
                        timestamp: Date.now(),
                        data: {
                            currentCapital: freshCapital,
                            activeTrades: updatedTrades,
                            metrics: newMetrics,
                            lastUpdate: new Date().toLocaleTimeString()
                        }
                    };
                    localStorage.setItem('portfolioMetricsCache', JSON.stringify(cacheData));
                    console.log('🔵 Updated portfolio metrics cache');
                }
            }
        } catch (error) {
            console.error('Error updating market data:', error);
            toast.error(error.message || 'Failed to update market data');
        } finally {
            setLoading(false);
            setMetricsLoading(false);
        }
    };

    // Fetch active trades from Supabase
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
                .eq('status', 'Open')  // Match the enum value exactly
                .order('entry_datetime', { ascending: false });

            if (error) {
                console.error('Error fetching active trades:', error)
                toast.error('Failed to fetch active trades')
                return
            }

            console.log('Active Trades Fetched:', {
                count: data.length,
                trades: data.map(trade => ({
                    id: trade.id,
                    ticker: trade.ticker,
                    status: trade.status,
                    shares_remaining: trade.remaining_shares,
                    entry_date: dayjs(trade.entry_datetime).format('YYYY-MM-DD'),
                    full_entry_datetime: trade.entry_datetime
                }))
            });

            if (data.length === 0) {
                toast.info('No active trades found')
            }

            setActiveTrades(data || [])
        } catch (error) {
            console.error('Unexpected error fetching active trades:', error)
            toast.error('Unexpected error occurred')
        }
    };

    useEffect(() => {
        fetchActiveTrades();
    }, []);

    useEffect(() => {
        const fetchHistoricalData = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const data = await metricsService.fetchHistoricalExposureMetrics(user.id);
                    setHistoricalMetrics(data);
                }
            } catch (error) {
                console.error('Error fetching historical metrics:', error);
            }
        };

        fetchHistoricalData();
    }, []);

    useEffect(() => {
        const fetchCapitalHistory = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                
                const { data, error } = await supabase
                    .from('capital_changes')
                    .select('date, capital_amount')
                    .eq('user_id', user.id)
                    .order('date', { ascending: true });

                if (error) throw error;
                
                console.log('Capital history data:', data?.map(item => ({
                    date: item.date,
                    amount: item.capital_amount.toLocaleString('en-US', {
                        style: 'currency',
                        currency: 'USD'
                    })
                })));
                
                setCapitalHistory(data || []);
            } catch (error) {
                console.error('Error fetching capital history:', error);
            }
        };

        fetchCapitalHistory();
    }, []);

    useEffect(() => {
        if (!capitalHistory.length || !capitalChartRef.current) return;

        // Destroy existing chart if it exists
        if (capitalChartInstance.current) {
            capitalChartInstance.current.destroy();
        }

        const ctx = capitalChartRef.current.getContext('2d');
        
        capitalChartInstance.current = new Chart(ctx, {
            type: 'line',
            data: {
                labels: capitalHistory.map(item => dayjs(item.date).format('MM/DD')),
                datasets: [{
                    label: 'Capital',
                    data: capitalHistory.map(item => item.capital_amount),
                    borderColor: '#10b981', // emerald-500
                    tension: 0.4,
                    pointRadius: 2,
                    pointHoverRadius: 5,
                    borderWidth: 2,
                    fill: true,
                    backgroundColor: (context) => {
                        const ctx = context.chart.ctx;
                        const gradient = ctx.createLinearGradient(0, 0, 0, 100);
                        gradient.addColorStop(0, 'rgba(16, 185, 129, 0.2)');
                        gradient.addColorStop(1, 'rgba(16, 185, 129, 0)');
                        return gradient;
                    }
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 12,
                        titleColor: '#fff',
                        titleFont: {
                            size: 12,
                            weight: 'normal'
                        },
                        bodyColor: '#fff',
                        bodyFont: {
                            size: 14,
                            weight: 'bold'
                        },
                        displayColors: false,
                        callbacks: {
                            title: (tooltipItems) => {
                                const idx = tooltipItems[0].dataIndex;
                                const date = capitalHistory[idx].date;
                                return dayjs(date).format('MMM D, YYYY');
                            },
                            label: (context) => {
                                return `$${context.raw.toLocaleString(undefined, {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0
                                })}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: false,
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        display: false,
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });

        return () => {
            if (capitalChartInstance.current) {
                capitalChartInstance.current.destroy();
            }
        };
    }, [capitalHistory]);

    useEffect(() => {
        if (lastUpdate) {
            const fetchCapitalHistory = async () => {
                try {
                    const { data: { user } } = await supabase.auth.getUser();
                    
                    const { data, error } = await supabase
                        .from('capital_changes')
                        .select('date, capital_amount')
                        .eq('user_id', user.id)
                        .order('date', { ascending: true });

                    if (error) throw error;
                    setCapitalHistory(data || []);
                } catch (error) {
                    console.error('Error fetching capital history:', error);
                }
            };

            fetchCapitalHistory();
        }
    }, [lastUpdate]);

    return (
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
            <div className="grid grid-cols-5 gap-5 mb-7">
                {/* Each metric card with better overflow handling */}
                <div className="stats bg-base-100 shadow-lg hover:shadow-lg hover:shadow-primary/10 h-36">
                    <div className="stat">
                        <div className="stat-title text-xs text-gray-400">Current Capital</div>
                        <div className="stat-value text-2xl font-semibold">
                            ${currentCapital.toLocaleString(undefined, {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0
                            })}
                        </div>
                        <div className="stat-desc text-emerald-500 text-xs mt-3">
                            {startingCapital > 0
                                ? ((currentCapital - startingCapital) / startingCapital * 100).toFixed(1)
                                : '0.0'}% from start
                        </div>
                    </div>
                </div>

                <div className="stats bg-base-100 shadow-lg hover:shadow-lg hover:shadow-primary/10">
                    <div className="stat">
                        <div className="stat-title text-xs text-gray-500">Profit Factor</div>
                        <div className="stat-value text-2xl font-semibold">
                            {typeof metrics.profitFactor === 'number'
                                ? metrics.profitFactor.toFixed(2)
                                : '0.00'}
                        </div>
                        <div className="stat-desc text-emerald-500 text-xs mt-3">+8.1% from last</div>
                    </div>
                </div>

                <div className="stats bg-base-100 shadow-lg hover:shadow-lg hover:shadow-primary/10">
                    <div className="stat">
                        <div className="stat-title text-xs text-gray-500">RRR</div>
                        <div className="stat-value text-2xl font-semibold">
                            {typeof metrics.avgRRR === 'number'
                                ? metrics.avgRRR.toFixed(2)
                                : '0.00'}
                        </div>
                        <div className="stat-desc text-emerald-500 text-xs mt-3">+4.2% from last</div>
                    </div>
                </div>

                <div className="stats bg-base-100 shadow-lg hover:shadow-lg hover:shadow-primary/10 col-span-2">
                    <div className="stat w-full h-32">
                        <div className="stat-title text-xs text-gray-500">Capital History</div>
                        <div className="w-full h-24 mt-1">
                            <canvas ref={capitalChartRef} />
                        </div>
                    </div>
                </div>
            </div>
            {/* Active Trades */}
            <div className="mt-4 max-h-[800px]">
                <TitleCard
                    title={
                        <div className="w-full flex justify-between items-center gap-4">
                            <h2 className="text-xl top-2 font-semibold items-center gap-4">Active Trades</h2>
                            <div className="absolute top-5 right-4 flex items-center gap-4">
                                <button
                                    onClick={() => setIsAutoRefresh(!isAutoRefresh)}
                                    className={`btn btn-sm ${isAutoRefresh ? 'btn-primary' : 'btn-success'}`}
                                >
                                    {isAutoRefresh ? 'Stop Auto Update' : 'Start Auto Update'}
                                </button>
                                <button
                                    onClick={updateMarketData}
                                    className="btn btn-sm btn-info"
                                >
                                    Update Prices
                                </button>
                                {lastUpdate && <span className="text-sm text-gray-500">Last update: {lastUpdate}</span>}
                            </div>
                        </div>
                    }
                    topMargin="mt-2"
                >
                    <div>
                        {/* Active Trades Table */}
                        {/* More pronounced version */}
                        <div className="bg-base-100 rounded-lg hover:shadow-lg hover:shadow-primary/10 shadow overflow-x-auto">
                            <table className="table w-full ">
                                <thead>
                                    <tr>
                                        <th className="text-center whitespace-nowrap">Ticker</th>
                                        <th className="text-center whitespace-nowrap">Direction</th>
                                        <th className="text-center whitespace-nowrap">Entry Date</th>
                                        <th className="text-center whitespace-nowrap">Avg Cost</th>
                                        <th className="text-center whitespace-nowrap">Current Price</th>
                                        <th className="text-center whitespace-nowrap">Weight %</th>
                                        <th className="text-center whitespace-nowrap">Trimmed %</th>
                                        <th className="text-center whitespace-nowrap">Unrealized PnL%</th>
                                        <th className="text-center whitespace-nowrap">Realized PnL%</th>
                                        <th className="text-center whitespace-nowrap">RRR</th>
                                        {/* <th className="text-center whitespace-nowrap">SL Distance</th> */}
                                        <th className="text-center whitespace-nowrap">Position Risk</th>
                                        <th className="text-center whitespace-nowrap">Value at Risk</th>
                                        <th className="text-center whitespace-nowrap">Portfolio Impact</th>
                                        {/* <th className="text-center whitespace-nowrap">MAE</th>
                                        <th className="text-center whitespace-nowrap">MFE</th> */}
                                        <th className="text-center whitespace-nowrap">Strategy</th>
                                        {/* <th className="text-center whitespace-nowrap">33% SL</th>
                                        <th className="text-center whitespace-nowrap">66% SL</th> */}
                                        <th className="text-center whitespace-nowrap">Trailing SL</th>
                                        <th className="text-center whitespace-nowrap">Final SL</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeTrades.length === 0 ? (
                                        <tr><td colSpan="14" className="text-center flex items-center text-gray-500">No active positions</td></tr>
                                    ) : (
                                        activeTrades.map((trade, index) => {
                                            const totalCost = trade.total_cost;
                                            const unrealizedPnL = trade.unrealized_pnl || 0;
                                            const realizedPnL = trade.realized_pnl || 0;
                                            const isProfitable = (totalCost + unrealizedPnL + realizedPnL) > totalCost;

                                            const getPortfolioWeightClass = (weight) => {
                                                if (weight > 30) {
                                                    return 'text-rose-400';
                                                }
                                                return ''; // Default class for other weights
                                            };

                                            return (
                                                <tr
                                                    key={index}
                                                    className="hover:bg-base-200 cursor-pointer"
                                                    onClick={() => handleTradeClick(trade)}
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
                                                        <span className={`
                                                                badge badge-pill 
                                                                ${trade.direction === DIRECTIONS.LONG ? 'bg-emerald-600 text-white' : 'bg-rose-500 text-white'}
                                                            `}>
                                                            {trade.direction || 'N/A'}
                                                        </span>
                                                    </td>

                                                    {/* Dates and Numbers */}
                                                    <td className="text-center whitespace-nowrap">
                                                        {trade.entry_datetime ?
                                                            new Date(trade.entry_datetime).toISOString().split('T')[0] : ''}
                                                    </td>                                            <td>${trade.entry_price?.toFixed(2) || 'N/A'}</td>

                                                    <td className="text-center font-medium">
                                                        {formatCurrency(trade.last_price)}
                                                    </td>

                                                    <td className={`text-center ${getPortfolioWeightClass(trade.portfolio_weight)}`}>
                                                        {safeToFixed(trade.portfolio_weight)}%
                                                    </td>

                                                    <td className="text-center">
                                                        {safeToFixed(trade.trimmed_percentage)}%
                                                    </td>

                                                    <td className={`
                                                        text-center font-semibold tabular-nums
                                                        ${trade.unrealized_pnl_percentage > 0 ? 'text-emerald-400' : 'text-rose-400'}
                                                    `}>
                                                        {trade.unrealized_pnl_percentage > 0 ? '+' : ''}
                                                        {safeToFixed(trade.unrealized_pnl_percentage)}%
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
                                                            ${trade.risk_reward_ratio > 1 ? 'text-emerald-400' : 'text-rose-400'}
                                                        `}>
                                                        {safeToFixed(trade.risk_reward_ratio, 1)}
                                                    </td>

                                                    {/* <td className={`
                                                            text-center font-semibold tabular-nums
                                                            ${trade.open_risk > 0 ? 'text-rose-400' : 'text-emerald-400'}
                                                        `}>
                                                            {trade.open_risk > 0 ? '-' : ''}{safeToFixed(trade.open_risk, 2)}%
                                                    </td> */}

                                                    <td className={`
                                                        text-center font-semibold tabular-nums
                                                        ${trade.initial_position_risk > 0 ? 'text-rose-400' : 'text-emerald-400'}
                                                    `}>
                                                        {trade.initial_position_risk > 0 ? '-' : ''}{safeToFixed(trade.initial_position_risk, 3)}%
                                                    </td>

                                                    <td className={`text-center font-semibold tabular-nums ${trade.current_var > 0 ? 'text-rose-400' : ''}`}>
                                                        {trade.current_var > 0 ? `${safeToFixed(trade.current_var, 3)}%` : '-'}
                                                    </td>

                                                    <td className={`
                                                        text-center font-semibold tabular-nums
                                                        ${trade.portfolio_impact > 0 ? 'text-emerald-400' : 'text-rose-400'}
                                                    `}>
                                                        {trade.portfolio_impact > 0 ? '+' : ''}{safeToFixed(trade.portfolio_impact, 2)}%
                                                    </td>

                                                    {/* <td className="text-center font-semibold tabular-nums text-rose-400">
                                                        {safeToFixed(trade.mae, 1)}%
                                                    </td>
                                                    <td className="text-center font-semibold tabular-nums text-emerald-400">
                                                        {safeToFixed(trade.mfe, 1)}%
                                                    </td> */}

                                                    <td className="text-center">
                                                        {trade.strategy ? (
                                                            <span className="badge badge-pill glass bg-neutral text-white">
                                                                {trade.strategy}
                                                            </span>
                                                        ) : 'N/A'}
                                                    </td>

                                                    {/* <td className="text-center">
                                                            {formatCurrency(trade.stop_loss_33_percent)}
                                                    </td>
                                                    <td className="text-center">
                                                        {formatCurrency(trade.stop_loss_66_percent)}
                                                    </td> */}
                                                    <td className="text-center">
                                                        {formatCurrency(trade.trailing_stoploss)}
                                                    </td>
                                                    <td className="text-center">
                                                        {formatCurrency(trade.stop_loss_price)}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <TradeHistoryModal
                        isOpen={isModalOpen}
                        onClose={closeModal}
                        onTradeAdded={fetchActiveTrades}
                        existingTrade={selectedTradeDetails}  // Pass the details instead
                    />
                </TitleCard>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-12 mt-6 gap-6">
                {/* Trade Calendar - Now below the equity curve */}
                <div className="col-span-8 bg-base-100 p-6 rounded-lg hover:shadow-lg hover:shadow-primary/10 shadow">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold">Trade Calendar</h2>
                        <div className="text-sm text-gray-500 bg-base-200 px-3 py-1 rounded-full">
                            Starting Capital: <span className="font-semibold text-gray-400">${startingCapital.toLocaleString()}</span>
                        </div>
                    </div>
                    <TradeCalendar
                        trades={trades}
                        startingCapital={startingCapital}
                        onDateClick={(date) => {
                            console.log('Selected date:', date);
                        }}
                        onMonthChange={(start, end) => {
                            console.log('Month changed:', { start, end });
                            // You can fetch trades for the new month here
                        }}
                    />
                </div>

                {/* Right Side Stats - Spans 7 columns */}
                <div className="col-span-4 space-y-4">
                    {/* Win Rate, PnL and Streak Grid */}
                    <div className="grid grid-cols-2 gap-4">

                        {/* Daily Exposure */}
                        <div className="h-48 bg-base-100 p-4 rounded-lg hover:shadow-lg hover:shadow-primary/10 shadow flex flex-col">
                            <div className="text-primary text-sm font-semibold">Daily Exposure</div>
                            {/* Added justify-center to center the content vertically */}
                            <div className="flex-1 flex flex-col justify-center">
                                <div className="flex flex-col items-center mb-1 mt-auto">
                                    <DeltaGauge
                                        profit={Number(metrics.dailyExposure?.profit) || 0}
                                        risk={Number(metrics.dailyExposure?.risk) || 0}
                                        size={100}
                                    />
                                </div>
                                <div className="space-y-1 mt-auto">
                                    <div className="flex justify-between items-center">
                                        <div className="text-xs">Daily Risk</div>
                                        <div className={`text-sm font-bold text-rose-500 ${metricsLoading ? 'opacity-50' : ''}`}>
                                            {metrics.dailyExposure?.risk || '0.00'}%
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <div className="text-xs">Daily Profit</div>
                                        <div className={`text-sm font-bold text-emerald-500 ${metricsLoading ? 'opacity-50' : ''}`}>
                                            {metrics.dailyExposure?.profit || '0.00'}%
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* PnL Box */}
                        {/* <div className="bg-base-100 p-4 rounded-lg hover:shadow-lg hover:shadow-primary/10 shadow">
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
                        </div> */}

                        {/* Current Streak */}
                        {/* <div className="bg-base-100 p-4 rounded-lg hover:shadow-lg hover:shadow-primary/10 shadow">
                            <div className="text-gray-500 text-sm mb-2">Current Streak</div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <div className="text-xs text-gray-500">Win</div>
                                    <div className={`text-lg font-bold text-green-500 ${metricsLoading ? 'opacity-50' : ''}`}>
                                        {typeof metrics.winCount === 'number'
                                            ? metrics.winCount
                                            : '0'}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500">Lose</div>
                                    <div className={`text-lg font-bold text-red-500 ${metricsLoading ? 'opacity-50' : ''}`}>
                                        {typeof metrics.loseCount === 'number'
                                            ? metrics.loseCount
                                            : '0'}
                                    </div>
                                </div>
                            </div>
                        </div> */}

                        {/* Win Rate Box */}
                        <div className="bg-base-100 p-4 rounded-lg hover:shadow-lg hover:shadow-primary/10 shadow">
                            <div className="text-sm text-primary truncate">Win Rate</div>
                            <div className={`text-4xl font-semibold truncate flex items-center justify-center w-full h-full ${metricsLoading ? 'opacity-50' : ''}`}>
                                {typeof metrics.winRate === 'number'
                                    ? metrics.winRate.toFixed(1)
                                    : '0.0'}%
                            </div>
                        </div>
                    </div>

                    {/* Average Win and Exposure Metrics */}

                    <div className="grid grid-cols-2 gap-4">

                        {/* Avg Win */}
                        {/* <div className="bg-base-100 p-4 rounded-lg hover:shadow-lg hover:shadow-primary/10 shadow">
                            <div className="text-gray-500 text-sm mb-2">Avg Win</div>
                            <div className={`text-4xl font-semibold truncate flex items-center justify-center w-full h-full ${metricsLoading ? 'opacity-50' : ''}`}>
                                <div className="flex justify-between">
                                    <div className="text-xs text-gray-500">Gross</div>
                                    <div className="text-sm font-bold">${metrics.dailyExposure?.gross || 0}</div>
                                </div>
                            </div>
                        </div> */}

                        {/* Average Loss */}
                        {/* /* <div className="bg-base-100 p-4 rounded-lg hover:shadow-lg hover:shadow-primary/10 shadow">
                            <div className="text-gray-500 text-sm mb-2">Avg Loss</div>
                            <div className={`text-4xl font-semibold truncate flex items-center justify-center w-full h-full ${metricsLoading ? 'opacity-50' : ''}`}>
                                <div className="flex justify-between">
                                    <div className="text-xs text-gray-500">Gross</div>
                                    <div className="text-sm font-bold">${metrics.dailyExposure?.gross || 0}</div>
                                </div>
                            </div>
                        </div> */ }


                        {/* Period Returns */}
                        {/* <div className="bg-base-100 p-4 rounded-lg hover:shadow-lg hover:shadow-primary/10 shadow">
                            <div className="text-gray-500 text-sm mb-2">Period Returns</div>
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <div className="text-xs text-gray-500">Weekly</div>
                                    <div className={`text-sm font-bold ${metricsLoading ? 'opacity-50' : ''}`}>{metrics.weeklyReturn}%</div>
                                </div>
                                <div className="flex justify-between">
                                    <div className="text-xs text-gray-500">Monthly</div>
                                    <div className={`text-sm font-bold ${metricsLoading ? 'opacity-50' : ''}`}>{metrics.monthlyReturn}%</div>
                                </div>
                                <div className="flex justify-between">
                                    <div className="text-xs text-gray-500">Quarterly</div>
                                    <div className={`text-sm font-bold ${metricsLoading ? 'opacity-50' : ''}`}>{metrics.quarterlyReturn}%</div>
                                </div>
                            </div>
                        </div> */}

                        {/* New Exposure */}
                        <div className="h-48 bg-base-100 p-4 rounded-lg hover:shadow-lg hover:shadow-primary/10 shadow flex flex-col">
                            <div className="text-primary text-sm font-semibold">New Exposure</div>
                            {/* Added justify-center to center the content vertically */}
                            <div className="flex-1 flex flex-col justify-center">
                                <div className="flex flex-col items-center mb-1 mt-auto">
                                    <DeltaGauge
                                        profit={Number(metrics.newExposure?.profit) || 0}
                                        risk={Number(metrics.newExposure?.risk) || 0}
                                        size={100}
                                    />
                                </div>
                                <div className="space-y-1 mt-auto">
                                    <div className="flex justify-between items-center">
                                        <div className="text-xs">New Risk</div>
                                        <div className={`text-sm font-bold text-rose-500 ${metricsLoading ? 'opacity-50' : ''}`}>
                                            {metrics.newExposure?.risk || '0.00'}%
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <div className="text-xs">New Profit</div>
                                        <div className={`text-sm font-bold text-emerald-500 ${metricsLoading ? 'opacity-50' : ''}`}>
                                            {metrics.newExposure?.profit || '0.00'}%
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="h-48 bg-base-100 p-4 rounded-lg hover:shadow-lg hover:shadow-primary/10 shadow flex flex-col">
                            <div className="text-primary text-sm font-semibold">Trade Stats</div>
                            {/* Added justify-center to center the content vertically */}
                            <div className="flex-1 flex flex-col justify-center">

                                <div className="space-y-1 mt-auto">

                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Average Loss, New and Open Exposure */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* Open Exposure */}
                        <div className="h-48 bg-base-100 p-4 rounded-lg hover:shadow-lg hover:shadow-primary/10 shadow flex flex-col">
                            <div className="text-primary text-sm font-semibold">Open Exposure</div>
                            {/* Added justify-center to center the content vertically */}
                            <div className="flex-1 flex flex-col justify-center">
                                <div className="flex flex-col items-center mb-1 mt-auto">
                                    <DeltaGauge
                                        profit={Number(metrics.openExposure?.profit) || 0}
                                        risk={Number(metrics.openExposure?.risk) || 0}
                                        size={100}
                                    />
                                </div>
                                <div className="space-y-1 mt-auto">
                                    <div className="flex justify-between items-center">
                                        <div className="text-xs">Open Risk</div>
                                        <div className={`text-sm font-bold text-rose-500 ${metricsLoading ? 'opacity-50' : ''}`}>
                                            {metrics.openExposure?.risk || '0.00'}%
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <div className="text-xs">Open Profit</div>
                                        <div className={`text-sm font-bold text-emerald-500 ${metricsLoading ? 'opacity-50' : ''}`}>
                                            {metrics.openExposure?.profit || '0.00'}%
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Open Exposure */}
                        <div className="h-48 bg-base-100 p-4 rounded-lg hover:shadow-lg hover:shadow-primary/10 shadow flex flex-col">
                            <div className="text-primary text-sm font-semibold">Trade Stats</div>

                        </div>

                        <div className="h-48 bg-base-100 p-4 rounded-lg hover:shadow-lg hover:shadow-primary/10 shadow flex flex-col">
                            <div className="text-primary text-sm font-semibold">Trade Stats</div>
                            {/* Added justify-center to center the content vertically */}
                            <div className="flex-1 flex flex-col justify-center">

                            </div>
                        </div>

                        <div className="h-48 bg-base-100 p-4 rounded-lg hover:shadow-lg hover:shadow-primary/10 shadow flex flex-col">
                            <div className="text-primary text-sm font-semibold">Trade Stats</div>
                            {/* Added justify-center to center the content vertically */}
                            <div className="flex-1 flex flex-col justify-center">

                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PortfolioOverview
