// migrate-amanda.js — Migra dados históricos Amanda → Addere
//
// Pré-requisito: criar o cliente Amanda na UI do Addere e copiar o clientId gerado.
//
// Uso (PowerShell):
//   $env:AMANDA_DATABASE_URL="postgresql://..."
//   $env:ADDERE_DATABASE_URL="postgresql://..."
//   $env:ADDERE_DIRECT_URL="postgresql://..."   # opcional se igual ao ADDERE_DATABASE_URL
//   $env:AMANDA_CLIENT_ID="clxxxxxxxxxxxxxxxx"
//   node backend/scripts/migrate-amanda.js
//
// Idempotente: pode ser executado mais de uma vez com segurança.
// Credenciais de plataforma (Google Ads, Meta, Instagram) NÃO são migradas — inserir via UI.

import pkg from "pg";
const { Pool } = pkg;
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

// ── Validar env ───────────────────────────────────────────────────────────────

const required = ["AMANDA_DATABASE_URL", "ADDERE_DATABASE_URL", "AMANDA_CLIENT_ID"];
for (const k of required) {
  if (!process.env[k]) {
    console.error(`[migrate] ERRO: variável de ambiente "${k}" é obrigatória`);
    process.exit(1);
  }
}

// Define DATABASE_URL/DIRECT_URL ANTES de instanciar PrismaClient
process.env.DATABASE_URL = process.env.ADDERE_DATABASE_URL;
process.env.DIRECT_URL = process.env.ADDERE_DIRECT_URL || process.env.ADDERE_DATABASE_URL;

const AMANDA_CLIENT_ID = process.env.AMANDA_CLIENT_ID;

// ── Conexões ──────────────────────────────────────────────────────────────────

const amandaPool = new Pool({ connectionString: process.env.AMANDA_DATABASE_URL });
const prisma = new PrismaClient();

// ── Helpers ───────────────────────────────────────────────────────────────────

function newId() {
  return crypto.randomUUID();
}

function log(msg) {
  process.stdout.write(`[migrate] ${msg}\n`);
}

function toMoneyCents(decimal) {
  if (decimal == null) return null;
  return Math.round(Number(decimal) * 100);
}

function mapLeadSource(src) {
  return (
    { GOOGLE_ADS: "OTHER", META_ADS: "OTHER", INSTAGRAM_ADS: "INSTAGRAM", ORGANIC: "OTHER", REFERRAL: "REFERRAL", SITE: "SITE", OTHER: "OTHER" }[src] ?? "OTHER"
  );
}

function mapLeadStatus(st) {
  return (
    { NEW: "NEW", CONTACTED: "CONTACTED", QUALIFIED: "QUALIFIED", WON: "CONVERTED", LOST: "LOST", ARCHIVED: "LOST" }[st] ?? "NEW"
  );
}

function mapAdPlatform(platform) {
  const p = (platform ?? "").toUpperCase();
  if (p.includes("GOOGLE")) return "GOOGLE_ADS";
  if (p.includes("META") || p.includes("FACEBOOK")) return "META_ADS";
  return null;
}

function mapSuggestionStatus(st) {
  return { PENDING: "PENDING", DONE: "DONE", DISMISSED: "REJECTED" }[st] ?? "PENDING";
}

function mapBoostStatus(st) {
  return { PENDING: "PENDING", APPLIED: "DONE", DISMISSED: "REJECTED" }[st] ?? "PENDING";
}

// ── Migração por tabela ───────────────────────────────────────────────────────

async function migrateInstagramPosts() {
  const { rows } = await amandaPool.query(`
    SELECT id, ig_post_id, media_type, caption, permalink, published_at,
           like_count, comments_count, reach, impressions
    FROM instagram_posts
    ORDER BY published_at ASC
  `);
  log(`InstagramPost: ${rows.length} registros no Amanda`);

  const idMap = {}; // amanda_id → addere_id
  let inserted = 0, existed = 0;

  for (const r of rows) {
    const existing = await prisma.instagramPost.findUnique({
      where: { clientId_postId: { clientId: AMANDA_CLIENT_ID, postId: r.ig_post_id } },
      select: { id: true },
    });

    if (existing) {
      idMap[r.id] = existing.id;
      existed++;
      continue;
    }

    const created = await prisma.instagramPost.create({
      data: {
        id: newId(),
        clientId: AMANDA_CLIENT_ID,
        postId: r.ig_post_id,
        mediaType: r.media_type,
        caption: r.caption ?? null,
        permalink: r.permalink ?? null,
        timestamp: new Date(r.published_at),
        likes: r.like_count ?? 0,
        comments: r.comments_count ?? 0,
        reach: r.reach ?? 0,
        impressions: r.impressions ?? 0,
      },
    });
    idMap[r.id] = created.id;
    inserted++;
  }

  log(`InstagramPost: ${inserted} inseridos, ${existed} já existiam`);
  return idMap;
}

