// src/components/TradeHistory/TradeHistoryModal.tsx
import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { supabase } from '../../../../config/supabaseClient';
import { ASSET_TYPES, DIRECTIONS, TRADE_STATUS } from '../../../../types/index';
import { toast } from 'react-toastify';

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
        symbol: string;
        direction: string;
        assetType: string;
        initialStopLoss: string;
        actions: Action[];
    }>({
        symbol: '',
        direction: DIRECTIONS.LONG,
        assetType: ASSET_TYPES.STOCK,
        initialStopLoss: '',
        actions: [{
            type: 'BUY',
            date: new Date(),
            shares: '',
            price: '',
        }]
    });

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


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                toast.error('Please log in to add trades');
                return;
            }

            // Create the trade record
            const tradeRecord = {
                user_id: user.id,
                symbol: tradeDetails.symbol,
                direction: tradeDetails.direction,
                asset_type: tradeDetails.assetType,
                initial_stop_loss: tradeDetails.initialStopLoss,
                status: TRADE_STATUS.OPEN || 'Open', // Default status
                created_at: new Date().toISOString()
            };

            // Insert the trade
            const { data: trade, error: tradeError } = await supabase
                .from('trades')
                .insert([tradeRecord])
                .select()
                .single();

            if (tradeError) throw tradeError;

            // Insert all actions
            const tradeActions = tradeDetails.actions.map(action => ({
                trade_id: trade.id,
                type: action.type,
                date: action.date.toISOString(),
                shares: parseFloat(action.shares),
                price: parseFloat(action.price)
            }));

            const { error: actionsError } = await supabase
                .from('trade_actions')
                .insert(tradeActions);

            if (actionsError) throw actionsError;

            toast.success('Trade added successfully');
            onTradeAdded(); // Refresh the trade list
            onClose(); // Close the modal
        } catch (error: any) { // Type assertion for error
            const errorMessage = error?.message || 'An unknown error occurred';
            toast.error('Failed to add trade: ' + errorMessage);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal modal-open">
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
                        </select>
                    </div>
                    <div>
                        <label className="label">Symbol</label>
                        <input
                            type="text"
                            className="input input-bordered w-full"
                            value={tradeDetails.symbol}
                            onChange={e => setTradeDetails(prev => ({ ...prev, symbol: e.target.value.toUpperCase() }))}
                        />
                    </div>
                    <div>
                        <label className="label">Stop-Loss</label>
                        <input
                            type="number"
                            className="input input-bordered w-full"
                            value={tradeDetails.initialStopLoss}
                            onChange={e => setTradeDetails(prev => ({ ...prev, initialStopLoss: e.target.value }))}
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

                {/* Actions Table */}
                <div className="overflow-x-auto">
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
                <div className="flex justify-center mt-4">
                    <button
                        onClick={addAction}
                        className="btn btn-circle btn-sm btn-primary"
                    >
                        +
                    </button>
                </div>

                {/* Modal Actions */}
                <div className="modal-action">
                    <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSubmit}>Save</button>
                </div>
            </div>
        </div>
    );
};

export  default TradeHistoryModal;