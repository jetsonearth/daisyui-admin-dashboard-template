import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'; // Import useDispatch hook
import TitleCard from '../../components/Cards/TitleCard'
import { STRATEGIES, ASSET_TYPES, DIRECTIONS, TRADE_STATUS } from '../../features/trades/tradeModel'
import { processTradeEntry } from '../../features/trades/tradeService' // Import addTrade action
import { addTrade } from '../../features/trades/tradesSlice'; // Correct import for addTrade
import PriceLadder from '../../components/PriceLadder'
import StopLossVisualizer from '../../components/StopLossVisualizer'
import { marketDataService } from '../../features/marketData/marketDataService'
import { supabase } from '../../config/supabaseClient';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function TradePlanner() {
    const navigate = useNavigate()
    const dispatch = useDispatch(); // Initialize useDispatch hook

    // Input states
    const [inputs, setInputs] = useState({
        ticker: '',
        entryPrice: '',
        atr: '',
        lowOfDay: '',
        portfolioRisk: '0.5', // Default 0.5%
        commission: '',     // Default empty
        strategy: '',
        setup: '',
        direction: DIRECTIONS.LONG,
        assetType: ASSET_TYPES.STOCK,
        notes: ''
    })

    // Add a state to track price fetch time
    const [priceInfo, setPriceInfo] = useState({
        timestamp: null,
        fetchError: null
    })

    // Modify the useEffect
    useEffect(() => {
        const fetchMarketPrice = async () => {
            if (inputs.ticker) {
                try {
                    const currentPrice = await marketDataService.getQuote(inputs.ticker)
                    if (currentPrice?.price) {
                        setInputs(prevInputs => ({
                            ...prevInputs,
                            entryPrice: currentPrice.price.toString(),
                            lowOfDay: currentPrice.low ? currentPrice.low.toString() : ''
                        }))
                        
                        // Update price info
                        setPriceInfo({
                            timestamp: new Date().toLocaleTimeString(),
                            fetchError: null
                        })
                    }
                } catch (error) {
                    console.error('Error fetching market price:', error)
                    setPriceInfo({
                        timestamp: null,
                        fetchError: error.message
                    })
                }
            }
        }

        fetchMarketPrice()
    }, [inputs.ticker])

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

    // Mock account size - should be fetched from portfolio
    const accountSize = 13000

    const calculateResults = async () => {
        const {
            entryPrice,
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
        const currentPrice = await marketDataService.getQuote(inputs.ticker)
        console.log('Current Market Price:', currentPrice?.price)
        const lod = parseFloat(lowOfDay)  // Will throw an error if not provided
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

        // console.log('Stop Loss Calculations:', {
        //     price,
        //     stopDistanceTiered,
        //     fullStopPrice,
        //     stop33,
        //     stop66,
        //     fullStopLoss: fullStopLoss.toFixed(2) + '%',
        //     stop33Loss: stop33Loss.toFixed(2) + '%', 
        //     stop66Loss: stop66Loss.toFixed(2) + '%',
        //     riskPerShare,
        //     openRisk: openRisk.toFixed(2) + '%'
        // })

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
            stopLossPercent: parseFloat(stopLossPercent.toFixed(2))
        })
    }

    useEffect(() => {
        calculateResults()
    }, [inputs])

    const handleSubmit = async () => {
        // Validation Checks
        const errors = [];

        console.log("🔍 Starting Trade Submission Validation");
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
            return
        }

        try {
            // Step 2: Authenticate User
            console.log("🔐 Checking User Authentication");
            const { data: { session }, error: sessionError } = await supabase.auth.getSession()
            console.log("📦 Current Session:", session);
            
            const { data: { user }, error: userError } = await supabase.auth.getUser()
            console.log("👤 Current User:", user);

            // Add these debugging lines
            console.log('Supabase object:', supabase)
            console.log('Supabase auth methods:', Object.keys(supabase.auth))
            
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
                return
            }

            // Step 3: Prepare Trade Object
            console.log("📝 Preparing Trade Object");

            const newTrade = {
                trade_id: `${inputs.ticker}-${new Date().toISOString().split('T')[0]}-${inputs.direction}`,
                user_id: user.id,
                ticker: inputs.ticker,
                direction: inputs.direction,
                asset_type: inputs.assetType || 'STOCK', // Default if not specified
                total_shares: results.positionSize,
                total_cost: results.totalCost,
                remaining_shares: results.positionSize,
                entry_price: parseFloat(inputs.entryPrice),
                last_price: parseFloat(inputs.entryPrice),
                
                // Optional fields with defaults
                strategy: inputs.strategy || 'UNDEFINED',
                setups: inputs.setup ? [inputs.setup] : null, // Use null instead of empty array

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
                updated_at: new Date().toISOString()
            }

            console.log("🚀 Prepared Trade Object:", newTrade);

            // Supabase insertion
            console.log("💾 Inserting Trade into Supabase");
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
            toast.success('Trade successfully logged!', {
                position: "top-right",
                autoClose: 3000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true
            })

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
        }
    }

    const handleInputChange = (e) => {
        const { name, value } = e.target
        setInputs(prev => ({
            ...prev,
            [name]: value
        }))
    }

    return (
        <div className="p-4">
            <TitleCard title="New Trade Entry">
                <div className="grid grid-cols-2 gap-6">
                    {/* Left Column - Inputs */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold mb-4">Trade Parameters</h3>
                        
                        {/* Basic Info */}
                        <div className="form-control">
                            <label className="label">
                                <span className="label-text">Ticker</span>
                            </label>
                            <input
                                type="text"
                                name="ticker"
                                value={inputs.ticker}
                                onChange={handleInputChange}
                                className="input input-bordered"
                                placeholder="AAPL"
                            />
                            {inputs.ticker && (
                                <div className="text-sm text-gray-350 mt-1">
                                    {priceInfo.timestamp 
                                        ? `Market price as of ${priceInfo.timestamp}` 
                                        : priceInfo.fetchError 
                                            ? `Price fetch error: ${priceInfo.fetchError}` 
                                            : 'Fetching market price...'}
                                </div>
                            )}
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
                                <select 
                                    name="direction"
                                    value={inputs.direction}
                                    onChange={handleInputChange}
                                    className="select select-bordered"
                                >
                                    <option value="">Select Direction</option>
                                    {Object.values(DIRECTIONS).map(direction => (
                                        <option key={direction} value={direction}>{direction}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">Asset Type</span>
                                </label>
                                <select 
                                    name="assetType"
                                    value={inputs.assetType}
                                    onChange={handleInputChange}
                                    className="select select-bordered"
                                >
                                    <option value="">Select Asset Type</option>
                                    {Object.values(ASSET_TYPES).map(assetType => (
                                        <option key={assetType} value={assetType}>{assetType}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">Strategy</span>
                                </label>
                                <select 
                                    name="strategy"
                                    value={inputs.strategy}
                                    onChange={handleInputChange}
                                    className="select select-bordered"
                                >
                                    <option value="">Select Strategy</option>
                                    {Object.values(STRATEGIES).map(strategy => (
                                        <option key={strategy} value={strategy}>{strategy}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="form-control">
                            <label className="label">
                                <span className="label-text">Setup</span>
                            </label>
                            <input
                                type="text"
                                name="setup"
                                value={inputs.setup}
                                onChange={handleInputChange}
                                className="input input-bordered"
                                placeholder="e.g., Bull Flag"
                            />
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
                                        <span className="text-xs text-red-500 ml-2">
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
                                    entryPrice={parseFloat(inputs.entryPrice)}
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
