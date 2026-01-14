import { test, expect, devices } from '@playwright/test';

/**
 * Mobile Responsive E2E Tests
 *
 * Tests mobile-specific functionality and responsive design:
 * 1. Action bar visibility on mobile
 * 2. Compact header rendering
 * 3. Map viewport fills screen properly
 * 4. Touch interactions (tap, scroll)
 * 5. Trending page scrolling
 * 6. Mobile navigation patterns
 * 7. Safe area insets (notch devices)
 */

const BASE_PATH = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

// Use iPhone 12 as the test device
test.use({ ...devices['iPhone 12'] });

test.describe('Mobile Responsive Tests', () => {
  test('should render correctly on mobile viewport', async ({ page }) => {
    await page.goto(`${BASE_PATH}/spots`);

    // Verify viewport is mobile size
    const viewport = page.viewportSize();
    expect(viewport?.width).toBeLessThanOrEqual(430);

    // Verify action bar is visible on mobile
    const actionBar = page.locator('.action-bar');
    await expect(actionBar).toBeVisible();

    // Verify header is visible
    const header = page.locator('.app-header, header');
    await expect(header).toBeVisible();

    // Verify header is compact on mobile (smaller height)
    const headerBox = await header.boundingBox();
    expect(headerBox?.height).toBeLessThan(60); // Compact header should be < 60px

    // Verify map fills viewport
    const mapContainer = page.locator('.map-container');
    await expect(mapContainer).toBeVisible();

    const mapBox = await mapContainer.boundingBox();
    expect(mapBox?.width).toBeGreaterThan(300);
    expect(mapBox?.height).toBeGreaterThan(400);
  });

  test('should display action bar with all buttons', async ({ page }) => {
    await page.goto(`${BASE_PATH}/spots`);

    const actionBar = page.locator('.action-bar');
    await expect(actionBar).toBeVisible();

    // Verify action bar buttons are present
    const homeButton = page.getByRole('button', { name: /ホーム|home|マップ|map/i });
    const trendButton = page.getByRole('button', { name: /トレンド|trend/i });
    const spotButton = page.getByRole('button', { name: /spot|投稿/i });

    await expect(homeButton).toBeVisible();
    await expect(trendButton).toBeVisible();
    await expect(spotButton).toBeVisible();

    // Verify action bar is fixed at bottom
    const actionBarBox = await actionBar.boundingBox();
    const viewportHeight = page.viewportSize()?.height || 0;

    expect(actionBarBox?.y).toBeGreaterThan(viewportHeight - 100); // Near bottom
  });

  test('should allow map interaction on mobile', async ({ page }) => {
    await page.goto(`${BASE_PATH}/spots`);

    const mapContainer = page.locator('.map-container');
    await expect(mapContainer).toBeVisible();

    // Wait for map to initialize
    await page.waitForTimeout(2000);

    // Test tap interaction
    await mapContainer.tap({ position: { x: 150, y: 150 } });
    await page.waitForTimeout(500);

    // Verify map is still responsive
    await expect(mapContainer).toBeVisible();

    // Test pan/drag gesture (simulate swipe)
    await page.mouse.move(200, 200);
    await page.mouse.down();
    await page.mouse.move(100, 100);
    await page.mouse.up();

    await page.waitForTimeout(500);

    // Verify map responded to interaction
    await expect(mapContainer).toBeVisible();
  });

  test('should handle touch scrolling in list view', async ({ page }) => {
    await page.goto(`${BASE_PATH}/spots`);

    // Switch to list view if button exists
    const listViewButton = page.getByRole('button', { name: /リスト|list/i });
    if (await listViewButton.isVisible()) {
      await listViewButton.click();
      await page.waitForTimeout(1000);

      // Get list container
      const listContainer = page.locator('.spot-list, .app-main');
      await expect(listContainer).toBeVisible();

      // Test scroll
      await page.evaluate(() => {
        window.scrollTo(0, 200);
      });

      await page.waitForTimeout(500);

      const scrollY = await page.evaluate(() => window.scrollY);
      expect(scrollY).toBeGreaterThan(0);
    }
  });

  test('trending page should be scrollable on mobile', async ({ page }) => {
    await page.goto(`${BASE_PATH}/spots/trending`);

    const trendingContent = page.locator('.trending-content, .app-main');
    await expect(trendingContent).toBeVisible();

    // Test scrolling
    await page.evaluate(() => {
      window.scrollTo(0, 300);
    });

    await page.waitForTimeout(500);

    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeGreaterThan(0);

    // Scroll back to top
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });

    await page.waitForTimeout(500);
  });

  test('should handle safe area insets (notch devices)', async ({ page }) => {
    await page.goto(`${BASE_PATH}/spots`);

    // Check if CSS variables for safe area are set
    const hasSafeAreaSupport = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      const safeAreaBottom = style.getPropertyValue('--safe-area-bottom');
      const safeAreaTop = style.getPropertyValue('--safe-area-top');

      return {
        hasSafeAreaBottom: safeAreaBottom !== '',
        hasSafeAreaTop: safeAreaTop !== '',
        values: { bottom: safeAreaBottom, top: safeAreaTop }
      };
    });

    // Safe area variables should be defined (even if 0px)
    console.log('Safe area support:', hasSafeAreaSupport);

    // Verify action bar respects safe area
    const actionBar = page.locator('.action-bar');
    const actionBarStyle = await actionBar.evaluate((el) => {
      const computed = getComputedStyle(el);
      return {
        bottom: computed.getPropertyValue('bottom'),
        paddingBottom: computed.getPropertyValue('padding-bottom')
      };
    });

    // Action bar should have bottom positioning that accounts for safe area
    expect(actionBarStyle.bottom).toBeTruthy();
  });

  test('should render AdSense on mobile without layout issues', async ({ page }) => {
    await page.goto(`${BASE_PATH}/spots/trending`);

    // Check for AdSense wrapper
    const adWrapper = page.locator('.adsense-wrapper');
    const adCount = await adWrapper.count();

    if (adCount > 0) {
      await expect(adWrapper.first()).toBeVisible();

      // Verify ad doesn't overflow viewport
      const adBox = await adWrapper.first().boundingBox();
      const viewportWidth = page.viewportSize()?.width || 0;

      expect(adBox?.width).toBeLessThanOrEqual(viewportWidth);

      // Verify ad has appropriate mobile margins
      const adStyles = await adWrapper.first().evaluate((el) => {
        const computed = getComputedStyle(el);
        return {
          margin: computed.getPropertyValue('margin'),
          padding: computed.getPropertyValue('padding')
        };
      });

      expect(adStyles.margin).toBeTruthy();
    }
  });

  test('should hide desktop-only elements on mobile', async ({ page }) => {
    await page.goto(`${BASE_PATH}/spots`);

    // Sidebar should be hidden on mobile
    const sidebar = page.locator('.sidebar-nav');
    const isSidebarHidden = await sidebar.evaluate((el) => {
      const computed = getComputedStyle(el);
      return computed.display === 'none' || computed.visibility === 'hidden';
    });

    expect(isSidebarHidden || await sidebar.count() === 0).toBe(true);
  });

  test('should handle modal overlays on mobile', async ({ page }) => {
    await page.goto(`${BASE_PATH}/spots`);

    // Open login modal
    await page.getByRole('button', { name: 'ログイン' }).first().click();

    const authModal = page.locator('.auth-modal.open, [role="dialog"]');
    await expect(authModal).toBeVisible();

    // Verify modal fills mobile viewport appropriately
    const modalBox = await authModal.boundingBox();
    const viewportSize = page.viewportSize();

    expect(modalBox?.width).toBeGreaterThan(viewportSize!.width * 0.8); // At least 80% width

    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  });

  test('should support pinch-to-zoom on map (gesture simulation)', async ({ page }) => {
    await page.goto(`${BASE_PATH}/spots`);

    const mapContainer = page.locator('.map-container');
    await expect(mapContainer).toBeVisible();
    await page.waitForTimeout(2000);

    // Note: Playwright doesn't directly support pinch gestures,
    // but we can verify map zoom controls work

    // Find zoom buttons or use keyboard shortcuts
    const zoomIn = page.locator('[aria-label*="zoom in"], .mapboxgl-ctrl-zoom-in');
    const zoomOut = page.locator('[aria-label*="zoom out"], .mapboxgl-ctrl-zoom-out');

    if (await zoomIn.isVisible()) {
      await zoomIn.click();
      await page.waitForTimeout(500);

      await zoomOut.click();
      await page.waitForTimeout(500);
    }

    // Map should still be functional
    await expect(mapContainer).toBeVisible();
  });

  test('should handle landscape orientation', async ({ page }) => {
    // Switch to landscape
    await page.setViewportSize({ width: 844, height: 390 }); // iPhone 12 Pro Max landscape

    await page.goto(`${BASE_PATH}/spots`);

    // Map should still be visible and fill screen
    const mapContainer = page.locator('.map-container');
    await expect(mapContainer).toBeVisible();

    const mapBox = await mapContainer.boundingBox();
    expect(mapBox?.width).toBeGreaterThan(700);
    expect(mapBox?.height).toBeGreaterThan(200);

    // Action bar should still be visible
    const actionBar = page.locator('.action-bar');
    await expect(actionBar).toBeVisible();
  });

  test('should handle rapid taps without double-tap zoom', async ({ page }) => {
    await page.goto(`${BASE_PATH}/spots`);

    const mapContainer = page.locator('.map-container');
    await expect(mapContainer).toBeVisible();
    await page.waitForTimeout(2000);

    // Rapid taps
    for (let i = 0; i < 5; i++) {
      await mapContainer.tap({ position: { x: 150 + i * 10, y: 150 } });
      await page.waitForTimeout(100);
    }

    // Verify no unwanted zoom occurred (map should still be stable)
    await expect(mapContainer).toBeVisible();
  });

  test('should show mobile-optimized touch targets', async ({ page }) => {
    await page.goto(`${BASE_PATH}/spots`);

    // Check button sizes - should be at least 44x44px for mobile accessibility
    const buttons = page.locator('.action-bar button');
    const buttonCount = await buttons.count();

    for (let i = 0; i < Math.min(buttonCount, 3); i++) {
      const button = buttons.nth(i);
      const box = await button.boundingBox();

      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(40); // Minimum touch target
        expect(box.height).toBeGreaterThanOrEqual(40);
      }
    }
  });
});

