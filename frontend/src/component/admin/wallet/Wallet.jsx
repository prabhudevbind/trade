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
    <div className="container mx-auto px-4 py-6 space-y-8 max-w-6xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Wallet</h1>
          <p className="text-muted-foreground">Manage your funds and view transaction history</p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={userLoading || transactionsLoading}>
          {userLoading || transactionsLoading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
        <Card>
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
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Transaction History
          </CardTitle>
          <CardDescription>View all your wallet transactions</CardDescription>
        </CardHeader>
        <CardContent>
          {transactionsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : transactionsError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                Failed to load transactions: {transactionsError?.data?.message || "Unknown error"}
              </AlertDescription>
            </Alert>
          ) : allTransactions?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No transactions found. Add funds to get started.
            </div>
          ) : (
            <Tabs defaultValue="all">
              <TabsList className="grid grid-cols-4 mb-6">
                <TabsTrigger value="all">
                  All
                  <Badge variant="secondary" className="ml-2">
                    {allTransactions.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="deposits">
                  Deposits
                  <Badge variant="secondary" className="ml-2">
                    {depositTransactions.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="withdrawals">
                  Withdrawals
                  <Badge variant="secondary" className="ml-2">
                    {withdrawalTransactions.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="contests">
                  Contests
                  <Badge variant="secondary" className="ml-2">
                    {contestTransactions.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="space-y-4">
                <TransactionTable transactions={allTransactions} />
              </TabsContent>

              <TabsContent value="deposits" className="space-y-4">
                <TransactionTable transactions={depositTransactions} />
              </TabsContent>

              <TabsContent value="withdrawals" className="space-y-4">
                <TransactionTable transactions={withdrawalTransactions} />
              </TabsContent>

              <TabsContent value="contests" className="space-y-4">
                <TransactionTable transactions={contestTransactions} />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function TransactionTable({ transactions }) {
  if (transactions.length === 0) {
    return <div className="text-center py-4 text-muted-foreground">No transactions in this category.</div>
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Payment ID</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx) => (
            <TableRow key={tx.id}>
              <TableCell className="font-medium">{formatDate(tx.created_at)}</TableCell>
              <TableCell>
                <Badge
                  variant={tx.type === "DEPOSIT" ? "success" : tx.type === "WITHDRAWAL" ? "destructive" : "secondary"}
                  className={`
                    ${tx.type === "DEPOSIT" ? "bg-green-100 text-green-800 hover:bg-green-100" : ""} 
                    ${tx.type === "WITHDRAWAL" ? "bg-red-100 text-red-800 hover:bg-red-100" : ""}
                    ${tx.type === "DEBIT" ? "bg-orange-100 text-orange-800 hover:bg-orange-100" : ""}
                    ${tx.type === "CREDIT" ? "bg-blue-100 text-blue-800 hover:bg-blue-100" : ""}
                  `}
                >
                  <span className="flex items-center gap-1">
                    {tx.type === "DEPOSIT" && <ArrowDownCircle className="h-3 w-3" />}
                    {tx.type === "WITHDRAWAL" && <ArrowUpCircle className="h-3 w-3" />}
                    {tx.type === "DEBIT" && <ArrowUpCircle className="h-3 w-3" />}
                    {tx.type === "CREDIT" && <ArrowDownCircle className="h-3 w-3" />}
                    {tx.type}
                  </span>
                </Badge>
              </TableCell>
              <TableCell
                className={`font-medium ${tx.type === "DEPOSIT" || tx.type === "CREDIT" ? "text-green-600" : "text-red-600"}`}
              >
                {tx.type === "DEPOSIT" || tx.type === "CREDIT" ? "+" : "-"}
                {formatCurrency(tx.amount)}
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    tx.status === "COMPLETED" ? "outline" : tx.status === "PENDING" ? "secondary" : "destructive"
                  }
                  className={`
                    ${tx.status === "COMPLETED" ? "bg-green-100 text-green-800 hover:bg-green-100" : ""} 
                    ${tx.status === "PENDING" ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-100" : ""}
                    ${tx.status === "FAILED" ? "bg-red-100 text-red-800 hover:bg-red-100" : ""}
                  `}
                >
                  {tx.status}
                </Badge>
              </TableCell>
              <TableCell className="hidden md:table-cell truncate max-w-[150px]">
                {tx.razorpay_payment_id || "N/A"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
