import { test, expect } from '@playwright/test';

test.describe('Admin Dashboard, RBAC & Audit Trails (Section 46)', () => {
  test('solo usuarios con rol Owner o Admin pueden acceder al panel de administración', async ({ page }) => {
    // 1. Intento con usuario Member
    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('carlos.guest@external.com');
    await page.getByLabel('Contraseña').fill('Password123!');
    await page.getByRole('button', { name: /Iniciar sesión/i }).click();

    await page.goto('/workspaces/acme-corp/admin');
    await expect(page.getByText(/Acceso denegado/i)).toBeVisible();

    // 2. Intento con Workspace Owner
    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('alex.owner@acme.com');
    await page.getByLabel('Contraseña').fill('Password123!');
    await page.getByRole('button', { name: /Iniciar sesión/i }).click();

    await page.goto('/workspaces/acme-corp/admin');
    await expect(page.getByText('Panel de Administración')).toBeVisible();

    // Consultar registros de auditoría
    await page.getByRole('tab', { name: /Auditoría/i }).click();
    await expect(page.getByText('Registro Inmutable de Eventos')).toBeVisible();
  });
});
