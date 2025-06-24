import React, { useState } from "react";
import WithDrawUpiId from "../wallet/WithDrawUpiId";
import { useGetUserByIdQuery } from "@/store/api/userSliceApi";
import { useCreateWalletTransactionMutation, useGetWalletTransactionsQuery } from "@/store/api/contest";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function Withdrawals() {
  const {
    data: user,
    isLoading: userLoading,
    error: userError,
    refetch: refetchUser,
  } = useGetUserByIdQuery();
  const [createWalletTransaction] = useCreateWalletTransactionMutation();

  const {
      data: txData,
      isLoading: txLoading,
      error: txError,
    } = useGetWalletTransactionsQuery();
  const withdrawals = (txData?.transactions || []).filter(
    tx => tx.type === 'DEBIT' && tx.payment_method === 'WITHDRAWAL'
  );

  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleWithdraw = async (e) => {
    e.preventDefault();
    setMsg("");
    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      setMsg("Enter a valid amount");
      return;
    }
    if (Number(amount) > (user?.amount || 0)) {
      setMsg("You cannot withdraw more than your available balance.");
      return;
    }
    setIsLoading(true);
    try {
      await createWalletTransaction({
        amount: Number(amount),
        type: "DEBIT",
        status: "PENDING",
        description: "Withdrawal request",
        payment_method: "WITHDRAWAL",
      }).unwrap();
      setMsg(
        "Withdrawal request submitted! Withdrawals are processed within 24-48 hours."
      );
      setAmount("");
      refetchUser();
    } catch (err) {
      setMsg("Failed to submit withdrawal request");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <WithDrawUpiId />
    
      <Card className="max-w-md  mt-6">
        <CardHeader>
          <CardTitle className="text-base">Request Withdrawal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-2 text-xs text-gray-600">
            Available Balance: <b>₹{user?.amount ?? 0}</b>
          </div>
          <form
            onSubmit={handleWithdraw}
            className="flex flex-col gap-3"
          >
            <Input
              type="number"
              min="1"
              max={user?.amount || 0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount to withdraw"
              className="w-full"
            />
            <Button
              type="submit"
              disabled={isLoading || !amount}
              size="sm"
            >
              {isLoading ? "Requesting..." : "Request Withdrawal"}
            </Button>
          </form>
          <Alert variant="info" className="mt-3 text-xs">
            <AlertDescription>
              Withdrawals are processed within <b>24-48 hours</b>.
              <br />
              You will be notified once your request is processed.
            </AlertDescription>
          </Alert>
          {msg && (
            <Alert
              variant={msg.includes("submitted") ? "success" : "destructive"}
              className="mt-2 text-xs"
            >
              <AlertDescription>{msg}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Withdrawal History */}
      <Card className="max-w-md mt-6">
        <CardHeader>
          <CardTitle className="text-base">Withdrawal History</CardTitle>
        </CardHeader>
        <CardContent>
          {txLoading ? (
            <div className="py-6 text-center text-gray-400">Loading...</div>
          ) : txError ? (
            <div className="py-6 text-center text-red-500">Failed to load withdrawals</div>
          ) : withdrawals.length === 0 ? (
            <div className="py-6 text-center text-gray-400">No withdrawal requests found.</div>
          ) : (
            <div className="overflow-x-auto">
              {/* Desktop Table */}
              <table className="hidden sm:table min-w-full text-xs sm:text-sm">
                <thead>
                  <tr>
                    <th className="text-left p-2">Date</th>
                    <th className="text-left p-2">Amount</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Verify</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map(tx => (
                    <tr key={tx.id} className="border-b">
                      <td className="p-2">{new Date(tx.created_at).toLocaleString()}</td>
                      <td className="p-2 font-semibold">₹{tx.amount}</td>
                      <td className="p-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${tx.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : tx.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>{tx.status}</span>
                      </td>
                      <td className="p-2">
                        {tx.payment_verify ? (
                          <span className="text-green-600 font-bold">Verified</span>
                        ) : (
                          <span className="text-red-500 font-bold">Not Verified</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Mobile Cards */}
              <div className="sm:hidden space-y-3 mt-2">
                {withdrawals.map(tx => (
                  <div key={tx.id} className={`rounded-lg border p-3 bg-gray-50 flex flex-col gap-1 ${tx.payment_verify === false ? 'border-red-400 bg-red-50' : ''}`}>
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-xs">{new Date(tx.created_at).toLocaleString()}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${tx.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : tx.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>{tx.status}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-base font-bold">₹{tx.amount}</span>
                      {tx.payment_verify ? (
                        <span className="text-green-600 font-bold">Verified</span>
                      ) : (
                        <span className="text-red-500 font-bold animate-pulse">Not Verified</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
