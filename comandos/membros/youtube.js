const fs = require('fs');
const path = require('path');
const axios = require('axios');

const API_KEY_BRONXYS = "85";

// ======= LINK DO CANAL (OCULTO) =======
const CANAL_LINK = "https://whatsapp.com/channel/0029VbAn6gZ9sBI8Ajxt4N36";

// ======= CONFIGURAÇÃO DE PASTAS =======
const DATABASE_DIR = './database';
const TEMP_DIR = path.join(__dirname, '../../temp');

// ======= CONFIGURAÇÃO =======
const arquivo = path.join(__dirname, `../${DATABASE_DIR}/autoYoutube.json`);

let config = { grupos: {}, usuarios: {} };
if (fs.existsSync(arquivo)) {
  try {
    config = JSON.parse(fs.readFileSync(arquivo, "utf8"));
  } catch {
    config = { grupos: {}, usuarios: {} };
  }
}

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

const salvarConfig = () => {
  try {
    const dir = path.dirname(arquivo);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(arquivo, JSON.stringify(config, null, 2));
  } catch (e) {
    console.log('❌ Erro ao salvar config:', e.message);
  }
};

const carregarConfig = () => {
  try {
    const dir = path.dirname(arquivo);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(arquivo)) {
      config = JSON.parse(fs.readFileSync(arquivo, "utf8"));
    }
  } catch {
    config = { grupos: {}, usuarios: {} };
  }
};

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
async function criarMensagemComBotoes(sock, jid, texto, botoes, quotedMsg, titulo = "📺 YOUTUBE") {
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

        if (!botoes || botoes.length === 0) {
            botoes = [
                { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '📹 VÍDEO (MP4)', id: 'yt_video' }) },
                { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🎵 ÁUDIO (MP3)', id: 'yt_audio' }) },
                { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '📄 DOCUMENTO', id: 'yt_doc' }) }
            ];
        }

        if (generateWAMessageFromContent && relayMessage) {
            const interactiveMessage = {
                header: { title: titulo, hasMediaAttachment: false },
                body: { text: toSpecialStyle(texto) },
                footer: { text: "⚡ CyberHost • YouTube" },
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
    
    menuPrincipal: (status) => `
📺 *YOUTUBE / PLAY*

📊 *Status Auto-download:* ${status}

╔══════════════════════╗
║   🔧 COMANDOS ADMIN  ║
╠══════════════════════╣
║ • .youtube on       ║
║ • .youtube off      ║
╠══════════════════════╣
║   👥 PARA TODOS      ║
╠══════════════════════╣
║ • .youtube <link>   ║
║ • .play <nome>      ║
║ • .playmp4 <nome>   ║
║ • .playdoc <nome>   ║
╚══════════════════════╝

📋 *Tipos suportados:*
📹 Vídeo (MP4) • 🎵 Áudio (MP3) • 📄 Documento

📋 *Exemplos:*
\`\`\`
.youtube https://youtu.be/ABC123
.play funk 2024
.playmp4 gatinho fofo
.playdoc lofi hip hop
\`\`\`
────────────────`
};

// =================== FETCH JSON ===================
async function fetchJson(url) {
    try {
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Accept-Language': 'pt-BR'
            },
            timeout: 30000
        });
        return data;
    } catch (err) {
        console.log('❌ Erro fetchJson:', err.message);
        return null;
    }
}

// =================== OBTER INFO POR URL ===================
async function obterInfoPorUrl(url) {
    try {
        const videoId = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([A-Za-z0-9_-]{11})/)?.[1];
        
        if (!videoId) return null;
        
        const thumb = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        
        try {
            const oembed = await axios.get(`https://www.youtube.com/oembed?url=${url}&format=json`, { timeout: 10000 });
            return {
                titulo: oembed.data.title || 'Vídeo do YouTube',
                autor: oembed.data.author_name || '',
                thumbnail: oembed.data.thumbnail_url || thumb,
                duracao: 'N/A',
                videoId
            };
        } catch (e) {
            return {
                titulo: 'Vídeo do YouTube',
                autor: '',
                thumbnail: thumb,
                duracao: 'N/A',
                videoId
            };
        }
    } catch (err) {
        console.log('❌ Erro obterInfoPorUrl:', err.message);
        return null;
    }
}

