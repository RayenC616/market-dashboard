/* Calls the Cloudflare Worker proxy (see worker/) to trigger the daily-brief
   GitHub Actions workflow. TRIGGER_SECRET is visible in this page's source
   to anyone (same caveat as the login passwords elsewhere in this project)
   — it can only cause the Worker to dispatch this one workflow, since the
   real GitHub token never leaves the Worker. Set WORKER_URL after deploying
   (see worker/README.md); until then this button will show a clear error
   instead of silently failing. */

const WORKER_URL = ""; // e.g. "https://market-dashboard-brief-trigger.YOUR-SUBDOMAIN.workers.dev"
const TRIGGER_SECRET = "ePT5yrvegjDhSdH8wQSttcQmySJDzJ2Q";

async function triggerDailyBrief() {
  if (!WORKER_URL) {
    throw new Error("WORKER_URL이 설정되지 않았습니다. worker/README.md의 배포 절차를 먼저 진행하세요.");
  }
  const res = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "X-Trigger-Secret": TRIGGER_SECRET },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || data.detail || `요청 실패 (HTTP ${res.status})`);
  }
  return data;
}
