/**
 * LLM Timeline Handlers - Functions called by AI to manipulate the timeline
 * These handlers bridge the AI function calls with Omniclip's state management
 */

import type { AnyEffect, VideoEffect, ImageEffect, AudioEffect, TextEffect } from "../context/types.js"
import { generate_id } from "@benev/slate"

export interface TimelineHandlers {
    addEffectToTimeline: (effect: AnyEffect) => void
    updateEffect: (id: string, updates: Partial<AnyEffect>) => void
    removeEffect: (id: string) => void
    removeEffectsInTrack: (trackIndex: number) => void
    getMediaById: (id: string) => MediaItem | null
    getMediaByName: (name: string) => MediaItem | null
}

export interface MediaItem {
    id: string
    name: string
    type: "video" | "audio" | "image" | "text"
    duration: number
    file?: File
    thumbnail?: string
}

export interface HandlerResult {
    success: boolean
    message: string
}

/**
 * Add media to timeline by ID
 */
export function llmAddScrubberToTimeline(
    handlers: TimelineHandlers,
    mediaId: string,
    trackIndex: number,
    positionSeconds: number,
    durationSeconds?: number
): HandlerResult {
    const media = handlers.getMediaById(mediaId)

    if (!media) {
        return {
            success: false,
            message: `Media with ID ${mediaId} not found in media bin`
        }
    }

    // Create effect based on media type
    const effect = createEffectFromMedia(media, trackIndex, positionSeconds, durationSeconds)

    try {
        handlers.addEffectToTimeline(effect)
        return {
            success: true,
            message: `Added "${media.name}" to track ${trackIndex + 1} at ${positionSeconds}s`
        }
    } catch (error) {
        return {
            success: false,
            message: `Failed to add media: ${error instanceof Error ? error.message : "Unknown error"}`
        }
    }
}

/**
 * Add media to timeline by name (fuzzy matching)
 */
export function llmAddScrubberByName(
    handlers: TimelineHandlers,
    mediaName: string,
    trackIndex: number,
    positionSeconds: number
): HandlerResult {
    const media = handlers.getMediaByName(mediaName)

    if (!media) {
        return {
            success: false,
            message: `Media named "${mediaName}" not found in media bin`
        }
    }

    return llmAddScrubberToTimeline(handlers, media.id, trackIndex, positionSeconds)
}

/**
 * Move existing scrubber to new position
 */
export function llmMoveScrubber(
    handlers: TimelineHandlers,
    effectId: string,
    newTrackIndex: number,
    newPositionSeconds: number
): HandlerResult {
    try {
        handlers.updateEffect(effectId, {
            track: newTrackIndex,
            start_at_position: newPositionSeconds * 100 // Convert to pixels (assuming 100px/s)
        })
        return {
            success: true,
            message: `Moved clip to track ${newTrackIndex + 1} at ${newPositionSeconds}s`
        }
    } catch (error) {
        return {
            success: false,
            message: `Failed to move clip: ${error instanceof Error ? error.message : "Unknown error"}`
        }
    }
}

/**
 * Delete all scrubbers in a track
 */
export function llmDeleteScrubbersInTrack(
    handlers: TimelineHandlers,
    trackIndex: number
): HandlerResult {
    try {
        handlers.removeEffectsInTrack(trackIndex)
        return {
            success: true,
            message: `Removed all clips from track ${trackIndex + 1}`
        }
    } catch (error) {
        return {
            success: false,
            message: `Failed to delete clips: ${error instanceof Error ? error.message : "Unknown error"}`
        }
    }
}

/**
 * Execute a function call from the AI
 */
export function executeFunctionCall(
    handlers: TimelineHandlers,
    functionName: string,
    args: Record<string, any>
): HandlerResult {
    switch (functionName) {
        case "LLMAddScrubberToTimeline":
            return llmAddScrubberToTimeline(
                handlers,
                args.media_id,
                args.track_index,
                args.position_seconds,
                args.duration_seconds
            )

        case "LLMAddScrubberByName":
            return llmAddScrubberByName(
                handlers,
                args.media_name,
                args.track_index,
                args.position_seconds
            )

        case "LLMMoveScrubber":
            return llmMoveScrubber(
                handlers,
                args.effect_id,
                args.new_track_index,
                args.new_position_seconds
            )

        case "LLMDeleteScrubbersInTrack":
            return llmDeleteScrubbersInTrack(
                handlers,
                args.track_index
            )

        default:
            return {
                success: false,
                message: `Unknown function: ${functionName}`
            }
    }
}

// Helper function to create effect from media item
function createEffectFromMedia(
    media: MediaItem,
    trackIndex: number,
    positionSeconds: number,
    durationSeconds?: number
): AnyEffect {
    const duration = (durationSeconds || media.duration) * 1000 // Convert to ms
    const startPosition = positionSeconds * 100 // Convert to pixels (100px/s)

    const baseEffect = {
        id: generate_id(),
        start_at_position: startPosition,
        duration,
        start: 0,
        end: media.duration * 1000,
        track: trackIndex
    }

    switch (media.type) {
        case "video":
            return {
                ...baseEffect,
                kind: "video" as const,
                thumbnail: media.thumbnail || "",
                raw_duration: media.duration * 1000,
                frames: Math.floor(media.duration * 30), // Assuming 30fps
                rect: {
                    width: 1920,
                    height: 1080,
                    scaleX: 1,
                    scaleY: 1,
                    position_on_canvas: { x: 0, y: 0 },
                    rotation: 0,
                    pivot: { x: 0, y: 0 }
                },
                file_hash: media.id,
                name: media.name
            } as VideoEffect

        case "image":
            return {
                ...baseEffect,
                kind: "image" as const,
                rect: {
                    width: 1920,
                    height: 1080,
                    scaleX: 1,
                    scaleY: 1,
                    position_on_canvas: { x: 0, y: 0 },
                    rotation: 0,
                    pivot: { x: 0, y: 0 }
                },
                file_hash: media.id,
                name: media.name
            } as ImageEffect

        case "audio":
            return {
                ...baseEffect,
                kind: "audio" as const,
                raw_duration: media.duration * 1000,
                file_hash: media.id,
                name: media.name
            } as AudioEffect

        case "text":
            return {
                ...baseEffect,
                kind: "text" as const,
                fontFamily: "Poppins",
                text: media.name,
                fontSize: 48,
                fontStyle: "normal" as const,
                align: "center" as const,
                fontVariant: "normal" as const,
                fontWeight: "normal" as const,
                fill: ["#ffffff"],
                fillGradientType: 0,
                fillGradientStops: [],
                rect: {
                    width: 1920,
                    height: 1080,
                    scaleX: 1,
                    scaleY: 1,
                    position_on_canvas: { x: 960, y: 540 },
                    rotation: 0,
                    pivot: { x: 0, y: 0 }
                },
                stroke: null,
                strokeThickness: 0,
                lineJoin: "round" as const,
                miterLimit: 10,
                letterSpacing: 0,
                dropShadow: false,
                dropShadowAlpha: 0,
                dropShadowAngle: 0,
                dropShadowBlur: 0,
                dropShadowDistance: 0,
                dropShadowColor: "#000000",
                wordWrap: true,
                wordWrapWidth: 1800,
                lineHeight: 56,
                leading: 0,
                breakWords: false,
                whiteSpace: "normal" as const,
                textBaseline: "middle" as const
            } as TextEffect

        default:
            throw new Error(`Unknown media type: ${media.type}`)
    }
}
