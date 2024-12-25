// TradeEntry.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import TitleCard from '../../components/Cards/TitleCard';
import { TRADE_STATUS, Trade, DIRECTIONS, ASSET_TYPES, STRATEGIES, SETUPS } from '../../types/index';
import PriceLadder from '../../components/PriceLadder';
import { supabase } from '../../config/supabaseClient';
import { toast } from 'react-toastify';
import { userSettingsService } from '../../services/userSettingsService';
import TradingViewWidget from '../../components/TradingViewWidget';
import 'react-toastify/dist/ReactToastify.css';
import { current } from '@reduxjs/toolkit';

interface TradeInputs {
    ticker: string;
    entryPrice: string;
    atr: string;
    lowOfDay: string;
    positionRisk: string;
    commission: string;
    strategy: string;
    setups: string[];
    direction: string;
    assetType: string;
    notes: string;
    currentCapital: string;
}

interface TieredRiskPositionMetrics {
    fullStopPrice: number;
    stop33: number;
    stop66: number;
    openRisk: number;
    initialRiskAmount: number;
    positionSize: number;
    target2R: number;
    target3R: number;
    portfolioWeight: number;
    dollarExposure: number;
}

interface SingleRiskPositionMetrics {
    fullStopPrice: number;
    openRisk: number;
    initialRiskAmount: number;
    positionSize: number;
    target2R: number;
    target3R: number;
    portfolioWeight: number;
    dollarExposure: number;
}

interface SystemMetrics {
    tiered: TieredRiskPositionMetrics;
    single: SingleRiskPositionMetrics;
    hsmFomoRatio: number;
}

interface PriceLadderProps {
    entryPrice: number;
    stopLevels: number[];
    targets: number[];
    distribution?: number[]; // Array of percentages that should sum to 100
}

