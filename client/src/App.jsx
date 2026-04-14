import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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
import NegotiationRoom from './pages/NegotiationRoom'
import FreelancerBrowse from './pages/FreelancerBrowse'
import FreelancerProfile from './pages/FreelancerProfile'
import ChatRoom from './pages/ChatRoom'
import VerifyHash from './pages/VerifyHash'
import AdminDashboard from './pages/AdminDashboard'

function DashboardRedirect() {
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  if (user.role === 'admin') return <Navigate to="/admin" replace />
  if (user.role === 'freelancer') return <Navigate to="/dashboard/freelancer" replace />
  return <Navigate to="/dashboard/client" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify/:hash" element={<VerifyHash />} />

        {/* Auto-redirect based on role */}
        <Route path="/" element={<ProtectedRoute><DashboardRedirect /></ProtectedRoute>} />

        {/* Onboarding */}
        <Route path="/profile/setup" element={<ProtectedRoute><ProfileSetup /></ProtectedRoute>} />

        {/* Dashboards */}
        <Route path="/dashboard/client" element={<ProtectedRoute role="client"><ClientDashboard /></ProtectedRoute>} />
        <Route path="/dashboard/freelancer" element={<ProtectedRoute role="freelancer"><FreelancerDashboard /></ProtectedRoute>} />

        {/* Jobs */}
        <Route path="/jobs" element={<ProtectedRoute><JobBoard /></ProtectedRoute>} />
        <Route path="/jobs/post" element={<ProtectedRoute role="client"><PostJob /></ProtectedRoute>} />
        <Route path="/jobs/:id" element={<ProtectedRoute><JobDetail /></ProtectedRoute>} />

        {/* Freelancers */}
        <Route path="/freelancers" element={<ProtectedRoute role="client"><FreelancerBrowse /></ProtectedRoute>} />
        <Route path="/freelancers/:userId" element={<ProtectedRoute><FreelancerProfile /></ProtectedRoute>} />

        {/* Contracts & Milestones */}
        <Route path="/contracts/:id" element={<ProtectedRoute><ContractDashboard /></ProtectedRoute>} />

        {/* Negotiations */}
        <Route path="/negotiations/:id" element={<ProtectedRoute><NegotiationRoom /></ProtectedRoute>} />

        {/* Chat & Video */}
        <Route path="/chat/:contractId" element={<ProtectedRoute><ChatRoom /></ProtectedRoute>} />

        {/* Admin */}
        <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
