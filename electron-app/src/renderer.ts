import './index.css';

const loginBtn = document.createElement('button');
loginBtn.textContent = 'Login with Google (WorkOS)';
document.body.appendChild(loginBtn);

loginBtn.addEventListener('click', () => {
  window.electronAPI.login();
});

window.electronAPI.onAuthSuccess((data) => {
  console.log('Auth success:', data);
  console.log('Google Access Token:', data.googleAccessToken);

  const name = data.profile?.first_name
    ? `${data.profile.first_name} ${data.profile.last_name}`
    : data.profile?.email;

  alert(`Welcome, ${name}!\n\nGmail & Calendar access: ${data.googleAccessToken ? 'granted' : 'not granted'}`);
});