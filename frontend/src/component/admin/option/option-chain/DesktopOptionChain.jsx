import { Badge } from "@/components/ui/badge";

export function DesktopOptionChain({ 
  data, 
  onOptionClick, 
  formatPrice, 
  formatOI, 
  atmStrike,
  calculatePriceChange 
}) {
  return (
    <div className="hidden md:block">
      <div className="grid grid-cols-9 text-xs font-medium text-muted-foreground py-3 px-2 border-b">
        <div className="text-center">Call OI</div>
        <div className="text-center">Call Change</div>
        <div className="text-center">Call LTP</div>
        <div className="text-center">Call IV</div>
        <div className="text-center font-bold">STRIKE</div>
        <div className="text-center">Put IV</div>
        <div className="text-center">Put LTP</div>
        <div className="text-center">Put Change</div>
        <div className="text-center">Put OI</div>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {data?.option_chain?.map((strikeData, index) => {
          const isATM = strikeData.strike_price === atmStrike;
          const callChange = calculatePriceChange(
            strikeData.call_option?.ltp,
            strikeData.call_option?.close_price
          );
          const putChange = calculatePriceChange(
            strikeData.put_option?.ltp,
            strikeData.put_option?.close_price
          );

          return (
            <div
              key={index}
              className={`grid grid-cols-9 text-xs border-b py-2 px-2 ${
                isATM ? "bg-yellow-50 dark:bg-yellow-900/20" : ""
              }`}
            >
              <div className="text-center">
                {formatOI(strikeData.call_option?.oi_lots || 0)}
              </div>
              <div className="text-center">
                <PriceChange change={callChange} />
              </div>
              <div
                className="text-center cursor-pointer hover:bg-muted p-1 rounded"
                onClick={() => onOptionClick(strikeData, "call")}
              >
                <div className="font-semibold">
                  {formatPrice(strikeData.call_option?.ltp || 0)}
                </div>
              </div>
              <div className="text-center">
                <GreeksInfo data={strikeData.call_option?.greeks} />
              </div>
              <div className="text-center">
                <Badge
                  variant={isATM ? "default" : "outline"}
                  className="text-xs whitespace-nowrap"
                >
                  {strikeData.strike_price.toLocaleString()}
                </Badge>
              </div>
              <div className="text-center">
                <GreeksInfo data={strikeData.put_option?.greeks} />
              </div>
              <div
                className="text-center cursor-pointer hover:bg-muted p-1 rounded"
                onClick={() => onOptionClick(strikeData, "put")}
              >
                <div className="font-semibold">
                  {formatPrice(strikeData.put_option?.ltp || 0)}
                </div>
              </div>
              <div className="text-center">
                <PriceChange change={putChange} />
              </div>
              <div className="text-center">
                {formatOI(strikeData.put_option?.oi_lots || 0)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Helper Components
function PriceChange({ change }) {
  return (
    <>
      <div className={`font-medium ${change.change > 0 ? "text-green-500" : "text-red-500"}`}>
        {change.change > 0 ? "+" : ""}{change.change}
      </div>
      <div className={`text-xs ${change.changePercent > 0 ? "text-green-500" : "text-red-500"}`}>
        ({change.changePercent}%)
      </div>
    </>
  );
}

function GreeksInfo({ data }) {
  return (
    <>
      <div className="font-medium">
        {(data?.iv || 0).toFixed(1)}%
      </div>
      <div className="text-xs text-muted-foreground">
        Δ: {(data?.delta || 0).toFixed(2)}
      </div>
    </>
  );
}