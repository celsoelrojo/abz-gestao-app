-- 0023_pops_select_manager.sql
-- Bug real introduzido na 0020: ao trocar a escrita de POP's pra
-- Gestor-do-setor (igual a Mapas/Fichas), a policy de leitura (pops_select)
-- ficou pra trás — ainda só deixava um não-admin ler POP's com
-- status = 'publicada'. Resultado: um Gestor cria um POP como rascunho, o
-- INSERT funciona, mas o próximo SELECT (lista "Gerenciar") filtra essa
-- linha de volta pra fora, porque ele não é admin e o status não é
-- 'publicada' — o POP "desaparece" pra quem acabou de criá-lo.
--
-- Corrige pra: Gestor do setor vê TODOS os status do próprio setor (precisa
-- editar/publicar rascunho e inativa), igual ao padrão de Mapas
-- (mapas_fluxogramas_select_own_setor, sem filtro de status nenhum).
-- Continua: qualquer outro perfil (Bar/Cozinha/Salão comum) só publicada,
-- do próprio setor ou 'Geral'.
drop policy "pops_select" on public.pops;

create policy "pops_select"
  on public.pops for select
  using (
    public.is_admin()
    or (public.is_setor_manager() and setor = public.user_setor()::text)
    or (status = 'publicada' and (setor = 'Geral' or setor = public.user_setor()::text))
  );
