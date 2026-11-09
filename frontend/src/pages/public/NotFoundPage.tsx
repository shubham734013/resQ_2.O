import { Compass, Home, LifeBuoy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getRoleHome, ROUTES } from '../../routes/routePaths';
import { Button } from '../../components/common/Button';

export const NotFoundPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const homeTarget = getRoleHome(user?.role);

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-900 font-sans">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 sm:p-10 shadow-xl text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-800 border border-slate-200">
          <Compass className="h-8 w-8 text-teal-600 animate-spin" style={{ animationDuration: '8s' }} />
        </div>

        <p className="text-xs font-bold uppercase tracking-wider text-teal-700">HTTP 404</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950 tracking-tight">Route Not Found</h1>
        <p className="mt-3 text-sm text-slate-600 leading-relaxed">
          The requested operational resource or URL does not exist or has been relocated to its dedicated role namespace.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            variant="primary"
            onClick={() => navigate(homeTarget)}
            icon={<Home className="h-4 w-4" />}
            className="w-full sm:w-auto"
          >
            Go to Your Dashboard
          </Button>

          <Button
            variant="outline"
            onClick={() => navigate(ROUTES.PUBLIC.HELP)}
            icon={<LifeBuoy className="h-4 w-4" />}
            className="w-full sm:w-auto"
          >
            Visit Help Center
          </Button>
        </div>
      </div>
    </main>
  );
};
