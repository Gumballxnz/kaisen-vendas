const fs = require('fs');
const path = require('path');
const axios = require('axios');

// ======= LINK DO CANAL (OCULTO) =======
const CANAL_LINK = "https://whatsapp.com/channel/0029VbAn6gZ9sBI8Ajxt4N36";

// ======= CONFIGURAÇÃO DE PASTAS =======
const TEMP_DIR = path.join(__dirname, '../../temp');

if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// ======= CONTROLE DE DUPLICATAS =======
const EM_PROCESSAMENTO = new Map();
const PROCESSADOS_RECENTES = new Set();

setInterval(() => {
    const agora = Date.now();
    for (const [key, timestamp] of EM_PROCESSAMENTO.entries()) {
        if (agora - timestamp > 30000) {
            EM_PROCESSAMENTO.delete(key);
        }
    }
}, 30000);

// =================== FUNÇÕES DE ESTILO ===================
function toSpecialStyle(text) {
    if (!text) return '';
    const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const styleMap = {
        'A': '𝙰', 'B': '𝙱', 'C': '𝙲', 'D': '𝙳', 'E': '𝙴', 'F': '𝙵', 'G': '𝙶', 'H': '𝙷', 'I': '𝙸', 'J': '𝙹',
        'K': '𝙺', 'L': '𝙻', 'M': '𝙼', 'N': '𝙽', 'O': '𝙾', 'P': '𝙿', 'Q': '𝚀', 'R': '𝚁', 'S': '𝚂', 'T': '𝚃',
        'U': '𝚄', 'V': '𝚅', 'W': '𝚆', 'X': '𝚇', 'Y': '𝚈', 'Z': '𝚉',
        'a': '𝚊', 'b': '𝚋', 'c': '𝚌', 'd': '𝚍', 'e': '𝚎', 'f': '𝚏', 'g': '𝚐', 'h': '𝚑', 'i': '𝚒', 'j': '𝚓',
        'k': '𝚔', 'l': '𝚕', 'm': '𝚖', 'n': '𝚗', 'o': '𝚘', 'p': '𝚙', 'q': '𝚚', 'r': '𝚛', 's': '𝚜', 't': '𝚝',
        'u': '𝚞', 'v': '𝚟', 'w': '𝚠', 'x': '𝚡', 'y': '𝚢', 'z': '𝚣',
        '0': '𝟶', '1': '𝟷', '2': '𝟸', '3': '𝟹', '4': '𝟺', '5': '𝟻', '6': '𝟼', '7': '𝟽', '8': '𝟾', '9': '𝟿',
        ' ': ' ', '.': '.', ':': ':', '-': '-', '_': '_', '/': '/', '(': '(', ')': ')', '[': '[', ']': ']',
        '!': '!', '?': '?', ',': ',', ';': ';', '@': '@', '#': '#', '$': '$', '%': '%', '&': '&', '*': '*',
        '✅': '✅', '❌': '❌', '⚠️': '⚠️', '🚫': '🚫', '🔒': '🔒', '🔓': '🔓', '🛡️': '🛡️', '📋': '📋',
        '🔴': '🔴', '🟢': '🟢', '⚙️': '⚙️', '💳': '💳', '🔔': '🔔', '⏰': '⏰', '📝': '📝', '💡': '💡',
        '‼️': '‼️', '🔄': '🔄', '🚨': '🚨', '📌': '📌', '▸': '▸', '📭': '📭', '🤖': '🤖', '⏳': '⏳',
        '🎵': '🎵', '🎶': '🎶', '📹': '📹', '📄': '📄', '⬇️': '⬇️', '🎧': '🎧', '🎬': '🎬'
    };
    let result = '';
    for (const char of normalized) {
        result += styleMap[char] || char;
    }
    return result;
}

