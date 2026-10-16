import { DEFAULT_CONFIG as C } from '../model/types'
import { RARE_SHARE } from '../model/scramblerRank'
import type { Manual } from './types'

const rare = Math.round(RARE_SHARE * 100)

export const es: Manual = {
  title: 'Manual de CubeStaff',
  subtitle: 'Cómo se arman los grupos y el staff',
  intro:
    'Este manual explica **cada criterio** que CubeStaff usa para armar los grupos y elegir jueces, mezcladores, runners y suplentes. Todo lo que el programa decide se puede ajustar a mano después — y lo que ajustes queda fijado.',
  toc: 'En esta página',
  feedbackTitle: 'Sugerencias y comentarios',
  feedbackText:
    '¿Encontraste un criterio extraño, un caso que el programa no trata o una regla que debería ser distinta? Envía tu sugerencia — este manual y las reglas evolucionan con el uso en competiciones.',
  feedbackEmail: 'Enviar e-mail',
  feedbackGithub: 'Abrir una sugerencia en GitHub',
  back: 'Volver a CubeStaff',
  sections: [
    {
      id: 'fluxo',
      title: '1. Paso a paso',
      blocks: [
        {
          list: [
            '**Staff**: importa el CSV del formulario de staff (o arma la lista a mano) con los voluntarios **aprobados**.',
            '**Configuración**: indica el nº de estaciones y el nº de grupos de cada ronda. Al lado aparece la cuenta "≈ N por grupo".',
            '**Generar grupos**: el programa distribuye a los competidores y asigna el staff según las reglas de abajo.',
            '**Revisar**: en la pestaña Grupos, mueve personas, cambia por suplentes, agrega o quita. La Revisión señala problemas.',
            '**Guardar borrador** (solo el plan, sin publicar) o **Publicar en la WCA** (los grupos aparecen en Competition Groups y ScoreComps).',
            'El día: después de sincronizar WCA Live, **Actualizar rondas siguientes** genera solo las rondas cuyos clasificados ya se conocen.',
          ],
        },
      ],
    },
    {
      id: 'quem',
      title: '2. Quién entra',
      blocks: [
        'Solo cuentan las **inscripciones aprobadas** en la WCA. Las pendientes, en lista de espera, canceladas o rechazadas quedan fuera de todo: grupos, staff, suplentes, elecciones manuales e importación del CSV.',
        'Quien está aprobado como **staff no competidor** puede ser asignado como staff, pero no compite.',
        'Marca a los **ausentes** en la pestaña Personas antes de generar: no entran en los grupos ni en el staff.',
        '**Novato** = persona sin WCA ID (primera competición).',
      ],
    },
    {
      id: 'competidores',
      title: '3. Grupos de competidores',
      blocks: [
        'El **nº de grupos** de cada ronda lo defines tú. Los grupos quedan con tamaños casi iguales (diferencia máxima de 1). El horario de cada grupo es una parte igual del horario de la ronda en el cronograma de la WCA; las rondas en más de un escenario reparten los grupos entre ellos.',
        '**Ranking usado**: el récord personal de **media** en el evento (en los eventos a ciegas, el **single**). Quien no tiene resultado cuenta como el más lento.',
        'Los experimentados se ordenan **del más lento al más rápido**: los primeros grupos reciben a los más lentos y **los más rápidos quedan en los últimos grupos** (bueno para la transmisión y libera a los mejores mezcladores al inicio). Dentro del grupo, el orden (y la estación, si se numera) va del más rápido al más lento.',
        'Hay dos formas de tratar a los **novatos**:',
        {
          table: [
            ['Opción', 'Resultado'],
            [
              'Novatos en los primeros grupos · 100%',
              'Los primeros grupos son solo de novatos (todos los Delegados pueden acompañar). Si sobran lugares, se completan con los experimentados más lentos.',
            ],
            [
              'Novatos en los primeros grupos · 50%',
              'Los primeros grupos son mitad novatos, mitad experimentados (más lentos), para equilibrar los incidentes.',
            ],
            ['Mezclar en todos los grupos', 'Los novatos se reparten por igual en todos los grupos.'],
          ],
        },
        '**Conflicto de horario**: si alguien compite en otra cosa al mismo tiempo (ej.: otro escenario), el programa lo intercambia con alguien de un grupo vecino (nivel parecido). Si no hay intercambio posible, aparece un aviso.',
        'FMC y Multi-BLD con intentos en el cronograma (-a1, -a2…) no tienen grupos: todos se asignan a los intentos.',
      ],
    },
    {
      id: 'staff',
      title: '4. Reglas generales del staff',
      blocks: [
        {
          list: [
            'Solo se asigna automáticamente a quien está en la **lista de voluntarios aprobados** (pestaña Staff). Quien se ofrezca el mismo día entra como **ayudante extra** y se asigna a mano.',
            '**Una función a la vez**: quien compite en un grupo solo compite; nadie hace dos cosas al mismo tiempo, incluso en escenarios distintos.',
            '**Los novatos nunca** son jueces ni mezcladores.',
            'Se respeta la **disponibilidad** del formulario (Mañana = antes del mediodía, Tarde = después, en el horario de la competición).',
            `**Tareas seguidas**: como máximo ${C.maxConsecutive} grupos de staff seguidos antes de una pausa (ajustable; 0 = sin límite).`,
            '**Máximo por persona** en la competición: opcional (0 = sin límite).',
            'Las **funciones marcadas** en el formulario limitan lo que la persona hace; la **función preferida** le da prioridad en esa función.',
            'El staff se asigna en **orden cronológico**, y quien tiene menos tareas tiene prioridad — así la carga se reparte.',
          ],
        },
      ],
    },
    {
      id: 'embaralhadores',
      title: '5. Mezcladores',
      blocks: [
        `**Cantidad**: 1 mezclador cada ${C.competitorsPerScrambler} competidores del grupo (1–${C.competitorsPerScrambler} → 1, ${C.competitorsPerScrambler + 1}–${C.competitorsPerScrambler * 2} → 2, …). Ajustable en Avanzado.`,
        '**Quién**: los mejor ubicados en el ranking de mezclador, que funciona así:',
        {
          list: [
            '**Percentil**: para comparar eventos distintos, cada ranking se convierte en una posición de 0% (mejor de la competición) a 100% (peor), solo entre los aprobados de la competición.',
            '**En el propio evento**: vale el percentil en el evento (media; a ciegas, single).',
            '**Variantes de NxN**: también vale el percentil en la **modalidad principal**, y cuenta el mejor de los dos. Quien es muy bueno en 3x3 es un gran mezclador de 3BLD aunque nunca haya hecho 3BLD.',
            '**Sum of Ranks**: suma de las posiciones en el ranking mundial (single) en todas las modalidades; la modalidad sin resultado cuenta como el peor ranking visto en la competición + 1. Destaca a quien es bueno en todas o casi todas las modalidades.',
            `**Evento nuevo** (menos del ${rare}% de sus inscritos tiene resultado — ej.: FTO al principio): el Sum of Ranks vale **igual** que el ranking del evento.`,
            '**Evento normal**: el Sum of Ranks solo **completa** la lista, después de todos los que tienen resultado en el evento (o en la modalidad principal).',
          ],
        },
        {
          table: [
            ['Evento', 'También considera'],
            ['3x3 a ciegas, 3x3 a una mano, Multi-BLD, FMC', '3x3'],
            ['4x4 a ciegas', '4x4'],
            ['5x5 a ciegas', '5x5'],
            [`Evento nuevo (< ${rare}% con resultado)`, 'Sum of Ranks en igualdad'],
            ['Otros eventos', 'Sum of Ranks solo para completar'],
          ],
        },
        '**Formulario**: quien respondió que **no** quiere mezclar nunca es asignado. Quien marcó los puzzles que sabe mezclar solo mezcla esos — pero marcar la **modalidad principal** (ej.: 3x3) habilita las variantes (3BLD, OH…), y un evento nuevo no excluye a nadie (normalmente ni está en el formulario).',
        '**Rotación**: entre los mejor ubicados (una "ventana" de 3× las vacantes, mínimo 6), quien ya mezcló más veces pierde prioridad frente al siguiente. Así los mejores no quedan mezclando toda la competición.',
      ],
    },
    {
      id: 'juizes',
      title: '6. Jueces y runners',
      blocks: [
        '**Jueces por grupo** = nº de estaciones (o el tamaño del grupo, si es menor). Con más de un escenario, cada uno puede tener su nº de estaciones.',
        'Prioridad: **quien compitió en el grupo anterior** juzga el siguiente (ya está ahí y libre); después, quien tiene **menos tareas**; después, quien prefiere juzgar.',
        'Los **runners** solo se asignan si la opción está activada: 1 cada 8 estaciones.',
      ],
    },
    {
      id: 'delegados',
      title: '7. Delegados',
      blocks: [
        'Los Delegados (y trainees) quedan **resguardados** de juez y mezclador, para atender incidentes y otras tareas. Los organizadores siguen las reglas normales.',
        `**Staff abundante**: si el staff libre en ese horario (sin contar Delegados) es al menos ${C.delegateThreshold}× las vacantes del grupo, los Delegados quedan totalmente fuera.`,
        'Sin staff abundante: un Delegado **bien ubicado en el ranking** puede mezclar, y como juez solo entra como **último recurso**, cuando no queda nadie más. La Revisión muestra cuándo ocurre.',
      ],
    },
    {
      id: 'suplentes',
      title: '8. Suplentes',
      blocks: [
        `Cada grupo recibe hasta ${C.reservesPerGroup} suplentes (ajustable): personas de la lista **libres en ese horario**, con menos tareas, sin Delegados cuando es posible.`,
        'Se calculan después de todo el staff, para nunca sugerir a alguien ya asignado en un grupo simultáneo.',
        'Si alguien falta, haz clic en su nombre y usa **Cambiar por suplente**. Los suplentes no van a la WCA (no existe código para eso): quedan en CubeStaff y en las planillas.',
      ],
    },
    {
      id: 'manual',
      title: '9. Ajustes manuales y fijados',
      blocks: [
        'Haz clic en cualquier nombre para mover de grupo, cambiar por suplente, fijar o quitar. El **+** de cada sección agrega a alguien, mostrando quién está ocupado, no disponible, fuera de la lista o ya con otra función.',
        'Todo lo que cambias a mano queda **fijado** (candado): al generar de nuevo, los elementos fijados se mantienen y el resto se rearma alrededor. Si cambia el nº de grupos de una ronda, sus fijados se descartan.',
        'Deshacer y Rehacer guardan hasta 50 pasos.',
      ],
    },
    {
      id: 'rodadas',
      title: '10. Rondas siguientes',
      blocks: [
        'Las rondas 2 en adelante solo se pueden generar cuando **se conocen los clasificados**. Carga los resultados en WCA Live, abre la próxima ronda y haz clic en **Sincronizar** allí.',
        'En CubeStaff, **Actualizar rondas siguientes** busca los datos en la WCA y genera solo las rondas nuevas, sin tocar lo ya planificado. Si WCA Live todavía no abrió la ronda, los clasificados se calculan con los resultados de la anterior y la condición de clasificación (máximo 75%).',
      ],
    },
    {
      id: 'salvar',
      title: '11. Dónde se guarda',
      blocks: [
        {
          list: [
            '**Guardar borrador**: guarda el plan en la propia competición en la WCA, sin publicar los grupos. Se abre en cualquier dispositivo, por cualquier Delegado u Organizador.',
            '**Publicar en la WCA**: guarda los grupos y las asignaciones oficiales.',
            '**En este navegador**: borrador automático y datos privados del formulario (e-mail, WhatsApp, respuestas de la prueba de mezcla). El plan en la WCA es público, por eso esos datos nunca van allí.',
            'Si dos personas guardan al mismo tiempo, CubeStaff avisa y eliges qué versión queda.',
            '**Borrar todo** elimina el plan y, si se marca, también los grupos y asignaciones publicados en la WCA.',
          ],
        },
      ],
    },
    {
      id: 'conferencia',
      title: '12. Revisión (alertas)',
      blocks: [
        {
          table: [
            ['Alerta', 'Qué significa'],
            ['Dos funciones al mismo tiempo', 'La persona está en dos cosas simultáneas (error).'],
            [
              'Inscripción no aprobada',
              'La inscripción se canceló o quedó pendiente después de generar (error). Genera de nuevo.',
            ],
            ['Novato en el staff', 'Alguien sin WCA ID fue puesto como juez/mezclador a mano (error).'],
            ['No estará presente', 'Asignado en un período que marcó como no disponible.'],
            ['X de Y jueces / mezcladores', 'Faltó gente libre para completar el grupo.'],
            ['Delegado en el staff', 'Informativo: se asignó a un Delegado.'],
            ['Fuera de la lista de staff', 'Informativo: asignado a mano sin estar en la lista.'],
            ['Ronda sin horario', 'La ronda no está en el cronograma de la WCA y no se puede publicar.'],
          ],
        },
      ],
    },
  ],
}
