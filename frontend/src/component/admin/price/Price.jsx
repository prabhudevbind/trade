"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Trophy,
  Users,
  DollarSign,
  Target,
  Trash2,
  Plus,
  Eye,
  Save,
  Sparkles,
  AlertCircle,
  CheckCircle,
  Settings,
} from "lucide-react"
import { useGetContestParticipantsQuery, useGetContestsQuery } from "@/store/api/contest"


export default function ContestPrizeDistribution() {
  const [selectedContestId, setSelectedContestId] = useState("")
  const [prizes, setPrizes] = useState([])
  const [newPrize, setNewPrize] = useState({ from: "", to: "", percentage: "" })
  const [platformFeePercentage, setPlatformFeePercentage] = useState(20)
  const [isLoading, setIsLoading] = useState(false)
  const [notifications, setNotifications] = useState([])

const { data: contestsData } = useGetContestsQuery()
  const { data: participantsData } = useGetContestParticipantsQuery()
  // Filter ongoing contests
  const ongoingContests = contestsData?.contests?.filter((contest) => contest.status === "ongoing") || []

  // Get selected contest details
  const selectedContest = ongoingContests.find((contest) => contest.id === parseInt(selectedContestId))

  // Get participants for selected contest
  const contestParticipants =
    participantsData?.participants?.filter(
      (participant) => participant.contestInfo.id === parseInt(selectedContestId),
    ) || []

  // Calculate contest financials
  const totalParticipants = contestParticipants.length
  const entryFee = selectedContest?.entry_fee || 0
  const totalAmount = totalParticipants * parseFloat(entryFee)
  const platformFee = (totalAmount * platformFeePercentage) / 100
  const prizePool = totalAmount - platformFee

  // Calculate total percentage used
  const totalPercentageUsed = prizes.reduce((sum, prize) => sum + parseFloat(prize.percentage || 0), 0)
  const remainingPercentage = 100 - totalPercentageUsed

  // Toast notification function
  const showToast = (title, description, variant = "default") => {
    const id = Date.now()
    const newNotification = { id, title, description, variant }
    setNotifications(prev => [...prev, newNotification])
    
    // Auto remove after 3 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id))
    }, 3000)
  }

  const handleChange = (e) => {
    setNewPrize({ ...newPrize, [e.target.name]: e.target.value })
  }

  const handleAddPrize = () => {
    const from = parseInt(newPrize.from)
    const to = parseInt(newPrize.to)
    const percentage = parseFloat(newPrize.percentage)

    if (isNaN(from) || isNaN(to) || isNaN(percentage)) {
      showToast("Invalid Input", "Please enter valid values for all fields", "destructive")
      return
    }
    if (from > to) {
      showToast("Invalid Range", '"From" rank should be less than or equal to "To" rank.', "destructive")
      return
    }
    // if (to > totalParticipants) {
    //   showToast("Invalid Range", `"To" rank cannot exceed total participants (${totalParticipants})`, "destructive")
    //   return
    // }
    if (percentage <= 0 || percentage > remainingPercentage) {
      showToast("Invalid Percentage", `Percentage should be between 0 and ${remainingPercentage}%`, "destructive")
      return
    }

    // Check for overlapping ranges
    const hasOverlap = prizes.some(prize => 
      (from >= prize.from && from <= prize.to) ||
      (to >= prize.from && to <= prize.to) ||
      (from <= prize.from && to >= prize.to)
    )

    if (hasOverlap) {
      showToast("Overlapping Range", "This rank range overlaps with an existing prize range", "destructive")
      return
    }

    const prizeAmount = (prizePool * percentage) / 100
    const rangeCount = to - from + 1
    const prizePerWinner = prizeAmount / rangeCount

    setPrizes([
      ...prizes,
      {
        ...newPrize,
        from,
        to,
        percentage,
        totalAmount: prizeAmount,
        prizePerWinner,
      },
    ])
    setNewPrize({ from: "", to: "", percentage: "" })

    showToast("Prize Added", "Prize range has been successfully added")
  }

  const handleDelete = (index) => {
    setPrizes(prizes.filter((_, i) => i !== index))
    showToast("Prize Removed", "Prize range has been removed")
  }

  const formatCurrency = (amount) => `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`

  // Auto-suggest prize structure
  const suggestPrizeStructure = () => {
    if (totalParticipants < 3) {
      showToast("Insufficient Participants", "Need at least 3 participants for auto-suggestion", "destructive")
      return
    }

    const suggestions = []
    if (totalParticipants >= 10) {
      suggestions.push(
        { from: 1, to: 1, percentage: 40 },
        { from: 2, to: 2, percentage: 25 },
        { from: 3, to: 3, percentage: 15 },
        { from: 4, to: Math.min(10, totalParticipants), percentage: 20 },
      )
    } else if (totalParticipants >= 5) {
      suggestions.push(
        { from: 1, to: 1, percentage: 50 },
        { from: 2, to: 2, percentage: 30 },
        { from: 3, to: 3, percentage: 20 },
      )
    } else {
      suggestions.push({ from: 1, to: 1, percentage: 60 }, { from: 2, to: 2, percentage: 40 })
    }

    const updatedSuggestions = suggestions.map((prize) => {
      const prizeAmount = (prizePool * prize.percentage) / 100
      const rangeCount = prize.to - prize.from + 1
      const prizePerWinner = prizeAmount / rangeCount
      return {
        ...prize,
        totalAmount: prizeAmount,
        prizePerWinner,
      }
    })

    setPrizes(updatedSuggestions)
    showToast("Prize Structure Suggested", "Auto-generated prize structure has been applied")
  }

  // Save prize distribution with API call
