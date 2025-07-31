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
                StockVerses
              </span>
            </div>

            {/* Center Title - Hidden on mobile when profile is open */}
            <h1 className={`text-lg sm:text-xl font-semibold text-gray-900 absolute left-1/2 transform -translate-x-1/2 ${isProfileOpen ? 'hidden sm:block' : 'block'}`}>
              Portfolio
            </h1>

           
          </div>
        </div>
      </div>

   
    </>
  );
};

export default PortfolioHeader;