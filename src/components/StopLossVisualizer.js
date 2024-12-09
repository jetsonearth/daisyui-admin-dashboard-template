import React from 'react'

const StopLossVisualizer = ({ 
    currentPrice, 
    stop33, 
    stop66, 
    fullStop,
    target2R,
    target3R,
    direction = 'LONG'
}) => {
    // Guard against invalid inputs
    if (!currentPrice || currentPrice <= 0) return null

    // Ensure all values are numbers and positive
    const safeCurrentPrice = Math.max(0.01, parseFloat(currentPrice) || 0)
    const safeStop33 = Math.max(0.01, parseFloat(stop33) || 0)
    const safeStop66 = Math.max(0.01, parseFloat(stop66) || 0)
    const safeFullStop = Math.max(0.01, parseFloat(fullStop) || 0)
    const safeTarget2R = Math.max(safeCurrentPrice, parseFloat(target2R) || 0)
    const safeTarget3R = Math.max(safeTarget2R, parseFloat(target3R) || 0)
    
    // Calculate price range for visualization
    const priceRange = direction === 'LONG' 
        ? Math.max(safeTarget3R - safeFullStop, safeCurrentPrice - safeFullStop, 0.01) 
        : Math.max(safeFullStop - safeTarget3R, safeFullStop - safeCurrentPrice, 0.01)
    
    // Calculate percentages for positioning
    const getPosition = (price) => {
        if (direction === 'LONG') {
            return Math.min(100, Math.max(0, ((price - safeFullStop) / priceRange) * 100))
        } else {
            return Math.min(100, Math.max(0, ((safeFullStop - price) / priceRange) * 100))
        }
    }

    const currentPos = getPosition(safeCurrentPrice)
    const stop33Pos = getPosition(safeStop33)
    const stop66Pos = getPosition(safeStop66)
    const target2RPos = getPosition(safeTarget2R)
    const target3RPos = getPosition(safeTarget3R)

    return (
        <div className="w-full p-4">
            <div className="relative h-24 bg-base-200 rounded-lg overflow-hidden">
                {/* Price gradient background */}
                <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 via-yellow-500/20 to-green-500/20" />
                
                {/* Stop loss zones */}
                <div className="absolute inset-y-0 left-0" style={{ width: `${stop33Pos}%`, backgroundColor: 'rgba(239, 68, 68, 0.2)' }} />
                <div className="absolute inset-y-0" style={{ left: `${stop33Pos}%`, width: `${stop66Pos - stop33Pos}%`, backgroundColor: 'rgba(234, 179, 8, 0.2)' }} />
                <div className="absolute inset-y-0" style={{ left: `${stop66Pos}%`, width: `${currentPos - stop66Pos}%`, backgroundColor: 'rgba(34, 197, 94, 0.2)' }} />

                {/* Price markers */}
                <div className="absolute inset-0">
                    {/* Full stop */}
                    <div className="absolute top-0 bottom-0 border-l-2 border-red-500" style={{ left: '0%' }}>
                        <div className="absolute -top-6 -left-10 text-xs text-red-500">${safeFullStop.toFixed(2)}</div>
                    </div>

                    {/* 33% stop */}
                    <div className="absolute top-0 bottom-0 border-l-2 border-orange-500" style={{ left: `${stop33Pos}%` }}>
                        <div className="absolute -top-6 -left-10 text-xs text-orange-500">${safeStop33.toFixed(2)}</div>
                    </div>

                    {/* 66% stop */}
                    <div className="absolute top-0 bottom-0 border-l-2 border-yellow-500" style={{ left: `${stop66Pos}%` }}>
                        <div className="absolute -top-6 -left-10 text-xs text-yellow-500">${safeStop66.toFixed(2)}</div>
                    </div>

                    {/* Current price */}
                    <div className="absolute top-0 bottom-0 border-l-2 border-blue-500" style={{ left: `${currentPos}%` }}>
                        <div className="absolute -top-6 -left-10 text-xs text-blue-500">${safeCurrentPrice.toFixed(2)}</div>
                    </div>

                    {/* Target 2R */}
                    <div className="absolute top-0 bottom-0 border-l-2 border-green-500" style={{ left: `${target2RPos}%` }}>
                        <div className="absolute -top-6 -left-10 text-xs text-green-500">${safeTarget2R.toFixed(2)}</div>
                    </div>

                    {/* Target 3R */}
                    <div className="absolute top-0 bottom-0 border-l-2 border-emerald-500" style={{ left: `${target3RPos}%` }}>
                        <div className="absolute -top-6 -left-10 text-xs text-emerald-500">${safeTarget3R.toFixed(2)}</div>
                    </div>
                </div>

                {/* Labels */}
                <div className="absolute bottom-0 left-0 right-0 flex justify-between px-4 text-xs text-gray-500">
                    <span>Full Stop</span>
                    <span>33% Stop</span>
                    <span>66% Stop</span>
                    <span>Current</span>
                    <span>2R Target</span>
                    <span>3R Target</span>
                </div>
            </div>
        </div>
    )
}

export default StopLossVisualizer
