import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useSessionSync } from './features/auth/useSession'
import { LoginPage } from './features/auth/LoginPage'
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

  return (
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
            <Shell>
              <EstoquePage />
            </Shell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reservas"
        element={
          <ProtectedRoute>
            <Shell>{isAdmin || profile?.setor === 'Salão' ? <ReservasPage /> : <Navigate to="/" replace />}</Shell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/fichas-tecnicas"
        element={
          <ProtectedRoute>
            <Shell>
              {isAdmin || profile?.setor === 'Bar' || profile?.setor === 'Cozinha' ? (
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
              {isAdmin || profile?.setor === 'Bar' || profile?.setor === 'Cozinha' ? (
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
            <Shell>
              <MapasPage />
            </Shell>
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
            <Shell>
              <PopsPage />
            </Shell>
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
  )
}
