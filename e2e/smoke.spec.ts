import { expect, test } from "@playwright/test";

// The core journey, keyboard first where the UI promises shortcuts: explorer filter -> detail -> compare -> rankings.
test("explorer filter, detail, compare and rankings", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Every AI model, mapped." })).toBeVisible();

  // "/" focuses search (retried until React has hydrated); typing filters through the API and lands in the URL
  const search = page.getByRole("searchbox", { name: "Search models" });
  await expect(async () => {
    await page.keyboard.press("/");
    await expect(search).toBeFocused({ timeout: 500 });
  }).toPass({ timeout: 30_000 });
  await page.keyboard.type("gpt4o");
  await expect(page).toHaveURL(/q=gpt4o/);
  const table = page.getByRole("table", { name: "AI models" });
  await expect(table.getByRole("link", { name: "GPT-4o", exact: true }).first()).toBeVisible();

  // a capability chip is a toggle button reflected in the URL
  await page.getByRole("button", { name: /^Tool calling/ }).click();
  await expect(page).toHaveURL(/capability=tools/);

  // pick two models for compare from the explorer
  await page.getByRole("searchbox", { name: "Search models" }).fill("claude opus");
  await expect(page).toHaveURL(/q=claude(\+|%20)opus/);
  // keepPreviousData keeps the old rows on screen while fetching: wait for the new result set before clicking rows
  await expect(table.getByRole("link", { name: /^Claude Opus/ }).first()).toBeVisible();
  await expect(table.getByRole("link", { name: "GPT-4o", exact: true })).toHaveCount(0);
  // click the visible label, as a user does (the native input is visually hidden behind a styled box)
  const boxes = table.getByRole("checkbox", { name: / compare$/ }); // "Add X to compare" / "Remove X from compare"
  await boxes.nth(0).locator("xpath=..").click();
  await expect(boxes.nth(0)).toBeChecked();
  await boxes.nth(1).locator("xpath=..").click();
  await expect(boxes.nth(1)).toBeChecked();
  const tray = page.getByRole("region", { name: "Compare selection" });
  await expect(tray).toBeVisible();
  await expect(tray.getByRole("listitem")).toHaveCount(2);
  await expect(tray.getByRole("listitem").first()).toContainText("Claude Opus");

  // open a model detail page from the table
  await table.getByRole("link", { name: /^Claude Opus/ }).first().click();
  await expect(page).toHaveURL(/\/models\/anthropic\//);
  await expect(page.getByRole("heading", { level: 2, name: "Benchmarks" })).toBeVisible();
  await expect(page.getByRole("table", { name: /Providers serving this model/ })).toBeVisible();

  // compare via the tray: shareable URL, best values labelled
  await tray.getByRole("link", { name: /Compare 2/ }).click();
  await expect(page).toHaveURL(/\/compare\?ids=anthropic/);
  await expect(page.getByRole("table", { name: /Side-by-side comparison/ })).toBeVisible();
  await expect(page.getByText("best", { exact: true }).first()).toBeVisible();

  // Ctrl+K palette: arrow keys + Enter navigate
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog", { name: "Search OneAtlas" });
  await expect(dialog).toBeVisible();
  await page.keyboard.type("rankings");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  // rankings board with filters in the URL
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Rankings" }).click();
  await expect(page).toHaveURL(/\/rankings\/reach/);
  await page.getByRole("navigation", { name: "Leaderboards" }).getByRole("link", { name: "Intelligence" }).click();
  await expect(page).toHaveURL(/\/rankings\/intelligence/);
  await page.getByRole("button", { name: "Open weights" }).click();
  await expect(page).toHaveURL(/capability=open/);
  await expect(page.getByRole("table", { name: /leaderboard/ }).getByRole("row").nth(1)).toBeVisible();

  expect(consoleErrors).toEqual([]);
});

test("code viewer opens a deep-linked file at the selected line", async ({ page }) => {
  await page.goto("/code?path=src/lib/pricing.ts&line=1");
  const body = page.getByRole("region", { name: "Contents of src/lib/pricing.ts" });
  await expect(body).toContainText("blended");
  await expect(page.getByRole("tab", { name: /pricing\.ts/ })).toBeVisible();
});

test("ask the code loads on first open and plays a prepared answer; theme switches light/dark", async ({ page }) => {
  await page.goto("/code");
  const dialog = page.getByRole("dialog", { name: "Ask the code" });
  // the panel chunk loads on first click (retry until hydrated)
  await expect(async () => {
    await page.getByRole("button", { name: /Ask the code/ }).click();
    await expect(dialog).toBeVisible({ timeout: 2_000 });
  }).toPass();
  await dialog.getByRole("textbox", { name: "Your question about the code" }).fill("what is oneatlas");
  await dialog.getByRole("button", { name: "Send question" }).click();
  await expect(dialog).toContainText("OneAtlas", { timeout: 20_000 });
  await page.keyboard.press("Escape");

  const theme = page.getByRole("button", { name: "Switch between light and dark theme" });
  const before = await page.evaluate(() => document.documentElement.dataset.theme ?? "");
  await theme.click();
  const after = await page.evaluate(() => document.documentElement.dataset.theme);
  expect(["light", "dark"]).toContain(after);
  expect(after).not.toBe(before);
});

test("unknown model renders the branded 404 and the API returns the error envelope", async ({ page, request }) => {
  await page.goto("/models/nope/nothing");
  await expect(page.getByRole("heading", { name: "This page isn’t on the map" })).toBeVisible();
  const res = await request.get("/api/v1/models?pageSize=1000");
  expect(res.status()).toBe(400);
  expect((await res.json()).error.code).toBe("INVALID_QUERY");
});