async function migratePostAnalysis(igIdMap) {
  const { rows } = await amandaPool.query(`
    SELECT post_id, score, action, reasoning, suggestion
    FROM post_analyses
  `);
  log(`PostAnalysis: ${rows.length} registros no Amanda`);

  let inserted = 0, skipped = 0;
  for (const r of rows) {
    const adderePostId = igIdMap[r.post_id];
    if (!adderePostId) { skipped++; continue; }

    const exists = await prisma.postAnalysis.findUnique({
      where: { postId: adderePostId },
      select: { id: true },
    });
    if (exists) { skipped++; continue; }

    await prisma.postAnalysis.create({
      data: {
        id: newId(),
        postId: adderePostId,
        score: r.score ?? 0,
        strengths: r.action ? [r.action] : [],
        improvements: r.suggestion ? [r.suggestion] : [],
        reasoning: r.reasoning ?? null,
      },
    });
    inserted++;
  }
  log(`PostAnalysis: ${inserted} inseridos, ${skipped} ignorados (sem post IG ou já existia)`);
}

async function migrateContentSuggestions() {
  const count = await prisma.contentSuggestion.count({ where: { clientId: AMANDA_CLIENT_ID } });
  if (count > 0) {
    log(`ContentSuggestion: ${count} já existem para este cliente — pulando (re-executar após limpar manualmente se necessário)`);
    return;
  }

  const { rows } = await amandaPool.query(`
    SELECT theme, format, reasoning, status, created_at
    FROM content_suggestions
    ORDER BY created_at ASC
  `);
  log(`ContentSuggestion: ${rows.length} registros no Amanda`);

  for (const r of rows) {
    await prisma.contentSuggestion.create({
      data: {
        id: newId(),
        clientId: AMANDA_CLIENT_ID,
        title: r.theme,
        format: r.format,
        reasoning: r.reasoning ?? null,
        sources: [],
        status: mapSuggestionStatus(r.status),
        createdAt: new Date(r.created_at),
      },
    });
  }
  log(`ContentSuggestion: ${rows.length} inseridos`);
}

async function migrateBoostSuggestions(igIdMap) {
  const count = await prisma.boostSuggestion.count({ where: { clientId: AMANDA_CLIENT_ID } });
  if (count > 0) {
    log(`BoostSuggestion: ${count} já existem para este cliente — pulando`);
    return;
  }

  const { rows } = await amandaPool.query(`
    SELECT bs.post_id, bs.suggested_amount, bs.estimated_leads,
           bs.reasoning, bs.status, bs.created_at, ip.caption
    FROM boost_suggestions bs
    JOIN instagram_posts ip ON ip.id = bs.post_id
    ORDER BY bs.created_at ASC
  `);
  log(`BoostSuggestion: ${rows.length} registros no Amanda`);

  let inserted = 0, skipped = 0;
  for (const r of rows) {
    const adderePostId = igIdMap[r.post_id];
    if (!adderePostId) { skipped++; continue; }

    await prisma.boostSuggestion.create({
      data: {
        id: newId(),
        clientId: AMANDA_CLIENT_ID,
        postId: adderePostId,
        postCaption: r.caption ?? null,
        suggestedBudget: r.suggested_amount ?? 0,
        estimatedLeads: Math.round(Number(r.estimated_leads ?? 0)),
        reasoning: r.reasoning ?? null,
        status: mapBoostStatus(r.status),
        createdAt: new Date(r.created_at),
      },
    });
    inserted++;
  }
  log(`BoostSuggestion: ${inserted} inseridos, ${skipped} sem post IG correspondente`);
}

async function migrateCampaignDaily() {
  const { rows } = await amandaPool.query(`
    SELECT business_date, platform, campaign_id, campaign_name,
           spend, impressions, clicks, leads, cpc, ctr, created_at
    FROM campanhas_diarias
    ORDER BY business_date ASC
  `);
  log(`CampaignDaily: ${rows.length} registros no Amanda`);

  let inserted = 0, skipped = 0;
  for (const r of rows) {
    const platform = mapAdPlatform(r.platform);
    if (!platform) { skipped++; continue; }

    const campaignId = r.campaign_id || "unknown";
    const campaignName = r.campaign_name || "Desconhecido";
    const date = new Date(r.business_date);

    const exists = await prisma.campaignDaily.findUnique({
      where: { clientId_platform_campaignId_date: { clientId: AMANDA_CLIENT_ID, platform, campaignId, date } },
      select: { id: true },
    });
    if (exists) { skipped++; continue; }

    await prisma.campaignDaily.create({
      data: {
        id: newId(),
        clientId: AMANDA_CLIENT_ID,
        date,
        platform,
        campaignId,
        campaignName,
        impressions: r.impressions ?? 0,
        clicks: r.clicks ?? 0,
        spendCents: toMoneyCents(r.spend) ?? 0,
        conversions: r.leads ?? 0,
        cpc: toMoneyCents(r.cpc) ?? 0,
        cpm: 0,
        ctr: Number(r.ctr ?? 0),
      },
    });
    inserted++;
  }
  log(`CampaignDaily: ${inserted} inseridos, ${skipped} ignorados`);
}

