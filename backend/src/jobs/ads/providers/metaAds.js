import prisma from "../../../lib/prisma.js";
import { decrypt } from "../../../lib/crypto.js";

async function getCred(clientId, key) {
  const c = await prisma.clientCredential.findUnique({
    where: { clientId_platform_key: { clientId, platform: "META_ADS", key } },
  });
  return c ? decrypt(c.value) : null;
}

export async function fetchMetaAdsCampaigns(addereClientId) {
  const [accessToken, adAccountId] = await Promise.all([
    getCred(addereClientId, "access_token"),
    getCred(addereClientId, "ad_account_id"),
  ]);

  if (!accessToken || !adAccountId) {
    return { skipped: true, reason: "credenciais Meta Ads incompletas" };
  }

  const accountId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  const params = new URLSearchParams({
    fields: "campaign_id,campaign_name,impressions,clicks,spend,conversions,ctr,cpc,cpm",
    level: "campaign",
    date_preset: "yesterday",
    time_increment: "1",
    access_token: accessToken,
  });

  const res = await fetch(
    `https://graph.facebook.com/v22.0/${accountId}/insights?${params}`
  );
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Meta Ads API erro ${res.status}: ${txt.slice(0, 200)}`);
  }

  const data = await res.json();
  const rows = data.data ?? [];

  return rows.map((r) => ({
    campaignId: String(r.campaign_id),
    campaignName: r.campaign_name ?? "Sem nome",
    date: r.date_start,
    impressions: Number(r.impressions ?? 0),
    clicks: Number(r.clicks ?? 0),
    spendCents: Math.round(Number(r.spend ?? 0) * 100),
    conversions: Math.round(Number((r.conversions ?? [{}])[0]?.value ?? 0)),
    cpc: Math.round(Number(r.cpc ?? 0) * 100),
    cpm: Math.round(Number(r.cpm ?? 0) * 100),
    ctr: Number(r.ctr ?? 0) / 100,
  }));
}
