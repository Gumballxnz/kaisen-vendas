const fs = require('fs');
const path = require('path');
const axios = require('axios');

const API_KEY_BRONXYS = "85";

// ======= LINK DO CANAL (OCULTO) =======
const CANAL_LINK = "https://whatsapp.com/channel/0029VbAn6gZ9sBI8Ajxt4N36";

// ======= CONFIGURAÇÃO DE PASTAS =======
const DATABASE_DIR = './database';
const MENU_DIR = path.join(__dirname, '../../database/menu');
const GIF_PATH = path.join(MENU_DIR, 'bot.gif');
const TEMP_DIR = path.join(__dirname, '../../temp');

// ======= CONFIGURAÇÃO =======
const arquivo = path.join(__dirname, `../${DATABASE_DIR}/autoPinterest.json`);

// Config inicial
let config = { grupos: {}, usuarios: {} };
if (fs.existsSync(arquivo)) {
  try {
    config = JSON.parse(fs.readFileSync(arquivo, "utf8"));
  } catch {
    config = { grupos: {}, usuarios: {} };
  }
}

// Garantir que as pastas existem
if (!fs.existsSync(MENU_DIR)) {
  fs.mkdirSync(MENU_DIR, { recursive: true });
}
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Set para evitar processamento duplicado
const PROCESSADOS = new Set();

const salvarConfig = () => {
  try {
    const dir = path.dirname(arquivo);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(arquivo, JSON.stringify(config, null, 2));
  } catch (e) {
    console.log('❌ Erro ao salvar config:', e.message);
  }
};

