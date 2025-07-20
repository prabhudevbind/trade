import { useGetAllWinningHistoryQuery } from "@/store/api/win.api"
 import React, { useState, useMemo } from 'react';
import { Search, Eye, Filter, ChevronLeft, ChevronRight, Download, AlertCircle, CheckCircle, Clock, X } from 'lucide-react';


export default function Winner() {
  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().slice(0, 10)
  const { data: winners, isLoading, isError } = useGetAllWinningHistoryQuery({ startDate: today, endDate: today });


  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [rankFilter, setRankFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedWinner, setSelectedWinner] = useState(null);
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);


  // Normalize winners data if API response is wrapped in { success, data }
  const winnerList = winners && Array.isArray(winners.data) ? winners.data : (Array.isArray(winners) ? winners : []);

  // Filtering logic
  const filteredWinners = useMemo(() => {
    if (!winnerList || !Array.isArray(winnerList)) return [];
    return winnerList.filter(winner => {
      const matchesSearch = 
        winner.user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        winner.user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        winner.user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        winner.user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        winner.contestId.toString().includes(searchTerm);

      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'active' && winner.user.isActive) ||
        (statusFilter === 'inactive' && !winner.user.isActive);

      const matchesRank = rankFilter === 'all' || 
        (rankFilter === '1' && winner.rank === 1) ||
        (rankFilter === '2' && winner.rank === 2) ||
        (rankFilter === '3' && winner.rank === 3) ||
        (rankFilter === 'other' && winner.rank > 3);

      const hasUnverifiedPayments = winner.user.walletTransactions.some(t => !t.payment_verify);
      const matchesPayment = paymentFilter === 'all' ||
        (paymentFilter === 'verified' && !hasUnverifiedPayments) ||
        (paymentFilter === 'unverified' && hasUnverifiedPayments);

      return matchesSearch && matchesStatus && matchesRank && matchesPayment;
    });
  }, [winnerList, searchTerm, statusFilter, rankFilter, paymentFilter]);

  // Pagination logic
  const totalPages = Math.ceil(filteredWinners.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedWinners = filteredWinners.slice(startIndex, startIndex + itemsPerPage);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = (status, verified) => {
    if (status === 'COMPLETED' && verified) {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    } else if (status === 'PENDING' || !verified) {
      return <Clock className="w-4 h-4 text-yellow-500" />;
    } else {
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getUnverifiedPayments = (transactions) => {
    return transactions.filter(t => !t.payment_verify);
  };

  const PaymentDetailsModal = ({ payment, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Payment Details</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Transaction ID</label>
              <p className="text-sm text-gray-900">{payment.transaction_id || 'N/A'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Amount</label>
              <p className="text-sm text-gray-900">₹{payment.amount}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Type</label>
              <p className="text-sm text-gray-900">{payment.type}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <div className="flex items-center space-x-2">
                {getStatusIcon(payment.status, payment.payment_verify)}
                <span className="text-sm text-gray-900">{payment.status}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Payment Method</label>
              <p className="text-sm text-gray-900">{payment.payment_method || 'N/A'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">UPI Reference</label>
              <p className="text-sm text-gray-900">{payment.upi_ref_no || 'N/A'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Created At</label>
              <p className="text-sm text-gray-900">{formatDate(payment.created_at)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Verified At</label>
              <p className="text-sm text-gray-900">{payment.verified_at ? formatDate(payment.verified_at) : 'Not verified'}</p>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-red-50 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <span className="text-sm font-medium text-red-800">
                Payment Verification: {payment.payment_verify ? 'Verified' : 'Not Verified'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Loader
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center">
          <svg className="animate-spin h-10 w-10 text-blue-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
          </svg>
          <span className="text-blue-700 font-semibold text-lg">Loading winners...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 sm:p-4 md:p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm">
          {/* Header */}
          <div className="border-b border-gray-200 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Winner Management</h1>
              <button className="bg-blue-600 text-white px-3 py-2 sm:px-4 sm:py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2 text-sm sm:text-base">
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="p-4 sm:p-6 border-b border-gray-200">
            <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search winners..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>

              {/* Rank Filter */}
              <select
                value={rankFilter}
                onChange={(e) => setRankFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="all">All Ranks</option>
                <option value="1">Rank 1</option>
                <option value="2">Rank 2</option>
                <option value="3">Rank 3</option>
                <option value="other">Other Ranks</option>
              </select>

              {/* Payment Filter */}
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="all">All Payments</option>
                <option value="verified">Verified Only</option>
                <option value="unverified">Unverified Payments</option>
              </select>

              {/* Items per page */}
              <select
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value={5}>5 per page</option>
                <option value={10}>10 per page</option>
                <option value={20}>20 per page</option>
                <option value={50}>50 per page</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-xs sm:text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Winner</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contest</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Issues</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedWinners.map((winner) => {
                  const unverifiedPayments = getUnverifiedPayments(winner.user.walletTransactions);
                  return (
                    <tr key={winner.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-blue-800">
                              {winner.user.firstName[0]}{winner.user.lastName[0]}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {winner.user.firstName} {winner.user.lastName}
                            </div>
                            <div className="text-sm text-gray-500">@{winner.user.username}</div>
                            <div className="text-sm text-gray-500">{winner.user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">Contest #{winner.contestId}</div>
                        <div className="text-sm text-gray-500">{formatDate(winner.winDate)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          winner.rank === 1 ? 'bg-yellow-100 text-yellow-800' :
                          winner.rank === 2 ? 'bg-gray-100 text-gray-800' :
                          winner.rank === 3 ? 'bg-orange-100 text-orange-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          #{winner.rank}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">₹{winner.amount}</div>
                        <div className="text-sm text-gray-500">Wallet: ₹{winner.user.amount}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          winner.user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {winner.user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {unverifiedPayments.length > 0 ? (
                          <div className="flex items-center space-x-2">
                            <AlertCircle className="w-4 h-4 text-red-500" />
                            <span className="text-sm text-red-600">
                              {unverifiedPayments.length} unverified
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span className="text-sm text-green-600">All verified</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => setSelectedWinner(winner)}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="text-xs sm:text-sm text-gray-700">
              Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredWinners.length)} of {filteredWinners.length} results
            </div>
            <div className="flex items-center space-x-1 sm:space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1 border rounded-md text-sm font-medium ${
                    currentPage === page
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              ))}
              
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Winner Details Modal */}
        {selectedWinner && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-0">
            <div className="bg-white rounded-lg p-4 sm:p-6 max-w-4xl w-full mx-2 sm:mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Winner Details</h3>
                <button
                  onClick={() => setSelectedWinner(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {/* User Information */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">User Information</h4>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Name</label>
                      <p className="text-sm text-gray-900">{selectedWinner.user.firstName} {selectedWinner.user.lastName}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Username</label>
                      <p className="text-sm text-gray-900">@{selectedWinner.user.username}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email</label>
                      <p className="text-sm text-gray-900">{selectedWinner.user.email}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">UPI ID</label>
                      <p className="text-sm text-gray-900">{selectedWinner.user.upiId || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Wallet Balance</label>
                      <p className="text-sm text-gray-900">₹{selectedWinner.user.amount}</p>
                    </div>
                  </div>
                </div>

                {/* Winner Information */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Winner Information</h4>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Contest ID</label>
                      <p className="text-sm text-gray-900">{selectedWinner.contestId}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Rank</label>
                      <p className="text-sm text-gray-900">#{selectedWinner.rank}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Prize Amount</label>
                      <p className="text-sm text-gray-900">₹{selectedWinner.amount}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Win Date</label>
                      <p className="text-sm text-gray-900">{formatDate(selectedWinner.winDate)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Transactions */}
              <div className="mt-6">
                <h4 className="font-medium text-gray-900 mb-4">Payment Transactions</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">Amount</th>
                        <th className="px-4 py-2 text-left">Type</th>
                        <th className="px-4 py-2 text-left">Status</th>
                        <th className="px-4 py-2 text-left">Method</th>
                        <th className="px-4 py-2 text-left">Verified</th>
                        <th className="px-4 py-2 text-left">Date</th>
                        <th className="px-4 py-2 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {selectedWinner.user.walletTransactions.map((transaction) => (
                        <tr key={transaction.id} className={!transaction.payment_verify ? 'bg-red-50' : ''}>
                          <td className="px-4 py-2">₹{transaction.amount}</td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              transaction.type === 'CREDIT' ? 'bg-green-100 text-green-800' :
                              transaction.type === 'DEBIT' ? 'bg-red-100 text-red-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {transaction.type}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center space-x-2">
                              {getStatusIcon(transaction.status, transaction.payment_verify)}
                              <span>{transaction.status}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2">{transaction.payment_method || 'N/A'}</td>
                          <td className="px-4 py-2">
                            {transaction.payment_verify ? (
                              <span className="text-green-600">✓</span>
                            ) : (
                              <span className="text-red-600">✗</span>
                            )}
                          </td>
                          <td className="px-4 py-2">{formatDate(transaction.created_at)}</td>
                          <td className="px-4 py-2">
                            <button
                              onClick={() => {
                                setSelectedPayment(transaction);
                                setShowPaymentDetails(true);
                              }}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Payment Details Modal */}
        {showPaymentDetails && selectedPayment && (
          <PaymentDetailsModal 
            payment={selectedPayment} 
            onClose={() => {
              setShowPaymentDetails(false);
              setSelectedPayment(null);
            }} 
          />
        )}
      </div>
    </div>
  );
}
