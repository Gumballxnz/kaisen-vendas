// index.js - VERSÃO SEM CONTROLE DE RECONEXÃO
require('dotenv').config();
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    Browsers,
    delay
} = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const pino = require('pino');
const NodeCache = require('node-cache');

// =================== SUPRIMIR LOGS DESNECESSÁRIOS ===================
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

const LOG_PATTERNS_TO_SUPPRESS = [
    'Closing session',
    'SessionEntry',
    '_chains',
    'registrationId',
    'currentRatchet',
    'ephemeralKeyPair',
    'pubKey',
    'privKey',
    'lastRemoteEphemeralKey',
    'previousCounter',
    'rootKey',
    'indexInfo',
    'baseKey',
    'baseKeyType',
    'remoteIdentityKey',
    'pendingPreKey',
    'signedKeyId',
    'BZXQvd4yav',
    'BXP8fmKcMZromuUH',
    'BYgBuDA9+BGLauqy',
    'BSWvsfyeuUwnHbY',
    'BXV2dZfh67f+0OwM',
    'Buffer',
    '<Buffer'
];

function shouldSuppressLog(message) {
    if (!message) return false;
    const str = String(message);
    return LOG_PATTERNS_TO_SUPPRESS.some(pattern => str.includes(pattern));
}

console.log = function(...args) {
    const firstArg = args[0];
    if (shouldSuppressLog(firstArg)) return;
    originalLog.apply(console, args);
};

console.error = function(...args) {
    const firstArg = args[0];
    if (shouldSuppressLog(firstArg)) return;
    if (firstArg && typeof firstArg === 'string' && 
        (firstArg.includes('session') || firstArg.includes('decrypt') || 
         firstArg.includes('Bad MAC') || firstArg.includes('Closing'))) {
        return;
    }
    originalError.apply(console, args);
};

console.warn = function(...args) {
    const firstArg = args[0];
    if (shouldSuppressLog(firstArg)) return;
    originalWarn.apply(console, args);
};

// =================== DONOS DO BOT ===================
const DONOS = [
    { 
        id: '258879116693@s.whatsapp.net', 
        lid: '159034049044504@lid',
        nome: 'DONO',
        nivel: 'principal'
    }
];

const DONOS_IDS = DONOS.map(d => d.id);
const DONOS_LIDS = DONOS.map(d => d.lid);
const TODOS_DONOS = [...DONOS_IDS, ...DONOS_LIDS];

// =================== COMANDOS LIBERADOS ===================
const COMANDOS_LIBERADOS = [
    'id', 'pagar-aluguel', 'grupoinfo', 'ping', 'botinfo', 'donos', 'comandos',
    'ajuda', 'help', 'menu', 'info', 'status', 'aluguel', 'meuid', 'mylid',
    'perfil', 'sessoes', 'conectar', 'desconectar', 'limparsessoes',
    'reiniciar', 'alugar', 'resetbot', 'set-prefixo', 'ver-donos',
    'pedidos', 'alugard', 'detectartxt', 'configurar', 'mentions',
    'nanoadd', 'nanoativar'
];

// =================== GERENCIADOR DE PREFIXOS ===================
const PREFIXO_PATH = path.join(__dirname, 'database/prefixos/prefixo.json');
const DEFAULT_PREFIXO = '.';

function garantirPastaPrefixos() {
    const dir = path.dirname(PREFIXO_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log('📁 Pasta database/prefixos criada');
    }
}

function carregarPrefixos() {
    try {
        garantirPastaPrefixos();
        
        if (!fs.existsSync(PREFIXO_PATH)) {
            const dados = {
                prefixos: [DEFAULT_PREFIXO],
                principal: DEFAULT_PREFIXO,
                ultimaAtualizacao: new Date().toISOString(),
                alteradoPor: 'Sistema'
            };
            fs.writeFileSync(PREFIXO_PATH, JSON.stringify(dados, null, 2));
            return dados;
        }
        
        const data = fs.readFileSync(PREFIXO_PATH, 'utf-8');
        const config = JSON.parse(data);
        
        if (!config.prefixos || !Array.isArray(config.prefixos) || config.prefixos.length === 0) {
            config.prefixos = [DEFAULT_PREFIXO];
            config.principal = DEFAULT_PREFIXO;
        }
        
        if (!config.principal || !config.prefixos.includes(config.principal)) {
            config.principal = config.prefixos[0] || DEFAULT_PREFIXO;
        }
        
        return config;
    } catch (error) {
        return {
            prefixos: [DEFAULT_PREFIXO],
            principal: DEFAULT_PREFIXO,
            ultimaAtualizacao: new Date().toISOString(),
            alteradoPor: 'Sistema'
        };
    }
}

function salvarPrefixos(dados) {
    try {
        garantirPastaPrefixos();
        dados.ultimaAtualizacao = new Date().toISOString();
        fs.writeFileSync(PREFIXO_PATH, JSON.stringify(dados, null, 2));
        return true;
    } catch (error) {
        return false;
    }
}

function getPrefixos() {
    const config = carregarPrefixos();
    return config.prefixos || [DEFAULT_PREFIXO];
}

function getPrefixoPrincipal() {
    const config = carregarPrefixos();
    return config.principal || DEFAULT_PREFIXO;
}

function adicionarPrefixo(novoPrefixo, alteradoPor = 'Sistema') {
    const config = carregarPrefixos();
    if (!config.prefixos.includes(novoPrefixo)) {
        config.prefixos.push(novoPrefixo);
        config.alteradoPor = alteradoPor;
        return salvarPrefixos(config);
    }
    return false;
}

function removerPrefixo(prefixo, alteradoPor = 'Sistema') {
    const config = carregarPrefixos();
    if (config.prefixos.length <= 1) {
        return false;
    }
    const index = config.prefixos.indexOf(prefixo);
    if (index !== -1) {
        config.prefixos.splice(index, 1);
        if (config.principal === prefixo) {
            config.principal = config.prefixos[0];
        }
        config.alteradoPor = alteradoPor;
        return salvarPrefixos(config);
    }
    return false;
}

function setPrefixoPrincipal(prefixo, alteradoPor = 'Sistema') {
    const config = carregarPrefixos();
    if (config.prefixos.includes(prefixo)) {
        config.principal = prefixo;
        config.alteradoPor = alteradoPor;
        return salvarPrefixos(config);
    }
    return false;
}

