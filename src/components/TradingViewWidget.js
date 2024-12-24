// TradingViewWidget.jsx
import React, { useEffect, useRef, memo } from 'react';

function TradingViewWidget({ symbol = 'NASDAQ:AAPL' }) { // Add default value
    const container = useRef();

    useEffect(() => {
        // Debug log
        console.log('TradingView Widget Symbol:', symbol);

        // Clean up previous widget
        if (container.current) {
            container.current.innerHTML = '';
        }

        // Only create widget if we have a valid symbol and it's not empty
        if (symbol && symbol.trim() !== '') {
            const formattedSymbol = symbol.includes(':') ? symbol : `NASDAQ:${symbol}`;
            
            const script = document.createElement("script");
            script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
            script.type = "text/javascript";
            script.async = true;
            script.innerHTML = `
                {
                    "autosize": true,
                    "symbol": "${formattedSymbol}",
                    "interval": "D",
                    "timezone": "Etc/UTC",
                    "theme": "dark",
                    "style": "1",
                    "locale": "en",
                    "allow_symbol_change": true,
                    "details": true,
                    "calendar": false,
                    "studies": [
                        "STD;Average_True_Range",
                        "STD;EMA"
                    ],
                    "support_host": "https://www.tradingview.com"
                }`;
            container.current.appendChild(script);
        } else {
            console.warn('No valid symbol provided to TradingViewWidget');
        }

        return () => {
            if (container.current) {
                container.current.innerHTML = '';
            }
        };
    }, [symbol]);

    return (
        <div className="tradingview-widget-container" ref={container} style={{ height: "100%", width: "100%" }}>
            {!symbol && (
                <div className="flex items-center justify-center h-full text-gray-400">
                    Please enter a valid trading symbol
                </div>
            )}
            <div className="tradingview-widget-container__widget" style={{ height: "calc(100% - 32px)", width: "100%" }}></div>
            <div className="tradingview-widget-copyright">
                <a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank">
                    <span className="blue-text">Track all markets on TradingView</span>
                </a>
            </div>
        </div>
    );
}

export default memo(TradingViewWidget);