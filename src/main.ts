import './styles.css';
import { route, startRouter } from './router';
import { auth } from './api';
import { state, setState } from './state';
import { renderNav, updateActiveNav } from './components/nav';
import { loginView, registerView, forgotPasswordView, resetPasswordView, verifyEmailView } from './views/auth';
import { dashboardView } from './views/dashboard';
import { logFoodView } from './views/log-food';
import { recipesView, recipeEditView } from './views/recipes';
import { weightView } from './views/weight';
import { settingsView } from './views/settings';
import { isGuestMode, getGuestUser } from './local-db';

// Auth guard wrapper
function requireUser(viewFn: (params: Record<string, string>) => { html: string; init: () => void }) {
  return (params: Record<string, string>) => {
    if (!state.user) {
      window.location.hash = '#/login';
      return { html: '', init: () => {} };
    }
    const view = viewFn(params);
    return {
      html: view.html + renderNav(),
      init: () => {
        view.init();
        updateActiveNav();
      },
    };
  };
}

// Public routes
route('/login', () => loginView());
route('/register', () => registerView());
route('/forgot-password', () => forgotPasswordView());
route('/reset-password', () => resetPasswordView());
route('/verify-email', () => verifyEmailView());

// Protected routes
route('/', requireUser(() => dashboardView()));
route('/log', requireUser(() => logFoodView()));
route('/recipes', requireUser(() => recipesView()));
route('/recipes/:id', requireUser((params) => recipeEditView(params)));
route('/weight', requireUser(() => weightView()));
route('/settings', requireUser(() => settingsView()));

// Bootstrap: check auth state
async function init() {
  const app = document.getElementById('app')!;
  app.innerHTML = '<div class="loading-screen"><img class="logo-icon" src="/logo.svg" alt="Macro Tracker" /><p>Loading...</p></div>';

  if (isGuestMode()) {
    const user = getGuestUser();
    setState({ user, loading: false });
  } else {
    try {
      const { user } = await auth.me();
      setState({ user, loading: false });
    } catch {
      setState({ user: null, loading: false });
    }
  }

  startRouter();
  window.addEventListener('hashchange', updateActiveNav);
}

init();
