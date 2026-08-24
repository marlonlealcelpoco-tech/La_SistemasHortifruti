const token = sessionStorage.getItem('la_token');
const session = JSON.parse(sessionStorage.getItem('la_session') || 'null');

if (!token) {
  window.location.href = './login.html';
  throw new Error('Sessão não autenticada.');
}

const items = [...document.querySelectorAll('.menu-item')];
const title = document.getElementById('pageTitle');

function applyRoleVisibility(user) {
  const roles = Array.isArray(user?.roles) ? user.roles : [];

  items.forEach((item) => {
    const allowed = (item.dataset.roles || '').split(',').map((role) => role.trim()).filter(Boolean);
    const visible = allowed.length === 0 || allowed.some((role) => roles.includes(role));
    item.hidden = !visible;
  });

  const active = items.find((item) => !item.hidden && item.classList.contains('active'))
    || items.find((item) => !item.hidden);

  items.forEach((item) => item.classList.remove('active'));
  if (active) {
    active.classList.add('active');
    title.textContent = active.querySelector('span:last-child').textContent;
  }
}

function renderSession(user) {
  sessionStorage.setItem('la_session', JSON.stringify(user));
  document.getElementById('userName').textContent = user.name || 'Usuário';
  document.getElementById('userRole').textContent = Array.isArray(user.roles) && user.roles.length
    ? user.roles.join(' • ')
    : 'Sem perfil informado';
  document.getElementById('avatar').textContent = (user.name || 'US')
    .split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  applyRoleVisibility(user);
}

async function bootstrapSession() {
  try {
    const result = await getCurrentUser();
    renderSession(result.user);
  } catch (error) {
    if (error.status === 401) {
      sessionStorage.removeItem('la_token');
      sessionStorage.removeItem('la_session');
      window.location.href = './login.html';
      return;
    }

    // Mantém a sessão confirmada pelo login caso a API esteja temporariamente indisponível.
    if (session) renderSession(session);
  }
}

items.forEach((item) => item.addEventListener('click', (event) => {
  event.preventDefault();
  if (item.hidden) return;
  items.forEach((element) => element.classList.remove('active'));
  item.classList.add('active');
  title.textContent = item.querySelector('span:last-child').textContent;
  history.replaceState(null, '', `#${item.dataset.module.toLowerCase()}`);
  document.querySelector('.sidebar').classList.remove('hidden');
}));

document.getElementById('logout').onclick = () => {
  sessionStorage.removeItem('la_token');
  sessionStorage.removeItem('la_session');
  window.location.href = './login.html';
};

document.getElementById('mobileMenu').onclick = () => document.querySelector('.sidebar').classList.toggle('hidden');
document.getElementById('currentDate').textContent = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(new Date());

bootstrapSession();
