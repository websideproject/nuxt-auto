import { createHmac } from 'node:crypto'
import { defineAutoApiPlugin } from '../types/plugin'
import type { AutoApiPlugin } from '../types/plugin'

export interface WebhookEndpoint {
  /** Target URL to POST to */
  url: string
  /** Event patterns to match (e.g., 'users.create', '*.delete', '*') */
  events: string[]
  /** Extra headers to include in the webhook request */
  headers?: Record<string, string>
}

export interface WebhookPluginOptions {
  /** Webhook endpoint configurations */
  endpoints: WebhookEndpoint[]
  /** HMAC signing configuration */
  signing?: { secret: string; algorithm?: string }
  /** Retry configuration */
  retry?: { attempts?: number; backoffMs?: number }
}

function matchEvent(pattern: string, event: string): boolean {
  if (pattern === '*') return true
  const parts = pattern.split('.')
  const eventParts = event.split('.')
  return parts.every((part, i) => part === '*' || part === eventParts[i])
}

function signPayload(payload: string, secret: string, algorithm: string): string {
  return createHmac(algorithm, secret).update(payload).digest('hex')
}

async function sendWithRetry(
  url: string,
  body: string,
  headers: Record<string, string>,
  attempts: number,
  backoffMs: number,
) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await globalThis.fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body,
      })
      if (response.ok) return
      if (attempt < attempts) {
        await new Promise(resolve => setTimeout(resolve, backoffMs * Math.pow(2, attempt - 1)))
      }
    } catch (err) {
      if (attempt === attempts) {
        console.error(`[autoApi:webhook] Failed to deliver to ${url} after ${attempts} attempts:`, err)
      } else {
        await new Promise(resolve => setTimeout(resolve, backoffMs * Math.pow(2, attempt - 1)))
      }
    }
  }
}

/**
 * Create a webhook notification plugin.
 * Sends HTTP POST notifications when resources change.
 *
 * @example
 * ```ts
 * createWebhookPlugin({
 *   endpoints: [
 *     { url: 'https://hooks.slack.com/...', events: ['users.create'] },
 *     { url: 'https://n8n.example.com/webhook/abc', events: ['*'] },
 *   ],
 *   signing: { secret: process.env.WEBHOOK_SECRET! },
 *   retry: { attempts: 3, backoffMs: 1000 },
 * })
 * ```
 */
export function createWebhookPlugin(options: WebhookPluginOptions): AutoApiPlugin {
  const {
    endpoints,
    signing,
    retry = {},
  } = options

  const attempts = retry.attempts ?? 3
  const backoffMs = retry.backoffMs ?? 1000
  const signingAlgorithm = signing?.algorithm ?? 'sha256'

  function fireWebhooks(event: string, data: any, context: any) {
    const payload = JSON.stringify({
      event,
      resource: context.resource,
      data,
      timestamp: new Date().toISOString(),
      user: context.user ? { id: context.user.id, email: context.user.email } : null,
    })

    for (const endpoint of endpoints) {
      const matches = endpoint.events.some(pattern => matchEvent(pattern, event))
      if (!matches) continue

      const headers: Record<string, string> = { ...endpoint.headers }

      if (signing) {
        headers['X-Webhook-Signature'] = signPayload(payload, signing.secret, signingAlgorithm)
        headers['X-Webhook-Algorithm'] = signingAlgorithm
      }

      headers['X-Webhook-Event'] = event

      // Fire and forget
      sendWithRetry(endpoint.url, payload, headers, attempts, backoffMs)
    }
  }

  return defineAutoApiPlugin({
    name: 'webhook',
    version: '1.0.0',
    runtimeSetup(ctx) {
      ctx.addGlobalHook({
        afterCreate(result, context) {
          fireWebhooks(`${context.resource}.create`, result, context)
        },
        afterUpdate(result, context) {
          fireWebhooks(`${context.resource}.update`, result, context)
        },
        afterDelete(id, context) {
          fireWebhooks(`${context.resource}.delete`, { id }, context)
        },
      })

      ctx.logger.info(`Webhooks enabled with ${endpoints.length} endpoint(s)`)
    },
  })
}
