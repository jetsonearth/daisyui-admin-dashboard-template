// src/components/TradeHistory/TradeHistoryModal.tsx
import React, { useEffect, useState } from 'react';
import { UTCTimestamp } from 'lightweight-charts';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { supabase } from '../../../../config/supabaseClient';
import { toast } from 'react-toastify';
import { Trade, TRADE_STATUS, DIRECTIONS, ASSET_TYPES, STRATEGIES, SETUPS } from '../../../../types'; 
import { metricsService } from '../../../../features/metrics/metricsService';
import { capitalService } from '../../../../services/capitalService';
import { L, p } from 'chart.js/dist/chunks/helpers.core';
import dayjs from 'dayjs';
import TradeChart from '../../../../components/TradeChart';
import { historicalDataService } from '../../../../services/historicalDataService';
import { marketDataService } from '../../../marketData/marketDataService';
import { TradeReplayChart } from '../../../../components/TradeReplayChart';

interface TradeMarker {
    timestamp: number;
    price: number;
    type: 'entry' | 'exit';  
}

interface Action {
    type: 'BUY' | 'SELL';
    date: Date;
    shares: string;
    price: string;
}

interface TradeHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onTradeAdded: () => void;
    existingTrade?: Trade;
}

interface TradeDetails {
    ticker: string;
    direction: string;
    assetType: string;
    stopLossPrice: string;
    trailingStopLoss: string;
    actions: Action[];
    strategy: string;
    setups: string[];
}

const defaultTradeDetails: TradeDetails = {
    ticker: '',
    direction: DIRECTIONS.LONG,
    assetType: ASSET_TYPES.STOCK,
    stopLossPrice: '',
    trailingStopLoss: '',
    actions: [{
        type: 'BUY',
        date: new Date(),
        shares: '',
        price: ''
    }],
    strategy: '',
    setups: []
};

const initializeTradeDetails = (existingTrade: Trade): TradeDetails => {
    // Construct actions from the separate arrays in Trade
    const actions = existingTrade.action_types?.map((type, index) => ({
        type: type as 'BUY' | 'SELL',
        date: new Date(existingTrade.action_datetimes?.[index] || Date.now()),
        shares: existingTrade.action_shares?.[index]?.toString() || '',
        price: existingTrade.action_shares?.[index]?.toString() || ''
    })) || [{
        type: 'BUY',
        date: new Date(),
        shares: '',
        price: ''
    }];

    return {
        ticker: existingTrade.ticker,
        direction: existingTrade.direction,
        assetType: existingTrade.asset_type,
        stopLossPrice: existingTrade.stop_loss_price?.toString() || '',
        trailingStopLoss: existingTrade.trailing_stoploss?.toString() || '',
        actions,
        strategy: existingTrade.strategy || '',
        setups: existingTrade.setups || [],
    };
};