// =================== OBTER INFO POR NOME ===================
async function obterInfoPorNome(nome) {
    try {
        const data = await fetchJson(
            `https://api.bronxyshost.com.br/api-bronxys/pesquisa_ytb?nome=${encodeURIComponent(nome)}&apikey=${API_KEY_BRONXYS}`
        );
        
        if (!data || !data[0]) return null;
        
        return {
            titulo: data[0].titulo || 'Vídeo do YouTube',
            tempo: data[0].tempo || 'N/A',
            postado: data[0].postado || 'N/A',
            desc: data[0].desc || 'N/A',
            thumb: data[0].thumb || '',
            url: data[0].url || ''
        };
    } catch (err) {
        console.log('❌ Erro obterInfoPorNome:', err.message);
        return null;
    }
}

// =================== FUNÇÕES DE DOWNLOAD ===================

async function baixarVideoPorUrl(sock, url, from, msgKey, originalMsg, info) {
    try {
        const videoUrl = `https://api.bronxyshost.com.br/api-bronxys/play_video?nome_url=${encodeURIComponent(url)}&apikey=${API_KEY_BRONXYS}`;
        
        await sock.sendMessage(from, {
            video: { url: videoUrl },
            mimetype: "video/mp4",
            caption: `📹 *YouTube baixado!*\n────────────────\n📌 *Título:* ${info.titulo}`
        }, { quoted: originalMsg });

        await sock.sendMessage(from, { react: { text: "✅", key: msgKey } });
        return true;
    } catch (error) {
        console.error('❌ Erro no download do vídeo:', error);
        return false;
    }
}

async function baixarAudioPorUrl(sock, url, from, msgKey, originalMsg, info) {
    try {
        const audioUrl = `https://api.bronxyshost.com.br/api-bronxys/play?nome_url=${encodeURIComponent(url)}&apikey=${API_KEY_BRONXYS}`;
        
        await sock.sendMessage(from, {
            audio: { url: audioUrl },
            mimetype: "audio/mpeg",
            fileName: `${info.titulo}.mp3`,
            ptt: false
        }, { quoted: originalMsg });

        await sock.sendMessage(from, { react: { text: "✅", key: msgKey } });
        return true;
    } catch (error) {
        console.error('❌ Erro no download do áudio:', error);
        return false;
    }
}

async function baixarDocumentoPorUrl(sock, url, from, msgKey, originalMsg, info) {
    try {
        const audioUrl = `https://api.bronxyshost.com.br/api-bronxys/play?nome_url=${encodeURIComponent(url)}&apikey=${API_KEY_BRONXYS}`;
        
        await sock.sendMessage(from, {
            document: { url: audioUrl },
            mimetype: "audio/mpeg",
            fileName: `${info.titulo}.mp3`
        }, { quoted: originalMsg });

        await sock.sendMessage(from, { react: { text: "✅", key: msgKey } });
        return true;
    } catch (error) {
        console.error('❌ Erro no download do documento:', error);
        return false;
    }
}

