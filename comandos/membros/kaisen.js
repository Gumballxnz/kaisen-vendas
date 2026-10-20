// comandos/membros/kaisen.js
// KAISEN VENDAS PV — IA multi-provider para atendimento automático no privado
// Criador: Wilson Leonel

const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const gtts = require("node-gtts")("pt");
const ffmpeg = require("fluent-ffmpeg");

// FFmpeg do sistema Termux (pkg install ffmpeg)
try {
    ffmpeg.setFfmpegPath("/data/data/com.termux/files/usr/bin/ffmpeg");
} catch (e) {
    console.log("⚠️ FFmpeg não configurado — áudio pode falhar");
}

// ============================================================
// BOT INFO
// ============================================================
const NOME_IA = "KAISEN";
const CRIADOR = "Wilson Leonel";
const PROB_AUDIO = 0.25;

let ultimoErro = null;
function getUltimoErroKaisen() { return ultimoErro; }

// ============================================================
// CHAVES
// ============================================================
require("dotenv").config();

const CHAVES_GEMINI = [
    process.env.GEMINI_API_KEY
].filter(Boolean);

const CHAVES_GROQ = [
    process.env.GROQ_API_KEY
].filter(Boolean);

const CHAVES_OPENROUTER = [
    process.env.OPENROUTER_API_KEY
].filter(Boolean);

const CHAVES_MISTRAL = [
    process.env.MISTRAL_API_KEY
].filter(Boolean);

const CHAVES_SAMBANOVA = [
    process.env.SAMBANOVA_API_KEY
].filter(Boolean);

const MODELOS = {
    gemini: "gemini-flash-lite-latest",
    groq: "llama-3.3-70b-versatile",
    openrouter: "meta-llama/llama-3.3-70b-instruct:free",
    mistral: "mistral-small-latest",
    sambanova: "Meta-Llama-3.3-70B-Instruct"
};

const TAVILY_API_KEY = "";
const DONO_JID = "258843073346@s.whatsapp.net";

// ============================================================
// DB
// ============================================================
const DATABASE_DIR = path.join(__dirname, "../../database");
const KAISEN_DB = path.join(DATABASE_DIR, "kaisen.json");
const CONFIG_PATH = path.join(DATABASE_DIR, "config.json");
const PRODUTOS_DB = path.join(DATABASE_DIR, "produtos.json");
const TMP_DIR = path.join(DATABASE_DIR, "tmp");

if (!fs.existsSync(DATABASE_DIR)) fs.mkdirSync(DATABASE_DIR, { recursive: true });
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

const DB_VAZIO = {
    historico: {},
    audioAtivo: {},
    conversa: {},
    voz: {}
};

function lerDB() {
    try {
        if (!fs.existsSync(KAISEN_DB)) {
            fs.writeFileSync(KAISEN_DB, JSON.stringify(DB_VAZIO, null, 2));
            return JSON.parse(JSON.stringify(DB_VAZIO));
        }
        const d = fs.readFileSync(KAISEN_DB, "utf-8");
        if (!d.trim()) return JSON.parse(JSON.stringify(DB_VAZIO));
        const j = JSON.parse(d);
        for (const k of Object.keys(DB_VAZIO)) if (!j[k]) j[k] = {};
        return j;
    } catch { return JSON.parse(JSON.stringify(DB_VAZIO)); }
}

let _saveTimeout = null;
function salvarDB(db) {
    if (_saveTimeout) clearTimeout(_saveTimeout);
    _saveTimeout = setTimeout(() => {
        try { fs.writeFileSync(KAISEN_DB, JSON.stringify(db, null, 2)); } catch {}
    }, 500);
}

function audioAtivo(jid) { return lerDB().audioAtivo?.[jid] === true; }
function toggleAudio(jid) {
    const db = lerDB();
    db.audioAtivo[jid] = !db.audioAtivo[jid];
    salvarDB(db);
    return db.audioAtivo[jid];
}
function getVoz(jid) { return lerDB().voz?.[jid] || "auto"; }
function setVoz(jid, v) { const db = lerDB(); db.voz[jid] = v; salvarDB(db); }

// ============================================================
// DB PRODUTOS
// ============================================================
function lerProdutos() {
    try {
        if (!fs.existsSync(PRODUTOS_DB)) {
            fs.writeFileSync(PRODUTOS_DB, JSON.stringify({}, null, 2));
            return {};
        }
        const d = fs.readFileSync(PRODUTOS_DB, "utf-8");
        if (!d.trim()) return {};
        return JSON.parse(d);
    } catch { return {}; }
}
function salvarProdutos(db) {
    try { fs.writeFileSync(PRODUTOS_DB, JSON.stringify(db, null, 2)); return true; }
    catch { return false; }
}
function adicionarProduto(vendedor, produto) {
    const db = lerProdutos();
    if (!db[vendedor]) db[vendedor] = [];
    produto.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    produto.criadoEm = Date.now();
    db[vendedor].push(produto);
    salvarProdutos(db);
    return produto;
}
function listarProdutos(vendedor) {
    const db = lerProdutos();
    return db[vendedor] || [];
}
function removerProduto(vendedor, id) {
    const db = lerProdutos();
    if (!db[vendedor]) return false;
    const antes = db[vendedor].length;
    db[vendedor] = db[vendedor].filter(p => p.id !== id);
    salvarProdutos(db);
    return db[vendedor].length < antes;
}
function limparProdutos(vendedor) {
    const db = lerProdutos();
    delete db[vendedor];
    salvarProdutos(db);
}

// ============================================================
// VOZES
// ============================================================
const VOZES_LISTA = [
    { id: "auto", nome: "🔄 Automática", voz: null },
    { id: "duarte", nome: "🇵🇹 Duarte (H)", voz: "pt-PT-DuarteNeural" },
    { id: "raquel", nome: "🇵🇹 Raquel (M)", voz: "pt-PT-RaquelNeural" },
    { id: "antonio", nome: "🇧🇷 António (H)", voz: "pt-BR-AntonioNeural" },
    { id: "francisca", nome: "🇧🇷 Francisca (M)", voz: "pt-BR-FranciscaNeural" }
];

const VOZES_AUTO = [
    "pt-PT-DuarteNeural",
    "pt-PT-RaquelNeural",
    "pt-BR-AntonioNeural",
    "pt-BR-FranciscaNeural"
];
let vozIndex = 0;