function isComando(text) {
    if (!text) return false;
    const prefixos = getPrefixos();
    return prefixos.some(p => text.startsWith(p));
}

function extrairComando(text) {
    if (!text) return { command: '', args: [], prefixoUsado: '' };
    const prefixos = getPrefixos();
    
    for (const prefixo of prefixos) {
        if (text.startsWith(prefixo)) {
            const parts = text.slice(prefixo.length).trim().split(/ +/);
            const command = parts[0] ? parts[0].toLowerCase() : '';
            const args = parts.slice(1);
            return { command, args, prefixoUsado: prefixo };
        }
    }
    return { command: '', args: [], prefixoUsado: '' };
}

// =================== CONFIGURAÇÕES DO DATABASE ===================
const DATABASE_DIR = path.join(__dirname, 'database');
const ALUGUEIS_PATH = path.join(DATABASE_DIR, 'alugueis.json');

// =================== FUNÇÕES AUXILIARES ===================
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
        '💬': '💬', '❕': '❕', '🏆': '🏆', '🏷️': '🏷️', '📊': '📊', '👥': '👥', '📈': '📈', '🥇': '🥇',
        '🥈': '🥈', '🥉': '🥉', '━━━': '━━━', '▶': '▶', '📅': '📅', '💸': '💸', '💰': '💰', '🎯': '🎯'
    };
    let result = '';
    for (const char of normalized) {
        result += styleMap[char] || char;
    }
    return result;
}

function normalizarID(id) {
    if (!id) return '';
    const limpo = id.replace(/@(s\.whatsapp\.net|g\.us|lid|c\.us)/g, '');
    return limpo.replace(/\D/g, '');
}

function isDonoBot(userId) {
    if (!userId) return false;
    const userNormalizado = normalizarID(userId);
    return DONOS.some(dono => normalizarID(dono.id) === userNormalizado || normalizarID(dono.lid) === userNormalizado);
}

function getDonoInfo(userId) {
    if (!userId) return null;
    const userNormalizado = normalizarID(userId);
    for (const dono of DONOS) {
        if (normalizarID(dono.id) === userNormalizado || normalizarID(dono.lid) === userNormalizado) {
            return dono;
        }
    }
    return null;
}

function isComandoLiberado(commandName) {
    return COMANDOS_LIBERADOS.includes(commandName.toLowerCase());
}

function garantirDatabase() {
    if (!fs.existsSync(DATABASE_DIR)) {
        fs.mkdirSync(DATABASE_DIR, { recursive: true });
        console.log('📁 Pasta database criada');
    }
}

function lerAlugueis() {
    garantirDatabase();
    try {
        if (!fs.existsSync(ALUGUEIS_PATH) || fs.readFileSync(ALUGUEIS_PATH, 'utf-8').trim() === '') {
            fs.writeFileSync(ALUGUEIS_PATH, JSON.stringify({}, null, 2));
            return {};
        }
        return JSON.parse(fs.readFileSync(ALUGUEIS_PATH, 'utf-8'));
    } catch (error) {
        return {};
    }
}

function salvarAlugueis(dados) {
    garantirDatabase();
    try {
        fs.writeFileSync(ALUGUEIS_PATH, JSON.stringify(dados, null, 2));
        return true;
    } catch (error) {
        return false;
    }
}

function verificarAluguelAtivo(groupJid) {
    const alugueis = lerAlugueis();
    const aluguel = alugueis[groupJid];
    if (!aluguel || !aluguel.venceEm) return false;
    return new Date() < new Date(aluguel.venceEm);
}

// =================== ARQUIVO PARA SALVAR NOMES DAS CONEXÕES ===================
const CONEXOES_FILE = path.join(__dirname, 'database/conexoes_nomes.json');

