const https = require("https");

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function request(url, { method = "GET", body, maxRedirects = 5, timeout = 30000, retries = 3 } = {}) {
  const attempt = () =>
    new Promise((resolve, reject) => {
      const go = (u, depth) => {
        const ux = new URL(u);
        const opts = {
          method,
          hostname: ux.hostname,
          path: ux.pathname + ux.search,
          headers: { "User-Agent": UA, Accept: "*/*" },
          timeout,
        };
        if (body !== undefined) {
          opts.headers["Content-Type"] = "text/plain;charset=UTF-8";
        }
        const req = https.request(opts, (res) => {
          if (
            [301, 302, 303, 307, 308].includes(res.statusCode) &&
            res.headers.location &&
            depth < maxRedirects
          ) {
            res.resume();
            go(new URL(res.headers.location, u).toString(), depth + 1);
            return;
          }
          let data = "";
          res.on("data", (c) => (data += c));
          res.on("end", () => resolve({ status: res.statusCode, text: data }));
        });
        req.on("timeout", () => req.destroy(new Error("timeout")));
        req.on("error", reject);
        if (body !== undefined) req.write(body);
        req.end();
      };
      go(url, 0);
    });

  return (async () => {
    let lastErr;
    for (let i = 0; i < retries; i++) {
      try {
        const res = await attempt();
        if (res.status >= 400) {
          lastErr = new Error(`HTTP ${res.status}: ${res.text.slice(0, 120)}`);
          await sleep(i ? 2 ** i * 1000 : 1000);
          continue;
        }
        return res;
      } catch (e) {
        lastErr = e;
        await sleep(i ? 2 ** i * 1000 : 1000);
      }
    }
    throw lastErr;
  })();
}

async function getJson(url) {
  const r = await request(url);
  try {
    return JSON.parse(r.text);
  } catch {
    throw new Error(`HTTP ${r.status}: ${r.text.slice(0, 120)}`);
  }
}

async function postJson(url, data) {
  const r = await request(url, { method: "POST", body: JSON.stringify(data) });
  try {
    return JSON.parse(r.text);
  } catch {
    throw new Error(`HTTP ${r.status}: ${r.text.slice(0, 120)}`);
  }
}

module.exports = { request, getJson, postJson };