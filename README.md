# Ferramentas CubingSP — ScoreComps · Calcumulative · CubeStaff

Hub de ferramentas para Delegados, Organizadores e competidores de
competições da WCA, no visual da CubingSP (é para onde o menu "Ferramentas"
do site da CubingSP aponta). Desenvolvido por **Matheus Casassa**.

Produção: **https://cubingspferramentas.mcasassa.workers.dev/**

| Ferramenta | O que faz | Login | Status |
|---|---|---|---|
| **ScoreComps** (`/scorecomps`) | Súmulas oficiais em PDF a partir dos grupos do WCIF | WCA | ✅ disponível |
| **Calcumulative** (`/calcumulative`) | Limite de tempo cumulativo e média de 5 com BPA/WPA e meta | — | ✅ disponível |
| **CubeStaff** (`/cubestaff`) | Grupos + staff (Juiz, Embaralhador, Runner) gravados na WCA | WCA | ✅ disponível |

Tudo roda no navegador: o login é OAuth da WCA (implicit grant, sem secret) e
os PDFs são gerados localmente num Web Worker. Nenhum servidor nosso recebe
token ou dados — o CubeStaff grava direto no WCIF da competição na WCA.

---

## Rodar em localhost

Pré-requisito: Node.js 20 ou mais novo.

```bash
npm install
npm run dev            # http://localhost:5173
```

- **Sem login:** abra `http://localhost:5173/cubestaff/demo` (CubeStaff, dois
  palcos, rodadas seguintes, FMC, novatos e lista de staff) ou
  `http://localhost:5173/scorecomps/demo` — competição
  fictícia com todos os casos (Ao5 com/sem corte, Mo3, 3BLD cumulativo, FMC,
  finais em branco, nomes CJK/cirílico/longos). Dá para testar tudo, inclusive
  logo e todos os formatos de download.