const carregarConfig = () => {
  try {
    const dir = path.dirname(arquivo);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
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

// =================== DETECTAR CLIQUE DE BOTÃO ===================
function detectarCliqueBotao(msg) {
    try {
        if (msg.message?.interactiveResponseMessage) {
            const interactive = msg.message.interactiveResponseMessage;
            
            if (interactive.nativeFlowResponseMessage?.paramsJson) {
                const params = JSON.parse(interactive.nativeFlowResponseMessage.paramsJson);
                if (params.id) {
                    console.log('📌 Botão interactive detectado:', params.id);
                    return params.id;
                }
            }
            
            if (interactive.nativeFlowResponseMessage?.selectedDisplayText) {
                const text = interactive.nativeFlowResponseMessage.selectedDisplayText;
                console.log('📌 Botão interactive display text:', text);
                return text;
            }
        }
        
        if (msg.message?.buttonsResponseMessage) {
            const buttons = msg.message.buttonsResponseMessage;
            if (buttons.selectedButtonId) {
                console.log('📌 Botão buttons detectado:', buttons.selectedButtonId);
                return buttons.selectedButtonId;
            }
            if (buttons.selectedDisplayText) {
                console.log('📌 Botão buttons display text:', buttons.selectedDisplayText);
                return buttons.selectedDisplayText;
            }
        }
        
        if (msg.message?.templateButtonReplyMessage) {
            const template = msg.message.templateButtonReplyMessage;
            if (template.selectedId) {
                console.log('📌 Botão template detectado:', template.selectedId);
                return template.selectedId;
            }
            if (template.selectedDisplayText) {
                console.log('📌 Botão template display text:', template.selectedDisplayText);
                return template.selectedDisplayText;
            }
        }
        
        return null;
    } catch (error) {
        console.log('❌ Erro ao detectar clique de botão:', error.message);
        return null;
    }
}

// =================== FUNÇÃO PARA CRIAR MENSAGEM COM BOTÕES ===================
async function criarMensagemComBotoes(sock, jid, texto, botoes, quotedMsg, titulo = "📌 PINTEREST") {
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
                {
                    name: 'quick_reply',
                    buttonParamsJson: JSON.stringify({
                        display_text: '📸 IMAGEM',
                        id: 'pin_imagem'
                    })
                },
                {
                    name: 'quick_reply',
                    buttonParamsJson: JSON.stringify({
                        display_text: '📹 VÍDEO (MP4)',
                        id: 'pin_video'
                    })
                }
            ];
        }

        if (generateWAMessageFromContent && relayMessage) {
            const interactiveMessage = {
                header: {
                    title: titulo,
                    hasMediaAttachment: false
                },
                body: {
                    text: toSpecialStyle(texto)
                },
                footer: {
                    text: "⚡ CyberHost • Pinterest"
                },
                nativeFlowMessage: {
                    buttons: botoes
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
            return true;
        } else {
            await sock.sendMessage(jid, { text: toSpecialStyle(texto) }, { quoted: quotedMsg });
            return false;
        }
    } catch (error) {
        console.log('❌ Erro ao criar mensagem com botões:', error.message);
        try {
            await sock.sendMessage(jid, { text: toSpecialStyle(texto) }, { quoted: quotedMsg });
        } catch (e) {
            console.log('❌ Erro no fallback:', e.message);
        }
        return false;
    }
}

// 🎭 TEMPLATES DE MENSAGENS ESTILIZADAS
const templates = {
  sucesso: (texto) => `✅ *${texto}*\n────────────────`,
  erro: (texto) => `❌ *${texto}*\n────────────────`,
  info: (texto) => `📌 *${texto}*\n────────────────`,
  processando: (texto) => `⏳ *${texto}*\n────────────────`,
  download: (texto) => `📥 *${texto}*\n────────────────`,
  
  menuPrincipal: (status) => `
📌 *PINTEREST DOWNLOADER*

📊 *Status:* ${status}

╔══════════════════════╗
║   🔧 COMANDOS ADMIN  ║
╠══════════════════════╣
║ • .pinterest on     ║
║ • .pinterest off    ║
╠══════════════════════╣
║   👥 PARA TODOS      ║
╠══════════════════════╣
║ • .pin <link>       ║
║ • .pin <nome>       ║
║ • .pinmp4 <nome>    ║
╚══════════════════════╝

📋 *Tipos suportados:*
📸 Imagens • 🎬 Vídeos • 🎞️ GIFs

📋 *Exemplos:*
\`\`\`
.pin https://pin.it/ABC123
.pin gatos fofos
.pinmp4 paisagens
\`\`\`
────────────────`
};

// =================== RESOLVER LINK CURTO (pin.it) ===================
async function resolverLinkCurto(url) {
  if (!url.includes('pin.it')) return url;
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7'
  };
  
  try {
    const response = await axios.get(url, {
      maxRedirects: 5,
      timeout: 15000,
      headers
    });
    
    const finalUrl = response.request?.res?.responseUrl || response.config?.url;
    
    if (finalUrl && finalUrl.includes('pinterest.com/pin/')) {
      console.log(`✅ Link resolvido: ${url} → ${finalUrl}`);
      return finalUrl;
    }
    
    const html = String(response.data);
    const match = html.match(/https?:\/\/(www\.|br\.)?pinterest\.[a-z.]+\/pin\/(\d+)/i);
    if (match) {
      console.log(`✅ Link extraído do HTML: ${match[0]}`);
      return match[0];
    }
    
  } catch (error) {
    console.log('⚠️ Tentativa 1 falhou:', error.message);
  }
  
  try {
    const response = await axios.get(url, {
      maxRedirects: 0,
      validateStatus: status => status >= 300 && status < 400,
      timeout: 15000,
      headers
    });
    
    const location = response.headers.location;
    if (location) {
      if (location.includes('pinterest.com/pin/')) {
        console.log(`✅ Link resolvido (tentativa 2): ${location}`);
        return location;
      }
      if (location.includes('pin.it')) {
        return await resolverLinkCurto(location);
      }
    }
  } catch (err2) {
    console.log('⚠️ Tentativa 2 falhou:', err2.message);
    
    if (err2.response?.headers?.location) {
      const location = err2.response.headers.location;
      if (location.includes('pinterest.com/pin/')) {
        return location;
      }
    }
  }
  
  console.log('❌ Não foi possível resolver o link curto:', url);
  return url;
}

