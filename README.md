# KAISEN Vendas

Bot multi-sessao para WhatsApp com inteligencia artificial integrada, voltado para automacao de atendimento comercial no privado (PV), download de midias e gerenciamento de grupos com sistema de aluguel e licenca.

Construido em Node.js com a biblioteca `@whiskeysockets/baileys`.

---

## Funcionalidades Principais

### 1. Inteligencia Artificial de Atendimento e Vendas (KAISEN)
- **Multi-Provider de IA:** Suporte para Google Gemini (`gemini-flash-lite-latest`), Groq (`llama-3.3-70b-versatile`), OpenRouter e SambaNova.
- **Sintetizacao de Voz Realista (TTS):** Respostas em audio geradas com Edge TTS / gTTS e convertidas via FFmpeg com opcoes de vozes de Portugal e Brasil.
- **Transcricao de Audio:** Compreensao de mensagens de voz enviadas por clientes atraves da API Whisper da Groq.
- **Catalogo de Produtos:** Cadastro, listagem e remocao de produtos com precos, descricoes e fotos diretamente pelo WhatsApp.
- **Botoes Interativos:** Menus e acoes baseados no protocolo `nativeFlowMessage` (quick reply e cta_url).

### 2. Downloads e Utilitarios de Midia
- **YouTube:** Busca e download de videos em MP4, conversao para audio em MP3 ou envio como documento.
- **TikTok:** Download de videos sem marca d'agua e extracao de trilha sonora.
- **Pinterest:** Pesquisa e envio de imagens em alta definicao.
- **Shazam:** Identificacao automatica de musicas ao citar/marcar um audio ou video.

### 3. Gerenciamento e Administracao de Grupos
- **Sistema de Aluguel/Licenca:** Controle de dias de expiracao por grupo (`alugueis.json`), bloqueando comandos nao autorizados em grupos sem plano ativo.
- **Scanner de Participantes:** Extracao e listagem de membros do grupo com resolucao de LIDs para numeros reais (`wa.me`).
- **Adicao de Membros:** Adicao gradual de contatos com intervalos de seguranca configurados para preservacao do chip.

---

## Comandos Disponiveis

O prefixo padrao configurado e `.` (ponto).

### Atendimento e IA (KAISEN)
| Comando | Descricao |
| :--- | :--- |
| `.kaisen` ou `.ia` | Abre o menu interativo com opcoes de configuracao de voz, audio e catalogo |
| `.ia-add <nome> \| <preco> \| <desc> \| <link_foto>` | Cadastra um novo produto no catalogo |
| `.ia-list` | Lista todos os produtos cadastrados |
| `.ia-del <id_produto>` | Remove um produto do catalogo |
| `.ia-clear` | Remove todos os produtos cadastrados |
| `.kaisen voz <id_voz>` | Seleciona a voz do assistente (`auto`, `duarte`, `raquel`, `antonio`, `francisca`) |

*Nota: No privado (PV), o bot responde automaticamente a qualquer pergunta de clientes.*

### Downloads de Midia
| Comando | Descricao |
| :--- | :--- |
| `.youtube <link ou busca>` | Download de video ou musica do YouTube |
| `.tiktok <link>` ou `.tt <link>` | Download de video do TikTok sem marca d'agua |
| `.pinterest <termo>` ou `.pin <termo>` | Busca e envio de imagens do Pinterest |
| `.shazam` | Identifica a musica citada no audio/video |

### Administracao e Grupos
| Comando | Descricao |
| :--- | :--- |
| `.alugard <dias>` | Ativa ou prorroga o aluguel para o grupo atual (requer permissao de dono) |
| `.alugard <id_grupo> <dias>` | Ativa o aluguel para um grupo especifico remotamente |
| `.alugard status` | Consulta o tempo restante de licenca do grupo atual |
| `.alugard del` | Remove a licenca do grupo atual |
| `.scanner` | Varre os participantes do grupo e gera lista com links clicaveis |
| `.adicionar <id_grupo_origem>` | Adiciona membros de outro grupo ao grupo atual com intervalo de seguranca |

---

## Estrutura do Projeto

```text
kaisen-vendas/
├── auth/                       # Arquivos de autenticacao e sessao Baileys (ignorado no git)
├── comandos/
│   ├── database/               # JSONs de configuracao de auto-download
│   ├── membros/                # Comandos de IA, midias e aluguel
│   │   ├── alugard.js
│   │   ├── kaisen.js
│   │   ├── pinterest.js
│   │   ├── shazam.js
│   │   ├── tiktok.js
│   │   ├── tt.js
│   │   └── youtube.js
│   └── scan/                   # Ferramentas de extracao e adicao de membros
│       ├── adicionar.js
│       └── scanner.js
├── database/                   # Armazenamento de alugueis e prefixos
│   ├── alugueis.json
│   └── prefixos/prefixo.json
├── config.json                 # Sessao principal e controle multi-sessao
├── index.js                    # Nucleo da aplicacao e roteamento de eventos Baileys
├── package.json                # Dependencias e scripts
├── .env.example                # Modelo de variaveis de ambiente
└── .gitignore                  # Regras de exclusao de credenciais e temporarios
```

---

## Instalacao e Execucao Local

### Pre-requisitos
- Node.js versao 18 ou superior
- FFmpeg instalado no sistema operacional

### 1. Clonar o Repositorio
```bash
git clone https://github.com/Gumballxnz/kaisen-vendas.git
cd kaisen-vendas
```

### 2. Instalar Dependencias
```bash
npm install
```

### 3. Variaveis de Ambiente
Copie o arquivo de exemplo e preencha as chaves de API desejadas:
```bash
cp .env.example .env
```
Edite o arquivo `.env`:
```ini
GEMINI_API_KEY=sua_chave_gemini
GROQ_API_KEY=sua_chave_groq
OPENROUTER_API_KEY=sua_chave_openrouter
SAMBANOVA_API_KEY=sua_chave_sambanova
```

### 4. Iniciar o Bot
```bash
npm start
```

Ao iniciar pela primeira vez sem sessao ativa:
1. Digite o numero com DDI (exemplo: `258879116693` ou `5511999999999`) no console.
2. O bot gerara um codigo de pareamento de 8 digitos.
3. No WhatsApp do celular, acesse: **Aparelhos Conectados > Conectar um aparelho > Conectar com numero de telefone** e digite o codigo exibido.

---

## Deploy em Servidor (VPS com PM2)

Para manter o bot em execucao continua em servidores Linux:

```bash
# Instalar PM2 globalmente
npm install -g pm2

# Iniciar a aplicacao
pm2 start index.js --name "kaisen-vendas"

# Salvar lista de processos para inicializacao automatica com o sistema
pm2 save
pm2 startup
```

### Comandos de Gerenciamento
- Visualizar status: `pm2 status`
- Monitorar logs em tempo real: `pm2 logs kaisen-vendas`
- Reiniciar o processo: `pm2 restart kaisen-vendas`
- Parar o processo: `pm2 stop kaisen-vendas`

---

## Seguranca e Boas Praticas
- Nunca envie a pasta `auth/`, chaves privadas (`*.key`) ou o arquivo `.env` para repositorios publicos.
- O arquivo `.gitignore` deste projeto ja vem pre-configurado para ignorar sessoes ativas, credenciais e caches temporarios.
