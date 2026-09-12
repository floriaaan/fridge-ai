import { AppState, type AppStateStatus } from 'react-native'
import { newSpanId, newTraceId, toTraceparent } from './ids.js'
import { buildResource, intAttribute, stringAttribute, type OtlpAttribute } from './resource.js'

/**
 * A very small OTLP/HTTP+JSON client for the app.
 *
 * Why not the OpenTelemetry JS SDK: there is no supported React Native
 * distribution of it. `sdk-trace-web` assumes browser APIs, the context
 * manager has no async-hooks equivalent on Hermes, and the community RN
 * wrappers are pre-1.0. What we actually need from OpenTelemetry is the
 * *protocol* — W3C trace context on the wire and OTLP on the exporter — and
 * both are stable specifications that fit in this file. The backend, where
 * the SDK is supported and where the hard instrumentation lives (HTTP,
 * Postgres, outgoing calls), uses the real SDK.
 *
 * Non-negotiables, in order:
 *  - never throw into application code;
 *  - never block a user-facing request;
 *  - never keep the radio awake or the queue growing when the collector is
 *    unreachable.
 */

const FLUSH_INTERVAL_MS = 15_000
const MAX_BATCH = 64
/** Hard ceiling on buffered items. Oldest are dropped first. */
const MAX_QUEUE = 256
const MAX_BACKOFF_MS = 5 * 60_000
const EXPORT_TIMEOUT_MS = 5_000

type AttributeValue = string | number | boolean | undefined | null

export interface SpanHandle {
  readonly traceId: string
  readonly spanId: string
  /** Inject as the `traceparent` request header to continue this trace server-side. */
  readonly traceparent: string
  end(outcome?: { attributes?: Record<string, AttributeValue>; error?: unknown }): void
}

interface QueuedSpan {
  traceId: string
  spanId: string
  name: string
  startTimeUnixNano: string
  endTimeUnixNano: string
  attributes: OtlpAttribute[]
  status?: { code: number }
}

interface QueuedLog {
  timeUnixNano: string
  severityText: string
  severityNumber: number
  body: { stringValue: string }
  attributes: OtlpAttribute[]
  traceId?: string
  spanId?: string
}

function toAttributes(input: Record<string, AttributeValue> | undefined): OtlpAttribute[] {
  if (!input) return []
  const out: OtlpAttribute[] = []
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue
    if (typeof value === 'number') out.push(intAttribute(key, Math.round(value)))
    else if (typeof value === 'boolean') out.push({ key, value: { boolValue: value } })
    else out.push(stringAttribute(key, value))
  }
  return out
}

function nanos(milliseconds: number): string {
  return `${Math.round(milliseconds)}000000`
}

class MobileTelemetry {
  private endpoint: string | null = null
  private sampleRatio = 1
  private started = false
  /** Set when the backend says the relay is gone; nothing is queued after that. */
  private stopped = false

  private spans: QueuedSpan[] = []
  private logs: QueuedLog[] = []
  private dropped = 0

  private timer: ReturnType<typeof setInterval> | null = null
  private appStateSubscription: { remove: () => void } | null = null
  private consecutiveFailures = 0
  private retryNotBefore = 0
  private flushing = false

