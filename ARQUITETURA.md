# Arquitetura

```mermaid
flowchart LR
    subgraph Browser["Navegador do Delegado"]
        UI["Hub (React + Router)\n/ · /scorecomps · /cubestaff"]
        AUTH["OAuth implícito WCA\n(token no #fragmento)"]
        PLAN["model/\nWCIF → rodadas, grupos,\nregras, ordem, arquivos"]
        W["Web Worker\nreact-pdf + fontkit"]
        DL["Download\nPDF ou .zip (fflate)"]
    end
    WCA["WCA API\n/me · managed_by_me · /wcif"]
    CF["Cloudflare\n(só arquivos estáticos)"]
    CS["CubeStaff (em breve)\ngrava grupos/staff no WCIF"]

    CF --> UI
    UI --> AUTH --> WCA
    WCA -- WCIF --> PLAN
    CS -. PATCH WCIF .-> WCA
    PLAN -- RenderRequest --> W
    W -- bytes --> DL
```

- **Contrato entre as ferramentas = WCIF da WCA.** O CubeStaff (assim como
  Groupifier e Delegate Dashboard) grava atividades `evento-rN-gK` e
  assignments; o ScoreComps só lê.
- **Mesmo código no navegador e no Node:** `pdf/core.tsx` recebe como ler as
  fontes e como transformar o documento em bytes; `scripts/render-samples.tsx`
  e `scripts/stress.tsx` geram PDFs idênticos aos do site.
- **Fontes sob demanda:** `pdf/fonts.ts` lê o manifesto de subconjuntos
  (`fontManifest.json`) e registra só o que os textos do PDF exigem.
