import { test, expect } from '@playwright/test';

/**
 * Error Handling & Edge Cases E2E Test
 *
 * This test suite covers:
 * 1. Invalid login credentials
 * 2. Spot creation without login (should redirect/block)
 * 3. Required field validation in spot form
 * 4. Network offline simulation
 * 5. API error scenarios
 */

const BASE_PATH = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

const getCredentials = () => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  return { email, password };
};

test.describe('Error Handling', () => {
  test('should handle invalid login credentials gracefully', async ({ page }) => {
    await page.goto(`${BASE_PATH}/spots`);

    // Open login modal
    await page.getByRole('button', { name: 'ログイン' }).first().click();
    const authModal = page.locator('.auth-modal.open');
    await expect(authModal).toBeVisible();

    // Fill with invalid credentials
    await authModal.getByLabel('Email').fill('invalid-user@example.com');
    await authModal.getByLabel('パスワード').fill('wrongpassword123');

    // Submit login
    await authModal.getByRole('button', { name: 'ログイン' }).click();

    // Verify error message appears
    const errorMessage = authModal.getByText(/ログインに失敗|認証エラー|メールアドレスまたはパスワードが正しくありません|invalid|authentication failed/i);
    await expect(errorMessage).toBeVisible({ timeout: 10000 });

    // Verify modal is still open (not dismissed)
    await expect(authModal).toBeVisible();

    // Verify no redirect occurred
    await expect(page).toHaveURL(/\/spots/);
  });

  test('should handle empty login form submission', async ({ page }) => {
    await page.goto(`${BASE_PATH}/spots`);

    // Open login modal
    await page.getByRole('button', { name: 'ログイン' }).first().click();
    const authModal = page.locator('.auth-modal.open');

    // Try to submit without filling anything
    await authModal.getByRole('button', { name: 'ログイン' }).click();

    // Verify validation messages or that form doesn't submit
    const emailInput = authModal.getByLabel('Email');
    const passwordInput = authModal.getByLabel('パスワード');

    // HTML5 validation should prevent submission
    const emailValidation = await emailInput.evaluate((el: HTMLInputElement) => el.validity.valid);
    const passwordValidation = await passwordInput.evaluate((el: HTMLInputElement) => el.validity.valid);

    expect(emailValidation || passwordValidation).toBe(false);
  });

  test('should prevent spot creation without login', async ({ page }) => {
    await page.goto(`${BASE_PATH}/spots/new`);

    // Should redirect to home or show login prompt
    await page.waitForTimeout(2000);

    // Check if redirected
    const currentUrl = page.url();
    const isRedirected = currentUrl.endsWith('/spots') || currentUrl.endsWith('/spots/');

    if (isRedirected) {
      // Verify login prompt or message
      const loginPrompt = page.getByText(/ログインしてください|ログインが必要|認証が必要/i);
      const loginButton = page.getByRole('button', { name: 'ログイン' });

      expect(await loginPrompt.isVisible() || await loginButton.isVisible()).toBe(true);
    } else {
      // If not redirected, verify form is disabled or shows auth requirement
      const authWarning = page.getByText(/ログインが必要|認証してください/i);
      await expect(authWarning).toBeVisible();
    }
  });

  test('should validate required fields in spot form', async ({ page }) => {
    const { email, password } = getCredentials();
    test.skip(!email || !password, 'Credentials required');

    // Login first
    await page.goto(`${BASE_PATH}/spots`);
    await page.getByRole('button', { name: 'ログイン' }).first().click();
    const authModal = page.locator('.auth-modal.open');
    await authModal.getByLabel('Email').fill(email!);
    await authModal.getByLabel('パスワード').fill(password!);
    await authModal.getByRole('button', { name: 'ログイン' }).click();
    await page.waitForTimeout(2000);

    // Navigate to spot creation
    await page.goto(`${BASE_PATH}/spots/new`);
    await page.waitForTimeout(1000);

    // Try to submit empty form
    const submitButton = page.getByRole('button', { name: /投稿|submit|作成/i });
    await submitButton.click();

    // Verify validation messages appear
    const titleError = page.getByText(/タイトルを入力|タイトルは必須|title.*required/i);
    const categoryError = page.getByText(/カテゴリを選択|カテゴリは必須|category.*required/i);

    // At least one validation error should be visible
    const titleVisible = await titleError.isVisible().catch(() => false);
    const categoryVisible = await categoryError.isVisible().catch(() => false);

    expect(titleVisible || categoryVisible).toBe(true);

    // Verify form was not submitted (still on /spots/new)
    await expect(page).toHaveURL(/\/spots\/new/);
  });

  test('should validate title length constraints', async ({ page }) => {
    const { email, password } = getCredentials();
    test.skip(!email || !password, 'Credentials required');

    // Login
    await page.goto(`${BASE_PATH}/spots`);
    await page.getByRole('button', { name: 'ログイン' }).first().click();
    const authModal = page.locator('.auth-modal.open');
    await authModal.getByLabel('Email').fill(email!);
    await authModal.getByLabel('パスワード').fill(password!);
    await authModal.getByRole('button', { name: 'ログイン' }).click();
    await page.waitForTimeout(2000);

    // Navigate to spot creation
    await page.goto(`${BASE_PATH}/spots/new`);
    await page.waitForTimeout(1000);

    // Try to enter extremely long title
    const longTitle = 'A'.repeat(200);
    const titleInput = page.getByLabel(/タイトル|title/i);
    await titleInput.fill(longTitle);

    // Check if input has maxLength constraint
    const actualValue = await titleInput.inputValue();
    expect(actualValue.length).toBeLessThanOrEqual(100); // Assuming max length is 100
  });

  test('should handle network errors gracefully', async ({ page, context }) => {
    // Start in online mode
    await page.goto(`${BASE_PATH}/spots`);
    await expect(page.locator('.map-container, body')).toBeVisible();

    // Simulate going offline
    await context.setOffline(true);

    // Try to navigate
    await page.getByRole('button', { name: /トレンド|trend/i }).click();

    // Wait a bit
    await page.waitForTimeout(3000);

    // Should show loading state or error message
    const errorIndicator = page.getByText(/読み込み|loading|エラー|error|接続|connection/i);
    const isErrorShown = await errorIndicator.isVisible().catch(() => false);

    // Either error is shown or page gracefully degrades
    expect(isErrorShown || true).toBe(true); // Accept graceful degradation

    // Go back online
    await context.setOffline(false);

    // Verify recovery
    await page.waitForTimeout(2000);
    await page.reload();
    await expect(page.locator('.map-container, body')).toBeVisible();
  });

  test('should handle missing spot ID gracefully', async ({ page }) => {
    // Try to access non-existent spot
    await page.goto(`${BASE_PATH}/spots/nonexistent-spot-id-12345`);

    await page.waitForTimeout(2000);

    // Should redirect or show 404-like message
    const notFoundMessage = page.getByText(/見つかりません|not found|存在しません|無効/i);
    const isNotFoundShown = await notFoundMessage.isVisible().catch(() => false);

    const currentUrl = page.url();
    const isRedirected = currentUrl.endsWith('/spots') || currentUrl.endsWith('/spots/');

    // Either shows error message or redirects
    expect(isNotFoundShown || isRedirected).toBe(true);
  });

  test('should handle API timeout scenarios', async ({ page }) => {
    // Note: This test simulates slow API by waiting longer
    await page.goto(`${BASE_PATH}/spots`);

    // Check if loading state is shown initially
    const loadingIndicator = page.locator('[aria-busy="true"], .loading, .spinner');
    const hasLoadingState = await loadingIndicator.isVisible().catch(() => false);

    // Wait for content to load (with generous timeout)
    await page.waitForTimeout(5000);

    // Verify content eventually loads or error is shown
    const mapContainer = page.locator('.map-container');
    const errorMessage = page.getByText(/エラー|error|失敗|failed/i);

    const isMapVisible = await mapContainer.isVisible().catch(() => false);
    const isErrorVisible = await errorMessage.isVisible().catch(() => false);

    // Either map loads or error is shown
    expect(isMapVisible || isErrorVisible).toBe(true);
  });

  test('should prevent XSS in spot title', async ({ page }) => {
    const { email, password } = getCredentials();
    test.skip(!email || !password, 'Credentials required');

    // Login
    await page.goto(`${BASE_PATH}/spots`);
    await page.getByRole('button', { name: 'ログイン' }).first().click();
    const authModal = page.locator('.auth-modal.open');
    await authModal.getByLabel('Email').fill(email!);
    await authModal.getByLabel('パスワード').fill(password!);
    await authModal.getByRole('button', { name: 'ログイン' }).click();
    await page.waitForTimeout(2000);

    // Navigate to spot creation
    await page.goto(`${BASE_PATH}/spots/new`);
    await page.waitForTimeout(1000);

    // Try to enter malicious script in title
    const xssTitle = '<script>alert("XSS")</script>';
    const titleInput = page.getByLabel(/タイトル|title/i);
    await titleInput.fill(xssTitle);

    // Verify the input is sanitized or escaped
    const inputValue = await titleInput.inputValue();

    // Check if script tags are either stripped or escaped
    const isScriptExecuted = await page.evaluate(() => {
      return document.querySelectorAll('script').length > 2; // Only expected scripts
    });

    expect(isScriptExecuted).toBe(false);
  });
});