function lerConexoesNomes() {
    try {
        const dir = path.dirname(CONEXOES_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        if (!fs.existsSync(CONEXOES_FILE)) {
            fs.writeFileSync(CONEXOES_FILE, JSON.stringify({}, null, 2));
            return {};
        }
        return JSON.parse(fs.readFileSync(CONEXOES_FILE, 'utf-8'));
    } catch (e) {
        return {};
    }
}

function salvarConexoesNomes(dados) {
    try {
        const dir = path.dirname(CONEXOES_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(CONEXOES_FILE, JSON.stringify(dados, null, 2));
        return true;
    } catch (e) {
        return false;
    }
}

function salvarNomeConexao(numero, nome) {
    const dados = lerConexoesNomes();
    dados[numero] = {
        nome: nome,
        data: new Date().toISOString()
    };
    return salvarConexoesNomes(dados);
}

function getNomeConexao(numero) {
    const dados = lerConexoesNomes();
    return dados[numero] ? dados[numero].nome : null;
}

// =================== SESSION MANAGER ===================
class SessionManager {
    constructor() {
        this.sessions = new Map();
        this.pendingPairings = new Map();
        this.sessionsDir = path.join(__dirname, 'sessions');
        this.mainSessionNumber = null;
        this.configPath = path.join(__dirname, 'config.json');
        this.messageHandlers = new Map();
        this.commandsInitialized = false;
        this.mainNumber = null;
        this.handlerRegistered = new Set();
        
        if (!fs.existsSync(this.sessionsDir)) {
            fs.mkdirSync(this.sessionsDir, { recursive: true });
        }
        
        this.loadConfig();
        this.loadExistingSessions();
    }

    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                this.config = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
            } else {
                this.config = { sessions: [], mainSession: null, mainNumber: null, lastUpdated: new Date().toISOString() };
                this.saveConfig();
            }
        } catch (error) {
            this.config = { sessions: [], mainSession: null, mainNumber: null, lastUpdated: new Date().toISOString() };
            this.saveConfig();
        }
    }

    saveConfig() {
        try {
            this.config.lastUpdated = new Date().toISOString();
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
        } catch (error) {}
    }

    loadExistingSessions() {
        try {
            const dirs = fs.readdirSync(this.sessionsDir);
            for (const dir of dirs) {
                if (fs.statSync(path.join(this.sessionsDir, dir)).isDirectory()) {
                    const credsPath = path.join(this.sessionsDir, dir, 'creds.json');
                    if (fs.existsSync(credsPath)) {
                        try {
                            const creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
                            if (creds && creds.registered) {
                                if (!this.config.sessions.includes(dir)) {
                                    this.config.sessions.push(dir);
                                    this.saveConfig();
                                }
                                this.sessions.set(dir, {
                                    number: dir,
                                    status: 'disconnected',
                                    connectedAt: null,
                                    creds: creds,
                                    sock: null
                                });
                            }
                        } catch (e) {}
                    }
                }
            }
            console.log(`📂 ${this.sessions.size} sessões encontradas`);
        } catch (error) {}
    }

    getSessionPath(number) {
        return path.join(this.sessionsDir, number);
    }

    podeConectar(userId) {
        if (!this.config.mainNumber) {
            return isDonoBot(userId);
        }
        const userNormalizado = normalizarID(userId);
        const mainNormalizado = normalizarID(this.config.mainNumber);
        return userNormalizado === mainNormalizado || isDonoBot(userId);
    }

    async createSession(number, callback, userId) {
        const cleanNumber = number.replace(/\D/g, '');
        const sessionPath = this.getSessionPath(cleanNumber);
        const logger = pino({ level: 'silent' });

        try {
            if (userId && !this.podeConectar(userId)) {
                callback('unauthorized', { 
                    number: cleanNumber, 
                    error: 'Apenas o número principal pode conectar novas sessões!',
                    mainNumber: this.config.mainNumber
                });
                throw new Error('Apenas o número principal pode conectar novas sessões!');
            }

            if (this.sessions.has(cleanNumber) && this.sessions.get(cleanNumber).sock) {
                callback('exists', { number: cleanNumber });
                return this.sessions.get(cleanNumber).sock;
            }

            if (!this.config.sessions.includes(cleanNumber)) {
                this.config.sessions.push(cleanNumber);
                this.saveConfig();
            }

            if (!fs.existsSync(sessionPath)) {
                fs.mkdirSync(sessionPath, { recursive: true });
            }

            const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
            const { version } = await fetchLatestBaileysVersion();

            const sock = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, logger),
                },
                logger: logger,
                printQRInTerminal: false,
                browser: Browsers.macOS('Chrome'),
                msgRetryCounterCache: new NodeCache(),
                markOnlineOnConnect: false,
                connectTimeoutMs: 120000,
                keepAliveIntervalMs: 30000,
                emitOwnEvents: false,
                retryRequestDelayMs: 2000,
                maxRetries: 5,
                fireInitQueries: false,
                generateHighQualityLinkPreview: false,
                getMessage: async () => undefined,
                shouldSyncHistoryMessage: () => false,
                historySyncConfig: { maxSyncSize: 0, maxSyncRetries: 0 },
                defaultQueryTimeoutMs: 60000
            });

            sock.ev.on('creds.update', saveCreds);

            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;

                if (qr) {
                    callback('qr', { number: cleanNumber, qr });
                }

                if (connection === 'open') {
                    const phoneNumber = sock.user?.id?.split(':')[0] || cleanNumber;
                    
                    this.sessions.set(phoneNumber, {
                        sock: sock,
                        number: phoneNumber,
                        connectedAt: Date.now(),
                        status: 'connected',
                        creds: state.creds
                    });

                    await saveCreds();

                    if (!this.config.sessions.includes(phoneNumber)) {
                        this.config.sessions.push(phoneNumber);
                        this.saveConfig();
                    }

                    if (!this.config.mainNumber) {
                        this.config.mainNumber = phoneNumber;
                        this.saveConfig();
                        console.log(`👑 Número principal definido: ${phoneNumber}`);
                    }

                    callback('connected', { number: phoneNumber, sock });
                    this.pendingPairings.delete(cleanNumber);
                    
                    console.log(`✅ Sessão ${phoneNumber} conectada`);
                    this.setupSessionMessageHandler(sock, phoneNumber);
                    this.listActiveSessions();
                }

                if (connection === 'close') {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    const loggedOut = statusCode === DisconnectReason.loggedOut || 
                                     lastDisconnect?.error?.output?.payload?.reason === 'loggedOut';
                    
                    const sessionData = this.sessions.get(cleanNumber);
                    if (sessionData) {
                        sessionData.status = 'disconnected';
                        sessionData.sock = null;
                        this.sessions.set(cleanNumber, sessionData);
                    }

                    this.removeHandler(cleanNumber);
                    callback('disconnected', { number: cleanNumber, loggedOut });

                    if (loggedOut) {
                        this.sessions.delete(cleanNumber);
                        this.config.sessions = this.config.sessions.filter(n => n !== cleanNumber);
                        this.saveConfig();
                        if (fs.existsSync(sessionPath)) {
                            fs.rmSync(sessionPath, { recursive: true, force: true });
                        }
                    } else {
                        // RECONEXÃO DIRETA - sem controle de tentativas
                        setTimeout(() => {
                            this.createSession(cleanNumber, callback, userId).catch(() => {});
                        }, 5000);
                    }
                }
            });

            if (state.creds && state.creds.registered) {
                await delay(2000);
            }

            return sock;

        } catch (error) {
            callback('error', { number: cleanNumber, error: error.message });
            throw error;
        }
    }

    removeHandler(sessionNumber) {
        const cleanNumber = sessionNumber.replace(/\D/g, '');
        if (this.messageHandlers.has(cleanNumber)) {
            try {
                const handlerData = this.messageHandlers.get(cleanNumber);
                if (handlerData && handlerData.sock && handlerData.sock.ev) {
                    handlerData.sock.ev.off('messages.upsert', handlerData.handler);
                }
            } catch (e) {}
            this.messageHandlers.delete(cleanNumber);
            this.handlerRegistered.delete(cleanNumber);
        }
    }

    setupSessionMessageHandler(sock, sessionNumber) {
        if (!sock) return;
        const cleanNumber = sessionNumber.replace(/\D/g, '');
        
        if (this.handlerRegistered.has(cleanNumber)) {
            this.removeHandler(cleanNumber);
        }
        
        this.handlerRegistered.add(cleanNumber);

        const handler = async ({ messages, type }) => {
            if (type !== 'notify') return;
            if (!this.handlerRegistered.has(cleanNumber)) return;
            
            for (const msg of messages) {
                try {
                    await this.processMessage(sock, msg, sessionNumber);
                } catch (error) {
                    if (error?.message?.includes('Bad MAC') || 
                        error?.message?.includes('session') ||
                        error?.message?.includes('decrypt')) {
                        continue;
                    }
                    if (!error?.message?.includes('session')) {
                        console.error(`❌ Erro processando mensagem na sessão ${sessionNumber}:`, error.message);
                    }
                }
            }
        };
        
        sock.ev.on('messages.upsert', handler);
        this.messageHandlers.set(cleanNumber, { sock, handler });
    }

    extractInteractionData(msg) {
        try {
            if (!msg || !msg.message) return null;
            const message = msg.message;
            
            if (message.templateButtonReplyMessage) {
                const reply = message.templateButtonReplyMessage;
                return {
                    type: 'templateButtonReply',
                    selectedId: reply.selectedId || '',
                    selectedDisplayText: reply.selectedDisplayText || '',
                    raw: reply
                };
            }
            
            if (message.interactiveMessage) {
                const interactive = message.interactiveMessage;
                const body = interactive.body?.text || '';
                
                if (interactive.nativeFlowMessage) {
                    const buttons = interactive.nativeFlowMessage.buttons || [];
                    const buttonData = buttons.map(b => {
                        try {
                            const params = JSON.parse(b.buttonParamsJson || '{}');
                            return {
                                name: b.name,
                                displayText: params.display_text || '',
                                id: params.id || params.copy_code || '',
                                copyCode: params.copy_code || null
                            };
                        } catch (e) {
                            return { name: b.name, displayText: '', id: '' };
                        }
                    });
                    
                    return {
                        type: 'nativeFlow',
                        body: body,
                        buttons: buttonData,
                        raw: interactive
                    };
                }
                
                if (interactive.quickReplyMessage) {
                    const quickReply = interactive.quickReplyMessage;
                    const buttons = quickReply.buttons || [];
                    const buttonData = buttons.map(b => {
                        try {
                            const params = JSON.parse(b.buttonParamsJson || '{}');
                            return {
                                name: b.name,
                                displayText: params.display_text || '',
                                id: params.id || ''
                            };
                        } catch (e) {
                            return { name: b.name, displayText: '', id: '' };
                        }
                    });
                    
                    return {
                        type: 'quickReply',
                        body: body,
                        buttons: buttonData,
                        raw: interactive
                    };
                }
                
                return {
                    type: 'interactive',
                    body: body,
                    raw: interactive
                };
            }
            
            if (message.buttonsResponseMessage) {
                const response = message.buttonsResponseMessage;
                return {
                    type: 'buttonsResponse',
                    selectedId: response.selectedButtonId || '',
                    selectedText: response.selectedDisplayText || '',
                    raw: response
                };
            }
            
            if (message.listResponseMessage) {
                const response = message.listResponseMessage;
                return {
                    type: 'listResponse',
                    title: response.title || '',
                    rowId: response.rowId || '',
                    raw: response
                };
            }
            
            return null;
        } catch (error) {
            return null;
        }
    }

    async executarComando(command, sock, msg, args, context) {
        if (!global.comandosCarregados || !global.comandosCarregados[command]) return false;
        try {
            await global.comandosCarregados[command].run(sock, msg, args, context);
            return true;
        } catch (err) {
            console.error(`❌ [COMANDO FALHOU] ${command.toUpperCase()} - ${err.message || 'Erro desconhecido'}`);
            console.error(`   📂 Sessão: ${context?.sessionNumber || 'desconhecida'}`);
            console.error(`   📱 De: ${context?.sender || 'desconhecido'}`);
            console.error(`   📌 Args: ${args?.join(' ') || 'nenhum'}`);
            
            try {
                if (sock && msg?.key?.remoteJid) {
                    await sock.sendMessage(msg.key.remoteJid, { 
                        text: toSpecialStyle(`❌ *Erro ao executar comando ${command.toUpperCase()}*\n\n⚠️ Ocorreu um erro inesperado. Tente novamente mais tarde.`) 
                    }, { quoted: msg });
                }
            } catch (e) {}
            return false;
        }
    }

    async processInteraction(sock, msg, sessionNumber, interaction) {
        try {
            if (!interaction) return false;
            
            const from = msg.key.remoteJid;
            const sender = msg.key.participant || msg.key.remoteJid;
            const ehDono = isDonoBot(sender);
            
            let selectedId = '';
            let selectedText = '';
            
            switch (interaction.type) {
                case 'templateButtonReply':
                    selectedId = interaction.selectedId || '';
                    selectedText = interaction.selectedDisplayText || '';
                    break;
                case 'buttonsResponse':
                    selectedId = interaction.selectedId || '';
                    selectedText = interaction.selectedText || '';
                    break;
                case 'quickReply':
                case 'nativeFlow':
                    if (interaction.buttons && interaction.buttons.length > 0) {
                        const button = interaction.buttons[0];
                        selectedId = button.id || button.displayText || '';
                        selectedText = button.displayText || '';
                    }
                    break;
                default:
                    selectedId = interaction.selectedId || '';
                    selectedText = interaction.selectedDisplayText || '';
            }
            
            let comandoId = selectedId;
            if (comandoId.startsWith('.')) {
                comandoId = comandoId.slice(1);
            }
            
            if (comandoId && global.comandosCarregados && global.comandosCarregados[comandoId]) {
                const isGroup = from.endsWith('@g.us');
                const aluguelAtivo = verificarAluguelAtivo(from);
                const comandoLiberado = isComandoLiberado(comandoId);
                
                if (!ehDono && !aluguelAtivo && !comandoLiberado) {
                    await sock.sendMessage(from, {
                        text: toSpecialStyle('🔒 Grupo sem aluguel ativo.')
                    });
                    return true;
                }
                
                const context = {
                    from, isGroup, isAdmin: true, isBotAdmin: true, sender,
                    ehDono, sessionNumber, comandoLiberado, aluguelAtivo,
                    isInteraction: true, interaction: interaction
                };
                
                await this.executarComando(comandoId, sock, msg, [], context);
                return true;
            }
            
            return false;
            
        } catch (error) {
            const comandoId = interaction?.selectedId || interaction?.selectedDisplayText || 'desconhecido';
            console.error(`❌ [INTERAÇÃO FALHOU] ${comandoId} - ${error.message || 'Erro desconhecido'}`);
            return false;
        }
    }

    async processMessage(sock, msg, sessionNumber) {
        try {
            if (!msg || !msg.message || msg.key.fromMe) return;
            
            const from = msg.key.remoteJid;
            if (!from) return;
            
            const isGroup = from.endsWith('@g.us');
            const sender = msg.key.participant || msg.key.remoteJid;
            
            const interaction = this.extractInteractionData(msg);
            if (interaction) {
                const processed = await this.processInteraction(sock, msg, sessionNumber, interaction);
                if (processed) return;
            }
            
            const text = this.getMessageText(msg);
            if (!text) return;

            const ehDono = isDonoBot(sender);
            const aluguelAtivo = verificarAluguelAtivo(from);
            
            const comandoInfo = extrairComando(text);
            const comandoNome = comandoInfo.command;
            const args = comandoInfo.args;
            const prefixoUsado = comandoInfo.prefixoUsado;
            
            const comandoLiberado = isComandoLiberado(comandoNome);

            console.log(`[MSG] De: ${sender} | Chat: ${from} | Grupo: ${isGroup} | Dono: ${ehDono} | Aluguel: ${aluguelAtivo} | Cmd: "${comandoNome}"`);
            
            let isAdmin = false, isBotAdmin = false;

            if (!isGroup && ehDono) {
                if (comandoNome) {
                    if (!global.comandosCarregados || !global.comandosCarregados[comandoNome]) return;

                    const context = { 
                        from, isGroup: false, isAdmin: true, isBotAdmin: true,
                        sender, ehDono: true, sessionNumber,
                        comandoLiberado: true, aluguelAtivo: true,
                        prefixoUsado: prefixoUsado
                    };

                    await this.executarComando(comandoNome, sock, msg, args, context);
                } else {
                    if (global.comandosCarregados['kaisen']?.processarMensagem) {
                        await global.comandosCarregados['kaisen'].processarMensagem(sock, msg);
                    }
                }
                return;
            }

            if (!isGroup) {
                if (global.comandosCarregados['kaisen']?.processarMensagem) {
                    await global.comandosCarregados['kaisen'].processarMensagem(sock, msg);
                }
                return;
            }

            try {
                isAdmin = await this.verificarAdmin(sock, from, sender);
                isBotAdmin = await this.verificarBotAdmin(sock, from);
            } catch (err) {}

            const context = { 
                from, isGroup, isAdmin, isBotAdmin, sender, ehDono,
                sessionNumber, comandoLiberado, aluguelAtivo,
                prefixoUsado: prefixoUsado
            };

            if (!ehDono && !aluguelAtivo && !comandoLiberado) {
                if (comandoNome && global.comandosCarregados && global.comandosCarregados[comandoNome]) {
                    await this.enviarMensagemBloqueada(sock, from, msg);
                }
                return;
            }

            if (comandoNome && global.comandosCarregados && global.comandosCarregados[comandoNome]) {
                await this.executarComando(comandoNome, sock, msg, args, context);
            }
            
        } catch (err) {
            if (err?.message?.includes('Bad MAC') || 
                err?.message?.includes('decrypt') || 
                err?.message?.includes('session')) {
                return;
            }
            const comandoNome = this.getMessageText(msg)?.trim()?.split(/ +/)[0] || 'desconhecido';
            console.error(`❌ [ERRO] Comando "${comandoNome}" falhou na sessão ${sessionNumber}:`, err.message);
        }
    }

    getMessageText(msg = {}) {
        try {
            if (!msg || !msg.message) return '';
            const m = msg.message;
            return m.conversation ||
                m.extendedTextMessage?.text ||
                m.imageMessage?.caption ||
                m.videoMessage?.caption ||
                '';
        } catch (e) {
            return '';
        }
    }

    async verificarAdmin(sock, groupJid, participantJid) {
        try {
            const metadata = await sock.groupMetadata(groupJid);
            const participant = metadata.participants.find(p => p.id === participantJid);
            if (!participant) return false;
            return participant.admin === 'admin' || participant.admin === 'superadmin';
        } catch (error) {
            return false;
        }
    }

    async verificarBotAdmin(sock, groupJid) {
        try {
            const botId = sock.user?.id?.split(':')[0] + '@s.whatsapp.net';
            const metadata = await sock.groupMetadata(groupJid);
            const botParticipant = metadata.participants.find(p => p.id === botId);
            if (!botParticipant) return false;
            return botParticipant.admin === 'admin' || botParticipant.admin === 'superadmin';
        } catch (error) {
            return false;
        }
    }

    async requestPairingCode(number, callback, userId) {
        try {
            const cleanNumber = number.replace(/\D/g, '');
            if (cleanNumber.length < 10) throw new Error('Número inválido');

            if (this.sessions.has(cleanNumber) && this.sessions.get(cleanNumber).sock) {
                callback('exists', { number: cleanNumber });
                return;
            }

            this.pendingPairings.set(cleanNumber, true);
            const sock = await this.createSession(cleanNumber, callback, userId);
            
            await delay(5000);

            try {
                const code = await sock.requestPairingCode(cleanNumber);
                callback('pairing_code', { number: cleanNumber, code });
                this.pendingPairings.delete(cleanNumber);
                
                if (!this.config.sessions.includes(cleanNumber)) {
                    this.config.sessions.push(cleanNumber);
                    this.saveConfig();
                }
                
                return code;
            } catch (error) {
                callback('error', { number: cleanNumber, error: error.message });
                this.pendingPairings.delete(cleanNumber);
                throw error;
            }

        } catch (error) {
            callback('error', { number, error: error.message });
            this.pendingPairings.delete(number);
            throw error;
        }
    }

    async reconnectAllSessions(callback) {
        const sessionsToReconnect = this.config.sessions.filter(n => {
            const session = this.sessions.get(n);
            return !session || !session.sock;
        });

        if (sessionsToReconnect.length === 0) {
            console.log('✅ Todas as sessões já estão conectadas');
            return;
        }

        console.log(`🔄 Reconectando ${sessionsToReconnect.length} sessões...`);
        
        for (const number of sessionsToReconnect) {
            try {
                await this.createSession(number, callback, this.config.mainNumber);
                await delay(3000);
            } catch (error) {}
        }
    }

    listActiveSessions() {
        const sessions = this.getActiveSessions();
        if (sessions.length === 0) {
            console.log('📭 Nenhuma sessão ativa');
            return;
        }
        console.log(`📱 ${sessions.length} sessões ativas:`);
        sessions.forEach((s, i) => {
            const isMain = s.number === this.config.mainNumber ? ' 👑' : '';
            console.log(`   ${i+1}. ${s.number}${isMain}`);
        });
    }

    getActiveSessions() {
        const sessions = [];
        for (const [number, data] of this.sessions) {
            if (data.status === 'connected' && data.sock) {
                sessions.push({ number, connectedAt: data.connectedAt, status: data.status, sock: data.sock });
            }
        }
        return sessions;
    }

    getSession(number) {
        const cleanNumber = number.replace(/\D/g, '');
        return this.sessions.get(cleanNumber);
    }

    getSessionSock(number) {
        const cleanNumber = number.replace(/\D/g, '');
        const session = this.sessions.get(cleanNumber);
        return session?.sock || null;
    }

    setMainSession(number) {
        this.mainSessionNumber = number.replace(/\D/g, '');
        this.config.mainSession = this.mainSessionNumber;
        this.saveConfig();
    }

    getMainSock() {
        if (this.mainSessionNumber) {
            const session = this.getSession(this.mainSessionNumber);
            return session?.sock || null;
        }
        const sessions = this.getActiveSessions();
        if (sessions.length > 0) {
            return this.getSession(sessions[0].number)?.sock || null;
        }
        return null;
    }

    getConfiguredSessions() {
        return this.config.sessions || [];
    }

    getMainNumber() {
        return this.config.mainNumber;
    }

    removeSession(number) {
        const cleanNumber = number.replace(/\D/g, '');
        if (this.sessions.has(cleanNumber)) {
            this.sessions.delete(cleanNumber);
            this.config.sessions = this.config.sessions.filter(n => n !== cleanNumber);
            this.saveConfig();
            return true;
        }
        return false;
    }

    async enviarMensagemBloqueada(sock, jid, msg) {
        try {
            const texto = `╭━━━〔 🔒 *GRUPO BLOQUEADO* 〕━━━╮
┃
┃ 🔒 *Este grupo não possui um plano ativo!*
┃
┃ 📌 *Todos os comandos estão bloqueados.*
┃
┃ 💡 Entre em contato com o dono para ativar.
┃
┃ 👑 *Dono:* 258879116693
┃ 📱 *WhatsApp:* wa.me/258879116693
╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
            await sock.sendMessage(jid, { text: toSpecialStyle(texto) }, { quoted: msg });
        } catch (error) {}
    }

    async reiniciarBot(sock, jid, donoNome = 'Dono') {
        console.log(`🔄 [REINICIAR] Solicitado por: ${donoNome}`);
        
        const msgReiniciando = `╭━━━〔 🔄 *REINICIANDO BOT* 〕━━━╮
┃
┃ 🔄 O bot está sendo reiniciado...
┃ 👤 *Solicitado por:* ${donoNome}
┃ ⏰ *Aguarde alguns segundos*
╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

        try {
            await sock.sendMessage(jid, { text: toSpecialStyle(msgReiniciando) });
        } catch (error) {}

        setTimeout(() => {
            console.log('🔄 Executando reinicialização...');
            
            try {
                if (sock.ws) sock.ws.close();
                if (sock.end) sock.end();
            } catch (e) {}

            if (global.monitorInterval) {
                clearInterval(global.monitorInterval);
                global.monitorInterval = null;
            }

            const restartFile = path.join(__dirname, '.restart');
            try {
                fs.writeFileSync(restartFile, JSON.stringify({
                    timestamp: new Date().toISOString(),
                    motivo: 'comando_reiniciar',
                    solicitadoPor: donoNome
                }));
            } catch (e) {}

            setTimeout(() => {
                commandsInitialized = false;
                messageProcessingEnabled = false;
                isConnecting = false;
                process.exit(0);
            }, 2000);
            
        }, 3000);
    }
}

