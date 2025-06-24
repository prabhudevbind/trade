"use client"
import React from "react"
import { useState } from "react"
import {
  useGetContestsQuery,
  useCreateContestMutation,
  useUpdateContestMutation,
  useDeleteContestMutation,
} from "@/store/api/contest"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  Loader2,
  Pencil,
  Trash2,
  Eye,
  Plus,
  Search,
  Filter,
  Download,
  RefreshCw,
  Users,
  Calendar,
  DollarSign,
  BarChart,
  AlertCircle,
  IndianRupee,
} from "lucide-react"
import { toast } from "react-toastify"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatCurrency } from "@/lib/utils"
import { Alert } from "@/components/ui/alert"

import { parseISO, format, isSameDay } from 'date-fns'

const formatDate = (dateString) => {
  try {
    if (!dateString) return "N/A";
    const date = parseISO(dateString);
    return format(date, "yyyy-MM-dd hh:mm a"); // Customize format as needed
  } catch (error) {
    console.error("Error formatting date:", error);
    return dateString;
  }
};


// Form schema for validation
const contestSchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name must be 255 characters or less"),
  startTime: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid start date"),
  endTime: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid end date"),
  entryFee: z
    .string()
    .refine(
      (val) => !isNaN(Number.parseFloat(val)) && Number.parseFloat(val) >= 0,
      "Entry fee must be a positive number",
    ),
  maxTrade: z
    .string()
    .refine((val) => !isNaN(Number.parseInt(val)) && Number.parseInt(val) >= 0, "Max trades must be a positive integer")
    .optional(),
  status: z.enum(["upcoming", "ongoing", "ended"]),
  tradingInstrument: z.enum(["NIFTY50", "BANKNIFTY", "BOTH"]),
})

// Helper function to check if contest is expired
const checkContestStatus = (contest) => {
  const now = new Date()
  const endTime = new Date(contest.end_time)
  return {
    ...contest,
    status: endTime < now ? "ended" : contest.status,
  }
}

