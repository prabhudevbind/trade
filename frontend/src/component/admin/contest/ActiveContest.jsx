"use client"

import { useState } from "react"
import {
  useGetContestsQuery,
  useCreateWalletTransactionMutation,
  useCreateContestParticipantMutation,
  useGetContestParticipantByIdQuery,
} from "@/store/api/contest"
import { useGetUserByIdQuery } from "@/store/api/userSliceApi"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import {
  AlertCircle,
  CalendarIcon,
  CheckCircle2,
  Coins,
  DollarSign,
  LineChart,
  Loader2,
  Trophy,
  Wallet,
} from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Link } from "react-router-dom"

export default function ActiveContests() {
  const [transactionError, setTransactionError] = useState(null)
  const [transactionSuccess, setTransactionSuccess] = useState(null)
  const [processingContestId, setProcessingContestId] = useState(null);

  // Fetch data
  const { data: activeData, isLoading, error: contestError } = useGetContestsQuery()
  const { data: user, isLoading: userLoading, error: userError, refetch } = useGetUserByIdQuery()

  // Filter contests based on the new API response format
  const contests = activeData?.contests || []
  
  // Filter contests based on hasJoined flag from API
  const joinedContests = contests.filter(contest => contest.hasJoined)
  const availableContests = contests.filter(contest => !contest.hasJoined)

  // Group available contests by status
  const upcomingContests = availableContests.filter(
    contest => new Date(contest.startTime) > new Date()
  )

  const ongoingContests = availableContests.filter(contest => {
    const now = new Date()
    const startTime = new Date(contest.startTime)
    const endTime = new Date(contest.endTime)
    return now >= startTime && now <= endTime
  })

  const [createWalletTransaction, { isLoading: isTransactionLoading }] = useCreateWalletTransactionMutation()
  const [createContestParticipant, { isLoading: isParticipantLoading }] = useCreateContestParticipantMutation()

  // Get user's current wallet balance
  const userBalance = user?.amount ? Number.parseFloat(user.amount) || 0 : 0

  const handleJoinContest = async (contestId, entryFee) => {
    setTransactionError(null)
    setTransactionSuccess(null)
    setProcessingContestId(contestId)

    if (userBalance < entryFee) {
      // Redirect to wallet page instead of showing modal
      window.location.href = '/wallet'
      return
    }

    try {
      // First create a pending transaction
      const transactionData = {
        amount: entryFee,
        type: "DEBIT",
        status: "PENDING",
        contest_id: contestId,
      }

      const transactionResponse = await createWalletTransaction(transactionData).unwrap()

      try {
        // Try to join the contest
        const participantData = {
          contest_id: contestId,
          virtual_cash: 100000.0,
        }

        await createContestParticipant(participantData).unwrap()

        // If successful, update transaction to COMPLETED
        await createWalletTransaction({
          ...transactionData,
          id: transactionResponse.id,
          status: "COMPLETED"
        }).unwrap()

        setTransactionSuccess(`Successfully joined contest! Transaction ID: ${transactionResponse.id}`)
        refetch()
      } catch (participantError) {
        // If joining fails, refund the amount by creating a credit transaction
        const refundData = {
          amount: entryFee,
          type: "CREDIT",
          status: "COMPLETED",
          contest_id: contestId,
          description: "Refund for failed contest join"
        }

        await createWalletTransaction(refundData).unwrap()

        throw new Error(participantError?.data?.message || "Failed to join contest")
      }
    } catch (err) {
      setTransactionError(err?.message || "Failed to join contest. Your money has been refunded.")
      console.error("Join contest error:", err)
    } finally {
      setProcessingContestId(null)
    }
  }

  if (isLoading || userLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading contests...</span>
      </div>
    )
  }

  if (contestError) {
    return (
      <Alert variant="destructive" className="max-w-4xl mx-auto my-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Failed to load contests: {contestError?.data?.message || "Unknown error"}</AlertDescription>
      </Alert>
    )
  }

  if (userError) {
    return (
      <Alert variant="destructive" className="max-w-4xl mx-auto my-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Failed to load user data: {userError?.data?.message || "Unknown error"}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-8 max-w-6xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Available Contests</h1>
          <p className="text-muted-foreground">Join trading contests and compete with others</p>
        </div>
        <div className="flex items-center gap-3">
          <Card className="bg-green-50 border-green-200 shadow-sm p-3 flex items-center gap-3">
            <Wallet className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm text-green-800">Wallet Balance</p>
              <p className="font-semibold text-green-700">{formatCurrency(userBalance)}</p>
            </div>
          </Card>
          
            <Link to="/wallet" className="flex items-center gap-2">
            <Button
            variant="outline"
            className="flex items-center gap-2"
            onClick={() => window.location.href = '/wallet'}
          >
              <Wallet className="h-4 w-4" />
               Add Money
                     </Button>
            </Link>
    
        
           
         
        </div>
      </div>

      {transactionSuccess && (
        <Alert className="bg-green-50 border-green-200 text-green-800">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription>{transactionSuccess}</AlertDescription>
        </Alert>
      )}

      {transactionError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{transactionError}</AlertDescription>
        </Alert>
      )}

      {/* Joined Contests Section */}
      {joinedContests.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xl flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Your Active Contests
            </CardTitle>
            <CardDescription>Contests you've already joined</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {joinedContests.map((contest) => (
                <Card key={contest.id} className="border-primary/20 bg-primary/5">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{contest.name}</CardTitle>
                      <Badge className="bg-primary/20 text-primary hover:bg-primary/30">Joined</Badge>
                    </div>
                    <CardDescription className="flex items-center gap-1">
                      <LineChart className="h-4 w-4" />
                      {contest.trading_instrument}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pb-3">
                    <div className="grid grid-cols-2 gap-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Entry Fee:</span>
                      </div>
                      <div className="font-medium text-right">{formatCurrency(contest.entry_fee)}</div>

                      <div className="flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Starts:</span>
                      </div>
                      <div className="font-medium text-right">{formatDate(contest.start_time)}</div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => (window.location.href = "/my-contests")}
                    >
                      View Details
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Contests Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xl flex items-center gap-2">
            <Coins className="h-5 w-5" />
            Available Contests
          </CardTitle>
          <CardDescription>Join these contests to start trading</CardDescription>
        </CardHeader>
        <CardContent>
          {availableContests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No new contests available. You've joined all active contests.
            </div>
          ) : (
            <Tabs defaultValue="ongoing">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="ongoing">
                  Ongoing
                  <Badge variant="secondary" className="ml-2">
                    {ongoingContests.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="upcoming">
                  Upcoming
                  <Badge variant="secondary" className="ml-2">
                    {upcomingContests.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="ongoing">
                {ongoingContests.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    No ongoing contests available at the moment.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {ongoingContests.map((contest) => (
                      <ContestCard
                        key={contest.id}
                        contest={contest}
                        userBalance={userBalance}
                        handleJoinContest={handleJoinContest}
                        isLoading={processingContestId === contest.id}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="upcoming">
                {upcomingContests.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    No upcoming contests available at the moment.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {upcomingContests.map((contest) => (
                      <ContestCard
                        key={contest.id}
                        contest={contest}
                        userBalance={userBalance}
                        handleJoinContest={handleJoinContest}
                        isLoading={processingContestId === contest.id}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ContestCard({ contest, userBalance, handleJoinContest, isLoading }) {
  const entryFee = Number.parseFloat(contest.entryFee) || 0
  const canAfford = userBalance >= entryFee
  const shortfall = canAfford ? 0 : entryFee - userBalance
  const startDate = new Date(contest.startTime)
  const endDate = new Date(contest.endTime)
  const now = new Date()
  const isOngoing = now >= startDate && now <= endDate
  const isUpcoming = now < startDate

  return (
    <Card className="overflow-hidden transition-all hover:shadow-md">
      <div className="flex flex-col md:flex-row">
        <div className="flex-grow p-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            <div>
              <h3 className="text-xl font-semibold text-gray-800">{contest.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={isOngoing ? "default" : "outline"}>{isOngoing ? "Ongoing" : "Upcoming"}</Badge>
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <LineChart className="h-3.5 w-3.5" />
                  {contest.tradingInstrument}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2 sm:mt-0">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Entry Fee</p>
                <p className="font-semibold text-lg">{formatCurrency(contest.entryFee)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Participants</p>
                <p className="font-medium">{contest.totalParticipants}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div>
              <p className="text-sm text-muted-foreground">Start Time</p>
              <p className="font-medium flex items-center gap-1">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                {formatDate(contest.startTime)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">End Time</p>
              <p className="font-medium flex items-center gap-1">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                {formatDate(contest.endTime)}
              </p>
            </div>
          </div>

          {!canAfford && (
            <Alert className="mt-4 py-2 bg-amber-50 border-amber-200 text-amber-800">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="flex items-center gap-1">
                Need {formatCurrency(shortfall)} more to join
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="flex items-center justify-center p-6 bg-muted/20 md:w-48">
          <Button
            onClick={() => 
              canAfford 
                ? handleJoinContest(contest.id, entryFee)
                : window.location.href = '/wallet'
            }
            disabled={isLoading}
            className="w-full"
            variant={canAfford ? "default" : "secondary"}
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Joining...
              </div>
            ) : canAfford ? (
              "Join Contest"
            ) : (
              "Add Money"
            )}
          </Button>
        </div>
      </div>
    </Card>
  )
}
