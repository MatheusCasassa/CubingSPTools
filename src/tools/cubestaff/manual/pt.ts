import { DEFAULT_CONFIG as C } from '../model/types'
import { RARE_SHARE } from '../model/scramblerRank'
import type { Manual } from './types'

const rare = Math.round(RARE_SHARE * 100)

export const pt: Manual = {
  title: 'Manual do CubeStaff',
  subtitle: 'Como os grupos e o staff são montados',
  intro:
    'Este manual explica **cada critério** que o CubeStaff usa para montar os grupos e escolher juízes, embaralhadores, runners e suplentes. Tudo o que o programa decide pode ser ajustado à mão depois — e o que você ajusta fica travado.',
  toc: 'Nesta página',
  feedbackTitle: 'Sugestões e feedback',
  feedbackText:
    'Achou um critério estranho, um caso que o programa não trata ou uma regra que deveria ser diferente? Mande sua sugestão — este manual e as regras evoluem com o uso nas competições.',
  feedbackEmail: 'Enviar e-mail',
  feedbackGithub: 'Abrir uma sugestão no GitHub',
  back: 'Voltar ao CubeStaff',
  sections: [
    {
      id: 'fluxo',
      title: '1. Passo a passo',
      blocks: [
        {
          list: [
            '**Staff**: importe o CSV do formulário de staff (ou monte a lista à mão) com os candidatos **aprovados**.',
            '**Configuração**: informe o nº de estações e o nº de grupos de cada rodada. Ao lado aparece a conta "≈ N por grupo".',
            '**Gerar grupos**: o programa distribui os competidores e escala o staff seguindo as regras abaixo.',
            '**Revisar**: na aba Grupos, mova pessoas, troque por suplentes, adicione ou remova. A Conferência aponta problemas.',
            '**Salvar rascunho** (só o plano, sem publicar) ou **Publicar na WCA** (grupos aparecem no Competition Groups e no ScoreComps).',
            'No dia: depois de sincronizar o WCA Live, **Atualizar rodadas seguintes** gera só as rodadas cujos classificados já são conhecidos.',
          ],
        },
      ],
    },
    {
      id: 'quem',
      title: '2. Quem entra',
      blocks: [
        'Só contam **inscrições aprovadas** na WCA. Inscrições pendentes, em lista de espera, canceladas ou recusadas ficam fora de tudo: grupos, staff, suplentes, escolhas manuais e importação do CSV.',
        'Quem estiver aprovado como **staff não competidor** pode ser escalado como staff, mas não compete.',
        'Marque **ausentes** na aba Pessoas antes de gerar: eles não entram nos grupos nem no staff.',
        '**Novato** = pessoa sem WCA ID (primeira competição).',
      ],
    },
    {
      id: 'competidores',
      title: '3. Grupos de competidores',
      blocks: [
        'O **nº de grupos** de cada rodada é definido por você. Os grupos ficam com tamanhos quase iguais (diferença de no máximo 1). O horário de cada grupo é uma fatia igual do horário da rodada no cronograma da WCA; rodadas em mais de um palco dividem os grupos entre os palcos.',
        '**Ranking usado**: o recorde pessoal de **média** no evento (nos eventos às cegas, o **single**). Quem não tem resultado no evento fica como o mais lento.',
        'Os experientes são ordenados **do mais lento ao mais rápido**: os primeiros grupos recebem os mais lentos e **os mais rápidos ficam nos últimos grupos** (bom para a transmissão e libera os melhores embaralhadores no começo). Dentro do grupo, a ordem (e a estação, se numerada) vai do mais rápido ao mais lento.',
        'Há duas formas de tratar os **novatos**:',
        {
          table: [
            ['Opção', 'Como fica'],
            [
              'Novatos nos grupos iniciais · 100%',
              'Os primeiros grupos são só de novatos (todos os Delegados podem acompanhar). Se sobrar vaga, ela é completada com os experientes mais lentos.',
            ],
            [
              'Novatos nos grupos iniciais · 50%',
              'Os primeiros grupos são meio novatos, meio experientes (mais lentos), para equilibrar os incidentes do grupo.',
            ],
            ['Mesclar em todos os grupos', 'Os novatos são espalhados igualmente por todos os grupos.'],
          ],
        },
        '**Conflito de horário**: se alguém compete em outra coisa no mesmo horário (ex.: outro palco), o programa troca essa pessoa com alguém de um grupo vizinho (nível parecido). Se não houver troca possível, aparece um aviso.',
        'FMC e Multi-BLD com tentativas no cronograma (-a1, -a2…) não têm grupos: todos são atribuídos às tentativas.',
      ],
    },
    {
      id: 'staff',
      title: '4. Regras gerais do staff',
      blocks: [
        {
          list: [
            'Só é escalado automaticamente quem está na **lista de candidatos aprovados** (aba Staff). Quem se oferecer no dia entra como **ajudante extra** e é escalado à mão.',
            '**Uma função por vez**: quem compete num grupo só compete; ninguém faz duas coisas ao mesmo tempo, inclusive em palcos diferentes.',
            '**Novatos nunca** são juízes nem embaralhadores.',
            'A **disponibilidade** do formulário (Manhã = antes do meio-dia, Tarde = depois, no horário da competição) é respeitada.',
            '**Dias das modalidades**: quem está inscrito só em modalidades de um dia não é escalado nem sugerido como suplente nos outros dias (ex.: na Cuber Brasil Sumaré 2026, quem só faz 3BLD — sábado — fica fora do domingo, dia do 3x3). Contam os dias de qualquer rodada das modalidades da pessoa. Staff não competidor conta como presente sempre. Dá para desligar na Configuração.',
            `**Tarefas seguidas**: no máximo ${C.maxConsecutive} grupos seguidos de staff antes de uma pausa (ajustável; 0 = sem limite).`,
            '**Máximo por pessoa** na competição: opcional (0 = sem limite).',
            'As **funções marcadas** no formulário limitam o que a pessoa faz; a **função preferida** dá prioridade a ela naquela função.',
            'O staff é escalado em **ordem cronológica**, e quem tem menos tarefas tem prioridade — assim a carga fica dividida.',
          ],
        },
      ],
    },
    {
      id: 'embaralhadores',
      title: '5. Embaralhadores',
      blocks: [
        `**Quantidade**: 1 embaralhador a cada ${C.competitorsPerScrambler} competidores do grupo (1–${C.competitorsPerScrambler} → 1, ${C.competitorsPerScrambler + 1}–${C.competitorsPerScrambler * 2} → 2, …). Ajustável no Avançado.`,
        '**Quem**: os mais bem classificados no ranking de embaralhador, que funciona assim:',
        {
          list: [
            '**Percentil**: para comparar eventos diferentes, cada ranking vira uma posição de 0% (melhor da competição) a 100% (pior), só entre os aprovados da competição.',
            '**No próprio evento**: vale o percentil no evento (média; às cegas, single).',
            '**Variantes de NxN**: também vale o percentil na **modalidade principal**, e conta o melhor dos dois. Quem é muito bom no 3x3 é um ótimo embaralhador de 3BLD mesmo sem nunca ter feito 3BLD.',
            '**Sum of Ranks**: soma das posições no ranking mundial (single) em todas as modalidades; modalidade sem resultado conta como o pior ranking visto na competição + 1. Destaca quem é bom em todas ou quase todas as modalidades.',
            `**Evento novo** (menos de ${rare}% dos inscritos nele já têm resultado — ex.: FTO no começo): o Sum of Ranks vale **igual** ao ranking do evento.`,
            '**Evento normal** (metade ou mais com resultado): o Sum of Ranks **não é usado** — só contam o evento e, nas variantes, a modalidade principal.',
          ],
        },
        {
          table: [
            ['Evento', 'Também considera'],
            ['3x3 às cegas, 3x3 com uma mão, Multi-BLD, FMC', '3x3'],
            ['4x4 às cegas', '4x4'],
            ['5x5 às cegas', '5x5'],
            [`Evento novo (< ${rare}% com resultado)`, 'Sum of Ranks em pé de igualdade'],
            ['Outros eventos', 'Só o próprio evento (Sum of Ranks não é usado)'],
          ],
        },
        '**Formulário**: quem respondeu que **não** quer embaralhar nunca é escalado. Quem marcou os puzzles que sabe embaralhar só embaralha esses — mas marcar a **modalidade principal** (ex.: 3x3) libera as variantes (3BLD, OH…), e evento novo não exclui ninguém (ele costuma nem estar no formulário).',
        '**Rodízio**: entre os mais bem classificados (uma "janela" de 3× as vagas, no mínimo 6), quem já embaralhou mais vezes perde prioridade para o próximo da lista. Assim os melhores não ficam presos embaralhando a competição inteira.',
      ],
    },
    {
      id: 'juizes',
      title: '6. Juízes e runners',
      blocks: [
        '**Juízes por grupo** = nº de estações (ou o tamanho do grupo, se for menor). Se a competição tem mais de um palco, cada palco pode ter seu nº de estações.',
        'Prioridade: **quem competiu no grupo anterior** julga o grupo seguinte (já está ali e livre); depois, quem tem **menos tarefas**; depois, quem prefere ser juiz.',
        '**Runners** só são escalados se a opção estiver ligada: 1 a cada 8 estações.',
      ],
    },
    {
      id: 'delegados',
      title: '7. Delegados',
      blocks: [
        'Delegados (e trainees) são **poupados** de juiz e embaralhador, para cuidarem de incidentes e de outras frentes. Organizadores seguem as regras normais.',
        `**Staff expressivo**: se o staff livre no horário (sem contar Delegados) for de pelo menos ${C.delegateThreshold}× as vagas do grupo, Delegados ficam totalmente de fora.`,
        'Sem staff expressivo: um Delegado **bem ranqueado** pode embaralhar, e como juiz ele só entra como **último recurso**, quando não há mais ninguém. A Conferência mostra quando isso acontece.',
      ],
    },
    {
      id: 'suplentes',
      title: '8. Suplentes',
      blocks: [
        `Cada grupo recebe até ${C.reservesPerGroup} suplentes (ajustável): pessoas da lista que estão **livres naquele horário**, com menos tarefas, sem Delegados quando possível.`,
        'São calculados depois de todo o staff, para nunca sugerir alguém já escalado num grupo simultâneo.',
        'Se alguém faltar, clique no nome e use **Trocar por suplente**. Suplentes não vão para a WCA (não existe código para isso): ficam no CubeStaff e nas planilhas.',
      ],
    },
    {
      id: 'manual',
      title: '9. Ajustes manuais e travas',
      blocks: [
        'Clique em qualquer nome para mover de grupo, trocar por suplente, travar ou remover. O **+** de cada seção adiciona alguém, mostrando quem está ocupado, indisponível, fora da lista ou já com outra função.',
        'Tudo o que você muda à mão fica **travado** (cadeado): ao gerar de novo, os itens travados são mantidos e o resto é refeito ao redor deles. Se o nº de grupos de uma rodada mudar, as travas dela são descartadas.',
        'Desfazer e Refazer guardam até 50 passos.',
      ],
    },
    {
      id: 'rodadas',
      title: '10. Rodadas seguintes',
      blocks: [
        'As rodadas 2 em diante só podem ser geradas quando os **classificados são conhecidos**. Lance os resultados no WCA Live, abra a próxima rodada e clique em **Sincronizar** lá.',
        'No CubeStaff, **Atualizar rodadas seguintes** busca os dados na WCA e gera só as rodadas novas, sem mexer no que já foi planejado. Se o WCA Live ainda não abriu a rodada, os classificados são calculados pelos resultados da anterior e pela condição de classificação (no máximo 75%).',
      ],
    },
    {
      id: 'salvar',
      title: '11. Onde fica salvo',
      blocks: [
        {
          list: [
            '**Salvar rascunho**: grava o plano na própria competição na WCA, sem publicar os grupos. Abre em qualquer aparelho, por qualquer Delegado ou Organizador.',
            '**Publicar na WCA**: grava os grupos e as atribuições oficiais.',
            '**Neste navegador**: rascunho automático e dados privados do formulário (e-mail, WhatsApp, respostas do teste de embaralhamento). O plano na WCA é público, por isso esses dados nunca vão para lá.',
            'Se duas pessoas salvarem ao mesmo tempo, o CubeStaff avisa e você escolhe qual versão fica.',
            '**Limpar tudo** apaga o plano e, se marcado, também os grupos e atribuições publicados na WCA.',
          ],
        },
      ],
    },
    {
      id: 'conferencia',
      title: '12. Conferência (alertas)',
      blocks: [
        {
          table: [
            ['Alerta', 'O que significa'],
            ['Duas funções ao mesmo tempo', 'A pessoa está em duas coisas simultâneas (erro).'],
            [
              'Inscrição não aprovada',
              'A inscrição foi cancelada ou ficou pendente depois de gerar (erro). Gere de novo.',
            ],
            ['Novato no staff', 'Alguém sem WCA ID foi colocado como juiz/embaralhador à mão (erro).'],
            ['Não estará presente', 'Escalado num período que marcou como indisponível.'],
            ['Só compete em outro dia', 'Escalado num dia em que não tem nenhuma modalidade inscrita.'],
            ['X de Y juízes / embaralhadores', 'Faltou gente livre para completar o grupo.'],
            ['Delegado no staff', 'Informativo: um Delegado foi escalado.'],
            ['Fora da lista de staff', 'Informativo: escalado à mão sem estar na lista.'],
            ['Rodada sem horário', 'A rodada não está no cronograma da WCA e não pode ser publicada.'],
          ],
        },
      ],
    },
  ],
}
