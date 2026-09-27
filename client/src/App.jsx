import { Navigate, Route, Routes } from 'react-router-dom';
import AuthLayout from './layouts/AuthLayout';
import DashboardLayout from './layouts/DashboardLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Repositories from './pages/Repositories';
import AnalysisResult from './pages/AnalysisResult';
import Analyses from './pages/Analyses';
import Issues from './pages/Issues';
import Security from './pages/Security';
import Tests from './pages/Tests';
import ImpactAnalysis from './pages/ImpactAnalysis';
import AiFixes from './pages/AiFixes';
import PullRequests from './pages/PullRequests';
import SystemHealth from './pages/SystemHealth';
import Settings from './pages/Settings';
import SharedAnalysis from './pages/SharedAnalysis';
import Chat from './pages/Chat';
import Architecture from './pages/Architecture';
import ProtectedRoute from './routes/ProtectedRoute';
import { useAuth } from './hooks/useAuth';

function PublicOnlyRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute><AuthLayout /></PublicOnlyRoute>}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      {/* Public, standalone - no auth required, no dashboard chrome */}
      <Route path="/share/:shareToken" element={<SharedAnalysis />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          {/* OVERVIEW */}
          <Route path="/dashboard" element={<Dashboard />} />

          {/* CODE INTELLIGENCE */}
          <Route path="/dashboard/repositories" element={<Repositories />} />
          <Route
            path="/dashboard/repositories/:repositoryId/analysis"
            element={<AnalysisResult />}
          />
          <Route
            path="/dashboard/repositories/:repositoryId/chat"
            element={<Chat />}
          />
          <Route
            path="/dashboard/repositories/:repositoryId/architecture"
            element={<Architecture />}
          />
          <Route path="/dashboard/analyses" element={<Analyses />} />
          <Route path="/dashboard/architecture" element={<Architecture />} />
          <Route path="/dashboard/chat" element={<Chat />} />

          {/* ENGINEERING */}
          <Route path="/dashboard/issues" element={<Issues />} />
          <Route path="/dashboard/security" element={<Security />} />
          <Route path="/dashboard/tests" element={<Tests />} />
          <Route path="/dashboard/impact" element={<ImpactAnalysis />} />

          {/* AUTOMATION */}
          <Route path="/dashboard/ai-fixes" element={<AiFixes />} />
          <Route path="/dashboard/pull-requests" element={<PullRequests />} />

          {/* SYSTEM */}
          <Route path="/dashboard/system-health" element={<SystemHealth />} />
          <Route path="/dashboard/settings" element={<Settings />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}