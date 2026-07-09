/* Minimal proxy so the dashboard's "오늘의 브리프 생성" button can trigger the
 * daily-brief GitHub Actions workflow without ever exposing a GitHub token
 * to the browser. The token lives only as a Worker secret; the browser only
 * ever sees TRIGGER_SECRET, a narrow-purpose shared secret that can do
 * nothing except cause this one Worker to dispatch this one workflow.
 *
 * Setup (run once, from the worker/ directory, after `wrangler login`):
 *   wrangler secret put GITHUB_TOKEN
 *   wrangler secret put TRIGGER_SECRET
 *   wrangler deploy
 * Then put the deployed Worker URL and the same TRIGGER_SECRET value into
 * js/daily-brief-trigger.js on the dashboard side.
 */

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Trigger-Secret",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return json({ error: "POST only" }, 405, corsHeaders);
    }

    const provided = request.headers.get("X-Trigger-Secret") || "";
    if (!env.TRIGGER_SECRET || provided !== env.TRIGGER_SECRET) {
      return json({ error: "Unauthorized" }, 401, corsHeaders);
    }

    const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}` +
      `/actions/workflows/${env.WORKFLOW_FILE}/dispatches`;

    const ghResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
        "Accept": "application/vnd.github+json",
        "User-Agent": "market-dashboard-brief-trigger",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: env.GIT_REF || "main" }),
    });

    if (ghResponse.status === 204) {
      return json({ ok: true, message: "Daily brief workflow triggered." }, 200, corsHeaders);
    }

    const detail = await ghResponse.text();
    return json({ ok: false, status: ghResponse.status, detail }, 502, corsHeaders);
  },
};

function json(body, status, corsHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
