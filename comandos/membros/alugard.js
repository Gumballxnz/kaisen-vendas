// comandos/DONO-CPNFIG/alugard.js
// Comando para donos ativarem aluguel diretamente (suporte para .alugar e .alugard)

const fs = require('fs');
const path = require('path');

// =================== CONFIGURAÇÕES ===================
const FILE_ALUGUEIS = path.join(__dirname, '../../database/alugueis.json');
const CONFIG_PATH = path.join(__dirname, '../../database/config.json');

// =================== DONOS (CARREGADOS DINAMICAMENTE + FALLBACK) ===================
function carregarDonos() {
    try {
        const config = lerJSON(CONFIG_PATH, { donos: [] });
        if (config.donos && config.donos.length > 0) {
            return config.donos;
        }
    } catch (error) {
        console.log('⚠️ Erro ao carregar donos do config:', error.message);
    }
    // Fallback para donos fixos (sempre disponíveis)
    return [
        { 
            id: '258843073346@s.whatsapp.net', 
            lid: '205544954531875@lid',
            nome: 'WILSON DEV TECH',
            nivel: 'principal'
        },
        { 
            id: '258848049232@s.whatsapp.net', 
            lid: '13796173160594@lid',
            nome: 'ADM-CLEYNNE',
            nivel: 'seo-dono'
        }
    ];
}

// =================== DONOS FIXOS (SEMPRE RECONHECIDOS) ===================
const DONOS_FIXOS = [
    { 
        id: '258843073346@s.whatsapp.net', 
        lid: '205544954531875@lid',
        nome: 'WILSON DEV TECH',
        nivel: 'principal'
    },
    { 
        id: '258848049232@s.whatsapp.net', 
        lid: '13796173160594@lid',
        nome: 'ADM-CLEYNNE',
        nivel: 'seo-dono'
    }
];

// ======= FUNÇÃO PARA CONVERTER TEXTO PARA ESTILO ESPECIAL =======
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
        '🔴': '🔴', '🟢': '🟢', '⚙️': '⚙️', '💳': '💳', '🔔': '🔔', '⏰': '⏰', '📝': '📝', '💡': '💡'
    };
    
    let result = '';
    for (const char of normalized) {
        result += styleMap[char] || char;
    }
    return result;
}

// =================== FUNÇÕES AUXILIARES ===================
function normalizarID(id) {
    if (!id) return '';
    const limpo = id.replace(/@(s\.whatsapp\.net|g\.us|lid|c\.us)/g, '');
    return limpo.replace(/\D/g, '');
}

function isDono(sender) {
    if (!sender) return false;
    
    // Primeiro verifica nos donos do config
    const donosConfig = carregarDonos();
    for (const dono of donosConfig) {
        if (sender === dono.id || sender === dono.lid) return true;
        const numeroDono = normalizarID(dono.id);
        const senderNumero = normalizarID(sender);
        if (numeroDono === senderNumero) return true;
        if (dono.id && sender.includes(normalizarID(dono.id))) return true;
        if (dono.lid && sender.includes(normalizarID(dono.lid))) return true;
    }
    
    // Depois verifica nos donos fixos (sempre reconhecidos)
    for (const dono of DONOS_FIXOS) {
        if (sender === dono.id || sender === dono.lid) return true;
        const numeroDono = normalizarID(dono.id);
        const senderNumero = normalizarID(sender);
        if (numeroDono === senderNumero) return true;
        if (dono.id && sender.includes(normalizarID(dono.id))) return true;
        if (dono.lid && sender.includes(normalizarID(dono.lid))) return true;
    }
    
    return false;
}

function getDonoInfo(sender) {
    if (!sender) return null;
    
    // Primeiro busca nos donos do config
    const donosConfig = carregarDonos();
    for (const dono of donosConfig) {
        if (sender === dono.id || sender === dono.lid) return dono;
        const numeroDono = normalizarID(dono.id);
        const senderNumero = normalizarID(sender);
        if (numeroDono === senderNumero) return dono;
        if (dono.id && sender.includes(normalizarID(dono.id))) return dono;
        if (dono.lid && sender.includes(normalizarID(dono.lid))) return dono;
    }
    
    // Depois busca nos donos fixos
    for (const dono of DONOS_FIXOS) {
        if (sender === dono.id || sender === dono.lid) return dono;
        const numeroDono = normalizarID(dono.id);
        const senderNumero = normalizarID(sender);
        if (numeroDono === senderNumero) return dono;
        if (dono.id && sender.includes(normalizarID(dono.id))) return dono;
        if (dono.lid && sender.includes(normalizarID(dono.lid))) return dono;
    }
    
    return null;
}