// =================== INSTANCIA O SESSION MANAGER ===================
const sessionManager = new SessionManager();
global.sessionManager = sessionManager;

// =================== VARIÁVEIS ===================
let connectionStartTime = null;
let messageProcessingEnabled = false;
let commandsInitialized = false;
let mainSock = null;
let mainNumber = null;
let isConnecting = false;
let reconnectTimer = null;

// =================== SISTEMA DE COMANDOS ===================
global.comandosCarregados = {};
let commandsLoadTimeout = null;

function scanAllCommands(dirPath, basePath = '') {
    const commands = [];
    try {
        const items = fs.readdirSync(dirPath);
        for (const item of items) {
            const fullPath = path.join(dirPath, item);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                commands.push(...scanAllCommands(fullPath, path.join(basePath, item)));
            } else if (item.endsWith('.js')) {
                commands.push({
                    name: path.basename(item, '.js'),
                    path: fullPath,
                    folder: basePath || 'raiz',
                    relativePath: path.join(basePath, item)
                });
            }
        }
    } catch (error) {}
    return commands;
}

async function initializeCommands(sock) {
    if (commandsInitialized) return;

    const commandsDir = path.join(__dirname, 'comandos');
    if (!fs.existsSync(commandsDir)) {
        console.log('📁 Diretório de comandos não encontrado');
        return;
    }

    console.log('🔄 Inicializando comandos...');
    const allCommands = scanAllCommands(commandsDir);
    
    if (allCommands.length === 0) {
        console.log('📁 Nenhum comando encontrado');
        return;
    }

    const pastas = {};
    for (const cmd of allCommands) {
        const pasta = cmd.folder || 'raiz';
        if (!pastas[pasta]) pastas[pasta] = [];
        pastas[pasta].push(cmd);
    }

    console.log(`📥 Encontrados ${allCommands.length} comandos em ${Object.keys(pastas).length} pastas`);
    
    let sucessos = 0, erros = 0;
    const comandosFalhos = [];
    
    for (const cmd of allCommands) {
        try {
            const success = await loadCommand(cmd.path, sock);
            if (success) {
                sucessos++;
            } else {
                erros++;
                comandosFalhos.push({
                    nome: cmd.name,
                    pasta: cmd.folder,
                    caminho: cmd.relativePath,
                    erro: 'Falha ao carregar (verifique a estrutura do comando)'
                });
            }
        } catch (error) {
            erros++;
            comandosFalhos.push({
                nome: cmd.name,
                pasta: cmd.folder,
                caminho: cmd.relativePath,
                erro: error.message || 'Erro desconhecido'
            });
        }
        await delay(50);
    }
    
    console.log(`✅ ${sucessos}/${allCommands.length} comandos carregados`);
    
    if (erros > 0) {
        console.log(`❌ ${erros} comandos falharam:`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        comandosFalhos.forEach((cmd, index) => {
            console.log(`  ${index + 1}. 📛 ${cmd.nome.toUpperCase()}`);
            console.log(`     📂 Pasta: ${cmd.pasta}`);
            console.log(`     📁 Arquivo: ${cmd.caminho}`);
            if (cmd.erro) {
                console.log(`     ❌ Erro: ${cmd.erro}`);
            }
            console.log('  ──────────────────────────────');
        });
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
    
    commandsInitialized = true;

    setTimeout(() => {
        try {
            if (global.comandosCarregados['detectartxt']?.init) {
                global.comandosCarregados['detectartxt'].init(sock);
            }
            
            if (global.comandosCarregados['nanoadd']?.init) {
                global.comandosCarregados['nanoadd'].init(sock);
            }
        } catch (e) {}
    }, 2000);

    setTimeout(() => {
        try {
            const fileWatcher = require('./fileWatcher');
            fileWatcher.watchDirectory(commandsDir, async (event, filePath) => {
                const fileName = path.basename(filePath);
                if (commandsLoadTimeout) clearTimeout(commandsLoadTimeout);
                commandsLoadTimeout = setTimeout(async () => {
                    try {
                        const currentSock = sessionManager.getMainSock();
                        if (event === 'created' || event === 'changed') {
                            await loadCommand(filePath, currentSock);
                        } else if (event === 'deleted') {
                            await unloadCommand(fileName, currentSock);
                        }
                    } catch (err) {}
                }, 1000);
            }, 3000);
        } catch (e) {}
    }, 3000);
}

async function loadCommand(commandPath, sock) {
    const nomeComando = path.basename(commandPath, '.js');
    try {
        if (!fs.existsSync(commandPath)) {
            console.log(`⚠️ Arquivo não encontrado: ${commandPath}`);
            return false;
        }
        
        try {
            const stats = fs.statSync(commandPath);
            if (stats.size === 0) {
                console.log(`⚠️ Arquivo vazio: ${nomeComando}.js`);
                return false;
            }
        } catch (e) {
            return false;
        }
        
        delete require.cache[require.resolve(commandPath)];
        
        if (global.comandosCarregados[nomeComando]?.destroy) {
            await global.comandosCarregados[nomeComando].destroy(sock);
        }

        const comando = require(commandPath);
        
        if (!comando.run || typeof comando.run !== 'function') {
            console.log(`⚠️ Comando "${nomeComando}" não tem função "run"`);
            return false;
        }
        
        comando._pasta = path.basename(path.dirname(commandPath));
        comando._caminho = commandPath;
        global.comandosCarregados[nomeComando] = comando;

        const aliases = [
            ...(Array.isArray(comando.comando) ? comando.comando : []),
            ...(Array.isArray(comando.alias) ? comando.alias : []),
            ...(Array.isArray(comando.aliases) ? comando.aliases : [])
        ];
        for (const a of aliases) {
            if (a && typeof a === 'string') {
                global.comandosCarregados[a.toLowerCase()] = comando;
            }
        }

        if (comando.init) {
            await comando.init(sock);
        }
        return true;
    } catch (error) {
        console.log(`❌ Erro ao carregar comando "${nomeComando}": ${error.message}`);
        delete require.cache[require.resolve(commandPath)];
        return false;
    }
}

async function unloadCommand(file, sock) {
    const nomeComando = path.basename(file, '.js');
    try {
        if (global.comandosCarregados[nomeComando]?.destroy) {
            await global.comandosCarregados[nomeComando].destroy(sock);
        }
        delete global.comandosCarregados[nomeComando];
    } catch (error) {}
}

// =================== CONEXÃO PRINCIPAL SEM CONTROLE DE RECONEXÃO ===================
async function connectBot() {
    if (isConnecting) {
        console.log('⏳ [CONEXÃO] Já está conectando...');
        return;
    }

    isConnecting = true;
    console.log('🚀 Iniciando conexão principal...');

    try {
        const authPath = './auth';
        if (fs.existsSync(authPath)) {
            try {
                const credsPath = path.join(authPath, 'creds.json');
                if (fs.existsSync(credsPath)) {
                    const creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
                    if (!creds || !creds.registered) {
                        console.log('⚠️ Credenciais inválidas, limpando...');
                        fs.rmSync(authPath, { recursive: true, force: true });
                    }
                }
            } catch (e) {
                fs.rmSync(authPath, { recursive: true, force: true });
            }
        }

        const { state, saveCreds } = await useMultiFileAuthState(authPath);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
            },
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            browser: Browsers.macOS('Chrome'),
            markOnlineOnConnect: false,
            connectTimeoutMs: 120000,
            keepAliveIntervalMs: 30000,
            emitOwnEvents: false,
            retryRequestDelayMs: 2000,
            maxRetries: 5,
            fireInitQueries: false,
            generateHighQualityLinkPreview: false,
            getMessage: async () => undefined,
            shouldSyncHistoryMessage: () => false,
            historySyncConfig: { maxSyncSize: 0, maxSyncRetries: 0 },
            defaultQueryTimeoutMs: 60000,
            msgRetryCounterCache: new NodeCache()
        });

        mainSock = sock;
        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'open') {
                isConnecting = false;
                
                mainNumber = sock.user?.id?.split(':')[0];
                connectionStartTime = Date.now();
                messageProcessingEnabled = false;
                
                if (!sessionManager.config.mainNumber) {
                    sessionManager.config.mainNumber = mainNumber;
                    sessionManager.saveConfig();
                    console.log(`👑 Número principal definido: ${mainNumber}`);
                }
                
                sessionManager.setMainSession(mainNumber);
                sessionManager.sessions.set(mainNumber, {
                    sock: sock,
                    number: mainNumber,
                    connectedAt: Date.now(),
                    status: 'connected',
                    creds: state.creds
                });
                
                console.log(`✅ Conectado! Número principal: ${mainNumber}`);
                console.log(`🔐 Apenas este número pode conectar novas sessões!`);
                
                sessionManager.setupSessionMessageHandler(sock, mainNumber);
                
                setTimeout(async () => {
                    await sessionManager.reconnectAllSessions((event, data) => {
                        if (event === 'connected') {
                            console.log(`✅ Sessão ${data.number} reconectada`);
                            const sessionSock = sessionManager.getSessionSock(data.number);
                            if (sessionSock) {
                                sessionManager.setupSessionMessageHandler(sessionSock, data.number);
                            }
                        }
                    });
                }, 5000);
                
                if (!commandsInitialized) {
                    await initializeCommands(sock);
                }

                setTimeout(() => {
                    const activeSessions = sessionManager.getActiveSessions();
                    for (const session of activeSessions) {
                        if (session.sock && session.number !== mainNumber) {
                            sessionManager.setupSessionMessageHandler(session.sock, session.number);
                        }
                    }
                }, 3000);

                setTimeout(() => {
                    messageProcessingEnabled = true;
                    console.log('✅ Processamento ativado!');
                    sessionManager.listActiveSessions();
                }, 8000);
            }

            if (connection === 'close') {
                messageProcessingEnabled = false;
                connectionStartTime = null;
                commandsInitialized = false;
                isConnecting = false;

                let loggedOut = false;
                try {
                    const payload = lastDisconnect?.error?.output?.payload;
                    if (payload && (payload.status === 'loggedOut' || payload.reason === 'loggedOut')) loggedOut = true;
                    if (lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut) loggedOut = true;
                } catch (e) {}

                console.log(`🔌 Desconectado.${loggedOut ? ' Sessão finalizada.' : ''}`);

                if (loggedOut) {
                    if (fs.existsSync('./auth')) {
                        fs.rmSync('./auth', { recursive: true, force: true });
                    }
                    // Reconexão direta após logout
                    setTimeout(() => {
                        connectBot().catch(() => {});
                    }, 5000);
                    return;
                }

                // Reconexão direta - SEM controle de tentativas
                if (reconnectTimer) {
                    clearTimeout(reconnectTimer);
                    reconnectTimer = null;
                }
                
                reconnectTimer = setTimeout(() => {
                    reconnectTimer = null;
                    connectBot().catch(() => {});
                }, 10000); // 10 segundos de espera
            }
        });

        if (!state.creds.registered) {
            console.log('📱 Primeira conexão - solicitando pareamento...');
            const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
            console.log('📱 Digite o número com DDI (ex: 258879468903):');
            
            const number = await new Promise((resolve) => {
                rl.question('', (answer) => {
                    rl.close();
                    resolve(answer.trim().replace(/\D/g, ''));
                });
            });
            
            if (number.length < 10) {
                console.log('❌ Número inválido.');
                process.exit(1);
            }
            
            console.log('⏳ Aguardando 3 segundos...');
            await delay(3000);
            
            try {
                const code = await sock.requestPairingCode(number);
                console.log(`✅ Código de pareamento: ${code}`);
                console.log(`📱 Use este código no WhatsApp do número ${number}`);
                console.log(`👑 Este número será o principal!`);
            } catch (err) {
                console.log('❌ Erro ao solicitar código:', err.message);
                process.exit(1);
            }
        }

    } catch (error) {
        console.log('💥 Erro crítico:', error?.message || error);
        isConnecting = false;
        
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        // Reconexão direta
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connectBot().catch(() => {});
        }, 10000);
    }
}

