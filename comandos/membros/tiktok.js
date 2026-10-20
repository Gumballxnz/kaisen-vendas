const fs = require('fs');
const path = require('path');
const axios = require('axios');

const API_KEY_BRONXYS = "danilo85";

// ======= LINK DO CANAL (OCULTO) =======
const CANAL_LINK = "https://whatsapp.com/channel/0029VbAn6gZ9sBI8Ajxt4N36";

// ======= CONFIGURAÇÃO DE PASTAS =======
const DATABASE_DIR = './database';
const TEMP_DIR = path.join(__dirname, '../../temp');

// ======= CONFIGURAÇÃO =======
const arquivo = path.join(__dirname, `../${DATABASE_DIR}/autoTiktok.json`);

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
async function criarMensagemComBotoes(sock, jid, texto, botoes, quotedMsg, titulo = "🎵 TIKTOK") {
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
                { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '📹 VÍDEO (MP4)', id: 'tt_video' }) },
                { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🎵 ÁUDIO (MP3)', id: 'tt_audio' }) },
                { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '📄 DOCUMENTO', id: 'tt_doc' }) }
            ];
        }

        if (generateWAMessageFromContent && relayMessage) {
            const interactiveMessage = {
                header: { title: titulo, hasMediaAttachment: false },
                body: { text: toSpecialStyle(texto) },
                footer: { text: "⚡ CyberHost • TikTok" },
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
🎵 *TIKTOK DOWNLOADER*

📊 *Status Auto-download:* ${status}

╔══════════════════════╗
║   🔧 COMANDOS ADMIN  ║
╠══════════════════════╣
║ • .tiktok on        ║
║ • .tiktok off       ║
╠══════════════════════╣
║   👥 PARA TODOS      ║
╠══════════════════════╣
║ • .tiktok <link>    ║
╚══════════════════════╝

📋 *Tipos suportados:*
📹 Vídeo (MP4) • 🎵 Áudio (MP3) • 📄 Documento

📋 *Exemplo:*
\`\`\`
.tiktok https://vm.tiktok.com/ABC123
.tiktok https://www.tiktok.com/@user/video/123
\`\`\`
────────────────`
};

// =================== RESOLVER LINK CURTO ===================
async function resolverLinkCurto(url) {
    if (!url.includes('vm.tiktok.com') && !url.includes('vt.tiktok.com')) return url;
    
    try {
        const response = await axios.get(url, {
            maxRedirects: 5,
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const finalUrl = response.request?.res?.responseUrl || response.config?.url;
        
        if (finalUrl && finalUrl.includes('tiktok.com')) {
            console.log(`✅ Link TikTok resolvido: ${url} → ${finalUrl}`);
            return finalUrl;
        }
    } catch (error) {
        console.log('⚠️ Erro ao resolver link curto:', error.message);
    }
    
    return url;
}

// =================== TENTATIVA 1: API BRONXYS ===================
async function fetchTikTokBronxys(url) {
    try {
        console.log('📡 Tentando API Bronxys...');
        
        const { data } = await axios.get('https://api.bronxyshost.com.br/api-bronxys/tiktok', {
            params: { url: url, apikey: API_KEY_BRONXYS },
            timeout: 30000
        });
        
        console.log('📋 Resposta Bronxys:', JSON.stringify(data).substring(0, 300));
        
        if (typeof data === 'string' && data.startsWith('http')) {
            return {
                status: true,
                result: {
                    video: data,
                    audio: data,
                    title: 'Vídeo do TikTok'
                }
            };
        }
        
        if (data && (data.video || data.url || data.play)) {
            return {
                status: true,
                result: {
                    video: data.video || data.url || data.play,
                    audio: data.audio || data.music || data.video || data.url,
                    title: data.title || data.desc || 'Vídeo do TikTok'
                }
            };
        }
        
        if (data?.result) {
            const info = data.result;
            return {
                status: true,
                result: {
                    video: info.video || info.url || info.play || info.download,
                    audio: info.audio || info.music || info.video || info.url,
                    title: info.title || info.desc || 'Vídeo do TikTok'
                }
            };
        }
        
        return null;
    } catch (err) {
        console.log('⚠️ API Bronxys falhou:', err.message);
        return null;
    }
}

// =================== TENTATIVA 2: API TIKXEDD (CORRIGIDA) ===================
async function fetchTikTokTikXedd(url) {
    try {
        console.log('📡 Tentando API TikXedd (fallback)...');
        
        const { data } = await axios.get('https://tikxedd.vercel.app/api/resolve', {
            params: { url: url },
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        });
        
        console.log('📋 Resposta TikXedd:', JSON.stringify(data).substring(0, 800));
        
        if (!data || data.ok === false) return null;
        
        const item = data.item || data.data || data.result || data;
        
        if (!item) return null;
        
        let videoUrl = null;
        let audioUrl = null;
        let titulo = 'Vídeo do TikTok';
        
        // Título
        if (item.title) titulo = item.title;
        else if (item.desc) titulo = item.desc;
        
        // === CORREÇÃO PRINCIPAL: o campo video pode ser string OU objeto ===
        
        // 1. Se item.video for string direta
        if (typeof item.video === 'string' && item.video.startsWith('http')) {
            videoUrl = item.video;
            console.log('✅ Vídeo encontrado em item.video (string)');
        }
        
        // 2. Se item.video for objeto, procurar dentro dele
        if (!videoUrl && item.video && typeof item.video === 'object') {
            const camposVideo = [
                'noWatermark', 'no_watermark', 'nowatermark',
                'playAddr', 'play_addr', 'play',
                'downloadAddr', 'download_addr', 'download',
                'url', 'hd', 'sd', 'video', 'link'
            ];
            for (const campo of camposVideo) {
                if (item.video[campo] && typeof item.video[campo] === 'string' && item.video[campo].startsWith('http')) {
                    videoUrl = item.video[campo];
                    console.log(`✅ Vídeo encontrado em item.video.${campo}`);
                    break;
                }
                if (Array.isArray(item.video[campo]) && item.video[campo][0]?.url) {
                    videoUrl = item.video[campo][0].url;
                    console.log(`✅ Vídeo encontrado em item.video.${campo}[0].url`);
                    break;
                }
            }
            
            // Se ainda não achou, logar a estrutura
            if (!videoUrl) {
                console.log('⚠️ Estrutura de item.video:', JSON.stringify(item.video).substring(0, 400));
            }
        }
        
        // 3. Fallback: procurar em qualquer campo do item
        if (!videoUrl) {
            const camposAlternativos = [
                'videoUrl', 'video_url', 'play', 'playAddr', 'play_addr',
                'download', 'downloadAddr', 'download_addr', 'url',
                'nwm', 'no_watermark', 'noWatermark'
            ];
            for (const campo of camposAlternativos) {
                if (item[campo] && typeof item[campo] === 'string' && item[campo].startsWith('http')) {
                    videoUrl = item[campo];
                    console.log(`✅ Vídeo encontrado em item.${campo}`);
                    break;
                }
            }
        }
        
        // 4. Procurar em downloads
        if (!videoUrl && item.downloads) {
            const dl = item.downloads;
            const dlCampos = ['no_watermark', 'noWatermark', 'video', 'play', 'hd', 'sd', 'url'];
            for (const campo of dlCampos) {
                if (dl[campo] && typeof dl[campo] === 'string' && dl[campo].startsWith('http')) {
                    videoUrl = dl[campo];
                    console.log(`✅ Vídeo encontrado em item.downloads.${campo}`);
                    break;
                }
                if (Array.isArray(dl[campo]) && dl[campo][0]?.url) {
                    videoUrl = dl[campo][0].url;
                    break;
                }
            }
        }
        
        // === ÁUDIO ===
        if (typeof item.music === 'string' && item.music.startsWith('http')) {
            audioUrl = item.music;
        } else if (item.music && typeof item.music === 'object') {
            const camposMusic = ['playUrl', 'play_url', 'downloadUrl', 'download_url', 'url', 'play', 'link'];
            for (const campo of camposMusic) {
                if (item.music[campo] && typeof item.music[campo] === 'string' && item.music[campo].startsWith('http')) {
                    audioUrl = item.music[campo];
                    console.log(`✅ Áudio encontrado em item.music.${campo}`);
                    break;
                }
            }
        }
        
        // Áudio alternativo
        if (!audioUrl) {
            const camposAudio = ['audio', 'audioUrl', 'audio_url', 'musicUrl', 'music_url'];
            for (const campo of camposAudio) {
                if (item[campo] && typeof item[campo] === 'string' && item[campo].startsWith('http')) {
                    audioUrl = item[campo];
                    break;
                }
            }
        }
        
        if (!videoUrl) {
            console.log('⚠️ TikXedd: nenhum link de vídeo encontrado.');
            return null;
        }
        
        console.log(`✅ URL final do vídeo: ${videoUrl.substring(0, 80)}...`);
        
        return {
            status: true,
            result: {
                video: videoUrl,
                audio: audioUrl || videoUrl,
                title: titulo
            }
        };
        
    } catch (err) {
        console.log('⚠️ API TikXedd falhou:', err.message);
        return null;
    }
}

// =================== FETCH PRINCIPAL ===================
async function fetchTikTok(url) {
    // Tentativa 1: API Bronxys
    const resultadoBronxys = await fetchTikTokBronxys(url);
    if (resultadoBronxys && resultadoBronxys.result && resultadoBronxys.result.video) {
        console.log('✅ API Bronxys retornou dados');
        return resultadoBronxys;
    }
    
    // Tentativa 2: API TikXedd
    console.log('⚠️ Bronxys falhou, tentando TikXedd...');
    const resultadoTikXedd = await fetchTikTokTikXedd(url);
    if (resultadoTikXedd && resultadoTikXedd.result && resultadoTikXedd.result.video) {
        console.log('✅ API TikXedd retornou dados');
        return resultadoTikXedd;
    }
    
    console.log('❌ Todas as APIs falharam');
    return null;
}

// =================== FUNÇÕES DE DOWNLOAD ===================

async function baixarVideoTikTok(sock, videoUrl, from, msgKey, originalMsg, info) {
    try {
        await sock.sendMessage(from, {
            video: { url: videoUrl },
            mimetype: "video/mp4",
            caption: `📹 *TikTok baixado!*\n────────────────\n📌 *Título:* ${(info.title || 'Vídeo do TikTok').substring(0, 100)}`
        }, { quoted: originalMsg });

        await sock.sendMessage(from, { react: { text: "✅", key: msgKey } });
        return true;
    } catch (error) {
        console.error('❌ Erro no download do vídeo:', error);
        return false;
    }
}

async function baixarAudioTikTok(sock, audioUrl, from, msgKey, originalMsg, info) {
    try {
        await sock.sendMessage(from, {
            audio: { url: audioUrl },
            mimetype: "audio/mpeg",
            fileName: `${(info.title || 'tiktok_audio').substring(0, 50)}.mp3`,
            ptt: false
        }, { quoted: originalMsg });

        await sock.sendMessage(from, { react: { text: "✅", key: msgKey } });
        return true;
    } catch (error) {
        console.error('❌ Erro no download do áudio:', error);
        return false;
    }
}

async function baixarDocumentoTikTok(sock, videoUrl, from, msgKey, originalMsg, info) {
    try {
        await sock.sendMessage(from, {
            document: { url: videoUrl },
            mimetype: "video/mp4",
            fileName: `${(info.title || 'tiktok_video').substring(0, 50)}.mp4`
        }, { quoted: originalMsg });

        await sock.sendMessage(from, { react: { text: "✅", key: msgKey } });
        return true;
    } catch (error) {
        console.error('❌ Erro no download do documento:', error);
        return false;
    }
}

// =================== FUNÇÃO PRINCIPAL ===================
async function processarTikTok(sock, url, from, msgKey, originalMsg) {
    try {
        const userJid = msgKey.participant || from;
        const chave = `${msgKey.id}_${userJid}`;
        
        if (EM_PROCESSAMENTO.has(chave) || PROCESSADOS_RECENTES.has(chave)) {
            console.log(`⚠️ TikTok duplicado ignorado: ${chave}`);
            return false;
        }
        
        EM_PROCESSAMENTO.set(chave, Date.now());
        PROCESSADOS_RECENTES.add(chave);
        setTimeout(() => PROCESSADOS_RECENTES.delete(chave), 15000);

        console.log(`🎵 Processando TikTok: ${url}`);

        const tiktokRegex = /(https?:\/\/)?(www\.|vm\.|vt\.|m\.)?tiktok\.com\/.+/i;
        if (!tiktokRegex.test(url)) {
            await sendMessageWithChannelButton(sock, from,
                templates.erro("Link inválido!") + "\n\n" +
                "📝 *Formatos:*\n• `tiktok.com/@user/video/...`\n• `vm.tiktok.com/...`\n• `vt.tiktok.com/...`",
                originalMsg
            );
            EM_PROCESSAMENTO.delete(chave);
            return false;
        }

        await sock.sendMessage(from, { react: { text: "⏳", key: msgKey } });

        url = await resolverLinkCurto(url);

        const tiktokData = await fetchTikTok(url);
        
        if (!tiktokData || !tiktokData.result || !tiktokData.result.video) {
            await sendMessageWithChannelButton(sock, from,
                templates.erro("Conteúdo não encontrado!") + "\n\n" +
                "🔍 *Verifique se:*\n" +
                "• O link está correto\n" +
                "• O vídeo é público\n" +
                "• O vídeo não foi removido\n\n" +
                "🔄 Tente outro link",
                originalMsg
            );
            await sock.sendMessage(from, { react: { text: "❌", key: msgKey } });
            EM_PROCESSAMENTO.delete(chave);
            return false;
        }

        const info = tiktokData.result;
        const videoUrl = info.video;
        const audioUrl = info.audio || info.video;

        const userKey = `${from}_${msgKey.participant || from}`;
        const arquivoTemp = path.join(TEMP_DIR, `tt_${userKey.replace(/[^a-zA-Z0-9]/g, '_')}.json`);
        fs.writeFileSync(arquivoTemp, JSON.stringify({
            url: url,
            video: videoUrl,
            audio: audioUrl,
            title: info.title,
            timestamp: Date.now()
        }));

        const tituloCurto = (info.title || 'Vídeo do TikTok').substring(0, 150);

        const infoMsg = `╭━━━〔 🎵 *TIKTOK* 〕━━━╮
┃
┃ 📌 *Título:* ${tituloCurto}
┃
┃ 📌 *Escolha o formato:*
┃    Clique nos botões abaixo!
╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

        const botoes = [
            { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '📹 VÍDEO (MP4)', id: 'tt_video' }) },
            { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🎵 ÁUDIO (MP3)', id: 'tt_audio' }) },
            { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '📄 DOCUMENTO', id: 'tt_doc' }) }
        ];

        await criarMensagemComBotoes(sock, from, infoMsg, botoes, originalMsg, "🎵 TIKTOK");
        EM_PROCESSAMENTO.delete(chave);
        return true;

    } catch (error) {
        console.error('❌ Erro no processamento TikTok:', error);
        await sock.sendMessage(from, { react: { text: "❌", key: msgKey } });
        await sendMessageWithChannelButton(sock, from,
            templates.erro("Erro no processamento!") + "\n\n🔄 *Tente novamente em 1-2 minutos*",
            originalMsg
        );
        return false;
    }
}

// =================== PROCESSAR CLIQUE DE BOTÃO ===================
async function processarCliqueBotaoTikTok(sock, msg, jid, remetente) {
    try {
        const cliqueId = detectarCliqueBotao(msg);
        if (!cliqueId) return false;
        if (!cliqueId.startsWith('tt_')) return false;

        const comando = cliqueId.substring(3);
        const userKey = `${jid}_${remetente}`;
        const arquivoTemp = path.join(TEMP_DIR, `tt_${userKey.replace(/[^a-zA-Z0-9]/g, '_')}.json`);

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
                "⚠️ *Nenhum conteúdo encontrado!*\n\nUse `.tiktok <link>` primeiro.",
                msg
            );
            return true;
        }

        if (comando === 'video') {
            await sock.sendMessage(jid, { react: { text: "⏳", key: msg.key } });
            await baixarVideoTikTok(sock, dados.video, jid, msg.key, msg, dados);
            return true;
        }

        if (comando === 'audio') {
            await sock.sendMessage(jid, { react: { text: "⏳", key: msg.key } });
            await baixarAudioTikTok(sock, dados.audio, jid, msg.key, msg, dados);
            return true;
        }

        if (comando === 'doc') {
            await sock.sendMessage(jid, { react: { text: "⏳", key: msg.key } });
            await baixarDocumentoTikTok(sock, dados.video, jid, msg.key, msg, dados);
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
    nome: "tiktok",

    init: (sock) => {
        console.log('🎵 Inicializando comando TikTok...');

        if (sock.__tiktokListenerRegistered) {
            console.log('⚠️ Listener TikTok já registrado, ignorando duplicata');
            return;
        }
        sock.__tiktokListenerRegistered = true;

        sock.ev.on("messages.upsert", async ({ messages }) => {
            for (const m of messages) {
                try {
                    if (!m?.message) continue;
                    if (m.key?.fromMe) continue;

                    const from = m.key.remoteJid;
                    if (!from) continue;

                    const remetente = m.key.participant || from;

                    const isBotao = await processarCliqueBotaoTikTok(sock, m, from, remetente);
                    if (isBotao) continue;

                    const messageText = m.message.conversation || 
                                        m.message.extendedTextMessage?.text || 
                                        m.message.imageMessage?.caption || 
                                        "";

                    const texto = messageText.trim().toLowerCase();

                    if (texto.startsWith('.tiktok')) {
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
                                    templates.sucesso("Auto-download ATIVADO!") + "\n\n🎵 Agora baixo automaticamente links do TikTok!",
                                    m
                                );
                                continue;
                            }

                            if (sub === "off") {
                                if (isGroup) delete config.grupos[from];
                                else delete config.usuarios[from];
                                salvarConfig();
                                
                                await sendMessageWithChannelButton(sock, from,
                                    templates.info("Auto-download DESATIVADO") + "\n\n📝 Use `.tiktok <link>` manualmente",
                                    m
                                );
                                continue;
                            }
                        }

                        const input = args.join(' ');
                        const tiktokRegex = /(https?:\/\/)?(www\.|vm\.|vt\.|m\.)?tiktok\.com\/.+/i;
                        const linkMatch = input.match(tiktokRegex);

                        if (linkMatch) {
                            await processarTikTok(sock, linkMatch[0], from, m.key, m);
                        } else {
                            await sendMessageWithChannelButton(sock, from,
                                templates.erro("Link não identificado!") + "\n\n📝 Exemplo:\n`.tiktok https://vm.tiktok.com/ABC123`",
                                m
                            );
                        }
                        continue;
                    }

                    const tiktokRegex = /(https?:\/\/)?(www\.|vm\.|vt\.|m\.)?tiktok\.com\/.+/gi;
                    const links = messageText.match(tiktokRegex);

                    if (links && links.length > 0) {
                        carregarConfig();
                        const isGroup = from.endsWith("@g.us");
                        const isActive = isGroup ? config.grupos[from] : config.usuarios[from];

                        if (isActive) {
                            setTimeout(async () => {
                                try {
                                    await processarTikTok(sock, links[0], from, m.key, m);
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
        console.log('🎵 run() do TikTok chamado (ignorando - init() cuida do evento)');
        return false;
    }
};
