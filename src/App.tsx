import { Navigate, Route, Routes } from 'react-router-dom'
import { isFreelancer, useAuthStore } from './store/authStore'
import { useSessionSync } from './features/auth/useSession'
import { LoginPage } from './features/auth/LoginPage'
import { ConfirmModal } from './components/ConfirmModal'
import { ProtectedRoute } from './components/ProtectedRoute'
import { TopBar } from './components/TopBar'
import { ChecklistPage } from './features/checklist/ChecklistPage'
import { ContasPage } from './features/contas/ContasPage'
import { PrinterConfigPage } from './features/printing/PrinterConfigPage'
import { EstoquePage } from './features/estoque/EstoquePage'
import { ReservasPage } from './features/reservas/ReservasPage'
import { FichasTecnicasPage } from './features/fichas/FichasTecnicasPage'
import { FichasProducaoPage } from './features/fichas/FichasProducaoPage'
import { MapasPage } from './features/mapas/MapasPage'
import { FreelancerPage } from './features/freelancer/FreelancerPage'
import { PopsPage } from './features/pops/PopsPage'
import { AuditoriaPage } from './features/auditoria/AuditoriaPage'
import { SobreNosPage } from './features/sobrenos/SobreNosPage'
import { HomePage } from './features/home/HomePage'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="view active" style={{ minHeight: '100vh' }}>
      <TopBar />
      {children}
    </div>
  )
}

export default function App() {
  useSessionSync()
  const session = useAuthStore((s) => s.session)
  const profile = useAuthStore((s) => s.profile)
  const isAdmin = profile?.role === 'administrador'
  // Perfil freelancer é restrito por padrão a Checklist + Sobre nós (Home
  // dedicada, ver FreelancerHomePage) — pedido do usuário foi "nada de
  // Estoque, Fichas, Mapas...". As rotas abaixo cobrem a navegação direta
  // por URL; a RLS dessas tabelas ainda enxerga pelo `setor` (não pelo
  // `role`), então isto aqui NÃO é a barreira de segurança de verdade pra
  // quem chamar a API direto — só a UI. Ver nota no resumo desta sessão.
  const freelancer = isFreelancer(profile)

  return (
    <>
    <Routes>
      {/* Login bem-sucedido só atualiza o estado (session) — sem este
          redirecionamento, quem ficasse na URL /login nunca saía de lá
          sozinho depois de autenticar. */}
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Shell>
              <HomePage />
            </Shell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/checklist"
        element={
          <ProtectedRoute>
            <Shell>
              <ChecklistPage />
            </Shell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/contas"
        element={
          <ProtectedRoute>
            <Shell>{isAdmin ? <ContasPage /> : <Navigate to="/" replace />}</Shell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/estoque"
        element={
          <ProtectedRoute>
            <Shell>{!freelancer ? <EstoquePage /> : <Navigate to="/" replace />}</Shell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reservas"
        element={
          <ProtectedRoute>
            <Shell>{(isAdmin || profile?.setor === 'Salão') && !freelancer ? <ReservasPage /> : <Navigate to="/" replace />}</Shell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/fichas-tecnicas"
        element={
          <ProtectedRoute>
            <Shell>
              {(isAdmin || profile?.setor === 'Bar' || profile?.setor === 'Cozinha') && !freelancer ? (
                <FichasTecnicasPage />
              ) : (
                <Navigate to="/" replace />
              )}
            </Shell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/fichas-producao"
        element={
          <ProtectedRoute>
            <Shell>
              {(isAdmin || profile?.setor === 'Bar' || profile?.setor === 'Cozinha') && !freelancer ? (
                <FichasProducaoPage />
              ) : (
                <Navigate to="/" replace />
              )}
            </Shell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/mapas"
        element={
          <ProtectedRoute>
            <Shell>{!freelancer ? <MapasPage /> : <Navigate to="/" replace />}</Shell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/freelancer"
        element={
          <ProtectedRoute>
            <Shell>{isAdmin ? <FreelancerPage /> : <Navigate to="/" replace />}</Shell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/pops"
        element={
          <ProtectedRoute>
            <Shell>{!freelancer ? <PopsPage /> : <Navigate to="/" replace />}</Shell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/auditoria"
        element={
          <ProtectedRoute>
            <Shell>{isAdmin ? <AuditoriaPage /> : <Navigate to="/" replace />}</Shell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/sobre-nos"
        element={
          <ProtectedRoute>
            <Shell>
              <SobreNosPage />
            </Shell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/impressao"
        element={
          <ProtectedRoute>
            <Shell>
              <PrinterConfigPage />
            </Shell>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    <ConfirmModal />
    </>
  )
}
