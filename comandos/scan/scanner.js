// comandos/DONO-CPNFIG/scanner.js
// Scanner de contactos - SEM menções, números clicáveis via wa.me
// SEMPRE envia no grupo onde o comando foi executado
// ⚠️ NUNCA envia no PV

const fs = require('fs');
const path = require('path');

// =================== CONFIGURAÇÕES ===================
const LID_MAP_PATH = path.join(__dirname, '../../database/lid_map.json');

// =================== DONO PRINCIPAL ===================
const DONO_PRINCIPAL = {
    id: '258879116693@s.whatsapp.net',
    lid: '258879116693@lid',
    nome: 'DONO',
    nivel: 'principal'
};

// =================== CACHE DE LIDs ===================
let LID_CACHE = {};

function carregarLidCache() {
    try {
        if (fs.existsSync(LID_MAP_PATH)) {
            LID_CACHE = JSON.parse(fs.readFileSync(LID_MAP_PATH, 'utf-8'));
            console.log(`📂 Cache LIDs: ${Object.keys(LID_CACHE).length}`);
        } else { LID_CACHE = {}; }
    } catch (e) { LID_CACHE = {}; }
}

function salvarLidCache() {
    try {
        const dir = path.dirname(LID_MAP_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(LID_MAP_PATH, JSON.stringify(LID_CACHE, null, 2));
    } catch (e) {}
}

carregarLidCache();

// =================== BARRA DE PROGRESSO ===================
function gerarBarraProgresso(percentual, tamanho = 20) {
    const p = Math.max(0, Math.min(100, percentual));
    const preenchido = Math.round((p / 100) * tamanho);
    const vazio = tamanho - preenchido;
    return '█'.repeat(preenchido) + '░'.repeat(vazio) + ` ${p.toFixed(0)}%`;
}

// =================== AUXILIARES ===================
function normalizarID(id) {
    if (!id) return '';
    return id.replace(/@(s\.whatsapp\.net|g\.us|lid|c\.us)/g, '').replace(/\D/g, '');
}

function isDonoPrincipal(sender) {
    if (!sender) return false;
    const n = normalizarID(sender);
    return normalizarID(DONO_PRINCIPAL.id) === n || normalizarID(DONO_PRINCIPAL.lid) === n;
}

// =================== RESOLVER LID → NÚMERO ===================
async function resolverLidParaNumero(sock, lidJid, grupoJid) {
    const lidNum = normalizarID(lidJid);
    if (LID_CACHE[lidNum]) return LID_CACHE[lidNum];

    try {
        if (sock.onWhatsApp) {
            const r = await sock.onWhatsApp(lidJid);
            if (r && r.length > 0 && r[0].exists) {
                const numero = normalizarID(r[0].jid || '');
                if (numero && !r[0].jid?.includes('@lid')) {
                    LID_CACHE[lidNum] = numero;
                    salvarLidCache();
                    return numero;
                }
            }
        }
    } catch (e) {}

    try {
        if (sock.store?.contacts) {
            for (const [jid, contact] of Object.entries(sock.store.contacts)) {
                if (contact.lid === lidJid || contact.id === lidJid) {
                    const numero = normalizarID(contact.id || '');
                    if (numero) {
                        LID_CACHE[lidNum] = numero;
                        salvarLidCache();
                        return numero;
                    }
                }
            }
        }
    } catch (e) {}

    try {
        const metadata = await sock.groupMetadata(grupoJid);
        for (const p of metadata.participants) {
            if (p.lid === lidJid && p.id && !p.id.includes('@lid')) {
                const numero = normalizarID(p.id);
                if (numero) {
                    LID_CACHE[lidNum] = numero;
                    salvarLidCache();
                    return numero;
                }
            }
        }
    } catch (e) {}

    try {
        if (sock.signalRepository?.lidMapping) {
            const jid = await sock.signalRepository.lidMapping.getPNForLID(lidJid);
            if (jid && !jid.includes('@lid')) {
                const numero = normalizarID(jid);
                if (numero) {
                    LID_CACHE[lidNum] = numero;
                    salvarLidCache();
                    return numero;
                }
            }
        }
    } catch (e) {}

    return null;
}

// =================== EXTRAIR CONTACTOS ===================
async function extrairContactos(sock, grupoAlvoJid) {
    try {
        const metadata = await sock.groupMetadata(grupoAlvoJid);
        const total = metadata.participants.length;
        const contactos = [];
        const numerosVistos = new Set();

        for (const p of metadata.participants) {
            let numeroReal = null;
            
            if (p.id && p.id.includes('@s.whatsapp.net')) {
                numeroReal = normalizarID(p.id);
            } else if (p.phoneNumber) {
                numeroReal = normalizarID(p.phoneNumber);
            } else if (p.id && p.id.includes('@lid')) {
                numeroReal = await resolverLidParaNumero(sock, p.id, grupoAlvoJid);
            } else if (p.lid) {
                numeroReal = await resolverLidParaNumero(sock, p.lid, grupoAlvoJid);
                if (!numeroReal && p.id && !p.id.includes('@lid')) {
                    numeroReal = normalizarID(p.id);
                }
            }
            
            if (numeroReal && numeroReal.length >= 8 && numeroReal.length <= 15) {
                if (!numerosVistos.has(numeroReal)) {
                    numerosVistos.add(numeroReal);
                    contactos.push({
                        numero: numeroReal,
                        admin: p.admin || null
                    });
                }
            }
        }

        return {
            nome: metadata.subject || 'Sem nome',
            id: grupoAlvoJid.replace('@g.us', ''),
            total, resolvidos: contactos.length,
            contactos
        };
    } catch (error) {
        console.log('❌ Erro:', error.message);
        return null;
    }
}

// =================== SCANNER PRINCIPAL ===================
// jidEnvio = grupo ONDE as mensagens serão enviadas (grupo que executou o comando)
// grupoAlvoJid = grupo A SER ESCANEADO
async function executarScanner(sock, jidEnvio, grupoAlvoJid) {
    // ⚠️ SEMPRE envia para jidEnvio (@g.us)
    if (!jidEnvio.endsWith('@g.us')) {
        console.log('❌ Scanner só envia em grupos!');
        return;
    }

    console.log(`🔍 Scanner iniciado`);
    console.log(`📤 Enviando para: ${jidEnvio}`);
    console.log(`🎯 Escaneando: ${grupoAlvoJid}`);

    // 1. Mensagem inicial
    const barraInicial = gerarBarraProgresso(0, 20);
    let mensagemAtual = null;

    try {
        mensagemAtual = await sock.sendMessage(jidEnvio, {
            text: `🔍 *SCANNER INICIADO*\n\n` +
                  `${barraInicial}\n\n` +
                  `📋 Grupo: A obter...\n` +
                  `👥 Processados: 0/0\n` +
                  `✅ Resolvidos: 0\n\n` +
                  `⏳ Aguarde...`
        });
    } catch (e) {
        console.log('❌ Erro inicial:', e.message);
        return;
    }

    // 2. Extrai contactos do GRUPO ALVO
    const scanner = await extrairContactos(sock, grupoAlvoJid);

    if (!scanner || scanner.contactos.length === 0) {
        try {
            await sock.sendMessage(jidEnvio, {
                text: `❌ Nenhum contacto real encontrado.`,
                edit: mensagemAtual.key
            });
        } catch (e) {}
        return;
    }

    await new Promise(r => setTimeout(r, 2000));

    // 3. Loop de edição — SEMPRE em jidEnvio — SEM MENÇÕES
    const total = scanner.contactos.length;

    for (let i = 0; i < total; i++) {
        const percentual = ((i + 1) / total) * 100;
        const barra = gerarBarraProgresso(percentual, 20);

        // Últimos 20 visíveis
        const inicio = Math.max(0, i - 19);
        const fim = i + 1;
        const visiveis = scanner.contactos.slice(inicio, fim);

        // ✅ Lista com NÚMEROS PUROS + link clicável
        let listaTexto = '';
        visiveis.forEach((c, idx) => {
            const numReal = inicio + idx + 1;
            const emoji = c.admin === 'superadmin' ? '👑' : c.admin === 'admin' ? '🛡️' : '👤';
            // ✅ wa.me = link clicável, sem menção
            listaTexto += `\n${numReal}. ${emoji} +${c.numero}\n   🔗 wa.me/${c.numero}`;
        });

        const texto = `🔍 *SCANNER EM ANDAMENTO*\n\n` +
                      `${barra}\n\n` +
                      `📋 Grupo: ${scanner.nome}\n` +
                      `👥 Processados: ${i + 1}/${total}\n` +
                      `✅ Resolvidos: ${scanner.resolvidos}\n\n` +
                      `📞 *CONTACTOS:*${listaTexto}`;

        try {
            // ⚠️ SEM mentions — apenas texto puro com links
            await sock.sendMessage(jidEnvio, {
                text: texto,
                edit: mensagemAtual.key
            });
            console.log(`✏️ [${i+1}/${total}] +${scanner.contactos[i].numero} (${percentual.toFixed(1)}%)`);
        } catch (error) {
            console.log(`❌ Erro editar [${i+1}]:`, error.message);
        }

        if (i < total - 1) {
            await new Promise(r => setTimeout(r, 5000));
        }
    }

    // 4. Versão final com TODOS os contactos
    await new Promise(r => setTimeout(r, 3000));

    const barraFinal = gerarBarraProgresso(100, 20);

    let listaFinal = '';
    scanner.contactos.forEach((c, i) => {
        const emoji = c.admin === 'superadmin' ? '👑' : c.admin === 'admin' ? '🛡️' : '👤';
        listaFinal += `\n${i + 1}. ${emoji} +${c.numero}\n   🔗 wa.me/${c.numero}`;
    });

    const textoFinal = `✅ *SCANNER CONCLUÍDO*\n\n` +
                       `${barraFinal}\n\n` +
                       `📋 Grupo: ${scanner.nome}\n` +
                       `✅ Resolvidos: ${scanner.resolvidos}/${scanner.total}\n\n` +
                       `📞 *LISTA COMPLETA:*${listaFinal}`;

    try {
        // ⚠️ SEM mentions
        await sock.sendMessage(jidEnvio, {
            text: textoFinal,
            edit: mensagemAtual.key
        });
    } catch (e) {
        console.log('❌ Erro final:', e.message);
    }

    // 5. Salva arquivo
    try {
        const dir = path.join(__dirname, '../../database/scanner');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const arquivo = path.join(dir, `scanner_${scanner.id}_${Date.now()}.json`);
        fs.writeFileSync(arquivo, JSON.stringify(scanner, null, 2));
        console.log(`💾 Salvo: ${arquivo}`);
    } catch (e) {}
}

// =================== COMANDO PRINCIPAL ===================
module.exports.run = async (sock, msg, args, context) => {
    const jid = msg.key.remoteJid;
    const remetente = msg.key.participant || msg.key.remoteJid;

    try {
        const isGrupo = jid.endsWith('@g.us');

        // Verifica dono
        if (!isDonoPrincipal(remetente)) {
            if (isGrupo) {
                await sock.sendMessage(jid, {
                    text: `🔒 *ACESSO NEGADO*\n\n🚫 Apenas o dono PRINCIPAL pode usar.`
                }, { quoted: msg });
            }
            return;
        }

        // ⚠️ PV → NUNCA RESPONDE
        if (!isGrupo) {
            console.log('⚠️ Comando recebido no PV — ignorado');
            return;
        }

        // ===== COMANDO EXECUTADO EM GRUPO =====

        // Sem argumentos → escaneia o próprio grupo
        if (args.length === 0) {
            console.log(`🔍 Escaneando grupo atual: ${jid}`);
            await executarScanner(sock, jid, jid);
            return;
        }

        // Com argumento → escaneia grupo específico MAS envia no grupo atual
        const possivelId = args[0].replace(/\D/g, '');
        
        if (possivelId.length < 10) {
            await sock.sendMessage(jid, {
                text: `❌ ID inválido!\n\nUse: .scanner <id>`
            }, { quoted: msg });
            return;
        }

        const grupoAlvoJid = possivelId + '@g.us';
        console.log(`🎯 Escaneando ${grupoAlvoJid} mas enviando em ${jid}`);
        
        // jidEnvio = jid (grupo atual) | grupoAlvoJid = ID fornecido
        await executarScanner(sock, jid, grupoAlvoJid);

    } catch (error) {
        console.error('❌ Erro:', error);
        if (jid.endsWith('@g.us')) {
            await sock.sendMessage(jid, {
                text: `❌ Erro: ${error.message}`
            }, { quoted: msg });
        }
    }
};
