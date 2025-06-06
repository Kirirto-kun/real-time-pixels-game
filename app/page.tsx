"use client"

import { useState, type FormEvent } from "react"
import RealtimeGame from "@/components/realtime-game"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export default function HomePage() {
  const [playerName, setPlayerName] = useState<string | null>(null)
  const [inputName, setInputName] = useState<string>("")

  const handleNameSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (inputName.trim()) {
      setPlayerName(inputName.trim())
    }
  }

  const handleLeaveGame = () => {
    setPlayerName(null)
    setInputName("")
    // The useGameEngine hook's cleanup should handle removing the player from DB
  }

  if (!playerName) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-2xl">Enter the Pixelverse</CardTitle>
            <CardDescription>Choose a name to join the game.</CardDescription>
          </CardHeader>
          <form onSubmit={handleNameSubmit}>
            <CardContent className="space-y-4">
              <Input
                type="text"
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                placeholder="Your Name"
                required
                className="text-black"
              />
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full">
                Join Game
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    )
  }

  return <RealtimeGame playerName={playerName} onLeave={handleLeaveGame} />
}
