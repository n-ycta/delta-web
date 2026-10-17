import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, request } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { createApps } from "../server/apps.mjs";
const hash = (b) => createHash("sha256").update(b).digest("hex");
test("app management verifies owner, origin, package hashes and serves no privileged APIs", async () => {
  const dir = await mkdtemp(join(tmpdir(), "delta-web-apps-"));
  const html = Buffer.from("<h1>Media</h1>");
  const bytes = Buffer.from(
    JSON.stringify({
      format: "delta-app-v1",
      manifest: {
        id: "dev.delta.media",
        name: "Media",
        version: "1",
        runtime: { execution: "web" },
        entry: "index.html",
        grants: [],
      },
      files: [
        {
          path: "index.html",
          sha256: hash(html),
          data: html.toString("base64"),
        },
      ],
    }),
  );
  let delivered = bytes;
  const catalog = [
    {
      id: "dev.delta.media",
      name: "Media",
      version: "1",
      asset:
        "https://github.com/n-ycta/delta-media/releases/download/test/media.delta-app",
      sha256: hash(bytes),
    },
  ];
  const seen = [];
  const apps = await createApps(
    { get url(){return base;} },
    { credential: () => undefined },
    {
      root: dir,
      noListen: true,
      catalog,
      authorize: async (token) => {
        seen.push(token);
        return { principal: { scopes: token === "owner" ? ["admin"] : [] } };
      },
      fetch: async () => new Response(delivered),
    },
  );
  const forwarded=[];
  const server = createServer(async(req,res)=>{
    if(req.url==='/v1/call'){
      let body='';for await(const chunk of req)body+=chunk;
      forwarded.push({authorization:req.headers.authorization,...JSON.parse(body)});
      res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({ok:true,result:{plays:3}}));return;
    }
    return apps.http(req,res,new URL(req.url,'http://localhost').pathname);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  await new Promise((r) => apps.staticServer.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + server.address().port;
  const api = (method, path, token = "owner", origin = base, extra = {}) =>
    fetch(base + "/apps/" + path, {
      method,
      headers: {
        authorization: "Bearer " + token,
        origin,
        "content-type": "application/json",
      },
      ...(method === "POST"
        ? { body: JSON.stringify({ id: "dev.delta.media", ...extra }) }
        : {}),
    });
  try {
    assert.equal((await api("GET", "catalog", "viewer")).status, 403);
    assert.equal(
      (await api("POST", "install", "owner", "https://untrusted.invalid"))
        .status,
      403,
    );
    assert.equal((await api("POST", "install")).status, 200);
    assert.equal((await api('POST','call','owner',base,{capability:'tokens.list'})).status,403);
    assert.equal((await api('POST','call','viewer',base,{capability:'media.stats'})).status,403);
    assert.equal((await api('POST','call','owner','https://untrusted.invalid',{capability:'media.stats'})).status,403);
    const mediaReply=await api('POST','call','owner',base,{capability:'media.stats'});
    assert.equal(mediaReply.status,200);assert.deepEqual(await mediaReply.json(),{plays:3});
    assert.deepEqual(forwarded,[{authorization:'Bearer owner',capability:'media.stats',args:{}}]);

    const launch = await (await api("POST", "launch")).json();
    assert.equal(
      new URL(launch.url).hostname,
      "deltaapp-dev-delta-media.localhost",
    );
    assert.notEqual(new URL(launch.url).origin, new URL(base).origin);
    const assetBase = "http://127.0.0.1:" + apps.staticServer.address().port;
    const headers = {
      host: "deltaapp-dev-delta-media.localhost:7711",
      authorization: "Bearer owner",
    };
    const staticFetch = (path) =>
      new Promise((resolve, reject) => {
        const req = request(assetBase + path, { headers }, (res) => {
          const parts = [];
          res.on("data", (b) => parts.push(b));
          res.on("end", () =>
            resolve(
              new Response(Buffer.concat(parts), {
                status: res.statusCode,
                headers: res.headers,
              }),
            ),
          );
        });
        req.on("error", reject);
        req.end();
      });
    const asset = await staticFetch("/index.html");
    assert.equal(asset.status, 200);
    assert.equal(await asset.text(), html.toString());
    assert(!asset.headers.has("set-cookie"));
    assert.match(
      asset.headers.get("content-security-policy"),
      /default-src 'none'/,
    );
    for (const path of [
      "/api/v1/call",
      "/.delta-manifest.json",
      "/%2e%2e/config.json",
    ])
      assert.equal((await staticFetch(path)).status, 404);
    assert.equal((await api("POST", "install")).status, 400);
    const next = JSON.parse(bytes.toString());
    next.manifest.version = "2";
    delivered = Buffer.from(JSON.stringify(next));
    catalog[0].version = "2";
    catalog[0].sha256 = hash(delivered);
    const before = await (await api("GET", "list")).json();
    assert.equal(before[0].version, "1");
    assert.equal(
      (await api("POST", "install", "viewer", base, { replace: true })).status,
      403,
    );
    assert.equal(
      (await api("POST", "install", "owner", base, { replace: true })).status,
      200,
    );
    const after = await (await api("GET", "list")).json();
    assert.equal(after[0].version, "2");
    assert.equal((await api("POST", "remove")).status, 200);
    assert.equal((await api("POST", "launch")).status, 400);
    assert(seen.every((v) => ["owner", "viewer"].includes(v)));
  } finally {
    await new Promise((r) => server.close(r));
    await new Promise((r) => apps.staticServer.close(r));
    await rm(dir, { recursive: true, force: true });
  }
});
