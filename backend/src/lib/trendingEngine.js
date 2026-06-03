import Parser from "rss-parser";

const rssParser = new Parser({ timeout: 10000 });

const NICHE_DEFAULTS = {
  direito: {
    rss: [
      { name: "Conjur", url: "https://www.conjur.com.br/rss.xml" },
      { name: "JOTA", url: "https://www.jota.info/feed" },
      { name: "Migalhas", url: "https://www.migalhas.com.br/rss/quentes" },
    ],
    subreddits: ["conselhojuridico", "direito"],
    youtubeQueries: ["direito trabalhista", "direitos do consumidor", "legislação brasileira"],
  },
  nutricao: {
    rss: [{ name: "CFN", url: "https://www.cfn.org.br/feed/" }],
    subreddits: ["alimentacaosaudavel"],
    youtubeQueries: ["nutrição saudável", "dieta emagrecimento", "alimentação funcional"],
  },
  arquitetura: {
    rss: [
      { name: "ArchDaily BR", url: "https://www.archdaily.com.br/br/feed" },
    ],
    subreddits: ["arquitetura", "designinteriores"],
    youtubeQueries: ["projeto arquitetônico", "decoração interiores", "reforma de apartamento"],
  },
  financas: {
    rss: [
      { name: "InfoMoney", url: "https://www.infomoney.com.br/feed/" },
      { name: "Valor Investe", url: "https://valorinveste.globo.com/feed/" },
    ],
    subreddits: ["investimentos", "financaspessoais", "brfinancas"],
    youtubeQueries: ["finanças pessoais", "investimentos brasil", "educação financeira"],
  },
  contabilidade: {
    rss: [
      { name: "Jornal Contábil", url: "https://jornalcontabil.com.br/feed/" },
      { name: "Portal Contábeis", url: "https://www.contabeis.com.br/rss/noticias/" },
    ],
    subreddits: ["contabilidade", "empreendedorismo"],
    youtubeQueries: ["contabilidade empresarial", "declaração imposto renda", "simples nacional mei"],
  },
  saude: {
    rss: [
      { name: "CFM Notícias", url: "https://portal.cfm.org.br/feed/" },
      { name: "Saúde Business", url: "https://saudebusiness.com/feed/" },
    ],
    subreddits: ["medicina", "saudemental"],
    youtubeQueries: ["saúde preventiva brasil", "medicina integrativa", "saúde pública"],
  },
  psicologia: {
    rss: [
      { name: "CFP Notícias", url: "https://site.cfp.org.br/feed/" },
      { name: "Psicologia Viva", url: "https://blog.psicologiaviva.com.br/feed/" },
    ],
    subreddits: ["psicologia", "saudemental"],
    youtubeQueries: ["saúde mental brasil", "terapia cognitiva comportamental", "ansiedade depressão tratamento"],
  },
  tecnologia: {
    rss: [
      { name: "Tecnoblog", url: "https://tecnoblog.net/feed/" },
      { name: "Olhar Digital", url: "https://olhardigital.com.br/feed/" },
      { name: "Manual do Usuário", url: "https://manualdousuario.net/feed/" },
    ],
    subreddits: ["brdev", "programacao", "startupbrasil"],
    youtubeQueries: ["tecnologia brasil", "inteligência artificial", "programação iniciante"],
  },
  marketing: {
    rss: [
      { name: "Rock Content", url: "https://rockcontent.com/br/blog/feed/" },
      { name: "Neil Patel BR", url: "https://neilpatel.com/br/feed/" },
      { name: "Resultados Digitais", url: "https://resultadosdigitais.com.br/blog/feed/" },
    ],
    subreddits: ["marketing", "empreendedorismo", "trafegopago"],
    youtubeQueries: ["marketing digital brasil", "tráfego pago google meta", "copywriting vendas"],
  },
  educacao: {
    rss: [
      { name: "Nova Escola", url: "https://novaescola.org.br/feed" },
      { name: "Porvir", url: "https://porvir.org/feed/" },
    ],
    subreddits: ["educacaobrasil", "professores"],
    youtubeQueries: ["educação brasil", "metodologias ativas ensino", "tecnologia educação"],
  },
  fitness: {
    rss: [
      { name: "CREF Blog", url: "https://www.crefsp.gov.br/rss" },
    ],
    subreddits: ["treinos", "fitness", "corrida"],
    youtubeQueries: ["treino funcional brasil", "musculação iniciante", "emagrecimento exercício"],
  },
  imoveis: {
    rss: [
      { name: "CRECI Notícias", url: "https://www.creci-go.gov.br/feed/" },
      { name: "Zap Imóveis Blog", url: "https://revista.zapimoveis.com.br/feed/" },
    ],
    subreddits: ["imoveis", "investimentos"],
    youtubeQueries: ["mercado imobiliário brasil", "como comprar imóvel", "investimento imóveis renda"],
  },
  beleza: {
    rss: [],
    subreddits: ["beleza", "maquiagem", "skincare"],
    youtubeQueries: ["skincare rotina brasil", "maquiagem passo a passo", "tratamentos estéticos"],
  },
  gastronomia: {
    rss: [
      { name: "Panelinha", url: "https://www.panelinha.com.br/feed" },
    ],
    subreddits: ["gastronomia", "cozinhando", "churrasco"],
    youtubeQueries: ["gastronomia brasileira tendências", "receitas virais", "restaurante gestão"],
  },
  moda: {
    rss: [],
    subreddits: ["moda", "streetwear"],
    youtubeQueries: ["moda brasil tendências", "estilo pessoal", "moda sustentável"],
  },
  veterinaria: {
    rss: [
      { name: "CFMV", url: "https://www.cfmv.gov.br/feed/" },
    ],
    subreddits: ["veterinaria", "pets", "caes"],
    youtubeQueries: ["saúde animal brasil", "cuidados pets", "medicina veterinária"],
  },
  odontologia: {
    rss: [
      { name: "CFO Notícias", url: "https://website.cfo.org.br/feed/" },
    ],
    subreddits: ["odontologia"],
    youtubeQueries: ["saúde bucal brasil", "clareamento dental", "implante dentário"],
  },
};

