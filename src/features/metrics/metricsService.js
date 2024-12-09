import { TRADE_STATUS } from '../trades/tradeModel'

// Helper function to calculate trade performance metrics
const calculateTradePerformanceMetrics = (trades) => {
    const closedTrades = trades.filter(trade => trade.status === TRADE_STATUS.CLOSED)
    const openTrades = trades.filter(trade => trade.status === TRADE_STATUS.OPEN)

    // Gross Profits and Losses
    const totalGrossProfits = closedTrades
        .filter(trade => trade.realized_pnl > 0)
        .reduce((sum, trade) => sum + trade.realized_pnl, 0)

    const totalGrossLosses = Math.abs(closedTrades
        .filter(trade => trade.realized_pnl <= 0)
        .reduce((sum, trade) => sum + trade.realized_pnl, 0))

    // Win Rate
    const totalTrades = closedTrades.length
    const winningTrades = closedTrades.filter(trade => trade.realized_pnl > 0)
    const winRate = totalTrades > 0 
        ? Math.round((winningTrades.length / totalTrades) * 100) 
        : 0

    // Average Win and Loss
    const avgWin = winningTrades.length > 0
        ? totalGrossProfits / winningTrades.length
        : 0

    const losingTrades = closedTrades.filter(trade => trade.realized_pnl <= 0)
    const avgLoss = losingTrades.length > 0
        ? totalGrossLosses / losingTrades.length
        : 0

    // Profit Factor
    const profitFactor = totalGrossLosses !== 0
        ? Math.round((totalGrossProfits / totalGrossLosses) * 10) / 10
        : 0

    // Risk Reward Ratio
    const rrr = avgLoss !== 0 
        ? Math.round((avgWin / avgLoss) * 10) / 10
        : 0

    return {
        totalGrossProfits,
        totalGrossLosses,
        winRate,
        avgWin,
        avgLoss,
        profitFactor,
        rrr
    }
}

// Calculate Current Capital
const calculateCurrentCapital = (trades, startingCapital = 50000) => {
    const totalRealizedPnL = trades
        .filter(trade => trade.status === TRADE_STATUS.CLOSED)
        .reduce((sum, trade) => sum + (trade.realized_pnl || 0), 0)

    const totalUnrealizedPnL = trades
        .filter(trade => trade.status === TRADE_STATUS.OPEN)
        .reduce((sum, trade) => sum + (trade.unrealized_pnl || 0), 0)

    return startingCapital + totalRealizedPnL + totalUnrealizedPnL
}

// Calculate Current Streak
const calculateCurrentStreak = (trades) => {
    const closedTrades = trades
        .filter(trade => trade.status === TRADE_STATUS.CLOSED)
        .sort((a, b) => new Date(b.exit_date) - new Date(a.exit_date))

    let currentStreak = 0
    let streakType = null

    for (const trade of closedTrades) {
        const isWinningTrade = trade.realized_pnl > 0

        if (streakType === null) {
            streakType = isWinningTrade
            currentStreak = 1
        } else if (isWinningTrade === streakType) {
            currentStreak++
        } else {
            break
        }
    }

    return {
        winCount: currentStreak > 0 && streakType === true ? currentStreak : 0,
        loseCount: currentStreak > 0 && streakType === false ? currentStreak : 0
    }
}

