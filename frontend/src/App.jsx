import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Shell from './components/layout/Shell.jsx'
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

export default function App() {
  useEffect(() => { warmApi() }, [])

  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Shell />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard"    element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
            <Route path="employees"    element={<ErrorBoundary><Employees /></ErrorBoundary>} />
            <Route path="learning"     element={<ErrorBoundary><Learning /></ErrorBoundary>} />
            <Route path="compliance"   element={<ErrorBoundary><Compliance /></ErrorBoundary>} />
            <Route path="ai-assistant" element={<ErrorBoundary><AIAssistant /></ErrorBoundary>} />
            <Route path="reports"       element={<ErrorBoundary><Reports /></ErrorBoundary>} />
            <Route path="organisation" element={<ErrorBoundary><Organisation /></ErrorBoundary>} />
            <Route path="compensation"  element={<ErrorBoundary><Compensation /></ErrorBoundary>} />
            <Route path="time-absence"  element={<ErrorBoundary><TimeAbsence /></ErrorBoundary>} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  )
}
