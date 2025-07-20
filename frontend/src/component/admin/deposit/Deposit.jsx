"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Search,
  Filter,
  Upload,
  Check,
  X,
  Download,
  User,
  CreditCard,
  FileText,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useGetWalletTransactionsQuery } from "@/store/api/contest";
import Loader from "../option/Loader";

export default function DepositPage() {
  const { toast } = useToast();

  // States
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const {
    data: txData,
    isLoading: txLoading,
    error: txError,
    refetch,
  } = useGetWalletTransactionsQuery();

  useEffect(() => {
    // Simulate fetching transactions from an API
    setTransactions(txData?.transactions || []);
    if (txError) {
      toast({
        title: "Error fetching transactions",
        description:
          "There was an error fetching the transactions. Please try again later.",
        variant: "destructive",
      });
    }
  }, [txData]);
  // Filter states
  const [filters, setFilters] = useState({
    search: "",
    searchField: "all",
    status: "all",
    paymentMethod: "all",
    verificationStatus: "all",
    dateFrom: "",
    dateTo: "",
    amountMin: "",
    amountMax: "",
    showOnlyCredit: true,
    groupBy: "none",
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Filter and search logic
  const filteredTransactions = useMemo(
    () =>
      transactions.filter((tx) => {
        if (filters.showOnlyCredit && tx.type !== "CREDIT") return false;

        if (filters.search) {
          const searchTerm = filters.search.toLowerCase();
          const searchIn = (value) =>
            value?.toString().toLowerCase().includes(searchTerm);

          switch (filters.searchField) {
            case "name":
              if (!searchIn(tx.user.name)) return false;
              break;
            case "email":
              if (!searchIn(tx.user.email)) return false;
              break;
            case "transaction_id":
              if (!searchIn(tx.transaction_id)) return false;
              break;
            case "amount":
              if (!searchIn(tx.amount)) return false;
              break;
            case "all":
            default:
              if (
                !(
                  searchIn(tx.user.name) ||
                  searchIn(tx.user.email) ||
                  searchIn(tx.transaction_id) ||
                  searchIn(tx.amount) ||
                  searchIn(tx.payment_method)
                )
              )
                return false;
          }
        }

        if (filters.status !== "all" && tx.status !== filters.status)
          return false;
        if (
          filters.paymentMethod !== "all" &&
          tx.payment_method !== filters.paymentMethod
        )
          return false;

        if (filters.verificationStatus !== "all") {
          if (filters.verificationStatus === "verified" && !tx.payment_verify)
            return false;
          if (filters.verificationStatus === "unverified" && tx.payment_verify)
            return false;
        }

        if (filters.dateFrom || filters.dateTo) {
          const txDate = new Date(tx.created_at);
          if (filters.dateFrom && txDate < new Date(filters.dateFrom))
            return false;
          if (filters.dateTo && txDate > new Date(filters.dateTo + "T23:59:59"))
            return false;
        }

        if (filters.amountMin || filters.amountMax) {
          const amount = Number.parseFloat(tx.amount);
          if (
            filters.amountMin &&
            amount < Number.parseFloat(filters.amountMin)
          )
            return false;
          if (
            filters.amountMax &&
            amount > Number.parseFloat(filters.amountMax)
          )
            return false;
        }

        return true;
      }),
    [transactions, filters]
  );

  // Pagination logic
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Handle file upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type === "application/pdf") {
      if (file.size > 10 * 1024 * 1024) {
        // 10MB limit
        toast({
          title: "File too large",
          description: "Please select a PDF file smaller than 10MB",
          variant: "destructive",
        });
        return;
      }
      setUploadedFile(file);
    } else {
      toast({
        title: "Invalid file type",
        description: "Please select a PDF file",
        variant: "destructive",
      });
    }
  };

  // Handle payment verification with PDF upload
  const handleVerifyPayment = async () => {
    if (!uploadedFile || !selectedTransaction) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("pdf", uploadedFile);
      formData.append("transactionId", selectedTransaction.id.toString());

      // Simulate API call
      const response = await fetch("/api/v1/upload-pdf", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        // Update transaction status
        setTransactions((prev) =>
          prev.map((tx) =>
            tx.id === selectedTransaction.id
              ? { ...tx, payment_verify: true, status: "COMPLETED" }
              : tx
          )
        );

        toast({
          title: "Payment verified successfully",
          description: `Transaction ${selectedTransaction.transaction_id} has been verified`,
        });

        refetch();
        setShowUploadModal(false);
        setUploadedFile(null);
        setSelectedTransaction(null);
      } else {
        throw new Error("Verification failed");
      }
    } catch (error) {
      toast({
        title: "Verification failed",
        description: "Please try again or contact support",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Handle one-click verification
  const handleSingleVerify = async (transaction) => {
    setLoading(true);
    try {
      const response = await fetch("/api/v1/verify-single", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          utr_number: transaction.upi_ref_no,
          amount: transaction.amount,
          type: transaction.type,
        }),
      });

      if (response.ok) {
        setTransactions((prev) =>
          prev.map((tx) =>
            tx.id === transaction.id
              ? { ...tx, payment_verify: true, status: "COMPLETED" }
              : tx
          )
        );
        toast({
          title: "Payment verified",
          description: `Transaction ${transaction.transaction_id} verified successfully`,
        });
        refetch();
      } else {
        throw new Error("Verification failed");
      }
    } catch (error) {
      toast({
        title: "Verification failed",
        description: "Please try again or contact support",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Export transactions
  const handleExport = () => {
    const csvContent = [
      [
        "ID",
        "Transaction ID",
        "User Name",
        "Email",
        "Amount",
        "Status",
        "Payment Method",
        "Verified",
        "Date",
      ].join(","),
      ...filteredTransactions.map((tx) =>
        [
          tx.id,
          tx.transaction_id,
          tx.user.name,
          tx.user.email,
          tx.amount,
          tx.status,
          tx.payment_method,
          tx.payment_verify ? "Yes" : "No",
          new Date(tx.created_at).toLocaleDateString(),
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Add state for bulk upload
  const [bulkFiles, setBulkFiles] = useState([]);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);

  // Handle bulk file upload
  const handleBulkFileUpload = (event) => {
    const files = Array.from(event.target.files);
    const validFiles = files.filter(
      (file) => file.type === "application/pdf" && file.size <= 10 * 1024 * 1024
    );
    if (validFiles.length !== files.length) {
      toast({
        title: "Some files are invalid",
        description: "Only PDF files up to 10MB are allowed.",
        variant: "destructive",
      });
    }
    setBulkFiles(validFiles);
  };

  // Handle bulk verification
  const handleBulkVerify = async () => {
    if (!bulkFiles.length) return;
    setBulkUploading(true);
    try {
      const formData = new FormData();
      bulkFiles.forEach((file) => {
        formData.append(`pdf`, file);
      });
      // Simulate API call
      const response = await fetch("/api/v1/upload-pdf", {
        method: "POST",
        body: formData,
      });
      if (response.ok) {
        toast({
          title: "Bulk upload successful",
          description: `${bulkFiles.length} PDF(s) uploaded`,
        });
        setShowBulkUploadModal(false);
        setBulkFiles([]);
      } else {
        throw new Error("Bulk upload failed");
      }
    } catch (error) {
      toast({
        title: "Bulk upload failed",
        description: "Please try again or contact support",
        variant: "destructive",
      });
    } finally {
      setBulkUploading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "COMPLETED":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "PENDING":
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case "FAILED":
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-100 text-green-800 border-green-200";
      case "PENDING":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "FAILED":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const toggleRowExpansion = (id) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  if(txLoading){
    return<Loader/>
  }
  return (
    <>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
                Deposit Verification
              </h1>
              <p className="text-gray-600 mt-1">
                Manage and verify payment transactions
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2"
              >
                <Filter className="w-4 h-4" />
                Filters
                {showFilters ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
              <Button
                onClick={handleExport}
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export
              </Button>
              <Button
                variant="default"
                onClick={() => setShowBulkUploadModal(true)}
                className="flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Bulk Upload & Verify
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Total Transactions
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {filteredTransactions.length}
                  </p>
                </div>
                <FileText className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {
                      filteredTransactions.filter(
                        (tx) => tx.status === "PENDING"
                      ).length
                    }
                  </p>
                </div>
                <Clock className="w-8 h-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Verified</p>
                  <p className="text-2xl font-bold text-green-600">
                    {
                      filteredTransactions.filter((tx) => tx.payment_verify)
                        .length
                    }
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Total Amount
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    ₹
                    {filteredTransactions
                      .reduce(
                        (sum, tx) => sum + Number.parseFloat(tx.amount),
                        0
                      )
                      .toLocaleString()}
                  </p>
                </div>
                <CreditCard className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        {showFilters && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search transactions..."
                      value={filters.search}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          search: e.target.value,
                        }))
                      }
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Search In</Label>
                  <Select
                    value={filters.searchField}
                    onValueChange={(value) =>
                      setFilters((prev) => ({ ...prev, searchField: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Fields</SelectItem>
                      <SelectItem value="name">Name</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="transaction_id">
                        Transaction ID
                      </SelectItem>
                      <SelectItem value="amount">Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={filters.status}
                    onValueChange={(value) =>
                      setFilters((prev) => ({ ...prev, status: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="FAILED">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select
                    value={filters.paymentMethod}
                    onValueChange={(value) =>
                      setFilters((prev) => ({ ...prev, paymentMethod: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Methods</SelectItem>
                      <SelectItem value="UPI">UPI</SelectItem>
                      <SelectItem value="BANK_TRANSFER">
                        Bank Transfer
                      </SelectItem>
                      <SelectItem value="CARD">Card</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Verification Status</Label>
                  <Select
                    value={filters.verificationStatus}
                    onValueChange={(value) =>
                      setFilters((prev) => ({
                        ...prev,
                        verificationStatus: value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="verified">Verified</SelectItem>
                      <SelectItem value="unverified">Unverified</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Date Range</Label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          dateFrom: e.target.value,
                        }))
                      }
                      className="flex-1"
                    />
                    <Input
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          dateTo: e.target.value,
                        }))
                      }
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 items-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setFilters({
                      search: "",
                      searchField: "all",
                      status: "all",
                      paymentMethod: "all",
                      verificationStatus: "all",
                      dateFrom: "",
                      dateTo: "",
                      amountMin: "",
                      amountMax: "",
                      showOnlyCredit: true,
                      groupBy: "none",
                    })
                  }
                >
                  Clear Filters
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Transactions Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Transactions ({filteredTransactions.length})</span>
              <Badge variant="secondary">
                {filteredTransactions.length} results
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Transaction
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8">
                            <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
                              <User className="h-4 w-4 text-gray-600" />
                            </div>
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">
                              {tx.user.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {tx.user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">#{tx.id}</div>
                        <div className="text-xs text-gray-500 font-mono">
                          {tx.upi_ref_no}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          ₹{Number.parseFloat(tx.amount).toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500">{tx.type}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge
                          className={`${getStatusColor(
                            tx.status
                          )} flex items-center gap-1`}
                        >
                          {getStatusIcon(tx.status)}
                          {tx.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {tx.payment_method}
                        </div>
                        <div className="text-xs">
                          {tx.payment_verify ? (
                            <Badge className="bg-green-100 text-green-800 border-green-200">
                              <Check className="w-3 h-3 mr-1" />
                              Verified
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800 border-red-200">
                              <X className="w-3 h-3 mr-1" />
                              Unverified
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(tx.created_at).toLocaleDateString()}
                        <div className="text-xs">
                          {new Date(tx.created_at).toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex flex-col gap-1">
                          {!tx.payment_verify && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSingleVerify(tx)}
                                disabled={loading}
                              >
                                <Check className="w-3 h-3 mr-1" />
                                Quick Verify
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden space-y-4 p-4">
              {paginatedTransactions.map((tx) => (
                <Card key={tx.id} className="border">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                          <User className="h-5 w-5 text-gray-600" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {tx.user.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {tx.user.email}
                          </div>
                        </div>
                      </div>
                      <Badge
                        className={`${getStatusColor(
                          tx.status
                        )} flex items-center gap-1`}
                      >
                        {getStatusIcon(tx.status)}
                        {tx.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                      <div>
                        <span className="text-gray-500">Amount:</span>
                        <div className="font-medium">
                          ₹{Number.parseFloat(tx.amount).toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500">Method:</span>
                        <div className="font-medium">{tx.payment_method}</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Transaction ID:</span>
                        <div className="font-mono text-xs">
                          {tx.transaction_id}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500">Date:</span>
                        <div>
                          {new Date(tx.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        {tx.payment_verify ? (
                          <Badge className="bg-green-100 text-green-800 border-green-200">
                            <Check className="w-3 h-3 mr-1" />
                            Verified
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800 border-red-200">
                            <X className="w-3 h-3 mr-1" />
                            Unverified
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {!tx.payment_verify && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleQuickVerify(tx)}
                              disabled={loading}
                            >
                              <Check className="w-3 h-3 mr-1" />
                              Verify
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedTransaction(tx);
                                setShowUploadModal(true);
                              }}
                            >
                              <Upload className="w-3 h-3" />
                            </Button>
                          </>
                        )}
                        <Button size="sm" variant="ghost">
                          <Eye className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredTransactions.length === 0 && (
              <div className="text-center py-12">
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  No transactions found
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Try adjusting your filters
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
              {Math.min(
                currentPage * itemsPerPage,
                filteredTransactions.length
              )}{" "}
              of {filteredTransactions.length} results
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = i + 1;
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                }
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* PDF Upload Modal */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Verify Payment</DialogTitle>
            <DialogDescription>
              Upload bank statement PDF to verify the payment transaction
            </DialogDescription>
          </DialogHeader>

          {selectedTransaction && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="text-sm space-y-1">
                <div>
                  <strong>Transaction:</strong> #{selectedTransaction.id}
                </div>
                <div>
                  <strong>User:</strong> {selectedTransaction.user.name}
                </div>
                <div>
                  <strong>Amount:</strong> ₹
                  {Number.parseFloat(
                    selectedTransaction.amount
                  ).toLocaleString()}
                </div>
                <div>
                  <strong>Method:</strong> {selectedTransaction.payment_method}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">
                Upload Bank Statement (PDF)
              </Label>
              <div className="mt-2 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-600">
                    <label className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500">
                      <span>Upload a file</span>
                      <input
                        type="file"
                        multiple={false}
                        accept=".pdf"
                        onChange={handleFileUpload}
                        className="sr-only"
                      />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500">PDF up to 10MB</p>
                </div>
              </div>
              {uploadedFile && (
                <div className="mt-2 text-sm text-green-600 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Selected: {uploadedFile.name}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadedFile(null);
                  setSelectedTransaction(null);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleVerifyPayment}
                disabled={!uploadedFile || isUploading}
                className="flex-1"
              >
                {isUploading ? (
                  <>
                    <Clock className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Verify Payment
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk PDF Upload Modal */}
      <Dialog open={showBulkUploadModal} onOpenChange={setShowBulkUploadModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk PDF Upload</DialogTitle>
            <DialogDescription>
              Upload multiple bank statement PDFs. No transaction selection
              required.
            </DialogDescription>
          </DialogHeader>
          <div className="mb-4">
            <Label className="text-sm font-medium">
              Upload Bank Statements (PDF, multiple allowed)
            </Label>
            <input
              type="file"
              accept=".pdf"
              //   multiple
              onChange={handleBulkFileUpload}
              className="mt-2"
            />
            {bulkFiles.length > 0 && (
              <div className="mt-2 text-xs text-green-600">
                {bulkFiles.length} file(s) selected
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowBulkUploadModal(false);
                setBulkFiles([]);
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkVerify}
              disabled={!bulkFiles.length || bulkUploading}
              className="flex-1"
            >
              {bulkUploading ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Upload PDFs
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
