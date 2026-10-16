# Extensão WCIF `CubingSP.CubeStaff`

O CubeStaff grava o plano de grupos e staff numa extensão do WCIF, no nível
da competição. Assim o plano fica **vinculado à competição**: qualquer
Delegado/Organizador abre em qualquer aparelho e continua de onde parou.

> Extensões do WCIF são **públicas** (aparecem em `/wcif/public`). Por isso a
> extensão nunca contém e-mail, telefone ou respostas de formulário — esses
> dados ficam só no navegador de quem importou a lista.

A WCA guarda cada extensão numa coluna `TEXT` (máx. 65.535 bytes). O
CubeStaff recusa gravar acima de 60.000 bytes. Uma competição de 420
competidores com 250 pessoas de staff ocupa ~22 KB como rascunho e ~11 KB
depois de publicada.

```json
{
  "id": "CubingSP.CubeStaff",
  "specUrl": "https://github.com/MatheusCasassa/CubingSPTools/blob/main/docs/cubestaff-extension.md",
  "data": { "v": 2, "...": "..." }
}
```

## `data` (versão 2)

| Campo | Tipo | Conteúdo |
|---|---|---|
| `v` | `2` | Versão do formato |
| `cfg` | objeto | Configuração (estações, distribuição, % de novatos, runners, nº de grupos por rodada…) |
| `ab` | texto | Ausentes: `registrantId` em base 36, separados por vírgula |
| `st` | lista | Candidatos aprovados, um texto por pessoa: `"id36\|funções\|preferida\|querEmbaralhar\|puzzles\|disponibilidade"` (separado por barra vertical) |
| `ex` | lista | Ajudantes extras `{ id, name, note? }` (pais, visitantes — não existem no WCIF) |
| `rd` | objeto | Rodadas planejadas, por `roundId` |
| `rev` | número | Revisão (incrementa a cada gravação; detecta edição simultânea) |
| `at`, `by` | texto | Data/hora e nome de quem gravou |

- **Funções**: letras `j` (juiz), `s` (embaralhador), `r` (runner). Vazio = qualquer.
- **querEmbaralhar**: `1`, `0` ou vazio (não informado).
- **Disponibilidade**: 2 dígitos por dia da competição (manhã, tarde): `"1011"` = dia 1 só de manhã, dia 2 o dia todo. Vazio = sempre disponível.

> **Nunca use `null` nos dados**: a WCA remove valores `null` de listas ao
> salvar a extensão. A primeira versão gravava `st` como lista com `null` e as
> posições se deslocavam (todos ficavam "não quer embaralhar"). O leitor ainda
> aceita esse formato antigo, interpretando as posições pelo tipo.

### Rodadas (`rd[roundId]`)

```json
{ "w": 1, "h": "1x9k2p", "t": "2026-10-16T12:00:00Z", "g": [{ "v": "1f,x2", "l": "j1f" }] }
```

| Campo | Conteúdo |
|---|---|
| `w` | `1` = a rodada está publicada e igual ao WCIF: quem compete e quem faz staff vem dos *assignments* |
| `h` | Impressão digital da rodada quando foi publicada (detecta edição feita fora do CubeStaff) |
| `t` | Última alteração |
| `g` | Grupos, em ordem. Listas em texto: pessoas do WCIF em base 36, ajudantes extras como `x<id>` |

Cada grupo: `c` competidores (omitido quando `w = 1`), `j` juízes, `s`
embaralhadores, `r` runners (com `w = 1`, só os ajudantes extras), `v`
suplentes e `l` travas (`c`/`j`/`s`/`r`/`v` + pessoa, ex.: `j1f` = juiz
travado).

## O que vai para o WCIF oficial

- Atividades de grupo `evento-rN-gK` como filhas das atividades de rodada
  (divididas por tempo; rodadas em vários palcos repartem os grupos entre
  eles, numeração global por horário). Ids de atividades existentes são
  reaproveitados.
- Assignments `competitor`, `staff-judge`, `staff-scrambler` e
  `staff-runner` (com `stationNumber` se "Numerar estações" estiver ligado).
- FMC e Multi-Blind: `competitor` em cada tentativa (`-a1`, `-a2`…), sem grupos.

Suplentes e ajudantes extras **não** viram assignments (não há código para
suplente no WCIF e ajudantes extras não estão inscritos): ficam só na
extensão, no CubeStaff e nas planilhas exportadas.
