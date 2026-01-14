/**
 * FPS (Frames Per Second) Monitor
 *
 * Monitors frame rate to detect performance issues and trigger
 * automatic degradation when FPS drops below threshold.
 *
 * This is critical for maintaining smooth UX, especially on mobile
 * devices or when rendering many map markers. If FPS drops too low,
 * the map can automatically switch to a less demanding render mode.
 *
 * @example
 * ```typescript
 * const monitor = new FPSMonitor(30, (fps) => {
 *   console.log('Low FPS detected:', fps);
 *   // Trigger degradation (e.g., switch to canvas mode)
 *   setRenderMode('canvas');
 * });
 *
 * // Start monitoring
 * monitor.start();
 *
 * // Check current FPS
 * const currentFPS = monitor.getAverageFPS();
 *
 * // Stop monitoring on unmount
 * monitor.stop();
 * ```
 */

export class FPSMonitor {
  private frameTimes: number[] = [];
  private lastFrameTime = performance.now();
  private rafId: number | null = null;
  private threshold: number;
  private onLowFPS?: (fps: number) => void;
  private sampleSize: number;
  private checkInterval: number;
  private frameCount = 0;

  /**
   * Create a new FPS monitor
   *
   * @param threshold FPS threshold below which onLowFPS is triggered (default: 30)
   * @param onLowFPS Callback function called when FPS drops below threshold
   * @param sampleSize Number of frames to average over (default: 60 = 1 second at 60fps)
   * @param checkInterval How often to check FPS threshold in frames (default: 60)
   */
  constructor(
    threshold: number = 30,
    onLowFPS?: (fps: number) => void,
    sampleSize: number = 60,
    checkInterval: number = 60
  ) {
    this.threshold = threshold;
    this.onLowFPS = onLowFPS;
    this.sampleSize = sampleSize;
    this.checkInterval = checkInterval;
  }

  /**
   * Start monitoring FPS
   *
   * Begins measuring frame times using requestAnimationFrame.
   * Call stop() to clean up when component unmounts.
   */
  start(): void {
    if (this.rafId !== null) {
      // Already running
      return;
    }

    this.lastFrameTime = performance.now();
    this.frameTimes = [];
    this.frameCount = 0;

    const measure = () => {
      const now = performance.now();
      const delta = now - this.lastFrameTime;
      this.lastFrameTime = now;

      // Add frame time to rolling window
      this.frameTimes.push(delta);

      // Keep only the last N frames
      if (this.frameTimes.length > this.sampleSize) {
        this.frameTimes.shift();
      }

      this.frameCount++;

      // Check FPS threshold periodically
      if (this.frameCount % this.checkInterval === 0 && this.frameTimes.length >= this.sampleSize) {
        const currentFPS = this.getAverageFPS();

        if (currentFPS < this.threshold && this.onLowFPS) {
          this.onLowFPS(currentFPS);
        }
      }

      // Continue measuring
      this.rafId = requestAnimationFrame(measure);
    };

    this.rafId = requestAnimationFrame(measure);
  }

  /**
   * Stop monitoring FPS
   *
   * Cancels the animation frame loop and clears data.
   * Always call this on component unmount to prevent memory leaks.
   */
  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.frameTimes = [];
    this.frameCount = 0;
  }

  /**
   * Get the average FPS over the sample window
   *
   * @returns Average FPS, or 60 if not enough samples collected yet
   */
  getAverageFPS(): number {
    if (this.frameTimes.length === 0) {
      return 60; // Assume 60fps if no data yet
    }

    // Calculate average frame time (ms per frame)
    const avgDelta = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;

    // Convert to FPS (frames per second)
    const fps = 1000 / avgDelta;

    return Math.round(fps);
  }

  /**
   * Get the current instantaneous FPS (last frame only)
   *
   * Less accurate than getAverageFPS() but more responsive.
   *
   * @returns Current FPS
   */
  getCurrentFPS(): number {
    if (this.frameTimes.length === 0) {
      return 60;
    }

    const lastDelta = this.frameTimes[this.frameTimes.length - 1];
    const fps = 1000 / lastDelta;

    return Math.round(fps);
  }

  /**
   * Get the minimum FPS observed in the current sample window
   *
   * Useful for detecting FPS drops.
   *
   * @returns Minimum FPS
   */
  getMinFPS(): number {
    if (this.frameTimes.length === 0) {
      return 60;
    }

    // Find longest frame time (worst FPS)
    const maxDelta = Math.max(...this.frameTimes);
    const minFPS = 1000 / maxDelta;

    return Math.round(minFPS);
  }

  /**
   * Get the maximum FPS observed in the current sample window
   *
   * @returns Maximum FPS
   */
  getMaxFPS(): number {
    if (this.frameTimes.length === 0) {
      return 60;
    }

    // Find shortest frame time (best FPS)
    const minDelta = Math.min(...this.frameTimes);
    const maxFPS = 1000 / minDelta;

    return Math.round(maxFPS);
  }

  /**
   * Check if FPS is currently below threshold
   *
   * @returns true if average FPS is below threshold
   */
  isLowFPS(): boolean {
    return this.getAverageFPS() < this.threshold;
  }

  /**
   * Get FPS statistics for debugging/monitoring
   *
   * @returns Object containing FPS statistics
   */
  getStats(): {
    averageFPS: number;
    currentFPS: number;
    minFPS: number;
    maxFPS: number;
    isLowFPS: boolean;
    threshold: number;
    sampleSize: number;
    samplesCollected: number;
  } {
    return {
      averageFPS: this.getAverageFPS(),
      currentFPS: this.getCurrentFPS(),
      minFPS: this.getMinFPS(),
      maxFPS: this.getMaxFPS(),
      isLowFPS: this.isLowFPS(),
      threshold: this.threshold,
      sampleSize: this.sampleSize,
      samplesCollected: this.frameTimes.length
    };
  }

  /**
   * Update the FPS threshold
   *
   * @param newThreshold New threshold value
   */
  setThreshold(newThreshold: number): void {
    this.threshold = newThreshold;
  }

  /**
   * Update the low FPS callback
   *
   * @param callback New callback function
   */
  setOnLowFPS(callback: (fps: number) => void): void {
    this.onLowFPS = callback;
  }

  /**
   * Reset collected samples
   *
   * Useful for testing or when you want a fresh measurement.
   */
  reset(): void {
    this.frameTimes = [];
    this.frameCount = 0;
    this.lastFrameTime = performance.now();
  }

  /**
   * Check if monitoring is active
   *
   * @returns true if currently monitoring
   */
  isActive(): boolean {
    return this.rafId !== null;
  }
}
