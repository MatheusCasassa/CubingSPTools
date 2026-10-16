// Manual do CubeStaff: como os grupos e o staff são montados.
// Texto com **negrito**. Cada idioma é um arquivo (pt, en, es) com as mesmas seções.

export type Block = string | { list: string[] } | { table: string[][] } | { note: string }

export interface Section {
  id: string
  title: string
  blocks: Block[]
}

export interface Manual {
  title: string
  subtitle: string
  intro: string
  toc: string
  feedbackTitle: string
  feedbackText: string
  feedbackEmail: string
  feedbackGithub: string
  back: string
  sections: Section[]
}
