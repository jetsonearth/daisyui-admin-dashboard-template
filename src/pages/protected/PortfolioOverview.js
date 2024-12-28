import React, { useState, useEffect, useRef, useCallback } from 'react'
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
import ReactApexChart from 'react-apexcharts';

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
    const [selectedTradeDetails, setSelectedTradeDetails] = useState(null)
    const [isAutoRefresh, setIsAutoRefresh] = useState(true)
    const [lastUpdate, setLastUpdate] = useState(null)
    const [startingCapital, setStartingCapital] = useState(0)
    const [currentCapital, setCurrentCapital] = useState(0)
    const [loading, setLoading] = useState(false)
    const [metricsLoading, setMetricsLoading] = useState(false)
    const [historicalMetrics, setHistoricalMetrics] = useState([])
    const [capitalHistory, setCapitalHistory] = useState([])
    const [isTradeModalOpen, setIsTradeModalOpen] = useState(false)
    const [selectedDayTrades, setSelectedDayTrades] = useState([])
    const [selectedTrade, setSelectedTrade] = useState(null)
    const [capitalComposition, setCapitalComposition] = useState({
        startingCapital: 0,
        realizedPnL: 0,
        unrealizedPnL: 0
    });
    const capitalChartRef = useRef(null);
    const capitalChartInstance = useRef(null);
    const compositionChartRef = useRef(null);
    const compositionChartInstance = useRef(null);
    const winRateChartRef = useRef(null);
    const winRateChartInstance = useRef(null);

    const [compositionChartOptions] = useState({
        chart: {
            type: 'bar',
            height: 50,
            stacked: true,
            stackType: '100%',
            toolbar: {
                show: false
            },
            sparkline: {
                enabled: true
            }
        },
        plotOptions: {
            bar: {
                horizontal: true,
                barHeight: '100%',
            }
        },
        grid: {
            show: false,
        },
        colors: ['#374151',
            function ({ value, seriesIndex, dataPointIndex }) {
                return value >= 0 ? '#10b981' : '#ef4444'
            },
            function ({ value, seriesIndex, dataPointIndex }) {
                return value >= 0 ? '#10b981' : '#ef4444'
            }
        ],
        dataLabels: {
            enabled: false
        },
        tooltip: {
            enabled: true,
            y: {
                formatter: (value) => `$${Math.abs(value).toLocaleString()}`
            }
        },
        xaxis: {
            labels: {
                show: false
            },
            axisBorder: {
                show: false
            },
            axisTicks: {
                show: false
            }
        },
        yaxis: {
            labels: {
                show: false
            }
        },
        legend: {
            show: false
        },
        states: {
            hover: {
                filter: {
                    type: 'none'
                }
            }
        }
    });

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
        payoffRatio: 0,
        totalTrades: 0,
        profitableTradesCount: 0,
        lossTradesCount: 0,
        avgWin: 0,
        avgLoss: 0,
        avgGainPercentage: 0,
        avgLossPercentage: 0,
        totalProfits: 0,
        totalLosses: 0,
        portfolioAllocation: 0,
        dailyExposure: {
            risk: 0,
            profit: 0,
            delta: 0
        },
        newExposure: {
            risk: 0,
            profit: 0,
            delta: 0
        },
        openExposure: {
            risk: 0,
            profit: 0,
            delta: 0
        },
        avgWinR: 0,
        avgLossR: 0
    });

    const handleCalendarDateClick = (date, trades) => {
        console.log('Calendar date clicked:', date, trades);
        setSelectedDayTrades(trades);
        setIsTradeModalOpen(true);
    };

    const handleTradeClick = (trade) => {
        console.log('Trade clicked:', trade);
        setSelectedTrade(trade);
    };

    const closeTradeModal = () => {
        setIsTradeModalOpen(false);
        setSelectedDayTrades([]);
        setSelectedTrade(null);
    };

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
        } catch (error) {
            console.error('Error fetching trade details:', error);
            toast.error('Failed to fetch trade details');
        }
    };

    // Fetch trades
    const fetchTrades = useCallback(async () => {
        setLoading(true)
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
                .order('entry_datetime', { ascending: false });

            if (error) {
                console.error('Error fetching trades:', error)
                toast.error('Failed to fetch trades')
                return
            }

            console.log('Trades Fetched:', {
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
                toast.info('No trades found')
            }

            setTrades(data || [])
            const active = data.filter(trade => trade.status === 'Open')
            setActiveTrades(active)
        } catch (error) {
            console.error('Unexpected error fetching trades:', error)
            toast.error('Unexpected error occurred')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchTrades()
    }, [fetchTrades])

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
                        avgWin: updatedLatestMetrics.avg_win ?? prevMetrics.avgWin,
                        avgLoss: updatedLatestMetrics.avg_loss ?? prevMetrics.avgLoss,
                        avgRRR: updatedLatestMetrics.avg_rrr ?? prevMetrics.avgRRR,
                        winRate: updatedLatestMetrics.win_rate ?? prevMetrics.winRate,
                        expectancy: updatedLatestMetrics.expectancy ?? prevMetrics.expectancy,
                        payoffRatio: updatedLatestMetrics.payoff_ratio ?? prevMetrics.payoffRatio,
                        totalTrades: updatedLatestMetrics.total_trades ?? prevMetrics.totalTrades,
                        profitableTradesCount: updatedLatestMetrics.profitable_trades_count ?? prevMetrics.profitableTradesCount,
                        lossTradesCount: updatedLatestMetrics.loss_trades_count ?? prevMetrics.lossTradesCount,
                        breakEvenTradesCount: updatedLatestMetrics.break_even_trades_count ?? prevMetrics.breakEvenTradesCount,
                        largestWin: updatedLatestMetrics.largest_win ?? prevMetrics.largestWin,
                        largestLoss: updatedLatestMetrics.largest_loss ?? prevMetrics.largestLoss,
                        currentStreak: updatedLatestMetrics.current_streak ?? prevMetrics.currentStreak,
                        longestWinStreak: updatedLatestMetrics.longest_win_streak ?? prevMetrics.longestWinStreak,
                        longestLossStreak: updatedLatestMetrics.longest_loss_streak ?? prevMetrics.longestLossStreak,
                        maxDrawdown: updatedLatestMetrics.max_drawdown ?? prevMetrics.maxDrawdown,
                        maxRunup: updatedLatestMetrics.max_runup ?? prevMetrics.maxRunup,
                        totalProfits: updatedLatestMetrics.total_profits ?? prevMetrics.totalProfits,
                        totalLosses: updatedLatestMetrics.total_losses ?? prevMetrics.totalLosses,
                        avgWinR: updatedLatestMetrics.avg_r_win ?? prevMetrics.avgWinR,
                        avgLossR: updatedLatestMetrics.avg_r_loss ?? prevMetrics.avgLossR,
                        avgGainPercentage: updatedLatestMetrics.avg_gain_percentage ?? metrics.avgGainPercentage,
                        avgLossPercentage: updatedLatestMetrics.avg_loss_percentage ?? metrics.avgLossPercentage,
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

                    // Calculate portfolio allocation
                    const totalAllocation = updatedTrades.reduce((sum, trade) => {
                        return sum + (trade.currentPrice * trade.remaining_shares);
                    }, 0);
                    
                    const portfolioAllocation = (totalAllocation / currentCapital) * 100;

                    setMetrics(prevMetrics => ({
                        ...prevMetrics,
                        portfolioAllocation
                    }));

                    setActiveTrades(updatedTrades);
                    setLastUpdate(new Date().toLocaleTimeString());
                }

                // Cache the current state
                const cacheData = {
                    timestamp: Date.now(),
                    data: {
                        currentCapital,
                        activeTrades: openTrades || [],
                        metrics: {
                            ...metrics,
                            profitFactor: updatedLatestMetrics.profit_factor,
                            avgWin: updatedLatestMetrics.avg_win,
                            avgLoss: updatedLatestMetrics.avg_loss,
                            avgRRR: updatedLatestMetrics.avg_rrr,
                            winRate: updatedLatestMetrics.win_rate,
                            expectancy: updatedLatestMetrics.expectancy,
                            payoffRatio: updatedLatestMetrics.payoff_ratio,
                            totalTrades: updatedLatestMetrics.total_trades,
                            profitableTradesCount: updatedLatestMetrics.profitable_trades_count,
                            lossTradesCount: updatedLatestMetrics.loss_trades_count,
                            breakEvenTradesCount: updatedLatestMetrics.break_even_trades_count,
                            largestWin: updatedLatestMetrics.largest_win,
                            largestLoss: updatedLatestMetrics.largest_loss,
                            currentStreak: updatedLatestMetrics.current_streak,
                            longestWinStreak: updatedLatestMetrics.longest_win_streak,
                            longestLossStreak: updatedLatestMetrics.longest_loss_streak,
                            maxDrawdown: updatedLatestMetrics.max_drawdown,
                            maxRunup: updatedLatestMetrics.max_runup,
                            totalProfits: updatedLatestMetrics.total_profits,
                            totalLosses: updatedLatestMetrics.total_losses,
                            avgWinR: updatedLatestMetrics.avg_r_win,
                            avgLossR: updatedLatestMetrics.avg_r_loss,
                            avgGainPercentage: updatedLatestMetrics.avg_gain_percentage,
                            avgLossPercentage: updatedLatestMetrics.avg_loss_percentage,
                            exposureMetrics: {
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
                            }
                        },
                        lastUpdate: new Date().toISOString()
                    }
                };

                console.log('🔵 Caching fresh portfolio metrics:', cacheData);
                localStorage.setItem('portfolioMetricsCache', JSON.stringify(cacheData));
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

                // Calculate portfolio allocation
                const portfolioAllocation = updatedTrades.reduce((sum, trade) => 
                    sum + (trade.remaining_shares * (quotes[trade.ticker]?.price || trade.currentPrice || 0)), 0) / freshCapital * 100;

                // Upsert exposure metrics
                await metricsService.upsertExposureMetrics(user.id, exposureMetrics);

                const latestMetrics = await metricsService.fetchLatestPortfolioMetrics(user.id, true);

                console.log('---------------- 🚀🚀 Latest Metrics ------------------ DEBUGGING :', latestMetrics);

                if (latestMetrics) {
                    const newMetrics = {
                        ...metrics,
                        profitFactor: latestMetrics.profit_factor ?? metrics.profitFactor,
                        avgWin: latestMetrics.avg_win ?? metrics.avgWin,
                        avgLoss: latestMetrics.avg_loss ?? metrics.avgLoss,
                        avgRRR: latestMetrics.avg_rrr ?? metrics.avgRRR,
                        winRate: latestMetrics.win_rate ?? metrics.winRate,
                        expectancy: latestMetrics.expectancy ?? metrics.expectancy,
                        payoffRatio: latestMetrics.payoff_ratio ?? metrics.payoffRatio,
                        totalTrades: latestMetrics.total_trades ?? metrics.totalTrades,
                        profitableTradesCount: latestMetrics.profitable_trades_count ?? metrics.profitableTradesCount,
                        lossTradesCount: latestMetrics.loss_trades_count ?? metrics.lossTradesCount,
                        breakEvenTradesCount: latestMetrics.break_even_trades_count ?? metrics.breakEvenTradesCount,
                        largestWin: latestMetrics.largest_win ?? metrics.largestWin,
                        largestLoss: latestMetrics.largest_loss ?? metrics.largestLoss,
                        currentStreak: latestMetrics.current_streak ?? metrics.currentStreak,
                        longestWinStreak: latestMetrics.longest_win_streak ?? metrics.longestWinStreak,
                        longestLossStreak: latestMetrics.longest_loss_streak ?? metrics.longestLossStreak,
                        maxDrawdown: latestMetrics.max_drawdown ?? metrics.maxDrawdown,
                        maxRunup: latestMetrics.max_runup ?? metrics.maxRunup,
                        totalProfits: latestMetrics.total_profits ?? metrics.totalProfits,
                        totalLosses: latestMetrics.total_losses ?? metrics.totalLosses,
                        avgWinR: latestMetrics.avg_r_win ?? metrics.avgWinR,
                        avgLossR: latestMetrics.avg_r_loss ?? metrics.avgLossR,
                        avgGainPercentage: latestMetrics.avg_gain_percentage ?? metrics.avgGainPercentage,
                        avgLossPercentage: latestMetrics.avg_loss_percentage ?? metrics.avgLossPercentage,
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
                        },
                        portfolioAllocation, // Add portfolio allocation
                    };
                    setMetrics(newMetrics);

                    console.log(" ===== Metrics after update ===== :", metrics);

                    // Update cache with new data
                    const cacheData = {
                        timestamp: Date.now(),
                        data: {
                            currentCapital: freshCapital,
                            activeTrades: updatedTrades,
                            metrics: {
                                ...metrics,
                                profitFactor: latestMetrics.profit_factor,
                                avgWin: latestMetrics.avg_win,
                                avgLoss: latestMetrics.avg_loss,
                                avgRRR: latestMetrics.avg_rrr,
                                winRate: latestMetrics.win_rate,
                                expectancy: latestMetrics.expectancy,
                                payoffRatio: latestMetrics.payoff_ratio,
                                totalTrades: latestMetrics.total_trades,
                                profitableTradesCount: latestMetrics.profitable_trades_count,
                                lossTradesCount: latestMetrics.loss_trades_count,
                                breakEvenTradesCount: latestMetrics.break_even_trades_count,
                                largestWin: latestMetrics.largest_win,
                                largestLoss: latestMetrics.largest_loss,
                                currentStreak: latestMetrics.current_streak,
                                longestWinStreak: latestMetrics.longest_win_streak,
                                longestLossStreak: latestMetrics.longest_loss_streak,
                                maxDrawdown: latestMetrics.max_drawdown,
                                maxRunup: latestMetrics.max_runup,
                                totalProfits: latestMetrics.total_profits,
                                totalLosses: latestMetrics.total_losses,
                                avgWinR: latestMetrics.avg_r_win,
                                avgLossR: latestMetrics.avg_r_loss,
                                avgGainPercentage: latestMetrics.avg_gain_percentage,
                                avgLossPercentage: latestMetrics.avg_loss_percentage,
                                portfolioAllocation,
                                exposureMetrics: {
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
                                }
                            },
                            lastUpdate: new Date().toISOString()
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

    // Memoize capital calculations to avoid unnecessary recalculations
    const calculateCapitalComposition = useCallback(async () => {
        try {
            const updateCapitalComposition = () => {
                // Use metrics.totalProfits and metrics.totalLosses as source of truth
                const totalRealizedPnL = (metrics.totalProfits || 0) + (metrics.totalLosses || 0);
                
                // Calculate unrealized PnL from active trades
                const totalUnrealizedPnL = activeTrades?.reduce((sum, trade) =>
                    sum + (trade.unrealized_pnl || 0), 0) || 0;

                setCapitalComposition({
                    startingCapital: currentCapital - totalRealizedPnL - totalUnrealizedPnL,
                    realizedPnL: totalRealizedPnL,
                    unrealizedPnL: totalUnrealizedPnL
                });
            };

            updateCapitalComposition();
        } catch (error) {
            console.error('Error calculating capital composition:', error);
        }
    }, [currentCapital, metrics.totalProfits, metrics.totalLosses, activeTrades]);

    // Update composition when trades change
    useEffect(() => {
        calculateCapitalComposition();
    }, [calculateCapitalComposition]);

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
                setCapitalHistory(data || []);
            } catch (error) {
                console.error('Error fetching capital history:', error);
            }
        };

        fetchCapitalHistory();
    }, []);

    useEffect(() => {
        if (!capitalHistory.length || !capitalChartRef.current) return;
    
        if (capitalChartInstance.current) {
            capitalChartInstance.current.destroy();
        }
    
        const ctx = capitalChartRef.current.getContext('2d');
    
        // Calculate percentage changes and determine colors
        const percentageChanges = capitalHistory.map((item, index) => {
            if (index === 0) return 0;
            const prevCapital = capitalHistory[index - 1].capital_amount;
            const currentCapital = item.capital_amount;
            return ((currentCapital - prevCapital) / prevCapital) * 100;
        });
    
        // Generate color array based on price movement
        const lineColors = capitalHistory.map((item, index) => {
            if (index === 0) return '#34d399'; // emerald-400 default for first point
            return item.capital_amount >= capitalHistory[index - 1].capital_amount ? '#34d399' : '#fb7185'; // emerald-400 : rose-400
        });
    
        // Find highest and lowest points
        const maxCapital = Math.max(...capitalHistory.map(item => item.capital_amount));
        const minCapital = Math.min(...capitalHistory.map(item => item.capital_amount));
    
        capitalChartInstance.current = new Chart(ctx, {
            type: 'line',
            data: {
                labels: capitalHistory.map(item => dayjs(item.date).format('MM/DD')),
                datasets: [{
                    label: 'Capital',
                    data: capitalHistory.map(item => item.capital_amount),
                    segment: {
                        borderColor: (ctx) => {
                            if (!ctx.p0.parsed) return '#34d399'; // emerald-400
                            return ctx.p0.parsed.y <= ctx.p1.parsed.y ? '#34d399' : '#fb7185'; // emerald-400 : rose-400
                        }
                    },
                    pointBackgroundColor: lineColors,
                    tension: 0.4,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    borderWidth: 2.5,
                    fill: true,
                    backgroundColor: (context) => {
                        const ctx = context.chart.ctx;
                        const gradient = ctx.createLinearGradient(0, 0, 0, 200);
                        const lastValue = capitalHistory[capitalHistory.length - 1].capital_amount;
                        const firstValue = capitalHistory[0].capital_amount;
                        const isOverallPositive = lastValue >= firstValue;
                        
                        if (isOverallPositive) {
                            gradient.addColorStop(0, 'rgba(52, 211, 153, 0.25)'); // emerald-400
                            gradient.addColorStop(1, 'rgba(52, 211, 153, 0)');
                        } else {
                            gradient.addColorStop(0, 'rgba(251, 113, 133, 0.25)'); // rose-400
                            gradient.addColorStop(1, 'rgba(251, 113, 133, 0)');
                        }
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
                        backgroundColor: 'rgba(0, 0, 0, 0.85)',
                        padding: {
                            top: 10,
                            right: 15,
                            bottom: 10,
                            left: 15
                        },
                        titleColor: '#fff',
                        titleFont: {
                            size: 13,
                            weight: '500',
                            family: 'Inter, sans-serif'
                        },
                        bodyColor: '#fff',
                        bodyFont: {
                            size: 15,
                            weight: '600',
                            family: 'Inter, sans-serif'
                        },
                        bodySpacing: 8,
                        displayColors: false,
                        callbacks: {
                            title: (tooltipItems) => {
                                const idx = tooltipItems[0].dataIndex;
                                const date = capitalHistory[idx].date;
                                return dayjs(date).format('MMM D, YYYY');
                            },
                            label: (context) => {
                                const lines = [
                                    `$${context.raw.toLocaleString(undefined, {
                                        minimumFractionDigits: 0,
                                        maximumFractionDigits: 0
                                    })}`
                                ];
    
                                // Add percentage change with color-coded arrows
                                if (context.dataIndex > 0) {
                                    const change = percentageChanges[context.dataIndex];
                                    const changeText = `${change >= 0 ? '▲' : '▼'} ${Math.abs(change).toFixed(2)}%`;
                                    const changeColor = change >= 0 ? '#34d399' : '#fb7185'; // emerald-400 : rose-400
                                    lines.push(`${changeText} from previous`);
                                    // lines.push(`color: ${changeColor}`);
                                }
    
                                // Add all-time high/low indicator
                                // if (context.raw === maxCapital) {
                                //     lines.push('All-Time High 🔥');
                                // } else if (context.raw === minCapital) {
                                //     lines.push('All-Time Low');
                                // }
    
                                return lines;
                            }
                        }
                    },
                    annotation: {
                        annotations: {
                            latestValue: {
                                type: 'line',
                                yMin: capitalHistory[capitalHistory.length - 1].capital_amount,
                                yMax: capitalHistory[capitalHistory.length - 1].capital_amount,
                                borderColor: capitalHistory[capitalHistory.length - 1].capital_amount >= 
                                           capitalHistory[capitalHistory.length - 2].capital_amount ? 
                                           'rgba(52, 211, 153, 0.5)' : 'rgba(251, 113, 133, 0.5)', // emerald-400 : rose-400
                                borderWidth: 1,
                                borderDash: [5, 5],
                                label: {
                                    display: true,
                                    content: 'Current',
                                    position: 'end'
                                }
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

    useEffect(() => {
        if (!winRateChartRef.current) return;

        if (winRateChartInstance.current) {
            winRateChartInstance.current.destroy();
        }

        const ctx = winRateChartRef.current.getContext('2d');
        const winRate = typeof metrics.winRate === 'number' ? metrics.winRate : 0;

        // Calculate gradient colors based on win rate
        const getColor = (rate) => {
            return '#10b981'; // emerald-500 for great

            // if (rate >= 60) return '#10b981'; // emerald-500 for great
            // if (rate >= 50) return '#22c55e'; // green-500 for good
            // if (rate >= 40) return '#eab308'; // yellow-500 for okay
            // return '#ef4444'; // red-500 for needs improvement
        };

        winRateChartInstance.current = new Chart(ctx, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [winRate, 100 - winRate],
                    backgroundColor: [
                        getColor(winRate),
                        '#1f2937' // gray-800 for background
                    ],
                    borderWidth: 0,
                    circumference: 180, // Half circle
                    rotation: 270 // Start from top
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 2, // Make it wider than tall
                cutout: '80%',
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: false
                    }
                }
            }
        });

        return () => {
            if (winRateChartInstance.current) {
                winRateChartInstance.current.destroy();
            }
        };
    }, [metrics.winRate]);

    useEffect(() => {
        if (!compositionChartRef.current) return;

        // Destroy existing chart if it exists
        if (compositionChartInstance.current) {
            compositionChartInstance.current.destroy();
        }

        const ctx = compositionChartRef.current.getContext('2d');

        compositionChartInstance.current = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Capital'],
                datasets: [
                    {
                        label: 'Starting',
                        data: [capitalComposition.startingCapital],
                        backgroundColor: '#374151', // gray-700
                        barPercentage: 1,
                        stack: 'stack0',
                        order: 1
                    },
                    {
                        label: 'Realized',
                        data: [capitalComposition.realizedPnL],
                        backgroundColor: capitalComposition.realizedPnL >= 0 ? '#10b981' : '#ef4444', // emerald-500 : red-500
                        barPercentage: 1,
                        stack: 'stack1',
                        order: 2
                    },
                    {
                        label: 'Unrealized',
                        data: [capitalComposition.unrealizedPnL],
                        backgroundColor: capitalComposition.unrealizedPnL >= 0 ? '#10b981' : '#ef4444', // emerald-500 : red-500
                        barPercentage: 1,
                        stack: 'stack2',
                        order: 3
                    }
                ]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: false
                    }
                },
                scales: {
                    x: {
                        stacked: false,
                        display: false,
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        stacked: false,
                        display: false,
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });

        return () => {
            if (compositionChartInstance.current) {
                compositionChartInstance.current.destroy();
            }
        };
    }, [capitalComposition]);

    return (
        <div>
            {isTradeModalOpen && selectedDayTrades && selectedDayTrades.length > 0 && (
                <div className="fixed inset-0 z-[9999] overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                            <div className="absolute inset-0 bg-base-300 opacity-75"></div>
                        </div>

                        <div className="inline-block align-bottom bg-base-100 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-7xl sm:w-full">
                            <div className="bg-base-100 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-medium">Trade History</h3>
                                    <button 
                                        onClick={closeTradeModal}
                                        className="btn btn-sm btn-ghost"
                                    >
                                        ×
                                    </button>
                                </div>

                                <div className="overflow-x-auto w-full">
                                    <table className="table table-xs table-zebra table-pin-rows">
                                        <thead>
                                            <tr>
                                                <th className="text-center whitespace-nowrap">Ticker</th>
                                                <th className="text-center whitespace-nowrap">Type</th>
                                                <th className="text-center whitespace-nowrap">Direction</th>
                                                <th className="text-center whitespace-nowrap">Status</th>
                                                <th className="text-center whitespace-nowrap">Entry Date</th>
                                                <th className="text-center whitespace-nowrap">Avg Cost</th>
                                                <th className="text-center whitespace-nowrap">Unrealized PnL%</th>
                                                <th className="text-center whitespace-nowrap">Unrealized PnL</th>
                                                <th className="text-center whitespace-nowrap">Realized PnL%</th>
                                                <th className="text-center whitespace-nowrap">Realized PnL</th>
                                                <th className="text-center whitespace-nowrap">RRR</th>
                                                <th className="text-center whitespace-nowrap">Current Price</th>
                                                <th className="text-center whitespace-nowrap">Strategy</th>
                                                <th className="text-center whitespace-nowrap">Setups</th>
                                                <th className="text-center whitespace-nowrap">Total Shares</th>
                                                <th className="text-center whitespace-nowrap">Remaining Shares</th>
                                                <th className="text-center whitespace-nowrap">Total Cost</th>
                                                <th className="text-center whitespace-nowrap">Market Value</th>
                                                <th className="text-center whitespace-nowrap">Weight %</th>
                                                <th className="text-center whitespace-nowrap">Trimmed %</th>
                                                <th className="text-center whitespace-nowrap">SL Distance</th>
                                                <th className="text-center whitespace-nowrap">Position Risk</th>
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
                                                <th className="text-center whitespace-nowrap">Holding Period</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedDayTrades.map((trade) => {
                                                const totalCost = trade.total_cost;
                                                const unrealizedPnL = trade.unrealized_pnl || 0;
                                                const realizedPnL = trade.realized_pnl || 0;
                                                const isProfitable = (totalCost + unrealizedPnL + realizedPnL) > totalCost;

                                                return (
                                                    <tr 
                                                        key={trade.id} 
                                                        className="hover cursor-pointer"
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
                                                        <td className="text-center">{trade.asset_type || 'N/A'}</td>
                                                        <td className="text-center">
                                                            <span className={`badge badge-pill ${trade.direction === 'LONG' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                                                                {trade.direction || 'N/A'}
                                                            </span>
                                                        </td>
                                                        <td className="text-center">
                                                            <span className={`badge badge-pill ${trade.status === 'OPEN' ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-black'}`}>
                                                                {trade.status || 'N/A'}
                                                            </span>
                                                        </td>
                                                        <td className="text-center whitespace-nowrap">
                                                            {trade.entry_datetime ? new Date(trade.entry_datetime).toISOString().split('T')[0] : ''}
                                                        </td>
                                                        <td className="text-center">{formatCurrency(trade.entry_price)}</td>
                                                        <td className={`text-center font-semibold ${trade.unrealized_pnl_percentage > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                            {trade.unrealized_pnl === 0 ? (
                                                                <span className="text-white">-</span>
                                                            ) : (
                                                                <>
                                                                    {trade.unrealized_pnl_percentage > 0 ? '+' : ''}
                                                                    {safeToFixed(trade.unrealized_pnl_percentage)}%
                                                                </>
                                                            )}
                                                        </td>
                                                        <td className={`text-center font-semibold ${trade.unrealized_pnl > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                            {trade.unrealized_pnl === 0 ? (
                                                                <span className="text-white">-</span>
                                                            ) : (
                                                                <>
                                                                    {trade.unrealized_pnl > 0 ? '+' : ''}
                                                                    {formatCurrency(trade.unrealized_pnl)}
                                                                </>
                                                            )}
                                                        </td>
                                                        <td className={`text-center font-semibold ${trade.realized_pnl_percentage > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                            {trade.realized_pnl_percentage > 0 ? '+' : ''}
                                                            {safeToFixed(trade.realized_pnl_percentage)}%
                                                        </td>
                                                        <td className={`text-center font-semibold ${trade.realized_pnl > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                            {trade.realized_pnl > 0 ? '+' : ''}
                                                            {formatCurrency(trade.realized_pnl)}
                                                        </td>
                                                        <td className={`text-center font-semibold ${trade.risk_reward_ratio > 1 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                            {safeToFixed(trade.risk_reward_ratio, 1)}
                                                        </td>
                                                        <td className="text-center font-medium">
                                                            {formatCurrency(trade.last_price)}
                                                        </td>
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
                                                                        <span key={index} className="badge badge-pill bg-indigo-500 text-white">
                                                                            {setup}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            ) : 'N/A'}
                                                        </td>
                                                        <td className="text-center">{safeToFixed(trade.total_shares)}</td>
                                                        <td className="text-center">{safeToFixed(trade.remaining_shares)}</td>
                                                        <td className="text-center">{formatCurrency(trade.total_cost)}</td>
                                                        <td className="text-center">{formatCurrency(trade.market_value)}</td>
                                                        <td className="text-center">{safeToFixed(trade.portfolio_weight)}%</td>
                                                        <td className="text-center">{safeToFixed(trade.trimmed_percentage)}%</td>
                                                        <td className={`text-center font-semibold ${trade.open_risk > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                                            {trade.open_risk > 0 ? '-' : ''}{safeToFixed(trade.open_risk, 2)}%
                                                        </td>
                                                        <td className={`text-center font-semibold ${trade.position_risk > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                                            {trade.position_risk === 0 ? (
                                                                <span className="text-white">-</span>
                                                            ) : (
                                                                <>
                                                                    {trade.position_risk > 0 ? '-' : ''}
                                                                    {safeToFixed(trade.position_risk)}%
                                                                </>
                                                            )}
                                                        </td>
                                                        <td className={`text-center font-semibold ${trade.portfolio_impact > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                            {trade.portfolio_impact > 0 ? '+' : ''}{safeToFixed(trade.portfolio_impact, 2)}%
                                                        </td>
                                                        <td className="text-center font-semibold text-rose-400">
                                                            {trade.mae === 0 ? (
                                                                <span className="text-white">-</span>
                                                            ) : (
                                                                `${safeToFixed(trade.mae, 1)}%`
                                                            )}
                                                        </td>
                                                        <td className="text-center font-semibold text-emerald-400">
                                                            {trade.mfe === 0 ? (
                                                                <span className="text-white">-</span>
                                                            ) : (
                                                                `${safeToFixed(trade.mfe, 1)}%`
                                                            )}
                                                        </td>
                                                        <td className="text-center font-semibold text-rose-400">
                                                            {trade.mae_dollars === 0 ? (
                                                                <span className="text-white">-</span>
                                                            ) : (
                                                                formatCurrency(trade.mae_dollars, 0)
                                                            )}
                                                        </td>
                                                        <td className="text-center font-semibold text-emerald-400">
                                                            {trade.mfe_dollars === 0 ? (
                                                                <span className="text-white">-</span>
                                                            ) : (
                                                                formatCurrency(trade.mfe_dollars, 0)
                                                            )}
                                                        </td>
                                                        <td className="text-center font-semibold text-rose-400">
                                                            {trade.mae_r === 0 ? (
                                                                <span className="text-white">-</span>
                                                            ) : (
                                                                `${safeToFixed(trade.mae_r, 2)}R`
                                                            )}
                                                        </td>
                                                        <td className="text-center font-semibold text-emerald-400">
                                                            {trade.mfe_r === 0 ? (
                                                                <span className="text-white">-</span>
                                                            ) : (
                                                                `${safeToFixed(trade.mfe_r, 2)}R`
                                                            )}
                                                        </td>
                                                        <td className="text-center whitespace-nowrap">
                                                            {trade.exit_datetime ? new Date(trade.exit_datetime).toISOString().split('T')[0] : ''}
                                                        </td>
                                                        <td className="text-center">{formatCurrency(trade.exit_price)}</td>
                                                        <td className={`text-center font-semibold ${trade.percent_from_entry > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                            {trade.unrealized_pnl === 0 ? (
                                                                <span className="text-white">-</span>
                                                            ) : (
                                                                <>
                                                                    {trade.percent_from_entry > 0 ? '+' : ''}
                                                                    {safeToFixed(trade.percent_from_entry)}%
                                                                </>
                                                            )}
                                                        </td>
                                                        <td className="text-center">
                                                            {trade.holding_period ? `${trade.holding_period} days` : 'N/A'}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
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
                    <div className="stat p-4">
                        <div className="stat-title text-base text-gray-400 mb-1">Current Capital</div>
                        <div className="stat-value text-3xl font-bold text-gray-300">
                            ${currentCapital.toLocaleString(undefined, {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0
                            })}
                        </div>
                        <div className="stat-desc flex justify-between mt-3">
                            <div className="flex items-center gap-1">
                                <span className="text-gray-400">Realized PnL:</span>
                                <span className={`font-medium ${(metrics.totalProfits - metrics.totalLosses) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    ${(metrics.totalProfits + metrics.totalLosses)?.toLocaleString() || '0'}
                                </span>
                            </div>
                            <span className="text-gray-400 font-medium mt-1">
                                {metrics.totalTrades || 0} trades
                            </span>
                        </div>
                    </div>
                </div>

                <div className="stats bg-base-100 shadow-lg hover:shadow-lg hover:shadow-primary/10 h-36">
                    <div className="stat p-4">
                        <div className="stat-title text-base text-gray-400 mb-1">Average RRR</div>
                        <div className="stat-value text-3xl font-bold text-gray-300">
                            {typeof metrics.avgRRR === 'number'
                                ? metrics.avgRRR.toFixed(2)
                                : '0.00'
                            }
                        </div>
                        <div className="stat-desc flex gap-14 items-center justify-center mt-2">
                            <span className="text-emerald-500 text-sm font-medium">
                                Win: {metrics.avgWinR?.toFixed(2) || '0.00'}R
                            </span>
                            <span className="text-rose-500 text-sm font-medium">
                                Loss: {Math.abs(metrics.avgLossR?.toFixed(2) || 0)}R
                            </span>
                        </div>
                    </div>
                </div>

                <div className="stats bg-base-100 shadow-lg hover:shadow-lg hover:shadow-primary/10 h-36">
                    <div className="stat">
                        <div className="stat-title text-base text-gray-400">Win Rate</div>
                        <div className="flex justify-between">
                            <div className="flex flex-col">
                                <div className="stat-value text-3xl text-gray-300 font-semibold mb-2">
                                    {typeof metrics.winRate === 'number' ? metrics.winRate.toFixed(1) : '0.0'}%
                                </div>
                                <div className="flex gap-3">
                                    <div className="flex items-center gap-1 mt-1">
                                        <span className="text-sm text-emerald-500 font-medium">
                                            {Math.round((metrics.totalTrades || 0) * ((metrics.winRate || 0) / 100))}
                                        </span>
                                        <span className="text-sm text-white">W</span>
                                    </div>
                                    <div className="flex items-center gap-1 mt-1">
                                        <span className="text-sm text-red-500 font-medium">
                                            {(metrics.totalTrades || 0) - Math.round((metrics.totalTrades || 0) * ((metrics.winRate || 0) / 100))}
                                        </span>
                                        <span className="text-sm text-white">L</span>
                                    </div>
                                </div>
                            </div>
                            <div className="w-20 h-10 flex items-center">
                                <canvas ref={winRateChartRef} className={metricsLoading ? 'opacity' : ''} />
                            </div>
                        </div>
                    </div>
                    {/* <div className="stat">
                        <div className="stat-title text-xs text-gray-500">RRR</div>
                        <div className="stat-value text-2xl font-semibold">
                            {typeof metrics.avgRRR === 'number'
                                ? metrics.avgRRR.toFixed(2)
                                : '0.00'}
                        </div>
                        <div className="stat-desc text-emerald-500 text-xs mt-3">+4.2% from last</div>
                    </div> */}
                </div>

                <div className="stats bg-base-100 shadow-lg hover:shadow-lg hover:shadow-primary/10 col-span-2">
                    <div className="stat w-full h-32">
                        <div className="stat-title text-base text-gray-400">Capital History</div>
                        <div className="w-full h-24 mt-1">
                            <canvas ref={capitalChartRef} />
                        </div>
                    </div>
                </div>
            </div>
            {/* Active Trades */}
            <div className="mt- max-h-[800px]">
                <TitleCard
                    title={
                        <div className="w-full flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <h2 className="text-2xl top-2 font-semibold mb-1">Active Trades</h2>
                                <div className="badge badge-primary badge-lg">
                                    {metrics.portfolioAllocation.toFixed(1)}% Allocated
                                </div>
                            </div>
                            <div className="absolute top-6 right-5 flex items-center gap-4">
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
                                                        {trade.unrealized_pnl_percentage > 0 ? '+' : ''}{safeToFixed(trade.unrealized_pnl_percentage)}%
                                                    </td>


                                                    <td className={`
                                                        text-center font-semibold tabular-nums
                                                        ${trade.realized_pnl_percentage > 0 ? 'text-emerald-400' : 'text-rose-400'}
                                                    `}>
                                                        {trade.realized_pnl_percentage > 0 ? '+' : ''}{safeToFixed(trade.realized_pnl_percentage)}%
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
                        isOpen={!!selectedTrade}
                        onClose={() => setSelectedTrade(null)}
                        onTradeAdded={() => {
                            setSelectedTrade(null);
                            fetchTrades();
                        }}
                        existingTrade={selectedTrade}
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
                        onDateClick={handleCalendarDateClick}
                    />
                </div>

                {/* Right Side Stats - Spans 7 columns */}
                <div className="col-span-4 space-y-4">
                    {/* Win Rate, PnL and Streak Grid */}
                    <div className="grid grid-cols-2 gap-4">

                        {/* Daily Exposure */}
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
                            {/* <div className="text-primary text-sm font-semibold">Daily Exposure</div>
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
                            </div> */}
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

                        <div className="h-48 bg-base-100 p-4 rounded-lg hover:shadow-lg hover:shadow-primary/10 shadow flex flex-col">
                            <div className="text-primary text-sm font-semibold mb-4">Average Trade Performance</div>
                            <div className="flex-1 flex flex-col">
                                <div className="flex justify-between text-sm text-gray-400 mb-1">
                                    <span>Dollar Value</span>
                                    <span>Return %</span>
                                </div>
                                {/* Win Row */}
                                <div className="flex justify-between mb-3">
                                    <span className="text-base font-medium text-emerald-400">
                                        <span className="text-xs mr-2">WIN</span>
                                        ${metrics.avgWin?.toLocaleString(undefined, {
                                            minimumFractionDigits: 0,
                                            maximumFractionDigits: 0
                                        }) || '0'}
                                    </span>
                                    <span className="text-base font-medium text-emerald-400">
                                        +{metrics.avgGainPercentage?.toFixed(2) || '0.00'}%
                                    </span>
                                </div>
                                {/* Loss Row */}
                                <div className="flex justify-between mb-4">
                                    <span className="text-base font-medium text-rose-400">
                                        <span className="text-xs mr-2">LOSS</span>
                                        ${metrics.avgLoss?.toLocaleString(undefined, {
                                            minimumFractionDigits: 0,
                                            maximumFractionDigits: 0
                                        }) || '0'}
                                    </span>
                                    <span className="text-base font-medium text-rose-400">
                                        -{Math.abs(metrics.avgLossPercentage)?.toFixed(2) || '0.00'}%
                                    </span>
                                </div>

                                {/* Bar Chart */}
                                <div className="h-16">
                                    <ReactApexChart
                                        options={{
                                            chart: {
                                                type: 'bar',
                                                toolbar: { show: false },
                                                sparkline: { enabled: true }
                                            },
                                            colors: ['#34d399', '#fb7185'],
                                            plotOptions: {
                                                bar: {
                                                    borderRadius: 4,
                                                    columnWidth: '40%',
                                                }
                                            },
                                            grid: { show: false },
                                            tooltip: { enabled: false },
                                            xaxis: {
                                                labels: { show: false },
                                                axisBorder: { show: false },
                                                axisTicks: { show: false }
                                            },
                                            yaxis: { show: false }
                                        }}
                                        series={[
                                            {
                                                name: 'Average Win',
                                                data: [Math.abs(metrics.avgWin || 0)]
                                            },
                                            {
                                                name: 'Average Loss',
                                                data: [Math.abs(metrics.avgLoss || 0)]
                                            }
                                        ]}
                                        type="bar"
                                        height={64}
                                    />
                                </div>
                            </div>
                        </div>

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

                        <div className="h-48 bg-base-100 p-4 rounded-lg hover:shadow-lg hover:shadow-primary/10 shadow flex flex-col">
                            <div className="text-primary text-sm font-semibold mb-4">Trade Expectancy</div>
                            <div className="flex-1 flex flex-col justify-center items-center">
                                <div className="text-4xl font-bold mb-3 text-gray-200">
                                    ${metrics.expectancy?.toLocaleString(undefined, {
                                        minimumFractionDigits: 0,
                                        maximumFractionDigits: 0
                                    }) || '0'}
                                </div>
                                <div className="text-gray-400 text-sm">Expected Value per Trade</div>
                            </div>
                        </div>

                        <div className="h-48 bg-base-100 p-4 rounded-lg hover:shadow-lg hover:shadow-primary/10 shadow flex flex-col">
                            <div className="text-primary text-sm font-semibold mb-4">Streaks</div>
                            <div className="flex-1 flex flex-col justify-center items-center">
                                <div className={`text-4xl font-bold mb-3 ${metrics.currentStreak > 0 ? 'text-emerald-400' : metrics.currentStreak < 0 ? 'text-rose-400' : 'text-gray-400'}`}>
                                    {Math.abs(metrics.currentStreak)} {metrics.currentStreak > 0 ? 'Wins' : metrics.currentStreak < 0 ? 'Losses' : '-'}
                                </div>
                                <div className="text-gray-400 text-sm">Current Streak</div>
                                <div className="mt-4 text-sm text-gray-500">
                                    Best: {metrics.longestWinStreak}W / {metrics.longestLossStreak}L
                                </div>
                            </div>
                        </div>

                        <div className="h-48 bg-base-100 p-4 rounded-lg hover:shadow-lg hover:shadow-primary/10 shadow flex flex-col">
                            <div className="text-primary text-sm font-semibold">Profit Factor</div>
                            <div className="flex-1 flex flex-col items-center justify-center">
                                <div className="stat-value text-4xl text-gray-300 font-bold mt-auto">
                                    {(metrics.totalProfits / Math.abs(metrics.totalLosses || 1)).toFixed(2)}
                                </div>
                                <div className="flex flex-col mt-auto gap-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-400 text-xs">Total Profits:</span>
                                        <span className="text-emerald-400 font-xs">
                                            ${metrics.totalProfits?.toLocaleString() || '0'}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-400 text-xs">Total Losses:</span>
                                        <span className="text-rose-400 font-xs">
                                            ${Math.abs(metrics.totalLosses)?.toLocaleString() || '0'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="h-48 bg-base-100 p-6 rounded-lg hover:shadow-lg hover:shadow-primary/10 shadow col-span-2">
                            <div className="text-primary text-sm font-semibold mb-4">Capital Breakdown</div>
                            {/* Capital Composition */}
                            <div className="flex-1 flex flex-col">
                                <div className="flex justify-between text-sm text-gray-400 mb-1">
                                    <span>Starting Capital</span>
                                    <span>Realized P&L</span>
                                    <span>Unrealized P&L</span>
                                </div>
                                <div className="flex justify-between mb-3">
                                    <span className="text-base font-medium">
                                        ${capitalComposition.startingCapital.toLocaleString()}
                                    </span>
                                    <span className={`text-base font-medium ${capitalComposition.realizedPnL >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                        {capitalComposition.realizedPnL >= 0 ? '+' : '-'}${Math.abs(capitalComposition.realizedPnL).toLocaleString()}
                                    </span>
                                    <span className={`text-base font-medium ${capitalComposition.unrealizedPnL >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                        {capitalComposition.unrealizedPnL >= 0 ? '+' : '-'}${Math.abs(capitalComposition.unrealizedPnL).toLocaleString()}
                                    </span>
                                </div>
                                <div className="h-16 mb-4">
                                    <ReactApexChart
                                        options={compositionChartOptions}
                                        series={[
                                            {
                                                name: 'Starting Capital',
                                                data: [Math.abs(capitalComposition.startingCapital)]
                                            },
                                            {
                                                name: 'Realized P&L',
                                                data: [Math.abs(capitalComposition.realizedPnL)]
                                            },
                                            {
                                                name: 'Unrealized P&L',
                                                data: [Math.abs(capitalComposition.unrealizedPnL)]
                                            }
                                        ]}
                                        type="bar"
                                        height={32}
                                    />
                                </div>
                                <div className="space-y-1 mt-auto">
                                    {/* Other trade stats will go here */}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PortfolioOverview
