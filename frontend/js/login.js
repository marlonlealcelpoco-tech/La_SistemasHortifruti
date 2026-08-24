const form = document.getElementById('loginForm');
const button = document.getElementById('loginButton');
const errorBox = document.getElementById('loginError');

if (sessionStorage.getItem('la_token')) {
  window.location.href = './app-shell.html';
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorBox.hidden = true;
  button.disabled = true;
  button.classList.add('loading');
  button.firstChild.textContent = 'Entrando...';

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  try {
    const result = await login(email, password);
    sessionStorage.setItem('la_token', result.token);
    sessionStorage.setItem('la_session', JSON.stringify(result.user));

    // Confirma a sessão pelo endpoint oficial antes de abrir o ERP.
    const current = await getCurrentUser();
    sessionStorage.setItem('la_session', JSON.stringify(current.user));
    window.location.href = './app-shell.html';
  } catch (error) {
    errorBox.textContent = error.status === 401
      ? 'E-mail ou senha inválidos.'
      : (error.message || 'Não foi possível entrar no sistema.');
    errorBox.hidden = false;
  } finally {
    button.disabled = false;
    button.classList.remove('loading');
    button.firstChild.textContent = 'Entrar ';
  }
});
