/** Authenticated app management + a distinct asset-only origin for each application. */
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { readFile, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createRequire } from "node:module";
import { DeltaClient } from "./delta-sdk.mjs";
const require = createRequire(import.meta.url);
const ui = resolve(require.resolve("@delta/ui/package.json"), "..");
const { MAX_PACKAGE, installed, install, asset, mime, protocol, APP_CSP } =
  await import(pathToFileURL(join(ui, "scripts/app-runtime.mjs")));
export async function createApps(client, sessions, options = {}) {
  const catalog =
    options.catalog ||
    JSON.parse(await readFile(join(ui, "app-catalog.json"), "utf8"));
  const root = resolve(
    options.root || process.env.DATA_DIR || process.env.DELTA_DATA || "data",
    "apps",
  );
  const template =
    options.origin ||
    process.env.APP_PUBLIC_ORIGIN ||
    "http://{app}.localhost:7711";
  const originFor = (id) => {
    const u = new URL(template.replace("{app}", protocol(id)));
    if (
      u.username ||
      u.password ||
      u.pathname !== "/" ||
      u.search ||
      u.hash ||
      !["http:", "https:"].includes(u.protocol) ||
      (u.protocol !== "https:" && !u.hostname.endsWith(".localhost"))
    )
      throw Error("Secure per-app origin required");
    return u.origin;
  };
  const origins = new Map(
    catalog.map((m) => [new URL(originFor(m.id)).host, m.id]),
  );
  if (origins.size !== catalog.length)
    throw Error("Each app requires a distinct origin");
  let busy = false;
  const staticServer = createServer(async (req, res) => {
    try {
      const id = origins.get(req.headers.host);
      if (!id || !["GET", "HEAD"].includes(req.method))
        throw Error("unknown_app_host");
      const path =
        new URL(req.url, "http://localhost").pathname.slice(1) || "index.html";
      const file = await asset(root, id, path);
      res.writeHead(200, {
        "content-type": mime(path),
        "x-content-type-options": "nosniff",
        "content-security-policy":
          APP_CSP +
          "; frame-ancestors " +
          (process.env.PUBLIC_ORIGIN ||
            `http://localhost:${process.env.PORT || 7710} http://127.0.0.1:${process.env.PORT || 7710}`),
        "referrer-policy": "no-referrer",
        "cache-control": "no-cache",
      });
      res.end(req.method === "HEAD" ? undefined : await readFile(file));
    } catch (e) {
      options.onError?.(e);
      res.writeHead(404);
      res.end("App unavailable");
    }
  });
  if (!options.noListen)
    staticServer.listen(
      Number(process.env.APP_PORT || 7711),
      process.env.APP_HOST || "127.0.0.1",
    );
  async function authorize(req) {
    const token =
      req.headers.authorization?.replace(/^Bearer /, "") ||
      sessions.credential(req);
    if (!token) throw Error("unauthorized");
    const info = options.authorize
      ? await options.authorize(token)
      : await new DeltaClient(client.url, token).call("web.info");
    if (!info.principal?.scopes?.includes("admin")) throw Error("forbidden");
  }
  return {
    staticServer,
    close() {
      staticServer.close();
    },
    async http(req, res, path) {
      const reply = (status, value) => {
        res.writeHead(status, {
          "content-type": "application/json",
          "cache-control": "no-store",
        });
        res.end(JSON.stringify(value));
      };
      try {
        const consoleOrigin =
          process.env.PUBLIC_ORIGIN || "http://" + req.headers.host;
        if (
          (req.headers.origin && req.headers.origin !== consoleOrigin) ||
          req.headers["sec-fetch-site"] === "cross-site"
        )
          throw Error("forbidden");
        await authorize(req);
        const method = path.slice("/apps/".length);
        if (req.method === "GET" && method === "catalog") {
          reply(200, catalog);
          return;
        }
        if (req.method === "GET" && method === "list") {
          reply(
            200,
            await Promise.all(
              (await installed(root)).map(async (id) => {
                const item = catalog.find((m) => m.id === id);
                if (!item) return null;
                try {
                  const m = JSON.parse(
                    await readFile(
                      join(root, id, ".delta-manifest.json"),
                      "utf8",
                    ),
                  );
                  return { ...item, ...(m.ui ? { ui: m.ui } : {}) };
                } catch {
                  return item;
                }
              }),
            ).then((items) => items.filter(Boolean)),
          );
          return;
        }
        if (
          req.method !== "POST" ||
          !["install", "remove", "launch"].includes(method)
        ) {
          reply(405, { error: "method_not_allowed" });
          return;
        }
        if (req.headers.origin !== consoleOrigin) throw Error("forbidden");
        let text = "";
        for await (const c of req) {
          text += c;
          if (text.length > 4096) throw Error("body_limit");
        }
        const a = JSON.parse(text || "{}");
        const item = catalog.find((v) => v.id === a.id);
        if (!item) throw Error("unknown_app");
        if (method === "launch") {
          if (!(await installed(root)).includes(item.id))
            throw Error("not_installed");
          reply(200, {
            id: item.id,
            name: item.name,
            url: originFor(item.id) + "/index.html",
            grants: [],
          });
          return;
        }
        if (busy) throw Error("app_store_busy");
        busy = true;
        try {
          if (method === "remove") {
            await rm(join(root, item.id), { recursive: true, force: true });
            reply(200, { removed: true });
            return;
          }
          if (
            !item.asset.startsWith("https://github.com/n-ycta/") ||
            !item.asset.includes("/releases/download/")
          )
            throw Error("untrusted_release");
          const response = await (options.fetch || fetch)(item.asset, {
            signal: AbortSignal.timeout(120000),
            credentials: "omit",
          });
          if (!response.ok) throw Error("download_failed");
          const parts = [];
          let total = 0;
          for await (const b of response.body) {
            total += b.length;
            if (total > MAX_PACKAGE) throw Error("package_limit");
            parts.push(b);
          }
          reply(200, await install(root, Buffer.concat(parts), item));
        } finally {
          busy = false;
        }
      } catch (e) {
        const code = [
          "unauthorized",
          "forbidden",
          "unknown_app",
          "not_installed",
          "app_store_busy",
          "package_integrity",
          "manifest_mismatch",
        ].includes(e.message)
          ? e.message
          : "app_operation_failed";
        reply(
          code === "unauthorized" ? 401 : code === "forbidden" ? 403 : 400,
          { error: code },
        );
      }
    },
  };
}
