# Ferramentas CubingSP — ScoreComps · Calcumulative · CubeStaff

Hub de ferramentas para Delegados, Organizadores e competidores de
competições da WCA, no visual da CubingSP (é para onde o menu "Ferramentas"
do site da CubingSP aponta). Desenvolvido por **Matheus Casassa**.

Produção: **https://cubingspferramentas.mcasassa.workers.dev/**

| Ferramenta | O que faz | Login | Status |
|---|---|---|---|
| **ScoreComps** (`/scorecomps`) | Súmulas oficiais em PDF a partir dos grupos do WCIF | WCA | ✅ disponível |
| **Calcumulative** (`/calcumulative`) | Limite de tempo cumulativo e média de 5 com BPA/WPA e meta | — | ✅ disponível |
| **CubeStaff** (`/cubestaff`) | Grupos + staff (Juiz, Embaralhador, Runner) gravados na WCA | WCA | 🔜 em breve |

Tudo roda no navegador: o login é OAuth da WCA (implicit grant, sem secret) e
os PDFs são gerados localmente num Web Worker. Nenhum servidor nosso recebe
token ou dados.

---

## Rodar em localhost

Pré-requisito: Node.js 20 ou mais novo.

```bash
npm install
npm run dev            # http://localhost:5173
```

- **Sem login:** abra `http://localhost:5173/scorecomps/demo` — competição
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
- Rodadas seguintes sem atribuições: súmulas em branco (quantidade sugerida
  pela condição de classificação da rodada anterior).

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
| Extras | Linhas de corte tracejadas, logo da competição (ao lado do nome) |

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
├── main.tsx, App.tsx              # rotas: / · /scorecomps · /scorecomps/:id · /cubestaff
├── styles/index.css               # tokens da CubingSP (claro/escuro)
├── components/layout/             # Navbar (sticky, blur) e Footer (créditos)
├── components/ui/, auth/          # ícones, feedback, botão de login WCA
├── pages/                         # Home do hub, CubeStaff (em breve), 404
├── lib/
│   ├── config.ts, theme.ts
│   ├── auth/                      # OAuth implícito da WCA
│   └── wca/                       # API, tipos e leitura do WCIF
└── tools/
    ├── scorecomps/
    │   ├── model/                 # regras, plano de rodadas, ordem, saída, demo
    │   ├── pdf/                   # react-pdf: documento, fontes, papel, Worker
    │   └── ui/                    # páginas da ferramenta
    └── cubestaff/grouping.ts      # motor de grupos (base para o CubeStaff)
public/fonts/                      # Arimo + Noto SC/KR (gerados por scripts/build-fonts.py)
scripts/                           # samples, stress, build-fonts
```

As fontes em `public/fonts` já vêm prontas. Só rode `npm run fonts`
(requer `pip install fonttools brotli`) se quiser atualizá-las.
