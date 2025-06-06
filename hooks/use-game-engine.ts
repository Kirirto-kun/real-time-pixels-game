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
  const playerRef = useRef<Player | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)

  const initializePlayer = useCallback(async () => {
    // Make it async to await insert
    if (!playerName) {
      console.log("initializePlayer: No player name, skipping.")
      return
    }
    if (playerRef.current) {
      console.log("initializePlayer: Player already initialized.", playerRef.current.id)
      return
    }

    const newPlayerId = uuidv4()
    const newPlayer: Player = {
      id: newPlayerId,
      name: playerName,
      color: getRandomColor(),
      x: Math.floor(LOGICAL_WIDTH / 2),
      y: Math.floor(LOGICAL_HEIGHT / 2),
    }

    console.log("initializePlayer: Attempting to create player:", newPlayer)

    // Optimistically set local state
    // setCurrentPlayerId(newPlayerId); // Defer this until successful insert for now to test
    // playerRef.current = newPlayer;
    // setPlayers((prev) => ({ ...prev, [newPlayerId]: newPlayer }));

    const { data: insertedPlayer, error: insertError } = await supabase
      .from("players")
      .insert(newPlayer)
      .select() // Important: select the inserted data to confirm
      .single() // Expecting a single record back

    if (insertError || !insertedPlayer) {
      console.error("Error creating player:", insertError)
      // Handle failed insert - perhaps notify user or retry
      // For now, we won't set the player if insert fails
      return
    }

    console.log("initializePlayer: Player created successfully in DB:", insertedPlayer)
    setCurrentPlayerId(insertedPlayer.id)
    playerRef.current = insertedPlayer as Player
    setPlayers((prev) => ({ ...prev, [insertedPlayer.id]: insertedPlayer as Player }))
  }, [playerName])

  useEffect(() => {
    if (playerName && !currentPlayerId && !playerRef.current) {
      // Ensure it only runs once if player isn't set
      console.log("useEffect: PlayerName available, initializing player.")
      initializePlayer()
    }
  }, [playerName, currentPlayerId, initializePlayer])

  const updatePlayerPosition = useCallback(async (newX: number, newY: number) => {
    if (!playerRef.current || !playerRef.current.id) {
      console.warn("updatePlayerPosition: No current player or player ID to update.")
      return
    }

    const playerId = playerRef.current.id
    const oldPlayerState = { ...playerRef.current } // For potential revert

    // Optimistic update locally
    const updatedPlayerLocally = { ...playerRef.current, x: newX, y: newY }
    playerRef.current = updatedPlayerLocally
    setPlayers((prev) => ({ ...prev, [playerId]: updatedPlayerLocally }))

    console.log(`updatePlayerPosition: Attempting to update player ${playerId} to x:${newX}, y:${newY}`)
    const { error } = await supabase.from("players").update({ x: newX, y: newY }).match({ id: playerId })

    if (error) {
      console.error(`Error updating player ${playerId} position:`, {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      })
      // Revert optimistic update if server update fails
      playerRef.current = oldPlayerState
      setPlayers((prev) => ({ ...prev, [playerId]: oldPlayerState }))
      console.warn(`updatePlayerPosition: Reverted optimistic update for player ${playerId}`)
    } else {
      // console.log(`updatePlayerPosition: Successfully updated player ${playerId} in DB.`);
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
    console.log("useEffect (Subscription): Setting up DB listeners.")
    // Fetch initial players
    supabase
      .from("players")
      .select("*")
      .then(({ data, error }) => {
        if (error) {
          console.error("Error fetching initial players:", {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
          })
          return
        }
        if (data) {
          console.log("Fetched initial players:", data)
          const initialPlayers = data.reduce(
            (acc, p) => {
              acc[p.id] = p as Player
              return acc
            },
            {} as Record<string, Player>,
          )
          // Merge carefully, especially if initializePlayer is now async
          // and might not have set the current player yet.
          setPlayers((prev) => {
            const merged = { ...initialPlayers, ...prev } // Prioritize prev if current player was just added
            if (playerRef.current && !merged[playerRef.current.id]) {
              // Ensure current player is in if recently added
              merged[playerRef.current.id] = playerRef.current
            }
            return merged
          })
        }
      })

    const channel = supabase
      .channel("realtime-players")
      .on<Player>("postgres_changes", { event: "*", schema: "public", table: "players" }, (payload) => {
        console.log("Realtime event received:", payload)
        if (payload.new?.id && payload.new.id === playerRef.current?.id && payload.eventType === "UPDATE") {
          // This is an echo of our own update, already handled optimistically.
          // We might want to reconcile if server state differs significantly.
          // For now, we can choose to ignore or ensure our local state matches payload.new.
          // console.log("Realtime: Received echo of own update for player:", payload.new.id);
          // To ensure consistency, overwrite with server's version:
          // playerRef.current = payload.new as Player; // if we trust server more
          // setPlayers((prev) => ({ ...prev, [payload.new.id as string]: payload.new as Player }));
          return
        }

        if (payload.eventType === "INSERT") {
          console.log("Realtime: Player INSERTED:", payload.new)
          setPlayers((prev) => ({ ...prev, [payload.new.id as string]: payload.new as Player }))
        } else if (payload.eventType === "UPDATE") {
          console.log("Realtime: Player UPDATED:", payload.new)
          setPlayers((prev) => ({ ...prev, [payload.new.id as string]: payload.new as Player }))
        } else if (payload.eventType === "DELETE") {
          console.log("Realtime: Player DELETED:", payload.old)
          if (payload.old?.id) {
            setPlayers((prev) => {
              const newPlayers = { ...prev }
              delete newPlayers[payload.old.id as string]
              return newPlayers
            })
          }
        }
      })
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          console.log("Subscribed to players channel!")
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          console.error(
            `Channel error: ${status}`,
            err
              ? {
                  message: (err as any).message,
                  details: (err as any).details,
                  hint: (err as any).hint,
                  code: (err as any).code,
                }
              : "Unknown channel error",
          )
        }
      })
    channelRef.current = channel

    return () => {
      console.log("useEffect (Subscription): Cleaning up DB listeners.")
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
        console.log("Removed channel subscription.")
      }
    }
  }, []) // Removed playerRef from dependency array to avoid re-subscribing on playerRef changes.

  // useEffect for player disconnect (handleBeforeUnload and unmount)
  useEffect(() => {
    const localPlayerId = playerRef.current?.id // Capture for cleanup based on ref

    const handleBeforeUnload = async () => {
      if (playerRef.current?.id) {
        // Check ref directly
        console.log(`handleBeforeUnload: Attempting to delete player ${playerRef.current.id}`)
        // This is best-effort. Supabase client might not complete request.
        await supabase.from("players").delete().match({ id: playerRef.current.id })
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      const idToDeleteOnUnmount = playerRef.current?.id // Get ID from ref at time of unmount
      if (idToDeleteOnUnmount) {
        console.log(`Unmount: Attempting to delete player ${idToDeleteOnUnmount}`)
        supabase
          .from("players")
          .delete()
          .match({ id: idToDeleteOnUnmount })
          .then(({ error }) => {
            if (error) {
              console.error(`Error removing player ${idToDeleteOnUnmount} on unmount:`, {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code,
              })
            } else {
              console.log(`Player ${idToDeleteOnUnmount} removed on unmount call initiated.`)
            }
          })
      } else {
        console.log("Unmount: No current player ID to delete.")
      }
    }
  }, []) // Run once on mount/unmount. Relies on playerRef.current for the ID.

  return { players, currentPlayerId }
}