// =================== ENVIAR MENSAGEM COM BOTÃO ===================
async function sendMessageWithChannelButton(sock, jid, text, quotedMsg) {
    try {
        try {
            let generateWAMessageFromContent, relayMessage, isJidGroup, generateMessageIDV2;
            const pkgs = ['baileys', '@whiskeysockets/baileys', '@adiwajshing/baileys'];
            for (const pkg of pkgs) {
                try {
                    const mod = require(pkg);
                    generateWAMessageFromContent = mod.generateWAMessageFromContent || mod.Utils?.generateWAMessageFromContent;
                    isJidGroup = mod.isJidGroup || mod.WABinary?.isJidGroup;
                    generateMessageIDV2 = mod.generateMessageIDV2 || mod.Utils?.generateMessageIDV2 || mod.generateMessageID;
                    relayMessage = sock.relayMessage;
                    if (generateWAMessageFromContent && relayMessage) break;
                } catch (_) {}
            }

            if (generateWAMessageFromContent && relayMessage) {
                const interactiveMessage = {
                    body: { text: text },
                    nativeFlowMessage: {
                        buttons: [{
                            name: 'cta_url',
                            buttonParamsJson: JSON.stringify({ 
                                display_text: '📢 VER CANAL',
                                url: CANAL_LINK
                            })
                        }]
                    }
                };

                const content = { interactiveMessage };
                const userJid = sock.authState?.creds?.me?.id || sock.user?.id;
                const fullMsg = generateWAMessageFromContent(jid, content, {
                    userJid,
                    messageId: generateMessageIDV2 ? generateMessageIDV2(userJid) : Date.now().toString(),
                    timestamp: new Date(),
                    quoted: quotedMsg
                });

                const isPrivate = !(isJidGroup ? isJidGroup(jid) : false);
                const additionalNodes = [
                    { tag: 'biz', attrs: {}, content: [{ tag: 'interactive', attrs: { type: 'native_flow', v: '1' }, content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }] }] }
                ];
                if (isPrivate) additionalNodes.push({ tag: 'bot', attrs: { biz_bot: '1' } });

                await relayMessage(jid, fullMsg.message, {
                    messageId: fullMsg.key.id,
                    additionalNodes
                });
                return;
            }
        } catch (e) {
            console.log('Erro ao enviar botão, usando fallback:', e.message);
        }

        await sock.sendMessage(jid, { 
            text: text + `\n\n📢 VER CANAL: ${CANAL_LINK}` 
        }, { quoted: quotedMsg });
    } catch (err) {
        console.log('❌ Erro ao enviar mensagem com botão:', err.message);
        try {
            await sock.sendMessage(jid, { text: text }, { quoted: quotedMsg });
        } catch (e) {
            console.log('❌ Erro fatal ao enviar mensagem:', e.message);
        }
    }
}

// =================== DETECTAR CLIQUE DE BOTÃO ===================
function detectarCliqueBotao(msg) {
    try {
        if (msg.message?.interactiveResponseMessage) {
            const interactive = msg.message.interactiveResponseMessage;
            if (interactive.nativeFlowResponseMessage?.paramsJson) {
                const params = JSON.parse(interactive.nativeFlowResponseMessage.paramsJson);
                if (params.id) return params.id;
            }
            if (interactive.nativeFlowResponseMessage?.selectedDisplayText) {
                return interactive.nativeFlowResponseMessage.selectedDisplayText;
            }
        }
        if (msg.message?.buttonsResponseMessage) {
            const buttons = msg.message.buttonsResponseMessage;
            if (buttons.selectedButtonId) return buttons.selectedButtonId;
            if (buttons.selectedDisplayText) return buttons.selectedDisplayText;
        }
        if (msg.message?.templateButtonReplyMessage) {
            const template = msg.message.templateButtonReplyMessage;
            if (template.selectedId) return template.selectedId;
            if (template.selectedDisplayText) return template.selectedDisplayText;
        }
        return null;
    } catch (error) {
        return null;
    }
}