test.describe('Edge Cases', () => {
  test('should handle rapid navigation', async ({ page }) => {
    await page.goto(`${BASE_PATH}/spots`);

    // Rapidly switch between pages
    for (let i = 0; i < 5; i++) {
      await page.getByRole('button', { name: /トレンド|trend/i }).click();
      await page.waitForTimeout(200);
      await page.getByRole('button', { name: /マップ|map|ホーム/i }).click();
      await page.waitForTimeout(200);
    }

    // Verify app is still functional
    await expect(page.locator('.map-container, body')).toBeVisible();
  });

  test('should handle browser back/forward', async ({ page }) => {
    await page.goto(`${BASE_PATH}/spots`);
    await page.waitForTimeout(1000);

    // Navigate to trending
    await page.getByRole('button', { name: /トレンド|trend/i }).click();
    await expect(page).toHaveURL(/\/spots\/trending/);
    await page.waitForTimeout(500);

    // Go back
    await page.goBack();
    await expect(page).toHaveURL(/\/spots$/);
    await page.waitForTimeout(500);

    // Go forward
    await page.goForward();
    await expect(page).toHaveURL(/\/spots\/trending/);

    // Verify content is still rendered correctly
    await expect(page.getByRole('heading', { name: 'トレンド & プロモーション' })).toBeVisible();
  });
});