  start(): void {
    if (this.started) return
    this.started = true

    const apiUrl = process.env.EXPO_PUBLIC_API_URL
    const enabled = process.env.EXPO_PUBLIC_TELEMETRY_ENABLED === 'true'
    if (!enabled || !apiUrl) {
      this.stopped = true
      return
    }

    this.endpoint = `${apiUrl}/api/telemetry/v1`
    const ratio = Number(process.env.EXPO_PUBLIC_TELEMETRY_SAMPLE_RATIO ?? '1')
    this.sampleRatio = Number.isFinite(ratio) ? Math.min(Math.max(ratio, 0), 1) : 1

    this.timer = setInterval(() => void this.flush(), FLUSH_INTERVAL_MS)
    // A backgrounded app can be killed without warning, taking the buffer with
    // it — and backgrounding is exactly when a user gives up on a broken screen.
    this.appStateSubscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state !== 'active') void this.flush()
    })
  }

  shutdown(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.appStateSubscription?.remove()
    this.appStateSubscription = null
    this.started = false
    void this.flush()
  }

  /**
   * Opens a client span, or returns `null` when telemetry is off entirely.
   *
   * The distinction matters on the wire: a disabled app sends no
   * `traceparent` at all, so the backend samples the request on its own
   * terms. A *sampled-out* trace still sends one, with the sampled flag
   * cleared — that is the whole point of head sampling, and the backend
   * honours the decision through `parentbased_traceidratio`.
   */
  startClientSpan(name: string, attributes?: Record<string, AttributeValue>): SpanHandle | null {
    if (this.stopped || !this.endpoint) return null

    const traceId = newTraceId()
    const spanId = newSpanId()
    const sampled = Math.random() < this.sampleRatio
    const startedAt = Date.now()

    return {
      traceId,
      spanId,
      traceparent: toTraceparent(traceId, spanId, sampled),
      end: (outcome) => {
        if (!sampled) return
        try {
          const failed = outcome?.error !== undefined
          this.enqueueSpan({
            traceId,
            spanId,
            name,
            startTimeUnixNano: nanos(startedAt),
            endTimeUnixNano: nanos(Date.now()),
            attributes: toAttributes({ ...attributes, ...outcome?.attributes }),
            status: failed ? { code: 2 } : undefined,
          })
        } catch {
          // Telemetry must never surface in application code.
        }
      },
    }
  }

  /**
   * Records an error as an OTLP log record, tied to a span when one is
   * available so the mobile error, the mobile span and the backend trace all
   * line up in one view.
   */
  recordError(
    message: string,
    options?: {
      error?: unknown
      span?: Pick<SpanHandle, 'traceId' | 'spanId'>
      attributes?: Record<string, AttributeValue>
    },
  ): void {
    try {
      const errorType =
        options?.error instanceof Error ? options.error.name : options?.error ? 'unknown' : undefined
      this.enqueueLog({
        timeUnixNano: nanos(Date.now()),
        severityText: 'ERROR',
        severityNumber: 17,
        body: { stringValue: message.slice(0, 2_048) },
        // `errorType` only overrides a caller-supplied `error.type` when it is
        // actually known — otherwise spreading `undefined` last would erase
        // an `attributes['error.type']` the caller already computed (e.g.
        // http-client.ts's business-error call sites, which pass a known
        // `error.type` string but no `options.error`).
        attributes: toAttributes({
          ...options?.attributes,
          ...(errorType !== undefined ? { 'error.type': errorType } : null),
        }),
        traceId: options?.span?.traceId,
        spanId: options?.span?.spanId,
      })
    } catch {
      // Same contract as above.
    }
  }

  private enqueueSpan(span: QueuedSpan): void {
    if (this.stopped) return
    if (this.spans.length >= MAX_QUEUE) {
      this.spans.shift()
      this.dropped += 1
    }
    this.spans.push(span)
    if (this.spans.length >= MAX_BATCH) void this.flush()
  }

  private enqueueLog(log: QueuedLog): void {
    if (this.stopped) return
    if (this.logs.length >= MAX_QUEUE) {
      this.logs.shift()
      this.dropped += 1
    }
    this.logs.push(log)
    if (this.logs.length >= MAX_BATCH) void this.flush()
  }

  private async flush(): Promise<void> {
    if (this.stopped || !this.endpoint || this.flushing) return
    if (Date.now() < this.retryNotBefore) return
    if (this.spans.length === 0 && this.logs.length === 0) return

    this.flushing = true
    const spans = this.spans.splice(0, MAX_BATCH)
    const logs = this.logs.splice(0, MAX_BATCH)
    const resource = buildResource()
    if (this.dropped > 0) {
      resource.attributes.push(intAttribute('app.telemetry.dropped', this.dropped))
      this.dropped = 0
    }

    try {
      const results: boolean[] = []
      if (spans.length > 0) {
        results.push(
          await this.post('traces', {
            resourceSpans: [{ resource, scopeSpans: [{ spans: spans.map(withKind) }] }],
          }),
        )
      }
      if (logs.length > 0) {
        results.push(
          await this.post('logs', {
            resourceLogs: [{ resource, scopeLogs: [{ logRecords: logs }] }],
          }),
        )
      }

      if (results.every(Boolean)) {
        this.consecutiveFailures = 0
        this.retryNotBefore = 0
      } else {
        // One re-queue attempt, at the front, then the backoff decides. The
        // batch is never retried forever: a phone on a train would otherwise
        // spend its battery on a collector it cannot reach.
        this.spans.unshift(...spans.slice(0, MAX_QUEUE - this.spans.length))
        this.logs.unshift(...logs.slice(0, MAX_QUEUE - this.logs.length))
        this.consecutiveFailures += 1
        this.retryNotBefore =
          Date.now() + Math.min(FLUSH_INTERVAL_MS * 2 ** this.consecutiveFailures, MAX_BACKOFF_MS)
      }
    } catch {
      // Unreachable in practice — `post` already swallows. Kept so a future
      // edit cannot turn a flush into an unhandled rejection.
    } finally {
      this.flushing = false
    }
  }

  /** `true` on success. Never throws, never rejects. */
  private async post(signal: 'traces' | 'logs', payload: unknown): Promise<boolean> {
    // `AbortController` + `setTimeout` rather than `AbortSignal.timeout`,
    // which Hermes does not expose on every RN version.
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), EXPORT_TIMEOUT_MS)
    try {
      const response = await fetch(`${this.endpoint}/${signal}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      // The relay is disabled or this build predates it: stop for good rather
      // than retrying on a timer for the rest of the session.
      if (response.status === 404) {
        this.stopped = true
        this.spans = []
        this.logs = []
        return true
      }
      // Over quota — treat as a failure so the backoff kicks in.
      return response.ok
    } catch {
      return false
    } finally {
      clearTimeout(timeout)
    }
  }
}

/** OTLP `SPAN_KIND_CLIENT`. */
function withKind(span: QueuedSpan) {
  return { ...span, kind: 3 }
}

export const telemetry = new MobileTelemetry()