// =================== CRIAR MENSAGEM COM BOTÕES ===================
async function criarMensagemComBotoes(sock, jid, texto, botoes, quotedMsg, titulo = "🔍 TT PESQUISA") {
    try {
        let generateWAMessageFromContent, relayMessage, isJidGroup, generateMessageIDV2;
        const pkgs = ['baileys', '@whiskeysockets/baileys', '@adiwajshing/baileys'];
        for (const pkg of pkgs) {
            try {
                const mod = require(pkg);
                generateWAMessageFromContent = mod.generateWAMessageFromContent || mod.Utils?.generateWAMessageFromContent;
                isJidGroup = mod.isJidGroup || mod.WABinary?.isJidGroup;
                generateMessageIDV2 = mod.generateMessageIDV2 || mod.Utils?.generateMessageIDV2 || mod.generateMessageID;
                relayMessage = sock.relayMessage;
                if (generateWAMessageFromContent && relayMessage) break;
            } catch (_) {}
        }

        if (generateWAMessageFromContent && relayMessage) {
            const interactiveMessage = {
                header: { title: titulo, hasMediaAttachment: false },
                body: { text: toSpecialStyle(texto) },
                footer: { text: "⚡ CyberHost • TikTok Search" },
                nativeFlowMessage: { buttons: botoes }
            };

            const content = { interactiveMessage };
            const userJid = sock.authState?.creds?.me?.id || sock.user?.id;
            const fullMsg = generateWAMessageFromContent(jid, content, {
                userJid,
                messageId: generateMessageIDV2 ? generateMessageIDV2(userJid) : Date.now().toString(),
                timestamp: new Date(),
                quoted: quotedMsg
            });

            const isPrivate = !(isJidGroup ? isJidGroup(jid) : false);
            const additionalNodes = [
                { tag: 'biz', attrs: {}, content: [{ tag: 'interactive', attrs: { type: 'native_flow', v: '1' }, content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }] }] }
            ];
            if (isPrivate) additionalNodes.push({ tag: 'bot', attrs: { biz_bot: '1' } });

            await relayMessage(jid, fullMsg.message, { messageId: fullMsg.key.id, additionalNodes });
            return true;
        } else {
            await sock.sendMessage(jid, { text: toSpecialStyle(texto) }, { quoted: quotedMsg });
            return false;
        }
    } catch (error) {
        console.log('❌ Erro ao criar mensagem com botões:', error.message);
        try {
            await sock.sendMessage(jid, { text: toSpecialStyle(texto) }, { quoted: quotedMsg });
        } catch (e) {}
        return false;
    }
}

// =================== TEMPLATES ===================
const templates = {
    sucesso: (texto) => `✅ *${texto}*\n────────────────`,
    erro: (texto) => `❌ *${texto}*\n────────────────`,
    info: (texto) => `📌 *${texto}*\n────────────────`,

    menuPrincipal: () => `
🔍 *TT - PESQUISA TIKTOK*

╔══════════════════════╗
║   📖 COMO USAR       ║
╠══════════════════════╣
║ • .tt <nome>        ║
║   Pesquisa vídeos    ║
║                      ║
║ • .tt @usuario      ║
║   Pesquisa perfil    ║
╚══════════════════════╝

📋 *Exemplos:*
\`\`\`
.tt gatinho fofo
.tt funk 2024
.tt @mrbeast
\`\`\`
────────────────`
};

