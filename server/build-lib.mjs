// Converte a lógica em TypeScript (src/*.ts) para JavaScript em server/lib/,
// para o servidor poder usá-la sem depender do suporte a .ts do Node.
// Usa o pacote "typescript", que já vem instalado no projeto.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const here = dirname(fileURLToPath(import.meta.url))

// Arquivos de src/ usados pelo servidor (sem a extensão)
const FILES = [
  'setup',
  'election',
  'game',
  'round',
  'turns',
  'power',
  'parties',
  'profile',
]

export function buildLib() {
  const out = join(here, 'lib')
  mkdirSync(out, { recursive: true })

  for (const name of FILES) {
    const source = readFileSync(join(here, '..', 'src', `${name}.ts`), 'utf8')

    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    })

    // imports relativos passam a apontar para os .mjs gerados
    const js = outputText.replace(
      /from\s+(['"])(\.\/[^'"]+?)(?:\.ts)?\1/g,
      (_m, q, p) => `from ${q}${p}.mjs${q}`
    )

    writeFileSync(join(out, `${name}.mjs`), js)
  }
}
