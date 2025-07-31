import { useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { useGetUserByIdQuery } from "@/store/api/userSliceApi"
import {
  User,
  Wallet,
  Trophy,
  TrendingUp,
  Settings,
  Bell,
  Share2,
  Edit3,
  ChevronRight,
  Activity,
  Smartphone,
  Globe,
  LogOut,
  Loader2,
  AlertCircle,
  IndianRupee
} from "lucide-react"
import WithDrawUpiId from "@/component/admin/wallet/WithDrawUpiId"
import { Link, useNavigate } from "react-router-dom"
import ImageUploader from "./ImageUploader"
import { clearAllDetails } from "@/store/reducer/authSlice"
import { cn } from "@/lib/utils"

export default function Profile() {
  const [activeTab, setActiveTab] = useState("overview")

  // RTK Query setup
  const auth = useSelector((state) => state.auth)
  const user = auth?.user

    const dispatch = useDispatch();
    const router = useNavigate();
    const [isLoadings, setIsLoading] = useState(false);
  const {
    data: userData,
    isLoading,
    isError,
    error
  } = useGetUserByIdQuery(user?.id, {
    skip: !user?.id
  })

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "INR",
    }).format(amount)
  }

  const Avatar = ({ children, className = "" }) => (
    <div className={`rounded-full bg-gray-200 flex items-center justify-center ${className}`}>
      {children}
    </div>
  )

  const AvatarImage = ({ src, alt, className = "" }) => (
    src ? <img src={src} alt={alt} className={`rounded-full w-full h-full object-cover ${className}`} /> : null
  )

  const AvatarFallback = ({ children, className = "" }) => (
    <div className={`flex items-center justify-center w-full h-full rounded-full ${className}`}>
      {children}
    </div>
  )

  const Button = ({ children, variant = "default", size = "default", className = "", onClick, disabled = false, ...props }) => {
    const baseClasses = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"

    const variants = {
      default: "bg-blue-600 text-white hover:bg-blue-700",
      ghost: "hover:bg-gray-100 hover:text-gray-900",
      outline: "border border-gray-300 bg-white hover:bg-gray-50"
    }

    const sizes = {
      default: "h-10 px-4 py-2",
      sm: "h-9 px-3 text-sm",
      icon: "h-10 w-10",
      lg: "h-11 px-8"
    }

    return (
      <button
        className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
        onClick={onClick}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    )
  }

  const Card = ({ children, className = "" }) => (
    <div className={`rounded-lg border bg-white shadow-sm ${className}`}>
      {children}
    </div>
  )

  const CardHeader = ({ children, className = "" }) => (
    <div className={`flex flex-col space-y-1.5 p-4 sm:p-6 ${className}`}>
      {children}
    </div>
  )

  const CardTitle = ({ children, className = "" }) => (
    <h3 className={`text-lg font-semibold leading-none tracking-tight ${className}`}>
      {children}
    </h3>
  )

  const CardContent = ({ children, className = "" }) => (
    <div className={`p-4 sm:p-6 pt-0 ${className}`}>
      {children}
    </div>
  )

  const Badge = ({ children, variant = "default", className = "" }) => {
    const variants = {
      default: "bg-blue-100 text-blue-800",
      secondary: "bg-gray-100 text-gray-800"
    }

    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[variant]} ${className}`}>
        {children}
      </span>
    )
  }

  const TabButton = ({ isActive, onClick, children }) => (
    <button
      onClick={onClick}
      className={`flex-1 py-2 px-1 text-xs font-medium transition-colors rounded-md ${isActive
        ? 'bg-white text-blue-600 shadow-sm'
        : 'text-gray-600 hover:text-gray-900'
        }`}
    >
      {children}
    </button>
  )

  const LoadingSpinner = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-gray-600">Loading profile...</p>
      </div>
    </div>
  )

  const ErrorState = ({ error }) => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 text-center">
          <div className="text-red-500 mb-4">
            <AlertCircle className="h-12 w-12 mx-auto" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Profile</h3>
          <p className="text-gray-600 mb-4">
            {error?.data?.message || error?.message || "Failed to load user data"}
          </p>
          <Button
            onClick={() => window.location.reload()}
            className="w-full"
          >
            Try Again
          </Button>
        </CardContent>
      </Card>
    </div>
  )


    const handleLogout = async () => {
      setIsLoading(true);
      try {
        dispatch(clearAllDetails());
        const token = Cookies.get("token");
  
        await axios.post(
          "/api/v1/sessions/logout",
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
  
        dispatch(clearAllDetails());
        Cookies.remove("token");
        // toast.success("You have been successfully logged out.");
        router("/login");
      } catch (error) {
        console.error("Logout error:", error);
        toast.error("Unable to log out. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
  
  // Handle loading state
  if (!user?.isActive) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="p-6 text-center">
            <p className="text-gray-600">Please log in to view your profile</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading || isLoadings) {
    return <LoadingSpinner />
  }

  if (isError) {
    return <ErrorState error={error} />
  }

  if (!userData) {
    return <ErrorState error={{ message: "No user data found" }} />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 mb-20">
      {/* Mobile Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-3">

            <div>
              <h1 className="text-base font-bold">StockVerses</h1>
              <p className="text-xs opacity-90">Trading Simulator</p>
            </div>
          </div>
          <div className="flex space-x-1">
            <Link to="/refer">

              <Button
                variant="ghost"
                size="sm"
                className=" text-orange-500 text-nowrap hover:bg-orange-500 hover:text-white px-3 py-1"
              // onClick={() => window.open('https://example.com/refer', '_blank')}
              >
                <IndianRupee /> Refer & Earn
              </Button>
            </Link>
            <Button
              variant="ghost"
              onClick={handleLogout}
              disabled={isLoading}
              className={cn(
                "w-full justify-start text-red-400 hover:bg-red-900/20 hover:text-red-300 transition-colors",
                isLoading && "opacity-50 cursor-not-allowed"
              )}
            >
              <LogOut className="mr-3 h-4 w-4" />
              {isLoading ? "Logging out..." : "Log out"}
            </Button>
          </div>
        </div>

        {/* Mobile Profile Summary */}
        <div className="px-4 pb-6">
          <div className="flex items-center space-x-3 mb-4">
            <Avatar className="h-16 w-16 border-3 border-white">
              <AvatarImage src={userData.img} alt={userData.firstName} />

            </Avatar>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold truncate">
                {userData.firstName} {userData.lastName}
              </h2>
              <p className="text-sm opacity-90 truncate">@{userData.username}</p>
              <Badge variant="secondary" className="mt-1 bg-green-500 text-white text-xs">
                {userData.isActive ? "Active Trader" : "Inactive"}
              </Badge>
            </div>
            <Link to="/wallet">

              <Button variant="outline" size="sm" className="bg-white text-blue-600 hover:bg-gray-100 text-xs px-3 py-1">
                <Wallet className="h-3 w-3 mr-1" />
                Add Amount
              </Button>
            </Link>

          </div>

          {/* Mobile Quick Stats */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="bg-white/10  pt-2 border-white/20 text-white">
              <CardContent className="p-3 text-center">
                <Wallet className="h-5 w-5 mx-auto mb-1" />
                <p className="text-base font-bold truncate">
                  {userData.amount ? formatCurrency(userData.amount) : '$0.00'}
                </p>
                <p className="text-xs opacity-80">Balance</p>
              </CardContent>
            </Card>
            <Card className="bg-white/10  pt-2 border-white/20 text-white">
              <CardContent className="p-3 text-center">
                <Trophy className="h-5 w-5 mx-auto mb-1" />
                <p className="text-base font-bold">{userData.winHistory?.length || 0}</p>
                <p className="text-xs opacity-80">Wins</p>
              </CardContent>
            </Card>
            <Card className="bg-white/10  pt-2 border-white/20 text-white">
              <CardContent className="p-3 text-center">
                <TrendingUp className="h-5 w-5 mx-auto mb-1" />
                <p className="text-base font-bold">#{userData.winHistory?.[0]?.rank || "N/A"}</p>
                <p className="text-xs opacity-80">Best Rank</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <div className=" p-3 bg-blue-500">
        <ImageUploader />

      </div>

      {/* Mobile Content Tabs */}
      <div className="p-4">
        {/* Mobile Tab Navigation */}
        <div className="bg-gray-100 p-1 rounded-lg mb-4 grid grid-cols-3 gap-1">
          <TabButton
            isActive={activeTab === "overview"}
            onClick={() => setActiveTab("overview")}
          >
            Overview
          </TabButton>
          <TabButton
            isActive={activeTab === "activity"}
            onClick={() => setActiveTab("activity")}
          >
            Activity
          </TabButton>
          <TabButton
            isActive={activeTab === "devices"}
            onClick={() => setActiveTab("devices")}
          >
            Devices
          </TabButton>

        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            {/* Account Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-base">
                  <User className="h-4 w-4 mr-2 text-blue-600" />
                  Account Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600 text-sm">Email</span>
                  <span className="font-medium text-sm truncate ml-2">{userData.email || 'Not provided'}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600 text-sm">Member Since</span>
                  <span className="font-medium text-sm">
                    {userData.createdAt ? formatDate(userData.createdAt) : 'Unknown'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600 text-sm">Last Login</span>
                  <span className="font-medium text-sm">
                    {userData.lastLogin ? formatDate(userData.lastLogin) : 'Unknown'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600 text-sm">UPI ID</span>
                  <span className="font-medium text-gray-400 text-sm">{userData.upiId || "Not Set"}</span>
                </div>
              </CardContent>
            </Card>

            {/* Win History */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-base">
                  <Trophy className="h-4 w-4 mr-2 text-yellow-600" />
                  Recent Wins
                </CardTitle>
              </CardHeader>
              <CardContent>
                {userData.winHistory && userData.winHistory.length > 0 ? (
                  <div className="space-y-3">
                    {userData.winHistory.map((win) => (
                      <div
                        key={win.id}
                        className="bg-gradient-to-r from-yellow-50 to-orange-50 p-3 rounded-lg border border-yellow-200"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-semibold text-gray-800 text-sm">Contest #{win.contestId}</p>
                            <p className="text-xs text-gray-600">Rank #{win.rank}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-green-600 text-sm">
                              {formatCurrency(Number(win.amount) || 0)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {win.winDate ? formatDate(win.winDate) : 'Unknown date'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4 text-sm">No wins yet. Keep trading!</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "activity" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-base">
                  <Activity className="h-4 w-4 mr-2 text-green-600" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {userData.activityLogs && userData.activityLogs.length > 0 ? (
                  <div className="space-y-3">
                    {userData.activityLogs.map((log) => (
                      <div
                        key={log.id}
                        className="bg-gray-50 p-3 rounded-lg"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-800 text-sm">{log.activityType}</p>
                            <p className="text-xs text-gray-600 mt-1 break-words">{log.description}</p>
                          </div>
                          <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                            {log.createdAt ? formatDate(log.createdAt) : 'Unknown'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4 text-sm">No recent activity</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "devices" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-base">
                  <Smartphone className="h-4 w-4 mr-2 text-purple-600" />
                  Login Devices
                </CardTitle>
              </CardHeader>
              <CardContent>
                {userData.sessions && userData.sessions.length > 0 ? (
                  <div className="space-y-3">
                    {userData.sessions.map((session) => {
                      const isMobile = session.userAgent?.includes("Mobile") || session.userAgent?.includes("iPhone")
                      return (
                        <div
                          key={session.id}
                          className="bg-gray-50 p-3 rounded-lg"
                        >
                          <div className="flex items-center space-x-3">
                            {isMobile ? (
                              <Smartphone className="h-4 w-4 text-blue-500 flex-shrink-0" />
                            ) : (
                              <Globe className="h-4 w-4 text-purple-500 flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-800 text-sm">{isMobile ? "Mobile Device" : "Desktop"}</p>
                              <p className="text-xs text-gray-600 truncate">IP: {session.ipAddress || 'Unknown'}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {session.createdAt ? formatDate(session.createdAt) : 'Unknown date'}
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4 text-sm">No recent sessions</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <WithDrawUpiId />

      </div>
    </div>
  )
}