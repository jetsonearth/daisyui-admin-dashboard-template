import React, { useState } from 'react';
import { supabase } from '../../config/supabaseClient'
import './TradeManager.css';

export const TradeManager = ({ trade, onClose, onUpdate }) => {
    console.log('Trade passed to TradeManager:', trade);

    const [quantity, setQuantity] = useState('');
    const [price, setPrice] = useState('');
    const [loading, setLoading] = useState(false);

    // Add default values if trade properties are undefined
    const remainingShares = trade.remaining_shares || trade.total_shares || 0;
    const avgCost = trade.avg_cost || trade.entry_price || 0;

    const handleAddPosition = async () => {
        setLoading(true);
        try {
            const newShares = Number(quantity);
            const newPrice = Number(price);
            
            // Calculate new average cost
            const totalShares = remainingShares + newShares;
            const newAvgCost = ((avgCost * remainingShares) + (newPrice * newShares)) / totalShares;

            const { data, error } = await supabase
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
            if (sharesToSell > remainingShares) {
                alert('Cannot sell more shares than available');
                return;
            }

            const { data, error } = await supabase
                .from('trades')
                .update({
                    remaining_shares: remainingShares - sharesToSell,
                    realized_pnl: (trade.realized_pnl || 0) + ((Number(price) - avgCost) * sharesToSell),
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
            const { data, error } = await supabase
                .from('trades')
                .update({
                    status: 'Closed',
                    remaining_shares: 0,
                    realized_pnl: (trade.realized_pnl || 0) + ((Number(price) - avgCost) * remainingShares),
                    exit_price: Number(price),
                    exit_date: new Date().toISOString(),
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
                    <h2>Manage {trade.ticker || 'Trade'} Position</h2>
                    <button className="close-button" onClick={onClose}>×</button>
                </div>

                <div className="trade-info">
                    <div>Current Position: {remainingShares} shares</div>
                    <div>Average Cost: ${avgCost.toFixed(2)}</div>
                </div>

                <div className="trade-actions">
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
                            className="add-button"
                        >
                            Add Position
                        </button>
                        <button 
                            onClick={handleTrimPosition}
                            disabled={loading || !quantity || !price}
                            className="trim-button"
                        >
                            Trim Position
                        </button>
                        <button 
                            onClick={handleCloseTrade}
                            disabled={loading || !price}
                            className="close-trade-button"
                        >
                            Close Trade
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
