import { auth } from '../api';
import { state, setState } from '../state';
import { navigate } from '../router';

export function settingsView() {
  const user = state.user!;

  return {
    html: `
      <div class="page">
        <header class="page-header">
          <h1>Settings</h1>
        </header>

        <div class="settings-section">
          <h3>Profile</h3>
          <form id="profile-form">
            <div class="form-group">
              <label for="s-name">First Name</label>
              <input type="text" id="s-name" value="${user.firstName}" />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="s-height-ft">Height (ft)</label>
                <input type="number" id="s-height-ft" value="${Math.floor(user.heightInches / 12)}" min="3" max="8" />
              </div>
              <div class="form-group">
                <label for="s-height-in">Height (in)</label>
                <input type="number" id="s-height-in" value="${user.heightInches % 12}" min="0" max="11" />
              </div>
            </div>
            <div id="profile-msg" class="form-success hidden"></div>
            <button type="submit" class="btn btn-primary btn-block">Save Profile</button>
          </form>
        </div>

        <div class="settings-section">
          <h3>Daily Targets</h3>
          <form id="targets-form">
            <div class="form-row">
              <div class="form-group">
                <label for="s-cal">Calories</label>
                <input type="number" id="s-cal" value="${user.targetCalories}" min="500" max="10000" />
              </div>
              <div class="form-group">
                <label for="s-carbs">Carbs (g)</label>
                <input type="number" id="s-carbs" value="${user.targetCarbsG}" min="0" max="1000" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="s-protein">Protein (g)</label>
                <input type="number" id="s-protein" value="${user.targetProteinG}" min="0" max="1000" />
              </div>
              <div class="form-group">
                <label for="s-fat">Fat (g)</label>
                <input type="number" id="s-fat" value="${user.targetFatG}" min="0" max="500" />
              </div>
            </div>
            <div id="targets-msg" class="form-success hidden"></div>
            <button type="submit" class="btn btn-primary btn-block">Save Targets</button>
          </form>
        </div>

        <div class="settings-section">
          <h3>Change Password</h3>
          <form id="password-form">
            <div class="form-group">
              <label for="s-current-pw">Current Password</label>
              <input type="password" id="s-current-pw" autocomplete="current-password" />
            </div>
            <div class="form-group">
              <label for="s-new-pw">New Password</label>
              <input type="password" id="s-new-pw" minlength="8" autocomplete="new-password" />
            </div>
            <div id="pw-msg" class="hidden"></div>
            <button type="submit" class="btn btn-outline btn-block">Change Password</button>
          </form>
        </div>

        <div class="settings-section">
          <button id="logout-btn" class="btn btn-danger btn-block">Log Out</button>
        </div>
      </div>
    `,
    init: () => {
      // Profile form
      document.getElementById('profile-form')!.addEventListener('submit', async (e) => {
        e.preventDefault();
        const firstName = (document.getElementById('s-name') as HTMLInputElement).value;
        const ft = parseInt((document.getElementById('s-height-ft') as HTMLInputElement).value) || 5;
        const inches = parseInt((document.getElementById('s-height-in') as HTMLInputElement).value) || 0;
        const heightInches = ft * 12 + inches;

        try {
          const { user: updated } = await auth.updateProfile({ firstName, heightInches } as any);
          setState({ user: updated });
          showMsg('profile-msg', 'Profile saved!', 'success');
        } catch (err: any) {
          showMsg('profile-msg', err.message, 'error');
        }
      });

      // Targets form
      document.getElementById('targets-form')!.addEventListener('submit', async (e) => {
        e.preventDefault();
        const targetCalories = parseInt((document.getElementById('s-cal') as HTMLInputElement).value);
        const targetCarbsG = parseInt((document.getElementById('s-carbs') as HTMLInputElement).value);
        const targetProteinG = parseInt((document.getElementById('s-protein') as HTMLInputElement).value);
        const targetFatG = parseInt((document.getElementById('s-fat') as HTMLInputElement).value);

        try {
          const { user: updated } = await auth.updateProfile({ targetCalories, targetCarbsG, targetProteinG, targetFatG } as any);
          setState({ user: updated });
          showMsg('targets-msg', 'Targets saved!', 'success');
        } catch (err: any) {
          showMsg('targets-msg', err.message, 'error');
        }
      });

      // Password form
      document.getElementById('password-form')!.addEventListener('submit', async (e) => {
        e.preventDefault();
        const current = (document.getElementById('s-current-pw') as HTMLInputElement).value;
        const newPw = (document.getElementById('s-new-pw') as HTMLInputElement).value;

        try {
          await auth.changePassword(current, newPw);
          showMsg('pw-msg', 'Password changed!', 'success');
          (document.getElementById('s-current-pw') as HTMLInputElement).value = '';
          (document.getElementById('s-new-pw') as HTMLInputElement).value = '';
        } catch (err: any) {
          showMsg('pw-msg', err.message, 'error');
        }
      });

      // Logout
      document.getElementById('logout-btn')!.addEventListener('click', async () => {
        await auth.logout();
        setState({ user: null });
        navigate('#/login');
      });
    },
  };
}

function showMsg(id: string, text: string, type: 'success' | 'error') {
  const el = document.getElementById(id)!;
  el.textContent = text;
  el.className = type === 'success' ? 'form-success' : 'form-error';
  setTimeout(() => el.classList.add('hidden'), 3000);
}
