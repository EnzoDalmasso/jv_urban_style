import { AdminPage } from './pages/AdminPage';
import { BookingPage } from './pages/BookingPage';

export default function App() {
  const isAdmin = window.location.pathname.startsWith('/admin');
  return isAdmin ? <AdminPage /> : <BookingPage />;
}
