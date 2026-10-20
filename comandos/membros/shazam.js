const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

// ======= LINK DO CANAL (OCULTO) =======
const CANAL_LINK = "https://whatsapp.com/channel/0029VbAn6gZ9sBI8Ajxt4N36";

// ======= CONFIGURAÇÃO DE PASTAS =======
const TEMP_DIR = path.join(__dirname, '../../temp');

if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// ======= CONTROLE DE DUPLICATAS =======
// Map para controlar quais mensagens já estão sendo processadas
// Formato: { "msgId_userJid": timestamp }
const EM_PROCESSAMENTO = new Map();

// Fila de IDs processados recentemente (anti-spam)
const PROCESSADOS_RECENTES = new Set();

// Limpa entradas antigas a cada 30 segundos
setInterval(() => {
    const agora = Date.now();
    for (const [key, timestamp] of EM_PROCESSAMENTO.entries()) {
        if (agora - timestamp > 30000) {
            EM_PROCESSAMENTO.delete(key);
        }
    }
}, 30000);

// =================== FUNÇÃO PARA ENVIAR MENSAGEM COM BOTÃO ===================
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

// =================== TEMPLATES ===================
const templates = {
    sucesso: (texto) => `✅ *${texto}*\n────────────────`,
    erro: (texto) => `❌ *${texto}*\n────────────────`,
    info: (texto) => `📌 *${texto}*\n────────────────`,
    processando: (texto) => `⏳ *${texto}*\n────────────────`,
    
    menuPrincipal: () => `
🎵 *SHAZAM - RECONHECER MÚSICA*

╔══════════════════════╗
║   📖 COMO USAR       ║
╠══════════════════════╣
║ 1. Envie um áudio    ║
║    ou voice note     ║
║                      ║
║ 2. Ou responda a    ║
║    um áudio com      ║
║    .shazam           ║
╚══════════════════════╝

🎵 *Eu vou identificar:*
• Título da música
• Nome do artista
• Capa do álbum
• Links de streaming

📝 *Exemplo:*
Envie um áudio e digite:
\`\`\`
.shazam
\`\`\`
────────────────`
};

// =================== FUNÇÃO PARA EXTRAIR LINKS ===================
function extrairLinks(track) {
    const links = [];
    const vistos = new Set();
    
    const adicionarLink = (tipo, url) => {
        if (!url || vistos.has(url)) return;
        vistos.add(url);
        links.push({ tipo, url });
    };
    
    // 1. Links do hub.actions (formato principal do Shazam)
    if (track.hub?.actions && Array.isArray(track.hub.actions)) {
        for (const action of track.hub.actions) {
            if (action.uri && action.type) {
                adicionarLink(action.type, action.uri);
            }
        }
    }
    
    // 2. Links das sections (formato alternativo)
    if (track.sections && Array.isArray(track.sections)) {
        for (const section of track.sections) {
            if (section.type === 'MUSIC' || section.type === 'SONG') {
                const metadata = section.metadata || [];
                for (const meta of metadata) {
                    if (meta.title && meta.text && (meta.title.includes('Apple') || meta.title.includes('Spotify') || meta.title.includes('YouTube') || meta.title.includes('Deezer'))) {
                        adicionarLink(meta.title, meta.text);
                    }
                }
            }
            
            // Links em actions dentro de sections
            if (section.actions && Array.isArray(section.actions)) {
                for (const action of section.actions) {
                    if (action.uri && action.type) {
                        adicionarLink(action.type, action.uri);
                    }
                }
            }
        }
    }
    
    // 3. Link do YouTube caso exista no track
    if (track.url && track.url.includes('youtube')) {
        adicionarLink('YouTube', track.url);
    }
    
    return links;
}

// =================== FUNÇÃO PARA EXTRAIR ÁUDIO ===================
function extrairAudio(msg) {
    try {
        if (msg.message?.audioMessage) {
            return { type: 'audio', message: msg };
        }
        
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (quoted?.audioMessage) {
            return {
                type: 'audio',
                message: {
                    key: { ...msg.key, id: msg.message.extendedTextMessage.contextInfo.stanzaId },
                    message: quoted
                }
            };
        }
        
        if (msg.message?.audioMessage?.ptt) {
            return { type: 'audio', message: msg };
        }
        
        return null;
    } catch (error) {
        console.log('❌ Erro ao extrair áudio:', error.message);
        return null;
    }
}

