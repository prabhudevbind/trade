"use client"

import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import axios from "axios"
import Cookies from "js-cookie"
import { useThemeContext } from "@/hooks/color-context"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import AvatarDemo from "./AvatarDemo"
import { User, Settings, LogOut, Trophy, Activity } from "lucide-react"
import { toast } from "react-toastify"
import { useDispatch, useSelector } from "react-redux"
import { clearAllDetails } from "@/store/reducer/authSlice"

export default function PopoverDemo() {
  const { themeColor } = useThemeContext()
  const router = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const dispatch = useDispatch()
  const user = useSelector((state) => state?.auth?.user)

  const handleLogout = async () => {
    setIsLoading(true)
    try {
      dispatch(clearAllDetails())
      const token = Cookies.get("token")

      await axios.post(
        "/api/v1/sessions/logout",
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )

      dispatch(clearAllDetails())
      Cookies.remove("token")
      toast.success("You have been successfully logged out.")
      router("/login")
    } catch (error) {
      console.error("Logout error:", error)
      toast.error("Unable to log out. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "hover:bg-slate-800 text-slate-300 hover:text-white transition-colors p-2",
            `hover:bg-${themeColor}-900/20`,
          )}
        >
          <AvatarDemo noFallback={true} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn("w-64 mr-4 bg-slate-900 border-slate-700 shadow-xl", "backdrop-blur-sm")}
        align="end"
      >
        <div className="space-y-4">
          {/* User Info Section */}
          <div className="flex items-center p-2">
            <AvatarDemo noFallback={true} />
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-white">
                {user ? `${user.firstName} ${user.lastName}` : "User Name"}
              </p>
              {user && <p className="text-xs text-slate-400 truncate">{user.email}</p>}
            </div>
          </div>

       

          <div className="border-t border-slate-700" />

          {/* Navigation Menu */}
          <ul className="space-y-1">
            <li>
              <Link to="/profile">
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start text-slate-300 hover:bg-slate-800 hover:text-white transition-colors",
                    `hover:bg-${themeColor}-900/20`,
                  )}
                >
                  <User className="mr-3 h-4 w-4" />
                  Profile
                </Button>
              </Link>
            </li>
            <li>
              <Link to="/contests">
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start text-slate-300 hover:bg-slate-800 hover:text-white transition-colors",
                    `hover:bg-${themeColor}-900/20`,
                  )}
                >
                  <Trophy className="mr-3 h-4 w-4" />
                  My Contests
                </Button>
              </Link>
            </li>
            <li>
              <Link to="/portfolio">
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start text-slate-300 hover:bg-slate-800 hover:text-white transition-colors",
                    `hover:bg-${themeColor}-900/20`,
                  )}
                >
                  <Activity className="mr-3 h-4 w-4" />
                  Portfolio
                </Button>
              </Link>
            </li>
            <li>
              <Link to="/settings">
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start text-slate-300 hover:bg-slate-800 hover:text-white transition-colors",
                    `hover:bg-${themeColor}-900/20`,
                  )}
                >
                  <Settings className="mr-3 h-4 w-4" />
                  Settings
                </Button>
              </Link>
            </li>
          </ul>

          <div className="border-t border-slate-700" />

          {/* Logout Button */}
          <Button
            variant="ghost"
            onClick={handleLogout}
            disabled={isLoading}
            className={cn(
              "w-full justify-start text-red-400 hover:bg-red-900/20 hover:text-red-300 transition-colors",
              isLoading && "opacity-50 cursor-not-allowed",
            )}
          >
            <LogOut className="mr-3 h-4 w-4" />
            {isLoading ? "Logging out..." : "Log out"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
