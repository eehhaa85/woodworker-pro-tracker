import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { LayoutDashboard, PlusCircle, BookOpen, LogOut } from 'lucide-react';

const navItems = [
  { to: '/', icon: PlusCircle, label: 'Запись' },
  { to: '/dashboard', icon: LayoutDashboard, label: 'Статистика' },
  { to: '/catalog', icon: BookOpen, label: 'Справочник' },
];

const AppLayout = () => {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-3 flex items-center justify-between shrink-0">
        <h1 className="text-lg font-bold font-display text-foreground tracking-tight">
          WORKSHOP<span className="text-primary">TRACKER</span>
        </h1>
        <button
          onClick={signOut}
          className="text-muted-foreground hover:text-foreground transition-colors p-2"
          title="Выйти"
        >
          <LogOut size={18} />
        </button>
      </header>

      {/* Desktop nav */}
      <nav className="hidden md:flex border-b border-border bg-card px-4">
        {navItems.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-auto pb-20 md:pb-4">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-card flex z-50">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-2.5 text-xs transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`
            }
          >
            <Icon size={20} />
            <span className="mt-0.5">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
};

export default AppLayout;