const TradePlanner: React.FC = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();

    // State for account size and stop loss system
    const [accountSize, setAccountSize] = useState<number>(0);
    const [slSystem, setSlSystem] = useState<'three-tiered' | 'single'>('three-tiered');

    const getStopMethod = (entry: number, atr: number, lod: number): string => {
        const atrStop = entry - atr;
        const percentStop = entry * 0.93; // 7% stop
        const lodStop = lod;

        const stopPrice = Math.max(atrStop, percentStop, lodStop);

        if (stopPrice === atrStop) return 'ATR stop';
        if (stopPrice === percentStop) return '7% stop';
        return 'LoD stop';
    };

    const calculateHSMFomoRatio = (entryPrice: number, lowOfDay: number, atr: number): number => {
        if (!entryPrice || !lowOfDay || !atr || atr === 0) return 0;
        const difference = entryPrice - lowOfDay;
        return Math.round((difference / atr) * 100);
    };

    // Input states
    const [inputs, setInputs] = useState<TradeInputs>({
        ticker: '',
        entryPrice: '',
        atr: '',
        lowOfDay: '',
        positionRisk: '0.5',
        commission: '0',
        strategy: '',
        setups: [],
        direction: DIRECTIONS.LONG,
        assetType: ASSET_TYPES.STOCK,
        notes: '',
        currentCapital: accountSize.toString()
    });

    // Ref for tracking latest input values
    const latestInputs = useRef<TradeInputs>({
        ticker: '',
        entryPrice: '',
        atr: '',
        lowOfDay: '',
        positionRisk: '',
        commission: '',
        strategy: '',
        setups: [],
        direction: '',
        assetType: '',
        notes: '',
        currentCapital: ''
    });

    // Position sizing and risk calculations state
    const [positionMetrics, setPositionMetrics] = useState<SystemMetrics>({
        tiered: {
            fullStopPrice: 0,
            stop33: 0,
            stop66: 0,
            openRisk: 0,
            initialRiskAmount: 0,
            positionSize: 0,
            target2R: 0,
            target3R: 0,
            portfolioWeight: 0,
            dollarExposure: 0,
        },
        single: {
            fullStopPrice: 0,
            openRisk: 0,
            initialRiskAmount: 0,
            positionSize: 0,
            target2R: 0,
            target3R: 0,
            portfolioWeight: 0,
            dollarExposure: 0,
        },
        hsmFomoRatio: 0
    });

    const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

    // Fetch current capital when component mounts
    useEffect(() => {
        const fetchAccountSize = async (): Promise<void> => {
            try {
                console.log('Attempting to fetch current capital...');
                const currentCapital = await userSettingsService.getCurrentCapital();
                console.log('Raw currentCapital:', currentCapital);

                // Ensure currentCapital is a valid number
                const parsedCapital = Number(currentCapital);

                if (isNaN(parsedCapital) || parsedCapital <= 0) {
                    console.warn('Invalid capital value received, using default');
                    setAccountSize(25000);
                    setInputs(prev => ({
                        ...prev,
                        currentCapital: '25000'
                    }));
                    toast.warning('Invalid account size. Using default.');
                } else {
                    console.log('Setting account size to:', parsedCapital);
                    setAccountSize(parsedCapital);
                    setInputs(prev => ({
                        ...prev,
                        currentCapital: parsedCapital.toString()
                    }));
                }
            } catch (error) {
                console.error('Detailed error fetching account size:', error);
                setAccountSize(25000);
                setInputs(prev => ({
                    ...prev,
                    currentCapital: '25000'
                }));
                toast.error('Failed to fetch account size. Using default.');
            }
        };

        fetchAccountSize();
    }, []);

    // Handle input changes
    const handleInputChange = (field: keyof TradeInputs, value: string | string[]): void => {
        console.log(`Input Change - Field: ${field}, Value:`, value);

        // For numeric fields, validate and format the input
        const numericFields = ['entryPrice', 'atr', 'lowOfDay', 'positionRisk', 'currentCapital'];
        if (typeof value === 'string' && numericFields.includes(field)) {
            // Allow empty string, single decimal point, or valid number
            if (value === '' || value === '.' || /^\d*\.?\d*$/.test(value)) {
                setInputs(prev => {
                    const newInputs = { ...prev, [field]: value };
                    latestInputs.current = newInputs; // Keep ref in sync
                    return newInputs;
                });

                // Clear previous timer
                if (debounceTimer) {
                    clearTimeout(debounceTimer);
                }

                // Only calculate if we have a valid number
                const timer = setTimeout(() => {
                    calculateMetricsWithValue(latestInputs.current);
                }, 300);
                setDebounceTimer(timer);
            }
        } else {
            // For non-numeric fields, update normally
            setInputs(prev => {
                const newInputs = { ...prev, [field]: value };
                latestInputs.current = newInputs; // Keep ref in sync
                return newInputs;
            });
            calculateMetricsWithValue(latestInputs.current);
        }
    };

    // New calculation function that takes inputs directly
    const calculateMetricsWithValue = (currentInputs: TradeInputs) => {
        console.log('Current Inputs:', currentInputs);

        const entryPrice = parseFloat(currentInputs.entryPrice);
        const atr = parseFloat(currentInputs.atr);
        const lowOfDay = parseFloat(currentInputs.lowOfDay);
        const positionRisk = parseFloat(currentInputs.positionRisk) / 100;
        const currentCapital = parseFloat(currentInputs.currentCapital) || accountSize;

        console.log('Parsed Values:', {
            entryPrice,
            atr,
            lowOfDay,
            positionRisk,
            currentCapital
        });

        if (isNaN(entryPrice) || isNaN(atr) || isNaN(lowOfDay) || isNaN(positionRisk) || isNaN(currentCapital)) {
            console.warn('Invalid input values detected');
            return;
        }

        // Calculate stop prices
        const atrStop = entryPrice - atr;
        const percentStop = entryPrice * 0.93; // 7% stop
        const lodStop = lowOfDay;

        // Use the highest (least risky) of the three stops
        const fullStopPrice = Math.max(atrStop, percentStop, lodStop);
        const stopDistance = entryPrice - fullStopPrice;

        // Calculate tiered stops
        const stop33 = entryPrice - (stopDistance * 0.33);
        const stop66 = entryPrice - (stopDistance * 0.66);

        // Calculate risk percentages
        const fullStopLoss = ((entryPrice - fullStopPrice) / entryPrice) * 100;
        const stopLoss33Percent = ((entryPrice - stop33) / entryPrice) * 100;
        const stopLoss66Percent = ((entryPrice - stop66) / entryPrice) * 100;

        // Calculate open risk for both systems
        const tieredOpenRisk = (fullStopLoss * 0.5) + (stopLoss33Percent * 0.33) + (stopLoss66Percent * 0.17);
        const singleOpenRisk = fullStopLoss;

        // Calculate initial risk amount
        const initialRiskAmount = currentCapital * positionRisk;

        // Tiered system calculations
        const tieredRiskPerShare = entryPrice * (tieredOpenRisk / 100);
        const tieredPositionSize = Math.max(1, Math.floor(initialRiskAmount / tieredRiskPerShare));
        const tieredDollarExposure = tieredPositionSize * entryPrice;
        const tieredPortfolioWeight = tieredDollarExposure / currentCapital;
        const tieredTarget2R = entryPrice * (1 + 2 * (tieredOpenRisk / 100));
        const tieredTarget3R = entryPrice * (1 + 3 * (tieredOpenRisk / 100));

        // Single system calculations
        const singleRiskPerShare = entryPrice * (singleOpenRisk / 100);
        const singlePositionSize = Math.max(1, Math.floor(initialRiskAmount / singleRiskPerShare));
        const singleDollarExposure = singlePositionSize * entryPrice;
        const singlePortfolioWeight = singleDollarExposure / currentCapital;
        const singleTarget2R = entryPrice * (1 + 2 * (singleOpenRisk / 100));
        const singleTarget3R = entryPrice * (1 + 3 * (singleOpenRisk / 100));

        const hsmFomoRatio = calculateHSMFomoRatio(entryPrice, lowOfDay, atr);

        setPositionMetrics({
            tiered: {
                fullStopPrice,
                stop33,
                stop66,
                openRisk: tieredOpenRisk,
                initialRiskAmount,
                positionSize: tieredPositionSize,
                target2R: tieredTarget2R,
                target3R: tieredTarget3R,
                portfolioWeight: tieredPortfolioWeight,
                dollarExposure: tieredDollarExposure
            },
            single: {
                fullStopPrice,
                openRisk: singleOpenRisk,
                initialRiskAmount,
                positionSize: singlePositionSize,
                target2R: singleTarget2R,
                target3R: singleTarget3R,
                portfolioWeight: singlePortfolioWeight,
                dollarExposure: singleDollarExposure
            },
            hsmFomoRatio
        });
    };

    const handleTickerSubmit = (ticker: string): void => {
        setInputs(prev => ({ ...prev, ticker }));
        calculateMetricsWithValue(latestInputs.current);
    };

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Handle trade submission
    const handleSubmitTrade = async (system: 'tiered' | 'single') => {

        setIsSubmitting(true);

        const metrics = system === 'tiered' ? positionMetrics.tiered : positionMetrics.single;

        // Validation Checks
        const errors = [];

        console.log("🔍 Starting Trade Submission Validation");
        console.log("Current Inputs:", inputs);
        console.log("Current Results:", metrics);

        // Required Fields Validation
        if (!inputs.ticker || inputs.ticker.trim() === '') {
            console.warn("❌ Validation Error: Ticker is required");
            errors.push('Ticker is required')
        }

        if (!inputs.entryPrice || isNaN(parseFloat(inputs.entryPrice))) {
            console.warn("❌ Validation Error: Valid current price is required");
            errors.push('Valid current price is required')
        }

        if (!inputs.direction) {
            console.warn("❌ Validation Error: Trade direction is required");
            errors.push('Trade direction is required')
        }

        // Position Size Validation
        if (metrics.positionSize <= 0) {
            console.warn("❌ Validation Error: Position size must be greater than zero");
            errors.push('Position size must be greater than zero')
        }

        // If there are validation errors, show toast and stop submission
        if (errors.length > 0) {
            console.error("🚫 Validation Failed. Stopping trade submission.");
            errors.forEach(error => toast.error(error, {
                position: "top-right",
                autoClose: 3000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true
            }))
            setIsSubmitting(false);
            return
        }

        try {
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError) {
                console.error("🚨 Auth error:", authError);
                toast.error('Authentication error. Please log in again.');
                navigate('/login');
                setIsSubmitting(false);
                return;
            }
                
            if (!user) {
                console.error("🚨 No authenticated user found");
                toast.error('Please log in to submit a trade')
                navigate('/login');
                setIsSubmitting(false);
                return;
            }

            console.log("📝 In Trade Planner, Preparing Trade Object");

            // Base trade data common to both systems
            const tradeData = {
                user_id: user.id,
                ticker: inputs.ticker,
                direction: inputs.direction,
                asset_type: inputs.assetType || 'STOCK', // Default if not specified
                strategy: inputs.strategy || 'None',
                setups: inputs.setups || [],
                total_shares: metrics.positionSize,
                portfolio_weight: metrics.portfolioWeight,
                total_cost: metrics.dollarExposure,
                remaining_shares: metrics.positionSize,
                entry_price: parseFloat(inputs.entryPrice),
                last_price: parseFloat(inputs.entryPrice),
                portfolio_impact: 0,
                trimmed_percentage: 0,
                initial_position_risk: inputs.positionRisk,
                market_value: metrics.positionSize * parseFloat(inputs.entryPrice),
                status: "Open",
                entry_datetime: new Date().toISOString(),
                unrealized_pnl: 0,
                unrealized_pnl_percentage: 0,
                stop_loss_price: metrics.fullStopPrice,
                r_target_2: metrics.target2R,
                r_target_3: metrics.target3R,
                open_risk: metrics.openRisk,
                risk_reward_ratio: 0,
                initial_risk_amount: metrics.initialRiskAmount,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                hsm_fomo_ratio: positionMetrics.hsmFomoRatio,
                action_types: ['BUY'],
                action_datetimes: [new Date().toISOString()],
                action_shares: [metrics.positionSize],
                action_prices: [parseFloat(inputs.entryPrice)]
            };

            // Add system-specific data
            const systemTradeData = system === 'tiered'
                ? {
                    ...tradeData,
                    stop_loss_33_percent: (metrics as TieredRiskPositionMetrics).stop33,
                    stop_loss_66_percent: (metrics as TieredRiskPositionMetrics).stop66,
                }
                : {
                    ...tradeData,
                    stop_loss_33_percent: null,  // Set to null for single system
                    stop_loss_66_percent: null   // Set to null for single system
                };

            const { error } = await supabase
                .from('trades')
                .insert([systemTradeData])
                .select();

            if (error) {
                console.error("🚫 Error saving trade:", error);
                if (error.code === 'PGRST301' || error.message?.includes('JWT')) {
                    toast.error('Session expired. Please log in again.');
                    navigate('/login');
                } else {
                    toast.error('Failed to save trade.');
                }
                throw error;
            }

            toast.success('Trade saved successfully!');
            navigate('/trades');
        } catch (error) {
            console.error('Error saving trade:', error);
            toast.error('Failed to save trade.');
        }
    };

    return (
        <div className="flex flex-col gap-6">
            {/* Main Section with Two Columns */}
            <div className="grid grid-cols-12 gap-6">
                {/* Left Column - Trade Entry Form */}
                <div className="col-span-5">
                    <div className="card bg-base-100 shadow-xl ounded-lg hover:shadow-lg hover:shadow-primary/10">
                        <div className="card-body px-6 py-3">
                            {/* Header */}
                            <div className="flex justify-between items-center border-b border-base-200 pb-4">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-2xl font-bold text-white-300">
                                        Trade Entry
                                    </h2>
                                    <div className="badge badge-primary badge-lg bg-opacity-20 text-primary font-semibold">
                                        New Trade
                                    </div>
                                </div>
                                <div className="text-sm text-base-content/70 italic flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    All fields are required
                                </div>
                            </div>

                            {/* Form Content */}
                            <div className="mt-2">
                                {/* Quick Entry Fields */}
                                <div className="grid grid-cols-4 gap-3 mb-2">
                                    <div className="form-control">
                                        <label className="label">
                                            <span className="label-text font-medium flex items-center gap-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                                </svg>
                                                Ticker
                                            </span>
                                        </label>
                                        <input
                                            type="text"
                                            className="input input-bordered input-md focus:input-primary uppercase
                                                    transition-all duration-200 ease-in-out
                                                    hover:shadow-md hover:border-primary/50
                                                    focus:shadow-lg focus:shadow-primary/20"
                                            value={inputs.ticker}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('ticker', e.target.value.toUpperCase())}
                                            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                                                if (e.key === 'Enter') {
                                                    handleTickerSubmit((e.target as HTMLInputElement).value.toUpperCase());
                                                }
                                            }}
                                            placeholder="Enter a Ticker"
                                        />
                                    </div>

                                    <div className="form-control">
                                        <label className="label">
                                            <span className="label-text font-medium flex items-center gap-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                                </svg>
                                                Entry Price
                                            </span>
                                        </label>
                                        <input
                                            type="number"
                                            className="input input-bordered input-md focus:input-primary
                                                    transition-all duration-200 ease-in-out
                                                    hover:shadow-md hover:border-primary/50
                                                    focus:shadow-lg focus:shadow-primary/20"
                                            value={inputs.entryPrice}
                                            onChange={e => handleInputChange('entryPrice', e.target.value)}
                                            placeholder="Entry Price"
                                        />
                                    </div>

                                    <div className="form-control">
                                        <label className="label">
                                            <span className="label-text font-medium flex items-center gap-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                                ATR
                                            </span>
                                        </label>
                                        <input
                                            type="number"
                                            className="input input-bordered input-md focus:input-primary
                                                    transition-all duration-200 ease-in-out
                                                    hover:shadow-md hover:border-primary/50
                                                    focus:shadow-lg focus:shadow-primary/20"
                                            value={inputs.atr}
                                            onChange={e => handleInputChange('atr', e.target.value)}
                                            placeholder="ATR"
                                        />
                                    </div>

                                    <div className="form-control">
                                        <label className="label">
                                            <span className="label-text font-medium flex items-center gap-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6 6" />
                                                </svg>
                                                LoD
                                            </span>
                                        </label>
                                        <input
                                            type="number"
                                            className="input input-bordered input-md focus:input-primary
                                                    transition-all duration-200 ease-in-out
                                                    hover:shadow-md hover:border-primary/50
                                                    focus:shadow-lg focus:shadow-primary/20"
                                            value={inputs.lowOfDay}
                                            onChange={e => handleInputChange('lowOfDay', e.target.value)}
                                            placeholder="Low of Day"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-4 gap-3 mb-2">


                                    <div className="form-control">
                                        <label className="label">
                                            <span className="label-text font-medium flex items-center gap-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                Position Risk %
                                            </span>
                                        </label>
                                        <input
                                            type="number"
                                            className="input input-bordered input-md focus:input-primary
                                                    transition-all duration-200 ease-in-out
                                                    hover:shadow-md hover:border-primary/50
                                                    focus:shadow-lg focus:shadow-primary/20"
                                            value={inputs.positionRisk}
                                            onChange={e => handleInputChange('positionRisk', e.target.value)}
                                            placeholder="0.5"
                                            step="0.1"
                                        />
                                    </div>

                                    <div className="form-control">
                                        <label className="label">
                                            <span className="label-text font-medium flex items-center gap-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                                </svg>
                                                $ at Risk
                                            </span>
                                        </label>
                                        <div className="input input-bordered input-md bg-base-200 flex items-center justify-end font-mono text-right">
                                            ${(Number(inputs.positionRisk) / 100 * Number(inputs.currentCapital)).toFixed(2)}
                                        </div>
                                    </div>

                                    <div className="form-control">
                                        <label className="label">
                                            <span className="label-text font-medium flex items-center gap-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                                </svg>
                                                Direction
                                            </span>
                                        </label>
                                        <div className="dropdown w-full">
                                            <div tabIndex={0} role="button" className="btn btn-md w-full bg-base-100 border border-base-300 hover:bg-base-200 hover:border-primary/50 text-left justify-start font-normal">
                                                {inputs.direction || "Select Direction"}
                                            </div>
                                            <ul tabIndex={0} className="dropdown-content menu bg-base-100 rounded-box z-[1] w-full p-2 shadow-lg border border-base-300">
                                                <li className="hover:bg-primary/10 rounded-lg transition-colors duration-200">
                                                    <a onClick={() => handleInputChange('direction', DIRECTIONS.LONG)}>Long</a>
                                                </li>
                                                <li className="hover:bg-primary/10 rounded-lg transition-colors duration-200">
                                                    <a onClick={() => handleInputChange('direction', DIRECTIONS.SHORT)}>Short</a>
                                                </li>
                                            </ul>
                                        </div>
                                    </div>

                                    <div className="form-control">
                                        <label className="label">
                                            <span className="label-text font-medium flex items-center gap-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                                </svg>
                                                FOMO Ratio
                                            </span>
                                        </label>
                                        <div className="input input-bordered input-md bg-base-200 flex items-center justify-end font-mono text-right">
                                            {positionMetrics.hsmFomoRatio.toFixed(2)}%
                                        </div>
                                    </div>
                                </div>

                                {/* Strategy, Setups, and Current Capital Row */}
                                <div className="grid grid-cols-3 gap-4">
                                    {/* Current Capital */}
                                    <div>
                                        <label className="label">
                                            <span className="label-text font-medium flex items-center gap-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                Current Capital
                                            </span>
                                        </label>
                                        <input
                                            type="number"
                                            className="input input-bordered input-md focus:input-primary
                                                    transition-all duration-200 ease-in-out
                                                    hover:shadow-md hover:border-primary/50
                                                    focus:shadow-lg focus:shadow-primary/20"
                                            value={inputs.currentCapital}
                                            onChange={(e) => {
                                                setInputs({
                                                    ...inputs,
                                                    currentCapital: e.target.value
                                                });
                                                setAccountSize(parseFloat(e.target.value));
                                            }}
                                            // className="input input-bordered w-full bg-base-100"
                                            placeholder="Enter current capital..."
                                        />
                                    </div>

                                    {/* Strategy */}
                                    <div className="form-control w-full">
                                        <label className="label">
                                            <span className="label-text font-medium flex items-center gap-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                                </svg>
                                                Strategy
                                            </span>
                                        </label>
                                        <div className="dropdown w-full">
                                            <div tabIndex={0} role="button" className="btn btn-md w-full bg-base-100 border border-base-300 hover:bg-base-200 hover:border-primary/50 text-left justify-start font-normal">
                                                {inputs.strategy || "Select Strategy"}
                                            </div>
                                            <ul tabIndex={0} className="dropdown-content menu bg-base-100 rounded-box z-[1] w-full p-2 shadow-lg border border-base-300">
                                                <li className="hover:bg-primary/10 rounded-lg transition-colors duration-200">
                                                    <a onClick={() => handleInputChange('strategy', '')}>None</a>
                                                </li>
                                                {Object.values(STRATEGIES).map(strategy => (
                                                    <li key={strategy} className="hover:bg-primary/10 rounded-lg transition-colors duration-200">
                                                        <a onClick={() => handleInputChange('strategy', strategy)}>{strategy}</a>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Setups */}
                                    <div className="form-control w-full">
                                        <label className="label">
                                            <span className="label-text font-medium flex items-center gap-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                                </svg>
                                                Setups
                                            </span>
                                        </label>
                                        <div className="dropdown dropdown-end w-full">
                                            <div tabIndex={0} role="button" className="btn btn-md w-full bg-base-100 border border-base-300 hover:bg-base-200 hover:border-primary/50 text-left justify-start font-normal truncate">
                                                {inputs.setups.length > 0 ? inputs.setups.join(', ') : "Select Setups"}
                                            </div>
                                            <ul tabIndex={0} className="dropdown-content menu bg-base-100 rounded-box z-[1] w-[800px] p-4 shadow-lg border border-base-300 grid grid-cols-4 gap-2 -translate-x-1/2 left-1/2">
                                                {SETUPS.map(setup => (
                                                    <li key={setup} className="hover:bg-primary/10 rounded-lg">
                                                        <label className="label cursor-pointer flex items-center gap-3 px-4 py-3">
                                                            <input
                                                                type="checkbox"
                                                                value={setup}
                                                                checked={inputs.setups.includes(setup)}
                                                                onChange={(e) => {
                                                                    const value = e.target.value;
                                                                    const newSetups = inputs.setups.includes(value)
                                                                        ? inputs.setups.filter(s => s !== value)
                                                                        : [...inputs.setups, value];
                                                                    handleInputChange('setups', newSetups);
                                                                }}
                                                                className="checkbox checkbox-primary checkbox-sm"
                                                            />
                                                            <span className="label-text text-base">{setup}</span>
                                                        </label>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                                {/* Notes Section */}
                                <div className="form-control w-full mt-3"> {/* Reduced padding and margin */}
                                    <label className="label py-1"> {/* Reduced label padding */}
                                        <span className="label-text font-medium flex items-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                            Notes
                                        </span>
                                    </label>
                                    <textarea
                                        className="textarea textarea-bordered h-20 focus:textarea-primary {/* Reduced height */}
                                                transition-all duration-200 ease-in-out
                                                hover:shadow-md hover:border-primary/50
                                                focus:shadow-lg focus:shadow-primary/20
                                                bg-base-100"
                                        placeholder="Enter trade notes..."
                                        value={inputs.notes}
                                        onChange={e => handleInputChange('notes', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column - TradingView Chart */}
                <div className="col-span-7">
                    <div className="card bg-base-100 shadow-xl ounded-lg hover:shadow-lg hover:shadow-primary/10 h-full">
                        <div className="card-body p-0 rounded-xl overflow-hidden">
                            {inputs.ticker ? (
                                <TradingViewWidget symbol={`NASDAQ:${inputs.ticker}`} />
                            ) : (
                                <div className="flex items-center justify-center h-full text-base-content/50">
                                    <p className="text-lg font-semibold text-center">Enter a ticker on the left to view chart</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Position Analysis Region - 2x2 Grid */}
            <div className="grid grid-rows-[auto_1fr] gap-3">
                {/* Row 1: Metrics for both systems */}
                <div className="grid grid-cols-2 gap-4">
                    {/* 3-Tiered System Card */}
                    <div className="card bg-base-100 shadow-xl ounded-lg hover:shadow-lg hover:shadow-primary/10">
                        <div className="card-body p-4">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                    </svg>
                                    <h2 className="card-title text-lg">3-Tiered Stop Loss System</h2>
                                </div>
                                <button
                                    onClick={() => handleSubmitTrade('tiered')}
                                    className="btn btn-primary shadow-lg transition-all duration-300 hover:scale-[1.02] bg-gradient-to-r from-primary to-primary/80"
                                >
                                    Place Trade with 3-Tiered System
                                </button>
                            </div>

                            {/* Row 1: Position Metrics */}
                            <div className="grid grid-cols-4 gap-3">
                                <div className="card bg-base-200 rounded-lg p-3 shadow-xl rounded-lg hover:shadow-lg hover:shadow-primary/10">
                                    <div className="text-primary text-sm mb-1">Position Size</div>
                                    <div className="text-2xl font-bold">{positionMetrics.tiered.positionSize}</div>
                                    <div className="text-base-content/60">shares</div>
                                </div>

                                <div className="card bg-base-200 rounded-lg p-3 shadow-xl rounded-lg hover:shadow-lg hover:shadow-primary/10">
                                    <div className="text-primary text-sm mb-1">Dollar Exposure</div>
                                    <div className="text-2xl font-bold">
                                        ${positionMetrics.tiered.dollarExposure.toLocaleString('en-US', {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2
                                        })}
                                    </div>
                                    <div className="text-base-content/60">total</div>
                                </div>

                                <div className="card bg-base-200 rounded-lg p-3 shadow-xl rounded-lg hover:shadow-lg hover:shadow-primary/10">
                                    <div className="text-primary text-sm mb-1">Position Weight</div>
                                    <div className="text-2xl font-bold">
                                        {(positionMetrics.tiered.portfolioWeight * 100).toFixed(2)}%
                                    </div>
                                    <div className="text-base-content/60">of capital</div>
                                </div>

                                <div className="card bg-base-200 rounded-lg p-3 shadow-xl rounded-lg hover:shadow-lg hover:shadow-primary/10">
                                    <div className="text-primary text-sm mb-1">Stop Method</div>
                                    <div className="text-lg font-medium">
                                        {getStopMethod(
                                            parseFloat(inputs.entryPrice),
                                            parseFloat(inputs.atr),
                                            parseFloat(inputs.lowOfDay)
                                        )}
                                    </div>
                                    <div className="text-base-content/60">Based on ATR/LoD/7%</div>
                                </div>
                            </div>

                            {/* Row 2: Stop Levels, Open Risk, and Targets */}
                            <div className="grid grid-cols-3 gap-3 mt-3">
                                {/* Stop Levels */}
                                <div className="card bg-base-200 rounded-lg p-3 shadow-xl rounded-lg hover:shadow-lg hover:shadow-primary/10">
                                    <div className="text-primary text-sm mb-2">Stop Levels</div>
                                    <div className="relative pt-1">
                                        {/* Visual progress bar */}
                                        <div className="flex mb-2 h-1.5 bg-base-300 rounded-full overflow-hidden">
                                            <div className="w-1/3 bg-warning/70" />
                                            <div className="w-1/3 bg-error/50" />
                                            <div className="w-1/3 bg-error" />
                                        </div>
                                        {/* Stop levels with compact spacing */}
                                        <div className="grid grid-cols-3 gap-1 text-center text-xs mb-1">
                                            <div>33%</div>
                                            <div>66%</div>
                                            <div>Full</div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-1 text-center">
                                            <div className="font-semibold text-warning/70">${positionMetrics.tiered.stop33.toFixed(2)}</div>
                                            <div className="font-semibold text-error/50">${positionMetrics.tiered.stop66.toFixed(2)}</div>
                                            <div className="font-semibold text-error">${positionMetrics.tiered.fullStopPrice.toFixed(2)}</div>
                                        </div>
                                    </div>
                                </div>


                                {/* Open Risk */}
                                <div className="card bg-base-200 rounded-lg p-3 shadow-xl rounded-lg hover:shadow-lg hover:shadow-primary/10">
                                    <div className="text-primary text-sm mb-3">Stoploss Distance</div>
                                    <div className="flex flex-col items-center justify-center h-[calc(100%-2rem)]">
                                        <div className="text-4xl font-bold text-error mb-1">
                                            {positionMetrics.tiered.openRisk.toFixed(2)}%
                                        </div>
                                        <div className="text-base-content/60 text-sm">from entry to SL</div>
                                    </div>
                                </div>

                                {/* Targets */}
                                <div className="card bg-base-200 rounded-lg p-3 shadow-xl rounded-lg hover:shadow-lg hover:shadow-primary/10">
                                    <div className="text-primary text-sm mb-2">Targets</div>
                                    <div className="relative pt-1">
                                        {/* Visual target bars */}
                                        <div className="flex mb-2 h-1.5 bg-base-300 rounded-full overflow-hidden">
                                            <div className="w-2/5 bg-success/50" />
                                            <div className="w-3/5 bg-emerald-500" />
                                        </div>
                                        {/* Target levels with compact spacing */}
                                        <div className="grid grid-cols-2 gap-1 text-center text-xs mb-1">
                                            <div>2R</div>
                                            <div>3R</div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-1 text-center">
                                            <div className="font-semibold text-emerald-500/70">
                                                ${positionMetrics.tiered.target2R.toFixed(2)}
                                            </div>
                                            <div className="font-semibold text-emerald-500">
                                                ${positionMetrics.tiered.target3R.toFixed(2)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="card bg-base-100 shadow-xl ounded-lg hover:shadow-lg hover:shadow-primary/10">
                        <div className="card-body p-4">
                            <div className="flex items-center gap-2 mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                                </svg>
                                <h2 className="card-title text-lg">3-Tiered Price Ladder</h2>
                            </div>
                            <div className="bg-base-300 rounded-lg p-4 h-[400px]">
                                <PriceLadder
                                    currentPrice={parseFloat(inputs.entryPrice)}
                                    fullStop={positionMetrics.tiered.fullStopPrice}
                                    stop33={positionMetrics.tiered.stop33}
                                    stop66={positionMetrics.tiered.stop66}
                                    target2R={positionMetrics.tiered.target2R}
                                    target3R={positionMetrics.tiered.target3R}
                                    showLegend={true}
                                />
                            </div>
                        </div>
                    </div>
                    </div>

                    {/* Single Stop System Card */}
                    <div className="card bg-base-100 shadow-xl ounded-lg hover:shadow-lg hover:shadow-primary/10">
                        <div className="card-body p-4">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                    </svg>
                                    <h2 className="card-title text-lg">Single Stop Loss System</h2>
                                </div>
                                <button
                                    onClick={() => handleSubmitTrade('single')}
                                    className="btn btn-secondary shadow-lg transition-all duration-300 hover:scale-[1.02] bg-gradient-to-r from-secondary to-secondary/80"
                                >
                                    Place Trade with Single Stop Loss
                                </button>
                            </div>

                            {/* Row 1: Position Metrics */}
                            <div className="grid grid-cols-4 gap-3">
                                <div className="card bg-base-200 rounded-lg p-3 shadow-xl rounded-lg hover:shadow-lg hover:shadow-primary/10">
                                    <div className="text-primary text-sm mb-1">Position Size</div>
                                    <div className="text-2xl font-bold">{positionMetrics.single.positionSize}</div>
                                    <div className="text-base-content/60">shares</div>
                                </div>

                                <div className="card bg-base-200 rounded-lg p-3 shadow-xl rounded-lg hover:shadow-lg hover:shadow-primary/10">
                                    <div className="text-primary text-sm mb-1">Dollar Exposure</div>
                                    <div className="text-2xl font-bold">
                                        ${positionMetrics.single.dollarExposure.toLocaleString('en-US', {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2
                                        })}
                                    </div>
                                    <div className="text-base-content/60">total</div>
                                </div>

                                <div className="card bg-base-200 rounded-lg p-3 shadow-xl rounded-lg hover:shadow-lg hover:shadow-primary/10">
                                    <div className="text-primary text-sm mb-1">Position Weight</div>
                                    <div className="text-2xl font-bold">
                                        {(positionMetrics.single.portfolioWeight * 100).toFixed(2)}%
                                    </div>
                                    <div className="text-base-content/60">of capital</div>
                                </div>

                                <div className="card bg-base-200 rounded-lg p-3 shadow-xl rounded-lg hover:shadow-lg hover:shadow-primary/10">
                                    <div className="text-primary text-sm mb-1">Stop Method</div>
                                    <div className="text-lg font-medium">
                                        {getStopMethod(
                                            parseFloat(inputs.entryPrice),
                                            parseFloat(inputs.atr),
                                            parseFloat(inputs.lowOfDay)
                                        )}
                                    </div>
                                    <div className="text-base-content/60">Based on ATR/LoD/7%</div>
                                </div>
                            </div>

                            {/* Row 2: Stop Level, Open Risk, and Targets */}
                            <div className="grid grid-cols-3 gap-3 mt-3">
                                {/* Stop Level */}
                                <div className="card bg-base-200 rounded-lg p-3 shadow-xl rounded-lg hover:shadow-lg hover:shadow-primary/10">
                                    <div className="text-primary text-sm mb-3">Stop Level</div>
                                    <div className="flex flex-col items-center justify-center">
                                        <div className="text-4xl font-bold text-error mb-1">
                                            ${positionMetrics.single.fullStopPrice.toFixed(2)}
                                        </div>
                                        <div className="text-base-content/60 text-sm">Full Stop</div>
                                    </div>
                                </div>
                                {/* Open Risk */}
                                <div className="card bg-base-200 rounded-lg p-3 shadow-xl rounded-lg hover:shadow-lg hover:shadow-primary/10">
                                    <div className="text-primary text-sm mb-3"> Stoploss Distance</div>
                                    <div className="flex flex-col items-center justify-center h-[calc(100%-2rem)]">
                                        <div className="text-4xl font-bold text-error mb-1">
                                            {positionMetrics.single.openRisk.toFixed(2)}%
                                        </div>
                                        <div className="text-base-content/60 text-sm">from entry to SL</div>
                                    </div>
                                </div>
                                {/* Targets */}
                                <div className="card bg-base-200 rounded-lg p-3 shadow-xl rounded-lg hover:shadow-lg hover:shadow-primary/10">
                                    <div className="text-primary text-sm mb-2">Targets</div>
                                    <div className="relative pt-1">
                                        {/* Visual target bars */}
                                        <div className="flex mb-2 h-1.5 bg-base-300 rounded-full overflow-hidden">
                                            <div className="w-2/5 bg-success/50" />
                                            <div className="w-3/5 bg-emerald-500" />
                                        </div>
                                        {/* Target levels with compact spacing */}
                                        <div className="grid grid-cols-2 gap-1 text-center text-xs mb-1">
                                            <div>2R</div>
                                            <div>3R</div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-1 text-center">
                                            <div className="font-semibold text-emerald-500/70">
                                                ${positionMetrics.tiered.target2R.toFixed(2)}
                                            </div>
                                            <div className="font-semibold text-emerald-500">
                                                ${positionMetrics.tiered.target3R.toFixed(2)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                                            {/* Single Stop Price Ladder */}
                    <div className="card bg-base-100 shadow-xl ounded-lg hover:shadow-lg hover:shadow-primary/10">
                        <div className="card-body p-4">
                            <div className="flex items-center gap-2 mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                                </svg>
                                <h2 className="card-title text-lg">Single Stop Price Ladder</h2>
                            </div>
                            <div className="bg-base-300 rounded-lg p-4 h-[400px]">
                                <PriceLadder
                                    currentPrice={parseFloat(inputs.entryPrice)}
                                    fullStop={positionMetrics.single.fullStopPrice}
                                    stop33={0}
                                    stop66={0}
                                    target2R={positionMetrics.single.target2R}
                                    target3R={positionMetrics.single.target3R}
                                    showLegend={false}
                                />
                            </div>
                        </div>
                    </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default TradePlanner
