import { useState, useEffect, useCallback } from "react";
import Auth from "./components/Auth";
import Board from "./components/Board";

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.user) setUser(data.user);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setAuthLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = useCallback(() => {
    fetch("/api/logout", { method: "POST" }).finally(() => setUser(null));
  }, []);

  if (authLoading) {
    return <div className="auth-loading">Loading...</div>;
  }

  if (!user) {
    return <Auth onSuccess={setUser} />;
  }

  return <Board user={user} onLogout={handleLogout} />;
}