// Exposure Metrics Calculations
const calculateExposureMetrics = (trades, accountValue = 50000) => {
    const todayTrades = trades.filter(trade => 
        trade.status === TRADE_STATUS.OPEN && 
        new Date(trade.entry_date).toDateString() === new Date().toDateString()
    )

    // Daily Exposure Risk (DER)
    const dailyExposureRisk = todayTrades.reduce((sum, trade) => {
        const riskPerTrade = Math.abs(trade.entry_price - trade.stop_loss) * trade.shares
        return sum + riskPerTrade
    }, 0) / accountValue * 100

    // Daily Exposure Profit (DEP)
    const dailyExposureProfit = todayTrades.reduce((sum, trade) => {
        const profitPerTrade = (trade.current_price - trade.entry_price) * trade.shares
        return sum + profitPerTrade
    }, 0) / accountValue * 100

    // New Exposure Metrics
    const newExposureTrades = trades.filter(trade => 
        trade.status === TRADE_STATUS.OPEN && 
        trade.realized_pnl < trade.risk_per_trade
    )

    const newExposureRisk = newExposureTrades.reduce((sum, trade) => {
        const riskPerTrade = Math.abs(trade.entry_price - trade.stop_loss) * trade.shares
        return sum + riskPerTrade
    }, 0) / accountValue * 100

    const newExposureProfit = newExposureTrades.reduce((sum, trade) => {
        const profitPerTrade = (trade.current_price - trade.entry_price) * trade.shares
        return sum + profitPerTrade
    }, 0) / accountValue * 100

    // Open Exposure Metrics
    const openTrades = trades.filter(trade => trade.status === TRADE_STATUS.OPEN)

    const openExposureRisk = openTrades.reduce((sum, trade) => {
        const stop33 = trade.entry_price + (trade.entry_price - trade.stop_loss) * 0.33
        const stop66 = trade.entry_price + (trade.entry_price - trade.stop_loss) * 0.66
        
        const risk33 = Math.abs(trade.current_price - stop33) * (trade.shares / 3)
        const risk66 = Math.abs(trade.current_price - stop66) * (trade.shares / 3)
        const riskInitial = Math.abs(trade.current_price - trade.stop_loss) * (trade.shares / 3)
        
        return sum + (risk33 + risk66 + riskInitial)
    }, 0) / accountValue * 100

    const openExposureProfit = openTrades.reduce((sum, trade) => {
        const profitPerTrade = (trade.current_price - trade.entry_price) * trade.shares
        return sum + profitPerTrade
    }, 0) / accountValue * 100

    return {
        dailyExposure: {
            risk: dailyExposureRisk,
            profit: dailyExposureProfit,
            delta: dailyExposureProfit - dailyExposureRisk
        },
        newExposure: {
            risk: newExposureRisk,
            profit: newExposureProfit,
            delta: newExposureProfit - newExposureRisk
        },
        openExposure: {
            risk: openExposureRisk,
            profit: openExposureProfit,
            delta: openExposureProfit - openExposureRisk
        }
    }
}

const calculatePeriodicReturns = (trades, accountValue) => {
    // This would require historical account value tracking
    // For now, we'll create a placeholder implementation
    const currentDate = new Date()

    return {
        // Periodic Returns
        weeklyReturn: 0,  // (Current Week End Value - Previous Week End Value) / Previous Week End Value × 100
        monthlyReturn: 0, // (Current Month End Value - Previous Month End Value) / Previous Month End Value × 100
        quarterlyReturn: 0, // (Current Quarter End Value - Previous Quarter End Value) / Previous Quarter End Value × 100
        yearlyReturn: 0,  // (Current Year End Value - Previous Year End Value) / Previous Year End Value × 100

        // Average Returns
        averageWeeklyReturn: 0,
        averageMonthlyReturn: 0,
        averageQuarterlyReturn: 0,
        averageYearlyReturn: 0,

        // Portfolio Exposure
        totalExposure: openTrades.reduce((sum, trade) => sum + trade.position_size, 0) / accountValue * 100
    }
}

const calculateDrawdownAndRunup = (trades, startingCapital) => {
    // Cumulative PnL calculation
    const cumulativePnL = trades.reduce((acc, trade) => {
        const lastBalance = acc.length > 0 ? acc[acc.length - 1] : startingCapital
        const tradePnL = trade.realized_pnl || 0
        return [...acc, lastBalance + tradePnL]
    }, [])

    let maxDrawdown = 0
    let maxRunup = 0
    let peak = startingCapital
    let trough = startingCapital

    for (let balance of cumulativePnL) {
        // Maximum Drawdown Calculation
        if (balance > peak) {
            peak = balance
            trough = balance
        }
        
        if (balance < trough) {
            trough = balance
            const drawdown = (peak - trough) / peak * 100
            maxDrawdown = Math.max(maxDrawdown, drawdown)
        }

        // Maximum Run-up Calculation
        const runup = (balance - startingCapital) / startingCapital * 100
        maxRunup = Math.max(maxRunup, runup)
    }

    return {
        maxDrawdown,
        maxRunup
    }
}

export const calculatePortfolioMetrics = (trades = [], startingCapital = 50000) => {
    const performanceMetrics = calculateTradePerformanceMetrics(trades)
    const currentCapital = calculateCurrentCapital(trades, startingCapital)
    const currentStreak = calculateCurrentStreak(trades)
    const exposureMetrics = calculateExposureMetrics(trades, currentCapital)
    const periodicReturns = calculatePeriodicReturns(trades, currentCapital)
    const { maxDrawdown, maxRunup } = calculateDrawdownAndRunup(trades, startingCapital)

    return {
        // Performance Metrics
        currentCapital,
        ...performanceMetrics,
        ...currentStreak,

        // Exposure Metrics
        ...exposureMetrics,

        // Periodic Returns
        ...periodicReturns,

        // Drawdown Metrics
        maxDrawdown,
        maxRunup
    }
}