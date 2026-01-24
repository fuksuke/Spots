/**
 * Task Scheduler for Batch DOM Updates
 *
 * Uses requestIdleCallback to batch DOM updates during browser idle time,
 * preventing frame drops and maintaining smooth 60fps performance.
 *
 * This is particularly important for map rendering where we may need to
 * update many callouts/markers at once. Instead of updating them all
 * synchronously and blocking the main thread, we batch them into chunks
 * and process them during idle periods.
 *
 * @example
 * ```typescript
 * const scheduler = new TaskScheduler();
 *
 * // Schedule high-priority task
 * scheduler.schedule({
 *   id: 'update-premium-markers',
 *   priority: 'high',
 *   execute: () => updatePremiumMarkers()
 * });
 *
 * // Schedule normal task
 * scheduler.schedule({
 *   id: 'update-regular-markers',
 *   priority: 'normal',
 *   execute: () => updateRegularMarkers()
 * });
 *
 * // Cleanup on component unmount
 * scheduler.cancel();
 * ```
 */

export type TaskPriority = 'high' | 'normal' | 'low';

export interface Task {
  /** Unique identifier for the task */
  id: string;
  /** Task priority (high > normal > low) */
  priority: TaskPriority;
  /** Function to execute */
  execute: () => void;
  /** Optional deadline (timestamp) */
  deadline?: number;
}

export class TaskScheduler {
  private queue: Task[] = [];
  private isProcessing = false;
  private idleCallbackId: number | null = null;
  private fallbackTimeoutId: number | null = null;

  /**
   * Schedule a task for execution during idle time
   *
   * Tasks are sorted by priority (high > normal > low).
   * If multiple tasks have the same priority, they are processed FIFO.
   */
  schedule(task: Task): void {
    // Add task to queue
    this.queue.push(task);

    // Sort queue by priority
    this.queue.sort((a, b) => {
      const priorityWeight: Record<TaskPriority, number> = {
        high: 3,
        normal: 2,
        low: 1
      };
      return priorityWeight[b.priority] - priorityWeight[a.priority];
    });

    // Start processing if not already running
    if (!this.isProcessing) {
      this.process();
    }
  }

  /**
   * Process tasks during browser idle time
   *
   * Uses requestIdleCallback for optimal performance.
   * Falls back to setTimeout if requestIdleCallback is not available.
   */
  private process(): void {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;

    // Check if requestIdleCallback is supported
    if (typeof window.requestIdleCallback === 'function') {
      this.processWithIdleCallback();
    } else {
      // Fallback for browsers that don't support requestIdleCallback
      this.processWithTimeout();
    }
  }

  /**
   * Process tasks using requestIdleCallback (preferred method)
   */
  private processWithIdleCallback(): void {
    const processChunk = (deadline: IdleDeadline) => {
      // Process tasks while we have idle time
      while (deadline.timeRemaining() > 0 && this.queue.length > 0) {
        const task = this.queue.shift();

        if (task) {
          try {
            task.execute();
          } catch (error) {
            console.warn(`[TaskScheduler] Task "${task.id}" failed:`, error);
          }
        }
      }

      // If there are more tasks, schedule another idle callback
      if (this.queue.length > 0) {
        this.idleCallbackId = window.requestIdleCallback(processChunk);
      } else {
        this.isProcessing = false;
      }
    };

    // Start processing
    this.idleCallbackId = window.requestIdleCallback(processChunk);
  }

  /**
   * Process tasks using setTimeout (fallback method)
   */
  private processWithTimeout(): void {
    const BATCH_SIZE = 3; // Process 3 tasks per batch
    const BATCH_DELAY = 16; // ~60fps (16ms between frames)

    const processBatch = () => {
      let processed = 0;

      // Process a batch of tasks
      while (processed < BATCH_SIZE && this.queue.length > 0) {
        const task = this.queue.shift();

        if (task) {
          try {
            task.execute();
            processed++;
          } catch (error) {
            console.warn(`[TaskScheduler] Task "${task.id}" failed:`, error);
          }
        }
      }

      // If there are more tasks, schedule another batch
      if (this.queue.length > 0) {
        this.fallbackTimeoutId = window.setTimeout(processBatch, BATCH_DELAY);
      } else {
        this.isProcessing = false;
      }
    };

    // Start processing
    this.fallbackTimeoutId = window.setTimeout(processBatch, BATCH_DELAY);
  }

  /**
   * Cancel all pending tasks and stop processing
   *
   * Call this when the component unmounts to prevent memory leaks.
   */
  cancel(): void {
    // Cancel idle callback
    if (this.idleCallbackId !== null && typeof window.cancelIdleCallback === 'function') {
      window.cancelIdleCallback(this.idleCallbackId);
      this.idleCallbackId = null;
    }

    // Cancel timeout fallback
    if (this.fallbackTimeoutId !== null) {
      window.clearTimeout(this.fallbackTimeoutId);
      this.fallbackTimeoutId = null;
    }

    // Clear queue
    this.queue = [];
    this.isProcessing = false;
  }

  /**
   * Get the number of pending tasks
   */
  getPendingCount(): number {
    return this.queue.length;
  }

  /**
   * Check if the scheduler is currently processing tasks
   */
  isActive(): boolean {
    return this.isProcessing;
  }
}

/**
 * TypeScript declarations for requestIdleCallback
 * (Not available in all TypeScript lib definitions)
 */
// Removed conflicting global declarations
// If requestIdleCallback is missing in your environment, please add it to your tsconfig lib or global d.ts
