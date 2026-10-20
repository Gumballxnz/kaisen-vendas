// comandos/DONO-CPNFIG/adicionar.js
// .adicionar <id_grupo_origem>
// → Escaneia contactos do grupo <id> e ADICIONA no GRUPO ATUAL
// ⏱️ 25 SEGUNDOS entre cada adição | Adiciona TODOS
// ⚠️ Apenas dono principal | NUNCA envia no PV

const fs = require('fs');
const path = require('path');

// =================== CONFIGURAÇÕES ===================
const CONFIG = {
    INTERVALO_ENTRE_CONTACTOS: 25000, // 25 SEGUNDOS entre cada adição
    PAUSA_APOS_ERRO: 60000,            // 60s de pausa após erro 403
    MAX_ERROS_CONSECUTIVOS: 5          // Pausa se 5 erros seguidos
};

const LID_MAP_PATH = path.join(__dirname, '../../database/lid_map.json');
const PROGRESSO_PATH = path.join(__dirname, '../../database/adicionar_progresso.json');

// =================== DONO PRINCIPAL ===================
const DONO_PRINCIPAL = {
    id: '258879116693@s.whatsapp.net',
    lid: '159034049044504@lid',
    nome: 'DONO',
    nivel: 'principal'
};

// =================== CACHE DE LIDs ===================
let LID_CACHE = {};

