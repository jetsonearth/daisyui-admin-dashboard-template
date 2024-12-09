import { TRADE_STATUS } from '../trades/tradeModel'

// Validate trades input
const validateTrades = (trades) => {
    if (!Array.isArray(trades)) {
        console.warn('Invalid trades input: expected an array')
        return []
    }
    return trades
}

// Helper function to safely get numeric value
const safeNumeric = (value, defaultValue = 0) => 
    typeof value === 'number' && !isNaN(value) ? value : defaultValue

// Calculate trade performance metrics with enhanced error handling
const calculateTradePerformanceMetrics = (trades) => {
    trades = validateTrades(trades)
    const closedTrades = trades.filter(trade => trade.status === TRADE_STATUS.CLOSED)
    const openTrades = trades.filter(trade => trade.status === TRADE_STATUS.OPEN)

    // Gross Profits and Losses with safe numeric conversion
    const totalGrossProfits = closedTrades
        .filter(trade => safeNumeric(trade.realized_pnl) > 0)
        .reduce((sum, trade) => sum + safeNumeric(trade.realized_pnl), 0)

    const totalGrossLosses = Math.abs(closedTrades
        .filter(trade => safeNumeric(trade.realized_pnl) <= 0)
        .reduce((sum, trade) => sum + safeNumeric(trade.realized_pnl), 0))

    // Win Rate
    const totalTrades = closedTrades.length
    const winningTrades = closedTrades.filter(trade => safeNumeric(trade.realized_pnl) > 0)
    const winRate = totalTrades > 0 
        ? Math.round((winningTrades.length / totalTrades) * 100) 
        : 0

    // Average Win and Loss with safe calculations
    const avgWin = winningTrades.length > 0
        ? totalGrossProfits / winningTrades.length
        : 0

    const losingTrades = closedTrades.filter(trade => safeNumeric(trade.realized_pnl) <= 0)
    const avgLoss = losingTrades.length > 0
        ? totalGrossLosses / losingTrades.length
        : 0

    // Profit Factor with division by zero protection
    const profitFactor = totalGrossLosses !== 0
        ? Number((totalGrossProfits / totalGrossLosses).toFixed(1))
        : 0

    // Risk Reward Ratio
    const rrr = avgLoss !== 0 
        ? Number((avgWin / avgLoss).toFixed(1))
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

// Calculate Current Capital with enhanced safety
const calculateCurrentCapital = (trades, startingCapital = 50000) => {
    trades = validateTrades(trades)
    const totalRealizedPnL = trades
        .filter(trade => trade.status === TRADE_STATUS.CLOSED)
        .reduce((sum, trade) => sum + safeNumeric(trade.realized_pnl), 0)

    const totalUnrealizedPnL = trades
        .filter(trade => trade.status === TRADE_STATUS.OPEN)
        .reduce((sum, trade) => sum + safeNumeric(trade.unrealized_pnl), 0)

    return startingCapital + totalRealizedPnL + totalUnrealizedPnL
}

// Calculate Current Streak with more robust tracking
const calculateCurrentStreak = (trades) => {
    trades = validateTrades(trades)
    const closedTrades = trades
        .filter(trade => trade.status === TRADE_STATUS.CLOSED)
        .sort((a, b) => new Date(b.exit_date) - new Date(a.exit_date))

    let currentStreak = 0
    let streakType = null

    for (const trade of closedTrades) {
        const isWinningTrade = safeNumeric(trade.realized_pnl) > 0

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

// Exposure Metrics with improved error handling
const calculateExposureMetrics = (trades, accountValue = 50000) => {
    trades = validateTrades(trades)
    const todayTrades = trades.filter(trade => 
        trade.status === TRADE_STATUS.OPEN && 
        new Date(trade.entry_date).toDateString() === new Date().toDateString()
    )

    // Daily Exposure Risk (DER)
    const dailyExposureRisk = todayTrades.reduce((sum, trade) => {
        const riskPerTrade = Math.abs(
            safeNumeric(trade.entry_price) - safeNumeric(trade.stop_loss)
        ) * safeNumeric(trade.shares)
        return sum + riskPerTrade
    }, 0) / accountValue * 100

    // Daily Exposure Profit (DEP)
    const dailyExposureProfit = todayTrades.reduce((sum, trade) => {
        const profitPerTrade = (
            safeNumeric(trade.current_price) - safeNumeric(trade.entry_price)
        ) * safeNumeric(trade.shares)
        return sum + profitPerTrade
    }, 0) / accountValue * 100

    // New Exposure Metrics
    const newExposureTrades = trades.filter(trade => 
        trade.status === TRADE_STATUS.OPEN && 
        safeNumeric(trade.realized_pnl) < safeNumeric(trade.risk_per_trade)
    )

    const newExposureRisk = newExposureTrades.reduce((sum, trade) => {
        const riskPerTrade = Math.abs(
            safeNumeric(trade.entry_price) - safeNumeric(trade.stop_loss)
        ) * safeNumeric(trade.shares)
        return sum + riskPerTrade
    }, 0) / accountValue * 100

    const newExposureProfit = newExposureTrades.reduce((sum, trade) => {
        const profitPerTrade = (
            safeNumeric(trade.current_price) - safeNumeric(trade.entry_price)
        ) * safeNumeric(trade.shares)
        return sum + profitPerTrade
    }, 0) / accountValue * 100

    // Open Exposure Metrics
    const openTrades = trades.filter(trade => trade.status === TRADE_STATUS.OPEN)

    const openExposureRisk = openTrades.reduce((sum, trade) => {
        const stop33 = safeNumeric(trade.entry_price) + 
            (safeNumeric(trade.entry_price) - safeNumeric(trade.stop_loss)) * 0.33
        const stop66 = safeNumeric(trade.entry_price) + 
            (safeNumeric(trade.entry_price) - safeNumeric(trade.stop_loss)) * 0.66
        
        const risk33 = Math.abs(
            safeNumeric(trade.current_price) - stop33
        ) * (safeNumeric(trade.shares) / 3)
        const risk66 = Math.abs(
            safeNumeric(trade.current_price) - stop66
        ) * (safeNumeric(trade.shares) / 3)
        const riskInitial = Math.abs(
            safeNumeric(trade.current_price) - safeNumeric(trade.stop_loss)
        ) * (safeNumeric(trade.shares) / 3)
        
        return sum + (risk33 + risk66 + riskInitial)
    }, 0) / accountValue * 100

    const openExposureProfit = openTrades.reduce((sum, trade) => {
        const profitPerTrade = (
            safeNumeric(trade.current_price) - safeNumeric(trade.entry_price)
        ) * safeNumeric(trade.shares)
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

// Periodic Returns with improved implementation
const calculatePeriodicReturns = (trades, accountValue) => {
    trades = validateTrades(trades)
    
    return {
        // Periodic Returns (placeholders for now)
        weeklyReturn: 0,
        monthlyReturn: 0,
        quarterlyReturn: 0,
        yearlyReturn: 0,

        // Average Returns (placeholders)
        averageWeeklyReturn: 0,
        averageMonthlyReturn: 0,
        averageQuarterlyReturn: 0,
        averageYearlyReturn: 0,

        // Portfolio Exposure
        totalExposure: trades
            .filter(trade => trade.status === TRADE_STATUS.OPEN)
            .reduce((sum, trade) => sum + safeNumeric(trade.position_size), 0) / accountValue * 100
    }
}

// Drawdown calculation with enhanced error handling
const calculateDrawdownAndRunup = (trades, startingCapital) => {
    trades = validateTrades(trades)
    
    // Cumulative PnL calculation with safe numeric conversion
    const cumulativePnL = trades.reduce((acc, trade) => {
        const lastBalance = acc.length > 0 ? acc[acc.length - 1] : startingCapital
        const tradePnL = safeNumeric(trade.realized_pnl)
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
        maxDrawdown: Number(maxDrawdown.toFixed(2)),
        maxRunup: Number(maxRunup.toFixed(2))
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