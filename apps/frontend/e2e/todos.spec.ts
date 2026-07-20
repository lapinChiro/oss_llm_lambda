import { expect, test } from '@playwright/test'

test('creates, toggles, and deletes a Todo through the UI and database-backed API', async ({ page }) => {
  const title = `Playwright database smoke ${Date.now()}`
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Todos' })).toBeVisible()
  await page.getByLabel('New todo').fill(title)
  await page.getByLabel('New todo').press('Enter')
  const checkbox = page.getByRole('checkbox', { name: title })
  await expect(checkbox).toBeVisible()
  await checkbox.check()
  await expect(checkbox).toBeChecked()
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: `Delete ${title}` }).click()
  await expect(page.getByText(title)).not.toBeVisible()
})