// =================== EXPORT ===================
module.exports = { 
    sessionManager,
    getMainSock: () => mainSock,
    getMainNumber: () => mainNumber,
    getSock: () => mainSock,
    DONOS,
    DONOS_IDS,
    DONOS_LIDS,
    TODOS_DONOS,
    isDonoBot,
    getDonoInfo,
    isComandoLiberado,
    COMANDOS_LIBERADOS,
    verificarAluguelAtivo,
    lerAlugueis,
    salvarAlugueis,
    initializeCommands,
    loadCommand,
    unloadCommand,
    toSpecialStyle,
    connectBot,
    getPrefixos,
    getPrefixoPrincipal,
    adicionarPrefixo,
    removerPrefixo,
    setPrefixoPrincipal,
    extrairComando,
    isComando,
    carregarPrefixos,
    lerConexoesNomes,
    salvarConexoesNomes,
    salvarNomeConexao,
    getNomeConexao,
    CONEXOES_FILE
};

// =================== TRATAMENTO DE ERROS ===================
process.on('uncaughtException', (error) => {
    if (error?.message?.includes('Bad MAC') || 
        error?.message?.includes('decrypt') ||
        error?.message?.includes('session')) {
        return;
    }
});

process.on('unhandledRejection', (reason) => {
    if (reason?.message?.includes('Bad MAC') || 
        reason?.message?.includes('decrypt') ||
        reason?.message?.includes('session')) {
        return;
    }
});

