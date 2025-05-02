"use client"

import { useEffect, useState } from "react"

interface TimeBasedGreetingProps {
  username: string
}

export function TimeBasedGreeting({ username }: TimeBasedGreetingProps) {
  const [greeting, setGreeting] = useState("")

  useEffect(() => {
    const updateGreeting = () => {
      const hour = new Date().getHours()

      if (hour >= 5 && hour < 12) {
        setGreeting("Good morning")
      } else if (hour >= 12 && hour < 18) {
        setGreeting("Good afternoon")
      } else {
        setGreeting("Good evening")
      }
    }

    updateGreeting()

    // Update greeting if user keeps the app open across time boundaries
    const interval = setInterval(updateGreeting, 60000)

    return () => clearInterval(interval)
  }, [])

  return (
    <h1 className="text-2xl font-bold tracking-tight">
      {greeting}, {username}!
    </h1>
  )
}
