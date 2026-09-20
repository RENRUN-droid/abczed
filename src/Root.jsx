import { useAuth } from './auth/AuthProvider';
import Login from './pages/Login';
import AccessUnavailable from './pages/AccessUnavailable';
import NotConfigured from './pages/NotConfigured';
import LoadingScreen from './components/LoadingScreen';
import App from './App';

export default function Root() {
  const { status, activeCommunity, memberships } = useAuth();

  if (status === 'not-configured') {
    return <NotConfigured />;
  }
  if (status === 'loading-session' || status === 'authenticated-checking-membership') {
    return <LoadingScreen />;
  }
  if (status === 'signed-out') {
    return <Login />;
  }
  if (status === 'authenticated-but-no-access') {
    return <AccessUnavailable />;
  }
  // status === 'authorized'
  return <App activeCommunity={activeCommunity} memberships={memberships} />;
}
