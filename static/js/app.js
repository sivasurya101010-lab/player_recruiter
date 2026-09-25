const API = '/api';

const state = {
    access: localStorage.getItem('playerRecruiterAccess'),
    refresh: localStorage.getItem('playerRecruiterRefresh'),
    user: null,
    sports: []
};

const $ = (id) => document.getElementById(id);

function showAlert(message, type = 'info') {
    $('alert-box').innerHTML = `
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${escapeHtml(message)}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

async function apiFetch(path, options = {}, retry = true) {
    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json');

    if (state.access) {
        headers.set('Authorization', `Bearer ${state.access}`);
    }

    const response = await fetch(API + path, {...options, headers});

    if (response.status === 401 && retry && state.refresh) {
        const refreshResponse = await fetch(API + '/auth/refresh/', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({refresh: state.refresh})
        });

        if (refreshResponse.ok) {
            const data = await refreshResponse.json();
            state.access = data.access;
            localStorage.setItem('playerRecruiterAccess', data.access);
            return apiFetch(path, options, false);
        }
    }

    const text = await response.text();
    let data = {};
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        data = {detail: text};
    }

    if (!response.ok) {
        const message = data.detail || Object.values(data).flat().join(' ') || 'Request failed';
        throw new Error(message);
    }

    return data;
}

function saveTokens(data) {
    state.access = data.access;
    state.refresh = data.refresh;
    localStorage.setItem('playerRecruiterAccess', data.access);
    localStorage.setItem('playerRecruiterRefresh', data.refresh);
}

function clearTokens() {
    state.access = null;
    state.refresh = null;
    state.user = null;
    localStorage.removeItem('playerRecruiterAccess');
    localStorage.removeItem('playerRecruiterRefresh');
}

async function login(username, password) {
    const data = await apiFetch('/auth/login/', {
        method: 'POST',
        body: JSON.stringify({username, password})
    }, false);

    saveTokens(data);
    await loadApp();
}

async function register() {
    const data = {
        username: $('register-username').value,
        email: $('register-email').value,
        first_name: $('register-first-name').value,
        last_name: $('register-last-name').value,
        password: $('register-password').value
    };

    await apiFetch('/auth/register/', {
        method: 'POST',
        body: JSON.stringify(data)
    }, false);

    await login(data.username, data.password);
}

async function loadApp() {
    state.user = await apiFetch('/auth/me/');
    $('auth-section').classList.add('d-none');
    $('app-section').classList.remove('d-none');
    $('logout-btn').classList.remove('d-none');
    $('user-name').textContent = state.user.username;
    $('profile-summary').textContent =
        [state.user.first_name, state.user.last_name].filter(Boolean).join(' ') ||
        state.user.email;

    await loadSports();
    await loadGames();
}

async function loadSports() {
    state.sports = await apiFetch('/sports/');
    const filter = $('filter-sport');
    const gameSport = $('game-sport');

    filter.innerHTML = '<option value="">All sports</option>';
    gameSport.innerHTML = '<option value="">Select sport</option>';

    state.sports.forEach((sport) => {
        const option = `<option value="${sport.id}">${escapeHtml(sport.name)}</option>`;
        filter.insertAdjacentHTML('beforeend', option);
        gameSport.insertAdjacentHTML('beforeend', option);
    });
}

function gameCard(game) {
    const sportName = game.sport_details?.name || 'Sport';
    const statusClass = game.status === 'OPEN' ? 'badge-open' : 'badge-full';
    const canJoin = game.status === 'OPEN' && game.available_slots > 0;

    return `
        <div class="col-md-6 col-xl-4">
            <div class="card game-card shadow-sm h-100">
                <div class="card-body d-flex flex-column">
                    <div class="d-flex justify-content-between gap-2 mb-2">
                        <h5 class="card-title mb-0">${escapeHtml(game.title)}</h5>
                        <span class="badge ${statusClass}">${escapeHtml(game.status)}</span>
                    </div>
                    <p class="text-primary fw-semibold mb-2">${escapeHtml(sportName)}</p>
                    <p class="text-muted mb-3">${escapeHtml(game.description || 'No description')}</p>
                    <div class="game-meta mb-3">
                        <div>📅 ${escapeHtml(game.date)} at ${escapeHtml(game.start_time)}</div>
                        <div>📍 ${escapeHtml(game.location)}</div>
                        <div>👥 ${game.current_players}/${game.players_needed} players · ${game.available_slots} slots left</div>
                        <div>⏱ ${game.duration} minutes</div>
                    </div>
                    <button class="btn btn-outline-primary mt-auto" onclick="joinGame(${game.id})" ${canJoin ? '' : 'disabled'}>
                        ${canJoin ? 'Join game' : 'Not available'}
                    </button>
                </div>
            </div>
        </div>
    `;
}

async function loadGames() {
    const params = new URLSearchParams();

    if ($('filter-sport').value) params.set('sport', $('filter-sport').value);
    if ($('filter-date').value) params.set('date', $('filter-date').value);
    if ($('filter-status').value) params.set('status', $('filter-status').value);

    const query = params.toString();
    const games = await apiFetch('/game/' + (query ? '?' + query : ''));

    $('games-list').innerHTML = games.length
        ? games.map(gameCard).join('')
        : '<div class="col-12"><div class="alert alert-light border">No games found for these filters.</div></div>';
}

async function joinGame(id) {
    try {
        await apiFetch(`/game/${id}/join/`, {
            method: 'POST',
            body: JSON.stringify({})
        });
        showAlert('You joined the game successfully.', 'success');
        await loadGames();
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

async function createGame(event) {
    event.preventDefault();

    const data = {
        sport: Number($('game-sport').value),
        custom_sport_name: $('custom-sport').value,
        title: $('game-title').value,
        description: $('game-description').value,
        date: $('game-date').value,
        start_time: $('game-time').value,
        duration: Number($('game-duration').value),
        location: $('game-location').value,
        players_needed: Number($('game-players').value)
    };

    try {
        await apiFetch('/game/create/', {
            method: 'POST',
            body: JSON.stringify(data)
        });

        showAlert('Game created successfully.', 'success');
        $('game-form').reset();
        $('custom-sport-wrap').classList.add('d-none');
        await loadGames();
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

async function logout() {
    try {
        if (state.refresh) {
            await apiFetch('/auth/logout/', {
                method: 'POST',
                body: JSON.stringify({refresh: state.refresh})
            }, false);
        }
    } catch {
        // Clear local authentication even if the blacklist request fails.
    }

    clearTokens();
    $('auth-section').classList.remove('d-none');
    $('app-section').classList.add('d-none');
    $('logout-btn').classList.add('d-none');
    $('user-name').textContent = '';
}

$('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
        await login($('login-username').value, $('login-password').value);
    } catch (error) {
        showAlert(error.message, 'danger');
    }
});

$('register-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
        await register();
    } catch (error) {
        showAlert(error.message, 'danger');
    }
});

$('game-form').addEventListener('submit', createGame);
$('refresh-btn').addEventListener('click', loadGames);
$('filter-sport').addEventListener('change', loadGames);
$('filter-date').addEventListener('change', loadGames);
$('filter-status').addEventListener('change', loadGames);
$('logout-btn').addEventListener('click', logout);

$('game-sport').addEventListener('change', () => {
    const selected = state.sports.find(
        (sport) => String(sport.id) === $('game-sport').value
    );

    $('custom-sport-wrap').classList.toggle(
        'd-none',
        selected?.name !== 'Other'
    );
});

if (state.access) {
    loadApp().catch(() => {
        clearTokens();
    });
}
