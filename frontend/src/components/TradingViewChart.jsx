import React, { useEffect, useRef, memo } from 'react';

function TradingViewChart({ symbol, theme = "light", containerId = "tradingview_chart" }) {
  const container = useRef();

  useEffect(() => {
    // Clean up previous chart if any
    if (container.current) {
      container.current.innerHTML = '';
    }

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      "autosize": true,
      "symbol": symbol,
      "interval": "1",
      "timezone": "Asia/Kolkata",
      "theme": theme,
      "style": "1",
      "locale": "in",
      "enable_publishing": false,
      "hide_top_toolbar": false,
      "allow_symbol_change": true,
      "save_image": false,
      "container_id": containerId,
      "hide_volume": false,
      "support_host": "https://www.tradingview.com"
    });

    container.current.appendChild(script);

    return () => {
      if (container.current) {
        container.current.innerHTML = '';
      }
    };
  }, [symbol, theme, containerId]);

  return (
    <div className="tradingview-chart-container">
      <div 
        id={containerId}
        ref={container} 
        style={{ height: "600px", width: "100%" }}
      />
    </div>
  );
}

export default memo(TradingViewChart);