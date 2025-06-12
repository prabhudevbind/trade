"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import {
  Eye,
  EyeOff,
  TrendingUp,
  Trophy,
  Gift,
  Users,
  Target,
  Star,
  User,
  Mail,
  Lock,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"

// Mock Redux hooks - replace with your actual Redux implementation
import { useRegisterUserMutation } from "@/store/api/userSliceApi"


import { loginUser } from "@/store/reducer/authSlice" 

import { fetchUserDetails } from "@/store/reducer/userDetailsSlice"
import { useDispatch } from "react-redux"

function LoginForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const dispatch = useDispatch()
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    clearErrors,
  } = useForm()

  const onSubmit = async (data) => {
    try {
      setIsLoading(true)
      clearErrors()

      const result = await dispatch(loginUser(data)).unwrap()

      toast({
        title: "Login Successful! 🎉",
        description: "Welcome back to Stockverse!",
        duration: 3000,
      })

      // Fetch user details after successful login
      await dispatch(fetchUserDetails(result.user.id))
    } catch (error) {
      const errorMessage = error?.error || error?.message || "Login failed. Please try again."

      toast({
        variant: "destructive",
        title: "Login Failed",
        description: errorMessage,
        duration: 4000,
      })

      // Set form-level error for invalid credentials
      if (errorMessage.includes("credentials") || errorMessage.includes("Invalid")) {
        setError("email", { message: "Invalid email or password" })
        setError("password", { message: "Invalid email or password" })
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6 w-full">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            Email
          </Label>
          <Input
            id="email"
            placeholder="Enter your email"
            type="email"
            disabled={isLoading}
            {...register("email", {
              required: "Email is required",
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: "Please enter a valid email address",
              },
            })}
            className={errors.email ? "border-destructive focus-visible:ring-destructive" : ""}
          />
          {errors.email && (
            <div className="flex items-center gap-1 text-sm text-destructive">
              <AlertCircle className="h-3 w-3" />
              {errors.email.message}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            Password
          </Label>
          <div className="relative">
            <Input
              id="password"
              placeholder="Enter your password"
              type={showPassword ? "text" : "password"}
              disabled={isLoading}
              {...register("password", {
                required: "Password is required",
                minLength: {
                  value: 6,
                  message: "Password must be at least 6 characters",
                },
              })}
              className={`pr-10 ${errors.password ? "border-destructive focus-visible:ring-destructive" : ""}`}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isLoading}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
          {errors.password && (
            <div className="flex items-center gap-1 text-sm text-destructive">
              <AlertCircle className="h-3 w-3" />
              {errors.password.message}
            </div>
          )}
        </div>

        <Button
          type="submit"
          disabled={isLoading || isSubmitting}
          className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium transition-all duration-200 transform active:scale-[0.98]"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              Sign In
            </>
          )}
        </Button>
      </form>
    </div>
  )
}

function RegisterForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [registerUser] = useRegisterUserMutation()
  const dispatch = useDispatch()
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    reset,
    setError,
    clearErrors,
  } = useForm()

  const password = watch("password")

  const onSubmit = async (data) => {
    try {
      setIsLoading(true)
      clearErrors()

      const { firstName, lastName, email, password } = data

      const result = await registerUser({
        firstName,
        lastName,
        email,
        password,
      }).unwrap()

      toast({
        title: "Account Created Successfully! 🎉",
        description: "Welcome to Stockverse! You can now start trading.",
        duration: 4000,
      })

      // Reset form after successful registration
      reset()

      // Fetch user details
      await dispatch(fetchUserDetails(result.user.id))
    } catch (error) {
      const errorMessage = error?.data?.message || error?.message || "Registration failed. Please try again."

      toast({
        variant: "destructive",
        title: "Registration Failed",
        description: errorMessage,
        duration: 4000,
      })

      // Handle specific errors
      if (errorMessage.includes("email") || errorMessage.includes("Email")) {
        setError("email", { message: "This email is already registered" })
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">First Name</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="firstName"
                placeholder="First name"
                disabled={isLoading}
                className={`pl-10 ${errors.firstName ? "border-destructive" : ""}`}
                {...register("firstName", {
                  required: "First name is required",
                  minLength: {
                    value: 2,
                    message: "First name must be at least 2 characters",
                  },
                })}
              />
            </div>
            {errors.firstName && (
              <div className="flex items-center gap-1 text-sm text-destructive">
                <AlertCircle className="h-3 w-3" />
                {errors.firstName.message}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="lastName">Last Name</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="lastName"
                placeholder="Last name"
                disabled={isLoading}
                className={`pl-10 ${errors.lastName ? "border-destructive" : ""}`}
                {...register("lastName", {
                  required: "Last name is required",
                  minLength: {
                    value: 2,
                    message: "Last name must be at least 2 characters",
                  },
                })}
              />
            </div>
            {errors.lastName && (
              <div className="flex items-center gap-1 text-sm text-destructive">
                <AlertCircle className="h-3 w-3" />
                {errors.lastName.message}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="register-email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="register-email"
              placeholder="Enter your email"
              type="email"
              disabled={isLoading}
              className={`pl-10 ${errors.email ? "border-destructive" : ""}`}
              {...register("email", {
                required: "Email is required",
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: "Please enter a valid email address",
                },
              })}
            />
          </div>
          {errors.email && (
            <div className="flex items-center gap-1 text-sm text-destructive">
              <AlertCircle className="h-3 w-3" />
              {errors.email.message}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="register-password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="register-password"
              placeholder="Create a password"
              type={showPassword ? "text" : "password"}
              disabled={isLoading}
              className={`pl-10 pr-10 ${errors.password ? "border-destructive" : ""}`}
              {...register("password", {
                required: "Password is required",
                minLength: {
                  value: 8,
                  message: "Password must be at least 8 characters",
                },
                pattern: {
                  value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                  message: "Password must contain uppercase, lowercase, and number",
                },
              })}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isLoading}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
          {errors.password && (
            <div className="flex items-center gap-1 text-sm text-destructive">
              <AlertCircle className="h-3 w-3" />
              {errors.password.message}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirm Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="confirm-password"
              placeholder="Confirm your password"
              type={showPassword ? "text" : "password"}
              disabled={isLoading}
              className={`pl-10 ${errors.confirmPassword ? "border-destructive" : ""}`}
              {...register("confirmPassword", {
                required: "Please confirm your password",
                validate: (value) => value === password || "Passwords do not match",
              })}
            />
          </div>
          {errors.confirmPassword && (
            <div className="flex items-center gap-1 text-sm text-destructive">
              <AlertCircle className="h-3 w-3" />
              {errors.confirmPassword.message}
            </div>
          )}
        </div>

        <Button
          type="submit"
          disabled={isLoading || isSubmitting}
          className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium transition-all duration-200 transform active:scale-[0.98]"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating Account...
            </>
          ) : (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              Create Account
            </>
          )}
        </Button>
      </form>
    </div>
  )
}

export default function StockverseLogin() {
  const features = [
    {
      icon: <Users className="h-6 w-6" />,
      title: "Beginner Friendly",
      description: "Step-by-step guidance and learning tools for new traders",
    },
    {
      icon: <Trophy className="h-6 w-6" />,
      title: "Live Contests",
      description: "Daily & weekly trading contests with real prizes",
    },
    {
      icon: <Gift className="h-6 w-6" />,
      title: "Amazing Rewards",
      description: "Cash prizes, vouchers & exclusive benefits",
    },
    {
      icon: <Target className="h-6 w-6" />,
      title: "Practice Mode",
      description: "Virtual trading mode to sharpen your skills",
    },
  ]

  const [isLogin, setIsLogin] = useState(true)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <div className="container relative min-h-screen flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0">
        {/* Left Panel - Hidden on mobile, shown on lg screens */}
        <div className="relative hidden h-full flex-col bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 p-6 sm:p-10 text-white lg:flex">
          <div className="absolute inset-0">
            <svg
              className="absolute inset-0 h-full w-full"
              xmlns="http://www.w3.org/2000/svg"
              width="100%"
              height="100%"
            >
              <defs>
                <pattern id="dotPattern" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
                  <circle cx="30" cy="30" r="2" fill="#ffffff" fillOpacity="0.05" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#dotPattern)" />
            </svg>
          </div>

          <div className="relative z-20 flex items-center text-2xl font-bold">
            <div className="flex items-center space-x-3">
              <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                <TrendingUp className="h-8 w-8 text-white" />
              </div>
              <span className="bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">Stockverse</span>
            </div>
          </div>

          <div className="relative z-20 mt-8 sm:mt-12 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {features.map((feature, index) => (
              <Card
                key={index}
                className="bg-white/10 backdrop-blur-sm border-white/20 hover:bg-white/20 transition-all duration-300"
              >
                <CardContent className="p-4">
                  <div className="text-blue-200 mb-2 flex items-center gap-2">
                    {feature.icon}
                    <h3 className="font-semibold text-sm">{feature.title}</h3>
                  </div>
                  <p className="text-xs text-blue-100 opacity-90">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="relative z-20 mt-auto">
            <Card className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardContent className="p-6">
                <blockquote className="space-y-4">
                  <div className="flex items-center space-x-1 mb-2">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-lg font-medium">
                    "Stockverse made trading so simple! Won ₹5000 in my first contest. Highly recommended for
                    beginners!"
                  </p>
                  <footer className="text-sm text-blue-200">- Priya S., Mumbai</footer>
                </blockquote>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right Panel - Login/Register Form */}
        <div className="flex items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-[400px] space-y-6">
            <div className="flex items-center justify-center space-x-3 lg:hidden mb-6">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-3 rounded-xl">
                <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
              </div>
              <span className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Stockverse
              </span>
            </div>

            <div className="space-y-6">
              <div className="space-y-2 text-center">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  {isLogin ? "Welcome Back" : "Create Account"}
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground">
                  {isLogin ? "Trade Smart, Win Big! 🚀" : "Start your trading journey today! 🚀"}
                </p>
              </div>

              {isLogin ? <LoginForm /> : <RegisterForm />}

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    {isLogin ? "New to Stockverse?" : "Already have an account?"}
                  </span>
                </div>
              </div>

              <Button
                variant="outline"
                onClick={() => setIsLogin(!isLogin)}
                className="w-full h-12 text-base sm:text-sm font-medium transition-all duration-200"
              >
                {isLogin ? "Create an Account" : "Sign In Instead"}
              </Button>
            </div>

            <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600" />
                  <span className="font-semibold text-sm sm:text-base text-green-700">Live Contest Alert!</span>
                </div>
                <p className="text-xs sm:text-sm text-green-600">
                  Weekly Trading Contest - Win up to ₹10,000!
                  <br />
                  <span className="font-medium">Registration ends in 2 days</span>
                </p>
              </CardContent>
            </Card>

            <p className="px-4 sm:px-8 text-center text-xs sm:text-sm text-muted-foreground">
              By {isLogin ? "logging in" : "creating an account"}, you agree to our{" "}
              <a href="/terms" className="text-primary hover:text-primary/80 underline underline-offset-4">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="/privacy" className="text-primary hover:text-primary/80 underline underline-offset-4">
                Privacy Policy
              </a>
              .
            </p>
          </div>
        </div>
      </div>
      <Toaster />
    </div>
  )
}
