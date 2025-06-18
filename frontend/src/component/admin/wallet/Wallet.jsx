"use client"

import { useState, useEffect } from "react"
import { useGetWalletTransactionsQuery, useCreateWalletTransactionMutation } from "@/store/api/contest"
import { useGetUserByIdQuery } from "@/store/api/userSliceApi"
import { toast } from "react-toastify"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Loader2,
  RefreshCw,
  WalletIcon,
  QrCode,
  Smartphone,
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency, formatDate } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

function PaymentDialog({ isOpen, onClose, amount, onPaymentComplete }) {
  const [paymentMethod, setPaymentMethod] = useState("paytm")
  const [paymentStatus, setPaymentStatus] = useState("pending")
  const [showQR, setShowQR] = useState(false)
  const [currentTransactionId, setCurrentTransactionId] = useState("")

  // Generate transaction ID when dialog opens
  useEffect(() => {
    if (isOpen) {
      setCurrentTransactionId(`TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
    }
  }, [isOpen])

  const handlePaymentMethodChange = (value) => {
    setPaymentMethod(value)
    setShowQR(value === "qr")
  }

  const handlePayNow = () => {
    let deepLink = "";
    
    switch(paymentMethod) {
      case "paytm":
        deepLink = `paytmmp://pay?pa=7302597556@ibl&pn=Fantasy Trading&am=${amount}&tn=${currentTransactionId}`
        break;
      case "phonepe":
        deepLink = `phonepe://pay?pa=7302597556@ibl&pn=Fantasy Trading&am=${amount}&tn=${currentTransactionId}`
        break;
      case "gpay":
        deepLink = `tez://upi/pay?pa=7302597556@ibl&pn=Fantasy Trading&am=${amount}&tn=${currentTransactionId}`
        break;
      default:
        return;
    }

    if (!showQR) {
      window.location.href = deepLink;
    }
    setPaymentStatus("verifying")
  }

  const verifyPayment = () => {
    setPaymentStatus("completed")
    toast.success("Payment verified successfully!")
    onPaymentComplete(currentTransactionId)
    onClose()
  }

  const cancelPayment = () => {
    setPaymentStatus("pending")
    toast.error("Payment cancelled")
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Money to Wallet</DialogTitle>
          <DialogDescription>
            Choose your preferred payment method to add ₹{amount}
            <div className="mt-2 text-xs text-gray-500">
              Transaction ID: {currentTransactionId}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <RadioGroup
            defaultValue={paymentMethod}
            onValueChange={handlePaymentMethodChange}
            className="grid grid-cols-2 gap-4"
          >
            <div>
              <RadioGroupItem
                value="paytm"
                id="paytm"
                className="peer sr-only"
              />
              <Label
                htmlFor="paytm"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
              >
                <Smartphone className="mb-2 h-6 w-6" />
                PayTM
              </Label>
            </div>

            <div>
              <RadioGroupItem
                value="phonepe"
                id="phonepe"
                className="peer sr-only"
              />
              <Label
                htmlFor="phonepe"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
              >
                <Smartphone className="mb-2 h-6 w-6" />
                PhonePe
              </Label>
            </div>

            <div>
              <RadioGroupItem
                value="gpay"
                id="gpay"
                className="peer sr-only"
              />
              <Label
                htmlFor="gpay"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
              >
                <Smartphone className="mb-2 h-6 w-6" />
                Google Pay
              </Label>
            </div>

            <div>
              <RadioGroupItem
                value="qr"
                id="qr"
                className="peer sr-only"
              />
              <Label
                htmlFor="qr"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
              >
                <QrCode className="mb-2 h-6 w-6" />
                Scan QR
              </Label>
            </div>
          </RadioGroup>

          {showQR && (
            <div className="flex flex-col items-center space-y-4">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=upi://pay?pa=7302597556@ibl%26pn=Fantasy Trading%26am=${amount}%26tn=${currentTransactionId}`} 
                alt="Payment QR Code" 
                className="border p-2 rounded-lg"
              />
              <p className="text-sm text-gray-500">Scan with any UPI app</p>
              <p className="text-xs text-gray-400">Transaction ID: {currentTransactionId}</p>
            </div>
          )}

          {paymentStatus === "pending" ? (
            <Button onClick={handlePayNow} className="w-full">
              Pay Now ₹{amount}
            </Button>
          ) : paymentStatus === "verifying" ? (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Verify Payment</AlertTitle>
                <AlertDescription>
                  Did you complete the payment?
                </AlertDescription>
              </Alert>
              <div className="flex gap-4">
                <Button 
                  onClick={verifyPayment}
                  className="flex-1"
                  variant="default"
                >
                  Yes, Payment Done
                </Button>
                <Button 
                  onClick={cancelPayment}
                  className="flex-1"
                  variant="outline"
                >
                  No, Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function Wallet() {
  const [depositAmount, setDepositAmount] = useState("")
  const [depositError, setDepositError] = useState(null)
  const [depositSuccess, setDepositSuccess] = useState(null)
  const [isDepositing, setIsDepositing] = useState(false)
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)

  // Fetch user data
  const { data: user, isLoading: userLoading, error: userError, refetch: refetchUser } = useGetUserByIdQuery()
  const [createWalletTransaction] = useCreateWalletTransactionMutation()

  const handleDepositClick = () => {
    setDepositError(null)
    
    // Validate amount
    const amount = Number(depositAmount)
    if (!amount || amount <= 0) {
      setDepositError("Please enter a valid amount")
      return
    }
    
    if (amount < 1) {
      setDepositError("Minimum deposit amount is ₹1")
      return
    }
    
  

    // Show payment dialog
    setShowPaymentDialog(true)
  }

  const handlePaymentComplete = async (transactionId) => {
    try {
      setIsDepositing(true)
      
      // Create wallet transaction with UPI transaction ID
      await createWalletTransaction({
        amount: Number(depositAmount),
        type: 'CREDIT',
        status: 'COMPLETED',
        description: 'Wallet top up',
        transaction_id: transactionId,
        payment_method: 'UPI'
      }).unwrap()

      // Show success message with transaction ID
      setDepositSuccess(`Amount added to wallet successfully! (Transaction ID: ${transactionId})`)
      setDepositAmount("")
      
      // Refresh user data to show updated balance
      refetchUser()
      
    } catch (error) {
      setDepositError(error?.data?.message || "Failed to process payment")
    } finally {
      setIsDepositing(false)
      setShowPaymentDialog(false)
    }
  }

  return (
    <div className="container mx-auto p-6">
      <div className="grid gap-6">
        {/* Balance Card */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <WalletIcon className="h-5 w-5" />
              Your Wallet
            </CardTitle>
            <CardDescription>
              Add or withdraw money from your wallet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Balance Display */}
              <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Available Balance</p>
                  <p className="text-3xl font-semibold">
                    {userLoading ? (
                      <Skeleton className="h-9 w-24" />
                    ) : (
                      formatCurrency(user?.amount || 0)
                    )}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchUser()}
                  disabled={userLoading}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>

              {/* Deposit Form */}
              <div className="space-y-4">
                <Label htmlFor="amount">Deposit Amount</Label>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Input
                      id="amount"
                      type="number"
                      placeholder="Enter amount"
                      value={depositAmount}
                      onChange={(e) => {
                        setDepositAmount(e.target.value)
                        setDepositError(null)
                        setDepositSuccess(null)
                      }}
                      disabled={isDepositing}
                    />
                  </div>
                  <Button
                    onClick={handleDepositClick}
                    disabled={!depositAmount || isDepositing}
                  >
                    {isDepositing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <ArrowUpCircle className="mr-2 h-4 w-4" />
                        Deposit
                      </>
                    )}
                  </Button>
                </div>

                {depositError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{depositError}</AlertDescription>
                  </Alert>
                )}

                {depositSuccess && (
                  <Alert variant="success" className="bg-green-50 border-green-200">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      {depositSuccess}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Dialog */}
        <PaymentDialog
          isOpen={showPaymentDialog}
          onClose={() => setShowPaymentDialog(false)}
          amount={depositAmount}
          onPaymentComplete={handlePaymentComplete}
        />

        {/* Transaction History */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>Your recent wallet transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Transaction ID</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* ... rest of your transaction history UI ... */}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function TransactionTable({ transactions }) {
  if (transactions.length === 0) {
    return <div className="text-center py-4 text-muted-foreground">No transactions in this category.</div>
  }

  return (
    <div className="w-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Date</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead className="hidden sm:table-cell">Status</TableHead>
            <TableHead className="hidden lg:table-cell">Payment ID</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx) => (
            <TableRow key={tx.id}>
              <TableCell className="font-medium text-xs sm:text-sm">
                {formatDate(tx.created_at)}
              </TableCell>
              <TableCell>
                <Badge
                  variant={tx.type === "DEPOSIT" ? "success" : tx.type === "WITHDRAWAL" ? "destructive" : "secondary"}
                  className="text-xs whitespace-nowrap"
                >
                  <span className="flex items-center gap-1">
                    {tx.type === "DEPOSIT" && <ArrowDownCircle className="h-3 w-3 hidden sm:inline" />}
                    {tx.type}
                  </span>
                </Badge>
              </TableCell>
              <TableCell className={`font-medium text-xs sm:text-sm ${
                tx.type === "DEPOSIT" || tx.type === "CREDIT" ? "text-green-600" : "text-red-600"
              }`}>
                {tx.type === "DEPOSIT" || tx.type === "CREDIT" ? "+" : "-"}
                {formatCurrency(tx.amount)}
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Badge variant="outline" className="text-xs">
                  {tx.status}
                </Badge>
              </TableCell>
              <TableCell className="hidden lg:table-cell text-xs truncate max-w-[150px]">
                {tx.razorpay_payment_id || "N/A"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
