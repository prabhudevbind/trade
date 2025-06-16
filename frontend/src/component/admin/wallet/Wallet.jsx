"use client"

import { useState } from "react"
import { useGetWalletTransactionsQuery, useCreateWalletTransactionMutation } from "@/store/api/contest"
import { useGetUserByIdQuery } from "@/store/api/userSliceApi"
import axios from "axios"
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
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency,formatDate } from "@/lib/utils"


function loadScript(src) {
  return new Promise((resolve) => {
    const script = document.createElement("script")
    script.src = src
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

export default function Wallet() {
  const userId = 1 // Replace with actual user_id from auth context/store
  const [depositAmount, setDepositAmount] = useState("")
  const [depositError, setDepositError] = useState(null)
  const [depositSuccess, setDepositSuccess] = useState(null)
  const [isDepositing, setIsDepositing] = useState(false)

  // Fetch user data
  const { data: user, isLoading: userLoading, error: userError, refetch } = useGetUserByIdQuery(userId)

  // Fetch wallet transactions
  const {
    data: transactionsData,
    isLoading: transactionsLoading,
    error: transactionsError,
  } = useGetWalletTransactionsQuery(userId)

  // Deposit mutation
  const [createWalletTransaction] = useCreateWalletTransactionMutation()

  const displayRazorpay = async () => {
    setIsDepositing(true)
    setDepositError(null)
    setDepositSuccess(null)

    const amount = Number.parseFloat(depositAmount)
    if (isNaN(amount) || amount <= 0) {
      setDepositError("Please enter a valid amount")
      setIsDepositing(false)
      return
    }

    // Load Razorpay SDK
    const res = await loadScript("https://checkout.razorpay.com/v1/checkout.js")
    if (!res) {
      setDepositError("Razorpay SDK failed to load. Please check your internet connection.")
      setIsDepositing(false)
      return
    }

    try {
      // Create order via backend API
      const { data: order } = await axios.post("/api/v1/createOrder", {
        amount: amount,
        currency: "INR",
      })

      const options = {
        key: "rzp_test_4kJGZ6vUcstgUm",
        amount: order.amount,
        currency: order.currency,
        name: "Trading Platform",
        description: "Wallet Deposit",
        image: "https://example.com/your_logo",
        order_id: order.id,
        handler: async (response) => {
          try {
            // Record transaction in database
            await createWalletTransaction({
              user_id: userId,
              amount: amount,
              type: "DEPOSIT",
              status: "COMPLETED",
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            }).unwrap()

            setDepositSuccess("Funds added successfully!")
            setDepositAmount("")
            toast.success("Funds added to your wallet!")
            refetch() // Refresh user and transaction data
          } catch (err) {
            setDepositError(err?.data?.message || "Failed to record transaction. Please contact support.")
            toast.error("Transaction failed")
          }
        },
        prefill: {
          email: user?.email || "",
          contact: user?.phone || "",
        },
        theme: {
          color: "#2563EB",
        },
      }

      const paymentObject = new window.Razorpay(options)
      paymentObject.on("payment.failed", (response) => {
        setDepositError("Payment failed: " + (response.error.description || "Please try again."))
        toast.error("Payment failed")
      })
      paymentObject.open()
    } catch (err) {
      setDepositError(err?.response?.data?.error || "Failed to create order. Please try again.")
      toast.error("Failed to initiate payment")
    } finally {
      setIsDepositing(false)
    }
  }

  const handleDeposit = async (e) => {
    e.preventDefault()
    await displayRazorpay()
  }

  // Update the transaction grouping logic
  const groupTransactions = (transactions = []) => {
    // If transactions is falsy or not an array, use empty array
    const transactionArray = Array.isArray(transactions?.transactions) ? transactions.transactions : [];
    
    return {
      all: transactionArray,
      deposits: transactionArray.filter((tx) => tx.type === "DEPOSIT"),
      withdrawals: transactionArray.filter((tx) => tx.type === "WITHDRAWAL"),
      contests: transactionArray.filter((tx) => tx.type === "DEBIT" || tx.type === "CREDIT")
    };
  };

  // Group transactions
  const {
    all: allTransactions,
    deposits: depositTransactions,
    withdrawals: withdrawalTransactions,
    contests: contestTransactions
  } = groupTransactions(transactionsData);

  return (
    <div className="container px-2 mx-auto sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-8 max-w-6xl">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Wallet</h1>
          <p className="text-sm text-muted-foreground">Manage your funds and view transaction history</p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => refetch()} 
          disabled={userLoading || transactionsLoading}
          className="w-full sm:w-auto"
        >
          {userLoading || transactionsLoading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6">
        {/* Balance and Deposit Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Balance Card */}
          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl flex items-center gap-2">
                <WalletIcon className="h-5 w-5" />
                Wallet Balance
              </CardTitle>
              <CardDescription>Your available funds for trading and contests</CardDescription>
            </CardHeader>
            <CardContent>
              {userLoading ? (
                <Skeleton className="h-14 w-1/2" />
              ) : userError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>
                    Failed to load balance: {userError?.data?.message || "Unknown error"}
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="flex items-baseline">
                  <span className="text-4xl font-bold text-primary">{formatCurrency(user?.amount || 0)}</span>
                  <span className="text-muted-foreground ml-2">INR</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Deposit Form */}
          <Card className="h-auto">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Add Funds
              </CardTitle>
              <CardDescription>Deposit money to your wallet</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleDeposit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (₹)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="amount"
                      type="number"
                      placeholder="Enter amount"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      className="pl-9"
                      min="1"
                      step="0.01"
                    />
                  </div>
                </div>

                {depositError && (
                  <Alert variant="destructive" className="py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{depositError}</AlertDescription>
                  </Alert>
                )}

                {depositSuccess && (
                  <Alert variant="success" className="py-2 bg-green-50 text-green-800 border-green-200">
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>{depositSuccess}</AlertDescription>
                  </Alert>
                )}
              </form>
            </CardContent>
            <CardFooter>
              <Button className="w-full" onClick={handleDeposit} disabled={isDepositing || !depositAmount}>
                {isDepositing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>Add Funds</>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Transactions History */}
        <Card>
          <CardHeader className="pb-0 sm:pb-3">
            <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
              <RefreshCw className="h-4 w-4 sm:h-5 sm:w-5" />
              Transaction History
            </CardTitle>
            <CardDescription className="text-sm">View all your wallet transactions</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Update Tabs for mobile */}
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="grid grid-cols-2 sm:grid-cols-4 mb-4 sm:mb-6 h-auto">
                {/* Make tabs stack on mobile */}
                <TabsTrigger value="all" className="text-sm py-2">
                  All
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {allTransactions.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="deposits" className="text-sm py-2">
                  Deposits
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {depositTransactions.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="withdrawals" className="text-sm py-2">
                  Withdrawals
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {withdrawalTransactions.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="contests" className="text-sm py-2">
                  Contests
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {contestTransactions.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              {/* Make table container scrollable */}
              <div className="overflow-auto max-h-[60vh] rounded-md border">
                <TabsContent value="all" className="m-0">
                  <TransactionTable transactions={allTransactions} />
                </TabsContent>

                <TabsContent value="deposits" className="m-0">
                  <TransactionTable transactions={depositTransactions} />
                </TabsContent>

                <TabsContent value="withdrawals" className="m-0">
                  <TransactionTable transactions={withdrawalTransactions} />
                </TabsContent>

                <TabsContent value="contests" className="m-0">
                  <TransactionTable transactions={contestTransactions} />
                </TabsContent>
              </div>
            </Tabs>
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
