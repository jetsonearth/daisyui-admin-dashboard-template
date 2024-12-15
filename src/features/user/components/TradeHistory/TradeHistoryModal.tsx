// src/components/TradeHistory/TradeHistoryModal.tsx
import React, { useEffect,useState } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { supabase } from '../../../../config/supabaseClient';
import { toast } from 'react-toastify';
import { Trade, TRADE_STATUS, DIRECTIONS, ASSET_TYPES, STRATEGIES, SETUPS } from '../../../../types'; 

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


const TradeHistoryModal: React.FC<TradeHistoryModalProps> = ({ isOpen, onClose, onTradeAdded, existingTrade }) => {
    const [tradeDetails, setTradeDetails] = useState<{
        ticker: string;
        direction: string;
        assetType: string;
        stopLossPrice: string;
        actions: Action[];
    }>(() => {
        // Initialize with existingTrade data if available
        if (existingTrade) {
            const actions: Action[] = existingTrade.action_types?.map((type, index) => ({
                type: type as 'BUY' | 'SELL',
                date: new Date(existingTrade.action_datetimes?.[index] || Date.now()),
                price: existingTrade.action_prices?.[index]?.toString() || '',
                shares: existingTrade.action_shares?.[index]?.toString() || '',
            })) || [{
                type: 'BUY',
                date: new Date(),
                shares: '',
                price: '',
            }];

            return {
                ticker: existingTrade.ticker,
                direction: existingTrade.direction,
                assetType: existingTrade.asset_type,
                stopLossPrice: existingTrade.stop_loss_price?.toString() || '',
                actions,
            };
        }

        return {
            ticker: '',
            direction: DIRECTIONS.LONG,
            assetType: ASSET_TYPES.STOCK,
            stopLossPrice: '',
            actions: [{
                type: 'BUY',
                date: new Date(),
                shares: '',
                price: '',
            }]
        };
    });

    // Add this useEffect
    useEffect(() => {
        if (existingTrade) {
            const actions: Action[] = existingTrade.action_types?.map((type, index) => ({
                type: type as 'BUY' | 'SELL',
                date: new Date(existingTrade.action_datetimes?.[index] || Date.now()),
                price: existingTrade.action_prices?.[index]?.toString() || '',
                shares: existingTrade.action_shares?.[index]?.toString() || '',
            })) || [{
                type: 'BUY',
                date: new Date(),
                shares: '',
                price: '',
            }];

            setTradeDetails({
                ticker: existingTrade.ticker,
                direction: existingTrade.direction,
                assetType: existingTrade.asset_type,
                stopLossPrice: existingTrade.stop_loss_price?.toString() || '',
                actions,
            });
        }
    }, [existingTrade]);  // This will run whenever existingTrade changes


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

    // Handle strategy change
    const handleStrategyChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedStrategy(event.target.value as STRATEGIES);
    };

    // Handle setups change
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

    const fetchHighLowPrices = async (ticker: string, entryDate: Date, exitDate: Date) => {
        try {
            const response = await fetch('https://script.google.com/macros/s/AKfycbyehfxdfnSYpStqu9akTdp6NNBfRer7HFUjwCaS-SbiVptT3hviadPRuSidpQR_YYYwLQ/exec', {
                method: 'POST',
                body: JSON.stringify({
                    ticker,
                    entryDate: entryDate.toISOString(),
                    exitDate: exitDate.toISOString()
                }),
                headers: {
                    'Content-Type': 'application/json',
                },
            });
    
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
    
            const data = await response.json();
            return {
                minPrice: data.minPrice, // Adjust based on your API response structure
                maxPrice: data.maxPrice, // Adjust based on your API response structure
            };
        } catch (error) {
            console.error('Error fetching high and low prices:', error);
            return null; // Return null or handle the error as needed
        }
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
            let exitPrice = 0;
            let exitDate = '';
            let trimmedPercentage = 0;

            let target2R = 0;
            let target3R = 0;

            let openRisk = 0;
            let riskAmount = 0;

            let stopDistance = 0;
            let stop33 = 0;
            let stop66 = 0;
            let stopLoss33Percent = 0;
            let stopLoss66Percent = 0;
            let fullStopLoss = 0;

            let mae = 0;
            let mfe = 0;

            let lastSellAction = null; // Track the last sell action

            // Format actions into arrays
            const action_types = tradeDetails.actions.map(a => a.type);
            const action_datetimes = tradeDetails.actions.map(a => a.date.toISOString());
            const action_prices = tradeDetails.actions.map(a => parseFloat(a.price));
            const action_shares = tradeDetails.actions.map(a => parseFloat(a.shares));

            // Calculate shares and validate actions
            for (const action of tradeDetails.actions) {
                if (action.type === 'BUY') {
                    const shares = parseFloat(action.shares);
                    totalShares += shares; // Update total shares
                    remainingShares += shares; // Update remaining shares
                    totalCost += shares * parseFloat(action.price); // Adjust total cost
                    entryPrice = totalCost / remainingShares; // Update entry price because it would change the average cost

                    // Calculate stop levels (33% and 66% of full stop distance)
                    stopDistance = entryPrice - parseFloat(tradeDetails.stopLossPrice)
                    stop33 = entryPrice - (stopDistance * 0.33)
                    stop66 = entryPrice - (stopDistance * 0.66)

                    // 3-Tiered Stop-Loss Risk Calculation
                    fullStopLoss = (entryPrice - parseFloat(tradeDetails.stopLossPrice)) / entryPrice * 100
                    stopLoss33Percent = (entryPrice - stop33) / entryPrice * 100
                    stopLoss66Percent = (entryPrice - stop66) / entryPrice * 100

                    openRisk = (
                        (fullStopLoss * 0.5) +  // Full stop gets 50% weight
                        (stopLoss33Percent * 0.33) +   // 33% stop gets 33% weight
                        (stopLoss66Percent * 0.17)     // 66% stop gets 17% weight
                    )

                    target2R = entryPrice + 2 * stopDistance;
                    target3R = entryPrice + 3 * stopDistance;

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
                    }
                }
            }

            riskAmount = totalShares * entryPrice * openRisk;
            trimmedPercentage = ((totalShares - remainingShares) / totalShares) * 100;

            const status = remainingShares > 0 ? TRADE_STATUS.OPEN : TRADE_STATUS.CLOSED;

            // Fetch high and low prices only if the trade is closed, for mae and mfe computations
            if (status === TRADE_STATUS.CLOSED) {
                const prices = await fetchHighLowPrices(tradeDetails.ticker, new Date(tradeDetails.actions[0].date), new Date(exitDate));
                if (prices) {
                    const { minPrice, maxPrice } = prices;
                    // Calculate MAE and MFE
                    mae = entryPrice - minPrice; // Calculate MAE
                    mfe = maxPrice - entryPrice; // Calculate MFE
                }
            }

            // Create or update the trade record
            const tradeRecord = {
                user_id: user.id,
                ticker: tradeDetails.ticker,
                direction: tradeDetails.direction,
                asset_type: tradeDetails.assetType,
                stop_loss_price: tradeDetails.stopLossPrice,
                status: status,
                created_at: new Date().toISOString(),
                entry_datetime: tradeDetails.actions[0].date.toISOString(),
                entry_price: entryPrice,
                total_shares: totalShares, // Update total shares
                remaining_shares: remainingShares,
                realized_pnl: realizedPnl,
                total_cost: totalCost,
                strategy: selectedStrategy || null, // Include strategy if selected
                setups: selectedSetups.length > 0 ? selectedSetups : null, // Include setups if any are selected
                exit_price: exitPrice || null,
                exit_datetime: exitDate || null,
                trimmed_percentage: trimmedPercentage,
                risk_amount: riskAmount,
                open_risk: openRisk,
                stop_loss_33_percent: stop33,
                stop_loss_66_percent: stop66,
                r_target_2: target2R,
                r_target_3: target3R,
                action_types,
                action_datetimes,
                action_prices,
                action_shares,
                notes,
                mistakes,
                mae,
                mfe
            }; 

            let result;
            if (existingTrade) {
                // Update existing trade
                const { data, error } = await supabase
                    .from('trades')
                    .update(tradeRecord)
                    .eq('id', existingTrade.id)
                    .eq('user_id', user.id)
                    .select();

                if (error) throw error;
                result = data;
                toast.success('Trade updated successfully!');
            } else {
                // Create new trade
                const { data, error } = await supabase
                    .from('trades')
                    .insert([tradeRecord])
                    .select();

                if (error) throw error;
                result = data;
                toast.success('Trade added successfully!');
            }

            onTradeAdded(); // Refresh the trade list
            onClose(); // Close the modal
        } catch (error: any) { // Type assertion for error
            const errorMessage = error?.message || 'An unknown error occurred';
            toast.error(existingTrade ? 'Failed to update trade' : 'Failed to add trade');
        } finally {
            setLoading(false); // Reset loading state
        }
    };


    return (
        isOpen ? (
            <div className="modal modal-open">
                {loading && <div className="spinner">Loading...</div>}
                <div className="modal-box max-w-4xl">
                    {/* Tabs */}
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
                            Notes & Mistakes
                        </a>
                    </div>

                    {activeTab === 'general' ? (
                        <>
                            <h3 className="font-bold text-lg mb-4">Trade View</h3>
                            
                            {/* Top Section - 4 columns */}
                            <div className="grid grid-cols-4 gap-4 mb-6">
                                <div>
                                    <label className="label">Market</label>
                                    <select
                                        className="select select-bordered w-full"
                                        value={tradeDetails.assetType}
                                        onChange={e => setTradeDetails(prev => ({ ...prev, assetType: e.target.value }))}
                                    >
                                        <option value={ASSET_TYPES.STOCK}>STOCK</option>
                                        <option value={ASSET_TYPES.OPTION}>OPTION</option>
                                        <option value={ASSET_TYPES.ETF}>ETF</option>
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
                                    <label className="label">Stop-Loss</label>
                                    <input
                                        type="number"
                                        className="input input-bordered w-full"
                                        value={tradeDetails.stopLossPrice}
                                        onChange={e => setTradeDetails(prev => ({ ...prev, stopLossPrice: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="label">Direction</label>
                                    <button 
                                        className={`btn w-full ${tradeDetails.direction === DIRECTIONS.LONG ? 'btn-success' : 'btn-error'}`}
                                        onClick={() => setTradeDetails(prev => ({
                                            ...prev,
                                            direction: prev.direction === DIRECTIONS.LONG ? DIRECTIONS.SHORT : DIRECTIONS.LONG
                                        }))}
                                    >
                                        {tradeDetails.direction}
                                    </button>
                                </div>
                            </div>

                            {/* Strategy and Setups Section */}
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

                            {/* Actions Table */}
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
                                                        className={`btn btn-sm w-24 ${action.type === 'BUY' ? 'btn-success' : 'btn-error'}`}
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

                            {/* Add Action Button */}
                            <div className="flex justify-center mt-6 mb-6 gap-8"> {/* Increased gap */}
                                <button
                                    onClick={addAction}
                                    className="btn btn-danger btn-primary"
                                >
                                    Add Actions
                                </button>
                                <button onClick={handleDeleteTrade} className="btn btn-error">
                                    Delete Trade
                                </button>
                            </div>
                        </>
                    ) : (
                        // Notes & Mistakes Tab
                        <div className="space-y-4">
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

                    {/* Modal Actions */}
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