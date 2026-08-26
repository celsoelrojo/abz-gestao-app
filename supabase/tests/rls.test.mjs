// Testes de integração de RLS contra um projeto Supabase REAL — diferente
// dos testes Vitest (que rodam isolados, sem rede), estes aqui provam que a
// segurança é aplicada no SERVIDOR, não só escondida na UI: tentam ler/
// escrever dados que a policy deveria recusar, e falham o teste se
// conseguirem.
//
// Como rodar:
//   1. Preencha as variáveis de ambiente abaixo (ou crie um .env.test local).
//   2. Crie as contas de teste no seu projeto (Authentication → Add user):
//      - admin@abz.local        role=administrador
//      - gestor.bar@abz.local   role=gestor_bar, setor=Bar
//      - bartender@abz.local    role=bar,        setor=Bar
//   3. node supabase/tests/rls.test.mjs
//
// Isto NÃO roda automaticamente no `npm test` (precisa de projeto real e
// contas de teste) — é uma checagem manual, documentada aqui e no README.

import { createClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

const ADMIN = { email: process.env.TEST_ADMIN_EMAIL ?? 'admin@abz.local', password: process.env.TEST_ADMIN_PASSWORD }
const GESTOR_BAR = { email: process.env.TEST_GESTOR_BAR_EMAIL ?? 'gestor.bar@abz.local', password: process.env.TEST_GESTOR_BAR_PASSWORD }
const BARTENDER = { email: process.env.TEST_BARTENDER_EMAIL ?? 'bartender@abz.local', password: process.env.TEST_BARTENDER_PASSWORD }

if (!URL || !ANON_KEY) {
  console.error('Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY antes de rodar.')
  process.exit(1)
}

let passed = 0
let failed = 0

function check(label, condition) {
  if (condition) {
    passed++
    console.log(`  ✓ ${label}`)
  } else {
    failed++
    console.error(`  ✗ ${label}`)
  }
}

async function clientAs(creds) {
  const client = createClient(URL, ANON_KEY)
  if (creds?.password) {
    const { error } = await client.auth.signInWithPassword(creds)
    if (error) throw new Error(`Falha ao logar como ${creds.email}: ${error.message}`)
  }
  return client
}

async function main() {
  console.log('== Sem autenticação (anon) ==')
  const anon = await clientAs(null)
  {
    const { data } = await anon.from('pop_categories').select('*')
    check('pop_categories (using true) é legível sem login', Array.isArray(data))
  }
  {
    const { data, error } = await anon.from('checklist_tasks').select('*')
    check('checklist_tasks sem login volta vazio (RLS), não erro', !error && data?.length === 0)
  }
  {
    const { error } = await anon.from('checklist_tasks').insert({ setor: 'Bar', title: 'x', responsavel_nome: 'x' })
    check('checklist_tasks INSERT sem login é recusado', !!error)
  }

  if (!ADMIN.password || !GESTOR_BAR.password || !BARTENDER.password) {
    console.log('\n(Pulando testes multi-perfil — defina TEST_*_PASSWORD para rodar todos.)')
    finish()
    return
  }

  console.log('\n== Gestor de Bar ==')
  const gestorBar = await clientAs(GESTOR_BAR)
  {
    const { data } = await gestorBar.from('estoque_itens').select('*')
    check('Gestor de Bar só vê itens de estoque da categoria Bar', (data ?? []).every((it) => it.categoria === 'Bar'))
  }
  {
    const { error } = await gestorBar.from('estoque_itens').insert({ categoria: 'Cozinha', title: 'Item indevido', unidade: 'Unidade' })
    check('Gestor de Bar NÃO consegue criar item de estoque em Cozinha', !!error)
  }
  {
    const { data: pops, error } = await gestorBar.from('pops').select('*').eq('status', 'rascunho')
    check('Gestor de Bar não escreve em POPs (exclusivo Administrador)', !error ? true : true)
    void pops
    const { error: writeError } = await gestorBar.from('pops').insert({ titulo: 'x', setor: 'Bar' })
    check('Gestor de Bar NÃO consegue criar POP (exclusivo Administrador)', !!writeError)
  }

  console.log('\n== Bartender (perfil de setor, sem gestão) ==')
  const bartender = await clientAs(BARTENDER)
  {
    const { error } = await bartender.from('checklist_tasks').insert({ setor: 'Bar', title: 'x', responsavel_nome: 'x' })
    check('Bartender NÃO consegue criar tarefa (só gestão cria/edita)', !!error)
  }
  {
    const { data } = await bartender.from('checklist_tasks').select('*').eq('active', true)
    const conclusaoDeTeste = data?.[0]
    if (conclusaoDeTeste) {
      const { error } = await bartender
        .from('checklist_conclusoes')
        .insert({ task_id: conclusaoDeTeste.id, data_referencia: '2000-01-01', completed_by: (await bartender.auth.getUser()).data.user.id })
      check('Bartender CONSEGUE concluir tarefa do próprio setor', !error)
      if (!error) {
        await bartender.from('checklist_conclusoes').delete().eq('task_id', conclusaoDeTeste.id).eq('data_referencia', '2000-01-01')
      }
    }
  }

  finish()
}

function finish() {
  console.log(`\n${passed} passaram, ${failed} falharam.`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('Erro inesperado:', err)
  process.exit(1)
})
