const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || "/usr/local/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    const c = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    await c.addInitScript(() => {
      localStorage.setItem("delta.language", "ru");
      localStorage.setItem(
        "delta.console.connection",
        JSON.stringify({ mode: "http", baseUrl: "/api" }),
      );
      sessionStorage.setItem(
        "delta.console.connection.token",
        "fixture-ui-only",
      );
      localStorage.setItem(
        "delta.console.prefs",
        JSON.stringify({
          state: { theme: "dark", realNoticeHidden: true },
          version: 1,
        }),
      );
    });
    const p = await c.newPage(),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    let submitted;
    await p.route("**/api/v1/call", async (route) => {
      const { capability, args } = route.request().postDataJSON();
      let result = [];
      if (capability === "web.nodes_ssh_preflight")
        result = {
          ready: true,
          core: { version: "0.4.0", supported: true },
          ssh: {
            available: true,
            path: "/usr/bin/ssh",
            version: "OpenSSH_9.9p1",
          },
          errors: [],
          platform: "linux",
          checkedAt: Date.now(),
        };
      if (capability === "web.info")
        result = {
          name: "UI fixture",
          coreVersion: "0.4.0",
          apiVersion: "1",
          startedAt: Date.now(),
          features: [],
          principal: { name: "owner", role: "owner", scopes: ["admin"] },
        };
      if (capability === "web.nodes_ssh_probe")
        result = {
          ticket: "11111111-1111-4111-8111-111111111111",
          fingerprint: "SHA256:fixture-server-fingerprint",
          algorithm: "ssh-ed25519",
          expiresAt: Date.now() + 300000,
        };
      if (capability === "web.nodes_ssh_install") {
        submitted = args;
        result = { jobId: "22222222-2222-4222-8222-222222222222" };
      }
      if (capability === "web.nodes_ssh_status")
        result = {
          id: args.id,
          status: "complete",
          phase: "complete",
          host: "203.0.113.10",
          username: "root",
          trust: "mutual",
        };
      await route.fulfill({ json: { ok: true, result } });
    });
    await p.goto(
      (process.env.TEST_UI_URL || "http://127.0.0.1:17880") + "/#/nodes?pair=1",
    );
    await p.getByRole("dialog").waitFor();
    await p.getByPlaceholder("203.0.113.10").fill("203.0.113.10");
    await p
      .getByRole("button", { name: "Проверить ключ сервера", exact: true })
      .click();
    await p
      .getByText("SHA256:fixture-server-fingerprint", { exact: true })
      .waitFor();
    await p.getByLabel("Пароль", { exact: true }).fill("fixture-secret");
    const install = p.getByRole("button", {
      name: "Установить и подключить",
      exact: true,
    });
    assert(await install.isDisabled());
    await p.getByLabel("Я проверил отпечаток сервера").check();
    await p.locator("select").last().selectOption("mutual");
    assert(await install.isDisabled());
    await p.getByLabel(/Разрешить выбранный административный доступ/).check();
    assert(await install.isEnabled());
    await p.screenshot({
      path: "/data/ssh-wizard-desktop.png",
      fullPage: true,
    });
    await p.setViewportSize({ width: 390, height: 844 });
    await p.waitForTimeout(150);
    assert.equal(
      await p.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 2,
      ),
      false,
    );
    assert.equal(
      await p
        .locator(".modal")
        .evaluate((e) => e.scrollWidth > e.clientWidth + 2),
      false,
    );
    await p.screenshot({ path: "/data/ssh-wizard-mobile.png", fullPage: true });
    await install.click();
    await p.getByText("Сервер подключён", { exact: true }).waitFor();
    assert.equal(submitted.trust, "mutual");
    assert.equal(submitted.password, "fixture-secret");
    assert(
      !(await p.evaluate(
        () =>
          JSON.stringify(localStorage).includes("fixture-secret") ||
          JSON.stringify(sessionStorage).includes("fixture-secret"),
      )),
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: desktop/mobile SSH wizard, host confirmation and admin consent required, mutual trust submission, no browser-persisted credentials",
    );
    await c.close();
    const old = await browser.newContext({
      viewport: { width: 1100, height: 900 },
    });
    await old.addInitScript(() => {
      localStorage.setItem("delta.language", "ru");
      localStorage.setItem(
        "delta.console.connection",
        JSON.stringify({ mode: "http", baseUrl: "/api" }),
      );
      sessionStorage.setItem(
        "delta.console.connection.token",
        "fixture-ui-only",
      );
    });
    const q = await old.newPage();
    let upgraded = false,
      updates = 0,
      polls = 0;
    q.on("pageerror", (e) => errors.push(e.message));
    await q.route("**/api/v1/call", async (route) => {
      const { capability, args } = route.request().postDataJSON();
      let result = [];
      if (capability === "web.info")
        result = {
          name: "UI fixture",
          coreVersion: "0.3.4",
          apiVersion: "1",
          startedAt: Date.now(),
          features: [],
          principal: { name: "owner", role: "owner", scopes: ["admin"] },
        };
      if (capability === "web.nodes_ssh_preflight")
        result = {
          ready: upgraded,
          core: { version: upgraded ? "0.4.0" : "0.3.4", supported: upgraded },
          ssh: {
            available: true,
            path: "/usr/bin/ssh",
            version: "OpenSSH_9.9p1",
          },
          errors: upgraded ? [] : ["local_core_old"],
          platform: "linux",
          checkedAt: Date.now(),
        };
      if (capability === "web.updates_install") {
        assert.equal(args.target, "core");
        updates++;
        result = { accepted: true, jobId: "fixture-core-update" };
      }
      if (capability === "web.updates_status") {
        if (updates && ++polls > 1) upgraded = true;
        result = {
          settings: {},
          items: [],
          checking: false,
          lastCheckedAt: null,
          ...(updates
            ? {
                job: {
                  id: "fixture-core-update",
                  status: upgraded ? "complete" : "running",
                  items: [{ kind: "core" }],
                  startedAt: Date.now(),
                  updatedAt: Date.now(),
                  automatic: false,
                },
              }
            : {}),
        };
      }
      await route.fulfill({ json: { ok: true, result } });
    });
    await q.goto(
      (process.env.TEST_UI_URL || "http://127.0.0.1:17880") + "/#/nodes?pair=1",
    );
    await q.getByText("0.3.4", { exact: true }).waitFor();
    assert(
      await q
        .getByRole("button", { name: "Проверить ключ сервера", exact: true })
        .isDisabled(),
    );
    await q.getByRole("button", { name: "Обновить ядро", exact: true }).click();
    assert.equal(updates, 0, "opening confirmation must not install anything");
    await q.getByRole("button", { name: "Установить обновление", exact: true }).click();
    await q.getByText("0.4.0", { exact: true }).waitFor({ timeout: 15000 });
    assert.equal(updates, 1);
    assert.equal(upgraded, true);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: old core blocks SSH setup, direct core-only update requires confirmation, progress completion refreshes preflight",
    );
    await old.close();
  } finally {
    await browser.close();
  }
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
