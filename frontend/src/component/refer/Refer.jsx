"use client"

import { useGetUserByIdQuery } from "@/store/api/userSliceApi"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  Copy,
  Share2,
  MessageCircle,
  Link2,
  Users,
  Gift,
  Facebook,
  Twitter,
  Linkedin,
  Send,
  Mail,
  Phone,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Link } from "react-router-dom"

export default function Refer() {
  const { data: user, isLoading, isError } = useGetUserByIdQuery()
  const { toast } = useToast()
  const [showAllOptions, setShowAllOptions] = useState(false)
  const [copied, setCopied] = useState(false)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (isError || !user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Failed toload user data</p>
      </div>
    )
  }

  // Generate referral link with id, username, email first 3 chars, and today's day
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://yourapp.com"
  const emailFirst3 = user.email ? user.email.slice(0, 3) : ""
  const todayDay = new Date().getDate().toString().padStart(2, "0")
  const referralLink = `${baseUrl}/login?ref=${user.id}&referrer=${user.username}&e=${emailFirst3}&d=${todayDay}`

  // Calculate referral stats
  const totalReferrals = Array.isArray(user.referralsMade) ? user.referralsMade.length : 0;
  const totalEarned = Array.isArray(user.referralsReceived)
    ? user.referralsReceived.reduce((sum, r) => sum + Number(r.reward_amount || 0), 0)
    : 0;

  // Unified share message for all platforms
  const shareMessage = `🚀 Experience live market trading with virtual money on StockVerses!

Trade real stocks with real-time data, compete in contests, and win prizes — all without risking your actual money.

How StockVerses Works:
1️⃣ Create Account: Sign up and get instant access to your trading dashboard with virtual money.
2️⃣ Real-Time Trading: Trade live stocks with real market data using virtual money — no risk involved.
3️⃣ Join Contests: Participate in daily and weekly trading contests with other skilled traders.
4️⃣ Win Prizes: Top performers earn real cash prizes and recognition on our leaderboards.

Start your journey now using my referral link:
${referralLink}

Sign up today and let's trade together! 💸🔥`

  const whatsappMessage = shareMessage

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
      toast({
        title: "Copied!",
        description: "Referral link copied to clipboard",
      })
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive",
      })
    }
  }

  const shareOnWhatsApp = () => {
    const encodedMessage = encodeURIComponent(whatsappMessage)
    const whatsappUrl = `https://wa.me/?text=${encodedMessage}`
    window.open(whatsappUrl, "_blank")
  }

  const shareOnFacebook = () => {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}&quote=${encodeURIComponent(shareMessage)}`
    window.open(facebookUrl, "_blank")
  }

  const shareOnTwitter = () => {
    const twitterText = `${shareMessage} #StockVerses #VirtualTrading`
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(twitterText)}`
    window.open(twitterUrl, "_blank")
  }

  const shareOnLinkedIn = () => {
    const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralLink)}`
    window.open(linkedinUrl, "_blank")
  }

  const shareOnTelegram = () => {
    const telegramText = shareMessage
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(telegramText)}`
    window.open(telegramUrl, "_blank")
  }

  const shareViaEmail = () => {
    const subject = "Join me on StockVerses – Trade, Compete & Win!"
    const body = shareMessage
    const emailUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.open(emailUrl)
  }

  const shareViaSMS = () => {
    const smsText = shareMessage
    const smsUrl = `sms:?body=${encodeURIComponent(smsText)}`
    window.open(smsUrl)
  }

  const shareViaWebShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join me on StockVerses!",
          text: shareMessage,
          url: referralLink,
        })
      } catch (err) {
        console.log("Error sharing:", err)
      }
    } else {
      copyToClipboard(referralLink)
    }
  }

  const socialShareOptions = [
    {
      name: "WhatsApp",
      icon: MessageCircle,
      action: shareOnWhatsApp,
      color: "bg-green-600 hover:bg-green-700",
      primary: true,
    },
    {
      name: "Copy Link",
      icon: Copy,
      action: () => copyToClipboard(referralLink),
      color: "bg-blue-600 hover:bg-blue-700",
      primary: true,
    },
    {
      name: "Share",
      icon: Share2,
      action: shareViaWebShare,
      color: "bg-purple-600 hover:bg-purple-700",
      primary: true,
    },
    { name: "Facebook", icon: Facebook, action: shareOnFacebook, color: "bg-blue-700 hover:bg-blue-800" },
    { name: "Twitter", icon: Twitter, action: shareOnTwitter, color: "bg-sky-500 hover:bg-sky-600" },
    { name: "LinkedIn", icon: Linkedin, action: shareOnLinkedIn, color: "bg-blue-800 hover:bg-blue-900" },
    { name: "Telegram", icon: Send, action: shareOnTelegram, color: "bg-blue-500 hover:bg-blue-600" },
    { name: "Email", icon: Mail, action: shareViaEmail, color: "bg-gray-600 hover:bg-gray-700" },
    { name: "SMS", icon: Phone, action: shareViaSMS, color: "bg-green-500 hover:bg-green-600" },
  ]

  const primaryOptions = socialShareOptions.filter((option) => option.primary)
  const secondaryOptions = socialShareOptions.filter((option) => !option.primary)

  return (
    <div className="container mx-auto p-3 sm:p-4 max-w-2xl">
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Users className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            <h1 className="text-xl sm:text-2xl font-bold">Refer & Earn</h1>
          </div>
          <p className="text-sm sm:text-base text-muted-foreground px-2">
            Share your referral link and earn rewards when friends join!
          </p>
        </div>

        {/* User Info Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Gift className="h-4 w-4 sm:h-5 sm:w-5" />
              Your Referral Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="text-center p-3 bg-primary/5 rounded-lg">
                <div className="text-xl sm:text-2xl font-bold text-primary">₹{totalEarned}</div>
                <div className="text-xs sm:text-sm text-muted-foreground">Current Balance</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-xl sm:text-2xl font-bold text-green-600">{totalReferrals || 0}</div>
                <div className="text-xs sm:text-sm text-muted-foreground">Total Referrals</div>
              </div>
            </div>
            {/* Show total earned if any referrals made */}
            {user.referralsMade && user.referralsMade.length > 0 && (
              <div className="mt-3 text-center">
                <span className="text-sm text-green-700 font-semibold">
                  Total Earned: ₹{user.referralsMade.reduce((sum, r) => sum + Number(r.reward_amount || 0), 0)}
                </span>
              </div>
            )}
            {/* Add earning potential banner */}
            <div className="mt-4 p-3 bg-gradient-to-r from-green-500 to-green-600 rounded-lg text-white text-center">
              <div className="text-lg font-bold">₹50 Per Referral</div>
              <div className="text-xs text-green-100">Earn instantly when friends join!</div>
            </div>
          </CardContent>
        </Card>

        {/* Referral Link Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Link2 className="h-4 w-4 sm:h-5 sm:w-5" />
              Your Referral Link
            </CardTitle>
            <CardDescription className="text-sm">Share this link with friends to earn rewards</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Referral Link Input */}
            <div className="space-y-2">
              <Label htmlFor="referral-link" className="text-sm">
                Referral Link
              </Label>
              <div className="flex gap-2">
                <Input id="referral-link" value={referralLink} readOnly className="font-mono text-xs sm:text-sm" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(referralLink)}
                  className="shrink-0 relative"
                >
                  <Copy className="h-4 w-4" />
                  {copied && (
                    <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-black text-white text-xs rounded px-2 py-1 shadow z-10 whitespace-nowrap">Copied!</span>
                  )}
                </Button>
              </div>
            </div>

            <Separator />

            {/* Primary Share Options */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Quick Share</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {primaryOptions.map((option) => (
                  <Button
                    key={option.name}
                    onClick={option.action}
                    className={`flex items-center gap-2 text-white ${option.color} text-sm h-10`}
                  >
                    <option.icon className="h-4 w-4" />
                    {option.name}
                  </Button>
                ))}
              </div>
            </div>

            {/* More Share Options */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">More Options</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllOptions(!showAllOptions)}
                  className="text-xs"
                >
                  {showAllOptions ? "Show Less" : "Show More"}
                </Button>
              </div>

              {showAllOptions && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {secondaryOptions.map((option) => (
                    <Button
                      key={option.name}
                      onClick={option.action}
                      variant="outline"
                      className={`flex items-center gap-2 text-white ${option.color} border-0 text-xs h-9`}
                    >
                      <option.icon className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">{option.name}</span>
                      <span className="sm:hidden">{option.name.split(" ")[0]}</span>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Reward Structure Card */}
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg text-green-700">
              <Gift className="h-4 w-4 sm:h-5 sm:w-5" />
              Referral Rewards
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-green-200">
                <div>
                  <p className="font-semibold text-green-700">Per Successful Referral</p>
                  <p className="text-sm text-green-600">When friend completes registration</p>
                </div>
                <div className="text-2xl font-bold text-green-700">₹50</div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-white rounded border border-green-200">
                  <div className="text-lg font-bold text-green-700">₹500</div>
                  <div className="text-xs text-green-600">10 referrals</div>
                </div>
                <div className="p-2 bg-white rounded border border-green-200">
                  <div className="text-lg font-bold text-green-700">₹1,500</div>
                  <div className="text-xs text-green-600">30 referrals</div>
                </div>
                <div className="p-2 bg-white rounded border border-green-200">
                  <div className="text-lg font-bold text-green-700">₹5,000</div>
                  <div className="text-xs text-green-600">100 referrals</div>
                </div>
              </div>

              <div className="text-center p-2 bg-gradient-to-r from-green-500 to-green-600 rounded text-white">
                <p className="text-sm font-medium">💡 No limit on referrals - Keep earning!</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* How it Works */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">How Referral Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Badge variant="secondary" className="mt-0.5 text-xs">
                  1
                </Badge>
                <div className="flex-1">
                  <p className="font-medium text-sm">Share your link</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Send your referral link to friends via any platform
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Badge variant="secondary" className="mt-0.5 text-xs">
                  2
                </Badge>
                <div className="flex-1">
                  <p className="font-medium text-sm">Friend registers</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    When they click your link and complete registration, you both get rewards
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Badge variant="secondary" className="mt-0.5 text-xs">
                  3
                </Badge>
                <div className="flex-1">
                  <p className="font-medium text-sm">Earn ₹50 instantly</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Get ₹50 credited to your account immediately for each successful referral
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      {/* Terms and Conditions Link */}
      <div className="text-center mt-6 mb-24">
        <Link
          to="https://stockverses.com/refer/terms-and-conditions"
          className="text-xs text-muted-foreground underline hover:text-primary transition-colors"
        >
          Terms & Conditions apply
        </Link>
      </div>
    </div>
  )
}
