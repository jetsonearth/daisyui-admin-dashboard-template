import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'; // Import useDispatch hook
import TitleCard from '../../components/Cards/TitleCard'
import { Trade, TRADE_STATUS, DIRECTIONS, ASSET_TYPES, STRATEGIES, SETUPS } from '../../types/index'; 
import PriceLadder from '../../components/PriceLadder'
import StopLossVisualizer from '../../components/StopLossVisualizer'
import { marketDataService } from '../../features/marketData/marketDataService'
import { supabase } from '../../config/supabaseClient';
import { toast, ToastContainer } from 'react-toastify';
import { userSettingsService } from '../../services/userSettingsService';
import 'react-toastify/dist/ReactToastify.css';


function TradePlanner() {
    const navigate = useNavigate()
    const dispatch = useDispatch(); // Initialize useDispatch hook

    // State for account size
    const [accountSize, setAccountSize] = useState(0);

    // Fetch current capital when component mounts
    useEffect(() => {
        const fetchAccountSize = async () => {
            try {
                const currentCapital = await userSettingsService.getCurrentCapital();
                setInputs(prev => ({
                    ...prev,
                    accountSize: currentCapital
                }));
                console.log('Current Account Size:', currentCapital);
            } catch (error) {
                console.error('Error fetching account size:', error);
                // Fallback to a default value if needed
                setInputs(prev => ({
                    ...prev,
                    accountSize: 25000
                }));
                toast.error('Failed to fetch account size. Using default.');
            }
        };
    
        fetchAccountSize();
    }, []); 


    // Input states
    const [inputs, setInputs] = useState({
        ticker: '',
        accountSize: 0,
        entryPrice: '',
        atr: '',
        lowOfDay: '',
        portfolioRisk: '0.5', // Default 0.5%
        commission: '',     // Default empty
        strategy: '',
        setups: [], // Changed to an array
        direction: DIRECTIONS.LONG,
        assetType: ASSET_TYPES.STOCK,
        notes: ''
    })

    // Add a state to track price fetch time
    const [priceInfo, setPriceInfo] = useState({
        timestamp: null,
        fetchError: null,
        isLoading: false
    })

    const [loading, setLoading] = useState(false);

    const fetchMarketPrice = async (ticker) => {
        if (!ticker) return;
        
        try {
            setPriceInfo(prev => ({ ...prev, isLoading: true, fetchError: null }));
            const quotes = await marketDataService.getBatchQuotes([ticker]);
            const quote = quotes[ticker];
            
            if (quote && quote.price) {
                setInputs(prev => ({
                    ...prev,
                    entryPrice: quote.price.toString()
                }));
                setPriceInfo({
                    timestamp: new Date().toLocaleTimeString(),
                    fetchError: null,
                    isLoading: false
                });
            } else {
                setPriceInfo({
                    timestamp: null,
                    fetchError: 'No market data available',
                    isLoading: false
                });
            }
        } catch (error) {
            console.error('Error fetching market price:', error);
            setPriceInfo({
                timestamp: null,
                fetchError: error.message || 'Failed to fetch market price',
                isLoading: false
            });
            toast.error(error.message || 'Failed to fetch market price');
        }
    };

    const updateCurrentPrice = async () => {
        if (!inputs.ticker) return;
        
        try {
            const quotes = await marketDataService.getBatchQuotes([inputs.ticker]);
            const quote = quotes[inputs.ticker];
            
            if (!quote) {
                console.warn(`No market data available for ${inputs.ticker}`);
                return null;
            }

            return quote.price;
        } catch (error) {
            console.error('Error fetching current price:', error);
            return null;
        }
    };

    const handleTickerChange = (e) => {
        const newTicker = e.target.value.toUpperCase();
        setInputs(prev => ({
            ...prev,
            ticker: newTicker
        }));
    };

    const handleTickerKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            fetchMarketPrice(inputs.ticker);
        }
    };

    // Calculation results
    const [results, setResults] = useState({
        atrDistance: 0,
        lodDistance: 0,
        stopDistancePercent: 0,
        fullStopPrice: 0,
        stop33: 0,
        stop66: 0,
        positionSize: 0,
        dollarExposure: 0,
        totalCost: 0,
        portfolioWeight: 0,
        portfolioHeat: 0,
        openRisk: 0,
        // breakEvenPrice: 0,
        target2R: 0,
        target3R: 0,
        rrr: 0,
        stopLossLogic: '',
        atrStopPrice: 0,
        lodStopPrice: 0,
        percentStopPrice: 0,
        stopLossPercent: 0
    })

    // Initialize action arrays
    const [actionTypes, setActionTypes] = useState([]);
    const [actionDatetimes, setActionDatetimes] = useState([]);
    const [actionPrices, setActionPrices] = useState([]);
    const [actionShares, setActionShares] = useState([]);

    const calculateResults = async () => {
        const {
            entryPrice,
            accountSize,
            atr,
            lowOfDay,
            portfolioRisk,
            commission,
            ticker
        } = inputs
    
        // Guard against invalid inputs
        if (!entryPrice || isNaN(entryPrice)) {
            setResults({
                fullStopPrice: 0,
                stop33: 0,
                stop66: 0,
                positionSize: 0,
                dollarExposure: 0,
                totalCost: 0,
                portfolioWeight: 0,
                portfolioHeat: 0,
                openRisk: 0,
                // breakEvenPrice: 0,
                target2R: 0,
                target3R: 0,
                rrr: 0,
                stopLossLogic: 'No valid price',
                atrStopPrice: 0,
                lodStopPrice: 0,
                percentStopPrice: 0,
                stopLossPercent: 0
            })
            return
        }

        console.log('Input Values:', {
            entryPrice,
            atr,
            lowOfDay,
            portfolioRisk,
            commission
        });
    
    
        const price = parseFloat(entryPrice)
        // Fetch current market price before trade submission
        const currentPrice = await updateCurrentPrice()
        console.log('Price:', price)
        console.log('Current Market Price:', currentPrice)
        const lod = parseFloat(lowOfDay)  // Will throw an error if not provided
        console.log('Low of Day:', lod)
        const portfolioHeat = portfolioRisk ? parseFloat(portfolioRisk) / 100 : 0.005 // Default to 0.5%

        console.log('Heat:', {
            portfolioHeat
        })
    
        // Stop-Loss Calculation Logic:
        // 1. ATR Stop-Loss: Entry Price - ATR
        const atrStopPrice = price - parseFloat(atr)  // Will throw an error if not provided
    
        // 2. Low of Day Stop-Loss
        const lodStopPrice = lod
    
        // 3. Percentage-Based Stop-Loss (7%)
        const percentStopPrice = price * 0.93  // 7% below entry
    
        // Select the MOST CONSERVATIVE stop-loss (highest price)
        // This minimizes potential loss by choosing the stop-loss that triggers earliest
        const fullStopPrice = Math.max(atrStopPrice, lodStopPrice, percentStopPrice)
    
        // Determine which stop-loss logic was used
        let stopLossLogic = 'Percentage (7%)'
        if (fullStopPrice === atrStopPrice) {
            stopLossLogic = 'ATR'
        } else if (fullStopPrice === lodStopPrice) {
            stopLossLogic = 'Low of Day'
        }
    
        // Calculate stop-loss percentagea
        const stopLossPercent = ((price - fullStopPrice) / price) * 100
    
        // Calculate stop levels (33% and 66% of full stop distance)
        const stopDistance = price - fullStopPrice
        const stop66 = price - (stopDistance * 0.66)
        const stop33 = price - (stopDistance * 0.33)
    
        // Calculate position sizing based on risk
        const riskAmount = accountSize * portfolioHeat
        console.log('Risk Amount:', riskAmount)

        // 3-Tiered Stop-Loss Risk Calculation
        const fullStopLoss = ((price - fullStopPrice) / price) * 100
        const stop33Loss = ((price - stop33) / price) * 100
        const stop66Loss = ((price - stop66) / price) * 100

        const openRisk = (
            (fullStopLoss * 0.5) +  // Full stop gets 50% weight
            (stop33Loss * 0.33) +   // 33% stop gets 33% weight
            (stop66Loss * 0.17)     // 66% stop gets 17% weight
        )

        // Calculate position size
        const stopDistanceTiered = price * openRisk / 100
        const riskPerShare = Math.max(0.01, stopDistanceTiered) // Prevent division by zero

        const positionSize = Math.max(1, Math.floor(riskAmount / riskPerShare))

        console.log('Stop Loss Calculations:', {
            openRisk: openRisk.toFixed(2) + '%'
        })

        console.log('Position Size Calculation:', {
            positionSize: positionSize
        })        
    
        // Calculate exposures
        const dollarExposure = positionSize * price
        // const openRisk = ((price - fullStopPrice) / price) * 100
        // Compute Open Risk as a weighted average of the three stop levels
        const portfolioWeight = (results.positionSize * parseFloat(inputs.entryPrice) / accountSize) * 100

        // Calculate break-even including commission
        const totalCommission = commission ? parseFloat(commission) * 2 : 0 // Entry + Exit
        // const breakEvenPrice = price + (totalCommission / positionSize)
        const totalCost = dollarExposure + totalCommission

        // Calculate R-multiple targets (2R and 3R)
        const rValue = Math.max(0.01, price - fullStopPrice)
        const target2R = price + (rValue * 2)
        const target3R = price + (rValue * 3)
        const rrr = 0 // Placeholder for RRR, will be updated in tradelog once we have market data

        setResults({
            fullStopPrice,
            stop33,
            stop66,
            positionSize,
            dollarExposure,
            totalCost,
            portfolioWeight: parseFloat(portfolioWeight.toFixed(2)), 
            portfolioHeat,
            openRisk: parseFloat(openRisk.toFixed(2)),
            target2R,
            target3R,
            rrr: parseFloat(rrr.toFixed(1)),
            stopLossLogic,
            atrStopPrice,
            lodStopPrice,
            percentStopPrice: parseFloat(percentStopPrice.toFixed(2)),
            stopLossPercent: parseFloat(stopLossPercent.toFixed(2)),
            riskAmount
        })
    }

    useEffect(() => {
        calculateResults()
    }, [inputs])

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        setIsSubmitting(true);
        // Validation Checks
        const errors = [];

        console.log("🔍 ------------ Starting Trade Submission Validation ------------- ");
        console.log("Current Inputs:", inputs);
        console.log("Current Results:", results);

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
        if (results.positionSize <= 0) {
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
            // Step 2: Authenticate User
            // console.log("🔐 Checking User Authentication");
            const { data: { session }, error: sessionError } = await supabase.auth.getSession()
            // console.log("📦 Current Session:", session);
            
            const { data: { user }, error: userError } = await supabase.auth.getUser()
            // console.log("👤 Current User:", user);

            // // Add these debugging lines
            // console.log('Supabase object:', supabase)
            // console.log('Supabase auth methods:', Object.keys(supabase.auth))
            
            // Check if user method exists
            if (typeof supabase.auth.user === 'function') {
                const user = supabase.auth.user()
                console.log('User via old method:', user)
            } else {
                console.warn('supabase.auth.user is not a function')
            }
            
            // Verify user authentication
            if (!user) {
                console.error("🚨 No authenticated user found");
                toast.error('Please log in to submit a trade')
                setIsSubmitting(false);
                return
            }

            // Step 3: Prepare Trade Object
            console.log("-------- 📝 Inside TradeEntry form, Preparing Trade Object -------- ");

            // Prepare the action arrays
            const entry_price = parseFloat(inputs.entryPrice)
            const action_types = ['BUY']; // Action type is always 'BUY'
            const action_prices = [entry_price]; // Entry price
            const action_datetimes = [new Date().toISOString()]; // Current date
            const action_shares = [results.positionSize]; // Total shares

            const newTrade = {
                trade_id: `${inputs.ticker}-${new Date().toISOString().split('T')[0]}-${inputs.direction}`,
                user_id: user.id,
                ticker: inputs.ticker,
                direction: inputs.direction,
                asset_type: inputs.assetType || 'STOCK', // Default if not specified
                total_shares: results.positionSize,
                total_cost: results.totalCost,
                remaining_shares: results.positionSize,
                entry_price: entry_price,
                last_price: parseFloat(inputs.entryPrice),
                
                // Optional fields with defaults
                strategy: inputs.strategy || 'UNDEFINED',
                setups: inputs.setups.length > 0 ? inputs.setups : null, // Use null instead of empty array

                stop_loss_price: results.fullStopPrice,
                stop_loss_33_percent: results.stop33,
                stop_loss_66_percent: results.stop66,
                open_risk: results.openRisk,
                risk_reward_ratio: results.rrr,
                r_target_2: results.target2R,
                r_target_3: results.target3R,  
                status: TRADE_STATUS.OPEN,
                // entry_date: new Date().toISOString().split('T')[0],
                entry_datetime: new Date().toISOString(),
                unrealized_pnl: 0,
                unrealized_pnl_percentage: 0,
                market_value: results.positionSize * parseFloat(inputs.entryPrice),
                portfolio_weight: results.portfolioWeight,
                portfolio_heat: results.portfolioHeat,
                portfolio_impact: 0,
                trimmed_percentage: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                risk_amount: results.riskAmount,

                // Add action arrays
                action_types: action_types,
                action_datetimes: action_datetimes,
                action_prices: action_prices,
                action_shares: action_shares,
            }

            console.log("🚀 Prepared Trade Object:", newTrade);

            console.log('New Trade Object:', {
                ...newTrade,
                openRisk: results.openRisk
            });

            // console.log('Detailed Open Risk Breakdown:', {
            //     fullStopLoss: ((parseFloat(inputs.entryPrice) - results.fullStopPrice) / parseFloat(inputs.entryPrice)) * 100,
            //     stop33Loss: ((parseFloat(inputs.entryPrice) - results.stop33) / parseFloat(inputs.entryPrice)) * 100,
            //     stop66Loss: ((parseFloat(inputs.entryPrice) - results.stop66) / parseFloat(inputs.entryPrice)) * 100,
            //     calculatedOpenRisk: results.openRisk
            // });

            // Supabase insertion
            console.log("------------ 💾 Inside TradeEntry, Inserting Trade into Supabase -----------");
            const { data, error } = await supabase
                .from('trades')
                .insert(newTrade)
                .select()

            if (error) {
                console.error("❌ Supabase Insertion Error:", error);
                throw error
            }
    
            console.log("✅ Trade Successfully Inserted:", data);

            // Success Toast
            // toast.success('Trade successfully logged!', {
            //     position: "top-right",
            //     autoClose: 3000,
            //     hideProgressBar: false,
            //     closeOnClick: true,
            //     pauseOnHover: true,
            //     draggable: true
            // })

            // Navigate to trade log
            navigate('/app/trades')

        } catch (error) {
            // Supabase or Network Error Toast
            console.error("🔥 Comprehensive Trade Submission Error:", error);
            toast.error(`Failed to log trade: ${error.message}`, {
                position: "top-right",
                autoClose: 5000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true
            })
            console.error('Error submitting trade:', error)
        } finally {
            setIsSubmitting(false);
        }
    }

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setInputs(prev => ({
            ...prev,
            [name]: name === 'accountSize' ? parseFloat(value) : value
        }));
    };

    const [isDirectionDropdownOpen, setIsDirectionDropdownOpen] = useState(false);
    const [isAssetTypeDropdownOpen, setIsAssetTypeDropdownOpen] = useState(false);
    const [isStrategyDropdownOpen, setIsStrategyDropdownOpen] = useState(false);
    const [isSetupsDropdownOpen, setIsSetupsDropdownOpen] = useState(false);

    return (
        <div className="p-4">
            {/* Submission Loading Overlay */}
            {isSubmitting && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
                    <div className="bg-base-100 p-8 rounded-lg shadow-xl text-center">
                        <span className="loading loading-spinner loading-lg text-primary mb-4"></span>
                        <div className="text-lg font-semibold">
                            Placing Trade for {inputs.ticker}
                        </div>
                        <div className="text-sm text-gray-500 mt-2">
                            Processing trade details...
                        </div>
                    </div>
                </div>
            )}
            <TitleCard title="New Trade Entry">
                <div className="grid grid-cols-2 gap-6">
                    {/* Left Column - Inputs */}
                    <div className="space-y-4">
                        
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="mb-4">
                            <label className="block text-sm text-white mb-4">Ticker</label>
                            <div className="flex items-center space-x-2">
                                <div className="relative flex-1">
                                    <input
                                        type="text"
                                        name="ticker"
                                        value={inputs.ticker}
                                        onChange={handleTickerChange}
                                        onKeyDown={handleTickerKeyDown}
                                        className="input input-bordered w-full px-4 py-2"
                                        placeholder="Enter ticker symbol (e.g., AAPL)"
                                    />
                                    {priceInfo.isLoading && (
                                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                                        </div>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => fetchMarketPrice(inputs.ticker)}
                                    className="btn btn-primary px-6"
                                    disabled={priceInfo.isLoading}
                                >
                                    {priceInfo.isLoading ? 'Fetching...' : 'Fetch'}
                                </button>
                            </div>
                            {inputs.ticker && (
                                <div className="mt-1 text-sm">
                                    {priceInfo.timestamp && (
                                        <span className="text-green-600">
                                            ✓ Price updated at {priceInfo.timestamp}
                                        </span>
                                    )}
                                    {priceInfo.fetchError && (
                                        <span className="text-red-500">
                                            ⚠ {priceInfo.fetchError}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                        
                        <div className="form-control">
                            <label className="label">
                                <span className="label-text">Current Capital</span>
                            </label>
                            <input
                                type="number"
                                name="accountSize"
                                value={inputs.accountSize}
                                onChange={handleInputChange}
                                className="input input-bordered"
                                placeholder="Enter account size"
                            />
                        </div>
                    </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">Entry Price</span>
                                </label>
                                <input
                                    type="number"
                                    name="entryPrice"
                                    value={inputs.entryPrice}
                                    onChange={handleInputChange}
                                    className="input input-bordered"
                                    placeholder="0.00"
                                    step="0.01"
                                />
                            </div>

                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">ATR</span>
                                </label>
                                <input
                                    type="number"
                                    name="atr"
                                    value={inputs.atr}
                                    onChange={handleInputChange}
                                    className="input input-bordered"
                                    placeholder="0.00"
                                    step="0.01"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">Low of Day</span>
                                </label>
                                <input
                                    type="number"
                                    name="lowOfDay"
                                    value={inputs.lowOfDay}
                                    onChange={handleInputChange}
                                    className="input input-bordered"
                                    placeholder="0.00"
                                    step="0.01"
                                />
                            </div>

                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">Portfolio Risk %</span>
                                </label>
                                <input
                                    type="number"
                                    name="portfolioRisk"
                                    value={inputs.portfolioRisk}
                                    onChange={handleInputChange}
                                    className="input input-bordered"
                                    placeholder="1.00"
                                    step="0.1"
                                />
                            </div>
                        </div>

                        {/* Advanced Settings */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">Commission/Share</span>
                                </label>
                                <input
                                    type="number"
                                    name="commission"
                                    value={inputs.commission}
                                    onChange={handleInputChange}
                                    className="input input-bordered"
                                    placeholder="0.00"
                                    step="0.01"
                                />
                            </div>

                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">Direction</span>
                                </label>
                                <div className="dropdown w-full">
                                    <div 
                                        tabIndex={0} 
                                        role="button" 
                                        className="btn select select-bordered w-full" 
                                        onClick={() => setIsDirectionDropdownOpen(prev => !prev)}
                                    >
                                        {inputs.direction || "Select Direction"}
                                    </div>
                                    {isDirectionDropdownOpen && (
                                        <ul tabIndex={0} className="dropdown-content menu bg-base-100 rounded-box z-[1] w-full p-2 shadow">
                                            {Object.values(DIRECTIONS).map(direction => (
                                                <li key={direction} onClick={() => setInputs(prev => ({ ...prev, direction }))}>
                                                    <a>{direction}</a>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">Asset Type</span>
                                </label>
                                <div className="dropdown w-full">
                                    <div 
                                        tabIndex={0} 
                                        role="button" 
                                        className="btn select select-bordered w-full" 
                                        onClick={() => setIsAssetTypeDropdownOpen(prev => !prev)}
                                    >
                                        {inputs.assetType || "Select Asset Type"}
                                    </div>
                                    {isAssetTypeDropdownOpen && (
                                        <ul tabIndex={0} className="dropdown-content menu bg-base-100 rounded-box z-[1] w-full p-2 shadow">
                                            {Object.values(ASSET_TYPES).map(assetType => (
                                                <li key={assetType} onClick={() => setInputs(prev => ({ ...prev, assetType }))}>
                                                    <a>{assetType}</a>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>

                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">Strategy</span>
                                </label>
                                <div className="dropdown w-full">
                                    <div 
                                        tabIndex={0} 
                                        role="button" 
                                        className="btn select select-bordered w-full" 
                                        onClick={() => setIsStrategyDropdownOpen(prev => !prev)}
                                    >
                                        {inputs.strategy || "Select Strategy"}
                                    </div>
                                    {isStrategyDropdownOpen && (
                                        <ul tabIndex={0} className="dropdown-content menu bg-base-100 rounded-box z-[1] w-full p-2 shadow">
                                            {Object.values(STRATEGIES).map(strategy => (
                                                <li key={strategy} onClick={() => setInputs(prev => ({ ...prev, strategy }))}>
                                                    <a>{strategy}</a>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="form-control">
                            <label className="label">
                                <span className="label-text">Setup</span>
                            </label>
                            <div className="dropdown w-full">
                                <div 
                                    tabIndex={0} 
                                    role="button" 
                                    className="btn select select-bordered w-full" 
                                    onClick={() => setIsSetupsDropdownOpen(prev => !prev)}
                                >
                                    {inputs.setups.length > 0 ? inputs.setups.join(', ') : "Select Setups"}
                                </div>
                                {isSetupsDropdownOpen && (
                                    <ul tabIndex={0} className="dropdown-content menu bg-base-100 rounded-box z-[1] w-full p-3 shadow grid grid-cols-5 gap-3">
                                        {SETUPS.map(setup => (
                                            <li key={setup}>
                                                <div className="form-control">
                                                    <label className="label cursor-pointer flex items-center">
                                                        <input
                                                            type="checkbox"
                                                            value={setup}
                                                            checked={inputs.setups.includes(setup)}
                                                            onChange={(e) => {
                                                                const value = e.target.value;
                                                                setInputs(prev => ({
                                                                    ...prev,
                                                                    setups: prev.setups.includes(value)
                                                                        ? prev.setups.filter(s => s !== value)
                                                                        : [...prev.setups, value]
                                                                }));
                                                            }}
                                                            className="checkbox checkbox-primary mr-2"
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

                        <div className="form-control">
                            <label className="label">
                                <span className="label-text">Notes</span>
                            </label>
                            <textarea
                                name="notes"
                                value={inputs.notes}
                                onChange={handleInputChange}
                                className="textarea textarea-bordered"
                                placeholder="Trade notes..."
                                rows="3"
                            />
                        </div>
                    </div>

                    {/* Right Column - Analysis */}
                    <div className="flex-1 space-y-4">
                        {/* Stop Loss Visualization */}
                        <div className="bg-base-200 p-4 rounded-lg">
                            <h4 className="font-medium mb-3">Position Analysis</h4>
                            
                            {/* Compact Analysis Grid */}
                            <div className="grid grid-cols-2 gap-x-8 gap-y-2 mt-4">
                                {/* Stop Levels */}
                                <div>
                                    <div>
                                        <div className="text-sm font-medium text-gray-500">
                                            Full Stop 
                                            <span className="text-xs text-yellow-400 ml-2">
                                                {results.stopLossLogic === 'ATR' && '(Using ATR Stop)'}
                                                {results.stopLossLogic === 'Low of Day' && '(Using Low of Day)'}
                                                {results.stopLossLogic === 'Percentage (7%)' && '(Using 7% Stop)'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-baseline">
                                            <span className="text-lg font-semibold">
                                                ${results.fullStopPrice.toFixed(2)}
                                                <span className="text-xs text-red-500 ml-2">
                                                    ({((parseFloat(inputs.entryPrice) - results.fullStopPrice) / parseFloat(inputs.entryPrice) * 100).toFixed(2)}% loss)
                                                </span>
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <div className="text-sm font-medium text-gray-500">33% Stop</div>
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-lg font-semibold">
                                            ${results.stop33.toFixed(2)}
                                            <span className="text-xs text-red-500 ml-2">
                                                ({((parseFloat(inputs.entryPrice) - results.stop33) / parseFloat(inputs.entryPrice) * 100).toFixed(2)}% loss)
                                            </span>
                                        </span>
                                    </div>
                                </div>

                                <div>
                                    <div className="text-sm font-medium text-gray-500">66% Stop</div>
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-lg font-semibold">
                                            ${results.stop66.toFixed(2)}
                                            <span className="text-xs text-red-500 ml-2">
                                                ({((parseFloat(inputs.entryPrice) - results.stop66) / parseFloat(inputs.entryPrice) * 100).toFixed(2)}% loss)
                                            </span>
                                        </span>
                                    </div>
                                </div>

                                {/* Position Size */}
                                <div>
                                    <div className="text-sm font-medium text-gray-500">
                                        Position Size 
                                        <span className="text-xs text-yellow-400 ml-2">(Risk-Based Size)</span>
                                    </div>
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-lg font-semibold">{results.positionSize} shares</span>
                                    </div>
                                </div>
                                {/* Dollar Exposure */}
                                <div>
                                    <div className="text-sm font-medium text-gray-500">Dollar Exposure</div>
                                    <div className="text-lg font-semibold">
                                        ${results.dollarExposure.toFixed(2)}
                                        <span className="text-xs text-red-500 ml-3">
                                            ({results.portfolioWeight.toFixed(2)}% Portfolio)
                                        </span>
                                    </div>
                                </div>

                                {/* Open Risk */}
                                <div>
                                    <div className="text-sm font-medium text-gray-500">3-Tiered SL Open Risk</div>
                                    <div className="text-lg font-semibold">{results.openRisk.toFixed(2)}%</div>
                                </div>

                                {/* R-Multiple Targets */}
                                <div>
                                    <div className="text-sm font-medium text-gray-500">2R Target</div>
                                    <div className="text-lg font-semibold">${results.target2R.toFixed(2)}</div>
                                </div>

                                <div>
                                    <div className="text-sm font-medium text-gray-500">3R Target</div>
                                    <div className="text-lg font-semibold">${results.target3R.toFixed(2)}</div>
                                </div>
                            </div>
                        </div>

                        {/* Price Ladder moved below */}
                        {inputs.entryPrice && (
                            <div className="bg-base-200 p-4 rounded-lg">
                                <h4 className="font-medium mb-10">Price Ladder</h4>
                                {console.log('Price Ladder Props:', {
                                    entryPrice: parseFloat(inputs.entryPrice),
                                    fullStop: results.fullStopPrice,
                                    stop33: results.stop33,
                                    stop66: results.stop66
                                })}
                                <PriceLadder
                                    currentPrice={parseFloat(inputs.entryPrice)}
                                    fullStop={results.fullStopPrice || 0}
                                    stop33={results.stop33 || 0}
                                    stop66={results.stop66 || 0}
                                    target2R={results.target2R || 0}
                                    target3R={results.target3R || 0}
                                />
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-4">
                            <button className="btn btn-primary flex-1" onClick={handleSubmit}>
                                Place Trade
                            </button>
                            <button className="btn btn-ghost">Reset</button>
                        </div>
                    </div>
                </div>
            </TitleCard>
            <ToastContainer /> 
        </div>
    )
}

export default TradePlanner
