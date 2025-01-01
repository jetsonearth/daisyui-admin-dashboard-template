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
import dayjs from 'dayjs';
import { marketDataService } from '../../../marketData/marketDataService';
import { TradeReplayChart } from '../../../../components/TradeReplayChart';
import { useDispatch, useSelector } from 'react-redux';
import { fetchOHLCVData, selectOHLCVData } from '../../../marketData/ohlcvSlice';
import { AppDispatch } from '../../../../app/store';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Tab } from '@headlessui/react';
import { ChevronUpDownIcon, CheckIcon } from '@heroicons/react/20/solid';
import { TrashIcon } from '@heroicons/react/24/outline';
import { Combobox } from '@headlessui/react';

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
    onSave?: () => void;
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
    mae_price?: number;
    mfe_price?: number;
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
        price: existingTrade.action_prices?.[index]?.toString() || ''
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
        mae_price: existingTrade.mae_price,
        mfe_price: existingTrade.mfe_price
    };
};

const TradeHistoryModal: React.FC<TradeHistoryModalProps> = ({ isOpen, onClose, onTradeAdded, onSave, existingTrade }) => {
    const [tradeDetails, setTradeDetails] = useState<TradeDetails>(
        existingTrade ? initializeTradeDetails(existingTrade) : defaultTradeDetails
    );

    // Add this state to track the reference datetime
    const [referenceDateTime, setReferenceDateTime] = useState<Date | null>(null);

    const [selectedStrategy, setSelectedStrategy] = useState<STRATEGIES | undefined>(
        existingTrade?.strategy as STRATEGIES || undefined
    );
    const [selectedSetups, setSelectedSetups] = useState<string[]>(
        existingTrade?.setups || []
    );

    const [activeTab, setActiveTab] = useState('details'); // 'details' or 'notes'
    const [notes, setNotes] = useState(existingTrade?.notes || '');
    const [mistakes, setMistakes] = useState(existingTrade?.mistakes || '');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const dispatch = useDispatch<AppDispatch>();
    const ohlcvState = useSelector(state => selectOHLCVData(state, existingTrade?.id));
    const [chartData, setChartData] = useState<any[]>([]);
    const [isLoadingChart, setIsLoadingChart] = useState(false);

    const [entryEfficiency, setEntryEfficiency] = useState(0);
    const [exitEfficiency, setExitEfficiency] = useState(0);
    const [totalEfficiency, setTotalEfficiency] = useState(0);
    const [totalRisk, setTotalRisk] = useState(0);
    const [riskPerShare, setRiskPerShare] = useState(0);
    const [slDistance, setSlDistance] = useState(0);
    const [rrr, setRRR] = useState(0);
    const [realizedGain, setRealizedGain] = useState(0);
    const [realizedPercentage, setRealizedPercentage] = useState(0);
    const [availableTradeRange, setAvailableTradeRange] = useState(0);
    const [atrR, setATRR] = useState(0);
    const [atrPercentage, setATRPercentage] = useState(0);
    const [endTradeDrawdown, setEndTradeDrawdown] = useState(0);
    const [remainingDistanceToTarget, setRemainingDistanceToTarget] = useState(0);
    const [mae, setMAE] = useState(0);
    const [mfe, setMFE] = useState(0);
    const [remainingDistanceToStop, setRemainingDistanceToStop] = useState(0);

    const [strategyQuery, setStrategyQuery] = useState('');
    const [setupsQuery, setSetupsQuery] = useState('');

    const filteredStrategies = strategyQuery === ''
        ? Object.values(STRATEGIES)
        : Object.values(STRATEGIES).filter((strategy) =>
            strategy.toLowerCase().includes(strategyQuery.toLowerCase())
        );

    const filteredSetups = setupsQuery === ''
        ? Object.values(SETUPS)
        : Object.values(SETUPS).filter((setup) =>
            setup.toLowerCase().includes(setupsQuery.toLowerCase())
        );

    useEffect(() => {
        if (existingTrade && isOpen) {
            setTradeDetails(initializeTradeDetails(existingTrade));
        }
    }, [existingTrade?.id, isOpen]);

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

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                toast.error('User not authenticated');
                return;
            }

            const { error } = await supabase
                .from('trades')
                .delete()
                .eq('id', existingTrade.id);

            if (error) {
                toast.error('Failed to delete trade');
                console.error("Error deleting trade:", error);
                return;
            }

            // Recalculate metrics after deletion
            await metricsService.handleTradeModification(user.id);

            toast.success('Trade deleted successfully');
            onTradeAdded(); // Refresh the trade list
            onClose(); // Close the modal
        } catch (error) {
            console.error('Error in handleDeleteTrade:', error);
            toast.error('Failed to delete trade');
        }
    };

    const [loading, setLoading] = useState(false);

    const addAction = () => {
        const newAction: Action = {
            type: 'BUY',
            // If we have a reference time and there are existing actions, use reference time
            // Otherwise use current time
            date: referenceDateTime || new Date(),
            shares: '',
            price: ''
        };

        const updatedActions = [...tradeDetails.actions, newAction];
        setTradeDetails({ ...tradeDetails, actions: updatedActions });

        // If this is the first action, set it as the reference time
        if (updatedActions.length === 1) {
            setReferenceDateTime(newAction.date);
        }
    };

    // Update action handler to maintain reference time
    const handleActionChange = (index: number, field: keyof Action, value: any) => {
        const updatedActions = [...tradeDetails.actions];
        const action = { ...updatedActions[index] };

        if (field === 'date') {
            action[field] = new Date(value);
            // If this is the first action, update reference time
            if (index === 0) {
                setReferenceDateTime(action.date);
            }
        } else {
            action[field] = value;
        }

        updatedActions[index] = action;
        setTradeDetails({ ...tradeDetails, actions: updatedActions });
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

            let tempHoldingPeriod = 0;
            let lastSellAction = null;

            let tradeId: string | undefined;

            let maeDollars = 0, maePercent = 0, maeR = 0;
            let mfeDollars = 0, mfePercent = 0, mfeR = 0;
            let minPrice = entryPrice;  // Default to entry price if we can't get high/low
            let maxPrice = entryPrice;

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
                                // Initialize MAE/MFE variables
                                if (prices.minPrice && prices.maxPrice) {
                                    minPrice = prices.minPrice;
                                    maxPrice = prices.maxPrice;

                                    const isLongTrade = tradeDetails.direction === DIRECTIONS.LONG;

                                    if (isLongTrade) {
                                        // For long trades:
                                        // MAE is when price goes against us (lowest price)
                                        // MFE is the best potential profit (highest price)
                                        console.log(`[${tradeDetails.ticker}] Long Trade - Entry: ${entryPrice}, Min: ${minPrice}, Max: ${maxPrice}`);
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
                                        console.log(`[${tradeDetails.ticker}] Short Trade - Entry: ${entryPrice}, Min: ${minPrice}, Max: ${maxPrice}`);
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
                            }
                        } catch (error) {
                            console.error('Error fetching high/low prices:', error);
                            toast.error('Failed to fetch high/low prices');
                        }

                        tempHoldingPeriod = Math.ceil((exitDateObj.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));
                        trimmedPercentage = ((totalShares - remainingShares) / totalShares) * 100;
                        unrealizedPnl = 0;
                        unrealizedPnlPercentage = 0;

                        // Use metricsService for consistent RRR calculation
                        const tempTrade = {
                            status: TRADE_STATUS.CLOSED,
                            entry_price: entryPrice,
                            total_shares: totalShares,
                            open_risk: slDistance,
                            realized_pnl: realizedPnl
                        } as Trade;
                        
                        rrr = metricsService.calculateRiskRewardRatio(tempTrade);
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
                    mae_price: tradeDetails.direction === DIRECTIONS.LONG ? minPrice : maxPrice,
                    mfe_price: tradeDetails.direction === DIRECTIONS.LONG ? maxPrice : minPrice,
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
                
                // Recalculate metrics after modifying an existing trade
                await metricsService.handleTradeModification(user.id);
                
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
                    console.log('🚗🚗🚗🚗🚗🚗🚗🚗🚗🚗🚗🚗 Streak Metrics:', streakMetrics);
                    
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
        if (!isOpen || !existingTrade?.id || !existingTrade.ticker || !existingTrade.entry_datetime) {
            return;
        }

        // Don't fetch if we already have data and it's less than 5 minutes old
        if (ohlcvState?.data && ohlcvState.lastUpdated && 
            Date.now() - ohlcvState.lastUpdated < 5 * 60 * 1000) {
            console.log('📊 Using cached OHLCV data:', {
                tradeId: existingTrade.id,
                ticker: existingTrade.ticker,
                dataPoints: ohlcvState.data.length
            });
            setChartData(ohlcvState.data);
            return;
        }

        // Use exact entry and exit datetimes from the trade
        const entryDate = new Date(existingTrade.entry_datetime);
        const exitDate = existingTrade.exit_datetime 
            ? new Date(existingTrade.exit_datetime) 
            : new Date();

        dispatch(fetchOHLCVData({
            ticker: existingTrade.ticker,
            startTime: entryDate,
            endTime: exitDate,
            tradeId: existingTrade.id
        }));

    }, [existingTrade?.id, isOpen]);

    // Update chart data when OHLCV data changes
    useEffect(() => {
        if (ohlcvState?.data && isOpen) {
            setChartData(ohlcvState.data);
        }
    }, [ohlcvState?.data, isOpen]);

    // Show loading state
    useEffect(() => {
        setIsLoadingChart(ohlcvState?.loading || false);
    }, [ohlcvState?.loading]);

    useEffect(() => {
        if (!existingTrade) return;

        const entryPrice = parseFloat(tradeDetails.actions[0]?.price || '0');
        const exitPrice = parseFloat(tradeDetails.actions[tradeDetails.actions.length - 1]?.price || '0');
        const stopLoss = parseFloat(tradeDetails.stopLossPrice || '0');
        const maePrice = existingTrade.mae_price || 0;
        const mfePrice = existingTrade.mfe_price || 0;

        // Calculate Available Trade Range
        const atr = Math.abs(mfePrice - maePrice);
        setAvailableTradeRange(atr);
        setATRR(atr / Math.abs(entryPrice - stopLoss));
        setATRPercentage((atr / entryPrice) * 100);

        // Calculate End Trade Drawdown
        const etd = Math.abs(mfePrice - exitPrice);
        setEndTradeDrawdown(etd);

        // Calculate Remaining Distance to Target (using 5R)
        const targetPrice = entryPrice + (5 * Math.abs(entryPrice - stopLoss));
        const rdt = Math.abs(targetPrice - mfePrice);
        setRemainingDistanceToTarget(rdt);

        // Set MAE and MFE
        setMAE(Math.abs(entryPrice - maePrice));
        setMFE(Math.abs(entryPrice - mfePrice));

        // Calculate Remaining Distance to Stop
        const rds = Math.abs(maePrice - stopLoss);
        setRemainingDistanceToStop(rds);

        // Calculate Efficiencies
        const entryEff = (Math.abs(mfePrice - entryPrice) / atr) * 100;
        const exitEff = (Math.abs(exitPrice - entryPrice) / atr) * 100;
        const totalEff = ((exitPrice - entryPrice) / atr) * 100;

        setEntryEfficiency(Math.round(entryEff));
        setExitEfficiency(Math.round(exitEff));
        setTotalEfficiency(Math.round(totalEff));

        // Calculate Risk Metrics
        const shares = parseFloat(tradeDetails.actions[0]?.shares || '0');
        const riskPerShare = Math.abs(entryPrice - stopLoss);
        const totalRiskAmount = riskPerShare * shares;

        setRiskPerShare(riskPerShare);
        setTotalRisk(totalRiskAmount);
        setSlDistance(riskPerShare);

        // Calculate Profit Metrics
        const realizedGainAmount = (exitPrice - entryPrice) * shares;
        const realizedPercentageValue = ((exitPrice - entryPrice) / entryPrice) * 100;
        const rrrValue = Math.abs((exitPrice - entryPrice) / riskPerShare);

        setRealizedGain(realizedGainAmount);
        setRealizedPercentage(realizedPercentageValue);
        setRRR(rrrValue);

    }, [existingTrade, tradeDetails]);

    // Add this function to convert trade actions to chart actions
    const convertActionsToChartFormat = (actions: Action[]) => {
        return actions.map(action => ({
            type: action.type,
            price: parseFloat(action.price),
            time: action.date.getTime() / 1000 as UTCTimestamp,
            shares: parseFloat(action.shares)
        }));
    };

    // Helper function to format date
    const formatDateForInput = (date: Date | string) => {
        if (!date) return { date: '', time: '' };
        const d = typeof date === 'string' ? new Date(date) : date;
        return {
            date: d.toISOString().split('T')[0],
            time: d.toTimeString().slice(0, 5)
        };
    };

    const handleAddAction = () => {
        const newAction = {
            type: 'BUY',
            date: new Date(),
            shares: '',
            price: ''
        };
        setTradeDetails(prev => ({
            ...prev,
            actions: [...prev.actions, newAction]
        }));
    };

    const handleRemoveAction = (index: number) => {
        setTradeDetails(prev => ({
            ...prev,
            actions: prev.actions.filter((_, i) => i !== index) // Remove the action at the specified index
        }));
    };

    const handleSave = async () => {
        try {
            const tradeData = {
                id: existingTrade?.id,
                ticker: tradeDetails.ticker,
                asset_type: tradeDetails.assetType,
                direction: tradeDetails.direction,
                strategy: tradeDetails.strategy,
                setups: tradeDetails.setups,
                stop_loss_price: parseFloat(tradeDetails.stopLossPrice),
                trailing_stop_loss: parseFloat(tradeDetails.trailingStopLoss),
                notes: notes,
                mistakes: mistakes,
                actions: tradeDetails.actions.map(action => ({
                    type: action.type,
                    datetime: action.date,
                    shares: parseFloat(action.shares),
                    price: parseFloat(action.price)
                }))
            };

            let response;
            if (existingTrade) {
                response = await supabase
                    .from('trades')
                    .update(tradeData)
                    .eq('id', existingTrade.id);
            } else {
                response = await supabase
                    .from('trades')
                    .insert([tradeData]);
            }

            if (response.error) throw response.error;
            
            // Show success toast
            toast.success('Trade saved successfully!');
            
            // Close modal and refresh data
            onClose();
            if (onSave) onSave();
        } catch (error) {
            console.error('Error saving trade:', error);
            toast.error('Failed to save trade. Please try again.');
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
                >
                    <motion.div
                        initial={{ scale: 0.95 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0.95 }}
                        className="relative w-[1800px] h-[1200px] bg-base-100 rounded-lg shadow-xl"
                    >
                        <Tab.Group>
                            {/* Modal Header */}
                            <div className="bg-base-100 border-b border-base-200 px-6 py-4">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-xl font-bold text-base-content">Trade History</h2>
                                    <button onClick={onClose} className="btn btn-ghost btn-sm">
                                        <XMarkIcon className="h-5 w-5" />
                                    </button>
                                </div>
                                
                                {/* Tabs */}
                                <Tab.List className="flex space-x-4 mt-4">
                                    <Tab
                                        className={({ selected }) =>
                                            `px-4 py-2 rounded-lg transition-colors duration-200 ${
                                                selected ? 'bg-primary text-primary-content' : 'hover:bg-base-200'
                                            }`
                                        }
                                    >
                                        Details
                                    </Tab>
                                    <Tab
                                        className={({ selected }) =>
                                            `px-4 py-2 rounded-lg transition-colors duration-200 ${
                                                selected ? 'bg-primary text-primary-content' : 'hover:bg-base-200'
                                            }`
                                        }
                                    >
                                        Notes & Mistakes
                                    </Tab>
                                </Tab.List>
                            </div>

                            {/* Modal Content */}
                            <div className="p-6">
                                <Tab.Panels>
                                    <Tab.Panel>
                                        <div className="grid grid-cols-2 gap-8">
                                            {/* Left Column - Trade Details */}
                                            <div className="space-y-6">
                                                <div className="grid grid-cols-2 gap-4">
                                                    {/* Trade Details Fields */}
                                                    <div>
                                                        <label className="label">Ticker</label>
                                                        <input
                                                            type="text"
                                                            className="input input-bordered w-full bg-base-200"
                                                            value={tradeDetails.ticker}
                                                            onChange={e => setTradeDetails(prev => ({ ...prev, ticker: e.target.value.toUpperCase() }))}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="label">Asset Type</label>
                                                        <select
                                                            className="select select-bordered w-full bg-base-200"
                                                            value={tradeDetails.assetType}
                                                            onChange={e => setTradeDetails(prev => ({ ...prev, assetType: e.target.value }))}
                                                        >
                                                            <option value={ASSET_TYPES.STOCK}>Stock</option>
                                                            <option value={ASSET_TYPES.OPTION}>Option</option>
                                                            <option value={ASSET_TYPES.CRYPTO}>Crypto</option>
                                                            <option value={ASSET_TYPES.FOREX}>Forex</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-3 gap-4">
                                                    <div>
                                                        <label className="label">Initial SL</label>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            className="input input-bordered w-full bg-base-200"
                                                            value={tradeDetails.stopLossPrice}
                                                            onChange={e => setTradeDetails(prev => ({ ...prev, stopLossPrice: e.target.value }))}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="label">Trailing SL</label>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            className="input input-bordered w-full bg-base-200"
                                                            value={tradeDetails.trailingStopLoss}
                                                            onChange={e => setTradeDetails(prev => ({ ...prev, trailingStopLoss: e.target.value }))}
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

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="label">Strategy</label>
                                                        <Combobox
                                                            value={tradeDetails.strategy}
                                                            onChange={(value) => setTradeDetails(prev => ({ ...prev, strategy: value }))}
                                                        >
                                                            <div className="relative">
                                                                <div className="relative w-full cursor-default overflow-hidden rounded-lg bg-base-200 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-teal-300 sm:text-sm">
                                                                    <Combobox.Input
                                                                        className="w-full border-none py-2 pl-3 pr-10 text-sm leading-5 bg-base-200 focus:ring-0"
                                                                        onChange={(event) => setStrategyQuery(event.target.value)}
                                                                        displayValue={(strategy: string) => strategy}
                                                                    />
                                                                    <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
                                                                        <ChevronUpDownIcon
                                                                            className="h-5 w-5 text-gray-400"
                                                                            aria-hidden="true"
                                                                        />
                                                                    </Combobox.Button>
                                                                </div>
                                                                <Combobox.Options className="absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-base-200 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm z-50">
                                                                    {filteredStrategies.map((strategy) => (
                                                                        <Combobox.Option
                                                                            key={strategy}
                                                                            value={strategy}
                                                                            className={({ active }) =>
                                                                                `relative cursor-default select-none py-2 pl-10 pr-4 ${
                                                                                    active ? 'bg-primary text-primary-content' : 'text-base-content'
                                                                                }`
                                                                            }
                                                                        >
                                                                            {({ selected, active }) => (
                                                                                <>
                                                                                    <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                                                                                        {strategy}
                                                                                    </span>
                                                                                    {selected ? (
                                                                                        <span className={`absolute inset-y-0 left-0 flex items-center pl-3 ${active ? 'text-primary-content' : 'text-primary'}`}>
                                                                                            <CheckIcon className="h-5 w-5" aria-hidden="true" />
                                                                                        </span>
                                                                                    ) : null}
                                                                                </>
                                                                            )}
                                                                        </Combobox.Option>
                                                                    ))}
                                                                </Combobox.Options>
                                                            </div>
                                                        </Combobox>
                                                    </div>
                                                    <div>
                                                        <label className="label">Setups</label>
                                                        <Combobox
                                                            value={tradeDetails.setups}
                                                            onChange={(value) => setTradeDetails(prev => ({ ...prev, setups: Array.isArray(value) ? value : [value] }))}
                                                            multiple
                                                        >
                                                            <div className="relative">
                                                                <div className="relative w-full cursor-default overflow-hidden rounded-lg bg-base-200 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-teal-300 sm:text-sm">
                                                                    <Combobox.Input
                                                                        className="w-full border-none py-2 pl-3 pr-10 text-sm leading-5 bg-base-200 focus:ring-0"
                                                                        onChange={(event) => setSetupsQuery(event.target.value)}
                                                                        displayValue={(setups: string[]) => setups.join(', ')}
                                                                    />
                                                                    <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
                                                                        <ChevronUpDownIcon
                                                                            className="h-5 w-5 text-gray-400"
                                                                            aria-hidden="true"
                                                                        />
                                                                    </Combobox.Button>
                                                                </div>
                                                                <Combobox.Options className="absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-base-200 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm z-50">
                                                                    {filteredSetups.map((setup) => (
                                                                        <Combobox.Option
                                                                            key={setup}
                                                                            value={setup}
                                                                            className={({ active }) =>
                                                                                `relative cursor-default select-none py-2 pl-10 pr-4 ${
                                                                                    active ? 'bg-primary text-primary-content' : 'text-base-content'
                                                                                }`
                                                                            }
                                                                        >
                                                                            {({ selected, active }) => (
                                                                                <>
                                                                                    <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                                                                                        {setup}
                                                                                    </span>
                                                                                    {selected ? (
                                                                                        <span className={`absolute inset-y-0 left-0 flex items-center pl-3 ${active ? 'text-primary-content' : 'text-primary'}`}>
                                                                                            <CheckIcon className="h-5 w-5" aria-hidden="true" />
                                                                                        </span>
                                                                                    ) : null}
                                                                                </>
                                                                            )}
                                                                        </Combobox.Option>
                                                                    ))}
                                                                </Combobox.Options>
                                                            </div>
                                                        </Combobox>
                                                    </div>
                                                </div>

                                                {/* Trade Actions Table */}
                                                <div className="mt-6">
                                                    <div className="flex justify-between items-center mb-4">
                                                        <h3 className="text-lg font-medium text-base-content">Trade Actions</h3>
                                                        <button
                                                            className="btn btn-primary btn-sm"
                                                            onClick={handleAddAction}
                                                        >
                                                            Add Action
                                                        </button>
                                                    </div>
                                                    <div className="overflow-x-auto">
                                                        <table className="table w-full">
                                                            <thead>
                                                                <tr>
                                                                    <th>Type</th>
                                                                    <th>Date/Time</th>
                                                                    <th>Shares</th>
                                                                    <th>Price</th>
                                                                    <th>Actions</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {tradeDetails.actions.map((action, index) => (
                                                                    <tr key={index}>
                                                                        <td>
                                                                            <button
                                                                                className={`badge ${action.type === 'BUY' ? 'badge-success' : 'badge-error'} p-4 cursor-pointer`}
                                                                                onClick={() => toggleActionType(index)}
                                                                            >
                                                                                {action.type}
                                                                            </button>
                                                                        </td>
                                                                        <td>
                                                                            <DatePicker
                                                                                selected={action.date}
                                                                                onChange={(date) => handleActionChange(index, 'date', date)}
                                                                                showTimeSelect
                                                                                dateFormat="yyyy-MM-dd HH:mm"
                                                                                className="input input-bordered input-sm w-full max-w-xs bg-base-200"
                                                                            />
                                                                        </td>
                                                                        <td>
                                                                            <input
                                                                                type="number"
                                                                                value={action.shares}
                                                                                onChange={(e) => handleActionChange(index, 'shares', e.target.value)}
                                                                                className="input input-bordered input-sm w-full max-w-xs bg-base-200"
                                                                            />
                                                                        </td>
                                                                        <td>
                                                                            <input
                                                                                type="number"
                                                                                step="0.01"
                                                                                value={action.price}
                                                                                onChange={(e) => handleActionChange(index, 'price', e.target.value)}
                                                                                className="input input-bordered input-sm w-full max-w-xs bg-base-200"
                                                                            />
                                                                        </td>
                                                                        <td>
                                                                            <button
                                                                                onClick={() => removeAction(index)}
                                                                                className="btn btn-ghost btn-sm"
                                                                            >
                                                                                <TrashIcon className="h-5 w-5 text-error" />
                                                                            </button>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Right Column - Trade Analytics */}
                                            <div className="space-y-6">
                                                {/* Efficiency Metrics */}
                                                <div className="grid grid-cols-3 gap-4">
                                                    <div className="bg-base-200 p-4 rounded-lg">
                                                        <div className="text-sm opacity-70 mb-1">Entry Efficiency</div>
                                                        <div className="text-3xl font-bold text-info">{entryEfficiency}%</div>
                                                    </div>
                                                    <div className="bg-base-200 p-4 rounded-lg">
                                                        <div className="text-sm opacity-70 mb-1">Exit Efficiency</div>
                                                        <div className="text-3xl font-bold text-success">{exitEfficiency}%</div>
                                                    </div>
                                                    <div className="bg-base-200 p-4 rounded-lg">
                                                        <div className="text-sm opacity-70 mb-1">Total Efficiency</div>
                                                        <div className="text-3xl font-bold text-primary">{totalEfficiency}%</div>
                                                    </div>
                                                </div>

                                                {/* Risk and Profit Metrics */}
                                                <div className="grid grid-cols-2 gap-6">
                                                    <div className="bg-base-200 p-4 rounded-lg">
                                                        <h4 className="font-medium mb-4">Risk Metrics</h4>
                                                        <div className="space-y-2">
                                                            <div className="flex justify-between">
                                                                <span className="opacity-70">Total Risk</span>
                                                                <span>${totalRisk.toFixed(2)}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="opacity-70">Risk Per Share</span>
                                                                <span>${riskPerShare.toFixed(2)}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="opacity-70">SL Distance</span>
                                                                <span>${slDistance.toFixed(2)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="bg-base-200 p-4 rounded-lg">
                                                        <h4 className="font-medium mb-4">Profit Metrics</h4>
                                                        <div className="space-y-2">
                                                            <div className="flex justify-between">
                                                                <span className="opacity-70">Realized Gain</span>
                                                                <span>${realizedGain.toFixed(2)}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="opacity-70">Realized %</span>
                                                                <span>{realizedPercentage.toFixed(2)}%</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="opacity-70">R:R Ratio</span>
                                                                <span>{rrr.toFixed(2)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Trade Range Metrics */}
                                                <div className="space-y-4">
                                                    <div className="bg-base-200 p-4 rounded-lg flex justify-between items-center">
                                                        <span className="opacity-70">Available Trade Range</span>
                                                        <span>${availableTradeRange.toFixed(2)}</span>
                                                    </div>
                                                    <div className="bg-base-200 p-4 rounded-lg flex justify-between items-center">
                                                        <span className="opacity-70">End Trade Drawdown</span>
                                                        <span>${endTradeDrawdown.toFixed(2)}</span>
                                                    </div>
                                                    <div className="bg-base-200 p-4 rounded-lg flex justify-between items-center">
                                                        <span className="opacity-70">Remaining Distance to Target</span>
                                                        <span>${remainingDistanceToTarget.toFixed(2)}</span>
                                                    </div>
                                                    <div className="bg-base-200 p-4 rounded-lg flex justify-between items-center">
                                                        <span className="opacity-70">Maximum Adverse Excursion</span>
                                                        <span>${mae.toFixed(2)}</span>
                                                    </div>
                                                    <div className="bg-base-200 p-4 rounded-lg flex justify-between items-center">
                                                        <span className="opacity-70">Maximum Favorable Excursion</span>
                                                        <span>${mfe.toFixed(2)}</span>
                                                    </div>
                                                    <div className="bg-base-200 p-4 rounded-lg flex justify-between items-center">
                                                        <span className="opacity-70">Remaining Distance to Stop</span>
                                                        <span>${remainingDistanceToStop.toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </Tab.Panel>

                                    <Tab.Panel>
                                        {/* Notes Tab Content */}
                                        <div className="space-y-6">
                                            {/* Chart Replay Section */}
                                            <div>
                                                <h3 className="text-lg font-medium text-base-content mb-4">Chart Replay</h3>
                                                <div className="h-[500px] bg-base-200 rounded-lg">
                                                    {isLoadingChart ? (
                                                        <div className="flex items-center justify-center h-full">
                                                            <span className="loading loading-spinner loading-lg"></span>
                                                        </div>
                                                    ) : (
                                                        <TradeReplayChart 
                                                            data={chartData}
                                                            actions={convertActionsToChartFormat(tradeDetails.actions)}
                                                            stopLossPrice={parseFloat(tradeDetails.stopLossPrice)}
                                                            maePrice={tradeDetails.mae_price}
                                                            mfePrice={tradeDetails.mfe_price}
                                                        />
                                                    )}
                                                </div>
                                            </div>

                                            {/* Notes and Mistakes Grid */}
                                            <div className="grid grid-cols-2 gap-8">
                                                {/* Notes Section */}
                                                <div>
                                                    <h3 className="text-lg font-medium text-base-content mb-4">Trade Notes</h3>
                                                    <textarea
                                                        className="textarea textarea-bordered w-full h-40 bg-base-200"
                                                        placeholder="Write your trade notes here..."
                                                        value={notes}
                                                        onChange={(e) => setNotes(e.target.value)}
                                                    />
                                                </div>

                                                {/* Mistakes Section */}
                                                <div>
                                                    <h3 className="text-lg font-medium text-base-content mb-4">Mistakes & Lessons</h3>
                                                    <textarea
                                                        className="textarea textarea-bordered w-full h-40 bg-base-200"
                                                        placeholder="Document any mistakes or lessons learned..."
                                                        value={mistakes}
                                                        onChange={(e) => setMistakes(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </Tab.Panel>
                                </Tab.Panels>
                            </div>

                            {/* Modal Footer */}
                            <div className="bg-base-100 border-t border-base-200 px-6 py-4">
                                <div className="flex justify-end gap-2">
                                    <button className="btn" onClick={onClose}>Close</button>
                                    <button className="btn btn-primary" onClick={handleSave}>Save</button>
                                </div>
                            </div>
                        </Tab.Group>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default TradeHistoryModal;