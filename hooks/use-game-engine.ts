"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase-client"
import { getRandomColor, LOGICAL_WIDTH, LOGICAL_HEIGHT } from "@/lib/utils"
import type { Player } from "@/types"
import { v4 as uuidv4 } from "uuid"
import type { RealtimeChannel } from "@supabase/supabase-js"

export const useGameEngine = (playerName: string | null) => {
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null)
  const [players, setPlayers] = useState<Record<string, Player>>({})
  const playerRef = useRef<Player | null>(null) // To access current player data in event handlers
  const channelRef = useRef<RealtimeChannel | null>(null)

  const initializePlayer = useCallback(() => {
    if (!playerName) return

    const newPlayerId = uuidv4()
    const newPlayer: Player = {
      id: newPlayerId,
      name: playerName,
      color: getRandomColor(),
      x: Math.floor(LOGICAL_WIDTH / 2),
      y: Math.floor(LOGICAL_HEIGHT / 2),
    }

    setCurrentPlayerId(newPlayerId)
    playerRef.current = newPlayer
    setPlayers((prev) => ({ ...prev, [newPlayerId]: newPlayer }))

    supabase
      .from("players")
      .insert(newPlayer)
      .then(({ error }) => {
        if (error) console.error("Error creating player:", error)
      })
  }, [playerName])

  useEffect(() => {
    if (playerName && !currentPlayerId) {
      initializePlayer()
    }
  }, [playerName, currentPlayerId, initializePlayer])

  const updatePlayerPosition = useCallback(async (newX: number, newY: number) => {
    if (!playerRef.current) return

    const updatedPlayer = { ...playerRef.current, x: newX, y: newY }
    playerRef.current = updatedPlayer // Optimistic update locally
    setPlayers((prev) => ({ ...prev, [updatedPlayer.id]: updatedPlayer }))

    const { error } = await supabase.from("players").update({ x: newX, y: newY }).match({ id: updatedPlayer.id })

    if (error) {
      console.error("Error updating player position:", error)
      // Potentially revert optimistic update or handle error
    }
  }, [])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!playerRef.current) return

      let { x, y } = playerRef.current
      const speed = 1 // Logical units

      switch (event.key.toLowerCase()) {
        case "w":
          y = Math.max(0, y - speed)
          break
        case "s":
          y = Math.min(LOGICAL_HEIGHT - 1, y + speed)
          break
        case "a":
          x = Math.max(0, x - speed)
          break
        case "d":
          x = Math.min(LOGICAL_WIDTH - 1, x + speed)
          break
        default:
          return
      }
      event.preventDefault() // Prevent page scrolling
      if (x !== playerRef.current.x || y !== playerRef.current.y) {
        updatePlayerPosition(x, y)
      }
    },
    [updatePlayerPosition],
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [handleKeyDown])

  useEffect(() => {
    // Fetch initial players
    supabase
      .from("players")
      .select("*")
      .then(({ data, error }) => {
        if (error) {
          console.error("Error fetching initial players:", error)
          return
        }
        if (data) {
          const initialPlayers = data.reduce(
            (acc, p) => {
              acc[p.id] = p as Player
              return acc
            },
            {} as Record<string, Player>,
          )
          setPlayers((prev) => ({ ...prev, ...initialPlayers })) // Merge with current player if already set
        }
      })

    const channel = supabase
      .channel("realtime-players")
      .on<Player>("postgres_changes", { event: "*", schema: "public", table: "players" }, (payload) => {
        if (payload.eventType === "INSERT") {
          setPlayers((prev) => ({ ...prev, [payload.new.id]: payload.new as Player }))
        } else if (payload.eventType === "UPDATE") {
          setPlayers((prev) => ({ ...prev, [payload.new.id]: payload.new as Player }))
        } else if (payload.eventType === "DELETE") {
          setPlayers((prev) => {
            const newPlayers = { ...prev }
            delete newPlayers[payload.old.id as string]
            return newPlayers
          })
        }
      })
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          console.log("Subscribed to players channel!")
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          console.error(`Channel error: ${status}`, err)
        }
      })
    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [])

  // Player disconnect logic
  useEffect(() => {
    const localPlayerId = currentPlayerId // Capture for cleanup

    const handleBeforeUnload = async () => {
      if (localPlayerId) {
        // This is best-effort. Supabase client might not complete request.
        await supabase.from("players").delete().match({ id: localPlayerId })
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      if (localPlayerId) {
        supabase
          .from("players")
          .delete()
          .match({ id: localPlayerId })
          .then(({ error }) => {
            if (error) console.error("Error removing player on unmount:", error)
            else console.log(`Player ${localPlayerId} removed on unmount.`)
          })
      }
    }
  }, [currentPlayerId])

  return { players, currentPlayerId }
}
