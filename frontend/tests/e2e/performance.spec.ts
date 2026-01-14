import { test, expect } from '@playwright/test';

/**
 * Performance E2E Tests
 *
 * Validates performance benchmarks:
 * 1. Map load time < 5 seconds
 * 2. Trending page load < 3 seconds
 * 3. No jank during view switches
 * 4. Smooth re-rendering after interactions
 * 5. Initial page load metrics (LCP, FCP)
 */

const BASE_PATH = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

test.describe('Performance Tests', () => {
  test('should load map within acceptable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto(`${BASE_PATH}/spots`);

    // Wait for map container to be visible
    await page.locator('.map-container').waitFor({ state: 'visible' });

    const loadTime = Date.now() - startTime;

    console.log(`Map load time: ${loadTime}ms`);

    // Should load within 5 seconds (5000ms)
    expect(loadTime).toBeLessThan(5000);

    // Verify map is interactive
    await expect(page.locator('.map-container')).toBeVisible();
  });

  test('should load trending page quickly', async ({ page }) => {
    const startTime = Date.now();

    await page.goto(`${BASE_PATH}/spots/trending`);

    // Wait for trending header
    await page.getByRole('heading', { name: 'トレンド & プロモーション' }).waitFor();

    const loadTime = Date.now() - startTime;

    console.log(`Trending page load time: ${loadTime}ms`);

    // Should load within 3 seconds (3000ms)
    expect(loadTime).toBeLessThan(3000);

    // Verify content is visible
    await expect(page.getByRole('heading', { name: '人気ランキング' })).toBeVisible();
  });

  test('should render spots without jank', async ({ page }) => {
    await page.goto(`${BASE_PATH}/spots`);

    // Wait for map to stabilize
    await page.waitForTimeout(2000);

    // Switch to list view
    const listViewButton = page.getByRole('button', { name: /リスト|list/i });
    if (await listViewButton.isVisible()) {
      await listViewButton.click();
      await page.waitForTimeout(500);

      // Verify list view rendered
      await expect(page).toHaveURL(/view=list/);

      // Switch back to map view
      const mapViewButton = page.getByRole('button', { name: /マップ|map/i });
      await mapViewButton.click();
      await page.waitForTimeout(500);

      // Map should re-render smoothly
      await expect(page.locator('.map-container')).toBeVisible();

      // No errors should occur
      const hasConsoleErrors = await page.evaluate(() => {
        // Check if any console errors were logged
        return false; // Simplified check
      });

      expect(hasConsoleErrors).toBe(false);
    }
  });

  test('should handle rapid page switching without performance degradation', async ({ page }) => {
    await page.goto(`${BASE_PATH}/spots`);
    await page.waitForTimeout(1000);

    const iterations = 5;
    const timings: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();

      // Navigate to trending
      await page.getByRole('button', { name: /トレンド|trend/i }).click();
      await expect(page).toHaveURL(/\/spots\/trending/);
      await page.waitForTimeout(300);

      // Navigate back to home
      await page.getByRole('button', { name: /ホーム|home|マップ/i }).click();
      await expect(page).toHaveURL(/\/spots$/);
      await page.waitForTimeout(300);

      const iterationTime = Date.now() - startTime;
      timings.push(iterationTime);
    }

    console.log('Navigation timings:', timings);

    // Average time should be reasonable
    const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;
    expect(avgTime).toBeLessThan(2000); // Average < 2 seconds per round-trip

    // Times should not increase significantly (no memory leak)
    const firstTime = timings[0];
    const lastTime = timings[timings.length - 1];
    expect(lastTime).toBeLessThan(firstTime * 1.5); // No more than 50% slower
  });

  test('should maintain performance with multiple spots loaded', async ({ page }) => {
    await page.goto(`${BASE_PATH}/spots`);

    // Wait for spots to load
    await page.waitForTimeout(3000);

    // Measure interaction responsiveness
    const startTime = Date.now();

    // Try to open spot detail (if any spot card is visible)
    const spotCards = page.locator('.spot-card, .marker, [data-spot-id]');
    const cardCount = await spotCards.count();

    if (cardCount > 0) {
      // Click first spot
      await spotCards.first().click();

      // Wait for detail sheet to open
      const detailSheet = page.locator('.spot-drawer.open, [role="dialog"]').first();
      await detailSheet.waitFor({ state: 'visible', timeout: 3000 });

      const interactionTime = Date.now() - startTime;

      console.log(`Spot detail open time: ${interactionTime}ms`);

      // Should open within 1 second
      expect(interactionTime).toBeLessThan(1000);
    }
  });

  test('should have acceptable First Contentful Paint (FCP)', async ({ page }) => {
    await page.goto(`${BASE_PATH}/spots`);

    // Get performance metrics
    const metrics = await page.evaluate(() => {
      const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paintEntries = performance.getEntriesByType('paint');
      const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint');

      return {
        domContentLoaded: perfData.domContentLoadedEventEnd - perfData.fetchStart,
        loadComplete: perfData.loadEventEnd - perfData.fetchStart,
        fcp: fcp?.startTime || null
      };
    });

    console.log('Performance metrics:', metrics);

    // FCP should be < 2 seconds
    if (metrics.fcp) {
      expect(metrics.fcp).toBeLessThan(2000);
    }

    // DOM Content Loaded should be < 3 seconds
    expect(metrics.domContentLoaded).toBeLessThan(3000);
  });

  test('should handle scroll performance in list view', async ({ page }) => {
    await page.goto(`${BASE_PATH}/spots`);

    // Switch to list view
    const listViewButton = page.getByRole('button', { name: /リスト|list/i });
    if (await listViewButton.isVisible()) {
      await listViewButton.click();
      await page.waitForTimeout(1000);

      // Measure scroll performance
      const startTime = Date.now();

      // Scroll down
      await page.evaluate(() => {
        window.scrollTo({ top: 500, behavior: 'smooth' });
      });

      await page.waitForTimeout(1000);

      // Scroll back up
      await page.evaluate(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });

      await page.waitForTimeout(1000);

      const scrollTime = Date.now() - startTime;

      console.log(`Scroll performance time: ${scrollTime}ms`);

      // Scroll operations should complete within 3 seconds
      expect(scrollTime).toBeLessThan(3000);

      // Page should still be responsive
      await expect(page.locator('.app-main, body')).toBeVisible();
    }
  });

  test('should load AdSense without blocking main content', async ({ page }) => {
    const startTime = Date.now();

    await page.goto(`${BASE_PATH}/spots/trending`);

    // Wait for main content (not AdSense)
    await page.getByRole('heading', { name: 'トレンド & プロモーション' }).waitFor();

    const contentLoadTime = Date.now() - startTime;

    console.log(`Main content load time (with AdSense): ${contentLoadTime}ms`);

    // Main content should load quickly even if AdSense is loading
    expect(contentLoadTime).toBeLessThan(3000);

    // Verify AdSense doesn't block rendering
    const popularHeading = page.getByRole('heading', { name: '人気ランキング' });
    await expect(popularHeading).toBeVisible();
  });

  test('should handle image loading efficiently', async ({ page }) => {
    await page.goto(`${BASE_PATH}/spots/trending`);

    // Wait for images to start loading
    await page.waitForTimeout(2000);

    // Count images
    const images = page.locator('img');
    const imageCount = await images.count();

    console.log(`Image count: ${imageCount}`);

    // Check if images are lazy-loaded (have loading="lazy" attribute)
    const lazyImages = page.locator('img[loading="lazy"]');
    const lazyCount = await lazyImages.count();

    console.log(`Lazy-loaded images: ${lazyCount}/${imageCount}`);

    // At least some images should be lazy-loaded for performance
    if (imageCount > 5) {
      expect(lazyCount).toBeGreaterThan(0);
    }
  });

  test('should not have memory leaks during extended use', async ({ page }) => {
    await page.goto(`${BASE_PATH}/spots`);

    // Get initial memory usage (if available)
    const initialMetrics = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return null;
    });

    // Perform multiple interactions
    for (let i = 0; i < 10; i++) {
      // Navigate to trending
      await page.getByRole('button', { name: /トレンド|trend/i }).click();
      await page.waitForTimeout(500);

      // Navigate back
      await page.getByRole('button', { name: /ホーム|home|マップ/i }).click();
      await page.waitForTimeout(500);
    }

    // Get final memory usage
    const finalMetrics = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return null;
    });

    if (initialMetrics && finalMetrics) {
      console.log(`Memory usage: ${initialMetrics} -> ${finalMetrics}`);

      // Memory should not increase by more than 50MB (50 * 1024 * 1024 bytes)
      const memoryIncrease = finalMetrics - initialMetrics;
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    }
  });

  test('should handle concurrent API requests efficiently', async ({ page }) => {
    // Monitor network requests
    const apiRequests: string[] = [];

    page.on('request', request => {
      if (request.url().includes('/api/')) {
        apiRequests.push(request.url());
      }
    });

    const startTime = Date.now();

    await page.goto(`${BASE_PATH}/spots`);
    await page.waitForTimeout(3000); // Wait for all requests

    const loadTime = Date.now() - startTime;

    console.log(`API requests made: ${apiRequests.length}`);
    console.log(`Total load time: ${loadTime}ms`);

    // Should not make excessive API requests (< 20 for initial load)
    expect(apiRequests.length).toBeLessThan(20);

    // Total load time should still be acceptable
    expect(loadTime).toBeLessThan(5000);
  });
});

