import React, { useState } from 'react';

const SheetTest = () => {
    const [rawData, setRawData] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const testFetch = async () => {
        setLoading(true);
        setError(null);
        try {
            const url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRzNnZcQG7SoBq22GFq_CBvACdqYDjSJM5EkSB0RGWwEZtN9LAlxY7ZvyjpOWi8DeeDTs5-U5bkXFM7/pub?gid=0&single=true&output=csv';
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const text = await response.text();
            console.log('Raw CSV:', text);
            setRawData(text);
        } catch (err) {
            console.error('Error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4">
            <h2 className="text-xl font-bold mb-4">Sheet Test</h2>
            <button 
                onClick={testFetch}
                className="btn btn-primary mb-4"
                disabled={loading}
            >
                {loading ? 'Loading...' : 'Test Sheet Fetch'}
            </button>
            
            {error && (
                <div className="alert alert-error mt-4">
                    {error}
                </div>
            )}
            
            {rawData && (
                <div className="mt-4">
                    <h3 className="font-bold mb-2">Raw CSV Data:</h3>
                    <pre className="bg-base-200 p-4 rounded-lg overflow-auto">
                        {rawData}
                    </pre>
                </div>
            )}
        </div>
    );
};

export default SheetTest;
