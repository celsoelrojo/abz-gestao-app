# Abz Gestão

Aplicativo de gestão operacional do Abrazo Drink Bar. Este é o **app de produção** (React + TypeScript + Supabase), construído a partir do protótipo client-side em `../abz-gestao/` — que continua existindo como referência de UI/regras de negócio enquanto os módulos são migrados um a um pra cá.

## Status da migração

| Módulo | Status |
| --- | --- |
| Autenticação (login por usuário + senha) | ✅ Migrado |
| Gerenciar Contas | ✅ Migrado — criar, editar (nome/perfil/setor), ativar/bloquear, redefinir senha, histórico. Criar conta e redefinir senha dependem da Edge Function `manage-user` (ver abaixo) |
| Checklist | ✅ Migrado — hoje, atrasadas (com justificativa), próximos 5 dias (com justificativa de antecipação), todas as periodicidades (incl. Mensal/Quinzenal, com dias da semana configuráveis em todas elas), foto obrigatória, tempo real, tela "Gerenciar Checklist" (CRUD + reordenar + vínculo com Mapa/POP/Ficha). O picker de vínculo já consulta as tabelas reais (`mapas_fluxogramas`/`pops`/`fichas_tecnicas`/`fichas_producao`), todas com dados de verdade agora. "Esta tarefa envolve produção" está completo: registra o lote, dá entrada automática no Estoque, reverte tudo se a tarefa for desmarcada, e oferece enfileirar etiqueta se houver impressora ativa. Seção exclusiva "Pagamento de Freelancers" (Administrador) mostra as tarefas geradas automaticamente pela Escala |
| Configuração de Impressora | 🟡 Parcial — cadastro de impressora, fila de impressão, adaptador TSPL. Bluetooth real só funciona no app nativo (Capacitor) e exige confirmar o protocolo do modelo |
| Estoque e Compras | ✅ Migrado — Estoque Atual (só leitura, Setor > Categoria > Subcategoria, com selo "Crítico" e validade próxima), Entrada no Estoque (cadastra produto novo e dá saldo, com categoria/subcategoria pré-preenchidas ao reconhecer um produto já existente), Retirada (busca + preview de saldo + estorno exclusivo do Administrador), Estoque Mínimo e Máximo, Lista de Compras (derivada do saldo médio, sugestão mirando 80% do máximo), Entrada por Produção (baixa automática ao concluir uma tarefa "envolve produção" no Checklist) |
| Mensagens Importantes | ✅ Migrado — painel na Home com alertas automáticos (estoque crítico/validade, resumo de reservas do dia pra todo mundo, resumo de freelancers da Cozinha) + mensagens manuais (CRUD, Realtime), na mesma ordem e regras de permissão do protótipo (Gestor de setor só publica/edita no próprio setor, nunca "Todos"; só Administrador exclui) |
| Reservas | ✅ Migrado — lista por dia/período (Almoço antes de Noite), busca por nome, filtros de data/período/status, formulário completo (4 grupos de campos), aviso (não bloqueio) de capacidade excedida, histórico de mudanças, tela de Capacidade. Exclusivo do setor Salão + Administrador; Atendente não vê telefone/Instagram/e-mail do cliente |
| Fichas Técnicas | ✅ Migrado — consulta (busca + categoria) e gestão (rascunho/publicada/inativa, versão, vínculos Mapa/POP/Ficha Técnica) por setor (Bar/Cozinha). Custo (embalagem, preço sugerido, custo por ingrediente) só aparece pra quem gerencia — Bar/Cozinha comum lê a view `fichas_tecnicas_sem_custo`, uma garantia real do banco (RLS + view), não só esconder no front como no protótipo |
| Fichas de Produção | ✅ Migrado — consulta e gestão (mesmas regras de publicação/versão/setor), vínculo reverso com Fichas Técnicas, ingredientes classificados (base/secundário/variável), config de validade, lotes (manual, com ajuste de validade justificado) e Calculadora de Produção (só leitura, nunca reescreve a ficha salva) |
| Mapas e Fluxogramas | ✅ Migrado — Mapas e Fluxogramas são a mesma estrutura (blocos de texto/imagem ordenáveis), sem workflow de publicação, exatamente como no protótipo; Gestor cria/edita/reordena do próprio setor, só Administrador exclui |
| POP's | ✅ Migrado — documento de 12 seções (identificação, objetivo, aplicação, responsabilidades, materiais, etapas, segurança, frequência, monitoramento, ações corretivas, referências/anexos/vínculos, histórico), categorias globais (CRUD do Administrador, com realocação obrigatória antes de excluir) + subcategoria livre por setor. Diferente da RLS original: Gestor do setor cria/edita/publica POP's do próprio setor (igual a Mapas/Fichas), só Administrador exclui e gerencia categorias |
| Freelancer | ✅ Migrado — Cadastro (por setor, ativar/inativar) e Escala (hoje + semana, por período Almoço/Noite). A tarefa "Pagar freelancer" no Checklist é gerada/sincronizada automaticamente por trigger no banco ao salvar a escala, nunca editável em "Gerenciar Checklist". Exclusivo do Administrador, sem exceção pra Gestor (único módulo assim) |
| Histórico de auditoria | ⬜ Schema pronto (`audit_log`, trigger automático em todas as tabelas críticas), sem tela ainda |

