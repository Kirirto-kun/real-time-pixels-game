"use client"

import type React from "react"
import GameCanvas from "./game-canvas"
import { useGameEngine } from "@/hooks/use-game-engine"
import { Button } from "@/components/ui/button"

interface RealtimeGameProps {
  playerName: string
  onLeave: () => void
}

const RealtimeGame: React.FC<RealtimeGameProps> = ({ playerName, onLeave }) => {
  const { players, currentPlayerId } = useGameEngine(playerName)

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-800 text-white p-4">
      <h1 className="text-3xl font-bold mb-4">Real-time Pixel Game</h1>
      <p className="mb-2">
        Player: <span className="font-semibold text-yellow-400">{playerName}</span>
      </p>
      <p className="mb-4">Controls: W, A, S, D to move</p>
      <GameCanvas players={players} currentPlayerId={currentPlayerId} />
      <div className="mt-4">
        <h2 className="text-xl mb-2">Active Players ({Object.keys(players).length}):</h2>
        <ul className="max-h-32 overflow-y-auto text-sm">
          {Object.values(players).map((p) => (
            <li key={p.id} style={{ color: p.color }} className="mb-1">
              {p.name} {p.id === currentPlayerId ? "(You)" : ""}
            </li>
          ))}
        </ul>
      </div>
      <Button onClick={onLeave} variant="destructive" className="mt-6">
        Leave Game
      </Button>
    </div>
  )
}

export default RealtimeGame