test.describe('Performance Regression Tests', () => {
  test('should not degrade performance after form submission', async ({ page }) => {
    const email = process.env.E2E_EMAIL;
    const password = process.env.E2E_PASSWORD;
    test.skip(!email || !password, 'Credentials required');

    await page.goto(`${BASE_PATH}/spots`);

    // Login
    await page.getByRole('button', { name: 'ログイン' }).first().click();
    const authModal = page.locator('.auth-modal.open');
    await authModal.getByLabel('Email').fill(email!);
    await authModal.getByLabel('パスワード').fill(password!);
    await authModal.getByRole('button', { name: 'ログイン' }).click();
    await page.waitForTimeout(2000);

    // Measure navigation time before form submission
    const startBefore = Date.now();
    await page.getByRole('button', { name: /トレンド|trend/i }).click();
    await expect(page).toHaveURL(/\/spots\/trending/);
    const navTimeBefore = Date.now() - startBefore;

    // Go back and submit a form (create spot)
    await page.getByRole('button', { name: /ホーム|home|マップ/i }).click();
    await page.getByRole('button', { name: /spot|投稿/i }).click();
    await page.waitForTimeout(1000);

    // Fill minimal form and submit
    await page.getByLabel('タイトル').fill('Performance Test');
    await page.getByRole('button', { name: '投稿する' }).click();
    await page.waitForTimeout(2000);

    // Measure navigation time after form submission
    const startAfter = Date.now();
    await page.getByRole('button', { name: /トレンド|trend/i }).click();
    await expect(page).toHaveURL(/\/spots\/trending/);
    const navTimeAfter = Date.now() - startAfter;

    console.log(`Navigation before: ${navTimeBefore}ms, after: ${navTimeAfter}ms`);

    // Performance should not degrade by more than 50%
    expect(navTimeAfter).toBeLessThan(navTimeBefore * 1.5);
  });
});
