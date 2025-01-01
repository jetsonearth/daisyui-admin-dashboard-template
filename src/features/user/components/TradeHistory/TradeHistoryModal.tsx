import React, { useEffect, useState, useCallback } from 'react';
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

// Interfaces
interface MetricsState {
    mae: {
        price: number;
        ticks: number;
        r: number;
        dollars: number;
    };
    mfe: {
        price: number;
        ticks: number;
        r: number;
        dollars: number;
    };
    efficiency: {
        entry: number;
        exit: number;
        total: number;
    };
    atr: {
        dollars: number;
        ticks: number;
        r: number;
    };
    etd: {
        dollars: number;
        ticks: number;
        r: number;
    };
    rdt: {
        dollars: number;
        ticks: number;
        r: number;
    };
    rds: {
        dollars: number;
        ticks: number;
        r: number;
    };
    risk: {
        perShare: number;
        total: number;
        distance: number;
    };
    realized: {
        gain: number;
        percentage: number;
        rrr: number;
    };
}

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

// Initial States
const initialMetricsState: MetricsState = {
    mae: { price: 0, ticks: 0, r: 0, dollars: 0 },
    mfe: { price: 0, ticks: 0, r: 0, dollars: 0 },
    efficiency: { entry: 0, exit: 0, total: 0 },
    atr: { dollars: 0, ticks: 0, r: 0 },
    etd: { dollars: 0, ticks: 0, r: 0 },
    rdt: { dollars: 0, ticks: 0, r: 0 },
    rds: { dollars: 0, ticks: 0, r: 0 },
    risk: { perShare: 0, total: 0, distance: 0 },
    realized: { gain: 0, percentage: 0, rrr: 0 }
};

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

// Helper Functions
const calculateEntryPrice = (actions: Action[]): number => {
    const buyActions = actions.filter(a => a.type === 'BUY');
    if (buyActions.length === 0) return 0;

    const totalShares = buyActions.reduce((sum, action) => sum + parseFloat(action.shares), 0);
    const weightedSum = buyActions.reduce((sum, action) =>
        sum + parseFloat(action.shares) * parseFloat(action.price), 0);

    return weightedSum / totalShares;
};

const calculateTotalShares = (actions: Action[]): number => {
    return actions.reduce((sum, action) => {
        const shares = parseFloat(action.shares);
        return action.type === 'BUY' ? sum + shares : sum - shares;
    }, 0);
};

const getTickSize = (symbol: string): number => {
    if (symbol?.includes('ES')) return 0.25;
    if (symbol?.includes('NQ')) return 0.25;
    if (symbol?.includes('CL')) return 0.01;
    return 0.01;
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

    // Initialize trade details from existing trade
    return {
        ticker: existingTrade.ticker || '',
        direction: existingTrade.direction || DIRECTIONS.LONG,
        assetType: existingTrade.asset_type || ASSET_TYPES.STOCK,
        stopLossPrice: existingTrade.stop_loss_price?.toString() || '',
        trailingStopLoss: existingTrade.trailing_stoploss?.toString() || '',
        actions,
        strategy: existingTrade.strategy || '',
        setups: existingTrade.setups || [],
        mae_price: existingTrade.mae_price,
        mfe_price: existingTrade.mfe_price
    };
};

const convertActionsToChartFormat = (actions: Action[]) => {
    return actions.map(action => ({
        type: action.type,
        price: parseFloat(action.price),
        time: action.date.getTime() / 1000 as UTCTimestamp,
        shares: parseFloat(action.shares)
    }));
};