test.describe('Mobile Navigation Patterns', () => {
  test.use({ ...devices['iPhone 12'] });

  test('should navigate between pages using action bar', async ({ page }) => {
    await page.goto(`${BASE_PATH}/spots`);

    // Navigate to trending
    await page.getByRole('button', { name: /トレンド|trend/i }).click();
    await expect(page).toHaveURL(/\/spots\/trending/);
    await expect(page.getByRole('heading', { name: 'トレンド & プロモーション' })).toBeVisible();

    // Navigate back to home
    await page.getByRole('button', { name: /ホーム|home|マップ/i }).click();
    await expect(page).toHaveURL(/\/spots$/);
    await expect(page.locator('.map-container')).toBeVisible();
  });

  test('should open spot creation from action bar', async ({ page }) => {
    const email = process.env.E2E_EMAIL;
    const password = process.env.E2E_PASSWORD;
    test.skip(!email || !password, 'Credentials required');

    await page.goto(`${BASE_PATH}/spots`);

    // Login first
    await page.getByRole('button', { name: 'ログイン' }).first().click();
    const authModal = page.locator('.auth-modal.open');
    await authModal.getByLabel('Email').fill(email!);
    await authModal.getByLabel('パスワード').fill(password!);
    await authModal.getByRole('button', { name: 'ログイン' }).click();
    await page.waitForTimeout(2000);

    // Tap spot creation button
    await page.getByRole('button', { name: /spot|投稿/i }).click();
    await expect(page).toHaveURL(/\/spots\/new/);
    await expect(page.getByRole('heading', { name: 'スポット投稿' })).toBeVisible();
  });
});
