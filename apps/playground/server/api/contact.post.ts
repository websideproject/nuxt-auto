import { z } from 'zod'

/**
 * Standalone validated endpoint using auto-imported helpers.
 * Demonstrates: createEndpoint with Zod body validation (no resource binding).
 */
export default createEndpoint({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email'),
    message: z.string().min(10, 'Message must be at least 10 characters'),
  }),

  responseFormat: 'auto',

  async handler(ctx) {
    // ctx.body is typed as { name: string, email: string, message: string }
    const { name, email, message } = ctx.body

    // In a real app, you'd send an email or store in DB
    console.log(`[contact] From: ${name} <${email}> - ${message}`)

    return {
      sent: true,
      message: `Thank you ${name}, we received your message.`,
    }
  },
})
