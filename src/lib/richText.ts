// Sanitização do HTML produzido pelo RichTextEditor (ver
// components/RichTextEditor.tsx) antes de gravar no banco ou renderizar via
// dangerouslySetInnerHTML — só o Administrador escreve esse conteúdo hoje
// (RLS sobre_nos_secoes_update_admin), mas ele é lido por QUALQUER perfil
// logado, então uma tag/atributo malicioso colado no editor (ex.: <img
// onerror=...>, <script>) não pode sobreviver até a tela de quem só lê.
// Abordagem "unwrap": tag fora da lista permitida perde a tag mas mantém o
// texto de dentro (não apaga o que a pessoa escreveu) — só atributos somem,
// exceto font-size no style de <span>, que é a única formatação que o
// editor realmente produz além de negrito/itálico/sublinhado.
const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'SPAN', 'BR', 'DIV', 'P', 'UL', 'OL', 'LI'])

// contentEditable nunca fica com string vazia de verdade depois que o
// usuário apaga tudo — o navegador deixa um `<br>` (ou `<p><br></p>`) pra
// manter um lugar pro cursor. Sem isso, "Excluir tudo e salvar" mostraria
// uma caixa em branco em vez da mensagem "Nada escrito ainda".
export function isRichTextEmpty(html: string): boolean {
  const template = document.createElement('template')
  template.innerHTML = html
  return !(template.content.textContent ?? '').trim()
}

export function sanitizeRichText(html: string): string {
  const template = document.createElement('template')
  template.innerHTML = html
  sanitizeChildren(template.content)
  return template.innerHTML
}

function sanitizeChildren(root: DocumentFragment) {
  const toUnwrap: Element[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)
  let node = walker.nextNode() as Element | null
  while (node) {
    if (!ALLOWED_TAGS.has(node.tagName)) {
      toUnwrap.push(node)
    } else {
      const fontSize = node.tagName === 'SPAN' ? (node as HTMLElement).style.fontSize : ''
      ;[...node.attributes].forEach((attr) => node!.removeAttribute(attr.name))
      if (fontSize) (node as HTMLElement).style.fontSize = fontSize
    }
    node = walker.nextNode() as Element | null
  }
  // De trás pra frente: desembrulhar um pai antes de um filho não muda a
  // posição do filho na árvore, então a ordem do walker (pai antes de
  // filho) já funciona sem precisar inverter.
  toUnwrap.forEach((el) => {
    const parent = el.parentNode
    if (!parent) return
    while (el.firstChild) parent.insertBefore(el.firstChild, el)
    parent.removeChild(el)
  })
}