// =================== PROCESSAR POR URL ===================
async function processarYoutubeUrl(sock, url, from, msgKey, originalMsg) {
    try {
        const userJid = msgKey.participant || from;
        const chave = `${msgKey.id}_${userJid}`;
        
        if (EM_PROCESSAMENTO.has(chave) || PROCESSADOS_RECENTES.has(chave)) {
            console.log(`⚠️ YouTube duplicado ignorado: ${chave}`);
            return false;
        }
        
        EM_PROCESSAMENTO.set(chave, Date.now());
        PROCESSADOS_RECENTES.add(chave);
        setTimeout(() => PROCESSADOS_RECENTES.delete(chave), 15000);

        console.log(`📺 Processando YouTube URL: ${url}`);

        const youtubeRegex = /(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/i;
        if (!youtubeRegex.test(url)) {
            await sendMessageWithChannelButton(sock, from,
                templates.erro("Link inválido!") + "\n\n" +
                "📝 *Formatos:*\n• `youtube.com/watch?v=...`\n• `youtu.be/...`\n• `youtube.com/shorts/...`",
                originalMsg
            );
            EM_PROCESSAMENTO.delete(chave);
            return false;
        }

        await sock.sendMessage(from, { react: { text: "⏳", key: msgKey } });

        const info = await obterInfoPorUrl(url);
        
        if (!info) {
            await sendMessageWithChannelButton(sock, from,
                templates.erro("Vídeo não encontrado!") + "\n\n🔄 Tente outro link",
                originalMsg
            );
            await sock.sendMessage(from, { react: { text: "❌", key: msgKey } });
            EM_PROCESSAMENTO.delete(chave);
            return false;
        }

        // Salvar dados temporários
        const userKey = `${from}_${msgKey.participant || from}`;
        const arquivoTemp = path.join(TEMP_DIR, `yt_${userKey.replace(/[^a-zA-Z0-9]/g, '_')}.json`);
        fs.writeFileSync(arquivoTemp, JSON.stringify({
            tipo: 'url',
            url: url,
            titulo: info.titulo,
            thumbnail: info.thumbnail,
            timestamp: Date.now()
        }));

        const infoMsg = `╭━━━〔 📺 *YOUTUBE* 〕━━━╮
┃
┃ 📌 *Título:* ${info.titulo}
┃ 👤 *Autor:* ${info.autor || 'N/A'}
┃
┃ 📌 *Escolha o formato:*
┃    Clique nos botões abaixo!
╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

        // === BOTÕES: VÍDEO / ÁUDIO / DOCUMENTO (sem NOVO LINK) ===
        const botoes = [
            { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '📹 VÍDEO (MP4)', id: 'yt_video' }) },
            { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🎵 ÁUDIO (MP3)', id: 'yt_audio' }) },
            { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '📄 DOCUMENTO', id: 'yt_doc' }) }
        ];

        // Enviar thumbnail com legenda
        if (info.thumbnail) {
            try {
                await sock.sendMessage(from, {
                    image: { url: info.thumbnail },
                    caption: infoMsg
                }, { quoted: originalMsg });
            } catch (e) {
                console.log('⚠️ Erro ao enviar thumb:', e.message);
            }
        }

        // Enviar botões
        await criarMensagemComBotoes(sock, from, '📌 *Escolha o formato:*', botoes, originalMsg, "📺 YOUTUBE");

        EM_PROCESSAMENTO.delete(chave);
        return true;

    } catch (error) {
        console.error('❌ Erro processarYoutubeUrl:', error);
        await sock.sendMessage(from, { react: { text: "❌", key: msgKey } });
        await sendMessageWithChannelButton(sock, from,
            templates.erro("Erro no processamento!") + "\n\n🔄 Tente novamente",
            originalMsg
        );
        return false;
    }
}

// =================== PROCESSAR POR NOME (PLAY) ===================
async function processarPlay(sock, nome, from, msgKey, originalMsg) {
    try {
        const userJid = msgKey.participant || from;
        const chave = `${msgKey.id}_${userJid}`;
        
        if (EM_PROCESSAMENTO.has(chave) || PROCESSADOS_RECENTES.has(chave)) {
            console.log(`⚠️ Play duplicado ignorado: ${chave}`);
            return false;
        }
        
        EM_PROCESSAMENTO.set(chave, Date.now());
        PROCESSADOS_RECENTES.add(chave);
        setTimeout(() => PROCESSADOS_RECENTES.delete(chave), 15000);

        console.log(`🎵 Processando Play: "${nome}"`);

        await sock.sendMessage(from, { react: { text: "⏳", key: msgKey } });

        const info = await obterInfoPorNome(nome);
        
        if (!info) {
            await sendMessageWithChannelButton(sock, from,
                templates.erro("Nada encontrado!") + "\n\n" +
                "🔍 *Dicas:*\n• Seja mais específico\n• Tente em inglês\n• Use o nome do artista + música",
                originalMsg
            );
            await sock.sendMessage(from, { react: { text: "❌", key: msgKey } });
            EM_PROCESSAMENTO.delete(chave);
            return false;
        }

        // Verificar duração (limite 1h)
        if (info.tempo && info.tempo.length >= 7) {
            await sendMessageWithChannelButton(sock, from,
                templates.erro("Vídeo muito longo!") + "\n\n⏰ Máximo de 1 hora.",
                originalMsg
            );
            await sock.sendMessage(from, { react: { text: "❌", key: msgKey } });
            EM_PROCESSAMENTO.delete(chave);
            return false;
        }

        // Salvar dados temporários
        const userKey = `${from}_${msgKey.participant || from}`;
        const arquivoTemp = path.join(TEMP_DIR, `yt_${userKey.replace(/[^a-zA-Z0-9]/g, '_')}.json`);
        fs.writeFileSync(arquivoTemp, JSON.stringify({
            tipo: 'nome',
            nome: nome,
            titulo: info.titulo,
            thumbnail: info.thumb,
            duracao: info.tempo,
            timestamp: Date.now()
        }));

        const infoMsg = `╭━━━〔 🎵 *PLAY* 〕━━━╮
┃
┃ 📌 *Título:* ${info.titulo}
┃ ⏱️ *Duração:* ${info.tempo}
┃ 📅 *Postado:* ${info.postado}
┃
┃ 📌 *Escolha o formato:*
┃    Clique nos botões abaixo!
╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

        // === BOTÕES: ÁUDIO / VÍDEO / DOCUMENTO (sem NOVA BUSCA) ===
        const botoes = [
            { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🎵 ÁUDIO (MP3)', id: 'yt_audio' }) },
            { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '📹 VÍDEO (MP4)', id: 'yt_video' }) },
            { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '📄 DOCUMENTO', id: 'yt_doc' }) }
        ];

        // Enviar thumbnail
        if (info.thumb) {
            try {
                await sock.sendMessage(from, {
                    image: { url: info.thumb },
                    caption: infoMsg
                }, { quoted: originalMsg });
            } catch (e) {
                console.log('⚠️ Erro ao enviar thumb:', e.message);
            }
        }

        // Enviar botões
        await criarMensagemComBotoes(sock, from, '📌 *Escolha o formato:*', botoes, originalMsg, "🎵 PLAY");

        EM_PROCESSAMENTO.delete(chave);
        return true;

    } catch (error) {
        console.error('❌ Erro processarPlay:', error);
        await sock.sendMessage(from, { react: { text: "❌", key: msgKey } });
        await sendMessageWithChannelButton(sock, from,
            templates.erro("Erro na busca!") + "\n\n🔄 Tente novamente",
            originalMsg
        );
        return false;
    }
}