function proximaVoz(jid) {
    const escolha = getVoz(jid);
    if (escolha !== "auto") {
        const v = VOZES_LISTA.find(x => x.id === escolha);
        if (v?.voz) return v.voz;
    }
    const v = VOZES_AUTO[vozIndex % VOZES_AUTO.length];
    vozIndex++;
    return v;
}

// ============================================================
// UTILITÁRIOS
// ============================================================
function carregarConfig() {
    try {
        const c = fs.existsSync(CONFIG_PATH) ? JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")) : {};
        return {
            prefixo: c.prefixo || ".",
            prefixosExtras: c.prefixosExtras || ["!", "#", "/"],
            canalLink: c.canalLink || "https://whatsapp.com/channel/0029VbAn6gZ9sBI8Ajxt4N36",
            footerPadrao: c.footerPadrao || "⚡ CyberHost • Bot Oficial"
        };
    } catch {
        return {
            prefixo: ".", prefixosExtras: ["!", "#", "/"],
            canalLink: "https://whatsapp.com/channel/0029VbAn6gZ9sBI8Ajxt4N36",
            footerPadrao: "⚡ CyberHost • Bot Oficial"
        };
    }
}

function isGrupo(jid) { return jid && jid.endsWith("@g.us"); }
function isPV(jid) { return jid && jid.endsWith("@s.whatsapp.net"); }

function getMessageContent(msg) {
    let m = msg.message || {};
    if (m.ephemeralMessage) m = m.ephemeralMessage.message;
    if (m.viewOnceMessage) m = m.viewOnceMessage.message;
    if (m.viewOnceMessageV2) m = m.viewOnceMessageV2.message;
    if (m.viewOnceMessageV2Extension) m = m.viewOnceMessageV2Extension.message;
    if (m.documentWithCaptionMessage) m = m.documentWithCaptionMessage.message;
    return m;
}

function obterTexto(msg) {
    const m = getMessageContent(msg);
    return (
        m.conversation ||
        m.extendedTextMessage?.text ||
        m.imageMessage?.caption ||
        m.videoMessage?.caption ||
        m.documentMessage?.caption ||
        ""
    ).trim();
}

function obterSender(sock, msg) {
    if (msg.key.fromMe) return sock.user?.id || msg.key.remoteJid;
    if (msg.key.participant) return msg.key.participant;
    return msg.key.remoteJid;
}

function numeroDoId(id) {
    return String(id || "").split("@")[0].split(":")[0].replace(/\D/g, "");
}

function obterImagem(msg) { return getMessageContent(msg).imageMessage || null; }
function obterVideo(msg) { return getMessageContent(msg).videoMessage || null; }
function obterAudio(msg) { return getMessageContent(msg).audioMessage || null; }

function getButtonId(msg) {
    try {
        const c = getMessageContent(msg);
        const native = c.interactiveResponseMessage?.nativeFlowResponseMessage;
        if (native?.paramsJson) {
            const p = JSON.parse(native.paramsJson);
            return String(p.id || p.button_id || p.selectedId || p.rowId || "").trim();
        }
        return String(
            c.buttonsResponseMessage?.selectedButtonId ||
            c.templateButtonReplyMessage?.selectedId || ""
        ).trim();
    } catch { return ""; }
}

// ============================================================
// DOWNLOAD MÍDIA
// ============================================================
async function baixarMidia(sock, msg) {
    try {
        const { downloadMediaMessage } = require("@whiskeysockets/baileys");
        return await downloadMediaMessage(msg, "buffer", {}, {
            logger: console,
            reuploadRequest: sock.updateMediaMessage
        });
    } catch (e) {
        console.log("Erro download mídia:", e.message);
        return null;
    }
}

// ============================================================
// THUMB VÍDEO
// ============================================================
async function extrairThumbVideo(buffer) {
    return new Promise((resolve) => {
        try {
            const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const tmpVid = path.join(TMP_DIR, `vo_${id}.mp4`);
            const tmpThumb = path.join(TMP_DIR, `vo_${id}.jpg`);
            fs.writeFileSync(tmpVid, buffer);
            ffmpeg(tmpVid)
                .screenshots({ count: 1, folder: TMP_DIR, filename: `vo_${id}.jpg`, size: "640x?" })
                .on("end", () => {
                    try {
                        const thumb = fs.readFileSync(tmpThumb);
                        try { fs.unlinkSync(tmpVid); } catch {}
                        try { fs.unlinkSync(tmpThumb); } catch {}
                        resolve(thumb);
                    } catch { resolve(null); }
                })
                .on("error", () => { try { fs.unlinkSync(tmpVid); } catch {} resolve(null); });
        } catch { resolve(null); }
    });
}

// ============================================================
// TRANSCRIÇÃO
// ============================================================
async function transcreverAudio(buffer) {
    if (!CHAVES_GROQ.length) return null;
    try {
        const form = new FormData();
        form.append("file", new Blob([buffer], { type: "audio/ogg" }), "audio.ogg");
        form.append("model", "whisper-large-v3");
        form.append("language", "pt");
        const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${CHAVES_GROQ[0]}` },
            body: form
        });
        if (!r.ok) return null;
        return (await r.json())?.text || null;
    } catch { return null; }
}

// ============================================================
// IMAGEM
// ============================================================
async function gerarImagem(prompt) {
    try {
        const p = String(prompt || "").trim().slice(0, 200);
        if (!p) return null;
        const seed = Math.floor(Math.random() * 1000000);
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(p)}?width=1024&height=1024&nologo=true&seed=${seed}`;
        const r = await fetch(url, { timeout: 60000 });
        if (!r.ok) return null;
        return Buffer.from(await r.arrayBuffer());
    } catch { return null; }
}

// ============================================================
// BUSCA WEB
// ============================================================
async function searchWeb(query) {
    if (!TAVILY_API_KEY || !query?.trim()) return null;
    try {
        const r = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                api_key: TAVILY_API_KEY,
                query: String(query).trim().slice(0, 400),
                search_depth: "basic",
                include_answer: true,
                max_results: 5
            })
        });
        if (!r.ok) return null;
        const d = await r.json();
        const p = [];
        if (d.answer) p.push("Resposta direta: " + d.answer);
        if (Array.isArray(d.results) && d.results.length) {
            p.push("Fontes:");
            d.results.slice(0, 5).forEach((x, i) => {
                p.push(`${i + 1}. ${x.title || "—"}\n${(x.content || "").slice(0, 300)}\n${x.url || ""}`);
            });
        }
        return p.length ? p.join("\n\n") : null;
    } catch { return null; }
}