export default function ContestManager() {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isUpdateOpen, setIsUpdateOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedContest, setSelectedContest] = useState(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedDateConflict, setSelectedDateConflict] = useState(false)
  const router = useNavigate()

  // RTK Query hooks
  const { data: contests, isLoading, error, refetch } = useGetContestsQuery()
  const [createContest, { isLoading: isCreating }] = useCreateContestMutation()
  const [updateContest, { isLoading: isUpdating }] = useUpdateContestMutation()
  const [deleteContest, { isLoading: isDeleting }] = useDeleteContestMutation()

  // Form hooks
  const createForm = useForm({
    resolver: zodResolver(contestSchema),
    defaultValues: {
      name: "",
      startTime: "",
      endTime: "",
      entryFee: "50.00",
      maxTrade: "5",
      status: "upcoming",
      tradingInstrument: "BOTH",
    },
  })

  const updateForm = useForm({
    resolver: zodResolver(contestSchema),
    defaultValues: {
      name: "",
      startTime: "",
      endTime: "",
      entryFee: "",
      maxTrade: "5",
      status: "upcoming",
      tradingInstrument: "BOTH",
    },
  })

  // Filter and search contests
  const filteredContests = contests
    ? contests.contests.map(checkContestStatus).filter((contest) => {
        const matchesSearch = contest.name.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesStatus = statusFilter === "all" || contest.status === statusFilter
        return matchesSearch && matchesStatus
      })
    : []

  // Group contests by status
  const upcomingContests = filteredContests.filter((contest) => contest.status === "upcoming")
  const ongoingContests = filteredContests.filter((contest) => contest.status === "ongoing")
  const endedContests = filteredContests.filter((contest) => contest.status === "ended")

  // Calculate total participants and entry fees
  const totalParticipants = filteredContests.reduce(
    (sum, contest) => sum + (contest.contestParticipants?.length || 0),
    0,
  )
  const totalEntryFees = filteredContests.reduce(
    (sum, contest) => sum + Number.parseFloat(contest.entry_fee) * (contest.contestParticipants?.length || 0),
    0,
  )

  // Handle create contest
  const handleCreate = async (data) => {
    try {
      const payload = {
        name: data.name,
        startTime: data.startTime,
        endTime: data.endTime,
        entryFee: Number.parseFloat(data.entryFee),
        status: data.status,
        tradingInstrument: data.tradingInstrument,
        ...(data.maxTrade && { maxTrade: Number.parseInt(data.maxTrade) }),
      }
      await createContest(payload).unwrap()
      toast.success("Contest created successfully")
      setIsCreateOpen(false)
      createForm.reset()
    } catch (err) {
      toast.error("Failed to create contest: " + (err?.data?.error || "Unknown error"))
    }
  }

  // Open update modal with pre-filled data
  const openUpdateModal = (contest) => {
    setSelectedContest(contest)
    updateForm.reset({
      name: contest.name,
      startTime: new Date(contest.start_time).toISOString().slice(0, 16),
      endTime: new Date(contest.end_time).toISOString().slice(0, 16),
      entryFee: contest.entry_fee.toString(),
      maxTrade: contest.maxTrade ? contest.maxTrade.toString() : "",
      status: contest.status,
      tradingInstrument: contest.tradingInstrument,
    })
    setIsUpdateOpen(true)
  }

  // Handle update contest
  const handleUpdate = async (data) => {
    try {
      const payload = {
        id: selectedContest.id,
        name: data.name,
        start_time: data.startTime,
        end_time: data.endTime,
        entry_fee: Number.parseFloat(data.entryFee),
        status: data.status,
        tradingInstrument: data.tradingInstrument,
        ...(data.maxTrade && { maxTrade: Number.parseInt(data.maxTrade) }),
      }
      await updateContest(payload).unwrap()
      toast.success("Contest updated successfully")
      setIsUpdateOpen(false)
      setSelectedContest(null)
    } catch (err) {
      toast.error("Failed to update contest: " + (err?.data?.error || "Unknown error"))
    }
  }

  // Handle delete contest
  const handleDelete = async () => {
    try {
      await deleteContest(selectedContest.id).unwrap()
      toast.success("Contest deleted successfully")
      setIsDeleteOpen(false)
      setSelectedContest(null)
    } catch (err) {
      toast.error("Failed to delete contest: " + (err?.data?.error || "Unknown error"))
    }
  }

  // Open delete confirmation
  const openDeleteModal = (contest) => {
    setSelectedContest(contest)
    setIsDeleteOpen(true)
  }

  // View contest details
  const viewContest = (contest) => {
    router.push(`/admin/contests/${contest.id}`)
  }

  // Watch startTime field for conflict
  const startTimeValue = createForm.watch('startTime')
  // Check for contest on same day
  React.useEffect(() => {
    if (!startTimeValue || !contests?.contests) {
      setSelectedDateConflict(false)
      return
    }
    const selectedDate = new Date(startTimeValue)
    const conflict = contests.contests.some(contest => {
      if (!contest.start_time) return false
      return isSameDay(new Date(contest.start_time), selectedDate)
    })
    setSelectedDateConflict(conflict)
  }, [startTimeValue, contests])

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contest Management</h1>
          <p className="text-muted-foreground">Create and manage trading contests</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Contest
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-6">
            <Users className="h-8 w-8 text-primary mb-2" />
            <CardTitle className="text-xl mb-2">Total Participants</CardTitle>
            <p className="text-2xl font-bold">{totalParticipants}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-6">
            <IndianRupee className="h-8 w-8 text-primary mb-2" />
            <CardTitle className="text-xl mb-2">Total Entry Fees</CardTitle>
            <p className="text-2xl font-bold">{formatCurrency(totalEntryFees)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-6">
            <Calendar className="h-8 w-8 text-primary mb-2" />
            <CardTitle className="text-xl mb-2">Next Contest</CardTitle>
            {upcomingContests.length > 0 ? (
              <p className="text-2xl font-bold truncate">{upcomingContests[0].name}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No upcoming contests</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-6">
            <BarChart className="h-8 w-8 text-primary mb-2" />
            <CardTitle className="text-xl mb-2">Total Contests</CardTitle>
            <p className="text-2xl font-bold">{filteredContests.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contests..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-full"
            />
          </div>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="ongoing">Ongoing</SelectItem>
            <SelectItem value="ended">Ended</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" className="w-full sm:w-auto">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <div className="ml-3">
            <p className="text-sm font-medium">Error</p>
            <p className="text-sm text-muted-foreground">{error?.data?.error || "Failed to load contests"}</p>
          </div>
        </Alert>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Table View */}
      <div className=" hidden sm:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="whitespace-nowrap">ID</TableHead>
              <TableHead className="whitespace-nowrap">Name</TableHead>
              <TableHead className="whitespace-nowrap">Start Time</TableHead>
              <TableHead className="whitespace-nowrap">End Time</TableHead>
              <TableHead className="whitespace-nowrap">Entry Fee</TableHead>
              <TableHead className="whitespace-nowrap">Status</TableHead>
              <TableHead className="whitespace-nowrap">Trading</TableHead>
              <TableHead className="whitespace-nowrap">Max Trades</TableHead>
              <TableHead className="whitespace-nowrap">Participants</TableHead>
              <TableHead className="whitespace-nowrap">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredContests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center h-24 text-muted-foreground">
                  No contests found
                </TableCell>
              </TableRow>
            ) : (
              filteredContests.map((contest) => (
                <TableRow key={contest.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{contest.id}</TableCell>
                  <TableCell>{contest.name}</TableCell>
                  <TableCell>{formatDate(contest.start_time)}</TableCell>
                  <TableCell>{formatDate(contest.end_time)}</TableCell>
                  <TableCell>{formatCurrency(contest.entry_fee)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        contest.status === "upcoming"
                          ? "outline"
                          : contest.status === "ongoing"
                            ? "default"
                            : "secondary"
                      }
                      className={
                        contest.status === "upcoming"
                          ? "bg-blue-50 text-blue-700 hover:bg-blue-50 hover:text-blue-700"
                          : contest.status === "ongoing"
                            ? "bg-green-50 text-green-700 hover:bg-green-50 hover:text-green-700"
                            : "bg-gray-50 text-gray-700 hover:bg-gray-50 hover:text-gray-700"
                      }
                    >
                      {contest.status.charAt(0).toUpperCase() + contest.status.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>{contest.tradingInstrument}</TableCell>
                  <TableCell>{contest.maxTrade || "N/A"}</TableCell>
                  <TableCell>{contest.contestParticipants.length || 0}</TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="icon" onClick={() => viewContest(contest)} title="View">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => openUpdateModal(contest)} title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => openDeleteModal(contest)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Card View */}
      <div className=" sm:hidden grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredContests.map((contest) => (
          <Card key={contest.id} className="overflow-hidden">
            <CardHeader className="p-4">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg truncate">{contest.name}</CardTitle>
                <Badge
                  variant={
                    contest.status === "upcoming"
                      ? "outline"
                      : contest.status === "ongoing"
                        ? "default"
                        : "secondary"
                  }
                  className="whitespace-nowrap"
                >
                  {contest.status.charAt(0).toUpperCase() + contest.status.slice(1)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Start Time</p>
                  <p className="font-medium truncate">{formatDate(contest.start_time)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">End Time</p>
                  <p className="font-medium truncate">{formatDate(contest.end_time)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Entry Fee</p>
                  <p className="font-medium">{formatCurrency(contest.entry_fee)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Trading</p>
                  <p className="font-medium truncate">{contest.tradingInstrument}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Max Trades</p>
                  <p className="font-medium">{contest.maxTrade || "N/A"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Participants</p>
                  <p className="font-medium">{contest.totalParticipants || 0}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => router(`/admin/contest/${contest.id}`)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  View
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => openUpdateModal(contest)}
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setSelectedContest(contest)
                    setIsDeleteOpen(true)
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Contest Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Create New Contest</DialogTitle>
            <DialogDescription>Fill in the details to create a new trading contest</DialogDescription>
          </DialogHeader>
          {selectedDateConflict && (
            <Alert variant="destructive" className="mb-2">
              <AlertCircle className="h-4 w-4" />
              <div className="ml-3">
                <p className="text-sm font-medium">A contest already exists for the selected date.</p>
                <p className="text-sm text-muted-foreground">You cannot create more than one contest on the same day.</p>
              </div>
            </Alert>
          )}
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Contest Name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Time</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Time</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="entryFee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Entry Fee (₹)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} placeholder="50.00" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="maxTrade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Trades</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} placeholder="5" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="upcoming">Upcoming</SelectItem>
                          <SelectItem value="ongoing">Ongoing</SelectItem>
                          <SelectItem value="ended">Ended</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="tradingInstrument"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Trading Instrument</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select instrument" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="NIFTY50">NIFTY50</SelectItem>
                          <SelectItem value="BANKNIFTY">BANKNIFTY</SelectItem>
                          <SelectItem value="BOTH">BOTH</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isCreating || selectedDateConflict}>
                  {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Contest
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Update Contest Modal */}
      <Dialog open={isUpdateOpen} onOpenChange={setIsUpdateOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Update Contest</DialogTitle>
            <DialogDescription>Edit the details of "{selectedContest?.name}"</DialogDescription>
          </DialogHeader>
          <Form {...updateForm}>
            <form onSubmit={updateForm.handleSubmit(handleUpdate)} className="space-y-4">
              <FormField
                control={updateForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Contest Name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={updateForm.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Time</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={updateForm.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Time</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={updateForm.control}
                  name="entryFee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Entry Fee (₹)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} placeholder="50.00" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={updateForm.control}
                  name="maxTrade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Trades</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} placeholder="5" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={updateForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="upcoming">Upcoming</SelectItem>
                          <SelectItem value="ongoing">Ongoing</SelectItem>
                          <SelectItem value="ended">Ended</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={updateForm.control}
                  name="tradingInstrument"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Trading Instrument</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select instrument" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="NIFTY50">NIFTY50</SelectItem>
                          <SelectItem value="BANKNIFTY">BANKNIFTY</SelectItem>
                          <SelectItem value="BOTH">BOTH</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsUpdateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isUpdating}>
                  {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Update Contest
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Contest</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the contest "{selectedContest?.name}"?
            </DialogDescription>
          </DialogHeader>
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-md text-sm">
            This action cannot be undone. All participant data for this contest will be permanently removed.
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Contest
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
