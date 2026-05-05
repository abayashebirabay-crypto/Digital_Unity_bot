import React from 'react';
import AdminPanel from './pages/AdminPanel';
import Home from './pages/Home';
import WalletPage from './pages/WalletPage';

function App() {
  // Get Telegram user data
  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
  }

  // Get user ID from URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  const urlUserId = urlParams.get('user_id');
  const telegramUser = tg?.initDataUnsafe?.user;

  let userId = null;
  if (urlUserId) {
    userId = parseInt(urlUserId);
    console.log('✅ Using user_id from URL:', userId);
  } else if (telegramUser?.id) {
    userId = telegramUser.id;
    console.log('✅ Using user_id from Telegram:', userId);
  } else {
    userId = 1296141395;
    console.log('⚠️ Using default user_id:', userId);
  }

  const ADMIN_ID = 1296141395;
  const isAdmin = userId === ADMIN_ID;
  const path = window.location.pathname;
  const showAdmin = path === '/admin' && isAdmin;
  const showWallet = path === '/wallet';

  if (showAdmin) {
    return <AdminPanel />;
  }

  if (showWallet) {
    return <WalletPage userId={userId} />;
  }

  return <Home userId={userId} isAdmin={isAdmin} />;
}

export default App;