import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { LayoutDashboard, PlusCircle, BookOpen, LogOut, Settings, FileText } from 'lucide-react';

const navItems = [
  { to: '/', icon: PlusCircle, label: 'Запись' },
  { to: '/dashboard', icon: LayoutDashboard, label: 'Статистика' },
  { to: '/catalog', icon: BookOpen, label: 'Справочник' },
  { to: '/report', icon: FileText, label: 'Табель' },
  
  { to: '/settings', icon: Settings, label: 'Настройки' },
];

const AppLayout = () => {
  const { signOut } = useAuth();
  const { settings } = useSettings();

  const isLight = settings.widget_theme === 'light';
  const opacity = settings.widget_opacity;
  const themeClass = isLight ? 'widget-theme-light' : '';

  // Header/nav background with user-controlled opacity
  const chromeBase = isLight ? '0, 0%, 100%' : '220, 12%, 14%';
  const chromeBg = `hsla(${chromeBase}, ${opacity * 0.7})`;

  return (
    <div
      className={`min-h-screen flex flex-col ${themeClass}`}
      style={{
        backgroundColor: isLight ? 'hsl(220 10% 92%)' : 'hsl(220 14% 10%)',
        ...(settings.background_url ? {
          backgroundImage: `url(${settings.background_url})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
        } : undefined),
      }}
    >
      {/* Header */}
      <header
        className="border-b border-border backdrop-blur-md px-5 py-4 flex items-center justify-between shrink-0 sticky top-0 z-40"
        style={{ backgroundColor: chromeBg }}
      >
        <h1 className="text-lg font-black tracking-tight text-foreground">
          WORKSHOP<span className="text-primary">TRACKER</span>
        </h1>
        <button
          onClick={signOut}
          className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-xl hover:bg-muted/50"
          title="Выйти"
        >
          <LogOut size={18} />
        </button>
      </header>

      {/* Desktop nav */}
      <nav
        className="hidden md:flex border-b border-border backdrop-blur-sm px-5 gap-1"
        style={{ backgroundColor: `hsla(${chromeBase}, ${opacity * 0.4})` }}
      >
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `px-5 py-3 text-sm font-semibold transition-all border-b-2 flex items-center gap-2 ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-auto pb-24 md:pb-6">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border backdrop-blur-xl flex z-50"
        style={{ backgroundColor: chromeBg }}
      >
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-3 text-xs font-medium transition-all ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`
            }
          >
            <Icon size={20} />
            <span className="mt-1">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Inject widget opacity as inline style on stat-cards via CSS variable */}
      <style>{`
        .stat-card { background: hsla(${isLight ? '0, 0%, 100%' : '220, 12%, 14%'}, ${opacity}) !important; }
        .stat-card-hero { background: hsla(${isLight ? '0, 0%, 100%' : '220, 12%, 14%'}, ${opacity * 0.75}) !important; }
      `}</style>
    </div>
  );
};

export default AppLayout;