// ============================================================
// CLIMA
// ============================================================
async function geocodificar(local) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(local)}&count=1&language=pt&format=json`;
    const r = await fetch(url);
    if (!r.ok) return null;
    return (await r.json())?.results?.[0] || null;
}

function descricaoCodigo(c) {
    const m = { 0: "Céu limpo ☀️", 1: "Principalmente limpo 🌤️", 2: "Parcialmente nublado ⛅",
        3: "Nublado ☁️", 45: "Nevoeiro 🌫️", 51: "Chuvisco leve 🌦️",
        61: "Chuva leve 🌧️", 63: "Chuva moderada 🌧️", 65: "Chuva forte 🌧️",
        80: "Aguaceiros 🌦️", 95: "Trovoada ⛈️" };
    return m[c] || "Condição desconhecida";
}

async function getClima(local) {
    try {
        const nome = (local || "").trim() || "Maputo";
        const geo = await geocodificar(nome);
        if (!geo) return `❌ Não encontrei "${nome}".`;
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${geo.latitude}&longitude=${geo.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=3`;
        const r = await fetch(url);
        if (!r.ok) return `❌ Erro clima de ${nome}.`;
        const d = await r.json();
        const c = d.current || {};
        const daily = d.daily || {};
        return `🌤️ *CLIMA EM ${geo.name.toUpperCase()}*\n────────────────\n\n` +
            `🌡️ Temperatura: ${c.temperature_2m ?? "?"}°C\n` +
            `🤔 Sensação: ${c.apparent_temperature ?? "?"}°C\n` +
            `☁️ Condição: ${descricaoCodigo(c.weather_code ?? 0)}\n` +
            `💧 Humidade: ${c.relative_humidity_2m ?? "?"}%\n` +
            `🌧️ Precipitação: ${c.precipitation ?? "?"} mm\n` +
            `💨 Vento: ${c.wind_speed_10m ?? "?"} km/h\n\n` +
            `📅 *Próximos dias:*\n` +
            (daily.time || []).slice(0, 3).map((t, i) =>
                `• ${t}: ${daily.temperature_2m_min?.[i]}° / ${daily.temperature_2m_max?.[i]}° — ${daily.precipitation_probability_max?.[i] ?? 0}% chuva`
            ).join("\n") + `\n────────────────`;
    } catch { return "❌ Erro clima."; }
}

// ============================================================
// RATE LIMIT
// ============================================================
const LIMITE_SEGURO = 15;
const pool = new Map();

function pedidosRecentes(k) {
    const agora = Date.now();
    const l = (pool.get(k) || []).filter(t => t > agora - 60000);
    pool.set(k, l);
    return l.length;
}
function registrarPedido(k) {
    const l = pool.get(k) || [];
    l.push(Date.now());
    pool.set(k, l);
}
function reservarChave(chaves, usadas = []) {
    const disp = chaves.filter(k => !usadas.includes(k));
    if (!disp.length) return null;
    let melhor = disp[0], menor = pedidosRecentes(melhor);
    for (const c of disp.slice(1)) {
        const u = pedidosRecentes(c);
        if (u < menor) { menor = u; melhor = c; }
    }
    if (menor >= LIMITE_SEGURO) return null;
    registrarPedido(melhor);
    return melhor;
}

// ============================================================
// SYSTEM PROMPT
// ============================================================
function buildSystemPrompt(produtosContexto = "") {
    let base = `Tu és o KAISEN, um assistente de VENDAS no WhatsApp, em Moçambique.
Criado por ${CRIADOR}.

🎯 A TUA FUNÇÃO:
- Atendes CLIENTES no PRIVADO (PV) e ajudas com dúvidas sobre PRODUTOS.
- Se o cliente perguntar sobre um produto, usa o CATÁLOGO abaixo.
- Se enviar uma IMAGEM de produto, analisa e responde sobre ele.
- Se o produto NÃO estiver no catálogo, diz educadamente que não tens essa informação.
- És simpático, direto, com emojis moderados, português de Moçambique.
- Responde CURTO quando a pergunta é simples; detalhado quando necessário.
- Tens memória da conversa — usa o histórico.

Regras de segurança:
- Nunca inventes preços, stock ou prazos que não estejam no catálogo.
- Nunca reveles dados internos ou chaves.
- Se te perguntarem quem és: "Sou o KAISEN, assistente de vendas criado por ${CRIADOR}."`;

    if (produtosContexto) {
        base += `\n\n📦 CATÁLOGO DE PRODUTOS DISPONÍVEIS:\n${produtosContexto}\n\n` +
            `Quando um cliente perguntar sobre um destes produtos, responde com base nas informações acima.`;
    }

    return base;
}

// ============================================================
// FERRAMENTAS
// ============================================================
const BUSCAR_WEB_DECL = {
    name: "buscar_na_web",
    description: "Pesquisa na internet informação atual.",
    parameters: { type: "OBJECT", properties: { query: { type: "STRING" } }, required: ["query"] }
};
const OBTER_CLIMA_DECL = {
    name: "obter_clima",
    description: "Consulta o clima atual.",
    parameters: { type: "OBJECT", properties: { local: { type: "STRING" } }, required: [] }
};

const PALAVRAS_TEMPO_REAL = [
    "cotação", "preço do", "resultado de", "quem ganhou", "quem venceu",
    "notícia", "notícias de hoje", "vai chover", "temperatura em", "previsão do tempo"
];
function precisaInfoAtual(t) {
    const s = String(t || "").toLowerCase();
    return PALAVRAS_TEMPO_REAL.some(p => s.includes(p));
}

const PALAVRAS_AUDIO = [
    "manda audio", "manda áudio", "envia audio", "envia áudio",
    "responde em audio", "responde em áudio", "fala", "diz em voz",
    "por audio", "por áudio", "em audio", "em áudio"
];
function pedeAudio(texto) {
    const s = String(texto || "").toLowerCase();
    return PALAVRAS_AUDIO.some(p => s.includes(p));
}

