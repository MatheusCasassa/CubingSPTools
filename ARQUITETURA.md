# Arquitetura

```mermaid
flowchart LR
    subgraph Browser["Navegador do Delegado"]
        UI["Hub (React + Router)\n/ · /scorecomps · /calcumulative · /cubestaff"]
        AUTH["OAuth implícito WCA\n(token no #fragmento)"]
        PLAN["model/\nWCIF → rodadas, grupos,\nregras, ordem, arquivos"]
        W["Web Worker\nreact-pdf + fontkit"]
        DL["Download\nPDF ou .zip (fflate)"]
    end
    WCA["WCA API\n/me · managed_by_me · /wcif"]
    CF["Cloudflare\n(só arquivos estáticos)"]
    CS["CubeStaff\nplano → grupos/staff no WCIF\n+ extensão CubingSP.CubeStaff"]
    CG["Competition Groups\nDelegate Dashboard"]

    CF --> UI
    UI --> AUTH --> WCA
    WCA -- WCIF --> PLAN
    UI --> CS
    CS -- PATCH WCIF --> WCA
    WCA -- WCIF --> CG
    PLAN -- RenderRequest --> W
    W -- bytes --> DL
```

- **Contrato entre as ferramentas = WCIF da WCA.** O CubeStaff (assim como
  Groupifier e Delegate Dashboard) grava atividades `evento-rN-gK` e
  assignments; o ScoreComps só lê. Antes de publicar, o botão "Súmulas no
  ScoreComps" passa os grupos pelo navegador (`?fonte=cubestaff`).
- **O plano do CubeStaff é a fonte da verdade** e vive numa extensão do WCIF
  (compacta, < 64 KB): vinculado à competição, abre em qualquer aparelho.
  Ver `docs/cubestaff-extension.md`.
- **Mesmo código no navegador e no Node:** `pdf/core.tsx` recebe como ler as
  fontes e como transformar o documento em bytes; `scripts/render-samples.tsx`
  e `scripts/stress.tsx` geram PDFs idênticos aos do site.
- **Fontes sob demanda:** `pdf/fonts.ts` lê o manifesto de subconjuntos
  (`fontManifest.json`) e registra só o que os textos do PDF exigem.
