import { expect, test } from '@playwright/test';

/*
  A unique name per run. The API keeps agents in memory and the dev server is
  reused between runs, so a fixed name would collide with leftovers from an
  earlier failed run and trip Playwright's strict mode.
*/
const AGENT_NAME = `Smoke Agent ${Date.now()}`;

// Runs even when the test fails partway, so a failure leaves nothing behind.
test.afterEach(async ({ request }) => {
  const response = await request.get('http://localhost:4000/api/agents');
  const agents: { id: string; name: string }[] = await response.json();
  for (const agent of agents) {
    if (agent.name === AGENT_NAME) {
      await request.delete(`http://localhost:4000/api/agents/${agent.id}`);
    }
  }
});

test('configure an agent, then watch it run with its trace', async ({ page }) => {
  await page.goto('/agents');

  // The seed data loaded, and the API is reachable.
  await expect(page.getByRole('table', { name: 'Agents' })).toBeVisible();
  await expect(page.getByText('connected · mock')).toBeVisible();

  // Create an agent. It opens in the peek with its name ready to replace.
  await page.getByRole('button', { name: 'New agent' }).click();
  const peek = page.getByRole('dialog', { name: /^Agent / });
  await expect(peek).toBeVisible();

  const nameField = peek.getByRole('textbox', { name: 'Agent name' });
  await nameField.fill(AGENT_NAME);

  // Write a system prompt and confirm autosave reports itself.
  await peek
    .getByRole('textbox', { name: 'System prompt' })
    .fill('Answer in one short sentence.');
  await nameField.click();
  await expect(peek.getByText(/^Saved \d{2}:\d{2}:\d{2}$/)).toBeVisible();

  // Attach two tools through the picker.
  await peek.getByRole('button', { name: /Attach a tool|^Add$/ }).click();
  const picker = page.getByRole('dialog', { name: 'Attach tools' });
  await picker.getByRole('checkbox', { name: /Current time/ }).check();
  await picker.getByRole('checkbox', { name: /HTTP request/ }).check();
  await expect(picker.getByText('2 of 4 selected')).toBeVisible();
  await page.keyboard.press('Escape');

  await expect(peek.getByText('Current time')).toBeVisible();
  await expect(peek.getByText('HTTP request')).toBeVisible();

  // Activate it, then leave the peek.
  await peek.getByRole('combobox', { name: 'Status' }).selectOption('active');
  await peek.getByRole('button', { name: 'Close panel' }).click();
  await expect(page.getByRole('dialog', { name: /^Agent / })).toBeHidden();

  // The table reflects everything that was just configured.
  const row = page.getByRole('row', { name: new RegExp(AGENT_NAME) });
  await expect(row).toBeVisible();
  await expect(row.getByText('Active')).toBeVisible();

  // Survive a reload: the writes really reached the server.
  await page.reload();
  await expect(page.getByRole('row', { name: new RegExp(AGENT_NAME) })).toBeVisible();

  // Move to chat through the row menu.
  await page.getByRole('row', { name: new RegExp(AGENT_NAME) }).hover();
  await page.getByRole('button', { name: `Actions for ${AGENT_NAME}` }).click();
  await page.getByRole('button', { name: 'Test in chat' }).click();
  await expect(page).toHaveURL(/\/chat\//);

  // The empty state is derived from the tools that were just attached.
  await expect(
    page.getByRole('button', { name: 'What time is it in Tokyo right now?' }),
  ).toBeVisible();

  // Send a message and watch the staged reveal produce both nodes.
  const composer = page.getByRole('textbox', { name: `Message ${AGENT_NAME}` });
  await composer.fill('what time is it, and is the endpoint up?');
  await page.getByRole('button', { name: 'Send message' }).click();

  const timeNode = page.getByRole('button', { name: /Current time/ });
  const httpNode = page.getByRole('button', { name: /HTTP request/ });
  await expect(timeNode).toBeVisible();
  await expect(httpNode).toBeVisible({ timeout: 5000 });

  /*
    The answer only lands after the last node resolves. Scoped to the answer
    paragraph: a new agent has no canned answer, so it gets the fallback, and a
    looser match would also hit the JSON payload sitting collapsed in the DOM.
  */
  await expect(
    page.getByText(/Expand a step above/, { selector: 'p' }),
  ).toBeVisible({ timeout: 5000 });

  // Expanding a node reveals the actual payload.
  await expect(timeNode).toHaveAttribute('aria-expanded', 'false');
  await timeNode.click();
  await expect(timeNode).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText(/"timezone": "Asia\/Tokyo"/)).toBeVisible();

  // The failure path reports what happened and offers a way forward.
  await composer.fill('please fail this run');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText(/connection refused/).first()).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();

  // Clean up so a rerun against a warm server starts from the same place.
  await page.goto('/agents');
  await page.getByRole('row', { name: new RegExp(AGENT_NAME) }).hover();
  await page.getByRole('button', { name: `Actions for ${AGENT_NAME}` }).click();
  await page.getByRole('button', { name: 'Delete' }).click();
  await page
    .getByRole('dialog', { name: `Delete ${AGENT_NAME}` })
    .getByRole('button', { name: 'Delete' })
    .click();
  await expect(page.getByText('Agent deleted')).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(AGENT_NAME) })).toBeHidden();
});
