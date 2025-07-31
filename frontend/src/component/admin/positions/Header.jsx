import React, { useState } from 'react';
import { TrendingUp, Wallet, User, Menu, X } from 'lucide-react';

const PortfolioHeader = () => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [walletBalance] = useState(15420.50); // Mock wallet balance

  return (
    <>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo Section */}
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-green-600 to-blue-600 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900 hidden sm:block">
                StockVerses
              </span>
              <span className="text-lg font-bold text-gray-900 sm:hidden">
                SV
              </span>
            </div>

            {/* Center Title - Hidden on mobile when profile is open */}
            <h1 className={`text-lg sm:text-xl font-semibold text-gray-900 absolute left-1/2 transform -translate-x-1/2 ${isProfileOpen ? 'hidden sm:block' : 'block'}`}>
              Portfolio
            </h1>

            {/* Right Section - Wallet & Profile */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              {/* Wallet Balance */}
              <div className="flex items-center space-x-1 sm:space-x-2 bg-gray-50 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg">
                <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                <span className="text-sm sm:text-base font-semibold text-gray-900">
                  ${walletBalance.toLocaleString()}
                </span>
              </div>

              {/* Profile Button */}
              <button 
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center hover:shadow-lg transition-all duration-200 active:scale-95"
              >
                {isProfileOpen ? (
                  <X className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                ) : (
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Dropdown */}
      {isProfileOpen && (
        <>
          {/* Mobile Overlay */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-15 sm:hidden"
            onClick={() => setIsProfileOpen(false)}
          />
          
          {/* Profile Menu */}
          <div className="absolute top-16 right-4 w-72 sm:w-80 bg-white rounded-xl shadow-2xl border border-gray-200 z-30 overflow-hidden">
            {/* Profile Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 sm:p-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-white">John Doe</h3>
                  <p className="text-sm text-blue-100">Premium Member</p>
                </div>
              </div>
            </div>

            {/* Wallet Info */}
            <div className="p-4 sm:p-6 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Wallet className="w-5 h-5 text-green-600" />
                  <span className="font-semibold text-gray-900">Wallet Balance</span>
                </div>
                <span className="text-xl font-bold text-green-600">
                  ${walletBalance.toLocaleString()}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
                  Add Funds
                </button>
                <button className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors">
                  Withdraw
                </button>
              </div>
            </div>

            {/* Menu Items */}
            <div className="p-2 sm:p-4">
              <div className="space-y-1">
                <button className="w-full flex items-center space-x-3 px-3 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                  <User className="w-5 h-5" />
                  <span>Profile Settings</span>
                </button>
                <button className="w-full flex items-center space-x-3 px-3 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                  <TrendingUp className="w-5 h-5" />
                  <span>Trading History</span>
                </button>
                <button className="w-full flex items-center space-x-3 px-3 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                  <Wallet className="w-5 h-5" />
                  <span>Transaction History</span>
                </button>
                <hr className="my-2" />
                <button className="w-full flex items-center space-x-3 px-3 py-2.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default PortfolioHeader;