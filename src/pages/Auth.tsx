import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success('Вход выполнен');
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success('Аккаунт создан. Проверьте почту для подтверждения.');
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-black tracking-tight text-foreground">
            WORKSHOP<span className="text-primary">TRACKER</span>
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Трекер доходов и рабочего времени
          </p>
        </div>

        <div className="glass-panel p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label-industrial block mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-industrial w-full"
                placeholder="mail@example.com"
                required
              />
            </div>
            <div>
              <label className="label-industrial block mb-1.5">Пароль</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-industrial w-full"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            <Button type="submit" className="w-full h-14 text-base font-bold rounded-xl shadow-lg shadow-primary/20" disabled={loading}>
              {loading ? '...' : isLogin ? 'Войти' : 'Создать аккаунт'}
            </Button>
          </form>
        </div>

        <button
          onClick={() => setIsLogin(!isLogin)}
          className="mt-5 w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {isLogin ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
        </button>
      </div>
    </div>
  );
};

export default Auth;
