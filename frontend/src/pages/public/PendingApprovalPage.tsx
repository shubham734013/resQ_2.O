import { Clock, ShieldAlert, LogOut, PhoneCall } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/common/Button';
import { ROUTES } from '../../routes/routePaths';

interface PendingApprovalPageProps {
  status?: 'PENDING' | 'REJECTED' | 'SUSPENDED';
}

export const PendingApprovalPage = ({ status = 'PENDING' }: PendingApprovalPageProps) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const effectiveStatus = user?.accountStatus ?? status;
  const roleName = user?.role ? user.role.replaceAll('_', ' ').toLowerCase() : 'organization';

  const isSuspended = effectiveStatus === 'SUSPENDED';
  const isRejected = effectiveStatus === 'REJECTED';

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate(ROUTES.PUBLIC.LOGIN, { replace: true });
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-900 font-sans">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-xl text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100 text-amber-600 border border-amber-200">
          {isSuspended || isRejected ? (
            <ShieldAlert className="h-8 w-8 text-rose-600" />
          ) : (
            <Clock className="h-8 w-8 text-amber-600 animate-pulse" />
          )}
        </div>

        <h1 className="text-2xl font-black text-slate-950 tracking-tight">
          {isSuspended
            ? 'Account Suspended'
            : isRejected
            ? 'Registration Not Approved'
            : 'Operational Approval Pending'}
        </h1>

        <p className="mt-3 text-sm text-slate-600 leading-relaxed">
          {isSuspended ? (
            <>
              Your {roleName} account has been placed on operational hold by network administration.
              Operational dispatch and patient management features are restricted.
            </>
          ) : isRejected ? (
            <>
              Your {roleName} registration could not be verified with our partner health registry.
              Please reach out to ResQ Governance to submit revised documentation.
            </>
          ) : (
            <>
              Your <strong className="text-slate-900">{user?.name || roleName}</strong> account registration has been received and is currently under compliance review by ResQ State Administrators.
              Operational features will automatically unlock as soon as your medical license and facilities are verified.
            </>
          )}
        </p>

        <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left space-y-2 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Account Email:</span>
            <span className="font-semibold text-slate-900">{user?.email}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Role Requested:</span>
            <span className="font-semibold uppercase tracking-wider text-teal-700">{user?.role}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Review SLA:</span>
            <span className="font-semibold text-slate-900">Standard 2 to 4 Business Hours</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Governance Standard:</span>
            <span className="font-semibold text-slate-900">Ayushman Bharat Digital Mission (ABDM)</span>
          </div>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            variant="secondary"
            onClick={handleLogout}
            icon={<LogOut className="h-4 w-4" />}
            className="w-full sm:w-auto"
          >
            Sign Out
          </Button>

          <Button
            variant="outline"
            onClick={() => navigate(ROUTES.PUBLIC.HELP)}
            icon={<PhoneCall className="h-4 w-4" />}
            className="w-full sm:w-auto"
          >
            Contact Governance Support
          </Button>
        </div>
      </div>
    </main>
  );
};
