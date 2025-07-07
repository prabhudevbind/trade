"use client";

import { useState, useEffect } from "react";
import {
  useGetWalletTransactionsQuery,
  useCreateWalletTransactionMutation,
} from "@/store/api/contest";
import { useGetUserByIdQuery } from "@/store/api/userSliceApi";
import { toast } from "react-toastify";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Download,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import WithDrawUpiId from "./WithDrawUpiId";
import { useNavigate } from "react-router-dom";

function PaymentDialog({ isOpen, onClose, amount, onPaymentComplete }) {
  const [paymentStatus, setPaymentStatus] = useState("qr_display"); // qr_display -> payment_confirm -> utr_input -> processing
  const [currentTransactionId, setCurrentTransactionId] = useState("");
  const [upiRefNo, setUpiRefNo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Generate transaction ID when dialog opens
  useEffect(() => {
    if (isOpen) {
      // Generate a unique transaction ID with timestamp, random string and current milliseconds
      const timestamp = Date.now();
      const random = Math.random().toString(36).substr(2, 9);
      const milliseconds = new Date()
        .getMilliseconds()
        .toString()
        .padStart(3, "0");
      setCurrentTransactionId(
        `FT${timestamp}${milliseconds}${random.toUpperCase()}`
      );
      setPaymentStatus("qr_display");
      setUpiRefNo("");
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const createUPIUrl = () => {
    // Create a properly formatted UPI URL with all required parameters
    const upiParams = {
      pa: "8368552483@ybl", // Payee UPI ID
      pn: "Fantasy Trading", // Payee name
      tn: currentTransactionId, // Transaction note/reference
      am: amount.toString(), // Amount
      cu: "INR", // Currency
      mc: "", // Merchant code (optional)
      tr: currentTransactionId, // Transaction reference
      mode: "00", // Mode (00 for basic UPI payment)
    };

    // Create the UPI URL with encoded parameters
    const params = Object.entries(upiParams)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join("&");

    return `upi://pay?${params}`;
  };

  const handleDownloadQR = () => {
    const img = document.getElementById("upi-qr-img");
    const link = document.createElement("a");
    link.href = img.src;
    link.download = `upi-qr-${currentTransactionId}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePaymentYes = () => {
    setPaymentStatus("utr_input");
  };

  const handlePaymentNo = () => {
    setPaymentStatus("qr_display");
    toast.error("Payment cancelled");
    onClose();
  };

  const handleUTRSubmit = async () => {
    if (!upiRefNo.trim()) {
      toast.error("Please enter UPI Reference Number");
      return;
    }

    setIsSubmitting(true);

    try {
      // Simulate processing delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      toast.success("Payment verified successfully!");
      onPaymentComplete(currentTransactionId, upiRefNo.trim());
    } catch (error) {
      toast.error("Failed to verify payment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setPaymentStatus("qr_display");
    setUpiRefNo("");
    setIsSubmitting(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Add Money to Wallet
          </DialogTitle>
          <DialogDescription>
            Amount: ₹{amount}
            <div className="mt-2 text-xs text-gray-500 font-mono">
              Transaction ID: {currentTransactionId}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Step 1: Show QR Code */}
          {paymentStatus === "qr_display" && (
            <div className="flex flex-col items-center space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <img
                  id="upi-qr-img"
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                    createUPIUrl()
                  )}`}
                  alt="Payment QR Code"
                  className="border-2 border-gray-200 rounded-lg"
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadQR}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download QR Code
              </Button>

              <div className="text-center space-y-2">
                <p className="text-sm font-medium">
                  Scan with any UPI app to pay
                </p>
                <p className="text-xs text-gray-500">
                  Pay ₹{amount} to complete the transaction
                </p>
              </div>

              <div className="w-full pt-4">
                <Button
                  onClick={() => setPaymentStatus("payment_confirm")}
                  className="w-full"
                  size="lg"
                >
                  I have made the payment
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Ask if payment is done */}
          {paymentStatus === "payment_confirm" && (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Confirm Payment</AlertTitle>
                <AlertDescription>
                  Have you completed the payment of ₹{amount}?
                </AlertDescription>
              </Alert>

              <div className="flex gap-3">
                <Button
                  onClick={handlePaymentYes}
                  className="flex-1"
                  variant="default"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Yes, Payment Done
                </Button>
                <Button
                  onClick={handlePaymentNo}
                  className="flex-1"
                  variant="outline"
                >
                  No, Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: UTR Input */}
          {paymentStatus === "utr_input" && (
            <div className="space-y-4">
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800">
                  Payment Confirmed
                </AlertTitle>
                <AlertDescription className="text-green-700">
                  Please enter your UPI Reference Number to complete the
                  verification
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="utr-input" className="text-sm font-medium">
                  UPI Reference Number (UTR)
                </Label>
                <Input
                  id="utr-input"
                  placeholder="Enter 12-digit UPI Ref No. (e.g. 123456789012)"
                  value={upiRefNo}
                  onChange={(e) => setUpiRefNo(e.target.value)}
                  className="font-mono"
                  maxLength={12}
                  disabled={isSubmitting}
                />
                <p className="text-xs text-gray-500">
                  You can find this in your UPI app's transaction history
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleUTRSubmit}
                  className="flex-1"
                  disabled={!upiRefNo.trim() || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Submit & Verify"
                  )}
                </Button>
                <Button
                  onClick={() => setPaymentStatus("payment_confirm")}
                  variant="outline"
                  disabled={isSubmitting}
                >
                  Back
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Wallet() {
  const [depositAmount, setDepositAmount] = useState("");
  const [depositError, setDepositError] = useState(null);
  const [depositSuccess, setDepositSuccess] = useState(null);
  const [isDepositing, setIsDepositing] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
const navigate=useNavigate();
  // Filter state
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Fetch user data
  const {
    data: user,
    isLoading: userLoading,
    error: userError,
    refetch: refetchUser,
  } = useGetUserByIdQuery();
  const [createWalletTransaction] = useCreateWalletTransactionMutation();

  // Fetch wallet transactions
  const {
    data: transactionsData,
    isLoading: transactionsLoading,
    error: transactionsError,
    refetch: refetchTransactions,
  } = useGetWalletTransactionsQuery();
  const transactions = transactionsData?.transactions || [];

  // Filtered transactions
  const filteredTransactions = transactions.filter((tx) => {
    const typeMatch = typeFilter === "ALL" || tx.type === typeFilter;
    const statusMatch = statusFilter === "ALL" || tx.status === statusFilter;
    return typeMatch && statusMatch;
  });

  // Show warning if any completed transaction is not verified
  const hasUnverifiedPayment = filteredTransactions.some(
    (tx) => tx.status === "COMPLETED" && tx.payment_verify === false
  );

  const handleDepositClick = () => {
    setDepositError(null);

    // Validate amount
    const amount = Number(depositAmount);
    if (!amount || amount <= 0) {
      setDepositError("Please enter a valid amount");
      return;
    }

    if (amount < 1) {
      setDepositError("Minimum deposit amount is ₹1");
      return;
    }

    // Show payment dialog
    setShowPaymentDialog(true);
  };

  const handlePaymentComplete = async (transactionId, refNo) => {
    try {
      setIsDepositing(true);

      // Create wallet transaction with UPI transaction ID
      await createWalletTransaction({
        amount: Number(depositAmount),
        type: "CREDIT",
        status: "COMPLETED",
        description: "Wallet top up",
        transaction_id: transactionId,
        payment_method: "UPI",
        upi_ref_no: parseInt(refNo),
      }).unwrap();

      // Show success message with transaction ID
      setDepositSuccess(
        `₹${depositAmount} added to wallet successfully! (Ref: ${refNo})`
      );
      setDepositAmount("");

      // Refresh user data to show updated balance
      refetchUser();
      navigate('/contests');
    } catch (error) {
      setDepositError(error?.data?.message || "Failed to process payment");
    } finally {
      setIsDepositing(false);
      setShowPaymentDialog(false);
    }
  };

  return (
    <div className="">
      <div className="grid gap-6">
        {/* Balance Card */}
        <div  className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        
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
              <div className="space-y-6 ">
                {/* Balance Display */}
                <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      Available Balance
                    </p>
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
                          setDepositAmount(e.target.value);
                          setDepositError(null);
                          setDepositSuccess(null);
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
                    <Alert
                      variant="success"
                      className="bg-green-50 border-green-200"
                    >
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
            <div>
           
            <WithDrawUpiId />
          </div>
        </div>
        {/* Payment Dialog */}
        <PaymentDialog
          isOpen={showPaymentDialog}
          onClose={() => setShowPaymentDialog(false)}
          amount={depositAmount}
          onPaymentComplete={handlePaymentComplete}
        />

        {/* Warning for unverified payment */}
        {hasUnverifiedPayment && (
          <Alert variant="info" className="mb-4 mx-2 w-[90vw]">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Information</AlertTitle>
            <AlertDescription className="text-wrap">
              Your payment could not be verified. Your account may be blocked if
              false payments are detected.
            </AlertDescription>
          </Alert>
        )}

        {/* Transaction History */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>Your recent wallet transactions</CardDescription>
            <div className="flex flex-wrap gap-2 mt-2">
              <select
                className="border rounded px-2 py-1 text-xs"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="ALL">All Types</option>
                <option value="CREDIT">Credit</option>
                <option value="DEBIT">Debit</option>
              </select>
              <select
                className="border rounded px-2 py-1 text-xs"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Status</option>
                <option value="COMPLETED">Completed</option>
                <option value="PENDING">Pending</option>
              </select>
            </div>
          </CardHeader>
          <CardContent>
            {transactionsLoading ? (
              <div className="py-8 text-center text-gray-400">Loading...</div>
            ) : transactionsError ? (
              <div className="py-8 text-center text-red-500">
                Failed to load transactions
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="py-8 text-center text-gray-400">
                No transactions found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                {/* Desktop Table */}
                <Table className="min-w-full hidden sm:table text-xs sm:text-sm">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Txn ID</TableHead>
                      <TableHead>UPI Ref</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Verify</TableHead>
                      {/* <TableHead>User ID</TableHead> */}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.map((tx) => (
                      <TableRow key={tx.id} className="hover:bg-gray-50">
                        <TableCell>{formatDate(tx.created_at)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              tx.type === "CREDIT"
                                ? "success"
                                : tx.type === "DEBIT"
                                ? "destructive"
                                : "secondary"
                            }
                            className="text-xs"
                          >
                            {tx.type}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={
                            tx.type === "CREDIT"
                              ? "text-green-600 font-semibold"
                              : "text-red-600 font-semibold"
                          }
                        >
                          {tx.type === "CREDIT" ? "+" : "-"}
                          {formatCurrency(tx.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {tx.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono">
                          {tx.transaction_id}
                        </TableCell>
                        <TableCell className="font-mono">
                          {tx.upi_ref_no || "-"}
                        </TableCell>
                        <TableCell>{tx.payment_method || "-"}</TableCell>
                        <TableCell>
                          {tx.payment_verify ? (
                            <Badge className="bg-green-100 text-green-700 border-green-200">
                              Verified
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700 border-red-200">
                              Not Verified
                            </Badge>
                          )}
                        </TableCell>
                        {/* <TableCell>{tx.user_id || '-'}</TableCell> */}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {/* Mobile-friendly cards */}
                <div className="md:hidden space-y-3 mt-4">
                  {filteredTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      className={`rounded-lg border p-3 bg-gray-50 flex flex-col gap-1`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-sm">
                          {formatDate(tx.created_at)}
                        </span>
                        <Badge
                          variant={
                            tx.type === "CREDIT"
                              ? "success"
                              : tx.type === "DEBIT"
                              ? "destructive"
                              : "secondary"
                          }
                          className="text-xs"
                        >
                          {tx.type}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span
                          className={
                            tx.type === "CREDIT"
                              ? "text-green-600 font-bold"
                              : "text-red-600 font-bold"
                          }
                        >
                          {tx.type === "CREDIT" ? "+" : "-"}
                          {formatCurrency(tx.amount)}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {tx.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        Txn ID: {tx.transaction_id}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        UPI Ref: {tx.upi_ref_no || "-"}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        Method: {tx.payment_method || "-"}
                      </div>
                      <div className="text-xs truncate">
                        {tx.payment_verify ? (
                          <Badge className="bg-green-100 text-green-700 border-green-200 font-semibold">
                            Verified
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 border-red-200 font-semibold animate-pulse">
                            Not Verified
                          </Badge>
                        )}
                      </div>
                      {/* <div className="text-xs text-gray-500 truncate">User ID: {tx.user_id || '-'}</div> */}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TransactionTable({ transactions }) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        No transactions in this category.
      </div>
    );
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
                  variant={
                    tx.type === "DEPOSIT"
                      ? "success"
                      : tx.type === "WITHDRAWAL"
                      ? "destructive"
                      : "secondary"
                  }
                  className="text-xs whitespace-nowrap"
                >
                  <span className="flex items-center gap-1">
                    {tx.type === "DEPOSIT" && (
                      <ArrowDownCircle className="h-3 w-3 hidden sm:inline" />
                    )}
                    {tx.type}
                  </span>
                </Badge>
              </TableCell>
              <TableCell
                className={`font-medium text-xs sm:text-sm ${
                  tx.type === "DEPOSIT" || tx.type === "CREDIT"
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
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
  );
}
