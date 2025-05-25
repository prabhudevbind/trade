"use client"

import  React from "react"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
// import { RadioGroup,  } from "@/components/ui/radio-group"
import { RadioGroup,RadioGroupItem } from "@/components/ui/radio-group"


export function AddTradeDialog({ open, onOpenChange, onAddTrade, currentPrice }) {
  const [tradeType, setTradeType] = useState("buy")
  const [price, setPrice] = useState(currentPrice.toString())
  const [quantity, setQuantity] = useState("")
  const [notes, setNotes] = useState("")

  const handleSubmit = (e) => {
    e.preventDefault()

    if (!price || !quantity) return

    const trade = {
      time: Math.floor(Date.now() / 1000),
      type: tradeType,
      price: Number.parseFloat(price),
      quantity: Number.parseInt(quantity),
      notes: notes || undefined,
    }

    onAddTrade(trade)
    onOpenChange(false)

    // Reset form
    setPrice(currentPrice.toString())
    setQuantity("")
    setNotes("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Trade Marker</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Trade Type</Label>
            <RadioGroup value={tradeType} onValueChange={(value) => setTradeType(value)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="buy" id="buy" />
                <Label htmlFor="buy" className="text-green-600">
                  Buy
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="sell" id="sell" />
                <Label htmlFor="sell" className="text-red-600">
                  Sell
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="price">Price (₹)</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Enter trade price"
              required
            />
          </div>

          <div>
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Enter quantity"
              required
            />
          </div>

          <div>
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this trade"
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              className={tradeType === "buy" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
            >
              Add {tradeType === "buy" ? "Buy" : "Sell"} Trade
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
