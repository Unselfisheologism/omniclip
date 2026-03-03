/**
 * AI Chat Component - Kimu-style AI Assistant for Omniclip
 * Provides a chat interface with media mention support and AI function calling
 */

import { LitElement, html, css } from "lit"
import { customElement, property, state } from "lit/decorators.js"

import {
    ChatMessage,
    MediaBinItem,
    TimelineState,
    sendToAI,
    getStoredApiKey,
    setStoredApiKey,
    hasApiKey,
    validateApiKey,
} from "../../utils/ai-client.js"

import {
    TimelineHandlers,
    executeFunctionCall,
} from "../../utils/llm-handlers.js"

// @ts-ignore - TypeScript doesn't recognize this export at build time
import { generate_id } from "@benev/slate/x/tools/generate_id.js"

// Icons
const sendIcon = html`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`
const closeIcon = html`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`
const settingsIcon = html`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`
const userIcon = html`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`
const botIcon = html`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8" y2="16"></line><line x1="16" y1="16" x2="16" y2="16"></line></svg>`

@customElement("omni-ai-chat")
export class OmniAIChat extends LitElement {
    static styles = css`
		:host {
			display: block;
			font-family: 'Poppins', sans-serif;
		}

		.chat-container {
			position: fixed;
			bottom: 20px;
			right: 20px;
			width: 380px;
			height: 520px;
			background: #1a1a2e;
			border-radius: 16px;
			box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
			display: flex;
			flex-direction: column;
			overflow: hidden;
			z-index: 1000;
		}

		.chat-container.collapsed {
			height: 60px;
		}

		.chat-header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 12px 16px;
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
			color: white;
		}

		.chat-header h3 {
			margin: 0;
			font-size: 16px;
			font-weight: 600;
			display: flex;
			align-items: center;
			gap: 8px;
		}

		.chat-header-actions {
			display: flex;
			gap: 8px;
		}

		.chat-header button {
			background: rgba(255, 255, 255, 0.2);
			border: none;
			border-radius: 8px;
			padding: 8px;
			cursor: pointer;
			color: white;
			display: flex;
			align-items: center;
			justify-content: center;
			transition: background 0.2s;
		}

		.chat-header button:hover {
			background: rgba(255, 255, 255, 0.3);
		}

		.messages-container {
			flex: 1;
			overflow-y: auto;
			padding: 16px;
			display: flex;
			flex-direction: column;
			gap: 12px;
		}

		.message {
			display: flex;
			gap: 10px;
			max-width: 90%;
			animation: fadeIn 0.3s ease;
		}

		@keyframes fadeIn {
			from { opacity: 0; transform: translateY(10px); }
			to { opacity: 1; transform: translateY(0); }
		}

		.message.user {
			flex-direction: row-reverse;
			align-self: flex-end;
		}

		.message.assistant {
			align-self: flex-start;
		}

		.message-icon {
			width: 32px;
			height: 32px;
			border-radius: 50%;
			display: flex;
			align-items: center;
			justify-content: center;
			flex-shrink: 0;
		}

		.message.user .message-icon {
			background: #667eea;
		}

		.message.assistant .message-icon {
			background: #764ba2;
		}

		.message-content {
			background: rgba(255, 255, 255, 0.1);
			padding: 10px 14px;
			border-radius: 12px;
			font-size: 14px;
			line-height: 1.5;
			color: #fff;
		}

		.message.user .message-content {
			background: #667eea;
		}

		.input-container {
			padding: 12px 16px;
			background: #16162a;
			border-top: 1px solid rgba(255, 255, 255, 0.1);
		}

		.input-wrapper {
			display: flex;
			gap: 8px;
			align-items: flex-end;
			background: rgba(255, 255, 255, 0.05);
			border-radius: 12px;
			padding: 8px 12px;
		}

		.input-wrapper textarea {
			flex: 1;
			background: transparent;
			border: none;
			outline: none;
			color: #fff;
			font-family: inherit;
			font-size: 14px;
			resize: none;
			max-height: 100px;
			min-height: 24px;
			line-height: 1.5;
		}

		.input-wrapper textarea::placeholder {
			color: rgba(255, 255, 255, 0.5);
		}

		.input-wrapper button {
			background: #667eea;
			border: none;
			border-radius: 8px;
			padding: 8px;
			cursor: pointer;
			color: white;
			display: flex;
			align-items: center;
			justify-content: center;
			transition: background 0.2s;
		}

		.input-wrapper button:hover:not(:disabled) {
			background: #764ba2;
		}

		.input-wrapper button:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}

		.typing-indicator {
			display: flex;
			gap: 4px;
			padding: 10px 14px;
			background: rgba(255, 255, 255, 0.1);
			border-radius: 12px;
			width: fit-content;
		}

		.typing-indicator span {
			width: 8px;
			height: 8px;
			background: rgba(255, 255, 255, 0.6);
			border-radius: 50%;
			animation: bounce 1.4s infinite ease-in-out;
		}

		.typing-indicator span:nth-child(1) { animation-delay: 0s; }
		.typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
		.typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

		@keyframes bounce {
			0%, 80%, 100% { transform: scale(0.6); }
			40% { transform: scale(1); }
		}

		.mention-dropdown {
			position: absolute;
			bottom: 100%;
			left: 16px;
			right: 16px;
			background: #252542;
			border-radius: 8px;
			max-height: 200px;
			overflow-y: auto;
			box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.3);
			margin-bottom: 8px;
		}

		.mention-item {
			display: flex;
			align-items: center;
			gap: 10px;
			padding: 10px 14px;
			cursor: pointer;
			transition: background 0.2s;
		}

		.mention-item:hover,
		.mention-item.selected {
			background: rgba(102, 126, 234, 0.3);
		}

		.mention-item-icon {
			width: 24px;
			height: 24px;
			border-radius: 4px;
			background: rgba(255, 255, 255, 0.1);
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: 12px;
		}

		.mention-item-info {
			flex: 1;
		}

		.mention-item-name {
			color: #fff;
			font-size: 14px;
		}

		.mention-item-type {
			color: rgba(255, 255, 255, 0.5);
			font-size: 12px;
		}

		.settings-modal {
			position: absolute;
			inset: 0;
			background: rgba(0, 0, 0, 0.7);
			display: flex;
			align-items: center;
			justify-content: center;
			z-index: 10;
		}

		.settings-content {
			background: #1a1a2e;
			padding: 24px;
			border-radius: 16px;
			width: 90%;
			max-width: 320px;
		}

		.settings-content h4 {
			margin: 0 0 16px;
			color: #fff;
			font-size: 18px;
		}

		.settings-content label {
			display: block;
			color: rgba(255, 255, 255, 0.7);
			font-size: 14px;
			margin-bottom: 8px;
		}

		.settings-content input {
			width: 100%;
			padding: 10px 14px;
			background: rgba(255, 255, 255, 0.1);
			border: 1px solid rgba(255, 255, 255, 0.2);
			border-radius: 8px;
			color: #fff;
			font-size: 14px;
			outline: none;
			box-sizing: border-box;
		}

		.settings-content input:focus {
			border-color: #667eea;
		}

		.settings-content .hint {
			color: rgba(255, 255, 255, 0.5);
			font-size: 12px;
			margin-top: 8px;
		}

		.settings-actions {
			display: flex;
			gap: 12px;
			margin-top: 20px;
		}

		.settings-actions button {
			flex: 1;
			padding: 10px;
			border: none;
			border-radius: 8px;
			font-size: 14px;
			cursor: pointer;
			transition: background 0.2s;
		}

		.settings-actions .cancel {
			background: rgba(255, 255, 255, 0.1);
			color: rgba(255, 255, 255, 0.7);
		}

		.settings-actions .save {
			background: #667eea;
			color: white;
		}

		.settings-actions button:hover {
			opacity: 0.9;
		}

		.api-key-status {
			display: flex;
			align-items: center;
			gap: 8px;
			margin-top: 12px;
			font-size: 12px;
		}

		.api-key-status.valid {
			color: #4ade80;
		}

		.api-key-status.invalid {
			color: #f87171;
		}
	`