async function migrateWeeklyReports() {
  const { rows } = await amandaPool.query(`
    SELECT week_start_date, week_end_date,
           what_worked, what_to_pause, where_to_scale, recommendations, created_at
    FROM relatorios_semanais
    ORDER BY week_start_date ASC
  `);
  log(`WeeklyReport: ${rows.length} registros no Amanda`);

  let inserted = 0, skipped = 0;
  for (const r of rows) {
    const weekStart = new Date(r.week_start_date);

    const exists = await prisma.weeklyReport.findUnique({
      where: { clientId_weekStart: { clientId: AMANDA_CLIENT_ID, weekStart } },
      select: { id: true },
    });
    if (exists) { skipped++; continue; }

    const insights = [
      r.what_worked ? `O que funcionou: ${r.what_worked}` : null,
      r.what_to_pause ? `O que pausar: ${r.what_to_pause}` : null,
      r.where_to_scale ? `Onde escalar: ${r.where_to_scale}` : null,
    ].filter(Boolean);

    await prisma.weeklyReport.create({
      data: {
        id: newId(),
        clientId: AMANDA_CLIENT_ID,
        weekStart,
        weekEnd: new Date(r.week_end_date),
        summary: null,
        insights,
        data: r.recommendations ?? null,
        createdAt: new Date(r.created_at),
      },
    });
    inserted++;
  }
  log(`WeeklyReport: ${inserted} inseridos, ${skipped} já existiam`);
}

async function migrateMonthlyGoals() {
  const { rows } = await amandaPool.query(`
    SELECT month, spend_goal, leads_goal, created_at
    FROM monthly_goals
    ORDER BY month ASC
  `);
  log(`MonthlyGoal: ${rows.length} registros no Amanda`);

  let inserted = 0, skipped = 0;
  for (const r of rows) {
    // "YYYY-MM" → primeiro dia do mês às 12h UTC (evita cruzar dia em BRT)
    const month = new Date(`${r.month}-01T12:00:00Z`);

    const exists = await prisma.monthlyGoal.findUnique({
      where: { clientId_month: { clientId: AMANDA_CLIENT_ID, month } },
      select: { id: true },
    });
    if (exists) { skipped++; continue; }

    await prisma.monthlyGoal.create({
      data: {
        id: newId(),
        clientId: AMANDA_CLIENT_ID,
        month,
        leadsGoal: r.leads_goal ?? null,
        budgetCents: toMoneyCents(r.spend_goal) ?? null,
      },
    });
    inserted++;
  }
  log(`MonthlyGoal: ${inserted} inseridos, ${skipped} já existiam`);
}

async function migrateLeads() {
  const count = await prisma.lead.count({ where: { clientId: AMANDA_CLIENT_ID } });
  if (count > 0) {
    log(`Lead: ${count} já existem para este cliente — pulando`);
    return;
  }

  const { rows } = await amandaPool.query(`
    SELECT name, email, phone, source, status, notes, monthly_fee_potential, created_at
    FROM leads
    ORDER BY created_at ASC
  `);
  log(`Lead: ${rows.length} registros no Amanda`);

  for (const r of rows) {
    await prisma.lead.create({
      data: {
        id: newId(),
        clientId: AMANDA_CLIENT_ID,
        name: r.name || "Desconhecido",
        phone: r.phone || "",
        email: r.email ?? null,
        source: mapLeadSource(r.source),
        status: mapLeadStatus(r.status),
        monthlyFeePotential: toMoneyCents(r.monthly_fee_potential) ?? null,
        notes: r.notes ?? null,
        createdAt: new Date(r.created_at),
      },
    });
  }
  log(`Lead: ${rows.length} inseridos`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  log("=== Migração Amanda → Addere ===");
  log(`clientId alvo: ${AMANDA_CLIENT_ID}`);

  const client = await prisma.client.findUnique({
    where: { id: AMANDA_CLIENT_ID },
    select: { name: true },
  });
  if (!client) {
    log(`ERRO: Cliente "${AMANDA_CLIENT_ID}" não encontrado no Addere. Crie-o pela UI primeiro.`);
    process.exit(1);
  }
  log(`Cliente encontrado: ${client.name}`);
  log("");

  const igIdMap = await migrateInstagramPosts();
  await migratePostAnalysis(igIdMap);
  await migrateContentSuggestions();
  await migrateBoostSuggestions(igIdMap);
  await migrateCampaignDaily();
  await migrateWeeklyReports();
  await migrateMonthlyGoals();
  await migrateLeads();

  log("");
  log("=== Concluído ===");
}

main()
  .catch((e) => {
    console.error("[migrate] FATAL:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await amandaPool.end();
    await prisma.$disconnect();
  });
