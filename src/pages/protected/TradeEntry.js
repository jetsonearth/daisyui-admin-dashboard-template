import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'; // Import useDispatch hook
import TitleCard from '../../components/Cards/TitleCard'
import { STRATEGIES, ASSET_TYPES, DIRECTIONS, TRADE_STATUS } from '../../features/trades/tradeModel'
import { processTradeEntry } from '../../features/trades/tradeService' // Import addTrade action
import { addTrade } from '../../features/trades/tradesSlice'; // Correct import for addTrade
import PriceLadder from '../../components/PriceLadder'
import StopLossVisualizer from '../../components/StopLossVisualizer'
import { SAMPLE_TRADES } from '../../features/trades/tradeModel'

function TradePlanner() {
    const navigate = useNavigate()
    const dispatch = useDispatch(); // Initialize useDispatch hook

    // Input states
    const [inputs, setInputs] = useState({
        ticker: '',
        currentPrice: '',
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
        openRisk: 0,
        breakEvenPrice: 0,
        target2R: 0,
        target3R: 0,
        rrr: 0
    })

    // Mock account size - should be fetched from portfolio
    const accountSize = 100000

    const calculateResults = () => {
        const {
            currentPrice,
            atr,
            lowOfDay,
            portfolioRisk,
            commission
        } = inputs
    
        // Guard against invalid inputs
        if (!currentPrice || isNaN(currentPrice)) {
            setResults({
                fullStopPrice: 0,
                stop33: 0,
                stop66: 0,
                positionSize: 0,
                dollarExposure: 0,
                openRisk: 0,
                breakEvenPrice: 0,
                target2R: 0,
                target3R: 0,
                rrr: 0,
                // New fields for stop-loss logic explanation
                stopLossLogic: 'No valid price',
                atrStopPrice: 0,
                lodStopPrice: 0,
                percentStopPrice: 0,
                stopLossPercent: 0
            })
            return
        }

        console.log('Input Values:', {
            currentPrice,
            atr,
            lowOfDay,
            portfolioRisk,
            commission
        });
    
    
        const price = parseFloat(currentPrice)
        const lod = parseFloat(lowOfDay)  // Will throw an error if not provided
        const risk = portfolioRisk ? parseFloat(portfolioRisk) / 100 : 0.005 // Default to 0.5%
    
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
    
        // Calculate stop-loss percentage
        const stopLossPercent = ((price - fullStopPrice) / price) * 100
    
        // Calculate stop levels (33% and 66% of full stop distance)
        const stopDistance = price - fullStopPrice
        const stop66 = price - (stopDistance * 0.66)
        const stop33 = price - (stopDistance * 0.33)
    
        // Calculate position sizing based on risk
        const riskAmount = accountSize * risk
        const riskPerShare = Math.max(0.01, stopDistance) // Prevent division by zero
        const positionSize = Math.max(1, Math.floor(riskAmount / riskPerShare))
    
        // Calculate exposures
        const dollarExposure = positionSize * price
        // const openRisk = ((price - fullStopPrice) / price) * 100
        // Compute Open Risk as a weighted average of the three stop levels

        // 3-Tiered Stop-Loss Risk Calculation
        const fullStopLoss = ((price - fullStopPrice) / price) * 100
        const stop33Loss = ((price - stop33) / price) * 100
        const stop66Loss = ((price - stop66) / price) * 100

        const openRisk = (
            (fullStopLoss * 0.5) +  // Full stop gets 50% weight
            (stop33Loss * 0.33) +   // 33% stop gets 33% weight
            (stop66Loss * 0.17)     // 66% stop gets 17% weight
        )
        // Calculate break-even including commission
        const totalCommission = commission ? parseFloat(commission) * 2 : 0 // Entry + Exit
        const breakEvenPrice = price + (totalCommission / positionSize)

        // Calculate R-multiple targets (2R and 3R)
        const rValue = Math.max(0.01, price - fullStopPrice)
        const target2R = price + (rValue * 2)
        const target3R = price + (rValue * 3)
        const rrr = 3 // Default to 3R target

        setResults({
            fullStopPrice,
            stop33,
            stop66,
            positionSize,
            dollarExposure,
            openRisk,
            breakEvenPrice,
            target2R,
            target3R,
            rrr,
            stopLossLogic,
            atrStopPrice,
            lodStopPrice,
            percentStopPrice,
            stopLossPercent
        })
    }

    useEffect(() => {
        calculateResults()
    }, [inputs])

    const handleSubmit = () => {
        const newTrade = {
            id: Date.now().toString(), // Add unique ID
            ticker: inputs.ticker,
            direction: inputs.direction,
            asset_type: inputs.assetType,
            shares: results.positionSize,
            shares_remaining: results.positionSize,
            avg_cost: parseFloat(inputs.currentPrice),
            current_price: parseFloat(inputs.currentPrice),
            strategy: inputs.strategy,
            setup: inputs.setup,
            full_stop_price: results.fullStopPrice,
            stop_33: results.stop33,
            stop_66: results.stop66,
            open_risk: results.openRisk,
            rrr: results.rrr,
            status: 'open', // Ensure status is set to 'open'
            entry_date: new Date().toISOString().split('T')[0],
            unrealized_pnl: 0,
            unrealized_pnl_percentage: 0,
            market_value: results.positionSize * parseFloat(inputs.currentPrice),
            portfolio_weight: 0, // Will be calculated
            portfolio_impact: 0, // Will be calculated
            trimmed: 0
        }

        console.log('Dispatching new trade:', newTrade) // Debug log
        dispatch(addTrade(newTrade))
        console.log('Trade dispatched') // Debug log

        // Navigate to trade log
        navigate('/app/trades');
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
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">Current Price</span>
                                </label>
                                <input
                                    type="number"
                                    name="currentPrice"
                                    value={inputs.currentPrice}
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
                                                    ({((parseFloat(inputs.currentPrice) - results.fullStopPrice) / parseFloat(inputs.currentPrice) * 100).toFixed(2)}% loss)
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
                                                ({((parseFloat(inputs.currentPrice) - results.stop33) / parseFloat(inputs.currentPrice) * 100).toFixed(2)}% loss)
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
                                                ({((parseFloat(inputs.currentPrice) - results.stop66) / parseFloat(inputs.currentPrice) * 100).toFixed(2)}% loss)
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
                                    <div className="text-lg font-semibold">${results.dollarExposure.toFixed(2)}</div>
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
                        {inputs.currentPrice && (
                            <div className="bg-base-200 p-4 rounded-lg">
                                <h4 className="font-medium mb-10">Price Ladder</h4>
                                {console.log('Price Ladder Props:', {
                                    currentPrice: parseFloat(inputs.currentPrice),
                                    fullStop: results.fullStopPrice,
                                    stop33: results.stop33,
                                    stop66: results.stop66
                                })}
                                <PriceLadder
                                    currentPrice={parseFloat(inputs.currentPrice)}
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
        </div>
    )
}

export default TradePlanner
