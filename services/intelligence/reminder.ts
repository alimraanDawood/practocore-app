/**
 * Reminder Generator Module
 * Interacts with Ollama API to generate reminder messages
 */

export class ReminderGenerator {
    constructor(config = {} as { apiUrl?: string, model?: string }) {
        this.apiUrl = config.apiUrl || 'https://api.fiika.dev';
        this.model = config.model || 'qwen2.5:0.5b';
    }

    /**
     * Generate system prompt for the LLM
     */
    getSystemPrompt() {
        return `You are a legal deadline reminder generator. Generate reminder messages for legal deadlines.

INSTRUCTIONS:
1. Generate a "title" field (short, max 10 words)
2. Generate a "body" field (plain text, conversational but professional)
3. Generate a "bodyHTML" field (same as body but with <strong> tags for emphasis)

RULES:
- Use "Hi <<first_name>>" at the start
- Include days remaining and deadline date as "<<deadline_date>>"
- For offset -10 to -6 days: Use "moderate" tone, say "you have X days remaining" and "Please begin preparation" or "Please ensure timely [action]"
- For offset -5 to -2 days: Use "URGENT:" prefix if priority is urgent, say "you have only X days remaining" and add "Take action now" or "Immediate action required"
- For offset -1 day: Use "URGENT:" prefix, say "tomorrow is the deadline" and add "Please act immediately"
- For offset 0 (same day): Use "CRITICAL:" prefix, say "today is the deadline" and add "Please complete this immediately"
- Extract the main action from the deadline name
- Keep messages concise and actionable

OUTPUT FORMAT (JSON only):
{
  "title": "string",
  "body": "string",
  "bodyHTML": "string"
}`;
    }

    /**
     * Generate a full prompt for a specific deadline reminder
     */
    generatePrompt(deadlineInfo) {
        const { name, description, offsetDays, priority } = deadlineInfo;

        return `${this.getSystemPrompt()}

INPUTS:
- Deadline name: ${name}
- Deadline description: ${description}
- Days before deadline: ${offsetDays}
- Priority level: ${priority}

Generate the reminder message in JSON format only. No additional text.`;
    }

    /**
     * Generate a single reminder
     */
    async generateReminder(deadlineInfo) {
        const prompt = this.generatePrompt(deadlineInfo);

        try {
            const response = await fetch(`${this.apiUrl}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: this.model,
                    prompt: prompt,
                    stream: false,
                    format: 'json'
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const generatedText = data.response;

            // Parse the JSON response
            const reminderData = JSON.parse(generatedText);

            return {
                success: true,
                data: reminderData
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Generate multiple reminders for a deadline
     */
    async generateReminders(deadlineInfo, reminders) {
        const results = [];

        for (const reminder of reminders) {
            const info = {
                name: deadlineInfo.name,
                description: deadlineInfo.description,
                offsetDays: reminder.offset,
                priority: reminder.priority
            };

            const result = await this.generateReminder(info);

            if (result.success) {
                results.push({
                    id: reminder.id,
                    offset: reminder.offset,
                    priority: reminder.priority,
                    ...result.data
                });
            } else {
                results.push({
                    id: reminder.id,
                    offset: reminder.offset,
                    priority: reminder.priority,
                    error: result.error
                });
            }
        }

        return results;
    }

    /**
     * Test connection to Ollama server
     */
    async testConnection() {
        try {
            const response = await fetch(`${this.apiUrl}/api/tags`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            return {
                success: true,
                models: data.models
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Export for use in Node.js or browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReminderGenerator;
}

// Usage Example:
/*

// Initialize
const generator = new ReminderGenerator({
  apiUrl: 'http://intelligence.fiika.dev',
  model: 'llama3.2:3b'
});

// Test connection
const connectionTest = await generator.testConnection();
console.log('Connection:', connectionTest);

// Generate single reminder
const reminder = await generator.generateReminder({
  name: 'File Notice of Appeal',
  description: 'The appellant must file a Notice of Appeal within 14 days from the date of the judgment or order being appealed.',
  offsetDays: -5,
  priority: 'urgent'
});
console.log('Generated Reminder:', reminder);

// Generate multiple reminders
const deadline = {
  name: 'File Notice of Appeal',
  description: 'The appellant must file a Notice of Appeal within 14 days from the date of the judgment or order being appealed.'
};

const reminders = [
  { id: 'r_001', offset: -10, priority: 'moderate' },
  { id: 'r_002', offset: -5, priority: 'urgent' },
  { id: 'r_003', offset: -1, priority: 'urgent' },
  { id: 'r_004', offset: 0, priority: 'critical' }
];

const allReminders = await generator.generateReminders(deadline, reminders);
console.log('All Reminders:', allReminders);

*/