// =================== PROCESSAR CLIQUE DE BOTÃO ===================
async function processarCliqueBotaoYoutube(sock, msg, jid, remetente) {
    try {
        const cliqueId = detectarCliqueBotao(msg);
        if (!cliqueId) return false;
        if (!cliqueId.startsWith('yt_')) return false;

        const comando = cliqueId.substring(3);
        const userKey = `${jid}_${remetente}`;
        const arquivoTemp = path.join(TEMP_DIR, `yt_${userKey.replace(/[^a-zA-Z0-9]/g, '_')}.json`);

        let dados = null;
        if (fs.existsSync(arquivoTemp)) {
            try {
                dados = JSON.parse(fs.readFileSync(arquivoTemp, 'utf8'));
            } catch (error) {
                console.log('❌ Erro ao ler arquivo temp:', error.message);
            }
        }

        if (!dados) {
            await sendMessageWithChannelButton(sock, jid,
                "⚠️ *Nenhum conteúdo encontrado!*\n\nUse `.youtube <link>` ou `.play <nome>` primeiro.",
                msg
            );
            return true;
        }

        const termo = dados.tipo === 'url' ? dados.url : dados.nome;

        if (comando === 'video') {
            await sock.sendMessage(jid, { react: { text: "⏳", key: msg.key } });
            await baixarVideoPorUrl(sock, termo, jid, msg.key, msg, dados);
            return true;
        }

        if (comando === 'audio') {
            await sock.sendMessage(jid, { react: { text: "⏳", key: msg.key } });
            await baixarAudioPorUrl(sock, termo, jid, msg.key, msg, dados);
            return true;
        }

        if (comando === 'doc') {
            await sock.sendMessage(jid, { react: { text: "⏳", key: msg.key } });
            await baixarDocumentoPorUrl(sock, termo, jid, msg.key, msg, dados);
            return true;
        }

        return false;
    } catch (error) {
        console.error('❌ Erro ao processar clique de botão:', error);
        return false;
    }
}

