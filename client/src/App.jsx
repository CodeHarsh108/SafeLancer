import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import ProfileSetup from './pages/ProfileSetup'
import ClientDashboard from './pages/ClientDashboard'
import FreelancerDashboard from './pages/FreelancerDashboard'
import JobBoard from './pages/JobBoard'
import JobDetail from './pages/JobDetail'
import PostJob from './pages/PostJob'
import ContractDashboard from './pages/ContractDashboard'
import FreelancerProfile from './pages/FreelancerProfile'
import FreelancerBrowse from './pages/FreelancerBrowse'
import ClientProfile from './pages/ClientProfile'
import VerifyHash from './pages/VerifyHash'
import AdminDashboard from './pages/AdminDashboard'
import AuthCallback from './pages/AuthCallback'
import GoogleComplete from './pages/GoogleComplete'
import PaymentSettings from './pages/PaymentSettings'
import BannedPage from './pages/BannedPage'

function DashboardRedirect() {
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  if (user.role === 'admin') return <Navigate to="/admin" replace />
  if (user.role === 'freelancer') return <Navigate to="/dashboard/freelancer" replace />
  return <Navigate to="/dashboard/client" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#ffffff',
            color: '#09090b',
            border: '1px solid #e4e4e7',
            borderRadius: '10px',
            fontSize: '13px',
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            padding: '10px 14px',
          },
          success: { iconTheme: { primary: '#10b981', secondary: '#ffffff' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#ffffff' } },
          duration: 3000,
        }}
      />
      <Routes>
        {/* Public */}
        <Route path="/banned" element={<BannedPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify/:hash" element={<VerifyHash />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/auth/google/complete" element={<GoogleComplete />} />

        {/* Auto-redirect based on role */}
        <Route path="/" element={<ProtectedRoute><DashboardRedirect /></ProtectedRoute>} />

        {/* Onboarding */}
        <Route path="/profile/setup" element={<ProtectedRoute><ProfileSetup /></ProtectedRoute>} />
        <Route path="/payments" element={<ProtectedRoute><PaymentSettings /></ProtectedRoute>} />

        {/* Dashboards */}
        <Route path="/dashboard/client" element={<ProtectedRoute role="client"><ClientDashboard /></ProtectedRoute>} />
        <Route path="/dashboard/freelancer" element={<ProtectedRoute role="freelancer"><FreelancerDashboard /></ProtectedRoute>} />

        {/* Jobs */}
        <Route path="/jobs" element={<ProtectedRoute><JobBoard /></ProtectedRoute>} />
        <Route path="/jobs/post" element={<ProtectedRoute role="client"><PostJob /></ProtectedRoute>} />
        <Route path="/jobs/:id" element={<ProtectedRoute><JobDetail /></ProtectedRoute>} />

        {/* Freelancers */}
        <Route path="/freelancers" element={<ProtectedRoute><FreelancerBrowse /></ProtectedRoute>} />
        <Route path="/freelancers/:userId" element={<ProtectedRoute><FreelancerProfile /></ProtectedRoute>} />
        <Route path="/clients/:userId" element={<ProtectedRoute><ClientProfile /></ProtectedRoute>} />

        {/* Contracts & Milestones */}
        <Route path="/contracts/:id" element={<ProtectedRoute><ContractDashboard /></ProtectedRoute>} />


        {/* Admin */}
        <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
