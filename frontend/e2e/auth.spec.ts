import { test, expect } from '@playwright/test';

test.describe('Authentication & Session Flows (Section 40)', () => {
  test('debe iniciar sesión con credenciales válidas y redirigir al workspace', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Correo electrónico').fill('alex.owner@acme.com');
    await page.getByLabel('Contraseña').fill('Password123!');
    await page.getByRole('button', { name: /Iniciar sesión/i }).click();

    // Redirección al workspace principal
    await expect(page).toHaveURL(/.*\/workspaces/);
    await expect(page.getByText('Acme Corporation')).toBeVisible();
  });

  test('debe mostrar error descriptivo ante contraseña incorrecta', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Correo electrónico').fill('alex.owner@acme.com');
    await page.getByLabel('Contraseña').fill('WrongPassword999!');
    await page.getByRole('button', { name: /Iniciar sesión/i }).click();

    await expect(page.getByText(/Credenciales inválidas/i)).toBeVisible();
  });

  test('debe bloquear la cuenta temporalmente tras 5 intentos fallidos', async ({ page }) => {
    await page.goto('/login');

    for (let i = 0; i < 5; i++) {
      await page.getByLabel('Correo electrónico').fill('alex.owner@acme.com');
      await page.getByLabel('Contraseña').fill(`FailedAttempt_${i}!`);
      await page.getByRole('button', { name: /Iniciar sesión/i }).click();
    }

    await expect(page.getByText(/Cuenta bloqueada temporalmente/i)).toBeVisible();
  });

  test('debe cerrar sesión y revocar tokens en cliente y servidor', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('sarah.admin@acme.com');
    await page.getByLabel('Contraseña').fill('Password123!');
    await page.getByRole('button', { name: /Iniciar sesión/i }).click();

    await page.getByTestId('user-menu-button').click();
    await page.getByRole('button', { name: /Cerrar sesión/i }).click();

    await expect(page).toHaveURL(/.*\/login/);
  });
});
