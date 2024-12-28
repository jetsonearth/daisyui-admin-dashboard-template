import React, { useEffect, useState } from 'react';
import { Trade } from '../../types';
import { metricsService } from '../../features/metrics/metricsService';
import TitleCard from '../../components/Cards/TitleCard';
import AnalyticsNav from '../../components/AnalyticsNav';
import RiskAnalysis from '../../features/analytics/components/RiskAnalysis';
import StrategyAnalysis from '../../features/analytics/components/StrategyAnalysis';
import TimeAnalysis from '../../features/analytics/components/TimeAnalysis';
import PsychologyAnalysis from '../../features/analytics/components/PsychologyAnalysis';
import MarketContextAnalysis from '../../features/analytics/components/MarketContextAnalysis';
import LossAnalysis from '../../features/analytics/components/LossAnalysis';
import { Routes, Route, Navigate } from 'react-router-dom';

const Analytics = () => {
    const [trades, setTrades] = useState<Trade[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchTrades = async () => {
            try {
                setIsLoading(true);
                const fetchedTrades = await metricsService.fetchTrades();
                setTrades(fetchedTrades);
            } catch (error) {
                console.error('Error fetching trades:', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchTrades();
    }, []);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="flex flex-col items-center gap-4">
                    <span className="loading loading-spinner loading-lg"></span>
                    <p className="text-base-content/60">Loading analytics data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4">
            <TitleCard title="Trading Analytics Dashboard" topMargin="mt-2">
                <AnalyticsNav />
                <Routes>
                    <Route path="/" element={<Navigate to="/analytics/risk" replace />} />
                    <Route path="/risk" element={<RiskAnalysis trades={trades} />} />
                    <Route path="/strategy" element={<StrategyAnalysis trades={trades} />} />
                    <Route path="/time" element={<TimeAnalysis trades={trades} />} />
                    <Route path="/psychology" element={<PsychologyAnalysis trades={trades} />} />
                    <Route path="/market" element={<MarketContextAnalysis trades={trades} />} />
                    <Route path="/loss" element={<LossAnalysis trades={trades} />} />
                </Routes>
            </TitleCard>
        </div>
    );
};

export default Analytics;
