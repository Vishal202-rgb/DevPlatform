// import { Navigate, Route, Routes } from 'react-router-dom';
// import AuthLayout from './layouts/AuthLayout';
// import DashboardLayout from './layouts/DashboardLayout';
// import Login from './pages/Login';
// import Register from './pages/Register';
// import Dashboard from './pages/Dashboard';
// import Repositories from './pages/Repositories';
// import AnalysisResult from './pages/AnalysisResult';
// import PlaceholderPage from './components/PlaceholderPage';
// import ProtectedRoute from './routes/ProtectedRoute';
// import { useAuth } from './hooks/useAuth';

// // Redirects an already-authenticated user away from /login or /register
// function PublicOnlyRoute({ children }) {
//   const { isAuthenticated, isLoading } = useAuth();
//   if (isLoading) return null;
//   if (isAuthenticated) return <Navigate to="/dashboard" replace />;
//   return children;
// }

// export default function App() {
//   return (
//     <Routes>
//       <Route element={<PublicOnlyRoute><AuthLayout /></PublicOnlyRoute>}>
//         <Route path="/login" element={<Login />} />
//         <Route path="/register" element={<Register />} />
//       </Route>

//       <Route element={<ProtectedRoute />}>
//         <Route element={<DashboardLayout />}>
//           <Route path="/dashboard" element={<Dashboard />} />
//           <Route path="/dashboard/repositories" element={<Repositories />} />
//           <Route
//             path="/dashboard/repositories/:repositoryId/analysis"
//             element={<AnalysisResult />}
//           />
//           <Route
//             path="/dashboard/analyses"
//             element={
//               <PlaceholderPage
//                 title="Analyses"
//                 description="A cross-repository analysis history view is coming in a later build. Open a repository's 'View last analysis' link to see its results now."
//               />
//             }
//           />
//           <Route
//             path="/dashboard/issues"
//             element={
//               <PlaceholderPage
//                 title="Issues"
//                 description="Issues detected across your repositories will appear here."
//               />
//             }
//           />
//         </Route>
//       </Route>

//       <Route path="/" element={<Navigate to="/dashboard" replace />} />
//       <Route path="*" element={<Navigate to="/dashboard" replace />} />
//     </Routes>
//   );
// }

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
import SystemHealth from './pages/SystemHealth';
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

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/repositories" element={<Repositories />} />
          <Route
            path="/dashboard/repositories/:repositoryId/analysis"
            element={<AnalysisResult />}
          />
          <Route path="/dashboard/analyses" element={<Analyses />} />
          <Route path="/dashboard/issues" element={<Issues />} />
          <Route path="/dashboard/system-health" element={<SystemHealth />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}