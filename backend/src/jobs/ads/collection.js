import prisma from "../../lib/prisma.js";
import { fetchGoogleAdsCampaigns } from "./providers/googleAds.js";
import { fetchMetaAdsCampaigns } from "./providers/metaAds.js";

async function upsertCampaigns(clientId, platform, rows) {
  let upserted = 0;
  for (const row of rows) {
    const dateObj = new Date(row.date + "T12:00:00Z");
    await prisma.campaignDaily.upsert({
      where: { clientId_platform_campaignId_date: { clientId, platform, campaignId: row.campaignId, date: dateObj } },
      create: { clientId, platform, campaignId: row.campaignId, campaignName: row.campaignName, date: dateObj,
        impressions: row.impressions, clicks: row.clicks, spendCents: row.spendCents,
        conversions: row.conversions, cpc: row.cpc, cpm: row.cpm, ctr: row.ctr },
      update: { campaignName: row.campaignName, impressions: row.impressions, clicks: row.clicks,
        spendCents: row.spendCents, conversions: row.conversions, cpc: row.cpc, cpm: row.cpm, ctr: row.ctr },
    });
    upserted++;
  }
  return upserted;
}

export async function collectAds(client) {
  const results = { google: { skipped: false, upserted: 0 }, meta: { skipped: false, upserted: 0 } };

  const [googleRows, metaRows] = await Promise.allSettled([
    fetchGoogleAdsCampaigns(client.id),
    fetchMetaAdsCampaigns(client.id),
  ]);

  if (googleRows.status === "fulfilled") {
    const data = googleRows.value;
    if (data.skipped) {
      results.google.skipped = true;
    } else {
      results.google.upserted = await upsertCampaigns(client.id, "GOOGLE_ADS", data);
    }
  } else {
    console.error(`[ads-collection][${client.slug}] Google Ads:`, googleRows.reason?.message);
    results.google.error = googleRows.reason?.message;
  }

  if (metaRows.status === "fulfilled") {
    const data = metaRows.value;
    if (data.skipped) {
      results.meta.skipped = true;
    } else {
      results.meta.upserted = await upsertCampaigns(client.id, "META_ADS", data);
    }
  } else {
    console.error(`[ads-collection][${client.slug}] Meta Ads:`, metaRows.reason?.message);
    results.meta.error = metaRows.reason?.message;
  }

  return results;
}
