import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export const getRandomColor = (): string => {
  const letters = "0123456789ABCDEF"
  let color = "#"
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)]
  }
  return color
}

// Game constants
export const VISUAL_WIDTH = 800
export const VISUAL_HEIGHT = 600
export const PIXEL_SCALE = 4 // Each logical pixel is 4x4 visual pixels
export const LOGICAL_WIDTH = VISUAL_WIDTH / PIXEL_SCALE
export const LOGICAL_HEIGHT = VISUAL_HEIGHT / PIXEL_SCALE
export const PLAYER_SIZE = 1 // Logical size
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