export function buildSources(client) {
  const niche = (client.niche ?? "generico").toLowerCase();
  const defaults = NICHE_DEFAULTS[niche] ?? { rss: [], subreddits: [], youtubeQueries: [] };
  const customRss = Array.isArray(client.rssSources) ? client.rssSources : [];
  const keywords = (client.keywords ?? []).slice(0, 3);
  return {
    rss: [...defaults.rss, ...customRss],
    subreddits: defaults.subreddits ?? [],
    youtubeQueries: [...(defaults.youtubeQueries ?? []), ...keywords].slice(0, 5),
  };
}

export function buildPrompt(client, signals) {
  const niche = client.niche ?? "geral";
  const audience = client.targetAudience ?? "público geral";
  const tone = client.contentTone ?? "informativo e acessível";
  const keywords = (client.keywords ?? []).join(", ") || "assuntos relevantes da área";
  const signalsBlock = signals.slice(0, 100).map((t, i) => `${i + 1}. ${t}`).join("\n");

  return `Você é um estrategista de conteúdo especializado em ${niche}.

Cliente: ${client.name}
Público-alvo: ${audience}
Tom: ${tone}
Palavras-chave: ${keywords}

Sinais de tendência coletados hoje:

${signalsBlock}

Gere exatamente 7 sugestões de post para Instagram. Para cada uma:
- title: título chamativo (máx 80 chars)
- hook: primeira frase que prende atenção (máx 120 chars)
- body: desenvolvimento (máx 300 chars)
- format: REEL | CAROUSEL | POST | STORIES
- reasoning: por que é relevante agora (máx 150 chars)
- sources: 1-3 sinais que inspiraram

Responda APENAS com JSON:
{"suggestions":[{"title":"...","hook":"...","body":"...","format":"...","reasoning":"...","sources":["..."]}]}`;
}

export async function fetchRssSignals(feeds) {
  const signals = [];
  await Promise.allSettled(
    feeds.map(async ({ name, url }) => {
      try {
        const feed = await rssParser.parseURL(url);
        (feed.items ?? []).slice(0, 15).forEach((item) => {
          if (item.title) signals.push(`[${name}] ${item.title}`);
        });
      } catch {
        // graceful degradation — feed indisponível
      }
    })
  );
  return signals;
}

export async function fetchRedditSignals(subreddits) {
  const signals = [];
  await Promise.allSettled(
    subreddits.map(async (sub) => {
      try {
        const res = await fetch(
          `https://www.reddit.com/r/${sub}/top.json?t=week&limit=10`,
          { headers: { "User-Agent": "AddereAdsControl/1.0" } }
        );
        if (!res.ok) return;
        const data = await res.json();
        (data?.data?.children ?? []).forEach(({ data: p }) => {
          if (p?.title) signals.push(`[Reddit r/${sub}] ${p.title}`);
        });
      } catch {
        // graceful degradation
      }
    })
  );
  return signals;
}

export async function fetchYoutubeSignals(queries, apiKey) {
  if (!apiKey) return [];
  const signals = [];
  await Promise.allSettled(
    queries.map(async (q) => {
      try {
        const params = new URLSearchParams({
          part: "snippet", type: "video", q,
          regionCode: "BR", maxResults: 5,
          relevanceLanguage: "pt", videoCategoryId: "22",
          key: apiKey,
        });
        const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
        if (!res.ok) return;
        const data = await res.json();
        (data.items ?? []).forEach((item) => {
          if (item.snippet?.title) signals.push(`[YouTube] ${item.snippet.title}`);
        });
      } catch {
        // graceful degradation
      }
    })
  );
  return signals;
}