// =================== FUNÇÃO PARA BAIXAR ÁUDIO ===================
async function baixarAudio(sock, msg) {
    try {
        const buffer = await downloadMediaMessage(
            msg,
            'buffer',
            {},
            {
                logger: console,
                reuploadRequest: sock.updateMediaMessage
            }
        );
        return buffer;
    } catch (error) {
        console.log('❌ Erro ao baixar áudio:', error.message);
        return null;
    }
}

// =================== FUNÇÃO PRINCIPAL ===================
async function processarShazam(sock, msg, from, msgKey, originalMsg) {
    try {
        // === CONTROLE DE DUPLICATA ===
        // Cria uma chave única para essa mensagem + usuário
        const userJid = msgKey.participant || from;
        const msgId = msgKey.id;
        const chave = `${msgId}_${userJid}`;
        
        // Se já está processando, ignora
        if (EM_PROCESSAMENTO.has(chave)) {
            console.log(`⚠️ Shazam duplicado detectado e ignorado: ${chave}`);
            return false;
        }
        
        // Se já foi processado recentemente, ignora
        if (PROCESSADOS_RECENTES.has(chave)) {
            console.log(`⚠️ Shazam já processado recentemente: ${chave}`);
            return false;
        }
        
        // Marca como em processamento
        EM_PROCESSAMENTO.set(chave, Date.now());
        PROCESSADOS_RECENTES.add(chave);
        
        // Remove da lista de recentes após 15 segundos
        setTimeout(() => PROCESSADOS_RECENTES.delete(chave), 15000);

        console.log('🎵 Processando Shazam...');

        const audioInfo = extrairAudio(originalMsg);
        
        if (!audioInfo) {
            await sendMessageWithChannelButton(sock, from,
                templates.erro("Nenhum áudio encontrado!") + "\n\n" +
                "📝 *Como usar:*\n" +
                "1. Envie um áudio ou voice note\n" +
                "2. Digite `.shazam`\n\n" +
                "📌 Ou responda a um áudio com `.shazam`",
                originalMsg
            );
            EM_PROCESSAMENTO.delete(chave);
            return false;
        }

        await sock.sendMessage(from, { react: { text: "⏳", key: msgKey } });

        const audioBuffer = await baixarAudio(sock, audioInfo.message);
        
        if (!audioBuffer) {
            await sendMessageWithChannelButton(sock, from,
                templates.erro("Erro ao baixar o áudio!") + "\n\n🔄 Tente novamente",
                originalMsg
            );
            EM_PROCESSAMENTO.delete(chave);
            return false;
        }

        console.log('🎵 Identificando música...');
        
        let resultado;
        
        try {
            const shazamModule = require('shazamio-api');
            
            if (typeof shazamModule.recognize === 'function') {
                resultado = await shazamModule.recognize(audioBuffer);
            } else if (shazamModule.Shazam) {
                const shazam = new shazamModule.Shazam();
                resultado = await shazam.recognize(audioBuffer);
            } else {
                throw new Error('shazamio-api: nenhuma função de reconhecimento encontrada');
            }
        } catch (err) {
            console.log('❌ Erro no Shazam - Tipo:', err.constructor?.name);
            console.log('❌ Erro no Shazam - Mensagem:', err.message);
            
            const errName = err.constructor?.name || 'Erro';
            const errMsg = err.message || 'Erro desconhecido';
            
            if (errName === 'NoMatchesFoundError' || errMsg.includes('NoMatchesFound') || errMsg.includes('No matches')) {
                await sendMessageWithChannelButton(sock, from,
                    templates.erro("Música não encontrada!") + "\n\n" +
                    "🔍 *Possíveis motivos:*\n" +
                    "• O áudio é muito curto\n" +
                    "• A qualidade está baixa\n" +
                    "• O ruído é muito alto\n" +
                    "• A música não está no Shazam\n\n" +
                    "🎵 Tente com um trecho maior e mais limpo",
                    originalMsg
                );
            } else {
                await sendMessageWithChannelButton(sock, from,
                    templates.erro("Erro no reconhecimento!") + "\n\n" +
                    `⚠️ *Detalhe:* ${errName}\n` +
                    "🔄 Tente novamente em alguns instantes",
                    originalMsg
                );
            }
            
            await sock.sendMessage(from, { react: { text: "❌", key: msgKey } });
            EM_PROCESSAMENTO.delete(chave);
            return false;
        }

        if (!resultado || !resultado.track) {
            await sendMessageWithChannelButton(sock, from,
                templates.erro("Música não encontrada!") + "\n\n" +
                "🔍 Tente com um trecho maior e mais limpo",
                originalMsg
            );
            await sock.sendMessage(from, { react: { text: "❌", key: msgKey } });
            EM_PROCESSAMENTO.delete(chave);
            return false;
        }

        const track = resultado.track;
        console.log(`🎵 Música encontrada: ${track.title} - ${track.subtitle}`);

        // === EXTRAIR LINKS (VERSÃO MELHORADA) ===
        const links = extrairLinks(track);
        
        let linksTexto = '';
        if (links.length > 0) {
            linksTexto = links.map(l => `┃ 🔗 *${l.tipo}:* ${l.url}`).join('\n');
        } else {
            linksTexto = '┃ ⚠️ Nenhum link disponível';
        }

        const infoMsg = `╭━━━〔 🎵 *SHAZAM* 〕━━━╮
┃
┃ 🎶 *Título:* ${track.title || 'Desconhecido'}
┃ 🎤 *Artista:* ${track.subtitle || 'Desconhecido'}
┃
┃ 📌 *Links:*
${linksTexto}
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

        if (track.images?.coverart) {
            try {
                await sock.sendMessage(from, {
                    image: { url: track.images.coverart },
                    caption: `🎵 *${track.title}*\n🎤 ${track.subtitle}`
                }, { quoted: originalMsg });
            } catch (e) {
                console.log('⚠️ Erro ao enviar capa:', e.message);
            }
        }

        await sendMessageWithChannelButton(sock, from, infoMsg, originalMsg);
        await sock.sendMessage(from, { react: { text: "✅", key: msgKey } });

        // Remove da lista de processamento após concluir
        EM_PROCESSAMENTO.delete(chave);

        return true;

    } catch (error) {
        console.error('❌ Erro no processamento Shazam:', error);
        
        await sock.sendMessage(from, { react: { text: "❌", key: msgKey } });
        
        await sendMessageWithChannelButton(sock, from,
            templates.erro("Erro no processamento!") + "\n\n" +
            "🔄 *Tente novamente em 1-2 minutos*",
            originalMsg
        );
        
        return false;
    }
}

module.exports = {
    nome: "shazam",

    init: (sock) => {
        console.log('🎵 Inicializando comando Shazam...');

        // === FLAG PARA EVITAR REGISTRO DUPLO ===
        if (sock.__shazamListenerRegistered) {
            console.log('⚠️ Listener Shazam já registrado, ignorando duplicata');
            return;
        }
        sock.__shazamListenerRegistered = true;

        sock.ev.on("messages.upsert", async ({ messages }) => {
            for (const m of messages) {
                try {
                    if (!m?.message) continue;
                    // Ignorar mensagens enviadas pelo próprio bot
                    if (m.key?.fromMe) continue;

                    const from = m.key.remoteJid;
                    if (!from) continue;

                    const messageText = m.message.conversation || 
                                        m.message.extendedTextMessage?.text || 
                                        m.message.imageMessage?.caption || 
                                        "";

                    const texto = messageText.trim().toLowerCase();

                    if (texto === '.shazam' || texto === '.shazam help') {
                        
                        if (texto === '.shazam help') {
                            await sendMessageWithChannelButton(sock, from, templates.menuPrincipal(), m);
                            continue;
                        }

                        await processarShazam(sock, m, from, m.key, m);
                        continue;
                    }

                } catch (err) {
                    console.log('❌ Erro no evento messages.upsert:', err);
                }
            }
        });
    },

    run: async (sock, msg, args) => {
        // O run() só é chamado se o handler principal do bot o invocar.
        // Como o init() já cuida do evento, evitamos processamento duplo aqui.
        console.log('🎵 run() do Shazam chamado (ignorando - init() cuida do evento)');
        return false;
    }
};
