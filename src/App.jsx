import React, { useState } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import SellerDashboard from './components/SellerDashboard';
import BullPricingAndMinting from './components/BullPricingAndMinting';
import SellerWallet from './components/SellerWallet';
import SellerProfile from './components/SellerProfile';
import Marketplace from './components/Marketplace';
import BullDetailModal from './components/BullDetailModal';
import InvestorPortfolio from './components/InvestorPortfolio';
import InvestorProfile from './components/InvestorProfile';

import { MOCK_BULLS, MOCK_SELLER_DATA, MOCK_INVESTOR_DATA } from './data/mockData';

export default function App() {
  const [currentRole, setCurrentRole] = useState('seller'); // 'seller' | 'buyer'
  const [activeView, setActiveView] = useState('seller-dashboard');
  
  const [bulls, setBulls] = useState(MOCK_BULLS);
  const [sellerData, setSellerData] = useState(MOCK_SELLER_DATA);
  const [investorData, setInvestorData] = useState(MOCK_INVESTOR_DATA);
  
  const [selectedBull, setSelectedBull] = useState(null);
  const [walletConnected, setWalletConnected] = useState(true);

  // When a new bull is minted in BullPricingAndMinting
  const handleBullMinted = (newBull) => {
    setBulls(prev => [newBull, ...prev]);
    setSellerData(prev => ({
      ...prev,
      activeBullsCount: prev.activeBullsCount + 1
    }));
  };

  // When an investor buys fractions in BullDetailModal
  const handleInvestSuccess = ({ bullId, bullName, tokens, costUSDC, bull }) => {
    // 1. Deduct from investor wallet balance
    setInvestorData(prev => {
      const existingHoldingIndex = prev.holdings.findIndex(h => h.bullId === bullId);
      let updatedHoldings = [...prev.holdings];

      if (existingHoldingIndex >= 0) {
        const existing = updatedHoldings[existingHoldingIndex];
        const newTokens = existing.tokensOwned + tokens;
        const newCost = existing.investedAmountUSDC + costUSDC;
        const newShare = ((newTokens / bull.totalTokens) * 100).toFixed(2) + '%';
        updatedHoldings[existingHoldingIndex] = {
          ...existing,
          tokensOwned: newTokens,
          investedAmountUSDC: newCost,
          currentValueUSDC: existing.currentValueUSDC + costUSDC,
          sharePercent: newShare
        };
      } else {
        updatedHoldings.unshift({
          bullId: bull.id,
          bullName: bull.name,
          breed: bull.breed,
          cabana: bull.cabana,
          image: bull.image,
          tokensOwned: tokens,
          sharePercent: ((tokens / bull.totalTokens) * 100).toFixed(2) + '%',
          investedAmountUSDC: costUSDC,
          currentValueUSDC: costUSDC,
          yieldClaimableUSDC: 0,
          totalYieldDistributedUSDC: 0,
          estimatedAPY: bull.estimatedAPY,
          htsTokenId: bull.htsTokenId,
          symbol: bull.symbol,
          strawsSoldInHoldings: 0,
        });
      }

      return {
        ...prev,
        walletBalanceUSDC: Math.max(0, prev.walletBalanceUSDC - costUSDC),
        totalInvestedUSDC: prev.totalInvestedUSDC + costUSDC,
        portfolioCurrentValueUSDC: prev.portfolioCurrentValueUSDC + costUSDC,
        holdings: updatedHoldings,
        transactions: [
          {
            id: `tx-${Date.now()}`,
            type: 'buy',
            title: `Inversión ${tokens} Fracciones - ${bullName}`,
            amount: `-${costUSDC.toFixed(2)} USDC`,
            date: 'Hoy (Testnet)',
            txHash: `0.0.651928@${Math.floor(Date.now() / 1000)}`,
            status: 'Confirmado en Hedera'
          },
          ...prev.transactions
        ]
      };
    });

    // 2. Increase sold tokens in bull record
    setBulls(prev => prev.map(b => {
      if (b.id === bullId) {
        const newSold = b.tokensSold + tokens;
        return {
          ...b,
          tokensSold: newSold,
          fundedPercent: Math.min(100, Math.round((newSold / b.totalTokens) * 100))
        };
      }
      return b;
    }));

    // 3. Add to seller balance
    setSellerData(prev => ({
      ...prev,
      walletBalanceUSDC: prev.walletBalanceUSDC + costUSDC,
      totalFundingRaisedUSDC: prev.totalFundingRaisedUSDC + costUSDC
    }));
  };

  // When investor claims accumulated yield
  const handleClaimYield = (claimedAmount) => {
    setInvestorData(prev => ({
      ...prev,
      walletBalanceUSDC: prev.walletBalanceUSDC + claimedAmount,
      claimableYieldUSDC: 0,
      totalYieldEarnedUSDC: prev.totalYieldEarnedUSDC + claimedAmount
    }));
  };

  return (
    <div className="min-h-screen bg-profundo text-blanco flex flex-col antialiased selection:bg-esmeralda/25 selection:text-esmeralda relative">
      
      {/* Top Navigation */}
      <Navbar
        currentRole={currentRole}
        setCurrentRole={setCurrentRole}
        activeView={activeView}
        setActiveView={setActiveView}
        sellerData={sellerData}
        investorData={investorData}
        walletConnected={walletConnected}
        setWalletConnected={setWalletConnected}
      />

      {/* Main Layout Area */}
      <div className="flex-1 flex max-w-[1600px] w-full mx-auto">
        
        {/* Left Sidebar (Desktop) */}
        <Sidebar
          currentRole={currentRole}
          activeView={activeView}
          setActiveView={setActiveView}
          sellerData={sellerData}
          investorData={investorData}
        />

        {/* Center Main View Area */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto max-w-full">
          
          {/* SELLER VIEWS */}
          {currentRole === 'seller' && (
            <>
              {activeView === 'seller-dashboard' && (
                <SellerDashboard
                  bulls={bulls}
                  sellerData={sellerData}
                  setActiveView={setActiveView}
                  onSelectBull={(bull) => setSelectedBull(bull)}
                />
              )}

              {activeView === 'seller-pricing' && (
                <BullPricingAndMinting
                  onBullMinted={handleBullMinted}
                  setActiveView={setActiveView}
                />
              )}

              {activeView === 'seller-wallet' && (
                <SellerWallet
                  sellerData={sellerData}
                />
              )}

              {activeView === 'seller-profile' && (
                <SellerProfile
                  sellerData={sellerData}
                  setActiveView={setActiveView}
                />
              )}
            </>
          )}

          {/* BUYER / INVESTOR VIEWS */}
          {currentRole === 'buyer' && (
            <>
              {activeView === 'buyer-marketplace' && (
                <Marketplace
                  bulls={bulls}
                  onSelectBull={(bull) => setSelectedBull(bull)}
                />
              )}

              {activeView === 'buyer-portfolio' && (
                <InvestorPortfolio
                  investorData={investorData}
                  onClaimYield={handleClaimYield}
                  onSelectBull={(bull) => setSelectedBull(bull)}
                  allBulls={bulls}
                />
              )}

              {activeView === 'buyer-profile' && (
                <InvestorProfile
                  investorData={investorData}
                />
              )}
            </>
          )}

        </main>

      </div>

      {/* Quick Interactive Modal: Bull Details & Fast Investment Panel */}
      {selectedBull && (
        <BullDetailModal
          bull={selectedBull}
          onClose={() => setSelectedBull(null)}
          onInvestSuccess={handleInvestSuccess}
          investorBalance={investorData.walletBalanceUSDC}
        />
      )}

      {/* Authentic Argentine Estancia Rural Backdrop with Dark Monte Treatment */}
      <div 
        className="fixed inset-0 pointer-events-none -z-20 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url('/assets/estancia_landscape.jpg')` }}
      />
      <div 
        className="fixed inset-0 pointer-events-none -z-10"
        style={{
          background: 'linear-gradient(180deg, rgba(16, 44, 36, 0.94) 0%, rgba(10, 29, 23, 0.96) 50%, rgba(10, 29, 23, 0.98) 100%)'
        }}
      />
    </div>
  );
}
