type LogFn = (mergingObject: Record<string, unknown>, message: string) => void

/**
 * The narrow slice of `HttpContext` this needs — a real request satisfies it
 * structurally (no cast at call sites), and a unit test can pass a plain
 * object instead of constructing a real HttpContext.
 */
export interface ActionContext {
  logger: { info: LogFn; warn: LogFn; error: LogFn }
  authenticatedUser: { id: string } | null
  household: { id: string } | null | undefined
  params: Record<string, string | undefined>
}

export interface TraceActionOptions<T> {
  /**
   * `true` when `fn`'s result represents a business failure (e.g. `!result.ok`
   * on a `Result`, or a manually-set `{ failed: true }`). Omit when the
   * action has no failure branch — outcome is then always `success` unless
   * `fn` throws.
   */
  isError?: (result: T) => boolean
  /** Resolves the id of the entity the action produced/targeted, when it is not already the route's `:id` param. */
  entityId?: (result: T) => string | undefined
}

function toSnakeCase(pascalCase: string): string {
  return pascalCase.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
}

/**
 * Wraps a controller action's body so every business action — read or
 * write — emits exactly one structured log line, with `trace_id`/`span_id`
 * already injected by `PinoInstrumentation` (see `instrumentation.ts`) and
 * mirrored to the OTLP logs pipeline. Never changes what `fn` returns or
 * throws — only observes it.
 */
export async function traceAction<T>(
  ctx: ActionContext,
  domain: string,
  useCase: { name: string },
  fn: () => Promise<T>,
  opts?: TraceActionOptions<T>,
): Promise<T> {
  const startedAt = performance.now()
  const action = `${domain}.${toSnakeCase(useCase.name)}`
  const base = {
    action,
    useCase: useCase.name,
    userId: ctx.authenticatedUser?.id,
    householdId: ctx.household?.id,
    entityId: ctx.params.id,
  }

  try {
    const result = await fn()
    const failed = opts?.isError?.(result) ?? false
    ctx.logger[failed ? 'warn' : 'info'](
      {
        ...base,
        entityId: base.entityId ?? opts?.entityId?.(result),
        durationMs: Math.round(performance.now() - startedAt),
        outcome: failed ? 'error' : 'success',
      },
      `action:${action}`,
    )
    return result
  } catch (error) {
    ctx.logger.error(
      {
        ...base,
        durationMs: Math.round(performance.now() - startedAt),
        outcome: 'error',
        errorType: error instanceof Error ? error.constructor.name : 'unknown',
      },
      `action:${action}`,
    )
    throw error
  }
}