// Component Implementation
const TradeHistoryModal: React.FC<TradeHistoryModalProps> = ({ isOpen, onClose, onTradeAdded, onSave, existingTrade }) => {
    // Core state
    const [tradeDetails, setTradeDetails] = useState<TradeDetails>(
        existingTrade ? initializeTradeDetails(existingTrade) : defaultTradeDetails
    );
    const [metrics, setMetrics] = useState<MetricsState>(initialMetricsState);
    const [referenceDateTime, setReferenceDateTime] = useState<Date | null>(null);

    // UI state
    const [notes, setNotes] = useState(existingTrade?.notes || '');
    const [mistakes, setMistakes] = useState(existingTrade?.mistakes || '');
    const [loading, setLoading] = useState(false);
    const [isLoadingChart, setIsLoadingChart] = useState(false);
    const [chartData, setChartData] = useState<any[]>([]);
    const [strategyQuery, setStrategyQuery] = useState('');
    const [setupsQuery, setSetupsQuery] = useState('');

    // Redux with proper typing
    const dispatch: AppDispatch = useDispatch();
    const ohlcvState = useSelector((state: any) =>
        selectOHLCVData(state, existingTrade?.id || '')
    );

    // Computed values
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

    // Effects
    useEffect(() => {
        if (existingTrade && isOpen) {
            setTradeDetails(initializeTradeDetails(existingTrade));
        }
    }, [existingTrade?.id, isOpen]);

    useEffect(() => {
        if (!isOpen || !existingTrade?.id || !existingTrade.ticker || !existingTrade.entry_datetime) {
            return;
        }

        if (ohlcvState?.data && ohlcvState.lastUpdated &&
            Date.now() - ohlcvState.lastUpdated < 5 * 60 * 1000) {
            setChartData(ohlcvState.data);
            return;
        }

        const entryDate = new Date(existingTrade.entry_datetime);
        const exitDate = existingTrade.exit_datetime
            ? new Date(existingTrade.exit_datetime)
            : new Date();

        void dispatch(fetchOHLCVData({
            ticker: existingTrade.ticker,
            startTime: entryDate,
            endTime: exitDate,
            tradeId: existingTrade.id
        }));
    }, [existingTrade?.id, isOpen, dispatch]);

    useEffect(() => {
        setIsLoadingChart(ohlcvState?.loading || false);
        if (ohlcvState?.data && isOpen) {
            setChartData(ohlcvState.data);
        }
    }, [ohlcvState?.data, ohlcvState?.loading, isOpen]);

    // Handlers
    const handleDeleteTrade = async () => {
        if (!existingTrade) return;

        try {
            const { error } = await supabase
                .from('trades')
                .delete()
                .eq('id', existingTrade.id);

            if (error) throw error;

            toast.success('Trade deleted successfully');
            onClose();
            onTradeAdded();
        } catch (error) {
            console.error('Error deleting trade:', error);
            toast.error('Failed to delete trade');
        }
    };

    const addAction = () => {
        const newAction: Action = {
            type: 'BUY',
            date: referenceDateTime || new Date(),
            shares: '',
            price: ''
        };

        const updatedActions = [...tradeDetails.actions, newAction];
        setTradeDetails({ ...tradeDetails, actions: updatedActions });

        if (updatedActions.length === 1) {
            setReferenceDateTime(newAction.date);
        }
    };

    const handleActionChange = (index: number, field: keyof Action, value: any) => {
        const updatedActions = [...tradeDetails.actions];
        const action = { ...updatedActions[index] };

        if (field === 'date') {
            action[field] = new Date(value);
            setReferenceDateTime(action.date);  // Always update reference time when any date changes
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
            actions: prev.actions.filter((_, i) => i !== index)
        }));
    };


    const calculateMetrics = async (
        tradeDetails: TradeDetails,
        entryPrice: number,
        exitPrice: number | null,
        totalShares: number,
        remainingShares: number
    ): Promise<MetricsState> => {
        const newMetrics = { ...initialMetricsState };
        const tickSize = getTickSize(tradeDetails.ticker);
        const isLongTrade = tradeDetails.direction === DIRECTIONS.LONG;

        try {
            if (!exitPrice) return newMetrics;

            const entryDate = new Date(tradeDetails.actions[0].date);
            const exitDate = exitPrice 
                ? new Date(tradeDetails.actions[tradeDetails.actions.length - 1].date)  // Use actual exit date if closed
                : new Date();  // Use current date if still open

            const prices = await marketDataService.getHighLowPrices(tradeDetails.ticker, entryDate, exitDate);

            if (!prices || prices.status !== 'success') return newMetrics;

            const { minPrice = entryPrice, maxPrice = entryPrice } = prices;
            const riskPerShare = Math.abs(entryPrice - parseFloat(tradeDetails.stopLossPrice));

            // Calculate base metrics that don't depend on direction
            const atr = Math.abs(maxPrice - minPrice);
            newMetrics.atr = {
                dollars: atr * totalShares,
                ticks: Math.round(atr / tickSize),
                r: atr / riskPerShare
            };

            newMetrics.risk = {
                perShare: riskPerShare,
                total: riskPerShare * totalShares,
                distance: Math.abs(entryPrice - parseFloat(tradeDetails.stopLossPrice)) / entryPrice
            };

            if (isLongTrade) {
                // Long trade calculations
                calculateLongTradeMetrics(newMetrics, {
                    entryPrice,
                    exitPrice,
                    minPrice,
                    maxPrice,
                    totalShares,
                    tickSize,
                    riskPerShare
                });
            } else {
                // Short trade calculations
                calculateShortTradeMetrics(newMetrics, {
                    entryPrice,
                    exitPrice,
                    minPrice,
                    maxPrice,
                    totalShares,
                    tickSize,
                    riskPerShare
                });
            }

            return newMetrics;
        } catch (error) {
            console.error('Error calculating metrics:', error);
            return newMetrics;
        }
    };

    const calculateLongTradeMetrics = (
        metrics: MetricsState,
        params: {
            entryPrice: number;
            exitPrice: number;
            minPrice: number;
            maxPrice: number;
            totalShares: number;
            tickSize: number;
            riskPerShare: number;
        }
    ) => {
        const { entryPrice, exitPrice, minPrice, maxPrice, totalShares, tickSize, riskPerShare } = params;

        // MAE calculations - use stop loss if price went below it
        const stopLossPrice = parseFloat(tradeDetails.stopLossPrice);
        const effectiveMinPrice = stopLossPrice && minPrice < stopLossPrice 
            ? stopLossPrice  // If price went below stop loss, use stop loss as MAE
            : minPrice;     // Otherwise use actual lowest price
        
        const maeDiff = Math.max(0, entryPrice - effectiveMinPrice);
        metrics.mae = {
            price: effectiveMinPrice,
            ticks: Math.round(maeDiff / tickSize),
            r: maeDiff / riskPerShare,
            dollars: maeDiff * totalShares
        };

        // MFE calculations - no capping for profit potential
        const mfeDiff = Math.max(0, maxPrice - entryPrice);
        metrics.mfe = {
            price: maxPrice,
            ticks: Math.round(mfeDiff / tickSize),
            r: mfeDiff / riskPerShare,
            dollars: mfeDiff * totalShares
        };

        // ETD calculations - no capping, want to see full potential missed
        const etdDiff = Math.max(0, maxPrice - exitPrice);
        metrics.etd = {
            dollars: etdDiff * totalShares,
            ticks: Math.round(etdDiff / tickSize),
            r: etdDiff / riskPerShare
        };

        // RDT calculations - no capping for target potential
        const target = entryPrice + (5 * riskPerShare);
        const rdtDiff = target - maxPrice;
        metrics.rdt = {
            dollars: rdtDiff * totalShares,
            ticks: Math.round(rdtDiff / tickSize),
            r: rdtDiff / riskPerShare
        };

        // RDS calculations - use effective min price since it's risk-related
        const rdsDiff = Math.max(0, effectiveMinPrice - stopLossPrice);
        metrics.rds = {
            dollars: rdsDiff * totalShares,
            ticks: Math.round(rdsDiff / tickSize),
            r: rdsDiff / riskPerShare
        };

        // Efficiency calculations
        metrics.efficiency = {
            entry: (maxPrice - entryPrice) / (maxPrice - effectiveMinPrice),
            exit: 1 - (maxPrice - exitPrice) / (maxPrice - effectiveMinPrice),
            total: (exitPrice - entryPrice) / (maxPrice - effectiveMinPrice)
        };

        // Realized gain calculations
        const realizedDiff = exitPrice - entryPrice;   
        metrics.realized = {
            gain: realizedDiff * totalShares,
            percentage: (realizedDiff / entryPrice) * 100,
            rrr: realizedDiff / riskPerShare
        };
    };

    const calculateShortTradeMetrics = (
        metrics: MetricsState,
        params: {
            entryPrice: number;
            exitPrice: number;
            minPrice: number;
            maxPrice: number;
            totalShares: number;
            tickSize: number;
            riskPerShare: number;
        }
    ) => {
        const { entryPrice, exitPrice, minPrice, maxPrice, totalShares, tickSize, riskPerShare } = params;

        // For short trades, the calculations are inverted
        const maeDiff = Math.max(0, maxPrice - entryPrice);
        metrics.mae = {
            price: maxPrice,
            ticks: Math.round(maeDiff / tickSize),
            r: maeDiff / riskPerShare,
            dollars: maeDiff * totalShares
        };

        const mfeDiff = Math.max(0, entryPrice - minPrice);
        metrics.mfe = {
            price: minPrice,
            ticks: Math.round(mfeDiff / tickSize),
            r: mfeDiff / riskPerShare,
            dollars: mfeDiff * totalShares
        };

        // ETD calculations for shorts
        const etdDiff = Math.max(0, exitPrice - minPrice);
        metrics.etd = {
            dollars: etdDiff * totalShares,
            ticks: Math.round(etdDiff / tickSize),
            r: etdDiff / riskPerShare
        };

        // RDT calculations for shorts (5R target)
        const target = entryPrice - (5 * riskPerShare);
        const rdtDiff = minPrice - target;
        metrics.rdt = {
            dollars: rdtDiff * totalShares,
            ticks: Math.round(rdtDiff / tickSize),
            r: rdtDiff / riskPerShare
        };

        // RDS calculations for shorts
        const rdsDiff = Math.max(0, parseFloat(tradeDetails.stopLossPrice) - maxPrice);
        metrics.rds = {
            dollars: rdsDiff * totalShares,
            ticks: Math.round(rdsDiff / tickSize),
            r: rdsDiff / riskPerShare
        };

        // Efficiency calculations for shorts 
        metrics.efficiency = {
            entry: 1 - (entryPrice - minPrice) / (maxPrice - minPrice),  // How much of the move we captured from entry
            exit: (exitPrice - minPrice) / (maxPrice - minPrice),  // How much we captured to exit
            total: (entryPrice - exitPrice) / (maxPrice - minPrice)  // Total efficiency of the trade
        };

        // Realized gain calculations for shorts
        const realizedDiff = entryPrice - exitPrice;
        metrics.realized = {
            gain: realizedDiff * totalShares,
            percentage: (realizedDiff / entryPrice) * 100,
            rrr: realizedDiff / riskPerShare
        };
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                toast.error('Please log in to add trades');
                return;
            }

            // Calculate base trade values
            const { totalShares, remainingShares, entryPrice, exitPrice } = calculateTradeBaseValues(tradeDetails.actions);

            // Calculate metrics
            const metrics = await calculateMetrics(
                tradeDetails,
                entryPrice,
                exitPrice,
                totalShares,
                remainingShares
            );

            console.log('Calculated Metrics:', {
                baseValues: {
                    entryPrice,
                    exitPrice,
                    totalShares,
                    remainingShares
                },
                metrics
            });

            // Prepare trade record
            const updatedTrade = {
                ticker: tradeDetails.ticker,
                direction: tradeDetails.direction,
                asset_type: tradeDetails.assetType,
                stop_loss_price: tradeDetails.stopLossPrice,
                trailing_stoploss: tradeDetails.trailingStopLoss || null,
                strategy: tradeDetails.strategy || null,
                setups: tradeDetails.setups.length > 0 ? tradeDetails.setups : null,
                user_id: user.id,
                created_at: new Date().toISOString(),
                entry_datetime: tradeDetails.actions[0].date.toISOString(),
                exit_datetime: exitPrice ? tradeDetails.actions[tradeDetails.actions.length - 1].date.toISOString() : null,
                
                entry_price: entryPrice,
                total_shares: totalShares,
                remaining_shares: remainingShares,
                status: remainingShares > 0 ? TRADE_STATUS.OPEN : TRADE_STATUS.CLOSED,

                // Calculate holding period in days
                holding_period: exitPrice ? 
                    Math.ceil((tradeDetails.actions[tradeDetails.actions.length - 1].date.getTime() - 
                    tradeDetails.actions[0].date.getTime()) / (1000 * 60 * 60 * 24)) : 0,

                // Metrics from calculation
                mae_price: metrics.mae.price,
                // mae_ticks: metrics.mae.ticks,
                mae_r: metrics.mae.r,
                mae_dollars: metrics.mae.dollars,

                mfe_price: metrics.mfe.price,
                // mfe_ticks: metrics.mfe.ticks,
                mfe_r: metrics.mfe.r,
                mfe_dollars: metrics.mfe.dollars,

                // atr_dollars: metrics.atr.dollars,
                // atr_ticks: metrics.atr.ticks,
                // atr_r: metrics.atr.r,

                entry_efficiency: metrics.efficiency.entry,
                exit_efficiency: metrics.efficiency.exit,
                total_efficiency: metrics.efficiency.total,

                rdt_dollars: metrics.rdt.dollars,
                // rdt_ticks: metrics.rdt.ticks,
                rdt_r: metrics.rdt.r,

                rds_dollars: metrics.rds.dollars,
                // rds_ticks: metrics.rds.ticks,
                rds_r: metrics.rds.r,

                etd_dollars: metrics.etd.dollars,
                // etd_ticks: metrics.etd.ticks,
                etd_r: metrics.etd.r,

                realized_pnl: metrics.realized.gain,
                realized_pnl_percentage: metrics.realized.percentage,
                risk_reward_ratio: metrics.realized.rrr,

                notes,
                mistakes,

                action_types: tradeDetails.actions.map(a => a.type),
                action_datetimes: tradeDetails.actions.map(a => a.date.toISOString()),
                action_prices: tradeDetails.actions.map(a => parseFloat(a.price)),
                action_shares: tradeDetails.actions.map(a => parseFloat(a.shares))
            };

            console.log('Trade Record Before Save:', {
                id: existingTrade?.id,
                ticker: updatedTrade.ticker,
                direction: updatedTrade.direction,
                entryPrice: updatedTrade.entry_price,
                exitPrice: updatedTrade.exit_datetime ? 
                    updatedTrade.action_prices[updatedTrade.action_prices.length - 1] : 'N/A',
                totalShares: updatedTrade.total_shares,
                holdingPeriod: updatedTrade.holding_period,
                remainingShares: updatedTrade.remaining_shares,
                metrics: {
                    MAE: {
                        price: updatedTrade.mae_price,
                        // ticks: updatedTrade.mae_ticks,
                        R: updatedTrade.mae_r,
                        dollars: updatedTrade.mae_dollars,
                    },
                    MFE: {
                        price: updatedTrade.mfe_price,
                        // ticks: updatedTrade.mfe_ticks,
                        R: updatedTrade.mfe_r,
                        dollars: updatedTrade.mfe_dollars,
                    },
                    RDT: {
                        dollars: updatedTrade.rdt_dollars,
                        // ticks: updatedTrade.rdt_ticks,
                        R: updatedTrade.rdt_r,
                    },
                    RDS: {
                        dollars: updatedTrade.rds_dollars,
                        // ticks: updatedTrade.rds_ticks,
                        R: updatedTrade.rds_r,
                    },
                    ETD: {
                        dollars: updatedTrade.etd_dollars,
                        // ticks: updatedTrade.etd_ticks,
                        R: updatedTrade.etd_r,
                    },
                    // ATR: {
                    //     dollars: updatedTrade.atr_dollars,
                    //     ticks: updatedTrade.atr_ticks,
                    //     R: updatedTrade.atr_r,
                    // },
                    efficiency: {
                        entry: updatedTrade.entry_efficiency,
                        exit: updatedTrade.exit_efficiency,
                        total: updatedTrade.total_efficiency,
                    },
                    realized: {
                        gain: updatedTrade.realized_pnl,
                        percentage: updatedTrade.realized_pnl_percentage,
                        rrr: updatedTrade.risk_reward_ratio,
                    }
                },
                notes: updatedTrade.notes,
                createdAt: updatedTrade.created_at,
            });

            let result: any; 
            // Save to database
            if (existingTrade) {
                console.log('Existing Trade ID:', existingTrade.id);
                console.log('Full Existing Trade:', JSON.stringify(existingTrade, null, 2));
                const { data, error } = await supabase
                    .from('trades')
                    .update(updatedTrade)
                    .eq('id', existingTrade.id)
                    .eq('user_id', user.id)
                    .select();

                if (error) {
                    console.error('Update Error:', error);
                    console.error('Error Details:', error.details);
                    console.error('Error Hint:', error.hint);
                    console.error('Error Message:', error.message);
                    console.log('Attempted Update Record:', JSON.stringify(updatedTrade, null, 2));
                    throw error;
                }
                result = data;

                // Recalculate metrics after modifying an existing trade
                await metricsService.handleTradeModification(user.id);

                toast.success('Trade updated successfully!');
            } else {
                console.log('Creating new trade record...');
                console.log('Trade Record to Insert:', JSON.stringify(updatedTrade, null, 2));
                const { data, error } = await supabase
                    .from('trades')
                    .insert([updatedTrade])
                    .select();

                if (error) {
                    console.error('Insert Error:', error);
                    console.error('Error Details:', error.details);
                    console.error('Error Hint:', error.hint);
                    console.error('Error Message:', error.message);
                    console.log('Attempted Insert Record:', JSON.stringify(updatedTrade, null, 2));
                    throw error;
                }
                result = data;
                toast.success('Trade added successfully!');
            }

            // And for the metrics update when trade is closed:
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
                    console.log('🚗🚗🚗🚗🚗🚗🚗🚗🚗🚗🚗 Streak Metrics:', streakMetrics);

                    const combinedMetrics = {
                        ...performanceMetrics,
                        currentStreak: streakMetrics.currentStreak,
                        longestWinStreak: streakMetrics.longestWinStreak,
                        longestLossStreak: streakMetrics.longestLossStreak
                    };

                    await metricsService.upsertPerformanceMetrics(user.id, combinedMetrics);
                }
            }

            onTradeAdded();
            onClose();

        } catch (error) {
            console.error('Error submitting trade:', error);
            toast.error(existingTrade ? 'Failed to update trade' : 'Failed to add trade');
        } finally {
            setLoading(false);
        }
    };

    const calculateTradeBaseValues = (actions: Action[]) => {
        let totalShares = 0;
        let remainingShares = 0;
        let totalCost = 0;
        let entryPrice = 0;
        let exitPrice = null;

        for (const action of actions) {
            const shares = parseFloat(action.shares);
            const price = parseFloat(action.price);

            if (action.type === 'BUY') {
                totalShares += shares;
                remainingShares += shares;
                totalCost += shares * price;
                if (totalShares > 0) {
                    entryPrice = totalCost / totalShares;
                }
            } else {
                remainingShares -= shares;
                if (remainingShares === 0) {
                    exitPrice = price;
                }
            }
        }

        return {
            totalShares,
            remainingShares,
            entryPrice,
            exitPrice,
            totalCost
        };
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
                                            `px-4 py-2 rounded-lg transition-colors duration-200 ${selected ? 'bg-primary text-primary-content' : 'hover:bg-base-200'
                                            }`
                                        }
                                    >
                                        Details
                                    </Tab>
                                    <Tab
                                        className={({ selected }) =>
                                            `px-4 py-2 rounded-lg transition-colors duration-200 ${selected ? 'bg-primary text-primary-content' : 'hover:bg-base-200'
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
                                                                                `relative cursor-default select-none py-2 pl-10 pr-4 ${active ? 'bg-primary text-primary-content' : 'text-base-content'
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
                                                                                `relative cursor-default select-none py-2 pl-10 pr-4 ${active ? 'bg-primary text-primary-content' : 'text-base-content'
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
                                                            onClick={addAction}
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
                                                        <div className="text-sm opacity-70 mb-2">Entry Efficiency</div>
                                                        <div className="text-2xl font-bold text-primary">
                                                            {entryEfficiency.toFixed(2)} ticks
                                                        </div>
                                                    </div>
                                                    <div className="bg-base-200 p-4 rounded-lg">
                                                        <div className="text-sm opacity-70 mb-2">Exit Efficiency</div>
                                                        <div className="text-2xl font-bold text-primary">
                                                            {/* {exitEfficiency.toFixed(2)} ticks */}
                                                        </div>
                                                    </div>
                                                    <div className="bg-base-200 p-4 rounded-lg">
                                                        <div className="text-sm opacity-70 mb-2">Total Efficiency</div>
                                                        <div className="text-2xl font-bold text-primary">
                                                            {/* {totalEfficiency.toFixed(2)} ticks */}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Trade Metrics */}
                                                <div className="space-y-4">
                                                    <div className="bg-base-200 p-4 rounded-lg">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-sm opacity-70">Available Trade Range (ATR)</span>
                                                            <div className="text-right">
                                                                {/* <div>{atrTicks.toFixed(2)} ticks</div>
                                                                <div>{atrR.toFixed(2)}R</div>
                                                                <div className="text-sm opacity-70">${atrDollars.toFixed(2)}</div> */}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="bg-base-200 p-4 rounded-lg">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-sm opacity-70">End Trade Drawdown (ETD)</span>
                                                            <div className="text-right">
                                                                {/* <div>{etdTicks.toFixed(2)} ticks</div>
                                                                <div>{etdR.toFixed(2)}R</div>
                                                                <div className="text-sm opacity-70">${etdDollars.toFixed(2)}</div> */}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="bg-base-200 p-4 rounded-lg">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-sm opacity-70">Remaining Distance to Target (RDT)</span>
                                                            <div className="text-right">
                                                                {/* <div>{rdtTicks.toFixed(2)} ticks</div>
                                                                <div>{rdtR.toFixed(2)}R</div>
                                                                <div className="text-sm opacity-70">${rdtDollars.toFixed(2)}</div> */}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="bg-base-200 p-4 rounded-lg">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-sm opacity-70">Maximum Favorable Excursion (MFE)</span>
                                                            <div className="text-right">
                                                                {/* <div>{mfe_ticks.toFixed(2)} ticks</div>
                                                                <div>{mfe_r.toFixed(2)}R</div>
                                                                <div className="text-sm opacity-70">${mfe_dollars.toFixed(2)}</div> */}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="bg-base-200 p-4 rounded-lg">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-sm opacity-70">Maximum Adverse Excursion (MAE)</span>
                                                            <div className="text-right">
                                                                {/* <div>{mae_ticks.toFixed(2)} ticks</div>
                                                                <div>{mae_r.toFixed(2)}R</div>
                                                                <div className="text-sm opacity-70">${mae_dollars.toFixed(2)}</div> */}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="bg-base-200 p-4 rounded-lg">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-sm opacity-70">Remaining Distance to Stop (RDS)</span>
                                                            <div className="text-right">
                                                                {/* <div>{rdsTicks.toFixed(2)} ticks</div>
                                                                <div>{rdsR.toFixed(2)}R</div>
                                                                <div className="text-sm opacity-70">${rdsDollars.toFixed(2)}</div> */}
                                                            </div>
                                                        </div>
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
                                    <button className="btn btn-error" onClick={handleDeleteTrade}>Delete Trade</button>
                                    <button className="btn btn-primary" onClick={handleSubmit}>Save</button>
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