import { test, expect } from '@playwright/test';

test.describe('Kanban Tasks & Workflows (Section 44)', () => {
  test('debe crear una nueva tarea y transicionar de columna', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('elena.design@acme.com');
    await page.getByLabel('Contraseña').fill('Password123!');
    await page.getByRole('button', { name: /Iniciar sesión/i }).click();

    // Navegar a la sección de Tareas
    await page.getByRole('link', { name: /Tareas/i }).click();
    await expect(page.getByText('Tablero de Tareas')).toBeVisible();

    // Crear tarea en columna "Por Hacer"
    await page.getByTestId('add-task-button-todo').click();
    await page.getByLabel('Título de la tarea').fill('Revisar guía de estilos v2.0');
    await page.getByRole('button', { name: /Guardar tarea/i }).click();

    await expect(page.getByText('Revisar guía de estilos v2.0')).toBeVisible();

    // Mover de "Por Hacer" a "En Progreso"
    const taskCard = page.getByText('Revisar guía de estilos v2.0');
    const inProgressColumn = page.getByTestId('kanban-column-in-progress');

    await taskCard.dragTo(inProgressColumn);

    // Validar persistencia tras recarga
    await page.reload();
    await expect(inProgressColumn.getByText('Revisar guía de estilos v2.0')).toBeVisible();
  });
});