// =================== SCRAPING DO PINTEREST (VERSÃO PRECISA) ===================
async function scrapingPinterest(url) {
  try {
    console.log(`🔍 Fazendo scraping: ${url}`);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      maxRedirects: 5,
      timeout: 20000
    });
    
    const html = String(response.data);
    const result = { status: true, result: { media: [] } };
    
    const ogImagePatterns = [
      /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i,
      /<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i,
      /<meta\s+name=["']og:image["']\s+content=["']([^"']+)["']/i
    ];
    
    let imagemPrincipal = null;
    for (const pattern of ogImagePatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        imagemPrincipal = match[1].replace(/&amp;/g, '&');
        console.log(`✅ og:image encontrado: ${imagemPrincipal}`);
        break;
      }
    }
    
    const ogVideoPatterns = [
      /<meta\s+property=["']og:video["']\s+content=["']([^"']+)["']/i,
      /"videoUrl"\s*:\s*"([^"]+\.mp4)"/i,
      /"url"\s*:\s*"(https:\/\/v\d*\.pinimg\.com\/[^"]+\.mp4)"/i
    ];
    
    let videoUrl = null;
    for (const pattern of ogVideoPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        let candidate = match[1].replace(/&amp;/g, '&').replace(/\\u002F/g, '/');
        if (candidate.startsWith('https://v') && candidate.includes('.pinimg.com')) {
          videoUrl = candidate;
          console.log(`✅ Vídeo encontrado: ${videoUrl}`);
          break;
        }
      }
    }
    
    if (!imagemPrincipal) {
      const jsonPatterns = [
        /"image_url"\s*:\s*"(https:\/\/i\.pinimg\.com\/originals\/[^"]+)"/i,
        /"imageUrl"\s*:\s*"(https:\/\/i\.pinimg\.com\/originals\/[^"]+)"/i
      ];
      
      for (const pattern of jsonPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          imagemPrincipal = match[1].replace(/\\u002F/g, '/');
          console.log(`✅ Imagem do JSON: ${imagemPrincipal}`);
          break;
        }
      }
    }
    
    if (!imagemPrincipal) {
      const match = html.match(/https:\/\/i\.pinimg\.com\/originals\/[a-f0-9\/]+\.(jpg|jpeg|png|gif|webp)/i);
      if (match) {
        imagemPrincipal = match[0];
      }
    }
    
    if (imagemPrincipal) {
      imagemPrincipal = imagemPrincipal
        .replace('/736x/', '/originals/')
        .replace('/564x/', '/originals/')
        .replace('/474x/', '/originals/');
      
      result.result.media.push({
        url: imagemPrincipal,
        type: 'image'
      });
    }
    
    if (videoUrl) {
      result.result.media.push({
        url: videoUrl,
        type: 'video'
      });
    }
    
    console.log(`🔍 Resultado: ${result.result.media.length} mídia(s) encontrada(s)`);
    
    if (result.result.media.length === 0) {
      return null;
    }
    
    return result;
  } catch (error) {
    console.log('❌ Erro no scraping:', error.message);
    return null;
  }
}

// =================== FETCH PRINCIPAL (URL OU QUERY) ===================
async function fetchPinterest(input, isSearch = false) {
  try {
    const urlApi = `https://api.bronxyshost.com.br/api-bronxys/pinterest`;
    
    // Se for pesquisa, usa o parâmetro 'query', senão usa 'url'
    const params = isSearch 
      ? { query: input, limit: 5, apikey: API_KEY_BRONXYS }
      : { url: input, apikey: API_KEY_BRONXYS };
    
    console.log(`📡 Chamando API: ${isSearch ? 'Pesquisa' : 'URL'} - ${input}`);
    
    const { data } = await axios.get(urlApi, {
      params,
      timeout: 30000
    });
    
    if (data && (data.status === true || data.status === 'success') && data.result) {
      console.log('✅ API Bronxys retornou dados');
      return data;
    }
    
    console.log('⚠️ API Bronxys não retornou dados válidos');
    
    // Se for pesquisa e a API falhou, retorna null
    if (isSearch) return null;
    
    // Se for URL, tenta scraping
    return await scrapingPinterest(input);
    
  } catch (err) {
    console.log('❌ Erro na API Bronxys:', err.message);
    
    if (isSearch) return null;
    
    try {
      return await scrapingPinterest(input);
    } catch (e) {
      return null;
    }
  }
}

