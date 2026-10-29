import { useState } from 'react'
import { CardapioForm } from './CardapioForm'

export function CardapioAdicionarTab() {
  // `key` remonta o formulário zerado depois de cada cardápio salvo.
  const [formKey, setFormKey] = useState(0)
  const [sucesso, setSucesso] = useState(false)

  return (
    <div style={{ maxWidth: 640 }}>
      <h3 className="page-title" style={{ marginBottom: 4 }}>
        Adicionar cardápio
      </h3>
      <p className="page-subtitle" style={{ marginBottom: 16 }}>
        Cardápio semanal: escolha a semana e, em cada dia, um prato das fichas técnicas da Cozinha — ou deixe "Sem prato neste dia". Cada dia com prato vira a tarefa "Produzir RAF" no Checklist da Cozinha.
      </p>
      {sucesso && <p className="form-success">Cardápio adicionado. Veja em "Visualizar cardápio".</p>}
      <CardapioForm
        key={formKey}
        cardapio={null}
        onSaved={() => {
          setSucesso(true)
          setFormKey((k) => k + 1)
        }}
      />
    </div>
  )
}
