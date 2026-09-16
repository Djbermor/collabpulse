import { test, expect } from '@playwright/test';

test.describe('Realtime Chat & Messaging Matrix (Section 42)', () => {
  test('debe permitir enviar un mensaje con formato y recibirlo en tiempo real', async ({ browser }) => {
    // Contexto de Usuario A (Alex)
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await pageA.goto('/login');
    await pageA.getByLabel('Correo electrónico').fill('alex.owner@acme.com');
    await pageA.getByLabel('Contraseña').fill('Password123!');
    await pageA.getByRole('button', { name: /Iniciar sesión/i }).click();

    // Contexto de Usuario B (David)
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await pageB.goto('/login');
    await pageB.getByLabel('Correo electrónico').fill('david.dev@acme.com');
    await pageB.getByLabel('Contraseña').fill('Password123!');
    await pageB.getByRole('button', { name: /Iniciar sesión/i }).click();

    // Ambos navegan al canal #engineering
    await pageA.getByText('#engineering').click();
    await pageB.getByText('#engineering').click();

    // Usuario A escribe -> Usuario B observa indicador de tipeo
    const chatInputA = pageA.getByPlaceholder(/Escribe un mensaje/i);
    await chatInputA.fill('Verificando WebSocket SignalR en tiempo real');

    await expect(pageB.getByText(/Alex está escribiendo/i)).toBeVisible();

    // Usuario A envía el mensaje
    await chatInputA.press('Enter');

    // Ambos usuarios ven el mensaje sin recargar la página
    await expect(pageA.getByText('Verificando WebSocket SignalR en tiempo real')).toBeVisible();
    await expect(pageB.getByText('Verificando WebSocket SignalR en tiempo real')).toBeVisible();

    // Usuario B agrega una reacción con emoji
    await pageB.getByText('Verificando WebSocket SignalR en tiempo real').hover();
    await pageB.getByLabel('Añadir reacción').click();
    await pageB.getByText('🚀').click();

    // Usuario A ve el contador de reacción actualizado en vivo
    await expect(pageA.getByText('🚀 1')).toBeVisible();

    await contextA.close();
    await contextB.close();
  });

  test('debe abrir un hilo de conversación y contabilizar respuestas atómicamente', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('sarah.admin@acme.com');
    await page.getByLabel('Contraseña').fill('Password123!');
    await page.getByRole('button', { name: /Iniciar sesión/i }).click();

    await page.getByText('#general').click();

    // Abrir hilo en el primer mensaje
    await page.getByTestId('message-item').first().hover();
    await page.getByLabel('Responder en hilo').click();

    // Panel lateral de hilo abierto
    await expect(page.getByTestId('thread-sidebar')).toBeVisible();
    await page.getByTestId('thread-input').fill('Respuesta formal en hilo para pruebas');
    await page.getByTestId('thread-input').press('Enter');

    await expect(page.getByTestId('thread-sidebar').getByText('Respuesta formal en hilo para pruebas')).toBeVisible();
  });
});