process.on('SIGINT', async () => {
    console.log('🛑 Encerrando...');
    try {
        if (mainSock?.end) await mainSock.end();
        const sessions = sessionManager.getActiveSessions();
        for (const session of sessions) {
            if (session.sock && session.sock !== mainSock) {
                await session.sock.end();
            }
        }
    } catch (e) {}
    process.exit(0);
});

require('events').EventEmitter.defaultMaxListeners = 50;

// =================== INICIAR ===================
console.log('🤖 Bot WhatsApp Multi-Sessão');
console.log('✅ Multi-Sessão ativada!');
console.log(`📋 ${sessionManager.getConfiguredSessions().length} números configurados`);
console.log(`👑 Donos do bot: ${DONOS.length} configurados`);
console.log(`🔓 COMANDOS LIBERADOS (funcionam sem aluguel):`);
console.log(`   ${COMANDOS_LIBERADOS.join(', ')}`);

const prefixosInfo = carregarPrefixos();
console.log(`🔧 PREFIXOS CARREGADOS:`);
console.log(`   Principal: "${prefixosInfo.principal}"`);
console.log(`   Secundários: ${prefixosInfo.prefixos.filter(p => p !== prefixosInfo.principal).map(p => `"${p}"`).join(', ') || 'Nenhum'}`);
console.log(`   Última atualização: ${new Date(prefixosInfo.ultimaAtualizacao).toLocaleString('pt-BR')}`);

console.log('🔒 Grupos SEM aluguel: DEMONSTRAÇÃO bloqueados');
console.log('📨 Processamento de mensagens para TODAS as sessões!');
console.log('🔐 REGRA: Apenas o NÚMERO PRINCIPAL pode conectar novas sessões!');
console.log('👑 DONOS podem usar comandos no PV!');
console.log('');

connectBot().catch(err => {
    console.log('💥 Falha na conexão inicial:', err?.message || err);
    // Reconexão direta sem controle
    setTimeout(() => {
        connectBot().catch(() => {});
    }, 10000);
});
