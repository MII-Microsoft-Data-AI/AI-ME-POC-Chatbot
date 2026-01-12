// Performance logging utility for chat flow optimization
// Tracks optimization improvements during testing

export class PerformanceLogger {
  private startTime: number
  private checkpoints: Map<string, number>
  private enabled: boolean

  constructor(flowName: string) {
    this.enabled = true // Always enabled for now
    this.startTime = performance.now()
    this.checkpoints = new Map()
    
    if (this.enabled) {
      console.log(`[Perf] 🚀 ${flowName} started`)
    }
  }

  checkpoint(name: string) {
    if (!this.enabled) return
    
    const now = performance.now()
    const elapsed = now - this.startTime
    this.checkpoints.set(name, elapsed)
    
    console.log(`[Perf] ✓ ${name}: ${elapsed.toFixed(0)}ms`)
  }

  finish(flowName: string) {
    if (!this.enabled) return
    
    const total = performance.now() - this.startTime
    console.log(`[Perf] 🏁 ${flowName} completed in ${total.toFixed(0)}ms`)
    
    // Log summary
    console.log('[Perf] Summary:', {
      total: `${total.toFixed(0)}ms`,
      checkpoints: Object.fromEntries(this.checkpoints)
    })
  }
}

// Helper for async operations
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now()
  try {
    const result = await fn()
    console.log(`[Perf] ${name}: ${(performance.now() - start).toFixed(0)}ms`)
    return result
  } catch (error) {
    console.log(`[Perf] ${name} failed after ${(performance.now() - start).toFixed(0)}ms`)
    throw error
  }
}
