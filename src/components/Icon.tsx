import type { ReactNode } from 'react'

// Ícones minimalistas em linha, portados do protótipo (ICONS em script.js) —
// mesmo traçado geométrico, só convertido de atributos HTML pra JSX. Pedido
// do usuário: mais destaque nos botões de módulo, então stroke-width subiu
// de 1.6 (protótipo) pra 2.2, sem mexer em mais nada (cor/tamanho ficam a
// cargo de .module-icon/.inline-icon em theme.css, via `color` herdado e
// `[data-icon] svg { width: 1em; height: 1em }`).
const STROKE_WIDTH = 2.2

// Ajuste por ícone — pedido do usuário: dobrar o tamanho dos 5 ícones do
// submenu de Estoque. 'estoque-atual' é uma cópia separada de 'estoque' só
// pra isso — dobrar a chave 'estoque' original afetaria também o card
// "Estoque e Compras" da Home, que usa o mesmo ícone.
const OVERRIDES: Partial<Record<string, { strokeWidth?: number; scale?: number }>> = {
  'estoque-atual': { scale: 2 },
  'estoque-entrada': { scale: 2 },
  'estoque-retirada': { scale: 2 },
  'estoque-limites': { scale: 2 },
  'estoque-compras': { scale: 2 },
  'estoque-cadastrar': { scale: 2 },
  // +70% pedido pelo usuário nos ícones do menu principal (Home) — as 11
  // chaves abaixo são usadas só ali, nenhuma é compartilhada com o submenu
  // de Estoque (que já tem sua própria escala acima).
  checklist: { scale: 1.7 },
  estoque: { scale: 1.7 },
  reservas: { scale: 1.7 },
  'fichas-tecnicas': { scale: 1.7 },
  'fichas-producao': { scale: 1.7 },
  pops: { scale: 1.7 },
  // Submenu de Fichas de Produção (mesmo motivo do bloco "estoque-*" acima):
  // cópias dedicadas pra poder dobrar o tamanho só ali, sem afetar o card
  // "Fichas de Produção" da Home, que usa a chave "fichas-producao" original.
  'fichas-producao-hub': { scale: 2 },
  'fichas-producao-calculadora': { scale: 2 },
  'fichas-producao-gerenciar': { scale: 2 },
  mapas: { scale: 1.7 },
  freelancer: { scale: 1.7 },
  accounts: { scale: 1.7 },
  gear: { scale: 1.7 },
  auditoria: { scale: 1.7 },
  'sobre-nos': { scale: 1.7 },
}

