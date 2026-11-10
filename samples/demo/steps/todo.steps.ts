import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Given, When, Then } = createBdd();

const APP = `
<!doctype html>
<html>
  <body style="font-family: sans-serif; padding: 24px">
    <h1>Todos</h1>
    <form id="f"><input id="new" placeholder="What needs doing?" /><button>Add</button></form>
    <ul id="list"></ul>
    <script>
      document.getElementById('f').addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('new');
        const li = document.createElement('li');
        li.textContent = input.value;
        document.getElementById('list').appendChild(li);
        input.value = '';
      });
    </script>
  </body>
</html>`;

Given('I open the todo app', async ({ page }) => {
  await page.setContent(APP);
});

When('I add the todo {string}', async ({ page }, text: string) => {
  await page.getByPlaceholder('What needs doing?').fill(text);
  await page.getByRole('button', { name: 'Add' }).click();
});

Then(/^I see (\d+) todos?$/, async ({ page }, count: string) => {
  await expect(page.getByRole('listitem')).toHaveCount(Number(count), { timeout: 1000 });
});

Then('I see the todo {string}', async ({ page }, text: string) => {
  await expect(page.getByRole('listitem').filter({ hasText: text })).toBeVisible();
});