function construirMensagensOpenAI(userText, history, systemPrompt) {
    const msgs = [{ role: "system", content: systemPrompt }];
    for (const h of history) {
        msgs.push({ role: h.role === "assistant" ? "assistant" : "user", content: h.content });
    }
    msgs.push({ role: "user", content: userText });
    return msgs;
}

// ============================================================
// PROVIDERS
// ============================================================
async function chamarGemini(chave, contents, systemPrompt, tools, toolConfig) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELOS.gemini}:generateContent?key=${encodeURIComponent(chave)}`;
    const body = {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { temperature: 0.8, maxOutputTokens: 2048 }
    };
    if (tools) body.tools = tools;
    if (toolConfig) body.toolConfig = toolConfig;

    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 45000);
    let r;
    try {
        r = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: ctrl.signal
        });
    } finally { clearTimeout(to); }

    const data = await r.json();
    if (!r.ok) throw new Error(data?.error?.message || `Gemini HTTP ${r.status}`);

    const cand = data?.candidates?.[0];
    const fc = cand?.content?.parts?.find(p => p?.functionCall);
    if (fc) return { tipo: "tool", tool: fc.functionCall, raw: data };

    const texto = cand?.content?.parts?.map(p => p?.text || "").join("").trim();
    return { tipo: "texto", texto: texto || "" };
}

async function chamarOpenAICompat(url, chave, modelo, mensagens, extraHeaders = {}) {
    const r = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${chave}`,
            ...extraHeaders
        },
        body: JSON.stringify({
            model: modelo,
            messages: mensagens,
            temperature: 0.8,
            max_tokens: 2048
        })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error?.message || `HTTP ${r.status}`);
    return data?.choices?.[0]?.message?.content?.trim() || "";
}

const chamarGroq = (c, m) =>
    chamarOpenAICompat("https://api.groq.com/openai/v1/chat/completions", c, MODELOS.groq, m);
const chamarOpenRouter = (c, m) =>
    chamarOpenAICompat("https://openrouter.ai/api/v1/chat/completions", c, MODELOS.openrouter, m, {
        "HTTP-Referer": "https://kaisen.bot", "X-Title": "Kaisen"
    });
const chamarMistral = (c, m) =>
    chamarOpenAICompat("https://api.mistral.ai/v1/chat/completions", c, MODELOS.mistral, m);
const chamarSambaNova = (c, m) =>
    chamarOpenAICompat("https://api.sambanova.ai/v1/chat/completions", c, MODELOS.sambanova, m);

// ============================================================
// askKaisen
// ============================================================
async function askKaisen(prompt, ctx = {}) {
    const media = ctx?.media || null;
    if ((!prompt || !prompt.trim()) && !media) return "❌ Escreve algo.";

    const pushName = ctx?.pushName;
    const history = Array.isArray(ctx?.history) ? ctx.history : [];
    const produtosContexto = ctx?.produtosContexto || "";
    const effectiveText = (prompt || "").trim() || "Descreve esta imagem detalhadamente.";

    const systemPrompt = buildSystemPrompt(produtosContexto);

    const userText = pushName
        ? `[Cliente: ${pushName}]\n${effectiveText}`
        : effectiveText;

    const usadasGemini = [];
    while (usadasGemini.length < CHAVES_GEMINI.length) {
        const chave = reservarChave(CHAVES_GEMINI, usadasGemini);
        if (!chave) break;
        try {
            const lastUserParts = [{ text: userText }];
            if (media?.base64 && media?.mimetype) {
                lastUserParts.push({ inlineData: { mimeType: media.mimetype, data: media.base64 } });
            }
            const contents = [
                ...history.map(t => ({
                    role: t.role === "assistant" ? "model" : "user",
                    parts: [{ text: t.content }]
                })),
                { role: "user", parts: lastUserParts }
            ];

            const temBusca = !!TAVILY_API_KEY;
            const forcarBusca = temBusca && precisaInfoAtual(effectiveText);
            const tools = [{
                functionDeclarations: [OBTER_CLIMA_DECL, ...(temBusca ? [BUSCAR_WEB_DECL] : [])]
            }];
            const toolConfig = forcarBusca
                ? { functionCallingConfig: { mode: "ANY", allowedFunctionNames: temBusca ? ["buscar_na_web", "obter_clima"] : ["obter_clima"] } }
                : undefined;

            const r1 = await chamarGemini(chave, contents, systemPrompt, tools, toolConfig);

            if (r1.tipo === "tool") {
                const nome = r1.tool.name;
                const args = r1.tool.args || {};
                let resultado;
                if (nome === "obter_clima") resultado = await getClima(args.local);
                else resultado = (await searchWeb(args.query || effectiveText)) || "Sem resultado.";

                const c2 = [
                    ...contents,
                    { role: "model", parts: [{ functionCall: r1.tool }] },
                    { role: "user", parts: [{ functionResponse: { name: nome, response: { content: resultado } } }] }
                ];
                const r2 = await chamarGemini(chave, c2, systemPrompt, tools);
                if (r2.tipo === "texto" && r2.texto) return r2.texto;
            } else if (r1.texto) {
                return r1.texto;
            }
        } catch (e) {
            ultimoErro = `[Gemini] ${e.message}`;
            usadasGemini.push(chave);
        }
    }

    const mensagens = construirMensagensOpenAI(userText, history, systemPrompt);
    const fallbacks = [
        { nome: "Groq", chaves: CHAVES_GROQ, fn: chamarGroq },
        { nome: "OpenRouter", chaves: CHAVES_OPENROUTER, fn: chamarOpenRouter },
        { nome: "Mistral", chaves: CHAVES_MISTRAL, fn: chamarMistral },
        { nome: "SambaNova", chaves: CHAVES_SAMBANOVA, fn: chamarSambaNova }
    ];

    for (const prov of fallbacks) {
        for (const chave of prov.chaves) {
            try {
                const resposta = await prov.fn(chave, mensagens);
                if (resposta) return resposta;
            } catch (e) {
                ultimoErro = `[${prov.nome}] ${e.message}`;
            }
        }
    }
    return null;
}

