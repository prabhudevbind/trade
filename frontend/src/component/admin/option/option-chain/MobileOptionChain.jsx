import { Badge } from "@/components/ui/badge";

export function MobileOptionChain({ data, onOptionClick, formatPrice, formatOI, atmStrike }) {
  return (
    <div className="md:hidden">
      {data?.option_chain?.map((strikeData, index) => {
        const isATM = strikeData.strike_price === atmStrike;
        
        return (
          <div 
            key={index}
            className={`grid grid-cols-4 text-xs border-b py-2 px-2 ${
              isATM ? "bg-yellow-50 dark:bg-yellow-900/20" : ""
            }`}
          >
            {/* Call Side */}
            <div
              className="text-center cursor-pointer hover:bg-muted p-1 rounded"
              onClick={() => onOptionClick(strikeData, "call")}
            >
              <div className="font-semibold">
                {formatPrice(strikeData.call_option?.ltp || 0)}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatOI(strikeData.call_option?.oi_lots || 0)}
              </div>
            </div>

            {/* Strike Price */}
            <div className="text-center col-span-2">
              <Badge
                variant={isATM ? "default" : "outline"}
                className="text-xs whitespace-nowrap"
              >
                {strikeData.strike_price.toLocaleString()}
              </Badge>
            </div>

            {/* Put Side */}
            <div
              className="text-center cursor-pointer hover:bg-muted p-1 rounded"
              onClick={() => onOptionClick(strikeData, "put")}
            >
              <div className="font-semibold">
                {formatPrice(strikeData.put_option?.ltp || 0)}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatOI(strikeData.put_option?.oi_lots || 0)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}