function carregarLidCache() {
    try {
        if (fs.existsSync(LID_MAP_PATH)) {
            LID_CACHE = JSON.parse(fs.readFileSync(LID_MAP_PATH, 'utf-8'));
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

// =================== SALVAR PROGRESSO (RESUME) ===================
function salvarProgresso(dados) {
    try {
        const dir = path.dirname(PROGRESSO_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(PROGRESSO_PATH, JSON.stringify(dados, null, 2));
    } catch (e) {}
}

function carregarProgresso() {
    try {
        if (fs.existsSync(PROGRESSO_PATH)) {
            return JSON.parse(fs.readFileSync(PROGRESSO_PATH, 'utf-8'));
        }
    } catch (e) {}
    return null;
}

function limparProgresso() {
    try {
        if (fs.existsSync(PROGRESSO_PATH)) fs.unlinkSync(PROGRESSO_PATH);
    } catch (e) {}
}

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

function formatarTempo(ms) {
    const seg = Math.floor(ms / 1000);
    const min = Math.floor(seg / 60);
    const hrs = Math.floor(min / 60);
    if (hrs > 0) return `${hrs}h ${min % 60}min`;
    if (min > 0) return `${min}min ${seg % 60}s`;
    return `${seg}s`;
}

// =================== RESOLVER LID ===================
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
async function extrairContactos(sock, grupoOrigemJid, onProgresso) {
    try {
        const metadata = await sock.groupMetadata(grupoOrigemJid);
        const total = metadata.participants.length;
        const contactos = [];
        const numerosVistos = new Set();

        console.log(`🔍 Extraindo ${total} participantes`);

        for (let i = 0; i < metadata.participants.length; i++) {
            const p = metadata.participants[i];
            let numeroReal = null;

            if (p.id && p.id.includes('@s.whatsapp.net')) {
                numeroReal = normalizarID(p.id);
            } else if (p.phoneNumber) {
                numeroReal = normalizarID(p.phoneNumber);
            } else if (p.id && p.id.includes('@lid')) {
                numeroReal = await resolverLidParaNumero(sock, p.id, grupoOrigemJid);
            } else if (p.lid) {
                numeroReal = await resolverLidParaNumero(sock, p.lid, grupoOrigemJid);
                if (!numeroReal && p.id && !p.id.includes('@lid')) {
                    numeroReal = normalizarID(p.id);
                }
            }

            if (numeroReal && numeroReal.length >= 8 && numeroReal.length <= 15) {
                if (!numerosVistos.has(numeroReal)) {
                    numerosVistos.add(numeroReal);
                    contactos.push({ numero: numeroReal, admin: p.admin || null });
                }
            }

            if (onProgresso && (i % 3 === 0 || i === metadata.participants.length - 1)) {
                try { await onProgresso(i + 1, total, contactos.length); } catch (e) {}
            }
        }

        return {
            nome: metadata.subject || 'Sem nome',
            id: grupoOrigemJid.replace('@g.us', ''),
            total, resolvidos: contactos.length,
            contactos
        };
    } catch (error) {
        console.log('❌ Erro extrair:', error.message);
        return null;
    }
}

// =================== ADICIONAR TODOS COM 25s DE INTERVALO ===================
async function adicionarTodos(sock, jidEnvio, grupoDestinoJid, contactos, nomeOrigem, grupoOrigemId) {
    const total = contactos.length;
    console.log(`➕ Adicionando ${total} contactos`);
    console.log(`⏱️ Intervalo: ${CONFIG.INTERVALO_ENTRE_CONTACTOS/1000}s`);

    // Tempo estimado
    const tempoEstimado = total * CONFIG.INTERVALO_ENTRE_CONTACTOS;
    const tempoFormatado = formatarTempo(tempoEstimado);

    let mensagemAtual = null;
    const barraInicial = gerarBarraProgresso(0, 20);

    try {
        mensagemAtual = await sock.sendMessage(jidEnvio, {
            text: `➕ *A ADICIONAR CONTACTOS*\n\n` +
                  `${barraInicial}\n\n` +
                  `📥 Origem: ${nomeOrigem}\n` +
                  `📤 Destino: este grupo\n` +
                  `📋 Total: ${total}\n` +
                  `⏱️ Intervalo: 25s\n` +
                  `⏳ Tempo estimado: ~${tempoFormatado}\n\n` +
                  `🚀 Iniciando...`
        });
    } catch (e) {
        console.log('❌ Erro inicial:', e.message);
        return;
    }

    await new Promise(r => setTimeout(r, 3000));

    let adicionados = 0;
    let jaNoGrupo = 0;
    let erros = 0;
    let errosConsecutivos = 0;
    const resultados = [];
    const inicioTotal = Date.now();

    for (let i = 0; i < total; i++) {
        const contato = contactos[i];
        const inicioEnvio = Date.now();
        const numero = contato.numero;
        const jidContato = `${numero}@s.whatsapp.net`;

        try {
            const resposta = await sock.groupParticipantsUpdate(
                grupoDestinoJid,
                [jidContato],
                'add'
            );

            const status = resposta?.[0]?.status;

            if (status === '200' || status === 200) {
                adicionados++;
                errosConsecutivos = 0;
                resultados.push({ numero, status: '✅ Adicionado', emoji: '✅' });
                console.log(`✅ [${i+1}/${total}] +${numero}`);
            } else if (status === '403') {
                erros++;
                errosConsecutivos++;
                resultados.push({ numero, status: '🔒 Privacidade', emoji: '🔒' });
                console.log(`🔒 [${i+1}/${total}] +${numero} privacidade`);
            } else if (status === '408') {
                erros++;
                resultados.push({ numero, status: '❓ Não existe', emoji: '❓' });
                console.log(`❓ [${i+1}/${total}] +${numero} não existe`);
            } else if (status === '409') {
                jaNoGrupo++;
                resultados.push({ numero, status: '⚠️ Já no grupo', emoji: '⚠️' });
                console.log(`⚠️ [${i+1}/${total}] +${numero} já no grupo`);
            } else if (status === '401') {
                erros++;
                resultados.push({ numero, status: '🚫 Bloqueado', emoji: '🚫' });
                console.log(`🚫 [${i+1}/${total}] +${numero} bloqueado`);
            } else {
                erros++;
                resultados.push({ numero, status: `❌ ${status || 'Erro'}`, emoji: '❌' });
                console.log(`❌ [${i+1}/${total}] +${numero} status: ${status}`);
            }
        } catch (error) {
            erros++;
            errosConsecutivos++;
            const msg = error.message || 'Erro';
            resultados.push({ numero, status: `❌ ${msg.substring(0, 20)}`, emoji: '❌' });
            console.log(`❌ [${i+1}/${total}] +${numero}: ${msg}`);
        }

        // Salva progresso (para resume se cair)
        salvarProgresso({
            grupoDestino: grupoDestinoJid,
            grupoOrigemId,
            indiceAtual: i,
            total,
            adicionados,
            erros,
            jaNoGrupo,
            timestamp: Date.now()
        });

        // Atualiza mensagem
        const percentual = ((i + 1) / total) * 100;
        const barra = gerarBarraProgresso(percentual, 20);

        // Tempo decorrido e restante
        const tempoDecorrido = Date.now() - inicioTotal;
        const tempoRestante = (total - i - 1) * CONFIG.INTERVALO_ENTRE_CONTACTOS;

        const inicio = Math.max(0, i - 14);
        const visiveis = resultados.slice(inicio, i + 1);

        let listaTexto = '';
        visiveis.forEach((r, idx) => {
            const numReal = inicio + idx + 1;
            listaTexto += `\n${numReal}. ${r.emoji} +${r.numero} — ${r.status}`;
        });

        const texto = `➕ *A ADICIONAR CONTACTOS*\n\n` +
                      `${barra}\n\n` +
                      `📋 Total: ${total}\n` +
                      `✅ Adicionados: ${adicionados}\n` +
                      `⚠️ Já no grupo: ${jaNoGrupo}\n` +
                      `❌ Erros: ${erros}\n\n` +
                      `⏱️ Decorrido: ${formatarTempo(tempoDecorrido)}\n` +
                      `⏳ Restante: ~${formatarTempo(tempoRestante)}\n\n` +
                      `📝 *PROGRESSO:*${listaTexto}`;

        try {
            await sock.sendMessage(jidEnvio, {
                text: texto,
                edit: mensagemAtual.key
            });
        } catch (e) {}

        // Pausa de segurança se muitos erros consecutivos
        if (errosConsecutivos >= CONFIG.MAX_ERROS_CONSECUTIVOS) {
            console.log(`🛑 ${errosConsecutivos} erros seguidos — pausa de segurança`);
            try {
                await sock.sendMessage(jidEnvio, {
                    text: `⚠️ *PAUSA DE SEGURANÇA*\n\n` +
                          `${errosConsecutivos} erros consecutivos.\n` +
                          `Aguardando ${CONFIG.PAUSA_APOS_ERRO/1000}s...`,
                    edit: mensagemAtual.key
                });
            } catch (e) {}
            await new Promise(r => setTimeout(r, CONFIG.PAUSA_APOS_ERRO));
            errosConsecutivos = 0;
        }

        // ⏱️ INTERVALO EXATO DE 25 SEGUNDOS
        if (i < total - 1) {
            const tempoDecorridoEnvio = Date.now() - inicioEnvio;
            const tempoRestanteEspera = Math.max(0, CONFIG.INTERVALO_ENTRE_CONTACTOS - tempoDecorridoEnvio);
            
            console.log(`⏳ Aguardando ${(tempoRestanteEspera/1000).toFixed(1)}s...`);
            
            if (tempoRestanteEspera > 0) {
                await new Promise(r => setTimeout(r, tempoRestanteEspera));
            }
        }
    }

    // Relatório final
    await new Promise(r => setTimeout(r, 3000));

    const tempoTotal = Date.now() - inicioTotal;
    const barraFinal = gerarBarraProgresso(100, 20);

    let textoFinal = `✅ *ADIÇÃO CONCLUÍDA*\n\n` +
                     `${barraFinal}\n\n` +
                     `📊 *RESUMO:*\n` +
                     `▸ ✅ Adicionados: ${adicionados}\n` +
                     `▸ ⚠️ Já no grupo: ${jaNoGrupo}\n` +
                     `▸ ❌ Erros: ${erros}\n` +
                     `▸ 📋 Total: ${total}\n` +
                     `▸ ⏱️ Tempo: ${formatarTempo(tempoTotal)}\n\n` +
                     `📝 *DETALHES:*`;

    resultados.forEach((r, i) => {
        textoFinal += `\n${i + 1}. ${r.emoji} +${r.numero} — ${r.status}`;
    });

    try {
        await sock.sendMessage(jidEnvio, {
            text: textoFinal,
            edit: mensagemAtual.key
        });
    } catch (e) {}

    // Limpa progresso
    limparProgresso();

    console.log(`✅ Concluído: ${adicionados} adicionados, ${erros} erros`);
}

// =================== COMANDO PRINCIPAL ===================
module.exports.run = async (sock, msg, args, context) => {
    const jid = msg.key.remoteJid;
    const remetente = msg.key.participant || msg.key.remoteJid;

    try {
        const isGrupo = jid.endsWith('@g.us');

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
            console.log('⚠️ Comando no PV — ignorado');
            return;
        }

        // Sem argumentos
        if (args.length === 0) {
            await sock.sendMessage(jid, {
                text: `➕ *ADICIONAR CONTACTOS*\n\n` +
                      `📌 *Uso:*\n` +
                      `▸ .adicionar <id_grupo_origem>\n\n` +
                      `📋 *Exemplo:*\n` +
                      `▸ .adicionar 120363430201661881\n\n` +
                      `⚠️ *Detalhes:*\n` +
                      `▸ Adiciona TODOS os contactos\n` +
                      `▸ Intervalo: 25s entre cada\n` +
                      `▸ Bot deve ser ADMIN aqui\n` +
                      `▸ Bot deve estar no grupo origem\n\n` +
                      `⏱️ *Exemplo:* 20 contactos = ~8 minutos`
            }, { quoted: msg });
            return;
        }

        const possivelId = args[0].replace(/\D/g, '');

        if (possivelId.length < 10) {
            await sock.sendMessage(jid, {
                text: `❌ *ID INVÁLIDO*\n\n📌 Use: .adicionar <id_grupo_origem>`
            }, { quoted: msg });
            return;
        }

        const grupoOrigemJid = possivelId + '@g.us';

        // Verifica se bot está no grupo origem
        try {
            await sock.groupMetadata(grupoOrigemJid);
        } catch (e) {
            await sock.sendMessage(jid, {
                text: `❌ *BOT NÃO ESTÁ NO GRUPO ORIGEM*\n\n📌 ID: ${possivelId}`
            }, { quoted: msg });
            return;
        }

        // Mensagem inicial de extração
        const barraInicial = gerarBarraProgresso(0, 20);
        let mensagemAtual = null;

        try {
            mensagemAtual = await sock.sendMessage(jid, {
                text: `🔍 *A EXTRAIR CONTACTOS*\n\n${barraInicial}\n\n⏳ Aguarde...`
            });
        } catch (e) { return; }

        // Extrai contactos
        const scanner = await extrairContactos(sock, grupoOrigemJid, async (atual, total, resolvidos) => {
            const percentual = (atual / total) * 100;
            const barra = gerarBarraProgresso(percentual, 20);
            try {
                await sock.sendMessage(jid, {
                    text: `🔍 *A EXTRAIR CONTACTOS*\n\n` +
                          `${barra}\n\n` +
                          `📥 Grupo: ${scanner?.nome || '...'}\n` +
                          `👥 Processados: ${atual}/${total}\n` +
                          `✅ Resolvidos: ${resolvidos}`,
                    edit: mensagemAtual.key
                });
            } catch (e) {}
        });

        if (!scanner || scanner.contactos.length === 0) {
            try {
                await sock.sendMessage(jid, {
                    text: `❌ *NENHUM CONTACTO ENCONTRADO*`,
                    edit: mensagemAtual.key
                });
            } catch (e) {}
            return;
        }

        await new Promise(r => setTimeout(r, 2000));

        // Mostra resumo antes de começar
        const tempoTotal = scanner.contactos.length * CONFIG.INTERVALO_ENTRE_CONTACTOS;
        const barraFull = gerarBarraProgresso(100, 20);

        try {
            await sock.sendMessage(jid, {
                text: `✅ *EXTRAÇÃO CONCLUÍDA*\n\n` +
                      `${barraFull}\n\n` +
                      `📥 Origem: ${scanner.nome}\n` +
                      `👥 Resolvidos: ${scanner.resolvidos}/${scanner.total}\n` +
                      `📋 A adicionar: ${scanner.contactos.length}\n` +
                      `⏱️ Tempo estimado: ~${formatarTempo(tempoTotal)}\n\n` +
                      `🚀 A iniciar adição...`,
                edit: mensagemAtual.key
            });
        } catch (e) {}

        await new Promise(r => setTimeout(r, 3000));

        // Inicia adição de TODOS com 25s de intervalo
        await adicionarTodos(sock, jid, jid, scanner.contactos, scanner.nome, scanner.id);

    } catch (error) {
        console.error('❌ Erro:', error);
        if (jid.endsWith('@g.us')) {
            await sock.sendMessage(jid, {
                text: `❌ Erro: ${error.message}`
            }, { quoted: msg });
        }
    }
};