// =================== PESQUISAR NO TIKWM ===================
async function pesquisarTikWM(keyword) {
    try {
        console.log(`📡 Pesquisando TikWM: "${keyword}"`);

        const { data } = await axios.get('https://www.tikwm.com/api/feed/search', {
            params: {
                keywords: keyword,
                count: 10,
                cursor: 0,
                hd: 1
            },
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        console.log('📋 Resposta TikWM:', JSON.stringify(data).substring(0, 400));

        if (!data || data.code !== 0 || !data.data || !data.data.videos) {
            console.log('⚠️ TikWM não retornou vídeos');
            return null;
        }

        console.log(`✅ TikWM: ${data.data.videos.length} vídeos encontrados`);
        return data.data.videos;

    } catch (err) {
        console.log('❌ Erro TikWM:', err.message);
        return null;
    }
}

// =================== BUSCAR PERFIL TIKTOK ===================
async function pesquisarPerfilTikTok(username) {
    try {
        const user = username.replace('@', '');
        console.log(`👤 Buscando perfil: ${user}`);

        const { data: html } = await axios.get(`https://www.tiktok.com/@${user}`, {
            timeout: 20000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
            }
        });

        const htmlStr = String(html);

        const jsonMatch = htmlStr.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);

        if (!jsonMatch) {
            console.log('⚠️ JSON do TikTok não encontrado');
            return null;
        }

        const jsonData = JSON.parse(jsonMatch[1]);
        const userData = jsonData?.__DEFAULT_SCOPE__?.['webapp.user-detail']?.userInfo;

        if (!userData) {
            console.log('⚠️ Dados de usuário não encontrados');
            return null;
        }

        const stats = userData.stats || {};
        const u = userData.user || {};

        return {
            username: u.uniqueId || 'N/A',
            nickname: u.nickname || 'N/A',
            verified: u.verified || false,
            avatar: u.avatarLarger || u.avatarMedium || u.avatarThumb,
            bio: u.signature || 'N/A',
            followers: stats.followerCount || 0,
            following: stats.followingCount || 0,
            likes: stats.heartCount || 0,
            videos: stats.videoCount || 0
        };

    } catch (err) {
        console.log('❌ Erro ao buscar perfil:', err.message);
        return null;
    }
}

// =================== MOSTRAR RESULTADO ===================
async function mostrarResultadoBusca(sock, videos, keyword, from, originalMsg) {
    try {
        if (!videos || videos.length === 0) {
            await sendMessageWithChannelButton(sock, from,
                templates.erro("Nenhum vídeo encontrado!") + "\n\n" +
                `🔍 *Pesquisa:* ${keyword}\n\n` +
                "💡 *Dicas:*\n" +
                "• Use palavras-chave simples\n" +
                "• Tente em inglês\n" +
                "• Seja mais específico",
                originalMsg
            );
            return false;
        }

        const userKey = `${from}_${originalMsg.key.participant || from}`;
        const arquivoTemp = path.join(TEMP_DIR, `ttsearch_${userKey.replace(/[^a-zA-Z0-9]/g, '_')}.json`);

        // Mapear vídeos para formato consistente
        const videosMapeados = videos.map((v, i) => ({
            index: i + 1,
            id: v.video_id || v.id,
            titulo: v.title || 'Sem título',
            autor: v.author?.unique_id || 'Desconhecido',
            url: v.play || v.wmplay,
            url_original: `https://www.tiktok.com/@${v.author?.unique_id}/video/${v.video_id || v.id}`
        })).filter(v => v.url);

        if (videosMapeados.length === 0) {
            await sendMessageWithChannelButton(sock, from,
                templates.erro("Nenhum vídeo com download disponível!") + "\n\n" +
                `🔍 *Pesquisa:* ${keyword}`,
                originalMsg
            );
            return false;
        }

        fs.writeFileSync(arquivoTemp, JSON.stringify({
            keyword: keyword,
            videos: videosMapeados,
            timestamp: Date.now()
        }));

        let lista = `🔍 *RESULTADOS TIKTOK*\n`;
        lista += `📌 *Pesquisa:* ${keyword}\n`;
        lista += `📊 *Encontrados:* ${videosMapeados.length}\n`;
        lista += `────────────────\n\n`;

        const maxMostrar = Math.min(videosMapeados.length, 5);

        for (let i = 0; i < maxMostrar; i++) {
            const v = videosMapeados[i];
            lista += `*${v.index}.* ${v.titulo.substring(0, 80)}\n`;
            lista += `   👤 @${v.autor}\n\n`;
        }

        if (videosMapeados.length > maxMostrar) {
            lista += `_... e mais ${videosMapeados.length - maxMostrar} vídeos_\n\n`;
        }

        lista += `────────────────\n`;
        lista += `📥 *Clique nos botões para baixar!*`;

        const botoes = [];
        for (let i = 0; i < Math.min(videosMapeados.length, 3); i++) {
            botoes.push({
                name: 'quick_reply',
                buttonParamsJson: JSON.stringify({
                    display_text: `📹 Baixar vídeo ${i + 1}`,
                    id: `tts_${i + 1}`
                })
            });
        }

        await criarMensagemComBotoes(sock, from, lista, botoes, originalMsg, "🔍 TIKTOK");
        return true;

    } catch (error) {
        console.error('❌ Erro ao mostrar resultados:', error);
        return false;
    }
}