// =================== FUNÇÕES DE DOWNLOAD ===================

async function baixarImagemPinterest(sock, mediaItem, from, msgKey, originalMsg) {
    try {
        await sock.sendMessage(from, {
            image: { url: mediaItem.url },
            mimetype: "image/jpeg",
            caption: `📸 *Pinterest baixado com sucesso!*\n────────────────`
        }, { quoted: originalMsg });

        await sock.sendMessage(from, { 
            react: { text: "✅", key: msgKey } 
        });
        
        return true;
    } catch (error) {
        console.error('❌ Erro no download da imagem:', error);
        return false;
    }
}

async function baixarVideoPinterest(sock, mediaItem, from, msgKey, originalMsg) {
    try {
        await sock.sendMessage(from, {
            video: { url: mediaItem.url },
            mimetype: "video/mp4",
            caption: `📹 *Pinterest baixado com sucesso!*\n────────────────`
        }, { quoted: originalMsg });

        await sock.sendMessage(from, { 
            react: { text: "✅", key: msgKey } 
        });
        
        return true;
    } catch (error) {
        console.error('❌ Erro no download do vídeo:', error);
        return false;
    }
}

// =================== PROCESSAR PESQUISA ===================
async function processarPesquisa(sock, query, from, msgKey, originalMsg, apenasVideos = false) {
    try {
        console.log(`🔍 Pesquisando Pinterest: "${query}" (vídeos: ${apenasVideos})`);

        await sock.sendMessage(from, { 
            react: { text: "⏳", key: msgKey } 
        });

        // Salvar dados da pesquisa temporariamente
        const userKey = `${from}_${msgKey.participant || from}`;
        const arquivoTemp = path.join(TEMP_DIR, `pinsearch_${userKey.replace(/[^a-zA-Z0-9]/g, '_')}.json`);

        // Verificar se é "novo" para mudar comportamento
        if (query.toLowerCase() === 'novo' || query.toLowerCase() === 'new') {
            const infoMsg = `╭━━━〔 📌 *PINTEREST* 〕━━━╮
┃
┃ 📝 *Nova pesquisa*
┃
┃ Digite um nome para buscar
┃ Ex: .pin gatos fofos
┃ Ex: .pinmp4 paisagens
╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
            
            await criarMensagemComBotoes(sock, from, infoMsg, [], originalMsg, "📌 PINTEREST");
            return true;
        }

        // Fazer a pesquisa via API
        const resultado = await fetchPinterest(query, true);
        
        if (!resultado || !resultado.result || !resultado.result.media || resultado.result.media.length === 0) {
            await sendMessageWithChannelButton(sock, from,
                templates.erro("Nenhum resultado encontrado!") + "\n\n" +
                `🔍 *Pesquisa:* ${query}\n\n` +
                "💡 *Dicas:*\n" +
                "• Use palavras-chave simples\n" +
                "• Tente em inglês\n" +
                "• Seja mais específico",
                originalMsg
            );
            return false;
        }

        const mediaItems = resultado.result.media;
        const imagens = mediaItems.filter(m => m.type === 'image');
        const videos = mediaItems.filter(m => m.type === 'video');

        // Se for pesquisa de vídeos, prioriza vídeos
        let midiasParaSalvar = apenasVideos ? videos : mediaItems;
        
        if (midiasParaSalvar.length === 0) {
            await sendMessageWithChannelButton(sock, from,
                templates.erro(apenasVideos ? "Nenhum vídeo encontrado!" : "Nenhuma mídia encontrada!") + "\n\n" +
                `🔍 *Pesquisa:* ${query}\n\n` +
                "💡 *Tente novamente com outras palavras*",
                originalMsg
            );
            return false;
        }

        // Salvar resultados
        fs.writeFileSync(arquivoTemp, JSON.stringify({
            query: query,
            imagens: imagens,
            videos: videos,
            apenasVideos: apenasVideos,
            timestamp: Date.now()
        }));

        // Montar mensagem de resultado
        const infoMsg = `╭━━━〔 📌 *PINTEREST* 〕━━━╮
┃
┃ 🔍 *Pesquisa:* ${query}
┃
┃ 📸 *Imagens:* ${imagens.length}
┃ 📹 *Vídeos:* ${videos.length}
┃
┃ 📌 *Escolha o formato:*  
┃    Clique nos botões abaixo!
╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

        // Criar botões
        let botoes = [];
        
        if (imagens.length > 0) {
            botoes.push({
                name: 'quick_reply',
                buttonParamsJson: JSON.stringify({
                    display_text: '📸 IMAGEM',
                    id: 'pin_imagem'
                })
            });
        }
        
        if (videos.length > 0) {
            botoes.push({
                name: 'quick_reply',
                buttonParamsJson: JSON.stringify({
                    display_text: '📹 VÍDEO (MP4)',
                    id: 'pin_video'
                })
            });
        }
        
        botoes.push({
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({
                display_text: '🔄 NOVA PESQUISA',
                id: 'pin_novo'
            })
        });

        await criarMensagemComBotoes(sock, from, infoMsg, botoes, originalMsg, "📌 PINTEREST");

        return true;

    } catch (error) {
        console.error('❌ Erro na pesquisa Pinterest:', error);
        
        await sock.sendMessage(from, { 
            react: { text: "❌", key: msgKey } 
        });
        
        await sendMessageWithChannelButton(sock, from,
            templates.erro("Erro na pesquisa!") + "\n\n" +
            "🔄 *Tente novamente em 1-2 minutos*",
            originalMsg
        );
        
        return false;
    }
}

// =================== FUNÇÃO PRINCIPAL (URL) ===================
async function processarPinterest(sock, url, from, msgKey, originalMsg) {
    try {
        console.log(`📌 Processando Pinterest: ${url}`);

        url = await resolverLinkCurto(url);

        const pinterestRegex = /https?:\/\/(www\.|br\.)?pinterest\.[a-z.]+\/pin\/(\d+)\/?/i;
        const pinItRegex = /https?:\/\/pin\.it\/[A-Za-z0-9]+\/?/i;
        
        if (!pinterestRegex.test(url) && !pinItRegex.test(url)) {
            await sendMessageWithChannelButton(sock, from,
                templates.erro("Link inválido!") + "\n\n" +
                "📝 *Formatos suportados:*\n" +
                "• `pinterest.com/pin/123456789/`\n" +
                "• `br.pinterest.com/pin/123456789/`\n" +
                "• `pin.it/ABC123`\n\n" +
                "🔗 Envie apenas links do Pinterest",
                originalMsg
            );
            return false;
        }

        await sock.sendMessage(from, { 
            react: { text: "⏳", key: msgKey } 
        });

        const pinterestData = await fetchPinterest(url, false);
        
        if (!pinterestData || !pinterestData.result || !pinterestData.result.media || pinterestData.result.media.length === 0) {
            await sendMessageWithChannelButton(sock, from,
                templates.erro("Conteúdo não encontrado!") + "\n\n" +
                "🔍 *Verifique se:*\n" +
                "• O link está correto\n" +
                "• O conteúdo é público\n" +
                "• O pin não foi removido\n\n" +
                "🔄 Tente outro link",
                originalMsg
            );
            return false;
        }

        const mediaItems = pinterestData.result.media;
        const imagens = mediaItems.filter(m => m.type === 'image');
        const videos = mediaItems.filter(m => m.type === 'video');

        const userKey = `${from}_${msgKey.participant || from}`;
        const arquivoTemp = path.join(TEMP_DIR, `pin_${userKey.replace(/[^a-zA-Z0-9]/g, '_')}.json`);
        fs.writeFileSync(arquivoTemp, JSON.stringify({
            url: url,
            imagens: imagens,
            videos: videos,
            timestamp: Date.now()
        }));

        const infoMsg = `╭━━━〔 📌 *PINTEREST* 〕━━━╮
┃
┃ 📸 *Imagens:* ${imagens.length}
┃ 📹 *Vídeos:* ${videos.length}
┃
┃ 📌 *Escolha o formato:*  
┃    Clique nos botões abaixo!
╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

        let botoes = [];
        
        if (imagens.length > 0) {
            botoes.push({
                name: 'quick_reply',
                buttonParamsJson: JSON.stringify({
                    display_text: '📸 IMAGEM',
                    id: 'pin_imagem'
                })
            });
        }
        
        if (videos.length > 0) {
            botoes.push({
                name: 'quick_reply',
                buttonParamsJson: JSON.stringify({
                    display_text: '📹 VÍDEO (MP4)',
                    id: 'pin_video'
                })
            });
        }
        
        botoes.push({
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({
                display_text: '🔄 NOVO LINK',
                id: 'pin_novo'
            })
        });

        await criarMensagemComBotoes(sock, from, infoMsg, botoes, originalMsg, "📌 PINTEREST");

        return true;

    } catch (error) {
        console.error('❌ Erro no processamento Pinterest:', error);
        
        await sock.sendMessage(from, { 
            react: { text: "❌", key: msgKey } 
        });
        
        await sendMessageWithChannelButton(sock, from,
            templates.erro("Erro no processamento!") + "\n\n" +
            "🔄 *Tente novamente em 1-2 minutos*",
            originalMsg
        );
        
        return false;
    }
}

// =================== PROCESSAR CLIQUE DE BOTÃO ===================
async function processarCliqueBotaoPinterest(sock, msg, jid, remetente) {
    try {
        const cliqueId = detectarCliqueBotao(msg);
        if (!cliqueId) return false;
        
        console.log(`🖱️ Clique de botão Pinterest detectado: ${cliqueId}`);
        
        if (!cliqueId.startsWith('pin_')) return false;
        
        const comando = cliqueId.substring(4);
        
        const userKey = `${jid}_${remetente}`;
        
        // Tentar arquivo de URL primeiro, depois de pesquisa
        let arquivoTemp = path.join(TEMP_DIR, `pin_${userKey.replace(/[^a-zA-Z0-9]/g, '_')}.json`);
        let isSearch = false;
        
        if (!fs.existsSync(arquivoTemp)) {
            arquivoTemp = path.join(TEMP_DIR, `pinsearch_${userKey.replace(/[^a-zA-Z0-9]/g, '_')}.json`);
            isSearch = true;
        }
        
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
                "⚠️ *Nenhum conteúdo encontrado!*\n\nUse `.pin <link>` ou `.pin <nome>` primeiro.", 
                msg
            );
            return true;
        }
        
        if (comando === 'imagem') {
            if (dados.imagens && dados.imagens.length > 0) {
                await baixarImagemPinterest(sock, dados.imagens[0], jid, msg.key, msg);
            } else {
                await sendMessageWithChannelButton(sock, jid, 
                    "⚠️ *Nenhuma imagem encontrada!*", 
                    msg
                );
            }
            return true;
        }
        
        if (comando === 'video') {
            if (dados.videos && dados.videos.length > 0) {
                await baixarVideoPinterest(sock, dados.videos[0], jid, msg.key, msg);
            } else {
                await sendMessageWithChannelButton(sock, jid, 
                    "⚠️ *Nenhum vídeo encontrado!*", 
                    msg
                );
            }
            return true;
        }
        
        if (comando === 'novo') {
            if (isSearch) {
                await sendMessageWithChannelButton(sock, jid, 
                    "🔄 *Envie um novo nome para pesquisar!*\n\n📝 Digite: `.pin <nome>` ou `.pinmp4 <nome>`", 
                    msg
                );
            } else {
                await sendMessageWithChannelButton(sock, jid, 
                    "🔄 *Envie um novo link do Pinterest!*\n\n📝 Digite: `.pin <link>`", 
                    msg
                );
            }
            return true;
        }
        
        return false;
        
    } catch (error) {
        console.error('❌ Erro ao processar clique de botão:', error);
        return false;
    }
}

module.exports = {
  nome: "pinterest",

  init: (sock) => {
    console.log('📌 Inicializando comando Pinterest...');
    
    try {
      if (!fs.existsSync(GIF_PATH)) {
        console.log('⚠️ GIF do menu não encontrado em:', GIF_PATH);
        if (!fs.existsSync(MENU_DIR)) {
          fs.mkdirSync(MENU_DIR, { recursive: true });
        }
      } else {
        console.log('✅ GIF do menu encontrado em:', GIF_PATH);
      }
    } catch (e) {
      console.log('❌ Erro ao verificar GIF:', e.message);
    }

    sock.ev.on("messages.upsert", async ({ messages }) => {
      for (const m of messages) {
        try {
          if (!m?.message) continue;

          const from = m.key.remoteJid;
          if (!from) continue;

          const id = m.key.id;
          if (PROCESSADOS.has(id)) continue;

          PROCESSADOS.add(id);
          setTimeout(() => PROCESSADOS.delete(id), 4000);

          const remetente = m.key.participant || from;
          const isBotao = await processarCliqueBotaoPinterest(sock, m, from, remetente);
          if (isBotao) continue;

          const messageText = m.message.conversation || 
                            m.message.extendedTextMessage?.text || 
                            m.message.imageMessage?.caption || 
                            "";

          const texto = messageText.trim();
          
          // Verificar comandos
          const isPinMP4 = texto.toLowerCase().startsWith('.pinmp4') || 
                          texto.toLowerCase().startsWith('.pinterestmp4');
          const isPin = texto.toLowerCase().startsWith('.pin ') || 
                       texto.toLowerCase().startsWith('.pinterest ') ||
                       texto.toLowerCase() === '.pin' ||
                       texto.toLowerCase() === '.pinterest';

          if (isPinMP4 || isPin) {
            let comandoBase, args;
            
            if (isPinMP4) {
              const match = texto.match(/^\.(pinmp4|pinterestmp4)\s*(.*)/i);
              comandoBase = 'pinmp4';
              args = match ? match[2].trim() : '';
            } else {
              const match = texto.match(/^\.(pin|pinterest)\s*(.*)/i);
              comandoBase = 'pin';
              args = match ? match[2].trim() : '';
            }
            
            // Se não tiver argumentos, mostrar menu
            if (!args) {
              const isGroup = from.endsWith("@g.us");
              const status = isGroup 
                ? (config.grupos[from] ? "✅ ATIVADO" : "❌ DESATIVADO")
                : (config.usuarios[from] ? "✅ ATIVADO" : "❌ DESATIVADO");
              
              await sendMessageWithChannelButton(sock, from,
                templates.menuPrincipal(status),
                m
              );
              continue;
            }

            // Verificar se é link
            const pinterestRegex = /https?:\/\/(www\.|br\.)?pinterest\.[a-z.]+\/pin\/(\d+)\/?/i;
            const pinItRegex = /https?:\/\/pin\.it\/[A-Za-z0-9]+\/?/i;
            
            const matchPinterest = args.match(pinterestRegex);
            const matchPinIt = args.match(pinItRegex);
            
            if (matchPinterest) {
              await processarPinterest(sock, matchPinterest[0], from, m.key, m);
            } else if (matchPinIt) {
              await processarPinterest(sock, matchPinIt[0], from, m.key, m);
            } else {
              // É uma pesquisa por nome
              const apenasVideos = comandoBase === 'pinmp4';
              await processarPesquisa(sock, args, from, m.key, m, apenasVideos);
            }
            continue;
          }

          // Auto-download (apenas links)
          const pinterestRegex = /https?:\/\/(www\.|br\.)?pinterest\.[a-z.]+\/pin\/(\d+)\/?/gi;
          const pinItRegex = /https?:\/\/pin\.it\/[A-Za-z0-9]+\/?/gi;
          
          const linksPinterest = messageText.match(pinterestRegex);
          const linksPinIt = messageText.match(pinItRegex);
          
          const todosLinks = [...(linksPinterest || []), ...(linksPinIt || [])];

          if (todosLinks.length > 0) {
            carregarConfig();
            
            const isGroup = from.endsWith("@g.us");
            const isActive = isGroup ? config.grupos[from] : config.usuarios[from];
            
            if (isActive) {
              setTimeout(async () => {
                try {
                  await processarPinterest(sock, todosLinks[0], from, m.key, m);
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
    console.log('📌 Executando comando .pin/.pinterest');
    
    const jid = msg.key.remoteJid;
    const sender = msg.key.participant || jid;
    const isGroup = jid.endsWith("@g.us");

    carregarConfig();

    const sub = (args[0] || "").toLowerCase();

    if (sub === "on" || sub === "off") {
      if (isGroup) {
        try {
          const groupMetadata = await sock.groupMetadata(jid);
          const participant = groupMetadata.participants.find(p => p.id === sender);
          
          if (!participant || (participant.admin !== 'admin' && participant.admin !== 'superadmin')) {
            return await sendMessageWithChannelButton(sock, jid,
              templates.erro("Acesso negado!") + "\n\n" +
              "👮 *Permissão necessária:* Administrador\n" +
              "📋 Apenas admins podem ativar/desativar\n" +
              "🔒 Comando restrito para segurança",
              msg
            );
          }
        } catch (error) {
          return await sendMessageWithChannelButton(sock, jid,
            templates.erro("Erro nas permissões!"),
            msg
          );
        }
      }
    }

    if (sub === "on") {
      if (isGroup) {
        config.grupos[jid] = true;
      } else {
        config.usuarios[jid] = true;
      }
      salvarConfig();
      
      return await sendMessageWithChannelButton(sock, jid,
        templates.sucesso("Auto-download ATIVADO!") + "\n\n" +
        `🌐 *Modo:* ${isGroup ? 'Grupo' : 'Privado'}\n` +
        "🔔 *Funcionalidades ativas:*\n" +
        "✅ Download automático de links\n" +
        "✅ Imagens, Vídeos e GIFs\n" +
        "✅ Qualidade original\n" +
        "✅ Botões interativos\n\n" +
        "📌 Agora vou baixar automaticamente\n" +
        "todos os links do Pinterest enviados aqui!\n\n" +
        "⚙️ Para desativar: `.pinterest off`",
        msg
      );

    } else if (sub === "off") {
      if (isGroup) {
        delete config.grupos[jid];
      } else {
        delete config.usuarios[jid];
      }
      salvarConfig();
      
      return await sendMessageWithChannelButton(sock, jid,
        templates.info("Auto-download DESATIVADO") + "\n\n" +
        `🌐 *Modo:* ${isGroup ? 'Grupo' : 'Privado'}\n` +
        "🔕 *Funcionalidades desativadas:*\n" +
        "❌ Download automático\n" +
        "⚠️ Apenas download manual\n\n" +
        "📝 Você ainda pode usar:\n" +
        "`.pin <link>` para baixar manualmente\n\n" +
        "⚙️ Para reativar: `.pinterest on`",
        msg
      );

    } else if (args.length > 0) {
      const input = args.join(' ');
      const pinterestRegex = /https?:\/\/(www\.|br\.)?pinterest\.[a-z.]+\/pin\/(\d+)\/?/i;
      const pinItRegex = /https?:\/\/pin\.it\/[A-Za-z0-9]+\/?/i;
      
      let linkEncontrado = null;
      const matchPinterest = input.match(pinterestRegex);
      const matchPinIt = input.match(pinItRegex);
      
      if (matchPinterest) {
        linkEncontrado = matchPinterest[0];
      } else if (matchPinIt) {
        linkEncontrado = matchPinIt[0];
      }
      
      if (linkEncontrado) {
        return await processarPinterest(sock, linkEncontrado, jid, msg.key, msg);
      } else {
        // É uma pesquisa
        return await processarPesquisa(sock, input, jid, msg.key, msg, false);
      }

    } else {
      const status = isGroup 
        ? (config.grupos[jid] ? "✅ ATIVADO" : "❌ DESATIVADO")
        : (config.usuarios[jid] ? "✅ ATIVADO" : "❌ DESATIVADO");
      
      return await sendMessageWithChannelButton(sock, jid,
        templates.menuPrincipal(status),
        msg
      );
    }
  }
};
