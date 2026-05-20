import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx'
import { LanguageProvider } from './contexts/LanguageContext.jsx'
import Shell from './components/layout/Shell.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Employees from './pages/Employees.jsx'
import Learning from './pages/Learning.jsx'
import Compliance from './pages/Compliance.jsx'
import AIAssistant from './pages/AIAssistant.jsx'
import Reports from './pages/Reports.jsx'
import Organisation from './pages/Organisation.jsx'
import Compensation from './pages/Compensation.jsx'
import TimeAbsence from './pages/TimeAbsence.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { ToastProvider } from './components/ui/Toaster.jsx'
import { warmApi } from './services/api.js'

function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

function AppRoutes() {
  const { isAuthenticated } = useAuth()
  useEffect(() => { warmApi() }, [])

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />}
      />
      <Route path="/" element={<PrivateRoute><Shell /></PrivateRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"    element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
        <Route path="employees"    element={<ErrorBoundary><Employees /></ErrorBoundary>} />
        <Route path="learning"     element={<ErrorBoundary><Learning /></ErrorBoundary>} />
        <Route path="compliance"   element={<ErrorBoundary><Compliance /></ErrorBoundary>} />
        <Route path="ai-assistant" element={<ErrorBoundary><AIAssistant /></ErrorBoundary>} />
        <Route path="reports"      element={<ErrorBoundary><Reports /></ErrorBoundary>} />
        <Route path="organisation" element={<ErrorBoundary><Organisation /></ErrorBoundary>} />
        <Route path="compensation" element={<ErrorBoundary><Compensation /></ErrorBoundary>} />
        <Route path="time-absence" element={<ErrorBoundary><TimeAbsence /></ErrorBoundary>} />
      </Route>
      <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <ToastProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </ToastProvider>
      </LanguageProvider>
    </AuthProvider>
  )
}