// =================== PROCESSAR PESQUISA ===================
async function processarPesquisa(sock, keyword, from, msgKey, originalMsg) {
    try {
        const userJid = msgKey.participant || from;
        const chave = `${msgKey.id}_${userJid}`;

        if (EM_PROCESSAMENTO.has(chave) || PROCESSADOS_RECENTES.has(chave)) {
            console.log(`⚠️ TT duplicado ignorado: ${chave}`);
            return false;
        }

        EM_PROCESSAMENTO.set(chave, Date.now());
        PROCESSADOS_RECENTES.add(chave);
        setTimeout(() => PROCESSADOS_RECENTES.delete(chave), 15000);

        await sock.sendMessage(from, { react: { text: "⏳", key: msgKey } });

        // Se for @usuario, buscar perfil
        if (keyword.startsWith('@')) {
            const perfil = await pesquisarPerfilTikTok(keyword);

            if (!perfil) {
                await sendMessageWithChannelButton(sock, from,
                    templates.erro("Perfil não encontrado!") + "\n\n" +
                    `🔍 *Busca:* ${keyword}`,
                    originalMsg
                );
                await sock.sendMessage(from, { react: { text: "❌", key: msgKey } });
                EM_PROCESSAMENTO.delete(chave);
                return false;
            }

            const infoMsg = `╭━━━〔 👤 *TIKTOK PERFIL* 〕━━━╮
┃
┃ 📛 *Nick:* ${perfil.nickname}
┃ 🔖 *Usuário:* @${perfil.username}
┃ ✅ *Verificado:* ${perfil.verified ? 'Sim' : 'Não'}
┃
┃ 📊 *Estatísticas:*
┃ 👥 *Seguidores:* ${perfil.followers.toLocaleString()}
┃ 📹 *Vídeos:* ${perfil.videos.toLocaleString()}
┃ ❤️ *Curtidas:* ${perfil.likes.toLocaleString()}
┃
┃ 📝 *Bio:* ${(perfil.bio || 'N/A').substring(0, 150)}
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

            if (perfil.avatar) {
                try {
                    await sock.sendMessage(from, {
                        image: { url: perfil.avatar },
                        caption: infoMsg
                    }, { quoted: originalMsg });
                } catch (e) {
                    await sendMessageWithChannelButton(sock, from, infoMsg, originalMsg);
                }
            } else {
                await sendMessageWithChannelButton(sock, from, infoMsg, originalMsg);
            }

            await sock.sendMessage(from, { react: { text: "✅", key: msgKey } });
            EM_PROCESSAMENTO.delete(chave);
            return true;
        }

        // Pesquisa de vídeos via TikWM
        const videos = await pesquisarTikWM(keyword);

        if (!videos) {
            await sendMessageWithChannelButton(sock, from,
                templates.erro("Nenhum resultado encontrado!") + "\n\n" +
                `🔍 *Pesquisa:* ${keyword}\n\n` +
                "💡 *Tente:*\n" +
                "• Palavras-chave simples\n" +
                "• Termos em inglês\n" +
                "• @usuario para perfis",
                originalMsg
            );
            await sock.sendMessage(from, { react: { text: "❌", key: msgKey } });
            EM_PROCESSAMENTO.delete(chave);
            return false;
        }

        await mostrarResultadoBusca(sock, videos, keyword, from, originalMsg);
        await sock.sendMessage(from, { react: { text: "✅", key: msgKey } });

        EM_PROCESSAMENTO.delete(chave);
        return true;

    } catch (error) {
        console.error('❌ Erro na pesquisa TT:', error);
        await sock.sendMessage(from, { react: { text: "❌", key: msgKey } });
        await sendMessageWithChannelButton(sock, from,
            templates.erro("Erro na pesquisa!") + "\n\n🔄 *Tente novamente em 1-2 minutos*",
            originalMsg
        );
        return false;
    }
}

// =================== PROCESSAR CLIQUE DE BOTÃO ===================
async function processarCliqueBotaoTT(sock, msg, jid, remetente) {
    try {
        const cliqueId = detectarCliqueBotao(msg);
        if (!cliqueId) return false;
        if (!cliqueId.startsWith('tts_')) return false;

        const index = parseInt(cliqueId.substring(4)) - 1;
        const userKey = `${jid}_${remetente}`;
        const arquivoTemp = path.join(TEMP_DIR, `ttsearch_${userKey.replace(/[^a-zA-Z0-9]/g, '_')}.json`);

        let dados = null;
        if (fs.existsSync(arquivoTemp)) {
            try {
                dados = JSON.parse(fs.readFileSync(arquivoTemp, 'utf8'));
            } catch (error) {
                console.log('❌ Erro ao ler arquivo temp:', error.message);
            }
        }

        if (!dados || !dados.videos || !dados.videos[index]) {
            await sendMessageWithChannelButton(sock, jid,
                "⚠️ *Nenhum vídeo encontrado!*\n\nUse `.tt <nome>` para pesquisar novamente.",
                msg
            );
            return true;
        }

        const video = dados.videos[index];

        await sock.sendMessage(jid, { react: { text: "⏳", key: msg.key } });

        try {
            await sock.sendMessage(jid, {
                video: { url: video.url },
                mimetype: "video/mp4",
                caption: `📹 *TikTok baixado!*\n────────────────\n📌 *Título:* ${video.titulo.substring(0, 100)}\n👤 *Autor:* @${video.autor}`
            }, { quoted: msg });

            await sock.sendMessage(jid, { react: { text: "✅", key: msg.key } });
        } catch (err) {
            console.log('❌ Erro ao enviar vídeo:', err.message);
            await sendMessageWithChannelButton(sock, jid,
                "❌ *Erro ao baixar o vídeo!*\n\n🔄 Tente novamente",
                msg
            );
        }

        return true;
    } catch (error) {
        console.error('❌ Erro ao processar clique de botão:', error);
        return false;
    }
}

// =================== MÓDULO ===================
module.exports = {
    nome: "tt",

    init: (sock) => {
        console.log('🔍 Inicializando comando TT (pesquisa TikTok)...');

        if (sock.__ttSearchListenerRegistered) {
            console.log('⚠️ Listener TT já registrado, ignorando duplicata');
            return;
        }
        sock.__ttSearchListenerRegistered = true;

        sock.ev.on("messages.upsert", async ({ messages }) => {
            for (const m of messages) {
                try {
                    if (!m?.message) continue;
                    if (m.key?.fromMe) continue;

                    const from = m.key.remoteJid;
                    if (!from) continue;

                    const remetente = m.key.participant || from;

                    const isBotao = await processarCliqueBotaoTT(sock, m, from, remetente);
                    if (isBotao) continue;

                    const messageText = m.message.conversation || 
                                        m.message.extendedTextMessage?.text || 
                                        m.message.imageMessage?.caption || 
                                        "";

                    const texto = messageText.trim();

                    if (texto.toLowerCase().startsWith('.tt')) {
                        const args = texto.split(/\s+/).slice(1);

                        if (args.length === 0) {
                            await sendMessageWithChannelButton(sock, from, templates.menuPrincipal(), m);
                            continue;
                        }

                        const keyword = args.join(' ').trim();
                        await processarPesquisa(sock, keyword, from, m.key, m);
                        continue;
                    }

                } catch (err) {
                    console.log('❌ Erro no evento messages.upsert:', err);
                }
            }
        });
    },

    run: async (sock, msg, args) => {
        console.log('🔍 run() do TT chamado (ignorando - init() cuida do evento)');
        return false;
    }
};
