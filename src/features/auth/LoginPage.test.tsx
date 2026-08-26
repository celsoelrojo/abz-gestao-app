import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginPage } from './LoginPage'

const rpcMock = vi.fn()
const signInMock = vi.fn()

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    auth: {
      signInWithPassword: (...args: unknown[]) => signInMock(...args),
    },
  },
}))

describe('LoginPage', () => {
  beforeEach(() => {
    rpcMock.mockReset()
    signInMock.mockReset()
  })

  it('busca o e-mail pelo username e tenta autenticar com a senha digitada', async () => {
    rpcMock.mockResolvedValue({ data: 'admin@abz.local', error: null })
    signInMock.mockResolvedValue({ error: null })

    render(<LoginPage />)
    await userEvent.type(screen.getByLabelText('Usuário'), 'admin')
    await userEvent.type(screen.getByLabelText('Senha'), '142536')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith('email_for_username', { p_username: 'admin' })
      expect(signInMock).toHaveBeenCalledWith({ email: 'admin@abz.local', password: '142536' })
    })
    expect(screen.queryByText('Usuário ou senha inválidos.')).not.toBeInTheDocument()
  })

  it('mostra erro genérico quando o username não existe (sem confirmar se é o usuário ou a senha)', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null })

    render(<LoginPage />)
    await userEvent.type(screen.getByLabelText('Usuário'), 'inexistente')
    await userEvent.type(screen.getByLabelText('Senha'), 'qualquer')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => {
      expect(screen.getByText('Usuário ou senha inválidos.')).toBeInTheDocument()
    })
    expect(signInMock).not.toHaveBeenCalled()
  })

  it('mostra erro genérico quando a senha está errada', async () => {
    rpcMock.mockResolvedValue({ data: 'admin@abz.local', error: null })
    signInMock.mockResolvedValue({ error: { message: 'Invalid login credentials' } })

    render(<LoginPage />)
    await userEvent.type(screen.getByLabelText('Usuário'), 'admin')
    await userEvent.type(screen.getByLabelText('Senha'), 'senha-errada')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => {
      expect(screen.getByText('Usuário ou senha inválidos.')).toBeInTheDocument()
    })
  })
})