    @property({ type: Boolean })
    collapsed = false

    @property({ type: Array })
    mediaBinItems: MediaBinItem[] = []

    @property({ attribute: false })
    timelineHandlers: TimelineHandlers | null = null

    @state()
    private messages: ChatMessage[] = []

    @state()
    private inputValue = ""

    @state()
    private isTyping = false

    @state()
    private showSettings = false

    @state()
    private apiKeyInput = ""

    @state()
    private hasValidApiKey = false

    @state()
    private mentionQuery = ""

    @state()
    private showMentionDropdown = false

    @state()
    private mentionFilterIndex = 0

    @property({ attribute: false })
    getTimelineState: () => TimelineState = () => ({ tracks: [], effects: [], duration: 0 })

    connectedCallback() {
        super.connectedCallback()
        this.hasValidApiKey = hasApiKey()
    }

    private get filteredMediaItems() {
        if (!this.mentionQuery) return this.mediaBinItems
        const query = this.mentionQuery.toLowerCase()
        return this.mediaBinItems.filter(item =>
            item.name.toLowerCase().includes(query)
        )
    }

    private handleInputChange(e: Event) {
        const textarea = e.target as HTMLTextAreaElement
        this.inputValue = textarea.value

        // Check for @ mention
        const cursorPos = textarea.selectionStart
        const textBeforeCursor = this.inputValue.slice(0, cursorPos)
        const atIndex = textBeforeCursor.lastIndexOf("@")

        if (atIndex !== -1) {
            const query = textBeforeCursor.slice(atIndex + 1)
            if (!query.includes(" ")) {
                this.mentionQuery = query
                this.showMentionDropdown = true
                this.mentionFilterIndex = 0
                return
            }
        }

        this.showMentionDropdown = false
        this.mentionQuery = ""
    }

