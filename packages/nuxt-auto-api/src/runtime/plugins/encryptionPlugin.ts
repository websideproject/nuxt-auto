import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { defineAutoApiPlugin } from '../types/plugin'
import type { AutoApiPlugin } from '../types/plugin'

export interface EncryptionPluginOptions {
  /** Encryption secret (32 bytes / 64 hex chars for AES-256) */
  secret: string
  /** Cipher algorithm. @default 'aes-256-gcm' */
  algorithm?: string
  /** Per-resource encrypted fields: { users: ['ssn', 'taxId'] } */
  resources: Record<string, string[]>
}

/**
 * Derive a 32-byte key from the secret (pads/truncates as needed).
 */
function deriveKey(secret: string): Buffer {
  const buf = Buffer.from(secret, 'hex')
  if (buf.length === 32) return buf
  // If not valid hex or wrong length, hash it
  const { createHash } = require('node:crypto')
  return createHash('sha256').update(secret).digest()
}

/**
 * Encrypt a string value. Returns `iv:tag:ciphertext` in base64.
 */
function encrypt(value: string, key: Buffer): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = (cipher as any).getAuthTag() as Buffer
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`
}

/**
 * Decrypt a `iv:tag:ciphertext` string.
 */
function decrypt(encoded: string, key: Buffer): string {
  const parts = encoded.split(':')
  if (parts.length !== 3) return encoded // Not encrypted, return as-is

  const ivB64 = parts[0]!
  const tagB64 = parts[1]!
  const cipherB64 = parts[2]!
  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const ciphertext = Buffer.from(cipherB64, 'base64')

  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

/**
 * Create a field encryption plugin.
 * Transparently encrypts fields before write and decrypts after read.
 *
 * @example
 * ```ts
 * createEncryptionPlugin({
 *   secret: process.env.ENCRYPTION_KEY!,
 *   resources: {
 *     users: ['ssn', 'taxId'],
 *     payments: ['cardNumber'],
 *   },
 * })
 * ```
 */
export function createEncryptionPlugin(options: EncryptionPluginOptions): AutoApiPlugin {
  const { secret, resources } = options
  const key = deriveKey(secret)

  return defineAutoApiPlugin({
    name: 'field-encryption',
    version: '1.0.0',
    runtimeSetup(ctx) {
      for (const [resource, fields] of Object.entries(resources)) {
        ctx.addHook(resource, {
          beforeCreate(data, _context) {
            const encrypted = { ...data }
            for (const field of fields) {
              if (encrypted[field] != null && typeof encrypted[field] === 'string') {
                encrypted[field] = encrypt(encrypted[field], key)
              }
            }
            return encrypted
          },

          beforeUpdate(_id, data, _context) {
            const encrypted = { ...data }
            for (const field of fields) {
              if (encrypted[field] != null && typeof encrypted[field] === 'string') {
                encrypted[field] = encrypt(encrypted[field], key)
              }
            }
            return encrypted
          },

          afterGet(result, _context) {
            if (!result) return result
            const decrypted = { ...result }
            for (const field of fields) {
              if (decrypted[field] != null && typeof decrypted[field] === 'string') {
                try {
                  decrypted[field] = decrypt(decrypted[field], key)
                } catch {
                  // Value may not be encrypted (e.g., migrating existing data)
                }
              }
            }
            return decrypted
          },

          afterList(results, _context) {
            if (!results) return results
            return results.map(item => {
              const decrypted = { ...item }
              for (const field of fields) {
                if (decrypted[field] != null && typeof decrypted[field] === 'string') {
                  try {
                    decrypted[field] = decrypt(decrypted[field], key)
                  } catch {
                    // Value may not be encrypted
                  }
                }
              }
              return decrypted
            })
          },
        })
      }

      ctx.logger.info(`Field encryption enabled for: ${Object.keys(resources).join(', ')}`)
    },
  })
}
