import React, { useState } from 'react';
import { supabase } from '../../config/supabaseClient';
import './TradeManager.css';
import { FaPlus, FaCut, FaTimes } from 'react-icons/fa';

export const TradeManager = ({ trade, onClose, onUpdate }) => {
    const [quantity, setQuantity] = useState('');
    const [price, setPrice] = useState(trade.current_price ? trade.current_price.toString() : '');
    const [loading, setLoading] = useState(false);

    // Safely extract trade details with fallbacks
    const ticker = trade.ticker || 'Unknown';
    const remainingShares = trade.remaining_shares || trade.total_shares || 0;
    const avgCost = trade.avg_cost || trade.entry_price || 0;
    const currentPrice = trade.current_price || 0;
    const unrealizedPnL = ((currentPrice - avgCost) * remainingShares).toFixed(2);

    const handleAddPosition = async () => {
        setLoading(true);
        try {
            const newShares = Number(quantity);
            const newPrice = Number(price);
            
            const totalShares = remainingShares + newShares;
            const newAvgCost = ((avgCost * remainingShares) + (newPrice * newShares)) / totalShares;

            const { error } = await supabase
                .from('trades')
                .update({
                    total_shares: totalShares,
                    remaining_shares: remainingShares + newShares,
                    avg_cost: newAvgCost,
                    updated_at: new Date().toISOString()
                })
                .eq('id', trade.id);

            if (error) throw error;
            onUpdate();
        } catch (error) {
            console.error('Error adding to position:', error);
        } finally {
            setLoading(false);
            onClose();
        }
    };

    const handleTrimPosition = async () => {
        setLoading(true);
        try {
            const sharesToSell = Number(quantity);
            const sellPrice = Number(price);

            if (sharesToSell > remainingShares) {
                alert('Cannot sell more shares than available');
                return;
            }

            const { error } = await supabase
                .from('trades')
                .update({
                    remaining_shares: remainingShares - sharesToSell,
                    realized_pnl: (sellPrice - avgCost) * sharesToSell,
                    updated_at: new Date().toISOString()
                })
                .eq('id', trade.id);

            if (error) throw error;
            onUpdate();
        } catch (error) {
            console.error('Error trimming position:', error);
        } finally {
            setLoading(false);
            onClose();
        }
    };

    const handleCloseTrade = async () => {
        setLoading(true);
        try {
            const exitPrice = Number(price);

            const { error } = await supabase
                .from('trades')
                .update({
                    status: 'Closed',
                    remaining_shares: 0,
                    exit_price: exitPrice,
                    exit_date: new Date().toISOString(),
                    realized_pnl: (exitPrice - avgCost) * remainingShares,
                    updated_at: new Date().toISOString()
                })
                .eq('id', trade.id);

            if (error) throw error;
            onUpdate();
        } catch (error) {
            console.error('Error closing trade:', error);
        } finally {
            setLoading(false);
            onClose();
        }
    };

    return (
        <div className="trade-manager-modal">
            <div className="trade-manager-content">
                <div className="trade-manager-header">
                    <h2>Manage {trade.ticker} Position</h2>
                    <button className="close-button" onClick={onClose}>×</button>
                </div>

                <div className="trade-info">
                    <div>Current Position: {remainingShares} shares</div>
                    <div>Average Cost: ${avgCost.toFixed(2)}</div>
                </div>

                <div className="input-group">
                    <input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder="Quantity"
                    />
                    <input
                        type="number"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="Price"
                    />
                </div>

                <div className="button-group">
                    <button 
                        onClick={handleAddPosition}
                        disabled={loading || !quantity || !price}
                        className="trade-action-btn add-btn"
                    >
                        Add Position
                    </button>
                    <button 
                        onClick={handleTrimPosition}
                        disabled={loading || !quantity || !price}
                        className="trade-action-btn trim-btn"
                    >
                        Trim Position
                    </button>
                    <button 
                        onClick={handleCloseTrade}
                        disabled={loading || !price}
                        className="trade-action-btn close-btn"
                    >
                        Close Trade
                    </button>
                </div>
            </div>
        </div>
    );
};
