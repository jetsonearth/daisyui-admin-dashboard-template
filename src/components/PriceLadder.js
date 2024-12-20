import React from 'react'

function PriceLadder({ 
    currentPrice = 0, 
    fullStop = 0, 
    stop33 = 0, 
    stop66 = 0, 
    target2R = 0,
    target3R = 0,
    showLegend = true
}) {
    // Calculate the range to show
    const priceRange = Math.max(target3R - fullStop, 0.01) // Prevent zero or negative range
    const numSteps = 20 // Number of price levels to show
    const stepSize = priceRange / numSteps

    // Generate price levels
    const priceLevels = Array.from({ length: numSteps + 1 }, (_, i) => {
        return fullStop + (stepSize * i)
    })

    // Helper function to get relative position
    const getRelativePosition = (price) => {
        return ((price - fullStop) / priceRange) * 100
    }

    // Helper function to format price
    const formatPrice = (price) => {
        return price ? price.toFixed(2) : 'N/A' // Handle undefined prices
    }

    return (
        <div className="relative h-96 w-full bg-base-200 rounded-lg p-4">
            {/* Price levels */}
            <div className="absolute left-0 top-0 bottom-0 w-20 border-r border-base-300">
                {priceLevels.map((price, index) => (
                    <div 
                        key={index}
                        className="text-sm text-gray-500"
                        style={{ 
                            position: 'absolute',
                            bottom: `${(index / numSteps) * 100}%`,
                            left: 0,
                            right: 0,
                            borderBottom: '1px dashed rgba(255,255,255,0.1)',
                            paddingLeft: '4px'
                        }}
                    >
                        ${formatPrice(price)}
                    </div>
                ))}
            </div>

            {/* Price markers */}
            <div className="absolute left-20 right-4 top-0 bottom-0">
                {/* Full Stop */}
                <div 
                    className="absolute left-0 right-0 h-6 -ml-2 flex items-center"
                    style={{ bottom: '0%' }}
                >
                    <div className="bg-red-500 text-white text-sm px-2 py-1 rounded">
                        Full Stop ${formatPrice(fullStop)}
                    </div>
                    <div className="flex-1 border-t border-red-500 border-dashed"></div>
                </div>

                {/* 66% Stop */}
                {stop66 > 0 && (
                    <div 
                        className="absolute left-0 right-0 h-6 -ml-2 flex items-center"
                        style={{ bottom: `${getRelativePosition(stop66)}%` }}
                    >
                        <div className="bg-orange-500 text-white text-sm px-2 py-1 rounded">
                            66% ${formatPrice(stop66)}
                        </div>
                        <div className="flex-1 border-t border-orange-500 border-dashed"></div>
                    </div>
                )}

                {/* 33% Stop */}
                {stop33 > 0 && (
                    <div 
                        className="absolute left-0 right-0 h-6 -ml-2 flex items-center"
                        style={{ bottom: `${getRelativePosition(stop33)}%` }}
                    >
                        <div className="bg-yellow-500 text-white text-sm px-2 py-1 rounded">
                            33% ${formatPrice(stop33)}
                        </div>
                        <div className="flex-1 border-t border-yellow-500 border-dashed"></div>
                    </div>
                )}

                {/* Entry */}
                <div 
                    className="absolute left-0 right-0 h-6 -ml-2 flex items-center"
                    style={{ bottom: `${getRelativePosition(currentPrice)}%` }}
                >
                    <div className="bg-blue-500 text-white text-sm px-2 py-1 rounded">
                        Entry ${formatPrice(currentPrice)}
                    </div>
                    <div className="flex-1 border-t border-blue-500"></div>
                </div>

                {/* 2R Target */}
                <div 
                    className="absolute left-0 right-0 h-6 -ml-2 flex items-center"
                    style={{ bottom: `${getRelativePosition(target2R)}%` }}
                >
                    <div className="bg-green-500 text-white text-sm px-2 py-1 rounded">
                        2R ${formatPrice(target2R)}
                    </div>
                    <div className="flex-1 border-t border-green-500 border-dashed"></div>
                </div>

                {/* 3R Target */}
                <div 
                    className="absolute left-0 right-0 h-6 -ml-2 flex items-center"
                    style={{ bottom: `${getRelativePosition(target3R)}%` }}
                >
                    <div className="bg-green-600 text-white text-sm px-2 py-1 rounded">
                        3R ${formatPrice(target3R)}
                    </div>
                    <div className="flex-1 border-t border-green-600 border-dashed"></div>
                </div>
            </div>

            {/* Position Distribution */}
            {showLegend && (
                <div className="absolute right-4 top-4 bg-base-300 p-3 rounded">
                    <div className="text-xs mb-2">Position Distribution</div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-red-500 rounded"></div>
                            <div className="text-xs">33% to Full Stop</div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-orange-500 rounded"></div>
                            <div className="text-xs">33% to 66% Stop</div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                            <div className="text-xs">33% to 33% Stop</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default PriceLadder
