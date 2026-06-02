import prisma from "../../../lib/prisma.js";
import { decrypt } from "../../../lib/crypto.js";

async function getCred(clientId, key) {
  const c = await prisma.clientCredential.findUnique({
    where: { clientId_platform_key: { clientId, platform: "GOOGLE_ADS", key } },
  });
  return c ? decrypt(c.value) : null;
}

async function getAccessToken(clientId, clientSecret, refreshToken) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`OAuth2 Google token refresh falhou: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

export async function fetchGoogleAdsCampaigns(addereClientId) {
  const [devToken, oauthClientId, oauthSecret, refreshToken, customerId, loginCustomerId] =
    await Promise.all([
      getCred(addereClientId, "developer_token"),
      getCred(addereClientId, "client_id"),
      getCred(addereClientId, "client_secret"),
      getCred(addereClientId, "refresh_token"),
      getCred(addereClientId, "customer_id"),
    ].concat([getCred(addereClientId, "login_customer_id")]));

  if (!devToken || !oauthClientId || !oauthSecret || !refreshToken || !customerId) {
    return { skipped: true, reason: "credenciais Google Ads incompletas" };
  }

  const accessToken = await getAccessToken(oauthClientId, oauthSecret, refreshToken);
  const cid = customerId.replace(/-/g, "");

  const query = `
    SELECT
      campaign.id, campaign.name,
      segments.date,
      metrics.impressions, metrics.clicks,
      metrics.cost_micros, metrics.conversions,
      metrics.ctr, metrics.average_cpc, metrics.average_cpm
    FROM campaign
    WHERE segments.date DURING YESTERDAY
      AND campaign.status != 'REMOVED'
  `;

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": devToken,
    "Content-Type": "application/json",
  };
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId.replace(/-/g, "");

  const res = await fetch(
    `https://googleads.googleapis.com/v17/customers/${cid}/googleAds:searchStream`,
    { method: "POST", headers, body: JSON.stringify({ query }) }
  );
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Google Ads API erro ${res.status}: ${txt.slice(0, 200)}`);
  }

  const lines = await res.text();
  const rows = [];
  for (const line of lines.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === "[" || trimmed === "]") continue;
    try {
      const parsed = JSON.parse(trimmed.replace(/,$/, ""));
      (parsed.results ?? []).forEach((r) => rows.push(r));
    } catch {
      // linha de streaming incompleta
    }
  }

  return rows.map((r) => ({
    campaignId: String(r.campaign.id),
    campaignName: r.campaign.name,
    date: r.segments.date,
    impressions: Number(r.metrics.impressions ?? 0),
    clicks: Number(r.metrics.clicks ?? 0),
    spendCents: Math.round(Number(r.metrics.costMicros ?? 0) / 10_000),
    conversions: Math.round(Number(r.metrics.conversions ?? 0)),
    cpc: Math.round(Number(r.metrics.averageCpc ?? 0) / 10_000),
    cpm: Math.round(Number(r.metrics.averageCpm ?? 0) / 10_000),
    ctr: Number(r.metrics.ctr ?? 0),
  }));
}
