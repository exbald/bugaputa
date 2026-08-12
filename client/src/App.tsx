import {Routes,Route,Navigate} from "react-router-dom";
import {useAuth} from "./lib/auth";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import ProjectReports from "./pages/ProjectReports";
import ReportDetail from "./pages/ReportDetail";
function Guard({children}:{children:React.ReactNode}){
  const {user,loading}=useAuth();
  if(loading) return <div>Loading...</div>;
  if(!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
function PublicOnly({children}:{children:React.ReactNode}){
  const {user,loading}=useAuth();
  if(loading) return <div>Loading...</div>;
  if(user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
export default function App(){
  return (<Routes><Route path="/" element={<Landing/>} /><Route path="/login" element={<PublicOnly><Login/></PublicOnly>} /><Route path="/register" element={<PublicOnly><Register/></PublicOnly>} /><Route path="/dashboard" element={<Guard><Dashboard/></Guard>} /><Route path="/p/:id" element={<Guard><ProjectReports/></Guard>} /><Route path="/r/:id" element={<Guard><ReportDetail/></Guard>} /><Route path="*" element={<Navigate to="/" replace />} /></Routes>)
}