// ============================================================
// ÁUDIO
// ============================================================
const TTS_CACHE = new Map();

function limparParaTTS(texto) {
    let t = String(texto || "");
    t = t.replace(/```[\s\S]*?```/g, " ");
    t = t.replace(/`([^`]+)`/g, "$1");
    t = t.replace(/\*\*([^*]+)\*\*/g, "$1");
    t = t.replace(/\*([^*]+)\*/g, "$1");
    t = t.replace(/__([^_]+)__/g, "$1");
    t = t.replace(/_([^_]+)_/g, "$1");
    t = t.replace(/~~([^~]+)~~/g, "$1");
    t = t.replace(/https?:\/\/\S+/gi, " ");
    t = t.replace(/www\.\S+/gi, " ");
    t = t.replace(/@\d{6,}/g, " ");
    t = t.replace(/@\w+/g, " ");
    t = t.replace(/[\u{1F000}-\u{1FFFF}]/gu, " ");
    t = t.replace(/[\u{2600}-\u{27BF}]/gu, " ");
    t = t.replace(/[\u{2190}-\u{21FF}]/gu, " ");
    t = t.replace(/[\u{2B00}-\u{2BFF}]/gu, " ");
    t = t.replace(/[\u{FE00}-\u{FE0F}]/gu, " ");
    t = t.replace(/[•▪️▫️◆◇■□▲▼►◄→←↑↓]/g, " ");
    t = t.replace(/[★☆♥♡✓✔✗✘]/g, " ");
    t = t.replace(/[│┃┆┇┊┋╎╏]/g, " ");
    t = t.replace(/[─━═┄┅┈┉╌╍]/g, " ");
    t = t.replace(/[╭╮╯╰┌┐└┘├┤┬┴┼]/g, " ");
    t = t.replace(/\bkm\/h\b/gi, "quilómetros por hora");
    t = t.replace(/\b°C\b/g, " graus Celsius ");
    t = t.replace(/\b%/g, " por cento ");
    t = t.replace(/\bvs\.?\b/gi, " contra ");
    t = t.replace(/["""'']/g, "");
    t = t.replace(/[(){}[\]]/g, " ");
    t = t.replace(/[<>«»]/g, " ");
    t = t.replace(/\s*\.\s*/g, ". ");
    t = t.replace(/\s*,\s*/g, ", ");
    t = t.replace(/\s*!\s*/g, "! ");
    t = t.replace(/\s*\?\s*/g, "? ");
    t = t.replace(/\s*:\s*/g, ": ");
    t = t.replace(/\s*;\s*/g, ". ");
    t = t.replace(/^\s*[-–—*]\s*/gm, "");
    t = t.replace(/\n{2,}/g, ". ");
    t = t.replace(/\n/g, ", ");
    t = t.replace(/\s+/g, " ").trim();
    if (t && !/[.!?]$/.test(t)) t += ".";
    if (t.length > 500) {
        t = t.slice(0, 500);
        const ultimoPonto = Math.max(t.lastIndexOf("."), t.lastIndexOf("!"), t.lastIndexOf("?"));
        if (ultimoPonto > 200) t = t.slice(0, ultimoPonto + 1);
    }
    return t;
}

async function gerarAudioRealista(texto, jid) {
    return new Promise(async (resolve) => {
        try {
            const textoLimpo = limparParaTTS(texto);
            if (!textoLimpo || textoLimpo.length < 2) return resolve(null);
            if (TTS_CACHE.has(textoLimpo)) return resolve(TTS_CACHE.get(textoLimpo));

            const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const mp3File = path.join(TMP_DIR, `tts_${id}.mp3`);
            const oggFile = path.join(TMP_DIR, `tts_${id}.ogg`);

            const textoEscapado = textoLimpo
                .replace(/\\/g, "\\\\")
                .replace(/"/g, '\\"')
                .replace(/\$/g, "\\$")
                .replace(/`/g, "\\`");

            const voz = proximaVoz(jid);
            const cmd = `npx -y msedge-tts --voice "${voz}" --text "${textoEscapado}" --write-media "${mp3File}"`;

            exec(cmd, { timeout: 25000 }, async (err) => {
                let mp3Ok = !err && fs.existsSync(mp3File) && fs.statSync(mp3File).size > 100;

                if (!mp3Ok) {
                    await new Promise((res) => { gtts.save(mp3File, textoLimpo, (e) => res(!e)); });
                    mp3Ok = fs.existsSync(mp3File) && fs.statSync(mp3File).size > 100;
                }
                if (!mp3Ok) return resolve(null);

                ffmpeg(mp3File)
                    .audioCodec("libopus").format("ogg").audioBitrate("48k")
                    .audioChannels(1).audioFrequency(48000)
                    .on("end", () => {
                        try {
                            const buf = fs.readFileSync(oggFile);
                            try { fs.unlinkSync(mp3File); } catch {}
                            try { fs.unlinkSync(oggFile); } catch {}
                            if (!buf || buf.length < 100) return resolve(null);
                            if (TTS_CACHE.size > 50) TTS_CACHE.clear();
                            TTS_CACHE.set(textoLimpo, buf);
                            resolve(buf);
                        } catch { resolve(null); }
                    })
                    .on("error", () => { try { fs.unlinkSync(mp3File); } catch {} resolve(null); })
                    .save(oggFile);
            });
        } catch { resolve(null); }
    });
}

// ============================================================
// ENVIO INTERATIVO
// ============================================================
async function enviarInterativo(sock, jid, texto, botoes, quotedMsg, mentions = []) {
    const cfg = carregarConfig();
    try {
        let gwc;
        const pkgs = ["baileys", "@whiskeysockets/baileys", "@adiwajshing/baileys"];
        for (const pkg of pkgs) {
            try {
                const mod = require(pkg);
                gwc = mod.generateWAMessageFromContent || mod.Utils?.generateWAMessageFromContent;
                if (gwc) break;
            } catch {}
        }
        const interactiveMessage = {
            body: { text: texto },
            footer: { text: cfg.footerPadrao },
            contextInfo: mentions.length ? { mentionedJid: mentions } : undefined,
            nativeFlowMessage: { buttons: botoes || [] }
        };
        const mensagem = gwc ? gwc(jid, { interactiveMessage }, { quoted: quotedMsg }) : null;
        if (mensagem && sock.relayMessage) {
            await sock.relayMessage(jid, mensagem.message, {
                messageId: mensagem.key.id,
                additionalNodes: [{
                    tag: "biz", attrs: {},
                    content: [{
                        tag: "interactive",
                        attrs: { type: "native_flow", v: "1" },
                        content: [{ tag: "native_flow", attrs: { v: "9", name: "mixed" } }]
                    }]
                }]
            });
            return true;
        }
    } catch (e) { console.error("Botões falharam:", e.message); }
    try { await sock.sendMessage(jid, { text: texto, mentions }, { quoted: quotedMsg }); }
    catch (e) { console.error("Texto falhou:", e.message); }
    return false;
}

