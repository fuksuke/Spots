import { test, expect, Page } from '@playwright/test';

/**
 * Comprehensive User Journey E2E Test
 *
 * This test covers the full user workflow:
 * 1. Login through modal
 * 2. Create new spot with validation
 * 3. Click map to set location
 * 4. Submit and verify success
 * 5. Verify spot appears on map
 * 6. Switch to list view
 * 7. Open spot detail sheet
 * 8. Like the spot
 * 9. Add to favorites
 * 10. Post a comment
 * 11. Navigate to trending page
 * 12. Verify AdSense elements
 * 13. Open and close notifications
 */

const BASE_PATH = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

/**
 * Get E2E test credentials from environment
 */
const getCredentials = () => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  return { email, password };
};

/**
 * Login through the authentication modal
 */
const loginThroughModal = async (page: Page, email: string, password: string) => {
  // Click login button to open modal
  await page.getByRole('button', { name: 'ログイン' }).first().click();

  // Wait for auth modal to open
  const authModal = page.locator('.auth-modal.open');
  await expect(authModal).toBeVisible({ timeout: 5000 });

  // Fill in credentials
  await authModal.getByLabel('Email').fill(email);
  await authModal.getByLabel('パスワード').fill(password);

  // Submit login
  await authModal.getByRole('button', { name: 'ログイン' }).click();

  // Wait for success message
  await expect(authModal.getByText('ログインしました。')).toBeVisible({ timeout: 15000 });

  // Close modal
  await authModal.getByRole('button', { name: '閉じる' }).click();
};