    private handleMentionSelect(item: MediaBinItem) {
        const textarea = this.shadowRoot?.querySelector("textarea") as HTMLTextAreaElement
        const cursorPos = textarea?.selectionStart || 0
        const textBeforeCursor = this.inputValue.slice(0, cursorPos)
        const atIndex = textBeforeCursor.lastIndexOf("@")

        if (atIndex !== -1) {
            this.inputValue = this.inputValue.slice(0, atIndex) + `@${item.name} `
        }

        this.showMentionDropdown = false
        this.mentionQuery = ""
    }

    private handleKeyDown(e: KeyboardEvent) {
        if (this.showMentionDropdown) {
            const items = this.filteredMediaItems

            if (e.key === "ArrowDown") {
                e.preventDefault()
                this.mentionFilterIndex = Math.min(this.mentionFilterIndex + 1, items.length - 1)
            } else if (e.key === "ArrowUp") {
                e.preventDefault()
                this.mentionFilterIndex = Math.max(this.mentionFilterIndex - 1, 0)
            } else if (e.key === "Enter" && items.length > 0) {
                e.preventDefault()
                this.handleMentionSelect(items[this.mentionFilterIndex])
            } else if (e.key === "Escape") {
                this.showMentionDropdown = false
            }
            return
        }

        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            this.handleSend()
        }
    }

    private adjustTextareaHeight(e: Event) {
        const textarea = e.target as HTMLTextAreaElement
        textarea.style.height = "auto"
        textarea.style.height = Math.min(textarea.scrollHeight, 100) + "px"
    }

    private getMentionedMediaIds(): string[] {
        const mentionedIds: string[] = []
        const mentionRegex = /@(\w+)/g
        let match

        while ((match = mentionRegex.exec(this.inputValue)) !== null) {
            const mediaName = match[1]
            const mediaItem = this.mediaBinItems.find(item =>
                item.name.toLowerCase().includes(mediaName.toLowerCase())
            )
            if (mediaItem) {
                mentionedIds.push(mediaItem.id)
            }
        }

        return mentionedIds
    }

    private async handleSend() {
        if (!this.inputValue.trim()) return

        const userMessage: ChatMessage = {
            id: generate_id(),
            role: "user",
            content: this.inputValue,
            timestamp: Date.now()
        }

        this.messages = [...this.messages, userMessage]
        this.inputValue = ""
        this.isTyping = true

        try {
            const timelineState = this.getTimelineState()
            const mentionedMediaIds = this.getMentionedMediaIds()

            const response = await sendToAI(
                userMessage.content,
                mentionedMediaIds,
                timelineState,
                this.mediaBinItems,
                this.messages
            )

            // Add user message to history for next call
            this.messages = [...this.messages, userMessage]

            if (response.function_call && this.timelineHandlers) {
                // Execute the function call
                const result = executeFunctionCall(
                    this.timelineHandlers,
                    response.function_call.name,
                    response.function_call.arguments
                )

                // Add assistant confirmation message
                const assistantMessage: ChatMessage = {
                    id: generate_id(),
                    role: "assistant",
                    content: result.message,
                    timestamp: Date.now()
                }
                this.messages = [...this.messages, assistantMessage]
            } else if (response.assistant_message) {
                const assistantMessage: ChatMessage = {
                    id: generate_id(),
                    role: "assistant",
                    content: response.assistant_message,
                    timestamp: Date.now()
                }
                this.messages = [...this.messages, assistantMessage]
            }
        } catch (error) {
            const errorMessage: ChatMessage = {
                id: generate_id(),
                role: "assistant",
                content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}`,
                timestamp: Date.now()
            }
            this.messages = [...this.messages, errorMessage]
        } finally {
            this.isTyping = false
        }
    }

    private toggleChat() {
        this.collapsed = !this.collapsed
    }

    private openSettings() {
        this.apiKeyInput = getStoredApiKey() || ""
        this.showSettings = true
    }

    private closeSettings() {
        this.showSettings = false
    }

    private async saveSettings() {
        if (this.apiKeyInput.trim()) {
            const isValid = await validateApiKey(this.apiKeyInput.trim())
            if (isValid) {
                setStoredApiKey(this.apiKeyInput.trim())
                this.hasValidApiKey = true
            } else {
                alert("Invalid API key. Please check and try again.")
                return
            }
        }
        this.closeSettings()
    }

    private clearChat() {
        this.messages = []
    }

    render() {
        return html`
			<div class="chat-container ${this.collapsed ? "collapsed" : ""}">
				${!this.collapsed ? html`
					<div class="chat-header">
						<h3>${botIcon} Kimu AI</h3>
						<div class="chat-header-actions">
							<button @click=${this.clearChat} title="New Chat">🗑️</button>
							<button @click=${this.openSettings} title="Settings">${settingsIcon}</button>
							<button @click=${this.toggleChat} title="Minimize">${closeIcon}</button>
						</div>
					</div>

					<div class="messages-container">
						${this.messages.length === 0 ? html`
							<div class="message assistant">
								<div class="message-icon">${botIcon}</div>
								<div class="message-content">
									Hi! I'm Kimu, your AI video editing assistant. 
									You can ask me to:
									<br><br>
									• "Add intro video to track 1 at 2 seconds"
									<br>
									• "Move the clip to track 2 at 5 seconds"
									<br>
									• "Remove all clips from track 3"
									<br><br>
									Use <strong>@media-name</strong> to mention specific media!
								</div>
							</div>
						` : this.messages.map(msg => html`
							<div class="message ${msg.role}">
								<div class="message-icon">
									${msg.role === "user" ? userIcon : botIcon}
								</div>
								<div class="message-content">${msg.content}</div>
							</div>
						`)}

						${this.isTyping ? html`
							<div class="message assistant">
								<div class="message-icon">${botIcon}</div>
								<div class="typing-indicator">
									<span></span>
									<span></span>
									<span></span>
								</div>
							</div>
						` : ""}
					</div>

					<div class="input-container" style="position: relative;">
						${this.showMentionDropdown && this.filteredMediaItems.length > 0 ? html`
							<div class="mention-dropdown">
								${this.filteredMediaItems.map((item, index) => html`
									<div 
										class="mention-item ${index === this.mentionFilterIndex ? "selected" : ""}"
										@click=${() => this.handleMentionSelect(item)}
									>
										<div class="mention-item-icon">
											${item.type === "video" ? "🎬" : item.type === "audio" ? "🎵" : item.type === "image" ? "🖼️" : "📝"}
										</div>
										<div class="mention-item-info">
											<div class="mention-item-name">${item.name}</div>
											<div class="mention-item-type">${item.type}</div>
										</div>
									</div>
								`)}
							</div>
						` : ""}

						<div class="input-wrapper">
							<textarea
								placeholder="${this.hasValidApiKey ? "Type a message... (Use @ for media)" : "Please add API key in settings"}"
								.value=${this.inputValue}
								@input=${this.handleInputChange}
								@keydown=${this.handleKeyDown}
								@input=${this.adjustTextareaHeight}
								?disabled=${!this.hasValidApiKey}
							></textarea>
							<button 
								@click=${this.handleSend} 
								?disabled=${!this.hasValidApiKey || !this.inputValue.trim() || this.isTyping}
							>
								${sendIcon}
							</button>
						</div>
					</div>
				` : html`
					<div class="chat-header" @click=${this.toggleChat}>
						<h3>${botIcon} Kimu AI</h3>
						<button>${settingsIcon}</button>
					</div>
				`}

				${this.showSettings ? html`
					<div class="settings-modal" @click=${(e: Event) => e.target === e.currentTarget && this.closeSettings()}>
						<div class="settings-content">
							<h4>⚙️ API Settings</h4>
							<label>Google Gemini API Key</label>
							<input 
								type="password" 
								placeholder="Enter your API key"
								.value=${this.apiKeyInput}
								@input=${(e: Event) => this.apiKeyInput = (e.target as HTMLInputElement).value}
							>
							<p class="hint">
								Get your API key from <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color: #667eea;">Google AI Studio</a>
							</p>
							<div class="api-key-status ${this.hasValidApiKey ? "valid" : "invalid"}">
								${this.hasValidApiKey ? "✓ API key configured" : "✗ No API key"}
							</div>
							<div class="settings-actions">
								<button class="cancel" @click=${this.closeSettings}>Cancel</button>
								<button class="save" @click=${this.saveSettings}>Save</button>
							</div>
						</div>
					</div>
				` : ""}
			</div>
		`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "omni-ai-chat": OmniAIChat
    }
}
