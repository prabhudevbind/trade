"use client"

import { useThemeContext } from '@/hooks/color-context'
import { cn } from "@/lib/utils"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { useSelector } from 'react-redux'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'

export default function AvatarDemo({ noFallback }) {
  const { themeColor } = useThemeContext()
  const auth = useSelector((state) => state.auth)
  const [imageError, setImageError] = useState(false)

  const getInitials = () => {
    if (!auth?.user) return 'U'
    const firstInitial = auth.user.firstName ? auth.user.firstName.charAt(0).toUpperCase() : ''
    const lastInitial = auth.user.lastName ? auth.user.lastName.charAt(0).toUpperCase() : ''
    return firstInitial + lastInitial || auth.user.username?.charAt(0).toUpperCase() || 'U'
  }

  // Show loader when auth state is loading
  if (!auth) {
    return (
      <div className="relative">
        <Avatar>
          <AvatarFallback>
            <Loader2 className="h-4 w-4 animate-spin" />
          </AvatarFallback>
        </Avatar>
      </div>
    )
  }

  // Return null if not authenticated and noFallback is true
  if (!auth.isAuthenticated && noFallback) return null

  return (
    <div className="relative">
      <Avatar>
        {auth.user?.img && !imageError && (
          <AvatarImage
            src={`http://localhost:5000${auth.user.img}`}
            alt={auth.user.username || "User Profile"}
            onError={() => setImageError(true)}
          />
        )}
        <AvatarFallback className={cn(`bg-${themeColor}-100 text-${themeColor}-500`)}>
          {getInitials()}
        </AvatarFallback>
      </Avatar>
    </div>
  )
}