const savePrizeDistribution = async () => {
  if (!selectedContestId || prizes.length === 0) {
    showToast("Cannot Save", "Please select a contest and add at least one prize", "destructive")
    return
  }

  setIsLoading(true)
  try {
    const prizeData = {
      contestId: selectedContestId,
      platformFeePercentage,
      totalAmount,
      prizePool,
      platformFee,
      prizes: prizes.map((prize) => ({
        fromRank: prize.from,
        toRank: prize.to,
        percentage: prize.percentage,
        totalAmount: prize.totalAmount,
        prizePerWinner: prize.prizePerWinner,
      })),
    }

    // Make API call to save prize distribution
    const response = await fetch('/api/prize-distribution', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add authorization header if needed
        // 'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(prizeData)
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    console.log("Prize distribution saved:", result)

    showToast("Success!", "Prize distribution has been saved successfully")
    
    // Optional: Reset form or redirect after successful save
    // resetForm()
    // navigate('/contests')
    
  } catch (error) {
    console.error("Error saving prize distribution:", error)
    showToast("Error", "Failed to save prize distribution. Please try again.", "destructive")
  } finally {
    setIsLoading(false)
  }
}

// Alternative version with different API endpoint structure
const savePrizeDistributionAlternative = async () => {
  if (!selectedContestId || prizes.length === 0) {
    showToast("Cannot Save", "Please select a contest and add at least one prize", "destructive")
    return
  }

  setIsLoading(true)
  try {
    const prizeData = {
      contestId: selectedContestId,
      platformFeePercentage,
      totalAmount,
      prizePool,
      platformFee,
      prizes: prizes.map((prize) => ({
        fromRank: prize.from,
        toRank: prize.to,
        percentage: prize.percentage,
        totalAmount: prize.totalAmount,
        prizePerWinner: prize.prizePerWinner,
      })),
    }

    // If your API expects contest ID in the URL
    const response = await fetch(`/api/contests/${selectedContestId}/prize-distribution`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add authorization header if needed
        // 'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        platformFeePercentage,
        totalAmount,
        prizePool,
        platformFee,
        prizes: prizes.map((prize) => ({
          fromRank: prize.from,
          toRank: prize.to,
          percentage: prize.percentage,
          totalAmount: prize.totalAmount,
          prizePerWinner: prize.prizePerWinner,
        })),
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    console.log("Prize distribution saved:", result)

    showToast("Success!", "Prize distribution has been saved successfully")
    
  } catch (error) {
    console.error("Error saving prize distribution:", error)
    
    // More specific error handling
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      showToast("Network Error", "Please check your internet connection and try again.", "destructive")
    } else if (error.message.includes('401')) {
      showToast("Authentication Error", "Please log in again.", "destructive")
    } else if (error.message.includes('403')) {
      showToast("Permission Error", "You don't have permission to perform this action.", "destructive")
    } else {
      showToast("Error", error.message || "Failed to save prize distribution. Please try again.", "destructive")
    }
  } finally {
    setIsLoading(false)
  }
}

  // Function to save information to the database
  const saveInfoToDatabase = async (info) => {
    try {
      const response = await fetch("/api/your-endpoint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(info),
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log("Information saved successfully:", data)
        showToast("Success", "Information saved to database")
      } else {
        const errorData = await response.json()
        console.error("Failed to save information:", errorData)
        showToast("Error", "Failed to save to database", "destructive")
      }
    } catch (error) {
      console.error("Error saving information:", error)
      showToast("Error", "Network error while saving", "destructive")
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-2 md:p-6">
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.map((notification) => (
          <Alert
            key={notification.id}
            className={`w-80 shadow-lg ${
              notification.variant === "destructive" ? "border-red-500 bg-red-50" : "border-green-500 bg-green-50"
            }`}
          >
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>{notification.title}:</strong> {notification.description}
            </AlertDescription>
          </Alert>
        ))}
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <CardHeader className="text-center pb-6">
            <div className="flex justify-center mb-4">
              <Trophy className="h-12 w-12" />
            </div>
            <CardTitle className="text-3xl md:text-4xl font-bold">Contest Prize Distribution</CardTitle>
            <CardDescription className="text-blue-100 text-lg">
              Distribute prizes fairly among contest participants
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Contest Selection */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Select Contest
            </CardTitle>
            <CardDescription>Choose an ongoing contest to configure prize distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={selectedContestId}
              onValueChange={(value) => {
                setSelectedContestId(value)
                setPrizes([])
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a contest..." />
              </SelectTrigger>
              <SelectContent>
                {ongoingContests.map((contest) => (
                  <SelectItem key={contest.id} value={contest.id.toString()}>
                    <div className="flex items-center justify-between w-full">
                      <span>{contest.name}</span>
                      <Badge variant="secondary" className="ml-2">
                        {contest._count.contestParticipants} participants
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {selectedContest && (
          <>
            {/* Contest Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="shadow-lg border-l-4 border-l-green-500">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Participants</p>
                      <p className="text-3xl font-bold text-green-600">{totalParticipants}</p>
                    </div>
                    <Users className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-lg border-l-4 border-l-blue-500">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Entry Fee</p>
                      <p className="text-3xl font-bold text-blue-600">{formatCurrency(entryFee)}</p>
                    </div>
                    <DollarSign className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-lg border-l-4 border-l-purple-500">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Collection</p>
                      <p className="text-3xl font-bold text-purple-600">{formatCurrency(totalAmount)}</p>
                    </div>
                    <Target className="h-8 w-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-lg border-l-4 border-l-orange-500">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Prize Pool ({100 - platformFeePercentage}%)</p>
                      <p className="text-3xl font-bold text-orange-600">{formatCurrency(prizePool)}</p>
                    </div>
                    <Trophy className="h-8 w-8 text-orange-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabs for different sections */}
            <Tabs defaultValue="distribution" className="space-y-6">
              <TabsList className="grid w-full grid-cols-3 gap-1">
                <TabsTrigger value="distribution">Prize Distribution</TabsTrigger>
                <TabsTrigger value="participants">Participants</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>

              <TabsContent value="distribution" className="space-y-6">
                {/* Quick Actions */}
                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5" />
                      Quick Actions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <Button onClick={suggestPrizeStructure} className="flex-1" disabled={totalParticipants < 3}>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Auto-suggest Structure
                      </Button>
                      <Button variant="outline" onClick={() => setPrizes([])} className="flex-1" disabled={prizes.length === 0}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Clear All Prizes
                      </Button>
                      <Button
                        onClick={savePrizeDistribution}
                        disabled={isLoading}
                        className="flex-1"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {isLoading ? "Saving..." : "Save Distribution"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Prize Entry Form */}
                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle>Add Prize Range</CardTitle>
                    <CardDescription>Configure prize distribution for specific rank ranges</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="from">From Rank</Label>
                        <Input
                          id="from"
                          name="from"
                          type="number"
                          value={newPrize.from}
                          onChange={handleChange}
                          placeholder="1"
                          min="1"
                          max={totalParticipants}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="to">To Rank</Label>
                        <Input
                          id="to"
                          name="to"
                          type="number"
                          value={newPrize.to}
                          onChange={handleChange}
                          placeholder="1"
                          min="1"
                          max={totalParticipants}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="percentage">Percentage (%)</Label>
                        <Input
                          id="percentage"
                          name="percentage"
                          type="number"
                          value={newPrize.percentage}
                          onChange={handleChange}
                          placeholder="10"
                          min="0.1"
                          max={remainingPercentage}
                          step="0.1"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>&nbsp;</Label>
                        <Button onClick={handleAddPrize} disabled={remainingPercentage <= 0} className="w-full">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Prize
                        </Button>
                      </div>
                    </div>

                    <Alert className={remainingPercentage <= 0 ? "border-red-500 bg-red-50" : ""}>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Remaining percentage to distribute: <strong>{remainingPercentage.toFixed(1)}%</strong>
                        {totalPercentageUsed === 100 && (
                          <span className="text-green-600 ml-2">✓ Ready to save!</span>
                        )}
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>

                {/* Prize Distribution Table */}
                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle>Prize Distribution Overview</CardTitle>
                    <CardDescription>Current prize allocation across different ranks</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Rank Range</TableHead>
                            <TableHead>Winners</TableHead>
                            <TableHead>Percentage</TableHead>
                            <TableHead>Total Prize</TableHead>
                            <TableHead>Per Winner</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {prizes
                            .sort((a, b) => a.from - b.from)
                            .map((prize, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">
                                <Badge variant="outline">
                                  {prize.from === prize.to ? `#${prize.from}` : `#${prize.from} - #${prize.to}`}
                                </Badge>
                              </TableCell>
                              <TableCell>{prize.to - prize.from + 1}</TableCell>
                              <TableCell>
                                <Badge variant="secondary">{prize.percentage}%</Badge>
                              </TableCell>
                              <TableCell className="font-semibold text-green-600">
                                {formatCurrency(prize.totalAmount)}
                              </TableCell>
                              <TableCell className="font-semibold text-blue-600">
                                {formatCurrency(prize.prizePerWinner)}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(index)}
                                  className="text-red-600 hover:text-red-800"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                          {prizes.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                No prizes configured yet. Add prize ranges above.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                {/* Summary */}
                {prizes.length > 0 && (
                  <Card className="shadow-lg border-l-4 border-l-green-500">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        Prize Distribution Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground mb-2">Total Prize Money Distributed</p>
                          <p className="text-3xl font-bold text-green-600">
                            {formatCurrency(prizes.reduce((sum, prize) => sum + prize.totalAmount, 0))}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground mb-2">Percentage Distributed</p>
                          <p className="text-3xl font-bold text-blue-600">{totalPercentageUsed.toFixed(1)}%</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground mb-2">Total Winners</p>
                          <p className="text-3xl font-bold text-purple-600">
                            {prizes.reduce((sum, prize) => sum + (prize.to - prize.from + 1), 0)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="participants" className="space-y-6">
                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Contest Participants ({contestParticipants.length})
                    </CardTitle>
                    <CardDescription>View all participants registered for this contest</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-96">
                      <div className="space-y-3">
                        {contestParticipants.map((participant, index) => (
                          <div key={participant.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                            <div className="flex items-center gap-3">
                              <Badge variant="outline">#{index + 1}</Badge>
                              <div>
                                <p className="font-medium">{participant.name}</p>
                                <p className="text-sm text-muted-foreground">{participant.email}</p>
                              </div>
                            </div>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        {contestParticipants.length === 0 && (
                          <div className="text-center text-muted-foreground py-8">
                            No participants found for this contest.
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="settings" className="space-y-6">
                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Platform Settings
                    </CardTitle>
                    <CardDescription>Configure platform fee and other settings</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="platformFee">Platform Fee (%)</Label>
                        <Input
                          id="platformFee"
                          type="number"
                          value={platformFeePercentage}
                          onChange={(e) => setPlatformFeePercentage(parseFloat(e.target.value) || 0)}
                          min="0"
                          max="50"
                        />
                        <p className="text-sm text-muted-foreground">
                          Current platform fee: {formatCurrency(platformFee)}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Prize Pool Distribution</Label>
                        <div className="p-4 border rounded-lg bg-muted/50">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm">Prize Pool:</span>
                            <span className="font-medium">{100 - platformFeePercentage}%</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm">Platform Fee:</span>
                            <span className="font-medium">{platformFeePercentage}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="pt-4 border-t">
                      <Button 
                        onClick={() => saveInfoToDatabase({ price: 123, symbol: "NIFTY" })}
                        className="w-full"
                      >
                        Test Database Save
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  )
}