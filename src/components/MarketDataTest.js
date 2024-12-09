import React, { useState } from 'react';
import { marketDataService } from '../features/marketData/marketDataService';

const MarketDataTest = () => {
    const [symbol, setSymbol] = useState('AAPL');
    const [price, setPrice] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const testFetch = async () => {
        setLoading(true);
        setError(null);
        try {
            const quote = await marketDataService.getQuote(symbol);
            setPrice(quote);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4">
            <div className="flex gap-2 items-center">
                <input
                    type="text"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    className="input input-bordered w-24"
                    placeholder="Symbol"
                />
                <button 
                    onClick={testFetch}
                    className="btn btn-primary"
                    disabled={loading}
                >
                    {loading ? 'Loading...' : 'Test Market Data'}
                </button>
            </div>
            
            {error && (
                <div className="alert alert-error mt-4">
                    {error}
                </div>
            )}
            
            {price && (
                <div className="mt-4">
                    <h3>Price Data:</h3>
                    <pre>{JSON.stringify(price, null, 2)}</pre>
                </div>
            )}
        </div>
    );
};

export default MarketDataTest;