// ============================================================
// BOTÕES PV
// ============================================================
function botoesPV(jid) {
    const cfg = carregarConfig();
    const audio = audioAtivo(jid);
    const vozAtual = VOZES_LISTA.find(v => v.id === getVoz(jid))?.nome || "🔄 Automática";

    return [
        {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
                display_text: audio ? "🔇 DESLIGAR ÁUDIO" : "🎤 LIGAR ÁUDIO",
                id: "kaisen_audio_toggle"
            })
        },
        {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
                display_text: `🎙️ VOZ: ${vozAtual}`,
                id: "kaisen_voz_menu"
            })
        },
        {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
                display_text: "🛍️ VER PRODUTOS",
                id: "kaisen_ver_produtos"
            })
        },
        {
            name: "cta_url",
            buttonParamsJson: JSON.stringify({
                display_text: "📢 VER CANAL",
                url: cfg.canalLink
            })
        }
    ];
}

function menuPV(jid) {
    const audio = audioAtivo(jid);
    const voz = VOZES_LISTA.find(v => v.id === getVoz(jid))?.nome || "🔄 Automática";
    const produtos = listarProdutos(jid).length;

    return (
        `🤖 *${NOME_IA} — VENDAS PV*\n────────────────\n\n` +
        `👤 *Criador:* ${CRIADOR}\n` +
        `💬 *Modo:* Atendimento no Privado\n` +
        `🎤 *Áudio:* ${audio ? "🔊 Ligado" : "🔇 Desligado"}\n` +
        `🎙️ *Voz:* ${voz}\n` +
        `📦 *Produtos:* ${produtos}\n\n` +
        `💡 *Comandos úteis:*\n` +
        `• \`.ia-add Nome | Preço | Descrição\` — Adicionar produto (responde a uma foto)\n` +
        `• \`.ia-list\` — Listar os teus produtos\n` +
        `• \`.ia-del <id>\` — Remover produto\n` +
        `• \`.ia-clear\` — Limpar catálogo\n` +
        `• \`.ia-help\` — Este menu\n` +
        `────────────────`
    );
}

