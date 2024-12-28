// TradingViewWidget.jsx
import React, { useEffect, useRef, memo } from 'react';

const TradingViewWidget = memo(({ symbol = 'NASDAQ:AAPL', studies = [] }) => {
    const container = useRef();

    useEffect(() => {
        const script = document.createElement("script");
        script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
        script.type = "text/javascript";
        script.async = true;
        script.innerHTML = `
            {
                "autosize": true,
                "symbol": "${symbol}",
                "interval": "D",
                "timezone": "Asia/Singapore",
                "theme": "dark",
                "style": "1",
                "locale": "en",
                "enable_publishing": true,
                "hide_top_toolbar": false,
                "hide_legend": false,
                "save_image": true,
                "calendar": true,
                "studies": ${JSON.stringify(studies)},
                "support_host": "https://www.tradingview.com"
            }
        `;

        if (container.current) {
            container.current.innerHTML = '';
            container.current.appendChild(script);
        }

        return () => {
            if (container.current) {
                container.current.innerHTML = '';
            }
        };
    }, [symbol, JSON.stringify(studies)]);

    return (
        <div className="tradingview-widget-container h-full" ref={container}>
            <div className="tradingview-widget-container__widget h-full"></div>
        </div>
    );
});

TradingViewWidget.displayName = 'TradingViewWidget';

export default TradingViewWidget;