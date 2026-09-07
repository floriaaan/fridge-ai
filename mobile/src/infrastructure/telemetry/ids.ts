/**
 * W3C trace-context identifiers: 16 random bytes for a trace, 8 for a span,
 * lowercase hex, never all-zero (the spec treats an all-zero id as invalid).
 *
 * `Math.random` is deliberate. Trace ids need to be *unique*, not
 * unguessable — nothing is authorised on their basis — and reaching for a
 * CSPRNG here would mean a native crypto dependency and a synchronous call on
 * every outgoing request, on the phone, for no security gain.
 */
function randomHex(byteLength: number): string {
  let out = ''
  for (let index = 0; index < byteLength; index += 1) {
    out += Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, '0')
  }
  // Astronomically unlikely, cheap to rule out.
  return /^0+$/.test(out) ? out.slice(0, -1) + '1' : out
}

export function newTraceId(): string {
  return randomHex(16)
}

export function newSpanId(): string {
  return randomHex(8)
}

/**
 * The header the backend's OpenTelemetry instrumentation reads to continue
 * this trace instead of starting a new one — `version-traceId-spanId-flags`.
 */
export function toTraceparent(traceId: string, spanId: string, sampled: boolean): string {
  return `00-${traceId}-${spanId}-${sampled ? '01' : '00'}`
}
