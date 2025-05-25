"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, RefreshCw, AlertCircle } from "lucide-react"


export function MarketHolidays() {
  const [holidays, setHolidays] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [todayStatus, setTodayStatus] = useState(null)

  // Mock holiday data - replace with actual API call
  const mockHolidays = [
    { date: "2024-01-26", name: "Republic Day", type: "trading" },
    { date: "2024-03-08", name: "Holi", type: "trading" },
    { date: "2024-03-29", name: "Good Friday", type: "trading" },
    { date: "2024-04-11", name: "Id-Ul-Fitr (Ramzan Id)", type: "trading" },
    { date: "2024-04-17", name: "Ram Navami", type: "trading" },
    { date: "2024-05-01", name: "Maharashtra Day", type: "trading" },
    { date: "2024-06-17", name: "Bakri Id", type: "trading" },
    { date: "2024-08-15", name: "Independence Day", type: "trading" },
    { date: "2024-10-02", name: "Gandhi Jayanti", type: "trading" },
    { date: "2024-11-01", name: "Diwali Laxmi Pujan", type: "trading" },
    { date: "2024-11-15", name: "Guru Nanak Jayanti", type: "trading" },
    { date: "2024-12-25", name: "Christmas", type: "trading" },
  ]

  const fetchHolidays = async (year) => {
    setLoading(true)
    setError(null)

    try {
      // Mock API call - replace with actual Upstox API
      // const response = await fetch(`https://api.upstox.com/v2/market/holidays/${year}`)

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Filter holidays for selected year
      const yearHolidays = mockHolidays.filter((holiday) => holiday.date.startsWith(year.toString()))

      setHolidays(yearHolidays)

      // Check if today is a holiday
      const today = new Date().toISOString().split("T")[0]
      const todayHoliday = yearHolidays.find((holiday) => holiday.date === today)
      setTodayStatus({
        isHoliday: !!todayHoliday,
        holidayName: todayHoliday?.name,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch holidays")
    } finally {
      setLoading(false)
    }
  }

  const checkTodayHolidayStatus = async () => {
    try {
      const today = new Date().toISOString().split("T")[0]
      // Mock API call - replace with actual Upstox API
      // const response = await fetch(`https://api.upstox.com/v2/market/holidays/${today}`)

      const todayHoliday = mockHolidays.find((holiday) => holiday.date === today)
      setTodayStatus({
        isHoliday: !!todayHoliday,
        holidayName: todayHoliday?.name,
      })
    } catch (err) {
      console.error("Error checking today holiday status:", err)
    }
  }

  useEffect(() => {
    fetchHolidays(selectedYear)
    checkTodayHolidayStatus()
  }, [selectedYear])

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-IN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const isUpcoming = (dateString) => {
    const holidayDate = new Date(dateString)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return holidayDate >= today
  }

  const isPast = (dateString) => {
    const holidayDate = new Date(dateString)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return holidayDate < today
  }

  const getNextHoliday = () => {
    const upcoming = holidays.filter((holiday) => isUpcoming(holiday.date))
    return upcoming.length > 0 ? upcoming[0] : null
  }

  const upcomingHolidays = holidays.filter((holiday) => isUpcoming(holiday.date))
  const pastHolidays = holidays.filter((holiday) => isPast(holiday.date))
  const nextHoliday = getNextHoliday()

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Market Holidays {selectedYear}
            </CardTitle>
            <div className="flex items-center gap-2">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number.parseInt(e.target.value))}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm"
              >
                <option value={2024}>2024</option>
                <option value={2025}>2025</option>
              </select>
              <Button variant="outline" size="sm" onClick={() => fetchHolidays(selectedYear)} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {todayStatus && (
            <div
              className={`p-3 rounded-lg ${
                todayStatus.isHoliday ? "bg-red-50 border border-red-200" : "bg-green-50 border border-green-200"
              }`}
            >
              <div className={`flex items-center gap-2 ${todayStatus.isHoliday ? "text-red-700" : "text-green-700"}`}>
                <AlertCircle className="w-4 h-4" />
                {todayStatus.isHoliday
                  ? `Today is a market holiday: ${todayStatus.holidayName}`
                  : "Market is open today"}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Loading State */}
      {loading && (
        <Card>
          <CardContent className="flex items-center justify-center p-8">
            <RefreshCw className="w-6 h-6 animate-spin mr-3" />
            <span className="text-gray-600">Loading holidays...</span>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center text-red-700">
              <AlertCircle className="w-5 h-5 mr-2" />
              <strong>Error:</strong> {error}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Next Holiday */}
      {nextHoliday && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-lg text-blue-800">Next Market Holiday</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-blue-700">
              <div className="text-xl font-semibold">{nextHoliday.name}</div>
              <div className="text-sm">{formatDate(nextHoliday.date)}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Holidays */}
      {upcomingHolidays.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Upcoming Holidays</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingHolidays.map((holiday, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium">{holiday.name}</div>
                    <div className="text-sm text-gray-600">{formatDate(holiday.date)}</div>
                  </div>
                  <Badge variant={holiday.type === "trading" ? "destructive" : "secondary"}>
                    {holiday.type === "trading" ? "Trading Closed" : "Clearing Closed"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Past Holidays */}
      {pastHolidays.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Past Holidays ({pastHolidays.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {pastHolidays.map((holiday, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 border-b border-gray-100 last:border-b-0"
                >
                  <div>
                    <div className="font-medium text-gray-700">{holiday.name}</div>
                    <div className="text-sm text-gray-500">{formatDate(holiday.date)}</div>
                  </div>
                  <Badge variant="outline" className="text-gray-500">
                    {holiday.type === "trading" ? "Trading" : "Clearing"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Holiday Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-800">{holidays.length}</div>
            <div className="text-sm text-gray-600">Total Holidays</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{upcomingHolidays.length}</div>
            <div className="text-sm text-gray-600">Upcoming</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-500">{pastHolidays.length}</div>
            <div className="text-sm text-gray-600">Completed</div>
          </CardContent>
        </Card>
      </div>

      {/* API Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">API Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-gray-600">
            <div>
              <strong>Endpoint:</strong> https://api.upstox.com/v2/market/holidays
            </div>
            <div>
              <strong>Method:</strong> GET
            </div>
            <div>
              <strong>Headers:</strong> Accept: application/json
            </div>
            <div>
              <strong>Rate Limit:</strong> Standard API limits apply
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