// ============================================================
// ADICIONAR PRODUTO
// ============================================================
async function processarAddProduto(sock, msg, from, sender, resto) {
    const imgMsg = obterImagem(msg);

    if (!imgMsg) {
        await sock.sendMessage(from, {
            text:
                `📦 *ADICIONAR PRODUTO*\n────────────────\n\n` +
                `Para adicionar um produto, envia uma *FOTO* do produto com a legenda:\n\n` +
                `\`.ia-add Nome do Produto | Preço | Descrição\`\n\n` +
                `📌 *Exemplo:*\n` +
                `\`.ia-add Ténis Nike Air | 2500 MZN | Tamanho 38-44, original\``
        }, { quoted: msg });
        return true;
    }

    const buf = await baixarMidia(sock, msg);
    if (!buf) {
        await sock.sendMessage(from, { text: "❌ Não consegui processar a imagem." }, { quoted: msg });
        return true;
    }

    const partes = (resto || "").split("|").map(p => p.trim());
    if (partes.length < 1 || !partes[0]) {
        await sock.sendMessage(from, {
            text: "❌ Formato inválido.\nUse: `.ia-add Nome | Preço | Descrição`"
        }, { quoted: msg });
        return true;
    }

    const nome = partes[0];
    const preco = partes[1] || "Sob consulta";
    const descricao = partes[2] || "Sem descrição";

    const imagemBase64 = buf.toString("base64");
    const mimetype = imgMsg.mimetype || "image/jpeg";

    const imgId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const ext = mimetype.includes("png") ? "png" : "jpg";
    const imgPath = path.join(TMP_DIR, `produto_${imgId}.${ext}`);
    try { fs.writeFileSync(imgPath, buf); } catch {}

    const produto = adicionarProduto(sender, {
        nome, preco, descricao,
        imagemBase64, mimetype, imagemPath: imgPath
    });

    const texto =
        `✅ *PRODUTO ADICIONADO!*\n────────────────\n\n` +
        `📦 *Nome:* ${nome}\n` +
        `💰 *Preço:* ${preco}\n` +
        `📝 *Descrição:* ${descricao}\n` +
        `🆔 *ID:* \`${produto.id}\`\n\n` +
        `💡 A IA vai agora usar este produto para responder clientes!\n` +
        `────────────────`;

    try {
        await sock.sendMessage(from, { image: buf, caption: texto }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(from, { text: texto }, { quoted: msg });
    }

    console.log(`📦 [PRODUTO] ${sender} adicionou: ${nome} (${produto.id})`);
    return true;
}

// ============================================================
// LISTAR PRODUTOS
// ============================================================
async function listarProdutosComImagens(sock, msg, from, sender) {
    const lista = listarProdutos(sender);
    if (!lista.length) {
        await sock.sendMessage(from, {
            text: "📦 Ainda não tens produtos adicionados.\n\nUsa `.ia-add Nome | Preço | Descrição` com uma foto."
        }, { quoted: msg });
        return true;
    }

    await sock.sendMessage(from, {
        text: `📦 *OS TEUS PRODUTOS (${lista.length})*`
    }, { quoted: msg });

    for (const p of lista.slice(0, 10)) {
        try {
            const buf = Buffer.from(p.imagemBase64 || "", "base64");
            if (buf.length > 0) {
                await sock.sendMessage(from, {
                    image: buf,
                    caption:
                        `📦 *${p.nome}*\n` +
                        `💰 ${p.preco}\n` +
                        `📝 ${p.descricao}\n` +
                        `🆔 \`${p.id}\``
                });
            } else {
                await sock.sendMessage(from, {
                    text: `📦 *${p.nome}*\n💰 ${p.preco}\n📝 ${p.descricao}\n🆔 \`${p.id}\``
                });
            }
        } catch {
            await sock.sendMessage(from, {
                text: `📦 *${p.nome}*\n💰 ${p.preco}\n📝 ${p.descricao}\n🆔 \`${p.id}\``
            });
        }
    }
    return true;
}

// ============================================================
// CONTEXTO DE PRODUTOS PARA A IA
// ============================================================
function construirContextoProdutos(sender) {
    const lista = listarProdutos(sender);
    if (!lista.length) return "";
    return lista.map((p, i) =>
        `${i + 1}. *${p.nome}* — Preço: ${p.preco}\n   Descrição: ${p.descricao}\n   ID: ${p.id}`
    ).join("\n");
}

// ============================================================
// PROCESSAR MENSAGEM — APENAS PV
// ============================================================
const PROCESSADOS = new Set();
const ultimaResposta = new Map();

async function processarMensagem(sock, msg) {
    if (!msg || !msg.message) return false;
    if (msg.key.fromMe) return false;
    if (msg.key.remoteJid === "status@broadcast") return false;

    const from = msg.key.remoteJid;

    // ⛔ SÓ PV
    if (isGrupo(from)) return false;
    if (!isPV(from)) return false;

    const id = msg.key.id;
    if (!id) return false;
    if (PROCESSADOS.has(id)) return false;
    PROCESSADOS.add(id);
    setTimeout(() => PROCESSADOS.delete(id), 4000);

    const texto = obterTexto(msg);
    const textoLower = texto.toLowerCase().trim();
    const sender = obterSender(sock, msg);

    const cfg = carregarConfig();
    const prefixo = cfg.prefixo || ".";
    const prefixos = [prefixo].concat(cfg.prefixosExtras || []).filter(Boolean);

    // ========================================================
    // BOTÕES
    // ========================================================
    const buttonId = getButtonId(msg);
    if (buttonId) {
        if (buttonId === "kaisen_audio_toggle") {
            toggleAudio(from);
            await enviarInterativo(sock, from, menuPV(from), botoesPV(from), msg);
            return true;
        }
        if (buttonId === "kaisen_voz_menu") {
            let txt = `🎙️ *ESCOLHER VOZ*\n────────────────\n\nVoz atual: *${VOZES_LISTA.find(v => v.id === getVoz(from))?.nome}*\n\n`;
            VOZES_LISTA.forEach(v => { txt += `• \`.kaisen voz ${v.id}\` — ${v.nome}\n`; });
            txt += `────────────────`;
            await enviarInterativo(sock, from, txt, botoesPV(from), msg);
            return true;
        }
        if (buttonId === "kaisen_ver_produtos") {
            await listarProdutosComImagens(sock, msg, from, sender);
            return true;
        }
        return false;
    }

    // ========================================================
    // COMANDOS .ia-* / .kaisen
    // ========================================================
    let chamouIa = false, restoIa = "";
    for (const p of prefixos) {
        const c1 = p + "ia-add";
        const c2 = p + "ia-list";
        const c3 = p + "ia-del";
        const c4 = p + "ia-clear";
        const c5 = p + "ia-help";
        const c6 = p + "ia";
        const c7 = p + "kaisen";

        if (textoLower === c5 || textoLower === c6 || textoLower === c7) { chamouIa = true; restoIa = "__help__"; break; }
        if (textoLower === c2) { chamouIa = true; restoIa = "__list__"; break; }
        if (textoLower === c4) { chamouIa = true; restoIa = "__clear__"; break; }

        if (textoLower.startsWith(c1 + " ")) { chamouIa = true; restoIa = "__add__|" + texto.slice(c1.length).trim(); break; }
        if (textoLower.startsWith(c3 + " ")) { chamouIa = true; restoIa = "__del__|" + texto.slice(c3.length).trim(); break; }
        if (textoLower.startsWith(c6 + " ")) { chamouIa = true; restoIa = texto.slice(c6.length).trim(); break; }
        if (textoLower.startsWith(c7 + " ")) { chamouIa = true; restoIa = texto.slice(c7.length).trim(); break; }
    }

    if (chamouIa) {
        if (restoIa.startsWith("__add__|")) {
            const args = restoIa.slice("__add__|".length);
            return await processarAddProduto(sock, msg, from, sender, args);
        }
        if (restoIa === "__list__") {
            return await listarProdutosComImagens(sock, msg, from, sender);
        }
        if (restoIa === "__clear__") {
            limparProdutos(sender);
            await sock.sendMessage(from, { text: "🗑️ Catálogo limpo!" }, { quoted: msg });
            return true;
        }
        if (restoIa.startsWith("__del__|")) {
            const idDel = restoIa.slice("__del__|".length).trim();
            const ok = removerProduto(sender, idDel);
            await sock.sendMessage(from, {
                text: ok ? `✅ Produto \`${idDel}\` removido.` : `❌ Produto \`${idDel}\` não encontrado.`
            }, { quoted: msg });
            return true;
        }
        if (restoIa === "__help__") {
            await enviarInterativo(sock, from, menuPV(from), botoesPV(from), msg);
            return true;
        }

        const partes = restoIa.split(/\s+/);
        const sub = (partes[0] || "").toLowerCase();
        const arg = partes.slice(1).join(" ").trim();

        if (sub === "voz") {
            const v = VOZES_LISTA.find(x => x.id === arg.toLowerCase());
            if (v) {
                setVoz(from, v.id);
                await sock.sendMessage(from, { text: `✅ Voz definida: ${v.nome}` }, { quoted: msg });
            } else {
                await sock.sendMessage(from, {
                    text: `❌ Voz inválida. Opções: ${VOZES_LISTA.map(v => v.id).join(", ")}`
                }, { quoted: msg });
            }
            return true;
        }
        if (sub === "audio") {
            toggleAudio(from);
            await enviarInterativo(sock, from, menuPV(from), botoesPV(from), msg);
            return true;
        }
        if (sub === "imagem" || sub === "img") {
            const prompt = arg || "produto bonito";
            const buf = await gerarImagem(prompt);
            if (buf) {
                await sock.sendMessage(from, { image: buf, caption: `🎨 *${prompt}*` }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: "❌ Não consegui gerar a imagem." }, { quoted: msg });
            }
            return true;
        }

        await enviarInterativo(sock, from, menuPV(from), botoesPV(from), msg);
        return true;
    }

    // ========================================================
    // IA SEMPRE ATIVA
    // ========================================================
    for (const p of prefixos) if (textoLower.startsWith(p)) return false;

    const temImagem = !!obterImagem(msg);
    const temVideo = !!obterVideo(msg);
    const temAudio = !!obterAudio(msg);

    if ((!texto || texto.length < 1) && !temImagem && !temVideo && !temAudio) return false;

    const ultima = ultimaResposta.get(from) || 0;
    if (Date.now() - ultima < 2000) return false;

    try {
        await sock.sendMessage(from, { react: { text: "🤖", key: msg.key } }).catch(() => {});

        const produtosContexto = construirContextoProdutos(sender);

        let resposta;
        let audioPedido = false;
        let textoFinal = texto;

        if (temImagem) {
            const buf = await baixarMidia(sock, msg);
            if (buf) {
                const b64 = buf.toString("base64");
                const mimetype = obterImagem(msg).mimetype || "image/jpeg";
                const historico = lerDB().historico?.[from] || [];
                resposta = await askKaisen(texto || "Analisa esta imagem e diz-me o que vês.", {
                    pushName: msg.pushName || "",
                    history: historico.slice(-8),
                    media: { base64: b64, mimetype },
                    produtosContexto
                });
                audioPedido = audioAtivo(from) && Math.random() < PROB_AUDIO;
            } else {
                resposta = "Não consegui abrir a imagem.";
            }
        }
        else if (temVideo) {
            const buf = await baixarMidia(sock, msg);
            if (buf) {
                const thumb = await extrairThumbVideo(buf);
                if (thumb) {
                    const b64 = thumb.toString("base64");
                    const historico = lerDB().historico?.[from] || [];
                    resposta = await askKaisen(texto || "Descreve este vídeo pela thumbnail.", {
                        pushName: msg.pushName || "",
                        history: historico.slice(-8),
                        media: { base64: b64, mimetype: "image/jpeg" },
                        produtosContexto
                    });
                    audioPedido = audioAtivo(from) && Math.random() < PROB_AUDIO;
                } else {
                    resposta = "Recebi o vídeo mas não consegui processar.";
                }
            } else {
                resposta = "Não consegui abrir o vídeo.";
            }
        }
        else if (temAudio) {
            const buf = await baixarMidia(sock, msg);
            if (buf) {
                const textoAudio = await transcreverAudio(buf);
                if (textoAudio) {
                    textoFinal = textoAudio;
                    const historico = lerDB().historico?.[from] || [];
                    resposta = await askKaisen(textoAudio, {
                        pushName: msg.pushName || "",
                        history: historico.slice(-10),
                        produtosContexto
                    });
                    audioPedido = true;
                } else {
                    resposta = "Recebi o áudio mas não consegui entender.";
                }
            } else {
                resposta = "Não consegui abrir o áudio.";
            }
        }
        else {
            if (pedeAudio(texto)) audioPedido = true;
            else if (audioAtivo(from)) audioPedido = Math.random() < PROB_AUDIO;

            const historico = lerDB().historico?.[from] || [];
            resposta = await askKaisen(texto, {
                pushName: msg.pushName || "",
                history: historico.slice(-10),
                produtosContexto
            });
        }

        if (!resposta || !resposta.trim()) {
            const erro = getUltimoErroKaisen() || "Erro desconhecido";
            await sock.sendMessage(from, {
                text: `❌ *Erro na IA*\n\nMotivo: ${erro}`
            }, { quoted: msg }).catch(() => {});
            return true;
        }

        const dbH = lerDB();
        if (!dbH.historico[from]) dbH.historico[from] = [];
        dbH.historico[from].push({ role: "user", content: textoFinal });
        dbH.historico[from].push({ role: "assistant", content: resposta });
        if (dbH.historico[from].length > 20) dbH.historico[from].splice(0, dbH.historico[from].length - 20);
        salvarDB(dbH);

        ultimaResposta.set(from, Date.now());

        if (audioPedido) {
            const audioBuf = await gerarAudioRealista(resposta, from);
            if (audioBuf) {
                try {
                    await sock.sendMessage(from, {
                        audio: audioBuf,
                        mimetype: "audio/ogg; codecs=opus",
                        ptt: true
                    }, { quoted: msg });
                    return true;
                } catch (e) { console.log("Falha envio áudio:", e.message); }
            }
        }

        await sock.sendMessage(from, { text: resposta }, { quoted: msg });
        return true;

    } catch (e) {
        console.log("❌ Erro kaisen PV:", e.message);
        try { await sock.sendMessage(from, { text: "❌ Erro: " + e.message }, { quoted: msg }); } catch {}
        return false;
    }
}