## Stack

- **Frontend**: Vite + React 18 + TypeScript, React Router, `@tanstack/react-query`, Zustand.
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime), com toda a permissão aplicada via **Row Level Security** — a UI só esconde botão por conveniência, quem garante a regra é o banco.
- **CSS**: `src/theme.css` é uma cópia fiel do `styles.css` do protótipo — mesma identidade visual, sem framework novo.
- **Mobile**: Capacitor (Android configurado em `android/`; iOS precisa de um Mac com Xcode, ainda não gerado).
- **Impressão**: arquitetura por adaptadores (`src/lib/printing/`) — hoje só o adaptador TSPL existe.

## 1. Criar o projeto Supabase

1. Crie uma conta e um projeto em [supabase.com](https://supabase.com) (região `South America (São Paulo)` é a mais próxima).
2. Em **Project Settings → API**, copie a **Project URL** e a **anon public key**.
3. Copie `.env.example` para `.env.local` e preencha:
   ```
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-anon-key
   ```
   Nunca coloque a **service_role key** aqui — ela só é usada dentro da Edge Function (ver seção 4), nunca no cliente.

## 2. Rodar as migrations

As migrations ficam em `supabase/migrations/`, numeradas na ordem em que devem ser aplicadas (dependem umas das outras).

**Sem instalar a CLI** (mais simples pra começar): abra o **SQL Editor** do painel Supabase, copie o conteúdo de cada arquivo `000N_*.sql` **na ordem numérica**, cole e clique em "Run" — um arquivo de cada vez, sempre conferindo que não deu erro antes do próximo. Depois rode `supabase/seed.sql` (dados de exemplo pro Checklist/Estoque/POPs).

**Com a CLI do Supabase** (recomendado a partir daqui, pra não repetir isso manualmente):
```bash
npm install -g supabase
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase db push
```

## 3. Criar a primeira conta (Administrador)

O formulário padrão do painel Supabase ("Add user") não deixa definir o *role* customizado na hora da criação — por isso, crie a conta só com e-mail/senha e depois promova pra Administrador por SQL:

1. **Authentication → Add user**: e-mail `admin@abz.local` (o login do app usa "usuário", mas por baixo é sempre um e-mail — a convenção é `usuario@abz.local`), defina uma senha, marque "Auto Confirm User".
2. No **SQL Editor**, rode (trocando o e-mail se usou outro):
   ```sql
   update public.profiles
   set role = 'administrador', setor = null, status = 'ativa', nome = 'Seu Nome', username = 'admin'
   where id = (select id from auth.users where email = 'admin@abz.local');
   ```
3. Entre no app com usuário `admin` e a senha definida.

Contas seguintes já podem ser criadas pela tela **Gerenciar Contas** (uma vez publicada a Edge Function `manage-user`, seção 4) — lá dá pra escolher role/setor direto.

## 4. Deploy da Edge Function `manage-user`

Necessária pros botões "+ Nova conta" e "🔑 Redefinir senha" (ambos usam a `service_role key` do lado do servidor — por isso não podem rodar no navegador). Editar nome/perfil/setor e ativar/bloquear uma conta **não** dependem desta função — são só `update` em `profiles`, cobertos pela RLS.

```bash
supabase functions deploy manage-user
```

Não precisa configurar `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` manualmente — o Supabase injeta essas variáveis automaticamente dentro de toda Edge Function.

## 5. Rodar localmente

```bash
npm install
npm run dev
```
Abre em `http://localhost:5173`.

## 6. Testes

```bash
npm run test        # Vitest — unitários e de componente, não tocam em rede
```

Além disso, `supabase/tests/rls.test.mjs` é um teste de **integração de RLS** contra um projeto Supabase real (prova que a permissão é aplicada no servidor, não só na UI). Não roda com `npm test` porque precisa de credenciais reais e contas de teste:

```bash
# crie as contas admin@abz.local / gestor.bar@abz.local / bartender@abz.local antes
VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... \
TEST_ADMIN_PASSWORD=... TEST_GESTOR_BAR_PASSWORD=... TEST_BARTENDER_PASSWORD=... \
node supabase/tests/rls.test.mjs
```

## 7. Build Android (Capacitor)

Exige [Android Studio](https://developer.android.com/studio) instalado.

```bash
npm run build
npx cap sync android
npx cap open android
```
Isso abre o projeto no Android Studio pra rodar num emulador/aparelho ou gerar o APK/AAB.

iOS segue o mesmo padrão (`npx cap add ios` / `npx cap open ios`), mas só é possível numa máquina com Xcode (Mac) — não foi gerado ainda nesta máquina Windows.

### Impressão Bluetooth no app nativo

O adaptador TSPL (`src/lib/printing/TsplAdapter.ts`) já gera os comandos de etiqueta. **O transporte Bluetooth em si ainda não está implementado** — antes de habilitar impressão direta:

1. Confirme que a impressora do usuário realmente fala TSPL (nem toda impressora Bluetooth de etiqueta fala — muitas usam ZPL ou um protocolo proprietário). Marque `protocolo_confirmado = true` na tela de Configuração de Impressora só depois de confirmado.
2. Escolha o plugin Capacitor certo pro transporte: a maioria das impressoras de etiqueta usa **Bluetooth Classic (SPP)**, não BLE — plugins comuns da comunidade cobrem isso, mas a escolha exata depende do modelo. BLE (`@capacitor-community/bluetooth-le`) só serve se a impressora realmente expuser um serviço BLE.
3. Implemente `PrinterTransport` (`src/lib/printing/types.ts`) usando o plugin escolhido e plugue em `processPrintJob` (`src/lib/printing/printQueue.ts`), onde hoje há um `TODO` explícito.

No navegador (fora do app empacotado), a impressão nunca promete acesso Bluetooth direto — o job fica na fila (`print_jobs`, status `Pendente`) pra impressão via sistema operacional ou reprocessamento depois.

## 8. Deploy do app web (Netlify)

O projeto já vem preparado pra Netlify: `netlify.toml` (nesta pasta) define o comando de build, a pasta publicada e o redirect de SPA (sem ele, recarregar a página em `/checklist`, `/estoque` etc. dá 404 — toda rota precisa cair no `index.html` pro React Router assumir).

**Variáveis de ambiente** — configure em *Site settings → Environment variables* no painel do Netlify, com os mesmos valores do seu `.env.local`:
```
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key
```
Nunca commite `.env.local` — o Vite embute essas variáveis no build, então elas precisam existir no ambiente do Netlify antes de buildar.

**Opção A — via Git (recomendado, deploy automático a cada push):**
1. O repositório Git já foi inicializado **dentro de `abz-gestao-app/`** (não na pasta pai, que tem outros documentos do bar sem relação com o código) — falta só o primeiro commit e um `git remote add origin ...` apontando pro GitHub/GitLab, depois `git push`.
2. No painel do Netlify: *Add new site → Import an existing project*, escolha o repositório. Como `abz-gestao-app/` já é a raiz do repositório, não precisa configurar "Base directory" — build command e publish directory já vêm do `netlify.toml`.
3. Adicione as variáveis de ambiente (acima) antes do primeiro deploy.

**Opção B — via Netlify CLI (sem precisar de Git/GitHub):**
```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod
```
Rode de dentro de `abz-gestao-app/` — o CLI lê o `netlify.toml` local. Também exige configurar as variáveis de ambiente antes (`netlify env:set VITE_SUPABASE_URL ...` ou pelo painel web do site criado).

**Build local pra conferir antes de subir:**
```bash
npm run build
```
Gera `dist/` (já no `.gitignore`, não precisa commitar).

## Estrutura de pastas

```
src/
  lib/              cliente Supabase, utilitários de data, tema, impressão
  store/            estado global (sessão/perfil) via Zustand
  features/         um módulo por pasta (auth, checklist, contas, printing, home)
  types/database.ts tipos das tabelas — troque por `supabase gen types` quando tiver o projeto
supabase/
  migrations/       schema + RLS, numerados e sequenciais
  seed.sql          dados de exemplo (dev)
  functions/        Edge Functions (create-user)
  tests/            teste de integração de RLS contra projeto real
```

## Segurança — pontos que valem repetir

- Toda regra de permissão está em **RLS** (`supabase/migrations/`), não só escondida na interface — teste isso rodando `supabase/tests/rls.test.mjs`.
- `service_role key` nunca aparece no código do cliente — só dentro de Edge Functions, injetada automaticamente pelo Supabase.
- Fotos/documentos vão pro Supabase Storage com policy por setor (mesma regra das tabelas).
- Toda ação crítica (criar/editar/excluir/concluir/movimentar estoque) fica registrada em `audit_log` automaticamente, via trigger — não depende do código do app lembrar de logar.
