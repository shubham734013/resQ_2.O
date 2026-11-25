import { Route, Routes } from 'react-router-dom';
import { publicRoutes } from './PublicRoutes';
import { userRoutes } from './UserRoutes';
import { hospitalRoutes } from './HospitalRoutes';
import { driverRoutes } from './DriverRoutes';
import { adminRoutes } from './AdminRoutes';
import { compatibilityRedirectRoutes } from './CompatibilityRedirects';
import { NotFoundPage } from '../pages/public/NotFoundPage';

export const AppRouter = () => {
  return (
    <Routes>
      {/* 1. Public Marketing, Auth & Registration Routes */}
      {publicRoutes}

      {/* 2. Backward Compatibility Redirects for Legacy URLs */}
      {compatibilityRedirectRoutes}

      {/* 3. Dedicated User (Citizen) Namespace: /user/* */}
      {userRoutes}

      {/* 4. Dedicated Hospital Command Center Namespace: /hospital/* */}
      {hospitalRoutes}

      {/* 5. Dedicated Paramedic / Ambulance Driver Console Namespace: /driver/* */}
      {driverRoutes}

      {/* 6. Dedicated Administrator & Governance Namespace: /admin/* */}
      {adminRoutes}

      {/* 7. 404 Catch-All Route */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};