const TradeHistoryModal: React.FC<TradeHistoryModalProps> = ({ isOpen, onClose, onTradeAdded, existingTrade }) => {
    const [tradeDetails, setTradeDetails] = useState<TradeDetails>(() => {
        if (existingTrade) {
            return initializeTradeDetails(existingTrade);
        }

        return defaultTradeDetails;
    });

    const [selectedStrategy, setSelectedStrategy] = useState<STRATEGIES | undefined>(
        existingTrade?.strategy as STRATEGIES || undefined
    );
    const [selectedSetups, setSelectedSetups] = useState<string[]>(
        existingTrade?.setups || []
    );

    const [activeTab, setActiveTab] = useState('general'); // 'general' or 'notes'
    const [notes, setNotes] = useState(existingTrade?.notes || '');
    const [mistakes, setMistakes] = useState(existingTrade?.mistakes || '');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const [chartData, setChartData] = useState<any[]>([]);
    const [isLoadingChart, setIsLoadingChart] = useState(false);

    const handleStrategyChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedStrategy(event.target.value as STRATEGIES);
    };

    const handleSetupsChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const value = event.target.value;
        setSelectedSetups(prev => 
            prev.includes(value) ? prev.filter(s => s !== value) : [...prev, value]
        );
    };

    const handleDeleteTrade = async () => {
        if (!existingTrade) return;

        const { error } = await supabase
            .from('trades')
            .delete()
            .eq('id', existingTrade.id);

        if (error) {
            toast.error('Failed to delete trade');
            console.error("Error deleting trade:", error);
            return;
        }

        toast.success('Trade deleted successfully');
        onTradeAdded(); // Refresh the trade list
        onClose(); // Close the modal
    };

    const [loading, setLoading] = useState(false);

    const addAction = () => {
        setTradeDetails(prev => ({
            ...prev,
            actions: [...prev.actions, {
                type: 'SELL',
                date: new Date(),
                shares: '',
                price: '',
            }]
        }));
    };

    const toggleActionType = (index: number) => {
        setTradeDetails(prev => ({
            ...prev,
            actions: prev.actions.map((action, i) => 
                i === index 
                    ? { ...action, type: action.type === 'BUY' ? 'SELL' : 'BUY' }
                    : action
            )
        }));
    };

    const handleActionChange = (index: number, field: keyof Action, value: any) => {
        setTradeDetails(prev => ({
            ...prev,
            actions: prev.actions.map((action, i) => 
                i === index ? { ...action, [field]: value } : action
            )
        }));
    };

    const removeAction = (index: number) => {
        setTradeDetails(prev => ({
            ...prev,
            actions: prev.actions.filter((_, i) => i !== index) // Remove the action at the specified index
        }));
    };

    const handleSubmit = async () => { 
        setLoading(true); 
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                toast.error('Please log in to add trades');
                return;
            }

            let totalShares = 0;
            let remainingShares = 0;
            let totalCost = 0;
            let entryPrice = 0;
            let realizedPnl = 0;
            let realizedPnlPercentage = 0;
            let unrealizedPnl = 0;
            let unrealizedPnlPercentage = 0;
            let market_value = 0;
            let exitPrice = 0;
            let exitDate = '';
            let trimmedPercentage = 0;

            let target2R = 0;
            let target3R = 0;

            let slDistance = 0;
            let initialRiskAmount = 0;
            let currentRiskAmount = 0;
            let rrr = 0;
            // let positionHeat = 0;
            // let positionRisk = 0;
            let portfolioImpact = 0;

            let stopDistance = 0;
            let stop33 = 0;
            let stop66 = 0;
            let stopLoss33Percent = 0;
            let stopLoss66Percent = 0;
            let fullStopLoss = 0;

            let maePercent = 0;
            let mfePercent = 0;
            let maeDollars = 0;
            let mfeDollars = 0;
            let maeR = 0;
            let mfeR = 0;

            let tempHoldingPeriod = 0;
            let lastSellAction = null;

            let tradeId: string | undefined;

            const action_types = tradeDetails.actions.map(a => a.type);
            const action_datetimes = tradeDetails.actions.map(a => a.date.toISOString());
            const action_prices = tradeDetails.actions.map(a => parseFloat(a.price));
            const action_shares = tradeDetails.actions.map(a => parseFloat(a.shares));

            for (const action of tradeDetails.actions) {
                if (action.type === 'BUY') {
                    const shares = parseFloat(action.shares);
                    totalShares += shares;
                    remainingShares += shares;
                    totalCost += shares * parseFloat(action.price);
                    entryPrice = totalCost / totalShares;

                    const firstBuyAction = [...tradeDetails.actions]
                        .sort((a, b) => a.date.getTime() - b.date.getTime())
                        .find(a => a.type === 'BUY');

                    if (!firstBuyAction) {
                        toast.error('No buy action found for this trade');
                        return;
                    }

                    const firstEntryPrice = parseFloat(firstBuyAction.price);
                    const initialStopLoss = parseFloat(tradeDetails.stopLossPrice);
                    const initialStopDistance = Math.abs(firstEntryPrice - initialStopLoss);
                    initialRiskAmount = parseFloat(firstBuyAction.shares) * firstEntryPrice * (initialStopDistance / firstEntryPrice);
                    slDistance = Math.abs(entryPrice - initialStopLoss) / entryPrice;

                    const currentStopLoss = tradeDetails.trailingStopLoss 
                        ? parseFloat(tradeDetails.trailingStopLoss)
                        : parseFloat(tradeDetails.stopLossPrice);
                    
                    currentRiskAmount = totalShares * entryPrice * Math.abs(entryPrice - currentStopLoss) / entryPrice;

                    const status = remainingShares > 0 ? TRADE_STATUS.OPEN : TRADE_STATUS.CLOSED;

                } else if (action.type === 'SELL') {
                    const sharesToSell = parseFloat(action.shares);
                    if (sharesToSell > remainingShares) {
                        toast.error('Cannot sell more shares than owned.');
                        return;
                    }

                    remainingShares -= sharesToSell;
                    realizedPnl += sharesToSell * (parseFloat(action.price) - entryPrice);
                    realizedPnlPercentage = (realizedPnl / totalCost) * 100;

                    lastSellAction = action;

                    if (remainingShares === 0) {
                        exitPrice = parseFloat(lastSellAction.price);
                        exitDate = lastSellAction.date.toISOString();

                        const entryDate = new Date(tradeDetails.actions[0].date);
                        const exitDateObj = new Date(exitDate);

                        try {
                            const prices = await marketDataService.getHighLowPrices(tradeDetails.ticker, entryDate, exitDateObj);
                            if (prices && prices.status === 'success') {
                                const { minPrice, maxPrice } = prices;

                                if (tradeDetails.direction === DIRECTIONS.LONG) {
                                    // For long trades:
                                    // MAE is the worst drawdown (lowest price)
                                    // MFE is the highest potential profit (highest price)
                                    if (minPrice >= entryPrice) {
                                        maeDollars = 0;
                                        maePercent = 0;
                                        maeR = 0;
                                    } else {
                                        maeDollars = (entryPrice - minPrice) * totalShares;
                                        maePercent = ((entryPrice - minPrice) / entryPrice) * 100;
                                        maeR = (entryPrice - minPrice) / (entryPrice - parseFloat(tradeDetails.stopLossPrice));
                                    }

                                    if (maxPrice <= entryPrice) {
                                        mfeDollars = 0;
                                        mfePercent = 0;
                                        mfeR = 0;
                                    } else {
                                        mfeDollars = (maxPrice - entryPrice) * totalShares;
                                        mfePercent = ((maxPrice - entryPrice) / entryPrice) * 100;
                                        mfeR = (maxPrice - entryPrice) / (entryPrice - parseFloat(tradeDetails.stopLossPrice));
                                    }
                                } else {
                                    // For short trades:
                                    // MAE is when price goes against us (highest price)
                                    // MFE is the best potential profit (lowest price)
                                    if (maxPrice <= entryPrice) {
                                        maeDollars = 0;
                                        maePercent = 0;
                                        maeR = 0;
                                    } else {
                                        maeDollars = (maxPrice - entryPrice) * totalShares;
                                        maePercent = ((maxPrice - entryPrice) / entryPrice) * 100;
                                        maeR = (maxPrice - entryPrice) / (parseFloat(tradeDetails.stopLossPrice) - entryPrice);
                                    }

                                    if (minPrice >= entryPrice) {
                                        mfeDollars = 0;
                                        mfePercent = 0;
                                        mfeR = 0;
                                    } else {
                                        mfeDollars = (entryPrice - minPrice) * totalShares;
                                        mfePercent = ((entryPrice - minPrice) / entryPrice) * 100;
                                        mfeR = (entryPrice - minPrice) / (parseFloat(tradeDetails.stopLossPrice) - entryPrice);
                                    }
                                }
                            }
                        } catch (error) {
                            console.error('Error fetching high/low prices:', error);
                            toast.error('Failed to fetch high/low prices');
                        }

                        tempHoldingPeriod = Math.ceil((exitDateObj.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));
                        trimmedPercentage = ((totalShares - remainingShares) / totalShares) * 100;
                        unrealizedPnl = 0;
                        unrealizedPnlPercentage = 0;

                        rrr = realizedPnl / currentRiskAmount;
                        market_value = totalCost + realizedPnl;
                    }
                }
            }

            trimmedPercentage = ((totalShares - remainingShares) / totalShares) * 100;
            // positionHeat = 0;
            // positionRisk = initialRiskAmount / 

            const status = remainingShares > 0 ? TRADE_STATUS.OPEN : TRADE_STATUS.CLOSED;

            const tradeRecord = {
                user_id: user.id,
                ticker: tradeDetails.ticker,
                direction: tradeDetails.direction,
                asset_type: tradeDetails.assetType,
                stop_loss_price: tradeDetails.stopLossPrice,
                trailing_stoploss: tradeDetails.trailingStopLoss || null,
                initial_risk_amount: initialRiskAmount,
                current_risk_amount: currentRiskAmount,
                status: status,
                created_at: new Date().toISOString(),
                entry_datetime: tradeDetails.actions[0].date.toISOString(),
                entry_price: entryPrice,
                open_risk: slDistance,
                total_shares: totalShares,
                remaining_shares: remainingShares,
                realized_pnl: realizedPnl,
                realized_pnl_percentage: realizedPnlPercentage,
                unrealized_pnl: unrealizedPnl,
                unrealized_pnl_percentage: unrealizedPnlPercentage,
                market_value: market_value,
                total_cost: totalCost,
                trimmed_percentage: trimmedPercentage,
                risk_reward_ratio: rrr,
                strategy: selectedStrategy || null,
                setups: selectedSetups.length > 0 ? selectedSetups : null,
                action_types,
                action_datetimes,
                action_prices,
                action_shares,
                notes,
                mistakes,
                holding_period: tempHoldingPeriod || 0,
                r_target_2: target2R,
                r_target_3: target3R,
                stop_loss_33_percent: stop33,
                stop_loss_66_percent: stop66,
                // Add MAE/MFE metrics only for closed trades
                ...(status === TRADE_STATUS.CLOSED ? {
                    mae: maePercent,
                    mfe: mfePercent,
                    mae_dollars: maeDollars,
                    mfe_dollars: mfeDollars,
                    mae_r: maeR,
                    mfe_r: mfeR,
                    exit_datetime: exitDate,
                    exit_price: exitPrice,
                } : {})
            };

            console.log('Trade Record to be upserted:', tradeRecord);

            let result;
            if (existingTrade) {
                console.log('Existing Trade ID:', existingTrade.id);
                console.log('Full Existing Trade:', JSON.stringify(existingTrade, null, 2));
                const { data, error } = await supabase
                    .from('trades')
                    .update(tradeRecord)
                    .eq('id', existingTrade.id)
                    .eq('user_id', user.id)
                    .select();

                if (error) {
                    console.error('Update Error:', error);
                    console.error('Error Details:', error.details);
                    console.error('Error Hint:', error.hint);
                    console.error('Error Message:', error.message);
                    console.log('Attempted Update Record:', JSON.stringify(tradeRecord, null, 2));
                    throw error;
                }
                result = data;
                toast.success('Trade updated successfully!');
            } else {
                console.log('Creating new trade record...');
                console.log('Trade Record to Insert:', JSON.stringify(tradeRecord, null, 2));
                const { data, error } = await supabase
                    .from('trades')
                    .insert([tradeRecord])
                    .select();

                if (error) {
                    console.error('Insert Error:', error);
                    console.error('Error Details:', error.details);
                    console.error('Error Hint:', error.hint);
                    console.error('Error Message:', error.message);
                    console.log('Attempted Insert Record:', JSON.stringify(tradeRecord, null, 2));
                    throw error;
                }
                result = data;
                toast.success('Trade added successfully!');
            }

            onTradeAdded(); // Refresh the trade list

            if (remainingShares === 0) {
                console.log('----------- Computing metrics after trade closure! -----------');
            
                const { data: { user }, error: userError } = await supabase.auth.getUser();
                if (userError || !user) {
                    throw new Error('User not authenticated');
                }
            
                const allTrades = await metricsService.fetchTrades();
                const closedTrades = allTrades.filter(t => t.status === TRADE_STATUS.CLOSED);
            
                if (closedTrades.length > 0) {
                    // Calculate and update metrics
                    const performanceMetrics = await metricsService.calculateTradePerformanceMetrics(closedTrades);
                    console.log('Performance Metrics:', performanceMetrics);
            
                    const streakMetrics = metricsService.calculateStreakMetrics(closedTrades);
                    console.log('Streak Metrics:', streakMetrics);
                    
                    const combinedMetrics = {
                        ...performanceMetrics,
                        currentStreak: streakMetrics.currentStreak,
                        longestWinStreak: streakMetrics.longestWinStreak,
                        longestLossStreak: streakMetrics.longestLossStreak
                    };
            
                    await metricsService.upsertPerformanceMetrics(user.id, combinedMetrics);
                    
                    // Get user settings for account creation date
                    const { data: userSettings } = await supabase
                        .from('user_settings')
                        .select('created_at')
                        .eq('user_id', user.id)
                        .single();
            
                    // After the insert/update, use the result
                    if (result?.[0]) {
                        const tradeExitDate = new Date(result[0].exit_datetime);
                        const realizedPnL = result[0].realized_pnl || 0;

                        console.log('Trade details:', {
                            exitDate: tradeExitDate,
                            accountCreationDate: userSettings?.created_at,
                            isHistorical: userSettings?.created_at && new Date(tradeExitDate) < new Date(userSettings.created_at),
                            realizedPnL
                        });

                        // Calculate fresh capital including this trade's realized P&L
                        const freshCapital = await capitalService.calculateCurrentCapital();
                        console.log('Fresh capital:', freshCapital);
                        
                        // If this is a historical trade (before account creation)
                        if (userSettings?.created_at && new Date(tradeExitDate) < new Date(userSettings.created_at)) {
                            console.log('Processing historical trade from:', dayjs(tradeExitDate).format('YYYY-MM-DD'));
                            await capitalService.recordCapitalChange(freshCapital, {}, dayjs(tradeExitDate).format('YYYY-MM-DD'));

                            // Process all historical trades to ensure metrics are correct
                            await capitalService.processHistoricalTrades(user.id);
                        } else {
                            console.log('Processing current day trade');
                            // Current day trade
                            await capitalService.recordCapitalChange(freshCapital, {});
                        }
                    }
            
                    metricsService.invalidateMetricsCache();
                }
            }
            onClose();

        } catch (error: any) {
            const errorMessage = error?.message || 'An unknown error occurred';
            toast.error(existingTrade ? 'Failed to update trade' : 'Failed to add trade');
        } finally {
            setLoading(false); // Reset loading state
        }
    };

    useEffect(() => {
        const fetchChartData = async () => {
            if (!existingTrade || !existingTrade.ticker || !existingTrade.entry_datetime) {
                console.log('❌ Missing required trade data for chart:', { 
                    existingTrade: !!existingTrade,
                    ticker: existingTrade?.ticker,
                    entryDatetime: existingTrade?.entry_datetime
                });
                return;
            }
            
            setIsLoadingChart(true);
            try {
                // Use exact entry and exit datetimes from the trade
                const entryDate = new Date(existingTrade.entry_datetime);
                const exitDate = existingTrade.exit_datetime 
                    ? new Date(existingTrade.exit_datetime) 
                    : new Date();
    
                console.log('🔍 Fetching OHLCV data:', {
                    ticker: existingTrade.ticker,
                    entryDatetime: entryDate.toISOString(),
                    exitDatetime: exitDate.toISOString()
                });
                
                const data = await marketDataService.getOHLCVData(existingTrade.ticker, entryDate, exitDate);
                
                console.log('📊 OHLCV data received:', {
                    dataPoints: data.length,
                    firstDataPoint: data.length > 0 ? {
                        time: new Date(data[0].time * 1000).toISOString(),
                        open: data[0].open,
                        close: data[0].close
                    } : null,
                    lastDataPoint: data.length > 0 ? {
                        time: new Date(data[data.length - 1].time * 1000).toISOString(),
                        open: data[data.length - 1].open,
                        close: data[data.length - 1].close
                    } : null
                });
    
                setChartData(data);
                
                // Log trade actions
                const tradeActions = existingTrade.action_types?.map((type, index) => ({
                    type: type as 'BUY' | 'SELL',
                    price: Number(existingTrade.action_prices?.[index]) || 0,
                    time: Math.floor(new Date(existingTrade.action_datetimes?.[index] || '').getTime() / 1000) as UTCTimestamp,
                    shares: Number(existingTrade.action_shares?.[index]) || 0
                })) || [];
    
                console.log('🎯 Trade actions prepared:', tradeActions.map(action => ({
                    type: action.type,
                    price: action.price,
                    time: new Date(action.time * 1000).toISOString(),
                    shares: action.shares
                })));
                
            } catch (error) {
                console.error('❌ Error fetching chart data:', {
                    error,
                    trade: existingTrade
                });
                setChartData([]);
            } finally {
                setIsLoadingChart(false);
            }
        };
    
        fetchChartData();
    }, [existingTrade]);
    
    useEffect(() => {
        if (existingTrade) {
            const actions = existingTrade.action_types?.map((type, index) => ({
                type: type as 'BUY' | 'SELL',
                date: new Date(existingTrade.action_datetimes?.[index] || Date.now()),
                shares: existingTrade.action_shares?.[index]?.toString() || '',
                price: existingTrade.action_shares?.[index]?.toString() || ''
            })) || [{
                type: 'BUY',
                date: new Date(),
                shares: '',
                price: ''
            }];

            setTradeDetails({
                ticker: existingTrade.ticker,
                direction: existingTrade.direction,
                assetType: existingTrade.asset_type,
                stopLossPrice: existingTrade.stop_loss_price?.toString() || '',
                trailingStopLoss: existingTrade.trailing_stoploss?.toString() || '',
                actions,
                strategy: existingTrade.strategy || '',
                setups: existingTrade.setups || [],
            });
        }
    }, [existingTrade]);

    return (
        isOpen ? (
            <div className="modal modal-open">
                {loading && <div className="spinner">Loading...</div>}
                <div className="modal-box max-w-4xl">
                    <div className="tabs tabs-boxed mb-4">
                        <a 
                            className={`tab ${activeTab === 'general' ? 'tab-active' : ''}`}
                            onClick={() => setActiveTab('general')}
                        >
                            General
                        </a>
                        <a 
                            className={`tab ${activeTab === 'notes' ? 'tab-active' : ''}`}
                            onClick={() => setActiveTab('notes')}
                        >
                            Trade Replay, Notes & Mistakes
                        </a>  
                    </div>

                    {activeTab === 'general' ? (
                        <>
                            <h3 className="font-bold text-lg mb-4">Trade View</h3>
                            
                            <div className="grid grid-cols-5 gap-4 mb-6">
                                <div>
                                    <label className="label">Market</label>
                                    <select
                                        className="select select-bordered w-full"
                                        value={tradeDetails.assetType}
                                        onChange={e => setTradeDetails(prev => ({ ...prev, assetType: e.target.value }))}
                                    >
                                        <option value={ASSET_TYPES.STOCK}>STOCK</option>
                                        <option value={ASSET_TYPES.OPTION}>OPTION</option>
                                        <option value={ASSET_TYPES.CRYPTO}>CRYPTO</option>
                                        <option value={ASSET_TYPES.FOREX}>FOREX</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Ticker</label>
                                    <input
                                        type="text"
                                        className="input input-bordered w-full"
                                        value={tradeDetails.ticker}
                                        onChange={e => setTradeDetails(prev => ({ ...prev, ticker: e.target.value.toUpperCase() }))}
                                    />
                                </div>
                                <div>
                                    <label className="label">Initial Stoploss</label>
                                    <input
                                        type="number"
                                        className="input input-bordered w-full"
                                        value={tradeDetails.stopLossPrice}
                                        onChange={e => setTradeDetails(prev => ({ ...prev, stopLossPrice: e.target.value }))}
                                    />
                                </div>

                                <div>
                                    <label className="label">Trailing Stoploss</label>
                                    <input
                                        type="number"
                                        className="input input-bordered w-full"
                                        value={tradeDetails.trailingStopLoss}
                                        onChange={e => setTradeDetails(prev => ({ ...prev, trailingStopLoss: e.target.value }))}
                                        placeholder="Set trailing SL"
                                    />
                                </div>

                                <div>
                                    <label className="label">Direction</label>
                                    <button 
                                        className={`btn w-full ${tradeDetails.direction === DIRECTIONS.LONG ? 'btn-info' : 'btn-error'}`}
                                        onClick={() => setTradeDetails(prev => ({
                                            ...prev,
                                            direction: prev.direction === DIRECTIONS.LONG ? DIRECTIONS.SHORT : DIRECTIONS.LONG
                                        }))}
                                    >
                                        {tradeDetails.direction}
                                    </button>
                                </div>
                            </div>

                            <div className="flex gap-4 mb-6">
                                <div className="w-1/3">
                                    <label className="label">Strategy:</label>
                                    <div className="dropdown w-full">
                                        <div tabIndex={0} role="button" className="btn select select-bordered w-full" onClick={() => {}}>
                                            {selectedStrategy || "Select Strategy"}
                                        </div>
                                        <ul tabIndex={0} className="dropdown-content menu bg-base-100 rounded-box z-[1] w-full p-2 shadow">
                                            {Object.values(STRATEGIES).map(strategy => (
                                                <li key={strategy} onClick={() => setSelectedStrategy(strategy)}>
                                                    <a>{strategy}</a>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>

                                <div className="w-2/3">
                                    <label className="label">Setups:</label>
                                    <div className="dropdown w-full" id="dropdown-id">
                                        <div tabIndex={0} role="button" className="btn select select-bordered w-full" onClick={() => setIsDropdownOpen(prev => !prev)}>
                                            {selectedSetups.length > 0 ? selectedSetups.join(', ') : "Select Setups"}
                                        </div>
                                        {isDropdownOpen && (
                                            <ul tabIndex={0} className="dropdown-content menu bg-base-100 rounded-box z-[1] w-full p-3 shadow grid grid-cols-5 gap-3">
                                                {SETUPS.map(setup => (
                                                    <li key={setup}>
                                                        <div className="form-control">
                                                            <label className="label cursor-pointer flex items-center">
                                                                <input
                                                                    type="checkbox"
                                                                    value={setup}
                                                                    checked={selectedSetups.includes(setup)}
                                                                    onChange={(e) => {
                                                                        const value = e.target.value;
                                                                        setSelectedSetups(prev => 
                                                                            prev.includes(value) ? prev.filter(s => s !== value) : [...prev, value]
                                                                        );
                                                                    }}
                                                                    className="checkbox checkbox-primary mr-2" // Added margin-right for spacing
                                                                />
                                                                <span className="label-text">{setup}</span>
                                                            </label>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="overflow-x-auto mb-6">
                                <table className="table w-full">
                                    <thead>
                                        <tr>
                                            <th>Action</th>
                                            <th>Date/Time</th>
                                            <th>Quantity</th>
                                            <th>Price</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tradeDetails.actions.map((action, index) => (
                                            <tr key={index}>
                                                <td>
                                                    <button
                                                        onClick={() => toggleActionType(index)}
                                                        className={`btn btn-sm w-24 ${action.type === 'BUY' ? 'btn-info' : 'btn-error'}`}
                                                    >
                                                        {action.type}
                                                    </button>
                                                </td>
                                                <td>
                                                    <DatePicker
                                                        selected={action.date}
                                                        onChange={date => {
                                                            if (date) {
                                                                handleActionChange(index, 'date', date);
                                                            }
                                                        }}
                                                        className="input input-bordered input-sm w-full"
                                                        showTimeSelect
                                                        dateFormat="MM/dd/yyyy, hh:mm aa"
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        className="input input-bordered input-sm w-24"
                                                        value={action.shares}
                                                        onChange={e => handleActionChange(index, 'shares', e.target.value)}
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        className="input input-bordered input-sm w-24"
                                                        value={action.price}
                                                        onChange={e => handleActionChange(index, 'price', e.target.value)}
                                                    />
                                                </td>
                                                <td>
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => removeAction(index)}
                                                    >
                                                        ×
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {/* <div className="flex justify-center mt-6 mb-6 gap-8">
                                {isLoadingChart ? (
                                    <div className="h-[400px] w-full flex items-center justify-center">
                                        <span className="loading loading-spinner loading-lg"></span>
                                        <span className="ml-2">Loading chart data...</span>
                                    </div>
                                ) : chartData ? (
                                    <div className="w-full">
                                        <h3 className="text-lg font-semibold mb-2">Price History</h3>
                                        <TradeChart data={chartData.data} trades={chartData.trades} />
                                    </div>
                                ) : (
                                    <div className="h-[400px] w-full flex items-center justify-center text-gray-500">
                                        No chart data available
                                    </div>
                                )}
                            </div> */}

                            <div className="flex justify-center mt-6 mb-6 gap-8">
                                <button
                                    onClick={addAction}
                                    className="btn btn-danger btn-info"
                                >
                                    Add Actions
                                </button>
                                <button onClick={handleDeleteTrade} className="btn btn-error">
                                    Delete Trade
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <label className="label">Trade Replay</label>
                                <div className="h-[400px] w-full bg-base-200 rounded-lg overflow-hidden">
                                    {isLoadingChart ? (
                                        <div className="h-full w-full flex items-center justify-center">
                                            <span className="loading loading-spinner loading-lg"></span>
                                        </div>
                                    ) : chartData.length > 0 ? (
                                        <TradeReplayChart
                                            data={chartData}
                                            actions={tradeDetails.actions.map(action => ({
                                                type: action.type as 'BUY' | 'SELL',
                                                price: Number(action.price),
                                                time: Math.floor(new Date(action.date).getTime() / 1000) as UTCTimestamp,
                                                shares: Number(action.shares)
                                            }))}
                                        />
                                    ) : (
                                        <div className="h-full w-full flex items-center justify-center text-gray-500">
                                            No chart data available
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="label">Trade Notes</label>
                                <textarea
                                    className="textarea textarea-bordered w-full h-32"
                                    placeholder="Enter your trade notes here..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="label">Mistakes & Lessons</label>
                                <textarea
                                    className="textarea textarea-bordered w-full h-32"
                                    placeholder="Document any mistakes or lessons learned..."
                                    value={mistakes}
                                    onChange={(e) => setMistakes(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    <div className="modal-action">
                        <button className="btn" onClick={onClose} disabled={loading}>Close</button>
                        <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
                            {loading ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </div>
            </div>
        ) : null
    );
};

export default TradeHistoryModal;