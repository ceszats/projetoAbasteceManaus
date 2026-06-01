# Abastece Manaus

App para comparar preços de combustível em postos de Manaus (AM), com mapa, lista, favoritos e preços da SEFAZ.

## Pré-requisitos

1. **Node.js 22 (LTS)** — [nodejs.org](https://nodejs.org) ou `nvm install 22`
2. **pnpm** — `corepack enable`

## Instalação

```bash
cp .env.example .env
# Celular físico: edite EXPO_PUBLIC_API_BASE_URL com o IPv4 do PC (ipconfig) e a porta do servidor
pnpm install
pnpm run setup:local
```

`setup:local` popula postos (OpenStreetMap) e sincroniza preços SEFAZ no `local.db`.

## Rodar no dia a dia

```bash
pnpm run dev
```

Sobe API Express (`:3000` ou próxima porta livre) + Expo Metro.

### Testar no celular

1. Instale **Expo Go**
2. PC e celular na mesma rede Wi-Fi
3. Escaneie o QR Code do terminal
4. Confirme `EXPO_PUBLIC_API_BASE_URL` no `.env` (ex.: `http://192.168.0.10:3000`)

### Emulador Android

`EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000`

## Estrutura do projeto

| Pasta | Conteúdo |
|-------|----------|
| `app/` | Telas Expo Router (mapa, lista, perfil, login) |
| `server/` | API Express, tRPC, sync SEFAZ |
| `data/` | Domínio, filtros, mock de postos |
| `components/` | UI (mapa, combustível, onboarding) |
| `context/` | Estado global (postos, auth, filtros do mapa) |
| `drizzle/` | Schema SQLite |

## Scripts úteis

| Comando | Descrição |
|---------|-----------|
| `pnpm run dev` | API + Expo |
| `pnpm run setup:local` | Seed OSM + sync SEFAZ |
| `pnpm run db:sync:sefaz` | Atualizar preços SEFAZ |
| `pnpm run check` | TypeScript |
| `pnpm test` | Testes Vitest |

## Login

- **Demonstração** — entra sem servidor OAuth
- **Google/Facebook** — requer variáveis OAuth no `.env` e callback configurado
