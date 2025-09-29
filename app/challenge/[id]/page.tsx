"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Clock, ArrowLeft, RotateCcw, AlertCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { ToastContainer, toast } from 'react-toastify';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface ChallengeProps {
  params: {
    id: string
  }
}

interface Challenge {
  id: string
  title: string
  language: string
  difficulty: string
  code: string
  description: string | null
}

// Time limits in minutes based on difficulty
const TIME_LIMITS = {
  easy: 20,
  medium: 15,
  hard: 10,
}

export default function ChallengePage({ params }: ChallengeProps) {
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [input, setInput] = useState("")
  const [isStarted, setIsStarted] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  const [startTime, setStartTime] = useState<number | null>(null)
  const [endTime, setEndTime] = useState<number | null>(null)
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [wpm, setWpm] = useState(0)
  const [accuracy, setAccuracy] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [showTimeAlert, setShowTimeAlert] = useState(false)
  const [timeLimit, setTimeLimit] = useState<number>(0)
  const [errors, setErrors] = useState<number[]>([])
  const [hasTyped, setHasTyped] = useState(false)

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const supabase = createClient()
  const router = useRouter()
 

  useEffect(() => {
    const fetchChallenge = async () => {
      try {
        setIsLoading(true)

        // Get current user
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
         toast.error("Auth required!")
          router.push("/login")
          return
        }

        setUserId(user.id)

        // Get challenge data
        const { data, error } = await supabase.from("challenges").select("*").eq("id", params.id).single()

        if (error) {
          toast.error("Challenge not found!")
          throw error
        }

        setChallenge(data)
        // toast.success("challenge loaded")

        // Set time limit based on difficulty
        const minutes = TIME_LIMITS[data.difficulty.toLowerCase() as keyof typeof TIME_LIMITS] || 30
        setTimeLimit(minutes * 60) // Convert to seconds
        setTimeLeft(minutes * 60)
      } catch (error) {
        console.error("Error fetching challenge:", error)
       toast.error("Failed to load challenge!")
        router.push("/dashboard")
      } finally {
        setIsLoading(false)
      }
    }

    fetchChallenge()

    // Cleanup timer on unmount
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [params.id, router, supabase, toast])

  // Timer effect
  useEffect(() => {
    if (isStarted && !isCompleted && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          const newTime = prev - 1
          if (newTime <= 0) {
            // Time's up - auto submit
            if (timerRef.current) clearInterval(timerRef.current)
            setShowTimeAlert(true)
            toast.info("Time's up!")
            return 0
          }

          // Show warning when time is running low
          if (newTime === 60) {
          // toast.info("You're runnig out of time!")
          }

          return newTime
        })
      }, 1000)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isStarted, isCompleted, timeLeft, toast])

  const startChallenge = () => {
    setIsStarted(true)
    setStartTime(Date.now())
    setInput("")
    setErrors([])
    setHasTyped(false)
    setAccuracy(0)

   toast.info("Challenge Started!")

    // Focus the input field
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  const resetChallenge = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    setIsStarted(false)
    setIsCompleted(false)
    setInput("")
    setStartTime(null)
    setEndTime(null)
    setTimeLeft(timeLimit)
    setWpm(0)
    setAccuracy(0)
    setErrors([])
    setHasTyped(false)

   toast.info("Challenge reseted!")
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!challenge || isCompleted) return

    const newInput = e.target.value
    setInput(newInput)

    if (!hasTyped && newInput.length > 0) {
      setHasTyped(true)
    }

    // Calculate accuracy and find errors
    let correctChars = 0
    const newErrors: number[] = []

    for (let i = 0; i < newInput.length; i++) {
      if (i < challenge.code.length && newInput[i] === challenge.code[i]) {
        correctChars++
      } else {
        newErrors.push(i)
      }
    }

    setErrors(newErrors)

    // Only calculate accuracy if the user has typed something
    if (newInput.length > 0) {
      const newAccuracy = Math.round((correctChars / newInput.length) * 100)
      setAccuracy(newAccuracy)

      // Notify on first error
      if (newErrors.length === 1 && errors.length === 0) {
        // toast.error("Fix code errors")
      }
    } else {
      setAccuracy(0)
    }

    // Check if challenge is completed
    if (newInput === challenge.code) {
      toast.info("Good Job")
      completeChallenge()
    }
  }

  const completeChallenge = async () => {
    if (!challenge || !userId || isCompleted) return

    // Don't allow completion if nothing has been typed
    if (input.length === 0) {
     toast.error("Cannot submit empty attempt")
      return
    }

    const now = Date.now()
    setEndTime(now)
    setIsCompleted(true)

    if (timerRef.current) clearInterval(timerRef.current)

    let calculatedWpm = 0
    let timeInSeconds = 0

    if (startTime) {
      timeInSeconds = Math.max(1, Math.floor((now - startTime) / 1000)) // Ensure at least 1 second
      const timeInMinutes = timeInSeconds / 60
      const words = challenge.code.length / 5 // Standard WPM calculation

      // Calculate WPM based on how much was actually typed
      const typedWords = input.length / 5
      calculatedWpm = Math.round(typedWords / timeInMinutes)

      setWpm(calculatedWpm)
    }

    // Save the result to the database
    try {
      const { error } = await supabase.from("challenge_attempts").insert({
        user_id: userId,
        challenge_id: challenge.id,
        wpm: calculatedWpm,
        accuracy: accuracy,
        time_seconds: timeInSeconds,
        completed: true, 
      })

      if (error) {
        toast.error("Error saving results")
        throw error
      }

      // toast.info(`${input} === ${challenge.code} ? "Challenge completed!" : "Attempt saved"`)
    } catch (error) {
      console.error("Error saving results:", error)
      toast.error(`Error saving results: ${error}`)
    }
  }

  const handleTimeUp = () => {
    setShowTimeAlert(false)
    completeChallenge()
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  // Prevent copy and paste
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    toast.info("Copy/Paste disabled chief!")
  }

  const handleCopy = (e: React.ClipboardEvent) => {
    e.preventDefault()
    toast.info("Don't copy chief!")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Prevent keyboard shortcuts for copy/paste
    if ((e.ctrlKey || e.metaKey) && (e.key === "c" || e.key === "v" || e.key === "x")) {
      e.preventDefault()
     toast.info("Put in the work!")
    }
  }

  // Render code with highlighted errors
  const renderCodeWithErrors = () => {
    if (!challenge) return null

    // If there are no errors or no input, just show the code
    if (errors.length === 0 || input.length === 0) {
      return <pre className="font-mono text-sm whitespace-pre-wrap">{challenge.code}</pre>
    }

    // Create spans for each character with appropriate styling
    return (
      <pre className="font-mono text-sm whitespace-pre-wrap">
        {challenge.code.split("").map((char, index) => {
          // Only highlight up to the length of input
          const isError = index < input.length && errors.includes(index)
          const isTyped = index < input.length

          return (
            <span
              key={index}
              className={
                isError
                  ? "bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300"
                  : isTyped
                    ? "bg-green-200 text-green-800 dark:bg-green-900/50 dark:text-green-300"
                    : ""
              }
            >
              {char}
            </span>
          )
        })}
      </pre>
    )
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>Loading challenge...</p>
        </div>
      </div>
    )
  }

  if (!challenge) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p>Challenge not found</p>
          <Link href="/dashboard">
            <Button
              className="mt-4"
              onClick={() => {
                toast.info("Can't, find challenge!")
              }}
            >
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AlertDialog open={showTimeAlert} onOpenChange={setShowTimeAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Time's up!</AlertDialogTitle>
            <AlertDialogDescription>
              Your time for this challenge has ended. Your progress will be saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleTimeUp}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <header className="border-b">
        <div className="container flex h-16 items-center px-4 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Dashboard</span>
          </Link>
          <div className="ml-auto flex items-center gap-4">
            {isStarted && !isCompleted && (
              <div className="flex items-center gap-2">
                <Clock className={`h-4 w-4 ${timeLeft < 60 ? "text-red-500 animate-pulse" : ""}`} />
                <span className={timeLeft < 60 ? "text-red-500 font-bold" : ""}>{formatTime(timeLeft)}</span>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 container p-6">
        <div className="max-w-3xl mx-auto">
          <Card className="mb-6">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>{challenge.title}</CardTitle>
                  <CardDescription>
                    {challenge.language} • {challenge.difficulty} • Time Limit: {formatTime(timeLimit)}
                  </CardDescription>
                </div>
                {!isStarted ? (
                  <Button onClick={startChallenge}>Start Challenge</Button>
                ) : !isCompleted ? (
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={resetChallenge}>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Reset
                    </Button>
                    <Button
                      onClick={completeChallenge}
                      disabled={!hasTyped}
                      title={!hasTyped ? "Type some code first" : "Submit your attempt"}
                    >
                      Submit
                    </Button>
                  </div>
                ) : (
                  <Button onClick={resetChallenge}>Try Again</Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isStarted ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-3 rounded-md dark:bg-amber-950/30 dark:text-amber-400">
                    <AlertCircle className="h-5 w-5" />
                    <p className="text-sm">
                      You have {formatTime(timeLimit)} to complete this challenge. The timer will start when you click
                      "Start Challenge".
                    </p>
                  </div>
                  <div className="bg-muted p-4 rounded-md">
                    <pre className="font-mono text-sm whitespace-pre-wrap">{challenge.code}</pre>
                  </div>
                </div>
              ) : isCompleted ? (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="bg-muted p-4 rounded-md text-center">
                      <div className="text-2xl font-bold">{wpm}</div>
                      <div className="text-sm text-muted-foreground">Words Per Minute</div>
                    </div>
                    <div className="bg-muted p-4 rounded-md text-center">
                      <div className="text-2xl font-bold">{accuracy}%</div>
                      <div className="text-sm text-muted-foreground">Accuracy</div>
                    </div>
                    <div className="bg-muted p-4 rounded-md text-center">
                      <div className="text-2xl font-bold">{formatTime(timeLimit - timeLeft)}</div>
                      <div className="text-sm text-muted-foreground">Time Taken</div>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">Your Results</h3>
                    <p className="text-muted-foreground mb-4">
                      {input === challenge.code
                        ? "Congratulations! You completed the entire challenge."
                        : `You typed ${Math.round((input.length / challenge.code.length) * 100)}% of the challenge.`}
                      <br />
                      {wpm < 40
                        ? "Keep practicing to improve your speed!"
                        : wpm < 60
                          ? "Good job! You're making progress."
                          : "Excellent speed! You're becoming a coding ninja."}
                    </p>
                    <div className="flex gap-4">
                      <Button onClick={resetChallenge}>Try Again</Button>
                      <Link href="/dashboard">
                        <Button variant="outline">Back to Dashboard</Button>
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between text-sm mb-2">
                    <div>Time Left: {formatTime(timeLeft)}</div>
                    <div className="flex items-center gap-2">
                      <span>Accuracy: {accuracy}%</span>
                      {errors.length > 0 && (
                        <span className="text-red-500">
                          ({errors.length} error{errors.length !== 1 ? "s" : ""})
                        </span>
                      )}
                    </div>
                  </div>
                  <Progress value={(input.length / challenge.code.length) * 100} className="mb-4" />
                  <div className="bg-muted p-4 rounded-md">{renderCodeWithErrors()}</div>
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={handleInputChange}
                    onPaste={handlePaste}
                    onCopy={handleCopy}
                    onCut={handleCopy}
                    onKeyDown={handleKeyDown}
                    className="w-full h-40 p-4 font-mono text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Start typing here..."
                    disabled={isCompleted}
                  />
                  {errors.length > 0 && (
                    <div className="text-sm text-red-500">
                      Please fix the highlighted errors to complete the challenge.
                    </div>
                  )}
                  {!hasTyped && <div className="text-sm text-amber-500">Start typing to begin the challenge.</div>}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <footer className="border-t py-6">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            &copy; {new Date().getFullYear()} Codesist. All rights reserved.
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
      <ToastContainer/>
    </div>
  )
}