// ============================================================
// EXPORT
// ============================================================
module.exports = {
    nome: "kaisen",
    comando: ["kaisen", "ia"],
    categoria: "membros",
    descricao: `${NOME_IA} VENDAS PV — IA multi-provider (criador: ${CRIADOR})`,

    run: async function (sock, msg) {
        return await processarMensagem(sock, msg);
    },

    processarMensagem,

    init: function (sock) {
        if (sock._kaisenInit) return;
        sock._kaisenInit = true;
        console.log(`🤖 ${NOME_IA} VENDAS PV pronto (criador: ${CRIADOR})`);
        console.log(`   💬 Modo: APENAS PRIVADO (PV)`);
        console.log(`   ✅ IA sempre ativa`);
        console.log(`   📦 Produtos ativos (.ia-add)`);
        console.log(`   Gemini: ${CHAVES_GEMINI.length} | Groq: ${CHAVES_GROQ.length} | OR: ${CHAVES_OPENROUTER.length}`);
        console.log(`   SambaNova: ${CHAVES_SAMBANOVA.length}`);
    },

    askKaisen,
    getUltimoErroKaisen,
    searchWeb,
    getClima,
    gerarImagem,
    listarProdutos,
    adicionarProduto,
    removerProduto,
    limparProdutos
};
