import { Route } from 'react-router-dom';
import { PublicLayout } from '../layouts/PublicLayout';
import { HomePage } from '../pages/HomePage';
import { AboutPage } from '../pages/public/AboutPage';
import { ContactPage } from '../pages/public/ContactPage';
import { HelpPage } from '../pages/public/HelpPage';
import { LoginPage } from '../pages/LoginPage';
import { AdminLoginPage, UnauthorizedPage } from '../pages/AuthPages';
import { RegistrationPage, RegistrationRoleSelect } from '../pages/RegistrationPage';
import { ForgotPasswordPage } from '../pages/public/ForgotPasswordPage';
import { ResetPasswordPage } from '../pages/public/ResetPasswordPage';
import { ROUTES } from './routePaths';

export const publicRoutes = (
  <>
    {/* Public Static & Marketing Pages with Public Layout */}
    <Route element={<PublicLayout />}>
      <Route path={ROUTES.PUBLIC.HOME} element={<HomePage />} />
      <Route path={ROUTES.PUBLIC.ABOUT} element={<AboutPage />} />
      <Route path={ROUTES.PUBLIC.CONTACT} element={<ContactPage />} />
      <Route path={ROUTES.PUBLIC.HELP} element={<HelpPage />} />
    </Route>

    {/* Dedicated Authentication & Onboarding Routes */}
    <Route path={ROUTES.PUBLIC.LOGIN} element={<LoginPage />} />
    <Route path={ROUTES.PUBLIC.ADMIN_LOGIN} element={<AdminLoginPage />} />
    <Route path={ROUTES.PUBLIC.REGISTER} element={<RegistrationRoleSelect />} />
    <Route path={ROUTES.PUBLIC.REGISTER_USER} element={<RegistrationPage kind="user" />} />
    <Route path={ROUTES.PUBLIC.REGISTER_HOSPITAL} element={<RegistrationPage kind="hospital" />} />
    <Route path={ROUTES.PUBLIC.REGISTER_PROVIDER} element={<RegistrationPage kind="ambulance-provider" />} />
    <Route path={ROUTES.PUBLIC.REGISTER_PROVIDER_LEGACY} element={<RegistrationPage kind="ambulance-provider" />} />
    <Route path={ROUTES.PUBLIC.REGISTER_DRIVER} element={<RegistrationPage kind="ambulance-driver" />} />
    <Route path={ROUTES.PUBLIC.REGISTER_DRIVER_LEGACY} element={<RegistrationPage kind="ambulance-driver" />} />
    <Route path={ROUTES.PUBLIC.FORGOT_PASSWORD} element={<ForgotPasswordPage />} />
    <Route path={ROUTES.PUBLIC.RESET_PASSWORD} element={<ResetPasswordPage />} />
    <Route path={ROUTES.PUBLIC.UNAUTHORIZED} element={<UnauthorizedPage />} />
  </>
);
