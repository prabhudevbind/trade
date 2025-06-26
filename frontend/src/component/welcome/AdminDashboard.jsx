import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { 
  Users, Trophy, DollarSign, TrendingUp, Activity, AlertCircle,
  CheckCircle, XCircle, Clock, Download, Search, Filter
} from 'lucide-react';

const AdminDashboard = () => {
  // State management
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Dashboard data
  const [dashboardStats, setDashboardStats] = useState(null);
  const [userGrowth, setUserGrowth] = useState([]);
  const [transactionData, setTransactionData] = useState([]);
  const [contestData, setContestData] = useState([]);
  
  // Management data
  const [users, setUsers] = useState([]);
  const [contests, setContests] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [tradingOverview, setTradingOverview] = useState(null);
  const [recentTrades, setRecentTrades] = useState([]);

  // Filters and pagination
  const [userFilters, setUserFilters] = useState({
    page: 1, limit: 20, search: '', role: '', status: ''
  });
  const [contestFilters, setContestFilters] = useState({
    page: 1, limit: 20, status: ''
  });
  const [transactionFilters, setTransactionFilters] = useState({
    page: 1, limit: 20, type: '', status: ''
  });

  // API calls
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [statsRes, userGrowthRes, transactionRes, contestRes] = await Promise.all([
        fetch('/api/v1/dashboard/stats').then(r => r.json()),
        fetch('/api/v1/dashboard/charts/user-growth').then(r => r.json()),
        fetch('/api/v1/dashboard/charts/transactions').then(r => r.json()),
        fetch('/api/v1/dashboard/charts/contest-participation').then(r => r.json())
      ]);
      
      setDashboardStats(statsRes.data);
      setUserGrowth(userGrowthRes.data);
      setTransactionData(transactionRes.data);
      setContestData(contestRes.data);
    } catch (err) {
      setError('Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const queryParams = new URLSearchParams(userFilters);
      const response = await fetch(`/api/v1/users?${queryParams}`);
      const data = await response.json();
      setUsers(data.data);
    } catch (err) {
      setError('Failed to fetch users');
    }
  };

  const fetchContests = async () => {
    try {
      const queryParams = new URLSearchParams(contestFilters);
      const response = await fetch(`/api/v1/contests?${queryParams}`);
      const data = await response.json();
      setContests(data.data.contests || []);
    } catch (err) {
      setError('Failed to fetch contests');
    }
  };

  const fetchTransactions = async () => {
    try {
      const queryParams = new URLSearchParams(transactionFilters);
      const response = await fetch(`/api/v1/transactions?${queryParams}`);
      const data = await response.json();
      setTransactions(data.data);
    } catch (err) {
      setError('Failed to fetch transactions');
    }
  };

  const fetchTradingData = async () => {
    try {
      const [overviewRes, tradesRes] = await Promise.all([
        fetch('/api/v1/trading/overview').then(r => r.json()),
        fetch('/api/v1/trading/recent-trades').then(r => r.json())
      ]);
      
      setTradingOverview(overviewRes.data);
      setRecentTrades(tradesRes.data);
    } catch (err) {
      setError('Failed to fetch trading data');
    }
  };

  const updateUserStatus = async (userId, isActive) => {
    try {
      const response = await fetch(`/api/v1/users/${userId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive })
      });
      
      if (response.ok) {
        fetchUsers();
      }
    } catch (err) {
      setError('Failed to update user status');
    }
  };

  const updateTransactionStatus = async (transactionId, status) => {
    try {
      const response = await fetch(`/api/v1/transactions/${transactionId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, verified_at: new Date().toISOString() })
      });
      
      if (response.ok) {
        fetchTransactions();
      }
    } catch (err) {
      setError('Failed to update transaction status');
    }
  };

  // Load data based on active tab
  useEffect(() => {
    switch (activeTab) {
      case 'dashboard':
        fetchDashboardData();
        break;
      case 'users':
        fetchUsers();
        break;
      case 'contests':
        fetchContests();
        break;
      case 'transactions':
        fetchTransactions();
        break;
      case 'trading':
        fetchTradingData();
        break;
    }
  }, [activeTab, userFilters, contestFilters, transactionFilters]);

  // Chart colors
  const colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'];

  // Stats Card Component
  const StatsCard = ({ title, value, icon: Icon, change, color = 'blue' }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          {change && (
            <p className={`text-sm mt-2 ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {change >= 0 ? '+' : ''}{change}% from yesterday
            </p>
          )}
        </div>
        <div className={`p-3 rounded-lg bg-${color}-50`}>
          <Icon className={`h-6 w-6 text-${color}-600`} />
        </div>
      </div>
    </div>
  );

  // Dashboard Tab
  const DashboardTab = () => (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Users"
          value={dashboardStats?.users?.total || 0}
          icon={Users}
          color="blue"
        />
        <StatsCard
          title="Active Contests"
          value={dashboardStats?.contests?.active || 0}
          icon={Trophy}
          color="purple"
        />
        <StatsCard
          title="Total Transactions"
          value={dashboardStats?.transactions?.total || 0}
          icon={DollarSign}
          color="green"
        />
        <StatsCard
          title="Pending Withdrawals"
          value={dashboardStats?.transactions?.pendingWithdrawals || 0}
          icon={AlertCircle}
          color="red"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">User Growth (30 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={userGrowth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="cumulative" stroke="#3B82F6" fill="#3B82F650" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Transaction Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Transactions</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={transactionData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#10B981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Contest Participation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Contest Participation</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={contestData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="participants" fill="#8B5CF6" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  // Users Tab
  const UsersTab = () => (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="Search users..."
              value={userFilters.search}
              onChange={(e) => setUserFilters({...userFilters, search: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              value={userFilters.role}
              onChange={(e) => setUserFilters({...userFilters, role: e.target.value})}
            >
              <option value="">All Roles</option>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              value={userFilters.status}
              onChange={(e) => setUserFilters({...userFilters, status: e.target.value})}
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setUserFilters({page: 1, limit: 20, search: '', role: '', status: ''})}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded-lg"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contests</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users?.users?.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {user.firstName} {user.lastName}
                      </div>
                      <div className="text-sm text-gray-500">@{user.username}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      {user.role?.name || 'User'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      user.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user._count?.contestParticipants || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => updateUserStatus(user.id, !user.isActive)}
                      className={`${
                        user.isActive 
                          ? 'text-red-600 hover:text-red-900' 
                          : 'text-green-600 hover:text-green-900'
                      }`}
                    >
                      {user.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // Transactions Tab
  const TransactionsTab = () => (
    <div className="space-y-6">
      {/* Transaction Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatsCard
          title="Total Amount"
          value={`₹${dashboardStats?.transactions?.totalAmount?.toLocaleString() || 0}`}
          icon={DollarSign}
          color="green"
        />
        <StatsCard
          title="Today's Transactions"
          value={dashboardStats?.transactions?.todayCount || 0}
          icon={Activity}
          color="blue"
        />
        <StatsCard
          title="Pending Withdrawals"
          value={dashboardStats?.transactions?.pendingWithdrawals || 0}
          icon={Clock}
          color="yellow"
        />
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Transactions</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {transactions?.transactions?.map((transaction) => (
                <tr key={transaction.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {transaction.user?.firstName} {transaction.user?.lastName}
                    </div>
                    <div className="text-sm text-gray-500">{transaction.user?.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      transaction.type === 'DEPOSIT' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {transaction.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ₹{transaction.amount?.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      transaction.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                      transaction.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {transaction.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(transaction.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    {transaction.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => updateTransactionStatus(transaction.id, 'APPROVED')}
                          className="text-green-600 hover:text-green-900"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => updateTransactionStatus(transaction.id, 'REJECTED')}
                          className="text-red-600 hover:text-red-900"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // Trading Tab
  const TradingTab = () => (
    <div className="space-y-6">
      {/* Trading Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatsCard
          title="Total Trades"
          value={tradingOverview?.totalTrades || 0}
          icon={TrendingUp}
          color="blue"
        />
        <StatsCard
          title="Active Positions"
          value={tradingOverview?.activePositions || 0}
          icon={Activity}
          color="green"
        />
        <StatsCard
          title="Trading Volume"
          value={`₹${tradingOverview?.tradingVolume?.toLocaleString() || 0}`}
          icon={DollarSign}
          color="purple"
        />
      </div>

      {/* Recent Trades */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Trades</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trader</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contest</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recentTrades?.map((trade) => (
                <tr key={trade.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {trade.contestParticipant?.user?.firstName} {trade.contestParticipant?.user?.lastName}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {trade.contestParticipant?.contest?.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      trade.trade_type === 'BUY' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {trade.trade_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ₹{trade.price?.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {trade.quantity}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(trade.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // Navigation tabs
  const tabs = [
    { id: 'dashboard', name: 'Dashboard', icon: Activity },
    { id: 'users', name: 'Users', icon: Users },
    { id: 'contests', name: 'Contests', icon: Trophy },
    { id: 'transactions', name: 'Transactions', icon: DollarSign },
    { id: 'trading', name: 'Trading', icon: TrendingUp },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage your trading platform from here
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <button className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                <Download className="h-4 w-4 mr-2" />
                Export Data
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center px-1 py-4 text-sm font-medium border-b-2 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-400 hover:text-red-600"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-sm text-gray-500">Loading...</p>
          </div>
        )}

        {/* Tab Content */}
        {!loading && (
          <>
            {activeTab === 'dashboard' && <DashboardTab />}
            {activeTab === 'users' && <UsersTab />}
            {activeTab === 'transactions' && <TransactionsTab />}
            {activeTab === 'trading' && <TradingTab />}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;