const PATHS: Record<string, ReactNode> = {
  checklist: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <path d="M7.5 12.5l3 3 6-6.5" />
    </>
  ),
  estoque: (
    <>
      <path d="M4 8l8-4.5L20 8v8l-8 4.5L4 16Z" />
      <path d="M4 8l8 4.5L20 8" />
      <path d="M12 12.5V21" />
    </>
  ),
  // Cópia idêntica de "estoque" — usada só pela aba "Estoque" do submenu,
  // pra poder dobrar de tamanho (pedido do usuário) sem afetar o card
  // "Estoque e Compras" da Home, que usa a chave "estoque" original.
  'estoque-atual': (
    <>
      <path d="M4 8l8-4.5L20 8v8l-8 4.5L4 16Z" />
      <path d="M4 8l8 4.5L20 8" />
      <path d="M12 12.5V21" />
    </>
  ),
  // Submenu de Estoque e Compras — toda vez que o pedido menciona "caixa",
  // reaproveita a MESMA caixa isométrica do ícone "estoque" acima (hexágono
  // com a linha de "costura" no meio, não um retângulo chapado), só
  // redimensionada pra caber ao lado de setas ou de outra caixa.
  // Entrada: seta descendo até entrar na caixa (antes era o ícone genérico
  // de "upload", com a seta pra cima).
  'estoque-entrada': (
    <>
      <path d="M12 2v7" />
      <path d="M9 6.5l3 3 3-3" />
      <path d="M6.5 14 12 11l5.5 3v5.5l-5.5 3-5.5-3z" />
      <path d="M6.5 14l5.5 3 5.5-3" />
      <path d="M12 17v5.5" />
    </>
  ),
  // Retirada: caixa central com setas saindo dos dois lados (antes era uma
  // caixa com seta única saindo por cima).
  'estoque-retirada': (
    <>
      <path d="M7.6 9.8 12 7.3l4.4 2.5v4.4l-4.4 2.5-4.4-2.5z" />
      <path d="M7.6 9.8l4.4 2.5 4.4-2.5" />
      <path d="M12 12.3v4.4" />
      <path d="M5.5 12H0.5" />
      <path d="M3 9.5 0.5 12l2.5 2.5" />
      <path d="M18.5 12h5" />
      <path d="M21 9.5 23.5 12l-2.5 2.5" />
    </>
  ),
  // Mínimo e Máximo: a mesma caixa isométrica em dois tamanhos, lado a
  // lado, apoiadas na mesma base (antes reaproveitava o ícone de gear).
  'estoque-limites': (
    <>
      <path d="M1 7 6 4l5 3v9l-5 3-5-3z" />
      <path d="M1 7l5 3.5 5-3.5" />
      <path d="M6 10.5v8.5" />
      <path d="M14.5 11 18.5 9l4 2v6l-4 2-4-2z" />
      <path d="M14.5 11l4 2.5 4-2.5" />
      <path d="M18.5 13.5v5.5" />
    </>
  ),
  'estoque-compras': (
    <>
      <path d="M4 6h2l2 11h10l1.7-8H7.2" />
      <circle cx="9.5" cy="20" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="16" cy="20" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  // Cadastrar Produto: a mesma caixa isométrica, menor e deslocada pro canto
  // inferior esquerdo, com um "+" no canto superior direito.
  'estoque-cadastrar': (
    <>
      <path d="M3 13l6-3 6 3v6l-6 3-6-3Z" />
      <path d="M3 13l6 3 6-3" />
      <path d="M9 16v6" />
      <path d="M18 2v7" />
      <path d="M14.5 5.5h7" />
    </>
  ),
  reservas: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </>
  ),
  // Ícones pequenos do submenu de Reservas (pedido do usuário: Agenda / Nova
  // reserva / Concluídas / Capacidade em cima da lista) — mesma agenda-base
  // do ícone "reservas" acima, com uma marca no canto indicando a ação
  // (mesma lógica do "+" em "estoque-cadastrar": forma base + marca = ação).
  // "reservas-agenda" é a cópia lisa, sem marca — mesmo motivo de
  // "estoque-atual": cópia dedicada pra não herdar o scale:1.7 do ícone
  // "reservas" original (usado na Home).
  'reservas-agenda': (
    <>
      <rect x="3" y="5.5" width="14" height="14.5" rx="2" />
      <path d="M3 9.5h14M7 3v4M13 3v4" />
    </>
  ),
  'reservas-nova': (
    <>
      <rect x="3" y="5.5" width="14" height="14.5" rx="2" />
      <path d="M3 9.5h14M7 3v4M13 3v4" />
      <path d="M19 14v6M16 17h6" />
    </>
  ),
  'reservas-concluidas': (
    <>
      <rect x="3" y="5.5" width="14" height="14.5" rx="2" />
      <path d="M3 9.5h14M7 3v4M13 3v4" />
      <path d="M15.5 16l2 2 4-4.5" />
    </>
  ),
  // Capacidade: mesa (círculo) vista de cima com 4 lugares ao redor.
  'reservas-capacidade': (
    <>
      <circle cx="12" cy="12" r="5" />
      <rect x="10.4" y="2.2" width="3.2" height="3.2" rx="0.8" />
      <rect x="10.4" y="18.6" width="3.2" height="3.2" rx="0.8" />
      <rect x="2.2" y="10.4" width="3.2" height="3.2" rx="0.8" />
      <rect x="18.6" y="10.4" width="3.2" height="3.2" rx="0.8" />
    </>
  ),
  // Pedido do usuário: garfo (Cozinha) + taça de martini (Bar) dentro de um
  // círculo, simulando um prato — mesma composição de referência
  // (garfo/colher dentro de um círculo), adaptada pro traço em linha do
  // resto do set (sem badge preenchido) e trocando a colher por uma taça.
  // Primeira versão dessa composição: traço uniforme (2.2, igual aos
  // outros ícones), sem calibragem por elemento nem escala diferente.
  'fichas-tecnicas': (
    <>
      <circle cx="12" cy="12" r="10.5" />
      <path d="M6 6v5M8 6v5M10 6v5" />
      <path d="M6 11h4" />
      <path d="M8 11v8" />
      <path d="M14 6h6l-3 5v6" />
      <path d="M15.5 17h3" />
    </>
  ),
  // Panela (pedido do usuário): corpo com fundo arredondado, duas alças
  // laterais e tampa com puxador.
  'fichas-producao': (
    <>
      <path d="M4.5 10h15" />
      <path d="M5.5 10v5.5a3 3 0 0 0 3 3h7a3 3 0 0 0 3-3V10" />
      <path d="M2.5 9.5h2M19.5 9.5h2" />
      <path d="M12 8.3V5.5" />
      <circle cx="12" cy="4.8" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  pops: (
    <>
      <path d="M6 3.5h9l3 3v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Z" />
      <path d="M9 11h6M9 15h6M9 7h3" />
    </>
  ),
  // Cópia idêntica de "fichas-producao" (a panela) — usada só pelo tile
  // "Fichas de Produção" do submenu do próprio módulo, pra poder dobrar de
  // tamanho (mesmo motivo de "estoque-atual" acima) sem afetar o card da Home.
  'fichas-producao-hub': (
    <>
      <path d="M4.5 10h15" />
      <path d="M5.5 10v5.5a3 3 0 0 0 3 3h7a3 3 0 0 0 3-3V10" />
      <path d="M2.5 9.5h2M19.5 9.5h2" />
      <path d="M12 8.3V5.5" />
      <circle cx="12" cy="4.8" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  // Calculadora de Produção (pedido do usuário: submódulo próprio, separado
  // da ficha): corpo + visor + grade de botões, no mesmo traço em linha do
  // resto do set.
  'fichas-producao-calculadora': (
    <>
      <rect x="5" y="2.5" width="14" height="19" rx="2.2" />
      <rect x="7.2" y="5" width="9.6" height="3.4" rx="0.8" />
      <circle cx="8.6" cy="13" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="13" r="1" fill="currentColor" stroke="none" />
      <circle cx="15.4" cy="13" r="1" fill="currentColor" stroke="none" />
      <circle cx="8.6" cy="17.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="17.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="15.4" cy="17.5" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  // Gerenciar Fichas de Produção: prancheta (cadastro/edição) com um lápis
  // no canto — mesma lógica do "+" em "estoque-cadastrar" (forma base +
  // marca no canto indicando a ação de editar).
  'fichas-producao-gerenciar': (
    <>
      <path d="M7.5 5h7a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h2Z" />
      <path d="M9 3.5h4a1 1 0 0 1 1 1V6H8V4.5a1 1 0 0 1 1-1Z" />
      <path d="M8 11h5M8 14.5h5" />
      <path d="M16 15l3.3-3.3 1.6 1.6L17.6 16.6H16z" />
    </>
  ),
  mapas: (
    <>
      <path d="M9 4 4 6v14l5-2 6 2 5-2V4l-5 2-6-2Z" />
      <path d="M9 4v14M15 6v14" />
    </>
  ),
  freelancer: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c.7-3 3-4.5 5.5-4.5s4.8 1.5 5.5 4.5" />
      <path d="M16 4.5c1.4.4 2.4 1.7 2.4 3.2s-1 2.8-2.4 3.2M18.5 14.8c1.6.6 2.7 1.9 3.1 4.2" />
    </>
  ),
  // Ícones pequenos do submenu de Freelancer (pedido do usuário: Cadastro /
  // Escala acima da lista) — mesma lógica de marca-no-canto de
  // "reservas-nova"/"estoque-cadastrar": a silhueta única de "freelancer"
  // (sem a segunda pessoa menor, que só faz sentido no tile grande da Home)
  // com um "+" indicando cadastro.
  'freelancer-cadastro': (
    <>
      <circle cx="9" cy="9" r="3.4" />
      <path d="M3 19c.8-3.3 3.3-5 6-5s5.2 1.7 6 5" />
      <path d="M19 3v6" />
      <path d="M16 6h6" />
    </>
  ),
  // Escala: mesma agenda-base de "reservas-agenda", com duas linhas dentro
  // sugerindo os turnos listados.
  'freelancer-escala': (
    <>
      <rect x="3" y="5.5" width="14" height="14.5" rx="2" />
      <path d="M3 9.5h14M7 3v4M13 3v4" />
      <path d="M6.5 14h3M6.5 17h5" />
    </>
  ),
  // Nova Escala: mesma agenda-base, com o "+" no canto em vez das linhas de
  // turno — mesmo par visual de "reservas-agenda"/"reservas-nova".
  'freelancer-nova-escala': (
    <>
      <rect x="3" y="5.5" width="14" height="14.5" rx="2" />
      <path d="M3 9.5h14M7 3v4M13 3v4" />
      <path d="M19 14v6M16 17h6" />
    </>
  ),
  accounts: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.2" />
      <circle cx="8.5" cy="11" r="2.1" />
      <path d="M5.3 16c.6-1.8 2-2.6 3.2-2.6s2.6.8 3.2 2.6" />
      <path d="M14 9.5h4.2M14 13h4.2" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.2M12 18.8V21M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M3 12h2.2M18.8 12H21M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
    </>
  ),
  // Reaproveita o desenho de "clock" do protótipo — não existia um ícone de
  // auditoria lá (módulo novo desta app), e "histórico no tempo" é a leitura
  // mais direta pro mesmo traço minimalista.
  auditoria: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  // "Sobre nós": livro aberto (história/cultura/manual do time), duas
  // páginas se encontrando na lombada central.
  'sobre-nos': (
    <>
      <path d="M12 5.5c-1.8-1.3-4-2-6-2v13c2 0 4.2.7 6 2 1.8-1.3 4-2 6-2V3.5c-2 0-4.2.7-6 2Z" />
      <path d="M12 5.5v13" />
    </>
  ),
}

export type IconName = keyof typeof PATHS

export function Icon({ name, className }: { name: IconName; className?: string }) {
  const override = OVERRIDES[name]
  return (
    <span className={className} data-icon={name}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={override?.strokeWidth ?? STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={override?.scale ? { width: `${override.scale}em`, height: `${override.scale}em` } : undefined}
      >
        {PATHS[name]}
      </svg>
    </span>
  )
}