- **Com login WCA:** no app da WCA
  (<https://www.worldcubeassociation.org/oauth/applications>), adicione
  `http://localhost:5173/` às **Redirect URIs** (uma por linha, mantendo a de
  produção).

Para testar o build final, igual ao que vai para a Cloudflare:

```bash
npm run build
npm run preview        # http://localhost:5173
```

### Conferir os PDFs sem abrir o navegador

```bash
npm run samples        # samples/amostra-*.pdf (A4, A4 corte e empilhe, Carta, A5, A6, A7)
npm run stress         # samples/stress-*.pdf  (pior caso em todos os tamanhos)
```

Os scripts usam **o mesmo código** do navegador (planejamento, ordem, fontes e
documento react-pdf) — o PDF conferido é o mesmo que o usuário baixa.

---

## Deploy (Cloudflare)

O projeto já tem `wrangler.jsonc` (Workers com Static Assets, SPA).

- **Build command:** `npm run build`
- **Deploy command:** `npx wrangler deploy`
- **Variáveis:** nenhuma é obrigatória. Não defina `VITE_WCA_CLIENT_ID` com o
  ID da conta Cloudflare.
- **Não** crie regra `/* /index.html 200` em `public/_redirects` (erro 100324).

Na WCA, a Redirect URI de produção é a **raiz** do site com barra final:
`https://cubingspferramentas.mcasassa.workers.dev/`. O app volta sozinho para a
página onde o login começou. O `name` do `wrangler.jsonc`
(`cubingspferramentas`) precisa ser igual ao nome do Worker na Cloudflare.

---

## ScoreComps — como funciona

1. Login WCA → lista `competitions?managed_by_me=true` (só Delegados/Organizadores).
2. Lê o WCIF da competição. Os grupos vêm das atividades `evento-rN-gK` e dos
   assignments `competitor` — o contrato gravado pelo CubeStaff, Groupifier
   ou Delegate Dashboard. O ScoreComps **só lê**, nunca altera o WCIF.
3. Escolha rodadas/grupos (+ súmulas em branco), folha, ordem e arquivos.
4. O Worker gera o(s) PDF(s); vários arquivos saem num `.zip`.

### Regras da súmula (Modelo_Aprovado)

- Nº de solves pelo **formato** da rodada (a=5, m/3=3, 2=2, 1=1) — nunca pelo
  evento (3BLD virou Bo5/Ao5 em 2026 e o WCIF já reflete isso).
- Blocos só se houver **tempo de corte**: `Tempo de corte se > X`.
- `DNF se > X` (limite simples) ou `Tempo cumulativo de X` (+ `(múltiplas rodadas)`).
- `Exemplo de Penalidade: 14.67 + 2 = 16.67` (não aparece em FMC/Multi).
- FMC: `Menor nº de movimentos`.
- Extras E1/E2 com coluna **D** (Delegado).
- Rodadas seguintes sem grupos: os **classificados com nome** vêm dos
  resultados que o WCA Live sincroniza com a WCA — a lista da própria rodada
  (quando o WCA Live já abriu a rodada) ou o cálculo pelos resultados da
  rodada anterior + condição de classificação (máx. 75%, empates juntos). O
  botão "Atualizar da WCA" busca de novo depois de sincronizar. Sem
  resultados ainda: súmulas em branco (quantidade sugerida pela condição).

### Layout e fidelidade

- Desenhado em **vetor** com `@react-pdf/renderer` (nada de rasterizar HTML).
- Fonte **Arimo** (mesmo desenho e métricas do Arial/Liberation Sans) — é a
  fonte em que o Modelo_Aprovado foi renderizado. Linhas de 1 px de projeto.
- A linha de base de cada texto é corrigida para a posição que o navegador
  usava (meia-entrelinha CSS) — inclusive com caracteres CJK.
- Conferido pixel a pixel contra as imagens do `Modelo_Aprovado.pdf`:
  diferença máxima ≈ 1 px a 216 dpi (~0,1 mm).
- Nome do competidor medido com as próprias fontes do PDF: ocupa a largura do
  cartão (11,5–22 px) e quebra em 2 linhas só em nomes enormes.
- CJK/Coreano: Noto Sans SC/KR por glifo, baixando só os subconjuntos usados.

### Formatos de download

| Opção | Valores |
|---|---|
| Folha | A4 (4/folha), Carta (4/folha), A5, A6, A7 (1/folha) |
| Ordem | Natural · Corte e empilhe (4/folha: corte o maço em 4 pilhas e empilhe) |
| Arquivos | Um PDF · Um PDF por rodada (.zip) · Um PDF por grupo (.zip) |
| Ordenar | Nome · ID |
| Extras | Linhas de corte tracejadas, logo da competição |
| Logo | Colorida ou preto e branco · ao lado do nome e/ou marca d'água (grande, atrás da súmula, transparência ajustável de 50% a 95% — padrão 75%) |
| Em branco | Painel "Súmulas em branco" (genéricas, como no Groupifier): não dependem de modalidade — só nome e logo da competição; modalidade, rodada, limite de tempo e tempo de corte para preencher à mão. Quantidade por nº de tentativas: 5 (Ao5/Bo5, corte após a 2ª), 3 (Mo3/Bo3, corte após a 1ª), 2 ou 1 — sempre + 2 extras. Cada rodada também tem o campo "Em branco" (com a modalidade impressa) |

A logo **preto e branco** é gravada como PNG em tons de cinza de verdade
(cinza + alfa), então o PDF a embute como *DeviceGray*: a impressora usa só a
tinta preta. Amostras com marca d'água:
`npm run samples -- --logo logo.png --aspect 1.5 --watermark [--no-header-logo] [--transparency 90]`.

---

## Idiomas (PT · EN · ES)

Como no site da CubingSP: português sem prefixo (`/calcumulative`), inglês em
`/en/…` e espanhol em `/es/…`, com seletor de idioma (bandeiras em SVG) no
cabeçalho. Textos em `src/i18n/messages/{pt,en,es}.ts` — o TypeScript acusa
qualquer chave faltando em EN/ES. A **súmula** tem idioma próprio (opção
"Idioma da súmula", padrão = idioma do site), com os textos em
`src/tools/scorecomps/model/strings.ts`; o português é o do Modelo_Aprovado.
O login da WCA continua usando só a raiz como Redirect URI e volta para a
página/idioma de onde saiu.

Amostras por idioma: `npm run samples -- --lang en` (ou `es`).

## CubeStaff — como funciona

1. Login WCA → competições `managed_by_me` → abre a competição (`/cubestaff/:id`).
2. **Staff:** importe o CSV do Google Forms (ou monte à mão) com os
   candidatos **aprovados** — só eles são escalados automaticamente. Quem se
   oferece no dia entra como **ajudante extra** (escalado à mão).
3. **Configuração:** nº de estações (por palco, se houver mais de um), nº de
   grupos por rodada (com a conta "≈ N por grupo"), distribuição de novatos,
   runners e limites de carga.
4. **Gerar grupos** → revisar na aba Grupos (mover, trocar por suplente,
   travar, adicionar) → **Salvar rascunho** (só a extensão) ou **Publicar na
   WCA** (atividades + assignments). Os grupos aparecem no Competition Groups,
   no Delegate Dashboard e no ScoreComps.
5. No dia: depois de sincronizar o WCA Live, **Atualizar rodadas seguintes**
   gera só as rodadas cujos classificados já são conhecidos.

### Regras de geração

- Base: **só inscrições aprovadas na WCA** (pendentes, lista de espera,
  canceladas e recusadas ficam de fora de grupos, staff, suplentes, escolhas
  manuais e importação do CSV) e presentes (marque ausentes na aba Pessoas).
- **Uma função por vez**: quem compete num grupo só compete; ninguém faz
  duas coisas ao mesmo tempo, inclusive em palcos simultâneos.
- **Novatos** (sem WCA ID) nunca são juízes nem embaralhadores.
- **Delegados** evitados como juiz/embaralhador (embaralhador só se bem
  ranqueado); com staff "expressivo" (staff livre ≥ 1,5 × vagas, ajustável)
  ficam totalmente de fora.
- **Embaralhadores**: 1 a cada 8 competidores (1–8 → 1, 9–16 → 2…), os mais
  bem classificados no ranking de embaralhador, revezando quem já embaralhou
  muito. O ranking compara percentis entre os aprovados da competição:
  - o próprio evento;
  - nas variantes, também a modalidade principal (3BLD/OH/Multi/FMC → 3x3,
    4BLD → 4x4, 5BLD → 5x5);
  - o Sum of Ranks — em pé de igualdade em evento novo (menos de 50% dos
    inscritos com resultado, ex.: FTO) e só para completar nos demais.
  Quem marcou no formulário que não quer embaralhar nunca é escalado.
- **Juízes**: até o nº de estações, preferindo quem competiu no grupo anterior.
- **Runners** só se habilitado. **Suplentes** por grupo (livres no horário).
- **Disponibilidade** Manhã/Tarde do formulário respeitada.
- **Competidores**: novatos nos grupos iniciais (100% ou 50% novatos) ou
  mesclados; experientes por ranking, mais rápidos nos últimos grupos.
- Edições manuais ficam **travadas** e sobrevivem a "Gerar de novo".

### Onde fica salvo

- **Na WCA**, numa extensão do WCIF (`CubingSP.CubeStaff`, formato em
  [`docs/cubestaff-extension.md`](docs/cubestaff-extension.md)): vale para
  qualquer aparelho e qualquer Delegado/Organizador. A extensão é pública, por
  isso não leva e-mail, WhatsApp nem respostas de formulário.
- **Neste navegador**: rascunho automático (para não perder nada antes de
  salvar) e os dados privados do formulário.
- Edição simultânea é detectada pela revisão do plano; edições feitas fora
  (Delegate Dashboard) depois de publicar são detectadas por rodada.

Manual com todos os critérios (PT/EN/ES): `/cubestaff/manual` no site.

Testes das regras: `npx tsx scripts/test-cubestaff.ts` (também no `npm test`).

## Calcumulative — regras

- **Limite cumulativo** (Regulamento A1a2/A1a4/A1a5): limite de cada tentativa
  = menor entre o limite por tentativa e o que sobra do cumulativo; conta o
  resultado com penalidades (ou o tempo decorrido, se DNF); resultado que
  chega ao limite vira DNF; esgotado o cumulativo, o resto é DNS.
- **Média de 5** (9f8, 9f1/9f2): descarta melhor e pior; 2 DNFs → DNF;
  BPA/WPA com 4 tempos; "meta sub-X" diz o máximo no último solve.
- Testes com os exemplos do próprio regulamento: `npm test`.

## Estrutura

```
src/
├── main.tsx, App.tsx              # rotas: / · /scorecomps(/:id) · /calcumulative · /cubestaff(/:id)
├── styles/index.css               # tokens da CubingSP (claro/escuro)
├── components/layout/             # Navbar (sticky, blur) e Footer (créditos)
├── components/ui/, auth/          # ícones, feedback, botão de login WCA
├── pages/                         # Home do hub, 404
├── lib/
│   ├── config.ts, theme.ts
│   ├── auth/                      # OAuth implícito da WCA
│   └── wca/                       # API, tipos e leitura do WCIF
└── tools/
    ├── scorecomps/
    │   ├── model/                 # regras, plano de rodadas, ordem, saída, demo
    │   ├── pdf/                   # react-pdf: documento, fontes, papel, Worker
    │   └── ui/                    # páginas da ferramenta
    └── cubestaff/
        ├── model/                 # motor, regras, cronograma, WCIF ⇄ plano, extensão, CSV
        └── ui/                    # páginas da ferramenta
docs/cubestaff-extension.md        # formato da extensão WCIF do CubeStaff
public/fonts/                      # Arimo + Noto SC/KR (gerados por scripts/build-fonts.py)
scripts/                           # samples, stress, build-fonts
```

As fontes em `public/fonts` já vêm prontas. Só rode `npm run fonts`
(requer `pip install fonttools brotli`) se quiser atualizá-las.
