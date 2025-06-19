"use client"

import  React from "react"

import { useState } from "react"
import { Bell, X, TrendingUp, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"


export default function Notification() {
  const [notifications, setNotifications] = useState([
    {
      id: "1",
      type: "price_alert",
      title: "Price Alert",
      message: "NIFTY 24800 CE reached ₹150.00",
      timestamp: new Date(Date.now() - 5 * 60 * 1000),
      read: false,
      icon: <TrendingUp className="h-4 w-4 text-green-400" />,
    },
    {
      id: "2",
      type: "contest",
      title: "Contest Update",
      message: "You moved up to rank #15 in Weekly Contest",
      timestamp: new Date(Date.now() - 15 * 60 * 1000),
      read: false,
      icon: <TrendingUp className="h-4 w-4 text-blue-400" />,
    },
    {
      id: "3",
      type: "system",
      title: "System Alert",
      message: "Market will close in 30 minutes",
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
      read: true,
      icon: <AlertTriangle className="h-4 w-4 text-orange-400" />,
    },
  ])

  const unreadCount = notifications.filter((n) => !n.read).length

  const markAsRead = (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const removeNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  const formatTime = (date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / (1000 * 60))

    if (minutes < 1) return "Just now"
    if (minutes < 60) return `${minutes}m ago`
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`
    return date.toLocaleDateString()
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-slate-300 hover:bg-slate-800 hover:text-white relative transition-colors"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs bg-red-500 hover:bg-red-500"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 bg-slate-900 border-slate-700 shadow-xl p-0" align="end">
        <div className="space-y-0">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-700">
            <h3 className="text-sm font-medium text-white">Notifications</h3>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="text-xs text-slate-400 hover:text-white hover:bg-slate-800"
              >
                Mark all read
              </Button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No notifications</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "p-4 border-b border-slate-800 hover:bg-slate-800/50 transition-colors cursor-pointer",
                    !notification.read && "bg-slate-800/30",
                  )}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">{notification.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-white truncate">{notification.title}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeNotification(notification.id)
                          }}
                          className="h-6 w-6 p-0 text-slate-400 hover:text-white hover:bg-slate-700"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-xs text-slate-400 mb-2">{notification.message}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">{formatTime(notification.timestamp)}</span>
                        {!notification.read && <div className="h-2 w-2 bg-blue-500 rounded-full"></div>}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-3 border-t border-slate-700">
              <Button variant="ghost" size="sm" className="w-full text-slate-400 hover:text-white hover:bg-slate-800">
                View all notifications
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
