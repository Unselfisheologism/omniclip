/**
 * AI Client - Direct Google Gemini API integration with BYOK pattern
 * This module handles direct API calls to Google's Gemini API
 * using the user's provided API key
 */

import type { AnyEffect, XTrack, State } from "../context/types.js"

export interface ChatMessage {
    id: string
    role: "user" | "assistant" | "system"
    content: string
    timestamp: number
}

export interface MediaBinItem {
    id: string
    name: string
    type: "video" | "audio" | "image" | "text"
    duration?: number
    thumbnail?: string
}

export interface TimelineState {
    tracks: XTrack[]
    effects: AnyEffect[]
    duration: number
}

export interface AIRequestPayload {
    message: string
    mentioned_media_ids: string[]
    timeline_state: TimelineState
    media_bin_items: MediaBinItem[]
    chat_history: ChatMessage[]
}

export interface FunctionCall {
    name: string
    arguments: Record<string, any>
}

export interface AIResponse {
    function_call?: FunctionCall
    assistant_message?: string
}

export interface AIMessage {
    role: "user" | "model"
    parts: Array<{ text?: string; functionCall?: { name: string; args: string } }>
}

// API Key management
const API_KEY_STORAGE_KEY = "omniclip_gemini_api_key"

export function getStoredApiKey(): string | null {
    return localStorage.getItem(API_KEY_STORAGE_KEY)
}

export function setStoredApiKey(key: string): void {
    localStorage.setItem(API_KEY_STORAGE_KEY, key)
}

export function removeStoredApiKey(): void {
    localStorage.removeItem(API_KEY_STORAGE_KEY)
}

export function hasApiKey(): boolean {
    return !!getStoredApiKey()
}

// API endpoint
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

// Function definitions for Gemini's function calling
export const functionDefinitions = [
    {
        name: "LLMAddScrubberToTimeline",
        description: "Add a media item to the timeline at a specific track and position",
        parameters: {
            type: "object",
            properties: {
                media_id: {
                    type: "string",
                    description: "The ID of the media item to add"
                },
                track_index: {
                    type: "number",
                    description: "The track number (0 for first track, 1 for second, etc.)"
                },
                position_seconds: {
                    type: "number",
                    description: "The position in seconds where the media should start"
                },
                duration_seconds: {
                    type: "number",
                    description: "Optional duration in seconds. If not provided, uses full media duration"
                }
            },
            required: ["media_id", "track_index", "position_seconds"]
        }
    },
    {
        name: "LLMAddScrubberByName",
        description: "Add a media item to the timeline by matching its name",
        parameters: {
            type: "object",
            properties: {
                media_name: {
                    type: "string",
                    description: "The name of the media item to add (fuzzy matching supported)"
                },
                track_index: {
                    type: "number",
                    description: "The track number (0 for first track, 1 for second, etc.)"
                },
                position_seconds: {
                    type: "number",
                    description: "The position in seconds where the media should start"
                }
            },
            required: ["media_name", "track_index", "position_seconds"]
        }
    },
    {
        name: "LLMMoveScrubber",
        description: "Move an existing media item on the timeline to a new position",
        parameters: {
            type: "object",
            properties: {
                effect_id: {
                    type: "string",
                    description: "The ID of the effect/scrubber to move"
                },
                new_track_index: {
                    type: "number",
                    description: "The new track number"
                },
                new_position_seconds: {
                    type: "number",
                    description: "The new position in seconds"
                }
            },
            required: ["effect_id", "new_track_index", "new_position_seconds"]
        }
    },
    {
        name: "LLMDeleteScrubbersInTrack",
        description: "Delete all media items from a specific track",
        parameters: {
            type: "object",
            properties: {
                track_index: {
                    type: "number",
                    description: "The track number to clear"
                }
            },
            required: ["track_index"]
        }
    }
]

// System prompt for the AI
export function buildSystemPrompt(
    timelineState: TimelineState,
    mediaBinItems: MediaBinItem[],
    chatHistory: ChatMessage[]
): string {
    const trackInfo = timelineState.tracks.map((track, index) =>
        `Track ${index}: ${track.id} (visible: ${track.visible}, locked: ${track.locked}, muted: ${track.muted})`
    ).join("\n")

    const mediaBinInfo = mediaBinItems.map(item =>
        `- ${item.name} (${item.type}): ID=${item.id}${item.duration ? `, duration=${item.duration}s` : ""}`
    ).join("\n")

    const historyInfo = chatHistory.slice(-5).map(msg =>
        `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`
    ).join("\n")

    return `You are Kimu, an AI assistant inside a video editor called Omniclip.

## Your Capabilities
You can help users edit their videos by manipulating the timeline. You can:
- Add media to specific tracks and positions
- Move existing media to new positions
- Delete media from tracks
- Answer questions about video editing

## Context

### Timeline Tracks:
${trackInfo}

### Media Bin:
${mediaBinInfo || "No media in bin"}

### Recent Chat History:
${historyInfo || "No previous messages"}

## Instructions

1. When the user asks to edit the video (add, move, delete media), you MUST call one of the available functions.
2. When the user asks a question or wants to chat, respond with a friendly message (no function call needed).
3. Track indices are 0-based: track 0 is the first track, track 1 is the second, etc.
4. Use pixels_per_second=100 by default for positioning.
5. When adding media by name, use fuzzy matching to find the closest media item.
6. When moving media, use the effect ID from the timeline state.
7. Always confirm what you're about to do before executing changes.

## Response Format
Return a JSON object with either:
- "function_call": { "name": "functionName", "arguments": {...} } for editing actions
- "assistant_message": "Your friendly response here" for questions or chat`
}

export async function sendToAI(
    message: string,
    mentionedMediaIds: string[],
    timelineState: TimelineState,
    mediaBinItems: MediaBinItem[],
    chatHistory: ChatMessage[]
): Promise<AIResponse> {
    const apiKey = getStoredApiKey()

    if (!apiKey) {
        return {
            assistant_message: "Please provide your Google Gemini API key to use the AI assistant. You can add it in the AI settings."
        }
    }

    const systemPrompt = buildSystemPrompt(timelineState, mediaBinItems, chatHistory)

    // Build conversation history
    const contents: AIMessage[] = [
        {
            role: "model",
            parts: [{ text: systemPrompt }]
        }
    ]

    // Add chat history
    for (const msg of chatHistory.slice(-10)) {
        contents.push({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }]
        })
    }

    // Add current message
    contents.push({
        role: "user",
        parts: [{ text: message }]
    })

    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                contents,
                generationConfig: {
                    responseMimeType: "application/json",
                    tools: [{
                        functionDeclarations: functionDefinitions
                    }]
                }
            })
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`API error: ${response.status} - ${errorText}`)
        }

        const data = await response.json()

        // Parse the response
        if (data.candidates?.[0]?.content?.parts?.[0]?.functionCall) {
            const fc = data.candidates[0].content.parts[0].functionCall
            return {
                function_call: {
                    name: fc.name,
                    arguments: JSON.parse(fc.args)
                }
            }
        } else if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
            return {
                assistant_message: data.candidates[0].content.parts[0].text
            }
        }

        return {
            assistant_message: "I didn't understand that. Could you try again?"
        }
    } catch (error) {
        console.error("AI API Error:", error)
        return {
            assistant_message: `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}`
        }
    }
}

// Validate API key by making a test request
export async function validateApiKey(apiKey: string): Promise<boolean> {
    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
            { method: "GET" }
        )
        return response.ok
    } catch {
        return false
    }
}
