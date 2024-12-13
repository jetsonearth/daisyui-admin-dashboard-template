// src/components/TradeHistory/TradeHistoryModal.tsx
import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { supabase } from '../../../../config/supabaseClient';
import { ASSET_TYPES, DIRECTIONS, TRADE_STATUS } from '../../../../types/index';
import { toast } from 'react-toastify';
import { metricsService } from '../../../../features/metrics/metricsService';
import { Trade, STRATEGIES, SETUPS } from '../../../../types'; // Adjust the import path as necessary


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
}


const TradeHistoryModal: React.FC<TradeHistoryModalProps> = ({ isOpen, onClose, onTradeAdded }) => {
    const [tradeDetails, setTradeDetails] = useState<{
        ticker: string;
        direction: string;
        assetType: string;
        stopLossPrice: string;
        actions: Action[];
    }>({
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
    });

    const [selectedStrategy, setSelectedStrategy] = useState<STRATEGIES | undefined>(undefined);
    const [selectedSetups, setSelectedSetups] = useState<string[]>([]);

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

            let lastSellAction = null; // Track the last sell action

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
                        exitPrice = parseFloat(action.price);
                        exitDate = action.date.toISOString();
                    }
                }
            }

            riskAmount = totalShares * entryPrice * openRisk;
            trimmedPercentage = ((totalShares - remainingShares) / totalShares) * 100;

            // Create the trade record
            const tradeRecord = {
                user_id: user.id,
                ticker: tradeDetails.ticker,
                direction: tradeDetails.direction,
                asset_type: tradeDetails.assetType,
                stop_loss_price: tradeDetails.stopLossPrice,
                status: totalShares > 0 ? TRADE_STATUS.OPEN : TRADE_STATUS.CLOSED,
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
                r_target_3: target3R
            }; 

            // Insert the trade
            const { data: trade, error: tradeError } = await supabase
                .from('trades')
                .insert([tradeRecord])
                .select()
                .single();

            if (tradeError) {
                console.error('Error inserting trade:', tradeError);
                toast.error('Failed to insert trade: ' + tradeError.message);
                return;
            }

            onTradeAdded(); // Refresh the trade list
            onClose(); // Close the modal
        } catch (error: any) { // Type assertion for error
            const errorMessage = error?.message || 'An unknown error occurred';
            toast.error('Failed to add trade: ' + errorMessage);
        } finally {
            setLoading(false); // Reset loading state
        }
    };

    return (
        isOpen ? (
            <div className="modal modal-open">
                {loading && <div className="spinner">Loading...</div>}
                <div className="modal-box max-w-4xl">
                    <h3 className="font-bold text-lg mb-4">Trade View</h3>
                    
                    {/* Top Section */}
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

                    {/* Strategy and Setups Dropdowns in the same row */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        {/* Strategy Dropdown */}
                        <div>
                            <label className="label">Strategy:</label>
                            <div className="dropdown">
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

                        {/* Setups Dropdown */}
                        <div>
                            <label className="label">Setups:</label>
                            <div className="dropdown">
                                <div tabIndex={0} role="button" className="btn select select-bordered w-full" onClick={() => {}}>
                                    {selectedSetups.length > 0 ? selectedSetups.join(', ') : "Select Setups"}
                                </div>
                                <ul tabIndex={0} className="dropdown-content menu bg-base-100 rounded-box z-[1] w-full p-2 shadow">
                                    {SETUPS.map(setup => (
                                        <li key={setup}>
                                            <label className="flex items-center">
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
                                                    className="mr-2"
                                                />
                                                {setup}
                                            </label>
                                        </li>
                                    ))}
                                </ul>
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
                    <div className="flex justify-center mt-4 mb-6">
                        <button
                            onClick={addAction}
                            className="btn btn-circle btn-sm btn-primary"
                        >
                            +
                        </button>
                    </div>

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