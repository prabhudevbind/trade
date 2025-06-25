"use client"

import { useGetWalletTransactionsQuery ,useUpdateWalletTransactionMutation} from "@/store/api/contest"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Filter, Check, X, QrCode, User, Mail, CreditCard, Clock } from "lucide-react"
import { format } from "date-fns"

function createUPIUrl(upiId, amount, transactionId) {
  const upiParams = {
    pa: upiId, // Payee UPI ID
    pn: "Fantasy Trading", // Payee name
    tn: transactionId, // Transaction note/reference
    am: amount.toString(), // Amount
    cu: "INR", // Currency
    tr: transactionId, // Transaction reference
    mode: "00", // Mode (00 for basic UPI payment)
  };
  const params = Object.entries(upiParams)
    .filter(([_, v]) => v)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  return `upi://pay?${params}`;
}

export default function WithDraw() {
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [confirmingPayments, setConfirmingPayments] = useState(new Set())
  const [updateWalletTransaction] = useUpdateWalletTransactionMutation();

  const {
    data: txData,
    isLoading: txLoading,
    error: txError,
    refetch: refetchTransactions,
  } = useGetWalletTransactionsQuery()

  // Filter transactions based on selected filters
  const filteredTransactions = (txData?.transactions || []).filter((tx) => {
    // Base filter for withdrawals
    const isWithdrawal = tx.type === "DEBIT" && tx.payment_method === "WITHDRAWAL"

    // Status filter
    const statusMatch = statusFilter === "all" || tx.status === statusFilter

    // Type filter (keeping for future use)
    const typeMatch = typeFilter === "all" || tx.type === typeFilter

    // Date filter
    const txDate = new Date(tx.created_at)
    const fromDate = dateFrom ? new Date(dateFrom) : null
    const toDate = dateTo ? new Date(dateTo) : null

    const dateMatch = (!fromDate || txDate >= fromDate) && (!toDate || txDate <= toDate)

    return isWithdrawal && statusMatch && typeMatch && dateMatch
  })

  const handlePaymentConfirmation = async (transactionId, confirmed) => {
    setConfirmingPayments((prev) => new Set(prev).add(transactionId))

    try {
      await updateWalletTransaction({ id: transactionId, status: confirmed ? 'COMPLETED' : 'FAILED' }).unwrap();
      refetchTransactions()
    } catch (error) {
      console.error("Failed to update transaction:", error)
    } finally {
      setConfirmingPayments((prev) => {
        const newSet = new Set(prev)
        newSet.delete(transactionId)
        return newSet
      })
    }
  }

  const clearFilters = () => {
    setDateFrom("")
    setDateTo("")
    setStatusFilter("all")
    setTypeFilter("all")
  }

  if (txLoading) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading transactions...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      {/* Filters Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateFrom">From Date</Label>
              <Input id="dateFrom" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateTo">To Date</Label>
              <Input id="dateTo" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Actions</Label>
              <Button variant="outline" onClick={clearFilters} className="w-full">
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Withdrawal Transactions</span>
            <Badge variant="secondary">{filteredTransactions.length} transactions</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    User Details
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    UPI ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    QR Code
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-background divide-y divide-border">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-muted-foreground">
                      No transactions found matching your filters.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-muted/50">
                      <td className="px-4 py-4">
                        <div>
                          <div className="font-medium">{tx.user?.name}</div>
                          <div className="text-sm text-muted-foreground">{tx.user?.email}</div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <code className="text-sm bg-muted px-2 py-1 rounded">{tx.user?.upiId || "N/A"}</code>
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-semibold text-lg">₹{tx.amount}</span>
                      </td>
                      <td className="px-4 py-4">
                        <Badge
                          variant={
                            tx.status === "COMPLETED"
                              ? "default"
                              : tx.status === "PENDING"
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {tx.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-sm text-muted-foreground">
                        {format(new Date(tx.created_at), "MMM dd, yyyy HH:mm")}
                      </td>
                      <td className="px-4 py-2">
                        {tx.user?.upiId ? (
                          <div style={{ position: 'relative', display: 'inline-block' }}>
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(createUPIUrl(tx.user.upiId, tx.amount, tx.transaction_id))}`}
                              alt="UPI QR Code"
                              width={64}
                              height={64}
                              title={`Transaction ID: ${tx.transaction_id}`}
                            />
                            <div style={{ fontSize: '10px', color: '#555', marginTop: '2px', textAlign: 'center' }}>
                              {tx.transaction_id}<br/>
                              <span style={{ color: '#888' }}>Reason: Withdrawal for user {tx.user?.name}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">No UPI ID</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {tx.status === "PENDING" && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handlePaymentConfirmation(tx.id, true)}
                              disabled={confirmingPayments.has(tx.id)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handlePaymentConfirmation(tx.id, false)}
                              disabled={confirmingPayments.has(tx.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden space-y-4">
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No transactions found matching your filters.
              </div>
            ) : (
              filteredTransactions.map((tx) => (
                <Card key={tx.id} className="border">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <Badge
                          variant={
                            tx.status === "COMPLETED"
                              ? "default"
                              : tx.status === "PENDING"
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {tx.status}
                        </Badge>
                        <span className="font-bold text-lg">₹{tx.amount}</span>
                      </div>

                      {/* User Info */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{tx.user?.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">{tx.user?.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                          <code className="text-sm bg-muted px-2 py-1 rounded">{tx.user?.upiId || "N/A"}</code>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(tx.created_at), "MMM dd, yyyy HH:mm")}
                          </span>
                        </div>
                      </div>

                      {/* QR Code */}
                      {tx.user?.upiId && (
                        <div className="flex items-center justify-center py-4">
                          <div className="text-center">
                            <QrCode className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(createUPIUrl(tx.user.upiId, tx.amount, tx.transaction_id))}`}
                              alt="UPI QR Code"
                              className="w-24 h-24 border rounded mx-auto"
                            />
                            <div className="text-xs text-muted-foreground mt-1">
                              {tx.transaction_id}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Reason: Withdrawal for user {tx.user?.name}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      {tx.status === "PENDING" && (
                        <div className="flex gap-2 pt-2">
                          <Button
                            className="flex-1 bg-green-600 hover:bg-green-700"
                            onClick={() => handlePaymentConfirmation(tx.id, true)}
                            disabled={confirmingPayments.has(tx.id)}
                          >
                            <Check className="h-4 w-4 mr-2" />
                            Confirm Payment
                          </Button>
                          <Button
                            className="flex-1"
                            variant="destructive"
                            onClick={() => handlePaymentConfirmation(tx.id, false)}
                            disabled={confirmingPayments.has(tx.id)}
                          >
                            <X className="h-4 w-4 mr-2" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
