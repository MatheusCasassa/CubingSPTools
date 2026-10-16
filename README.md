# Ferramentas WCA — ScoreComps · CubeStaff

Hub de ferramentas para Delegados e Organizadores de competições da WCA, no
visual da CubingSP. Desenvolvido por **Matheus Casassa**.

| Ferramenta | O que faz | Status |
|---|---|---|
| **ScoreComps** (`/scorecomps`) | Súmulas oficiais em PDF a partir dos grupos do WCIF | ✅ disponível |
| **CubeStaff** (`/cubestaff`) | Grupos + staff (Juiz, Embaralhador, Runner) gravados na WCA | 🔜 em breve |

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

Na WCA, a Redirect URI de produção é a **raiz** do site com barra final
(ex.: `https://scorecomps.mcasassa.workers.dev/`). O app volta sozinho para a
página onde o login começou.

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
