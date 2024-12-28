import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTradeMetrics } from '../../features/metrics/metricsService';
import { ScatterChart } from '@tremor/react';
import { Card, Title, Text } from '@tremor/react';

const RiskAnalysis = () => {
  const { data: tradeMetrics } = useQuery(['tradeMetrics'], fetchTradeMetrics);

  // Transform data for the scatter plot
  const transformedData = tradeMetrics?.trades?.map(trade => ({
    mae: trade.mae,
    outcome: trade.pnl,
    ticker: trade.ticker,
    exitDate: new Date(trade.exitTime).toLocaleDateString(),
    strategy: trade.strategy || 'Unknown',
    // Color based on outcome
    group: trade.pnl > 0 ? 'Winning Trades' : 'Losing Trades'
  })) || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Risk Analysis</h1>
          <p className="text-gray-400">Comprehensive analysis of trading risks and outcomes</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 bg-gray-800 border border-gray-700">
          <Title className="text-white mb-4">MAE vs Trade Outcome</Title>
          <Text className="text-gray-400 mb-6">
            Scatter plot showing the relationship between Maximum Adverse Excursion (MAE) and final trade outcome. 
            Green dots represent winning trades, red dots represent losing trades.
          </Text>
          <div className="h-[400px]"> {/* Increased height */}
            <ScatterChart
              className="h-full"
              data={transformedData}
              category="group"
              x="mae"
              y="outcome"
              size="outcome"
              colors={["emerald", "red"]}
              showLegend={true}
              minXValue={0}
              maxXValue={Math.max(...transformedData.map(d => d.mae || 0)) * 1.1}
              minYValue={Math.min(...transformedData.map(d => d.outcome || 0)) * 1.1}
              maxYValue={Math.max(...transformedData.map(d => d.outcome || 0)) * 1.1}
              valueFormatter={{
                x: (x) => `${x.toFixed(2)}R`,
                y: (y) => `${y.toFixed(2)}R`,
              }}
              onValueChange={(v) => {
                if (v) {
                  console.log(`Ticker: ${v.ticker}, Exit Date: ${v.exitDate}, Strategy: ${v.strategy}`);
                }
              }}
              customTooltip={(v) => (
                <div className="p-2 bg-gray-900 border border-gray-700 rounded-lg shadow-lg">
                  <div className="text-white font-semibold">{v.ticker}</div>
                  <div className="text-gray-400">Exit Date: {v.exitDate}</div>
                  <div className="text-gray-400">Strategy: {v.strategy}</div>
                  <div className="text-gray-400">MAE: {v.x.toFixed(2)}R</div>
                  <div className="text-gray-400">Outcome: {v.y.toFixed(2)}R</div>
                </div>
              )}
            />
          </div>
        </Card>

        {/* Additional risk metrics will go here */}
      </div>
    </div>
  );
};

export default RiskAnalysis;
