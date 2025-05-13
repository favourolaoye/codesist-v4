"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Keyboard, Clock, BarChart3, Code, History, Award, LogOut, User } from "lucide-react"
import { TimeBasedGreeting } from "@/components/time-based-greeting"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { formatDate } from "@/lib/utils/date-formatter"

interface Challenge {
  id: string
  title: string
  language: string
  difficulty: string
  description: string | null
}

interface ChallengeAttempt {
  id: string
  challenge_id: string
  wpm: number
  accuracy: number
  time_seconds: number
  created_at: string
  challenge: Challenge
}

interface LanguageStats {
  language: string
  avgWpm: number
  attempts: number
  avgAccuracy: number
}

interface TimeSeriesData {
  date: string
  wpm: number
}

export default function DashboardPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [recentAttempts, setRecentAttempts] = useState<ChallengeAttempt[]>([])
  const [profile, setProfile] = useState<{
    username: string | null
    avatar_url: string | null
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState({
    avgWpm: 0,
    completedChallenges: 0,
    avgAccuracy: 0,
  })
  const [languageStats, setLanguageStats] = useState<LanguageStats[]>([])
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([])

  const supabase = createClient()
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setIsLoading(true)

        // Get current user
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          router.push("/login")
          return
        }

        // Get user profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("username, avatar_url")
          .eq("id", user.id)
          .single()

        setProfile(profileData)

        // Get challenges
        const { data: challengesData } = await supabase
          .from("challenges")
          .select("id, title, language, difficulty, description")

        setChallenges(challengesData || [])

        // Get all attempts with challenge data for statistics
        const { data: allAttemptsData } = await supabase
          .from("challenge_attempts")
          .select(`
        id, 
        challenge_id, 
        wpm, 
        accuracy, 
        time_seconds, 
        created_at,
        challenge:challenges(id, title, language, difficulty)
      `)
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })

        // Get recent attempts (limit to 5)
        const recentAttemptsData = allAttemptsData?.slice(-5).reverse() || []

        const formattedAttempts =
          recentAttemptsData.map((attempt) => ({
            ...attempt,
            challenge: attempt.challenge as unknown as Challenge,
          })) || []

        setRecentAttempts(formattedAttempts)

        // Calculate stats
        if (allAttemptsData && allAttemptsData.length > 0) {
          const totalWpm = allAttemptsData.reduce((sum, attempt) => sum + attempt.wpm, 0)
          const totalAccuracy = allAttemptsData.reduce((sum, attempt) => sum + attempt.accuracy, 0)
          const uniqueChallenges = new Set(allAttemptsData.map((attempt) => attempt.challenge_id)).size

          setStats({
            avgWpm: Math.round(totalWpm / allAttemptsData.length),
            completedChallenges: uniqueChallenges,
            avgAccuracy: Math.round(totalAccuracy / allAttemptsData.length),
          })

          // Process language statistics
          const languageMap = new Map<string, { totalWpm: number; totalAccuracy: number; count: number }>()

          allAttemptsData.forEach((attempt) => {
            const language = (attempt.challenge as any).language
            if (!language) return

            const current = languageMap.get(language) || { totalWpm: 0, totalAccuracy: 0, count: 0 }
            languageMap.set(language, {
              totalWpm: current.totalWpm + attempt.wpm,
              totalAccuracy: current.totalAccuracy + attempt.accuracy,
              count: current.count + 1,
            })
          })

          const processedLanguageStats: LanguageStats[] = Array.from(languageMap.entries()).map(
            ([language, { totalWpm, totalAccuracy, count }]) => ({
              language,
              avgWpm: Math.round(totalWpm / count),
              attempts: count,
              avgAccuracy: Math.round(totalAccuracy / count),
            }),
          )

          setLanguageStats(processedLanguageStats)

          // Process time series data (last 30 days)
          const thirtyDaysAgo = new Date()
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

          const recentAttempts = allAttemptsData
            .filter((attempt) => new Date(attempt.created_at) >= thirtyDaysAgo)
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

          // Group by date
          const dateMap = new Map<string, { totalWpm: number; count: number }>()

          recentAttempts.forEach((attempt) => {
            const dateStr = formatDate(attempt.created_at)
            const current = dateMap.get(dateStr) || { totalWpm: 0, count: 0 }
            dateMap.set(dateStr, {
              totalWpm: current.totalWpm + attempt.wpm,
              count: current.count + 1,
            })
          })

          const processedTimeSeriesData: TimeSeriesData[] = Array.from(dateMap.entries()).map(
            ([date, { totalWpm, count }]) => ({
              date,
              wpm: Math.round(totalWpm / count),
            }),
          )

          setTimeSeriesData(processedTimeSeriesData)
        }
      } catch (error) {
        console.error("Error fetching data:", error)
        toast({
          title: "Error",
          description: "Failed to load dashboard data",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchUserData()
  }, [router, supabase, toast])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  // Helper function to check if a string is a base64 image
  const isBase64Image = (str: string) => {
    return str && str.startsWith("data:image/")
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container flex h-16 items-center px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Keyboard className="h-6 w-6" />
            <span>CodeTyper</span>
          </Link>
          <nav className="ml-auto flex items-center gap-4">
            <Link href="/profile">
              <Button variant="ghost" size="sm" className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={profile?.avatar_url || ""} alt={profile?.username || "User"} />
                  <AvatarFallback>
                    {profile?.username?.charAt(0).toUpperCase() || <User className="h-4 w-4" />}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden md:inline">Profile</span>
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              <span className="hidden md:inline">Logout</span>
            </Button>
          </nav>
        </div>
      </header>
      <main className="flex-1 container py-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex flex-col gap-2">
              <TimeBasedGreeting username={profile?.username || "Developer"} />
              <p className="text-muted-foreground">Ready to improve your coding speed today?</p>
            </div>
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border-2 border-primary/10">
                <AvatarImage src={profile?.avatar_url || ""} alt={profile?.username || "User"} />
                <AvatarFallback className="text-xl">
                  {profile?.username?.charAt(0).toUpperCase() || <User className="h-8 w-8" />}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="font-medium">{profile?.username || "User"}</span>
                <Link href="/profile" className="text-sm text-primary hover:underline">
                  Edit Profile
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average WPM</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.avgWpm || 0}</div>
                <p className="text-xs text-muted-foreground">Keep practicing to improve!</p>
                <Progress value={stats.avgWpm} max={100} className="mt-3" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Challenges Completed</CardTitle>
                <Code className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.completedChallenges}</div>
                <p className="text-xs text-muted-foreground">
                  {challenges.length - stats.completedChallenges} remaining
                </p>
                <Progress value={stats.completedChallenges} max={challenges.length || 1} className="mt-3" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Accuracy</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.avgAccuracy}%</div>
                <p className="text-xs text-muted-foreground">Great job on your precision!</p>
                <Progress value={stats.avgAccuracy} max={100} className="mt-3" />
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="challenges">
            <TabsList>
              <TabsTrigger value="challenges">Challenges</TabsTrigger>
              <TabsTrigger value="recent">Recent Activity</TabsTrigger>
              <TabsTrigger value="stats">Statistics</TabsTrigger>
            </TabsList>
            <TabsContent value="challenges" className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Available Challenges</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {challenges.map((challenge) => (
                  <Card key={challenge.id}>
                    <CardHeader>
                      <CardTitle>{challenge.title}</CardTitle>
                      <CardDescription>
                        {challenge.language} • {challenge.difficulty}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {challenge.description || "Practice your coding speed with this challenge."}
                      </p>
                    </CardContent>
                    <CardFooter>
                      <Link href={`/challenge/${challenge.id}`} className="w-full">
                        <Button className="w-full">Start Challenge</Button>
                      </Link>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="recent">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Recent Activity</h2>
              </div>
              {recentAttempts.length > 0 ? (
                <div className="space-y-4">
                  {recentAttempts.map((attempt) => (
                    <Card key={attempt.id}>
                      <CardHeader>
                        <div className="flex justify-between">
                          <CardTitle>{attempt.challenge.title}</CardTitle>
                          <span className="text-sm text-muted-foreground">
                            {new Date(attempt.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <CardDescription>
                          {attempt.challenge.language} • {attempt.challenge.difficulty}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <span>Speed: {attempt.wpm} WPM</span>
                          <span>Accuracy: {attempt.accuracy}%</span>
                        </div>
                      </CardContent>
                      <CardFooter>
                        <Link href={`/challenge/${attempt.challenge_id}`} className="w-full">
                          <Button variant="outline" className="w-full">
                            <History className="h-4 w-4 mr-2" />
                            Try Again
                          </Button>
                        </Link>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <History className="h-12 w-12 mx-auto text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-medium">No recent activity</h3>
                  <p className="text-muted-foreground mt-2">Complete some challenges to see your activity here.</p>
                  <Link href="#challenges">
                    <Button className="mt-4">Start a Challenge</Button>
                  </Link>
                </div>
              )}
            </TabsContent>
            <TabsContent value="stats">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Your Statistics</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Speed Over Time</CardTitle>
                    <CardDescription>Your typing speed in WPM over the last 30 days</CardDescription>
                  </CardHeader>
                  <CardContent className="h-80">
                    {timeSeriesData.length > 0 ? (
                      <div className="h-full">
                        <div className="h-full flex flex-col">
                          <div className="flex-1 flex">
                            {timeSeriesData.map((point, i) => {
                              const height = `${(point.wpm / 100) * 100}%`
                              return (
                                <div key={i} className="flex-1 flex flex-col justify-end px-1">
                                  <div
                                    className="bg-primary/80 rounded-t-sm w-full"
                                    style={{ height }}
                                    title={`${point.date}: ${point.wpm} WPM`}
                                  ></div>
                                </div>
                              )
                            })}
                          </div>
                          <div className="h-6 mt-2 flex">
                            {timeSeriesData.map((point, i) => (
                              <div key={i} className="flex-1 text-xs text-center truncate">
                                {point.date}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <div className="text-center text-muted-foreground">
                          <BarChart3 className="h-16 w-16 mx-auto" />
                          <p className="mt-2">Complete more challenges to see your progress over time</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Language Breakdown</CardTitle>
                    <CardDescription>Your performance across different languages</CardDescription>
                  </CardHeader>
                  <CardContent className="h-80">
                    {languageStats.length > 0 ? (
                      <div className="space-y-4">
                        {languageStats.map((stat, index) => (
                          <div key={index} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="font-medium">{stat.language}</span>
                              <span>{stat.avgWpm} WPM</span>
                            </div>
                            <Progress value={stat.avgWpm} max={100} className="h-2" />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{stat.attempts} attempts</span>
                              <span>{stat.avgAccuracy}% accuracy</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <div className="text-center text-muted-foreground">
                          <BarChart3 className="h-16 w-16 mx-auto" />
                          <p className="mt-2">Try challenges in different languages to see your breakdown</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <footer className="border-t py-6">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            &copy; {new Date().getFullYear()} CodeTyper. All rights reserved.
          </p>
          <div className="flex gap-4">
            <Link href="/about" className="text-sm text-gray-500 hover:underline dark:text-gray-400">
              About
            </Link>
            <Link href="/privacy" className="text-sm text-gray-500 hover:underline dark:text-gray-400">
              Privacy
            </Link>
            <Link href="/terms" className="text-sm text-gray-500 hover:underline dark:text-gray-400">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