function lerJSON(caminho, valorPadrao) {
    try {
        const dir = path.dirname(caminho);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        if (!fs.existsSync(caminho) || fs.readFileSync(caminho, 'utf-8').trim() === '') {
            fs.writeFileSync(caminho, JSON.stringify(valorPadrao, null, 2));
            return valorPadrao;
        }
        return JSON.parse(fs.readFileSync(caminho, 'utf-8'));
    } catch (e) {
        return valorPadrao;
    }
}

function salvarJSON(caminho, dados) {
    try {
        const dir = path.dirname(caminho);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(caminho, JSON.stringify(dados, null, 2));
        return true;
    } catch (e) {
        console.error('❌ Erro ao salvar:', e.message);
        return false;
    }
}

function isValidDate(date) {
    return date instanceof Date && !isNaN(date.getTime());
}

function getDiasRestantes(venceEm) {
    const agora = new Date();
    const vencimento = new Date(venceEm);
    const diffMs = vencimento - agora;
    if (diffMs <= 0) return 0;
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

// =================== FUNÇÃO PARA ENVIAR MENSAGEM ===================
const sendMessageWithReply = async (sock, jid, content, msg) => {
    try {
        await sock.sendMessage(jid, { text: toSpecialStyle(content) }, { quoted: msg });
    } catch (error) {
        console.log('❌ Erro ao enviar mensagem:', error.message);
    }
};

// =================== FUNÇÃO PARA ATIVAR ALUGUEL ===================
async function ativarAluguel(sock, jid, remetente, grupoId, dias, msg) {
    const alugueis = lerJSON(FILE_ALUGUEIS, {});
    const donoInfo = getDonoInfo(remetente);
    const nomeDono = donoInfo ? donoInfo.nome : '𝙳𝚎𝚜𝚌𝚘𝚗𝚑𝚎𝚌𝚒𝚍𝚘';
    const nivelDono = donoInfo ? donoInfo.nivel : '';

    // Obtém informações do grupo
    let nomeGrupo = '𝚂𝚎𝚖 𝚗𝚘𝚖𝚎';
    let participantes = 0;
    try {
        const metadata = await sock.groupMetadata(grupoId);
        nomeGrupo = metadata.subject || '𝚂𝚎𝚖 𝚗𝚘𝚖𝚎';
        participantes = metadata.participants?.length || 0;
    } catch (error) {
        console.log('⚠️ Não foi possível obter metadados do grupo:', error.message);
    }

    // Calcula vencimento
    let venceEm;
    const agora = new Date();

    if (alugueis[grupoId] && alugueis[grupoId].venceEm) {
        const dataVencimentoAtual = new Date(alugueis[grupoId].venceEm);
        if (isValidDate(dataVencimentoAtual) && dataVencimentoAtual > agora) {
            venceEm = new Date(dataVencimentoAtual.getTime() + dias * 24 * 60 * 60 * 1000).toISOString();
        } else {
            venceEm = new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString();
        }
    } else {
        venceEm = new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString();
    }

    const isRenovacao = alugueis[grupoId] && 
        isValidDate(new Date(alugueis[grupoId].venceEm)) && 
        new Date(alugueis[grupoId].venceEm) > agora;

    // Salva aluguel
    alugueis[grupoId] = { 
        nomeGrupo: nomeGrupo,
        venceEm: venceEm,
        ultimaAtualizacao: new Date().toISOString(),
        atualizadoPor: remetente,
        atualizadoPorNome: nomeDono,
        atualizadoPorNivel: nivelDono,
        diasAdicionados: dias,
        renovacoes: (alugueis[grupoId]?.renovacoes || 0) + 1,
        criadoEm: alugueis[grupoId]?.criadoEm || new Date().toISOString(),
        participantes: participantes
    };

    salvarJSON(FILE_ALUGUEIS, alugueis);

    const dataVencimento = new Date(venceEm).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const diasRestantes = getDiasRestantes(venceEm);

    // Monta mensagem
    let mensagem;
    if (isRenovacao) {
        mensagem = `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
┃          ✅ *𝙰𝙻𝚄𝙶𝚄𝙴𝙻 𝚁𝙴𝙽𝙾𝚅𝙰𝙳𝙾*          ┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
┃
┃ 👑 𝙿𝚘𝚛: ${nomeDono} (${nivelDono})
┃
┃ 👥 *𝙶𝚛𝚞𝚙𝚘:* ${nomeGrupo}
┃ 🔑 *𝙸𝙳:* \`${grupoId.replace('@g.us', '')}\`
┃ 👥 *𝙿𝚊𝚛𝚝𝚒𝚌𝚒𝚙𝚊𝚗𝚝𝚎𝚜:* ${participantes}
┃
┃ 📅 *𝙽𝚘𝚟𝚘 𝚟𝚎𝚗𝚌𝚒𝚖𝚎𝚗𝚝𝚘:* ${dataVencimento}
┃ ⏰ *+${dias} 𝚍𝚒𝚊𝚜* | ${diasRestantes} 𝚍𝚒𝚊𝚜 𝚛𝚎𝚜𝚝𝚊𝚗𝚝𝚎𝚜
┃ 🔄 *${alugueis[grupoId].renovacoes}ª 𝚛𝚎𝚗𝚘𝚟𝚊𝚌̧𝚊̃𝚘*
┃
┃ 🛡️ *𝚂𝚝𝚊𝚝𝚞𝚜:* 🟢 𝙰𝚃𝙸𝚅𝙾
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
    } else {
        mensagem = `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
┃          ✅ *𝙰𝙻𝚄𝙶𝚄𝙴𝙻 𝙰𝚃𝙸𝚅𝙰𝙳𝙾*          ┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
┃
┃ 👑 𝙿𝚘𝚛: ${nomeDono} (${nivelDono})
┃
┃ 👥 *𝙶𝚛𝚞𝚙𝚘:* ${nomeGrupo}
┃ 🔑 *𝙸𝙳:* \`${grupoId.replace('@g.us', '')}\`
┃ 👥 *𝙿𝚊𝚛𝚝𝚒𝚌𝚒𝚙𝚊𝚗𝚝𝚎𝚜:* ${participantes}
┃
┃ 📅 *𝚅𝚎𝚗𝚌𝚒𝚖𝚎𝚗𝚝𝚘:* ${dataVencimento}
┃ ⏰ *𝙳𝚞𝚛𝚊𝚌̧𝚊̃𝚘:* ${dias} 𝚍𝚒𝚊𝚜
┃
┃ 🛡️ *𝚂𝚝𝚊𝚝𝚞𝚜:* 🟢 𝙰𝚃𝙸𝚅𝙾
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
    }

    // Envia resposta para quem executou
    await sendMessageWithReply(sock, jid, mensagem, msg);

    // Notifica o grupo (se não for o mesmo JID)
    if (jid !== grupoId) {
        try {
            await sock.sendMessage(grupoId, {
                text: toSpecialStyle(`╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
┃          📋 *𝙰𝙻𝚄𝙶𝚄𝙴𝙻 𝙰𝙲𝙸𝙾𝙽𝙰𝙳𝙾*          ┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
┃
┃ 👑 𝙳𝚘𝚗𝚘: ${nomeDono}
┃
┃ 📅 *𝚅𝚎𝚗𝚌𝚒𝚖𝚎𝚗𝚝𝚘:* ${dataVencimento}
┃ ⏰ *${dias} 𝚍𝚒𝚊𝚜*
┃
┃ 🛡️ *𝚂𝚝𝚊𝚝𝚞𝚜:* 🟢 𝙰𝚃𝙸𝚅𝙾
┃
┃ 💡 𝙰𝚐𝚘𝚛𝚊 𝚝𝚘𝚍𝚘𝚜 𝚘𝚜 𝚌𝚘𝚖𝚊𝚗𝚍𝚘𝚜
┃ 𝚎𝚜𝚝𝚊̃𝚘 𝚕𝚒𝚋𝚎𝚛𝚊𝚍𝚘𝚜!
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`)
            });
            console.log(`✅ Notificação enviada para o grupo ${grupoId}`);
        } catch (error) {
            console.log('❌ Erro ao notificar grupo:', error.message);
        }
    }

    console.log(`✅ Aluguel ativado para ${grupoId}: ${dias} dias`);
    return true;
}

// =================== FUNÇÃO PRINCIPAL (COMPARTILHADA) ===================
async function executarComando(sock, msg, args, nomeComando) {
    const jid = msg.key.remoteJid;
    const remetente = msg.key.participant || msg.key.remoteJid;
    const isGroup = jid.endsWith('@g.us');

    try {
        console.log(`📥 Comando .${nomeComando} de ${remetente}`);
        console.log(`📋 Args: ${args.join(' ')}`);
        console.log(`📌 É grupo: ${isGroup}`);

        // ===== VERIFICA SE É DONO =====
        if (!isDono(remetente)) {
            const donos = carregarDonos();
            let listaDonos = '';
            donos.forEach(d => {
                listaDonos += `▸ ${d.nome} (${d.nivel})\n`;
            });
            
            // Adiciona também os donos fixos na lista
            DONOS_FIXOS.forEach(d => {
                if (!donos.some(d2 => d2.id === d.id)) {
                    listaDonos += `▸ ${d.nome} (${d.nivel})\n`;
                }
            });
            
            return sendMessageWithReply(sock, jid,
                `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
┃          🔒 *𝙰𝙲𝙴𝚂𝚂𝙾 𝙽𝙴𝙶𝙰𝙳𝙾*          ┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
┃
┃ 🚫 𝙰𝚙𝚎𝚗𝚊𝚜 𝚘𝚜 𝚍𝚘𝚗𝚘𝚜 𝚙𝚘𝚍𝚎𝚖
┃ 𝚞𝚜𝚊𝚛 𝚎𝚜𝚝𝚎 𝚌𝚘𝚖𝚊𝚗𝚍𝚘.
┃
┃ 👑 *𝙳𝚘𝚗𝚘𝚜 𝙰𝚞𝚝𝚘𝚛𝚒𝚣𝚊𝚍𝚘𝚜:*
┃ ${listaDonos}
┃
┃ 📞 𝙲𝚘𝚗𝚝𝚊𝚝𝚎: 𝚠𝚊.𝚖𝚎/258843073346
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
                msg
            );
        }

        // ===== SE FOR NO GRUPO E NÃO TIVER ARGUMENTOS =====
        if (isGroup && args.length === 0) {
            const grupoId = jid;
            
            return sendMessageWithReply(sock, jid,
                `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
┃          📋 *𝙰𝙻𝚄𝙶𝙰𝚁*          ┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
┃
┃ 📌 *𝙿𝙰𝚁𝙰 𝙴𝚂𝚃𝙴 𝙶𝚁𝚄𝙿𝙾:*
┃ .${nomeComando} <𝚍𝚒𝚊𝚜>
┃
┃ 📌 *𝙿𝙰𝚁𝙰 𝙾𝚄𝚃𝚁𝙾 𝙶𝚁𝚄𝙿𝙾:*
┃ .${nomeComando} <𝚒𝚍> <𝚍𝚒𝚊𝚜>
┃
┃ 📋 *𝙴𝚡𝚎𝚖𝚙𝚕𝚘𝚜:*
┃ ▸ .${nomeComando} 30
┃ ▸ .${nomeComando} 120363430201661881 30
┃
┃ 🟢 *𝙶𝚛𝚞𝚙𝚘 𝙰𝚝𝚞𝚊𝚕:* \`${grupoId.replace('@g.us', '')}\`
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
                msg
            );
        }

        // ===== SE FOR NO GRUPO COM APENAS 1 ARGUMENTO (DIAS) =====
        if (isGroup && args.length === 1) {
            const dias = parseInt(args[0]);
            
            if (isNaN(dias) || dias <= 0 || dias > 365) {
                return sendMessageWithReply(sock, jid,
                    `❌ 𝙽𝚞́𝚖𝚎𝚛𝚘 𝚍𝚎 𝚍𝚒𝚊𝚜 𝚒𝚗𝚟𝚊́𝚕𝚒𝚍𝚘.\n\n📌 𝙵𝚘𝚛𝚗𝚎𝚌̧𝚊 𝟷-𝟹𝟼𝟻 𝚍𝚒𝚊𝚜.`,
                    msg
                );
            }

            await ativarAluguel(sock, jid, remetente, jid, dias, msg);
            return;
        }

        // ===== VERIFICA ARGUMENTOS PARA OUTRO GRUPO =====
        if (args.length < 2) {
            return sendMessageWithReply(sock, jid,
                `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
┃          📋 *𝙰𝙻𝚄𝙶𝙰𝚁*          ┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
┃
┃ 📌 *𝙲𝙾𝙼𝙾 𝚄𝚂𝙰𝚁:*
┃ .${nomeComando} <𝚒𝚍> <𝚍𝚒𝚊𝚜>
┃
┃ 📋 *𝙴𝚡𝚎𝚖𝚙𝚕𝚘𝚜:*
┃ ▸ .${nomeComando} 120363430201661881 30
┃ ▸ .${nomeComando} 120363427266423635 60
┃
┃ ⚠️ *𝙾𝚋𝚜:* 𝙴𝚜𝚝𝚎 𝚌𝚘𝚖𝚊𝚗𝚍𝚘 𝚊𝚝𝚒𝚟𝚊
┃ 𝚘 𝚊𝚕𝚞𝚐𝚞𝚎𝚕 𝚍𝚒𝚛𝚎𝚝𝚊𝚖𝚎𝚗𝚝𝚎 𝚜𝚎𝚖
┃ 𝚙𝚛𝚎𝚌𝚒𝚜𝚊𝚛 𝚍𝚎 𝚊𝚙𝚛𝚘𝚟𝚊𝚌̧𝚊̃𝚘.
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
                msg
            );
        }

        // ===== ATIVA ALUGUEL PARA OUTRO GRUPO =====
        const idGrupo = args[0].replace(/\D/g, '');
        const dias = parseInt(args[1]);

        if (!idGrupo || idGrupo.length < 10) {
            return sendMessageWithReply(sock, jid,
                `❌ 𝙸𝙳 𝚒𝚗𝚟𝚊́𝚕𝚒𝚍𝚘.\n\n📌 𝙵𝚘𝚛𝚗𝚎𝚌̧𝚊 𝚞𝚖 𝙸𝙳 𝚟𝚊́𝚕𝚒𝚍𝚘.`,
                msg
            );
        }

        if (isNaN(dias) || dias <= 0 || dias > 365) {
            return sendMessageWithReply(sock, jid,
                `❌ 𝙽𝚞́𝚖𝚎𝚛𝚘 𝚍𝚎 𝚍𝚒𝚊𝚜 𝚒𝚗𝚟𝚊́𝚕𝚒𝚍𝚘.\n\n📌 𝙵𝚘𝚛𝚗𝚎𝚌̧𝚊 𝟷-𝟹𝟼𝟻 𝚍𝚒𝚊𝚜.`,
                msg
            );
        }

        const grupoCompleto = idGrupo + '@g.us';
        await ativarAluguel(sock, jid, remetente, grupoCompleto, dias, msg);

    } catch (error) {
        console.error(`❌ Erro no comando .${nomeComando}:`, error);
        await sendMessageWithReply(sock, jid, 
            `❌ 𝙴𝚛𝚛𝚘: ${error.message}`,
            msg
        );
    }
}

// =================== EXPORTA OS COMANDOS ===================
module.exports = {
    // Comando .alugard
    run: async (sock, msg, args) => {
        await executarComando(sock, msg, args, 'alugard');
    },
    
    // Comando .alugar (apelido)
    alugar: async (sock, msg, args) => {
        await executarComando(sock, msg, args, 'alugar');
    },
    
    // Para compatibilidade com o sistema de comandos
    runAlias: async (sock, msg, args) => {
        await executarComando(sock, msg, args, 'alugar');
    },
    
    // Exporta funções auxiliares
    isDono,
    getDonoInfo,
    carregarDonos,
    DONOS_FIXOS,
    ativarAluguel,
    toSpecialStyle
};
