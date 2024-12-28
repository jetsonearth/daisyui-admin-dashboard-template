import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabaseClient';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import { UTCTimestamp } from 'lightweight-charts';
import { marketDataService } from '../../features/marketData/marketDataService';
import { TradeReplayChart } from '../TradeReplayChart';
import {SETUPS} from "../../types";

interface MissedTrade {
    id?: string;
    ticker: string;
    setup_type: string;
    entry_price: number;
    target_price: number;
    stop_price: number;
    potential_reward: number;
    reason: string;
    lessons: string;
}

interface MissedTradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedDate: Date;
    selectedTrade?: MissedTrade;
    onSave: () => void;
}

const MissedTradeModal: React.FC<MissedTradeModalProps> = ({
    isOpen,
    onClose,
    selectedDate,
    selectedTrade,
    onSave
}) => {
    const [formData, setFormData] = useState<MissedTrade>({
        ticker: '',
        setup_type: '',
        entry_price: 0,
        target_price: 0,
        stop_price: 0,
        potential_reward: 0,
        reason: '',
        lessons: ''
    });

    const [chartData, setChartData] = useState<any[]>([]);
    const [isLoadingChart, setIsLoadingChart] = useState(false);

    useEffect(() => {
        if (selectedTrade) {
            setFormData(selectedTrade);
        } else {
            setFormData({
                ticker: '',
                setup_type: '',
                entry_price: 0,
                target_price: 0,
                stop_price: 0,
                potential_reward: 0,
                reason: '',
                lessons: ''
            });
        }
    }, [selectedTrade]);

    useEffect(() => {
        if (formData.ticker && formData.entry_price) {
            loadChartData();
        }
    }, [formData.ticker, formData.entry_price]);

    const loadChartData = async () => {
        try {
            setIsLoadingChart(true);
            const endDate = new Date();
            const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

            const response = await marketDataService.getOHLCV(
                formData.ticker,
                startDate,
                endDate
            );

            if (response.error) {
                throw new Error(response.error);
            }

            setChartData(response.ohlcv);
        } catch (error) {
            console.error('Error loading chart data:', error);
            toast.error('Failed to load chart data');
        } finally {
            setIsLoadingChart(false);
        }
    };

    const calculatePotentialReward = (entry: number, target: number) => {
        const shares = 100; // Default position size
        const direction = target > entry ? 1 : -1;
        const reward = direction * (Math.abs(target - entry) * shares);
        return parseFloat(reward.toFixed(2));
    };

    const handleSave = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                toast.error('Please log in to save missed trade');
                return;
            }

            const dateStr = format(selectedDate, 'yyyy-MM-dd');
            const trade = {
                user_id: user.id,
                date: dateStr,
                ...formData
            };

            if (selectedTrade?.id) {
                const { error } = await supabase
                    .from('missed_opportunities')
                    .update(trade)
                    .eq('id', selectedTrade.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('missed_opportunities')
                    .insert([trade]);
                if (error) throw error;
            }

            toast.success('Missed trade saved successfully');
            onSave();
            onClose();
        } catch (error) {
            console.error('Error saving missed trade:', error);
            toast.error('Failed to save missed trade');
        }
    };

    const actions = formData.entry_price ? [{
        type: 'BUY' as const,
        price: formData.entry_price,
        time: (new Date().getTime() / 1000) as UTCTimestamp,
        shares: 100 // Default shares for visualization
    }] : [];

    if (!isOpen) return null;

    return (
        <div className="modal modal-open">
            <div className="modal-box w-11/12 max-w-7xl bg-base-200">
                {/* Header */}
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-base-300">
                    <h3 className="text-2xl font-bold">
                        {selectedTrade ? 'Edit Missed Trade' : 'Add Missed Trade'}
                    </h3>
                    <button className="btn btn-ghost btn-sm" onClick={onClose}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Main Content */}
                <div className="space-y-6">
                    {/* Top Row - Trade Details */}
                    <div className="grid grid-cols-12 gap-4">
                        {/* Left Column - Ticker and Setup */}
                        <div className="col-span-6 space-y-4">
                            {/* Ticker with Get Chart */}
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text text-base font-medium">Ticker</span>
                                </label>
                                <div className="join w-full">
                                    <input
                                        type="text"
                                        className="input input-bordered join-item flex-1"
                                        value={formData.ticker}
                                        onChange={(e) => setFormData(prev => ({
                                            ...prev,
                                            ticker: e.target.value.toUpperCase()
                                        }))}
                                        placeholder="Enter ticker symbol"
                                    />
                                    <button
                                        className="btn btn-primary join-item gap-2 min-w-[120px]"
                                        onClick={async (e) => {
                                            e.preventDefault();
                                            try {
                                                setIsLoadingChart(true);
                                                const endDate = new Date();
                                                const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
                                                
                                                const data = await marketDataService.getOHLCVData(
                                                    formData.ticker,
                                                    startDate,
                                                    endDate
                                                );

                                                setChartData(data);
                                            } catch (error) {
                                                console.error('Error loading chart data:', error);
                                                toast.error('Failed to load chart data');
                                            } finally {
                                                setIsLoadingChart(false);
                                            }
                                        }}
                                        disabled={!formData.ticker || isLoadingChart}
                                    >
                                        {isLoadingChart ? (
                                            <span className="loading loading-spinner loading-sm"></span>
                                        ) : (
                                            <>
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
                                                </svg>
                                                Get Chart
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Setup Type */}
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text text-base font-medium">Setup Type</span>
                                </label>
                                <select
                                    className="select select-bordered w-full"
                                    value={formData.setup_type}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        setup_type: e.target.value
                                    }))}
                                >
                                    <option value="">Select setup type</option>
                                    {SETUPS.map(setup => (
                                        <option key={setup} value={setup}>
                                            {setup}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Right Column - Price Inputs */}
                        <div className="col-span-6 grid grid-cols-2 gap-4">
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text text-base font-medium">Entry Price</span>
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="input input-bordered"
                                    value={formData.entry_price}
                                    onChange={(e) => {
                                        const value = parseFloat(e.target.value);
                                        setFormData(prev => ({
                                            ...prev,
                                            entry_price: value,
                                            potential_reward: calculatePotentialReward(value, prev.target_price)
                                        }));
                                    }}
                                    placeholder="0.00"
                                />
                            </div>

                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text text-base font-medium">Target Price</span>
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="input input-bordered"
                                    value={formData.target_price}
                                    onChange={(e) => {
                                        const value = parseFloat(e.target.value);
                                        setFormData(prev => ({
                                            ...prev,
                                            target_price: value,
                                            potential_reward: calculatePotentialReward(prev.entry_price, value)
                                        }));
                                    }}
                                    placeholder="0.00"
                                />
                            </div>

                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text text-base font-medium">Stop Price</span>
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="input input-bordered"
                                    value={formData.stop_price}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        stop_price: parseFloat(e.target.value)
                                    }))}
                                    placeholder="0.00"
                                />
                            </div>

                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text text-base font-medium">Potential Reward</span>
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="input input-bordered bg-base-300"
                                    value={formData.potential_reward}
                                    disabled
                                />
                            </div>
                        </div>
                    </div>

                    {/* Chart Section */}
                    <div className="bg-base-300 rounded-lg overflow-hidden h-[700px]">
                        {isLoadingChart ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="flex flex-col items-center gap-4">
                                    <span className="loading loading-spinner loading-lg"></span>
                                    <p className="text-base-content/60">Loading chart data...</p>
                                </div>
                            </div>
                        ) : chartData.length > 0 ? (
                            <TradeReplayChart
                                data={chartData}
                                actions={actions}
                                stopLossPrice={formData.stop_price}
                                containerClassName="w-full h-[1000px]"
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                <div className="flex flex-col items-center gap-4 text-base-content/60">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                    <p>Enter a ticker and click "Get Chart" to view market data</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Bottom Row - Notes */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="form-control">
                            <label className="label">
                                <span className="label-text text-base font-medium">Reason Missed</span>
                            </label>
                            <textarea
                                className="textarea textarea-bordered h-32 bg-base-100"
                                value={formData.reason}
                                onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    reason: e.target.value
                                }))}
                                placeholder="Why did you miss this trade? What were the circumstances?"
                            />
                        </div>

                        <div className="form-control">
                            <label className="label">
                                <span className="label-text text-base font-medium">Lessons Learned</span>
                            </label>
                            <textarea
                                className="textarea textarea-bordered h-32 bg-base-100"
                                value={formData.lessons}
                                onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    lessons: e.target.value
                                }))}
                                placeholder="What can you learn from this missed opportunity? How can you improve next time?"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="modal-action mt-8 pt-4 border-t border-base-300">
                    <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
                    <button 
                        className="btn btn-primary" 
                        onClick={handleSave}
                        disabled={!formData.ticker || !formData.setup_type || !formData.entry_price || !formData.target_price || !formData.stop_price}
                    >
                        Save Trade
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MissedTradeModal;
