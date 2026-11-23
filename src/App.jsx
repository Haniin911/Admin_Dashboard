import { useState } from "react";
import AdminLogin from "./Pages/adminlogin";
import AdminDashboard from "./Pages/admindashboard";

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  return isLoggedIn
    ? <AdminDashboard onLogout={() => setIsLoggedIn(false)} />
    : <AdminLogin onLogin={() => setIsLoggedIn(true)} />;
}