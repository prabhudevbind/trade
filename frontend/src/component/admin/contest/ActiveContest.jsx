"use client"

import { useEffect, useState } from "react"
import {
  useGetContestsQuery,
  useCreateWalletTransactionMutation,
  useCreateContestParticipantMutation,
} from "@/store/api/contest"
import { useGetUserByIdQuery } from "@/store/api/userSliceApi"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
  Lock,
  Clock,
  Users,
  TrendingUp,
  ArrowRight,
} from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Link, useNavigate } from "react-router-dom"

// Enhanced Loader Component
function EnhancedLoader({ message = "Loading...", size = "default" }) {
  const sizeClasses = {
    small: "h-4 w-4",
    default: "h-8 w-8",
    large: "h-12 w-12"
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] space-y-4">
      <div className="relative">
        <Loader2 className={`${sizeClasses[size]} animate-spin text-primary`} />
        <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-pulse"></div>
      </div>
      <div className="text-center space-y-2">
        <p className="text-muted-foreground font-medium">{message}</p>
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
          <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce"></div>
        </div>
      </div>
    </div>
  )
}

// Contest switching confirmation dialog
function ContestSwitchDialog({ 
  isOpen, 
  onClose, 
  onConfirm, 
  currentContest, 
  newContest, 
  isLoading 
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Switch Contest?
          </DialogTitle>
          <DialogDescription className="space-y-3 pt-2">
            <p>You are currently participating in:</p>
            <div className="bg-muted p-3 rounded-lg">
              <p className="font-medium text-foreground">{currentContest?.name}</p>
              <p className="text-sm text-muted-foreground">Entry fee: {formatCurrency(currentContest?.entry_fee)}</p>
            </div>
            
            <p>Do you want to leave this contest and join:</p>
            <div className="bg-primary/5 border border-primary/20 p-3 rounded-lg">
              <p className="font-medium text-foreground">{newContest?.name}</p>
              <p className="text-sm text-muted-foreground">Entry fee: {formatCurrency(newContest?.entry_fee)}</p>
            </div>
            
            <Alert className="bg-amber-50 border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                Your progress in the current contest will be lost and cannot be recovered.
              </AlertDescription>
            </Alert>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Switching...
              </>
            ) : (
              <>
                <ArrowRight className="h-4 w-4 mr-2" />
                Switch Contest
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function ActiveContests() {
  const [transactionError, setTransactionError] = useState(null)
  const [transactionSuccess, setTransactionSuccess] = useState(null)
  const [processingContestId, setProcessingContestId] = useState(null)
  const [showSwitchDialog, setShowSwitchDialog] = useState(false)
  const [switchingContests, setSwitchingContests] = useState({ current: null, new: null })
  const navigate = useNavigate()

  // Fetch data
  const { data: activeData, isLoading, error: contestError, refetch: refetchContests } = useGetContestsQuery()
  const { data: user, isLoading: userLoading, error: userError, refetch: refetchUser } = useGetUserByIdQuery()

  // Mutations
  const [createWalletTransaction, { isLoading: isTransactionLoading }] = useCreateWalletTransactionMutation()
  const [createContestParticipant, { isLoading: isParticipantLoading }] = useCreateContestParticipantMutation()

  useEffect(() => {
    // Refetch data when component mounts
    if (user) {
      refetchContests()
      refetchUser()
    }
  }, [])

  // Clear messages after 5 seconds
  useEffect(() => {
    if (transactionSuccess || transactionError) {
      const timer = setTimeout(() => {
        setTransactionSuccess(null)
        setTransactionError(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [transactionSuccess, transactionError])

  // Process contests data
  const contests = activeData?.contests || []
  const userBalance = user?.amount ? Number.parseFloat(user.amount) || 0 : 0

  // Enhanced contest processing with proper user participation detection
  const processedContests = contests.map(contest => {
    const isUserParticipant = contest.contestParticipants?.some(
      participant => participant.user_id === user?.id
    )
    
    return {
      ...contest,
      hasJoined: isUserParticipant,
      totalParticipants: contest._count?.contestParticipants || 0,
      entry_fee: Number.parseFloat(contest.entry_fee) || 0
    }
  })

  // Show both ongoing and upcoming contests, but only allow joining ongoing contests
  const now = new Date();
  const allContests = processedContests;
  // Fix: treat contest.status === 'upcoming' as upcoming, not just by date
  const ongoingContests = allContests.filter(contest => {
    const startTime = new Date(contest.start_time);
    const endTime = new Date(contest.end_time);
    return contest.status === 'ongoing' || (now >= startTime && now <= endTime);
  });
  const upcomingContests = allContests.filter(contest => {
    const startTime = new Date(contest.start_time);
    return contest.status === 'upcoming' || now < startTime;
  });

  // Check if user has any active contest
  const currentActiveContest = processedContests.find(contest => {
    const now = new Date()
    const endTime = new Date(contest.end_time)
    return contest.hasJoined && endTime > now // Contest hasn't ended yet
  })

  const hasActiveContest = !!currentActiveContest

  // Enhanced contest join handler with automatic switching
  const handleJoinContest = async (contestId, entry_fee, contestName) => {
    setTransactionError(null)
    setTransactionSuccess(null)
    setProcessingContestId(contestId)

    const targetContest = processedContests.find(c => c.id === contestId)

    // If user has active contest, show switch dialog
    if (hasActiveContest) {
      setSwitchingContests({ 
        current: currentActiveContest, 
        new: targetContest 
      })
      setShowSwitchDialog(true)
      setProcessingContestId(null)
      return
    }

    // Check balance
    if (userBalance < entry_fee) {
      navigate('/wallet')
      setProcessingContestId(null)
      return
    }

    // Proceed with joining
    await executeJoinContest(contestId, entry_fee, contestName)
  }

  // Execute the actual contest joining logic
  const executeJoinContest = async (contestId, entry_fee, contestName) => {
    try {
      setProcessingContestId(contestId)

      // Step 1: Create pending transaction
      const transactionData = {
        amount: entry_fee,
        type: "DEBIT",
        status: "PENDING",
        contest_id: contestId,
        description: `Entry fee for ${contestName}`
      }

      const transactionResponse = await createWalletTransaction(transactionData).unwrap()

      try {
        // Step 2: Join contest (backend will handle removing from current contest)
        const participantData = {
          contest_id: contestId,
          virtual_cash: 100000.0,
        }

        const participantResponse = await createContestParticipant(participantData).unwrap()

        // Step 3: Mark transaction as completed
        await createWalletTransaction({
          ...transactionData,
          id: transactionResponse.id,
          status: "COMPLETED"
        }).unwrap()

        // Success message based on whether user was switched
        const message = participantResponse.message || `Successfully joined ${contestName}!`
        setTransactionSuccess(`${message} (Transaction ID: ${transactionResponse.id})`)
        
        // Refresh data
        refetchContests()
        refetchUser()

      } catch (participantError) {
        // Step 4: Refund on failure
        const refundData = {
          amount: entry_fee,
          type: "CREDIT",
          status: "COMPLETED",
          contest_id: contestId,
          description: `Refund for failed contest join: ${contestName}`
        }

        await createWalletTransaction(refundData).unwrap()
        throw new Error(participantError?.data?.error || "Failed to join contest")
      }
    } catch (err) {
      setTransactionError(err?.message || "Failed to join contest. Your money has been refunded.")
      console.error("Join contest error:", err)
    } finally {
      setProcessingContestId(null)
      setShowSwitchDialog(false)
      setSwitchingContests({ current: null, new: null })
    }
  }

  // Handle contest switching confirmation
  const handleSwitchConfirm = async () => {
    const { new: newContest } = switchingContests
    if (newContest) {
      await executeJoinContest(newContest.id, newContest.entry_fee, newContest.name)
    }
  }

  // Get contest status and timing info
  const getContestStatus = (contest) => {
    const now = new Date()
    const startTime = new Date(contest.start_time)
    const endTime = new Date(contest.end_time)

    if (now < startTime) {
      return { status: 'upcoming', label: 'Upcoming', variant: 'outline' }
    } else if (now >= startTime && now <= endTime) {
      return { status: 'ongoing', label: 'Live', variant: 'default' }
    } else {
      return { status: 'ended', label: 'Ended', variant: 'secondary' }
    }
  }

  // Format contest timing in UTC
  const formatContestTimeUTC = (dateString) => {
    const date = new Date(dateString);
    return date.toUTCString();
  }

  if (isLoading || userLoading) {
    return <EnhancedLoader message="Loading contests and user data..." size="large" />
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
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Trading Contests</h1>
          <p className="text-muted-foreground mt-1">
            Join contests and compete with other traders (9:15 AM - 3:15 PM)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-full">
                <Wallet className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-green-800 font-medium">Wallet Balance</p>
                <p className="font-bold text-lg text-green-700">{formatCurrency(userBalance)}</p>
              </div>
            </CardContent>
          </Card>
          
          <Link to="/wallet">
            <Button variant="outline" className="flex items-center gap-2 hover:bg-primary/5">
              <Wallet className="h-4 w-4" />
              Add Money
            </Button>
          </Link>
        </div>
      </div>

      {/* Status Messages */}
      {transactionSuccess && (
        <Alert className="bg-green-50 border-green-200 text-green-800 animate-in slide-in-from-top-2">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="font-medium">{transactionSuccess}</AlertDescription>
        </Alert>
      )}

      {transactionError && (
        <Alert variant="destructive" className="animate-in slide-in-from-top-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="font-medium">{transactionError}</AlertDescription>
        </Alert>
      )}

      {/* Active Contest Notice */}
      {hasActiveContest && (
        <Alert className="bg-blue-50 border-blue-200 text-blue-800">
          <Trophy className="h-4 w-4 text-blue-600" />
          <AlertTitle>Currently Active</AlertTitle>
          <AlertDescription>
            You're participating in "{currentActiveContest.name}". You can switch to another contest anytime.
          </AlertDescription>
        </Alert>
      )}

      {/* Ongoing Contests Section */}
      <Card className="shadow-lg">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
          <CardTitle className="text-xl flex items-center gap-2">
            <Coins className="h-6 w-6 text-primary" />
            Ongoing Contests
          </CardTitle>
          <CardDescription>Participate in any ongoing contest</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {ongoingContests.length === 0 ? (
            <div className="text-center py-12">
              <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">No Ongoing Contests</h3>
              <p className="text-sm text-muted-foreground">No contests are live at the moment.</p>
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
                  hasActiveContest={hasActiveContest}
                  currentActiveContest={currentActiveContest}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Contests Section (view only, no join) */}
      <Card className="shadow-lg">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
          <CardTitle className="text-xl flex items-center gap-2">
            <CalendarIcon className="h-6 w-6 text-primary" />
            Upcoming Contests
          </CardTitle>
          <CardDescription>Upcoming contests (joining will open when live)</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {upcomingContests.length === 0 ? (
            <div className="text-center py-12">
              <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">No Upcoming Contests</h3>
              <p className="text-sm text-muted-foreground">No upcoming contests scheduled at the moment.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingContests.map((contest) => (
                <ContestCard
                  key={contest.id}
                  contest={contest}
                  userBalance={userBalance}
                  handleJoinContest={() => {}} // Disable join for upcoming
                  isLoading={false}
                  hasActiveContest={hasActiveContest}
                  currentActiveContest={currentActiveContest}
                  disableJoinButton={true}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contest Switch Dialog */}
      <ContestSwitchDialog
        isOpen={showSwitchDialog}
        onClose={() => {
          setShowSwitchDialog(false)
          setSwitchingContests({ current: null, new: null })
        }}
        onConfirm={handleSwitchConfirm}
        currentContest={switchingContests.current}
        newContest={switchingContests.new}
        isLoading={processingContestId !== null}
      />
    </div>
  )
}

// Enhanced Contest Card Component
function ContestCard({ contest, userBalance, handleJoinContest, isLoading, hasActiveContest, currentActiveContest, disableJoinButton }) {
  const navigate = useNavigate()
  const entry_fee = contest.entry_fee
  const canAfford = userBalance >= entry_fee
  const shortfall = canAfford ? 0 : entry_fee - userBalance
  
  const startDate = new Date(contest.start_time)
  const endDate = new Date(contest.end_time)
  const now = new Date()
  const isOngoing = now >= startDate && now <= endDate
  const isUpcoming = now < startDate
  
  const contestStatus = isOngoing ? 'Live' : 'Upcoming'
  const statusVariant = isOngoing ? 'default' : 'outline'

  const handleButtonClick = () => {
    if (canAfford) {
      handleJoinContest(contest.id, entry_fee, contest.name)
    } else {
      navigate('/wallet')
    }
  }

  const getButtonText = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          {hasActiveContest ? 'Switching...' : 'Joining...'}
        </div>
      )
    }
    
    if (!canAfford) {
      return (
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4" />
          Add Money
        </div>
      )
    }
    
    if (hasActiveContest) {
      return (
        <div className="flex items-center gap-2">
          <ArrowRight className="h-4 w-4" />
          Switch Contest
        </div>
      )
    }
    
    return (
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4" />
        Join Contest
      </div>
    )
  }

  return (
    <Card className="overflow-hidden transition-all hover:shadow-lg border-l-4 border-l-primary">
      <div className="flex flex-col lg:flex-row">
        <div className="flex-grow p-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
            <div className="flex-grow">
              <div className="flex items-start gap-3 mb-2">
                <h3 className="text-xl font-bold text-gray-800 leading-tight">{contest.name}</h3>
                <Badge variant={statusVariant} className="shrink-0">
                  {isOngoing && <div className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></div>}
                  {contestStatus}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <LineChart className="h-4 w-4" />
                <span className="text-sm font-medium">{contest.trading_instrument}</span>
              </div>
            </div>
            
            <div className="flex gap-4 sm:text-right">
              <div>
                <p className="text-sm text-muted-foreground">Entry Fee</p>
                <p className="font-bold text-xl text-primary">{formatCurrency(contest.entry_fee)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Participants</p>
                <p className="font-semibold text-lg flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {contest.totalParticipants}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground font-medium">Contest Period</p>
              {/* <p className="font-semibold text-sm">{formatDate(contest.start_time)} - {formatDate(contest.end_time)}</p> */}
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Daily: 9:15 AM - 3:15 PM
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground font-medium">Max Trades</p>
              <p className="font-semibold text-sm">{contest.maxTrade} trades per day</p>
              <p className="text-xs text-muted-foreground">Virtual cash: ₹1,00,000</p>
            </div>
          </div>

          {/* Warnings and Info */}
          {hasActiveContest && (
            <Alert className="mb-4 bg-amber-50 border-amber-200">
              <ArrowRight className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                You'll be moved from "{currentActiveContest?.name}" to this contest
              </AlertDescription>
            </Alert>
          )}

          {!canAfford && (
            <Alert className="mb-4 bg-red-50 border-red-200">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                Need {formatCurrency(shortfall)} more to join this contest
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="flex items-center justify-center p-6 bg-gradient-to-br from-muted/30 to-muted/50 lg:w-56">
          <Button
            onClick={handleButtonClick}
            disabled={isLoading || disableJoinButton}
            className="w-full h-12 text-base font-semibold"
            variant={canAfford ? "default" : "secondary"}
          >
            {getButtonText()}
          </Button>
        </div>
      </div>
    </Card>
  )
}