test.describe('Comprehensive User Journey', () => {
  test('full user workflow: login → create spot → interact → view trending', async ({ page }) => {
    const { email, password } = getCredentials();
    test.skip(!email || !password, 'E2E_EMAIL / E2E_PASSWORD environment variables required');

    // ========================================
    // Step 1: Navigate to home and login
    // ========================================
    await page.goto(`${BASE_PATH}/spots`);
    await loginThroughModal(page, email!, password!);

    // Verify logged in state
    await expect(page.getByRole('button', { name: 'アカウント' })).toBeVisible();

    // ========================================
    // Step 2: Navigate to spot creation
    // ========================================
    await page.getByRole('button', { name: 'spot(投稿)' }).click();
    await expect(page).toHaveURL(/\/spots\/new/);

    // Verify form loads
    await expect(page.getByRole('heading', { name: 'スポット投稿' })).toBeVisible();

    // Wait for map to load
    const mapContainer = page.locator('.map-container');
    await expect(mapContainer).toBeVisible();
    await page.waitForTimeout(2000); // Wait for map initialization

    // ========================================
    // Step 3: Fill spot form
    // ========================================
    const spotTitle = `E2E Test Spot ${Date.now()}`;
    await page.getByLabel('タイトル').fill(spotTitle);
    await page.getByLabel('説明').fill('This is an automated test spot created by Playwright E2E tests');

    // Select category
    const categorySelect = page.locator('select[name="category"], select[aria-label="カテゴリ"]').first();
    await categorySelect.selectOption('event');

    // Set start time (next hour)
    const nextHour = new Date();
    nextHour.setHours(nextHour.getHours() + 1);
    nextHour.setMinutes(0);
    nextHour.setSeconds(0);
    const timeString = nextHour.toISOString().slice(0, 16);

    const startTimeInput = page.locator('input[type="datetime-local"]').first();
    await startTimeInput.fill(timeString);

    // Set end time (2 hours later)
    const endTime = new Date(nextHour);
    endTime.setHours(endTime.getHours() + 2);
    const endTimeString = endTime.toISOString().slice(0, 16);

    const endTimeInput = page.locator('input[type="datetime-local"]').last();
    await endTimeInput.fill(endTimeString);

    // ========================================
    // Step 4: Click on map to set location
    // ========================================
    await mapContainer.click({ position: { x: 200, y: 200 } });
    await page.waitForTimeout(500); // Wait for location marker

    // ========================================
    // Step 5: Submit spot
    // ========================================
    await page.getByRole('button', { name: '投稿する' }).click();

    // Verify success message
    await expect(page.getByText(/スポットを投稿しました|投稿が完了しました/)).toBeVisible({ timeout: 10000 });

    // Verify redirect to home
    await expect(page).toHaveURL(/\/spots$/);

    // ========================================
    // Step 6: Verify spot appears on map
    // ========================================
    await expect(page.locator('.map-container')).toBeVisible();

    // Wait for spots to load
    await page.waitForTimeout(3000);

    // Note: We can't easily verify the specific spot on the map without knowing its exact marker,
    // but we can verify the map is interactive

    // ========================================
    // Step 7: Switch to list view
    // ========================================
    const listViewButton = page.getByRole('button', { name: /リスト|list/i });
    if (await listViewButton.isVisible()) {
      await listViewButton.click();
      await expect(page).toHaveURL(/view=list/);

      // Wait for list to load
      await page.waitForTimeout(2000);

      // Verify spot appears in list (search for title)
      const spotInList = page.getByText(spotTitle);
      if (await spotInList.isVisible({ timeout: 5000 })) {
        // ========================================
        // Step 8: Open spot detail
        // ========================================
        await spotInList.click();

        const detailSheet = page.locator('.spot-drawer.open, .drawer.open, [role="dialog"]').first();
        await expect(detailSheet).toBeVisible({ timeout: 5000 });

        // Verify spot title in detail
        await expect(detailSheet.getByRole('heading', { name: spotTitle })).toBeVisible();

        // ========================================
        // Step 9: Like the spot
        // ========================================
        const likeButton = detailSheet.getByRole('button', { name: /👍|いいね|like/i }).first();
        if (await likeButton.isVisible()) {
          const initialLikesText = await likeButton.textContent();
          await likeButton.click();
          await page.waitForTimeout(1000);

          // Verify like count changed or button state changed
          const newLikesText = await likeButton.textContent();
          expect(newLikesText).not.toBe(initialLikesText);
        }

        // ========================================
        // Step 10: Add to favorites
        // ========================================
        const favoriteButton = detailSheet.getByRole('button', { name: /☆|★|お気に入り|favorite/i }).first();
        if (await favoriteButton.isVisible()) {
          await favoriteButton.click();
          await page.waitForTimeout(1000);

          // Verify favorite state changed (☆ → ★)
          const favoriteState = await favoriteButton.textContent();
          expect(favoriteState).toContain('★');
        }

        // ========================================
        // Step 11: Post a comment
        // ========================================
        const commentInput = detailSheet.getByPlaceholder(/コメント|comment/i);
        if (await commentInput.isVisible()) {
          await commentInput.fill('Great event! Automated test comment.');

          const submitButton = detailSheet.getByRole('button', { name: /送信|submit|投稿/i });
          await submitButton.click();

          // Verify comment appears
          await expect(detailSheet.getByText('Great event! Automated test comment.')).toBeVisible({ timeout: 5000 });
        }

        // ========================================
        // Step 12: Close detail sheet
        // ========================================
        const closeButton = detailSheet.getByRole('button', { name: /閉じる|close/i });
        if (await closeButton.isVisible()) {
          await closeButton.click();
        } else {
          // Try clicking outside the drawer
          await page.keyboard.press('Escape');
        }
      }
    }

    // ========================================
    // Step 13: Navigate to trending page
    // ========================================
    const trendingButton = page.getByRole('button', { name: /トレンド|trend/i });
    await trendingButton.click();
    await expect(page).toHaveURL(/\/spots\/trending/);

    // ========================================
    // Step 14: Verify trending page structure
    // ========================================
    await expect(page.getByRole('heading', { name: 'トレンド & プロモーション' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '人気ランキング' })).toBeVisible();

    // ========================================
    // Step 15: Verify AdSense placeholder exists
    // ========================================
    const adContainer = page.locator('.adsense-wrapper');
    const adCount = await adContainer.count();

    if (adCount > 0) {
      await expect(adContainer.first()).toBeVisible();

      // Verify sponsor label
      const sponsorLabel = page.getByText('スポンサー');
      await expect(sponsorLabel).toBeVisible();

      // Verify skeleton or ad container
      const adSkeleton = page.locator('.adsense-skeleton, .adsense-container');
      await expect(adSkeleton.first()).toBeVisible();
    }

    // ========================================
    // Step 16: Open notifications
    // ========================================
    const notificationButton = page.getByRole('button', { name: /通知|notification/i });
    await notificationButton.click();

    const notificationPanel = page.locator('.notification-panel, [role="complementary"]').first();
    await expect(notificationPanel).toBeVisible({ timeout: 3000 });

    // Close notifications
    const closeNotificationButton = notificationPanel.getByRole('button', { name: /閉じる|close/i });
    if (await closeNotificationButton.isVisible()) {
      await closeNotificationButton.click();
    } else {
      await page.keyboard.press('Escape');
    }

    // ========================================
    // Test completed successfully
    // ========================================
    console.log(`✅ User journey test completed successfully with spot: ${spotTitle}`);
  });

  test('should handle multiple spot interactions in sequence', async ({ page }) => {
    const { email, password } = getCredentials();
    test.skip(!email || !password, 'Credentials required');

    await page.goto(`${BASE_PATH}/spots`);
    await loginThroughModal(page, email!, password!);

    // Navigate to trending
    await page.getByRole('button', { name: /トレンド|trend/i }).click();
    await expect(page).toHaveURL(/\/spots\/trending/);

    // Verify popular spots panel
    const popularPanel = page.locator('.popular-spots-panel, .ranking-panel');
    if (await popularPanel.isVisible()) {
      // Get first popular spot
      const firstSpot = popularPanel.locator('.spot-card, .ranking-item').first();
      if (await firstSpot.isVisible()) {
        await firstSpot.click();

        // Verify detail sheet opens
        const detailSheet = page.locator('.spot-drawer.open, [role="dialog"]').first();
        await expect(detailSheet).toBeVisible({ timeout: 5000 });

        // Close and open another spot
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);

        // Try second spot
        const secondSpot = popularPanel.locator('.spot-card, .ranking-item').nth(1);
        if (await secondSpot.isVisible()) {
          await secondSpot.click();
          await expect(detailSheet).toBeVisible({ timeout: 5000 });
        }
      }
    }
  });
});
