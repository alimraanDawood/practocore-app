/**
 * Chat Service
 *
 * Handles chat message operations and real-time subscriptions for matter-specific chat.
 */

import {pb as pocketbase} from '~/lib/pocketbase'
import type {RecordSubscription} from 'pocketbase'

export interface ChatMessage {
    id: string
    matter: string
    sender: string
    message: string
    attachments?: string[]
    replyTo?: string
    readBy?: string[]
    created: string
    updated: string
    type: string
    expand?: {
        sender?: {
            id: string
            name: string
            email: string
            avatar?: string
        }
        replyTo?: ChatMessage
    }
}

export interface ChatMessageCreate {
    matter: string
    sender: string
    message: string
    type: string
    attachments?: File[]
    replyTo?: string
}

// Store active subscriptions
const activeSubscriptions = new Map<string, () => void>()

/**
 * Get chat messages for a matter
 */
export async function getChatMessages(
    matterId: string,
    page: number = 1,
    perPage: number = 50
): Promise<{ items: ChatMessage[]; totalItems: number; totalPages: number }> {
    try {
        const result = await pocketbase.collection('ChatMessages').getList<ChatMessage>(page, perPage, {
            filter: `matter = "${matterId}"`,
            sort: 'created',
            expand: 'sender,replyTo'
        })

        return {
            items: result.items,
            totalItems: result.totalItems,
            totalPages: result.totalPages
        }
    } catch (error) {
        console.error('Failed to fetch chat messages:', error)
        throw error
    }
}

/**
 * Send a chat message
 */
export async function sendChatMessage(data: any): Promise<ChatMessage> {
    try {
        const formData = new FormData()
        formData.append('matter', data.matter)
        formData.append('sender', data.sender)
        formData.append('message', data.message)
        formData.append('type', 'text')

        if (data.replyTo) {
            formData.append('replyTo', data.replyTo)
        }

        if (data.attachments && data.attachments.length > 0) {
            data.attachments.forEach((file) => {
                formData.append('attachments', file)
            })
        }

        const message = await pocketbase.collection('ChatMessages').create<ChatMessage>(formData, {
            expand: 'sender,replyTo'
        })

        return message
    } catch (error) {
        console.error('Failed to send chat message:', error)
        throw error
    }
}

/**
 * Update a chat message (edit)
 */
export async function updateChatMessage(
    messageId: string,
    message: string
): Promise<ChatMessage> {
    try {
        const updated = await pocketbase.collection('ChatMessages').update<ChatMessage>(
            messageId,
            {message},
            {expand: 'sender,replyTo'}
        )

        return updated
    } catch (error) {
        console.error('Failed to update chat message:', error)
        throw error
    }
}

/**
 * Delete a chat message
 */
export async function deleteChatMessage(messageId: string): Promise<void> {
    try {
        await pocketbase.collection('ChatMessages').delete(messageId)
    } catch (error) {
        console.error('Failed to delete chat message:', error)
        throw error
    }
}

/**
 * Mark message as read
 */
export async function markMessageAsRead(messageId: string, userId: string): Promise<void> {
    try {
        // Get current message
        const message = await pocketbase.collection('ChatMessages').getOne<ChatMessage>(messageId)
        const readBy = message.readBy || []

        // Add user to readBy if not already there
        if (!readBy.includes(userId)) {
            readBy.push(userId)
            await pocketbase.collection('ChatMessages').update(messageId, {
                readBy
            })
        }
    } catch (error) {
        console.error('Failed to mark message as read:', error)
        throw error
    }
}

/**
 * Mark all messages in a matter as read for a user
 */
export async function markAllMessagesAsRead(matterId: string, userId: string): Promise<void> {
    try {
        // Get all unread messages for this user in this matter
        const messages = await pocketbase.collection('ChatMessages').getFullList<ChatMessage>({
            filter: `matter = "${matterId}" && sender != "${userId}" && readBy !~ "${userId}"`,
            fields: 'id,readBy'
        })

        // Mark each as read
        const promises = messages.map(async (message) => {
            const readBy = message.readBy || []
            if (!readBy.includes(userId)) {
                readBy.push(userId)
                return pocketbase.collection('ChatMessages').update(message.id, {readBy})
            }
        })

        await Promise.all(promises)
    } catch (error) {
        console.error('Failed to mark all messages as read:', error)
        // Don't throw - this is a background operation
    }
}

/**
 * Subscribe to chat messages for a matter
 */
export async function subscribeToChatMessages(
    matterId: string,
    callback: (data: RecordSubscription<ChatMessage>) => void
): Promise<() => void> {
    try {
        // Unsubscribe existing subscription for this matter if any
        const existingUnsubscribe = activeSubscriptions.get(matterId)
        if (existingUnsubscribe) {
            existingUnsubscribe()
        }

        // Subscribe to all ChatMessages and filter by matter in callback
        const unsubscribe = await pocketbase.collection('ChatMessages').subscribe<ChatMessage>(
            '*',
            (data) => {
                // Only trigger callback for messages in this matter
                if (data.record.matter === matterId) {
                    callback(data)
                }
            },
            {expand: 'sender,replyTo'}
        )

        // Store unsubscribe function
        activeSubscriptions.set(matterId, unsubscribe)

        return () => {
            unsubscribe()
            activeSubscriptions.delete(matterId)
        }
    } catch (error) {
        console.error('Failed to subscribe to chat messages:', error)
        throw error
    }
}

/**
 * Unsubscribe from chat messages for a matter
 */
export function unsubscribeFromChatMessages(matterId: string): void {
    const unsubscribe = activeSubscriptions.get(matterId)
    if (unsubscribe) {
        unsubscribe()
        activeSubscriptions.delete(matterId)
    }
}

/**
 * Unsubscribe from all chat subscriptions
 */
export function unsubscribeFromAllChatMessages(): void {
    activeSubscriptions.forEach((unsubscribe) => {
        unsubscribe()
    })
    activeSubscriptions.clear()
}

/**
 * Get the number of unread messages in a matter for a user
 */
export async function getUnreadCount(matterId: string, userId: string): Promise<number> {
    try {
        const result = await pocketbase.collection('ChatMessages').getList(1, 1, {
            filter: `matter = "${matterId}" && sender != "${userId}" && readBy !~ "${userId}"`,
            $cancelKey: `unread_count_${matterId}`
        })

        return result.totalItems
    } catch (error) {
        console.error('Failed to get unread count:', error)
        return 0
    }
}