// =================== MÓDULO ===================
module.exports = {
    nome: "youtube",

    init: (sock) => {
        console.log('📺 Inicializando comando YouTube/Play...');

        if (sock.__youtubeListenerRegistered) {
            console.log('⚠️ Listener YouTube já registrado, ignorando duplicata');
            return;
        }
        sock.__youtubeListenerRegistered = true;

        sock.ev.on("messages.upsert", async ({ messages }) => {
            for (const m of messages) {
                try {
                    if (!m?.message) continue;
                    if (m.key?.fromMe) continue;

                    const from = m.key.remoteJid;
                    if (!from) continue;

                    const remetente = m.key.participant || from;

                    // Botões
                    const isBotao = await processarCliqueBotaoYoutube(sock, m, from, remetente);
                    if (isBotao) continue;

                    const messageText = m.message.conversation || 
                                        m.message.extendedTextMessage?.text || 
                                        m.message.imageMessage?.caption || 
                                        "";

                    const texto = messageText.trim().toLowerCase();

                    // === COMANDO .youtube ===
                    if (texto.startsWith('.youtube')) {
                        const args = messageText.trim().split(/\s+/).slice(1);

                        if (args.length === 0) {
                            const isGroup = from.endsWith("@g.us");
                            const status = isGroup 
                                ? (config.grupos[from] ? "✅ ATIVADO" : "❌ DESATIVADO")
                                : (config.usuarios[from] ? "✅ ATIVADO" : "❌ DESATIVADO");
                            
                            await sendMessageWithChannelButton(sock, from, templates.menuPrincipal(status), m);
                            continue;
                        }

                        const sub = args[0].toLowerCase();

                        // on/off
                        if (sub === "on" || sub === "off") {
                            const isGroup = from.endsWith("@g.us");
                            
                            if (isGroup) {
                                try {
                                    const groupMetadata = await sock.groupMetadata(from);
                                    const participant = groupMetadata.participants.find(p => p.id === remetente);
                                    
                                    if (!participant || (participant.admin !== 'admin' && participant.admin !== 'superadmin')) {
                                        await sendMessageWithChannelButton(sock, from,
                                            templates.erro("Acesso negado!") + "\n\n👮 Apenas administradores",
                                            m
                                        );
                                        continue;
                                    }
                                } catch (error) {
                                    await sendMessageWithChannelButton(sock, from, templates.erro("Erro nas permissões!"), m);
                                    continue;
                                }
                            }

                            if (sub === "on") {
                                if (isGroup) config.grupos[from] = true;
                                else config.usuarios[from] = true;
                                salvarConfig();
                                
                                await sendMessageWithChannelButton(sock, from,
                                    templates.sucesso("Auto-download ATIVADO!") + "\n\n📺 Agora baixo automaticamente links do YouTube!",
                                    m
                                );
                                continue;
                            }

                            if (sub === "off") {
                                if (isGroup) delete config.grupos[from];
                                else delete config.usuarios[from];
                                salvarConfig();
                                
                                await sendMessageWithChannelButton(sock, from,
                                    templates.info("Auto-download DESATIVADO") + "\n\n📝 Use `.youtube <link>` manualmente",
                                    m
                                );
                                continue;
                            }
                        }

                        // Link
                        const input = args.join(' ');
                        const youtubeRegex = /(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/i;
                        const linkMatch = input.match(youtubeRegex);

                        if (linkMatch) {
                            await processarYoutubeUrl(sock, linkMatch[0], from, m.key, m);
                        } else {
                            await sendMessageWithChannelButton(sock, from,
                                templates.erro("Link não identificado!") + "\n\n📝 Exemplo:\n`.youtube https://youtu.be/ABC123`",
                                m
                            );
                        }
                        continue;
                    }

                    // === COMANDO .play ===
                    if (texto.startsWith('.play') && !texto.startsWith('.playmp4') && !texto.startsWith('.playdoc') && !texto.startsWith('.play_video')) {
                        const nome = messageText.trim().substring(5).trim();
                        
                        if (!nome) {
                            await sendMessageWithChannelButton(sock, from,
                                templates.info("Use `.play <nome da música>`") + "\n\n📝 Exemplo:\n`.play funk 2024`",
                                m
                            );
                            continue;
                        }
                        
                        await processarPlay(sock, nome, from, m.key, m);
                        continue;
                    }

                    // === COMANDO .playmp4 ===
                    if (texto.startsWith('.playmp4') || texto.startsWith('.play_video')) {
                        const prefixo = texto.startsWith('.playmp4') ? 9 : 12;
                        const nome = messageText.trim().substring(prefixo).trim();
                        
                        if (!nome) {
                            await sendMessageWithChannelButton(sock, from,
                                templates.info("Use `.playmp4 <nome do vídeo>`") + "\n\n📝 Exemplo:\n`.playmp4 gatinho fofo`",
                                m
                            );
                            continue;
                        }
                        
                        await processarPlay(sock, nome, from, m.key, m);
                        continue;
                    }

                    // === COMANDO .playdoc ===
                    if (texto.startsWith('.playdoc')) {
                        const nome = messageText.trim().substring(9).trim();
                        
                        if (!nome) {
                            await sendMessageWithChannelButton(sock, from,
                                templates.info("Use `.playdoc <nome da música>`") + "\n\n📝 Exemplo:\n`.playdoc lofi hip hop`",
                                m
                            );
                            continue;
                        }
                        
                        await processarPlay(sock, nome, from, m.key, m);
                        continue;
                    }

                    // === AUTO-DOWNLOAD ===
                    const youtubeRegex = /(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/gi;
                    const links = messageText.match(youtubeRegex);

                    if (links && links.length > 0) {
                        carregarConfig();
                        const isGroup = from.endsWith("@g.us");
                        const isActive = isGroup ? config.grupos[from] : config.usuarios[from];

                        if (isActive) {
                            setTimeout(async () => {
                                try {
                                    await processarYoutubeUrl(sock, links[0], from, m.key, m);
                                } catch (err) {
                                    console.log('❌ Erro no auto-download:', err);
                                }
                            }, 1000);
                        }
                    }

                } catch (err) {
                    console.log('❌ Erro no evento messages.upsert:', err);
                }
            }
        });
    },

    run: async (sock, msg, args) => {
        console.log('📺 run() do YouTube chamado (ignorando - init() cuida do evento)');
        return false;
    }
};
