import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Shell from './components/layout/Shell.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Employees from './pages/Employees.jsx'
import Learning from './pages/Learning.jsx'
import Compliance from './pages/Compliance.jsx'
import AIAssistant from './pages/AIAssistant.jsx'
import Reports from './pages/Reports.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Shell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"    element={<Dashboard />} />
          <Route path="employees"    element={<Employees />} />
          <Route path="learning"     element={<Learning />} />
          <Route path="compliance"   element={<Compliance />} />
          <Route path="ai-assistant" element={<AIAssistant />} />
          <Route path="reports"      element={<Reports />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
