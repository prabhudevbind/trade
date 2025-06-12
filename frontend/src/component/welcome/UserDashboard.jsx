import React from 'react'
import MyContests from '../admin/contest/MyContest'
import { useGetUserByIdQuery } from '@/store/api/userSliceApi'
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DollarSign, Loader2, User, Mail } from "lucide-react"

export default function UserDashboard() {
    const { data: user, isLoading, isError } = useGetUserByIdQuery();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    if (isError) {
        return (
            <div className="flex items-center justify-center h-screen text-red-500">
                Error loading user data.
            </div>
        );
    }

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    };

    return (
        <div className="container mx-auto px-4 py-6">
            <Card className="p-6 mb-6">
                <div className="grid md:grid-cols-2 gap-6">
                    {/* User Info */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center">
                                <User className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold">
                                    {user.firstName} {user.lastName}
                                </h2>
                                <div className="flex items-center gap-2 text-gray-500">
                                    <Mail className="h-4 w-4" />
                                    <span>{user.email}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Wallet Section */}
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
                        <div>
                            <p className="text-sm text-gray-600">Wallet Balance</p>
                            <p className="text-2xl font-bold text-blue-600">
                                {formatCurrency(user.amount)}
                            </p>
                        </div>
                        <Button
                            onClick={() => window.location.href = '/wallet'}
                            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
                        >
                            <DollarSign className="mr-2 h-4 w-4" />
                            Add Money
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Contests Section */}
            <MyContests />
        </div>
    )
}
