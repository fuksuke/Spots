import { test, expect, Page } from '@playwright/test';

const BASE_PATH = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

type CredentialRole = 'USER' | 'ADMIN';

const getCredentials = (role: CredentialRole = 'USER') => {
  const prefix = role === 'ADMIN' ? 'E2E_ADMIN' : 'E2E';
  const email = process.env[`${prefix}_EMAIL`];
  const password = process.env[`${prefix}_PASSWORD`];
  return { email, password };
};

const loginThroughModal = async (page: Page, email: string, password: string) => {
  await page.getByRole('button', { name: 'ログイン' }).first().click();
  const authModal = page.locator('.auth-modal.open');
  await expect(authModal).toBeVisible();
  await authModal.getByLabel('Email').fill(email);
  await authModal.getByLabel('パスワード').fill(password);
  await authModal.getByRole('button', { name: 'ログイン' }).click();
  await expect(authModal.getByText('ログインしました。')).toBeVisible({ timeout: 15_000 });
  await authModal.getByRole('button', { name: '閉じる' }).click();
  await expect(authModal).toHaveJSProperty('ariaHidden', 'true');
};

test.describe('Core user journey', () => {
  test('login → spot form → map → trending → notifications', async ({ page }) => {
    const { email, password } = getCredentials('USER');
    test.skip(!email || !password, 'E2E_EMAIL / E2E_PASSWORD must be provided');

    await page.goto(`${BASE_PATH}/spots`, { waitUntil: 'domcontentloaded' });
    await loginThroughModal(page, email!, password!);

    await page.getByRole('button', { name: 'spot(投稿)' }).click();
    await expect(page).toHaveURL(/\/spots\/new/);
    await expect(page.getByRole('heading', { name: 'スポット投稿' })).toBeVisible();

    await page.goto(`${BASE_PATH}/spots`);
    await expect(page.locator('.map-container')).toBeVisible();

    await page.getByRole('button', { name: 'トレンド' }).click();
    await expect(page).toHaveURL(/\/spots\/trending/);
    await expect(page.getByRole('heading', { name: 'トレンド & プロモーション' })).toBeVisible();

    await page.getByRole('button', { name: '通知' }).click();
    const notificationPanel = page.locator('.notification-panel');
    await expect(notificationPanel).toBeVisible();
    await notificationPanel.getByRole('button', { name: '閉じる' }).click();
  });

  test('admin → 管理画面で通報とアナリティクス確認', async ({ page }) => {
    const { email, password } = getCredentials('ADMIN');
    test.skip(!email || !password, 'E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD must be provided');

    await page.goto(`${BASE_PATH}/spots`, { waitUntil: 'domcontentloaded' });
    await loginThroughModal(page, email!, password!);

    await page.getByRole('button', { name: '通知' }).click();
    const notificationPanel = page.locator('.notification-panel');
    await expect(notificationPanel).toBeVisible();
    await notificationPanel.getByRole('button', { name: '管理画面' }).click();

    const adminPanel = page.locator('.admin-panel.open');
    await expect(adminPanel).toBeVisible();

    await adminPanel.getByRole('button', { name: '通報' }).click();
    await expect(adminPanel.getByRole('heading', { name: '通報一覧' })).toBeVisible();

    await adminPanel.getByRole('button', { name: 'アナリティクス' }).click();
    await expect(adminPanel.getByRole('heading', { name: 'アナリティクス' })).toBeVisible();
    await expect(adminPanel.locator('.analytics-card').first()).toBeVisible();
  });
});
