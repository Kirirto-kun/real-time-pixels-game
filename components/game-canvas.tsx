"use client"

import type React from "react"
import { useRef, useEffect } from "react"
import type { Player } from "@/types"
import { VISUAL_WIDTH, VISUAL_HEIGHT, PIXEL_SCALE, PLAYER_SIZE } from "@/lib/utils"

interface GameCanvasProps {
  players: Record<string, Player>
  currentPlayerId: string | null
}

const GameCanvas: React.FC<GameCanvasProps> = ({ players, currentPlayerId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext("2d")
    if (!context) return

    // Clear canvas
    context.fillStyle = "#222" // Dark background
    context.fillRect(0, 0, VISUAL_WIDTH, VISUAL_HEIGHT)

    // Draw players
    Object.values(players).forEach((player) => {
      context.fillStyle = player.color
      context.fillRect(
        player.x * PIXEL_SCALE,
        player.y * PIXEL_SCALE,
        PLAYER_SIZE * PIXEL_SCALE,
        PLAYER_SIZE * PIXEL_SCALE,
      )

      // Optionally draw name above player
      if (player.id === currentPlayerId || Object.keys(players).length < 10) {
        // Show name for current player or if few players
        context.fillStyle = "#FFF"
        context.font = "10px Arial"
        context.textAlign = "center"
        context.fillText(
          player.name,
          player.x * PIXEL_SCALE + (PLAYER_SIZE * PIXEL_SCALE) / 2,
          player.y * PIXEL_SCALE - 5,
        )
      }
    })
  }, [players, currentPlayerId])

  return <canvas ref={canvasRef} width={VISUAL_WIDTH} height={VISUAL_HEIGHT} className="border border-gray-700" />
}

export default GameCanvas
