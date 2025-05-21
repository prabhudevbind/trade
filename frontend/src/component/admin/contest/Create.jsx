"use client"

import { useState } from "react"
import {
  useGetContestsQuery,
  useCreateContestMutation,
  useUpdateContestMutation,
  useDeleteContestMutation,
} from "@/store/api/contest"
import { format } from "date-fns"
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
} from "lucide-react"
import { toast } from "react-toastify"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatCurrency } from "@/lib/utils"
import { Alert } from "@/components/ui/alert"

// Form schema for validation
const contestSchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name must be 255 characters or less"),
  start_time: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid start date"),
  end_time: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid end date"),
  entry_fee: z
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
  trading_instrument: z.enum(["NIFTY50", "BANKNIFTY", "BOTH"]),
})

export default function ContestManager() {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isUpdateOpen, setIsUpdateOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedContest, setSelectedContest] = useState(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
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
      start_time: "",
      end_time: "",
      entry_fee: "50.00",
      maxTrade: "5",
      status: "upcoming",
      trading_instrument: "BOTH",
    },
  })

  const updateForm = useForm({
    resolver: zodResolver(contestSchema),
    defaultValues: {
      name: "",
      start_time: "",
      end_time: "",
      entry_fee: "",
      maxTrade: "5",
      status: "upcoming",
      trading_instrument: "BOTH",
    },
  })

  // Filter and search contests
  const filteredContests = contests
    ? contests.filter((contest) => {
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
        start_time: data.start_time,
        end_time: data.end_time,
        entry_fee: Number.parseFloat(data.entry_fee),
        status: data.status,
        trading_instrument: data.trading_instrument,
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

  // Handle update contest
  const handleUpdate = async (data) => {
    try {
      const payload = {
        id: selectedContest.id,
        name: data.name,
        start_time: data.start_time,
        end_time: data.end_time,
        entry_fee: Number.parseFloat(data.entry_fee),
        status: data.status,
        trading_instrument: data.trading_instrument,
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

  // Open update modal with pre-filled data
  const openUpdateModal = (contest) => {
    setSelectedContest(contest)
    updateForm.reset({
      name: contest.name,
      start_time: new Date(contest.start_time).toISOString().slice(0, 16),
      end_time: new Date(contest.end_time).toISOString().slice(0, 16),
      entry_fee: contest.entry_fee.toString(),
      maxTrade: contest.maxTrade ? contest.maxTrade.toString() : "",
      status: contest.status,
      trading_instrument: contest.trading_instrument,
    })
    setIsUpdateOpen(true)
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

      {/* Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Contests</CardTitle>
            <BarChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredContests.length}</div>
            <p className="text-xs text-muted-foreground">
              {upcomingContests.length} upcoming, {ongoingContests.length} ongoing, {endedContests.length} ended
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Participants</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalParticipants}</div>
            <p className="text-xs text-muted-foreground">Across all contests</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Entry Fees</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalEntryFees)}</div>
            <p className="text-xs text-muted-foreground">Revenue from all contests</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Next Contest</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {upcomingContests.length > 0 ? (
              <>
                <div className="text-lg font-bold truncate">{upcomingContests[0].name}</div>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(upcomingContests[0].start_time), "PPp")}
                </p>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">No upcoming contests</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contests..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
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
        <Button variant="outline">
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

      {/* Contests Table */}
      {!isLoading && !error && (
        <Tabs defaultValue="table" className="w-full">
          <TabsList>
            <TabsTrigger value="table">Table View</TabsTrigger>
            <TabsTrigger value="cards">Card View</TabsTrigger>
          </TabsList>

          <TabsContent value="table" className="space-y-4">
            <div className="rounded-md border shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Start Time</TableHead>
                    <TableHead>End Time</TableHead>
                    <TableHead>Entry Fee</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Trading Instrument</TableHead>
                    <TableHead>Max Trades</TableHead>
                    <TableHead>Participants</TableHead>
                    <TableHead>Actions</TableHead>
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
                        <TableCell>{format(new Date(contest.start_time), "PPp")}</TableCell>
                        <TableCell>{format(new Date(contest.end_time), "PPp")}</TableCell>
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
                        <TableCell>{contest.trading_instrument}</TableCell>
                        <TableCell>{contest.maxTrade || "N/A"}</TableCell>
                        <TableCell>{contest.contestParticipants?.length || 0}</TableCell>
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
          </TabsContent>

          <TabsContent value="cards" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredContests.length === 0 ? (
                <div className="col-span-full text-center p-8 text-muted-foreground border rounded-lg">
                  No contests found
                </div>
              ) : (
                filteredContests.map((contest) => (
                  <Card key={contest.id} className="overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg">{contest.name}</CardTitle>
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
                      </div>
                      <CardDescription>Trading Instrument: {contest.trading_instrument}</CardDescription>
                    </CardHeader>
                    <CardContent className="pb-3">
                      <div className="grid grid-cols-2 gap-y-2 text-sm">
                        <div className="text-muted-foreground">Start Time:</div>
                        <div className="font-medium text-right">{format(new Date(contest.start_time), "PPp")}</div>

                        <div className="text-muted-foreground">End Time:</div>
                        <div className="font-medium text-right">{format(new Date(contest.end_time), "PPp")}</div>

                        <div className="text-muted-foreground">Entry Fee:</div>
                        <div className="font-medium text-right">{formatCurrency(contest.entry_fee)}</div>

                        <div className="text-muted-foreground">Max Trades:</div>
                        <div className="font-medium text-right">{contest.maxTrade || "N/A"}</div>

                        <div className="text-muted-foreground">Participants:</div>
                        <div className="font-medium text-right">{contest.contestParticipants?.length || 0}</div>
                      </div>
                    </CardContent>
                    <div className="p-3 bg-muted/20 flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => viewContest(contest)}>
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openUpdateModal(contest)}>
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => openDeleteModal(contest)}>
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Create Contest Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Create New Contest</DialogTitle>
            <DialogDescription>Fill in the details to create a new trading contest</DialogDescription>
          </DialogHeader>
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
                  name="start_time"
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
                  name="end_time"
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
                  name="entry_fee"
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
                  name="trading_instrument"
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
                <Button type="submit" disabled={isCreating}>
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
                  name="start_time"
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
                  name="end_time"
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
                  name="entry_fee"
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
                  name="trading_instrument"
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
