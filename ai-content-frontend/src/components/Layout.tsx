import { ReactNode, useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles, LogOut, Home, History, Settings, Sun, Moon } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
  showNav?: boolean;
}

const Layout = ({ children, showNav = false }: LayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";
  const userName = localStorage.getItem("userName") || "";

  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme");
      if (saved) return saved === "dark";
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark((prev) => !prev);
  };

  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("authToken");
    localStorage.removeItem("userName");
    navigate("/");
  };

  const navItems = [
    { path: "/dashboard", label: "Dashboard", icon: Home },
    { path: "/generate", label: "Generate", icon: Sparkles },
    { path: "/history", label: "History", icon: History },
    { path: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background">
      {showNav && isAuthenticated && (
        <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 py-4">
            <div className="flex items-center justify-between">
              <Link to="/dashboard" className="flex items-center gap-2 group">
                <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-accent transition-transform group-hover:scale-105">
                  <Sparkles className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  VibeCraft
                </span>
              </Link>

              <div className="hidden md:flex items-center gap-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link key={item.path} to={item.path}>
                      <Button
                        variant={isActive ? "default" : "ghost"}
                        size="sm"
                        className="gap-2"
                      >
                        <Icon className="w-4 h-4" />
                        {item.label}
                      </Button>
                    </Link>
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={toggleTheme}
                  variant="outline"
                  size="sm"
                  aria-label="Toggle theme"
                  className="px-2.5"
                  title={isDark ? "Switch to Light mode" : "Switch to Dark mode"}
                >
                  {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700 dark:text-slate-300" />}
                </Button>

                {/* Logged-in user avatar chip */}
                {userName && (
                  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-secondary/60 border border-border/60">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
                      <span className="text-[11px] font-bold text-primary-foreground">
                        {userName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="hidden md:block text-sm font-medium text-foreground max-w-[120px] truncate">
                      {userName}
                    </span>
                  </div>
                )}

                <Button onClick={handleLogout} variant="outline" size="sm" className="gap-2">
                  <LogOut className="w-4 h-4" />
                  Logout
                </Button>
              </div>
            </div>

            <div className="md:hidden flex gap-1 mt-3 overflow-x-auto pb-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link key={item.path} to={item.path}>
                    <Button
                      variant={isActive ? "default" : "ghost"}
                      size="sm"
                      className="gap-2 whitespace-nowrap"
                    >
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </Button>
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>
      )}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 py-8 md:py-10">{children}</main>
    </div>
  );
};

export default Layout;
