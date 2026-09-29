const API = '/api';

const state = {
    access: localStorage.getItem('playerRecruiterAccess'),
    refresh: localStorage.getItem('playerRecruiterRefresh'),
    user: null,
    sports: []
};

const $ = (id) => document.getElementById(id);

function showAlert(message, type = 'info') {
    const alertBox = $('alert-box');

    alertBox.innerHTML = `
        <div class="app-toast app-toast-${type}" role="alert">
            <div>${escapeHtml(message)}</div>
            <button type="button" class="app-toast-close" aria-label="Close">&times;</button>
        </div>
    `;

    const toast = alertBox.querySelector('.app-toast');
    const closeButton = alertBox.querySelector('.app-toast-close');

    closeButton.addEventListener('click', () => toast.remove());

    setTimeout(() => {
        if (toast.isConnected) {
            toast.classList.add('app-toast-hide');
            setTimeout(() => toast.remove(), 200);
        }
    }, 4000);
}

function getErrorMessage(data, status) {
    if (status === 401) {
        return 'Invalid username or password.';
    }

    if (data.username) {
        const message = Array.isArray(data.username) ? data.username[0] : data.username;
        if (String(message).toLowerCase().includes('already')) {
            return 'Username already taken. Please choose another username.';
        }
        return message;
    }

    if (data.email) {
        const message = Array.isArray(data.email) ? data.email[0] : data.email;
        if (String(message).toLowerCase().includes('already')) {
            return 'Email is already registered.';
        }
        return message;
    }

    if (data.password) {
        return Array.isArray(data.password)
            ? data.password.join(' ')
            : data.password;
    }

    if (data.detail) {
        return data.detail;
    }

    if (data.non_field_errors) {
        return Array.isArray(data.non_field_errors)
            ? data.non_field_errors.join(' ')
            : data.non_field_errors;
    }

    const messages = Object.values(data)
        .flat()
        .filter(Boolean);

    return messages.length ? messages.join(' ') : 'Something went wrong. Please try again.';
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
        throw new Error(getErrorMessage(data, response.status));
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
    $('dashboard-section').classList.add('d-none');
    $('create-section').classList.add('d-none');
    $('menu-btn').classList.remove('d-none');
    $('app-nav-menu').classList.remove('d-none');
    $('user-name').textContent = state.user.username;
    $('dashboard-user-name').textContent = state.user.first_name || state.user.username;

    await loadSports();
    await loadGames();
}

async function loadSports() {
    state.sports = await apiFetch('/sports/');

    const filter = $('filter-sport');
    const gameSport = $('game-sport');
    const editSport = $('edit-game-sport');

    filter.innerHTML = '<option value="">All sports</option>';
    gameSport.innerHTML = '<option value="">Select sport</option>';
    editSport.innerHTML = '<option value="">Select sport</option>';

    state.sports.forEach((sport) => {
        const option = `<option value="${sport.id}">${escapeHtml(sport.name)}</option>`;
        filter.insertAdjacentHTML('beforeend', option);
        gameSport.insertAdjacentHTML('beforeend', option);
        editSport.insertAdjacentHTML('beforeend', option);
    });
}

function gameCard(game) {
    const sportName = game.sport_details?.name === 'Other' && game.custom_sport_name ? game.custom_sport_name : (game.sport_details?.name || 'Sport');
    const statusClass = {OPEN: 'badge-open', FULL: 'badge-full', CANCELLED: 'badge-cancelled', COMPLETED: 'badge-completed'}[game.status] || 'badge-full';

    let actionButtons = `
        <button class="btn btn-outline-secondary btn-sm" onclick="showPlayers(${game.id})">
            Players
        </button>
    `;

    if (game.is_creator) {
        if (game.status !== 'CANCELLED' && game.status !== 'COMPLETED') {
            actionButtons += `
                <button class="btn btn-outline-primary btn-sm" onclick="editGame(${game.id})">
                    Edit
                </button>
                <button class="btn btn-outline-warning btn-sm" onclick="cancelGame(${game.id})">
                    Cancel
                </button>
            `;
        }

        actionButtons += `
            <button class="btn btn-outline-danger btn-sm" onclick="deleteGame(${game.id})">
                Delete
            </button>
        `;
    } else if (game.is_joined) {
        actionButtons += `
            <button class="btn btn-outline-danger btn-sm" onclick="leaveGame(${game.id})">
                Leave
            </button>
        `;
    } else {
        const canJoin = game.status === 'OPEN' && game.available_slots > 0;
        actionButtons += `
            <button class="btn btn-primary btn-sm" onclick="joinGame(${game.id})" ${canJoin ? '' : 'disabled'}>
                ${canJoin ? 'Join game' : 'Not available'}
            </button>
        `;
    }

    return `
        <div class="col-md-6 col-xl-4">
            <div class="card game-card shadow-sm h-100">
                <div class="card-body d-flex flex-column">
                    <div class="d-flex justify-content-between gap-2 mb-2">
                        <h5 class="card-title mb-0">${escapeHtml(game.title)}</h5>
                        <span class="badge ${statusClass}">${escapeHtml(game.status)}</span>
                    </div>
                    <div class="d-flex align-items-center gap-2 mb-2"><span class="game-sport">${escapeHtml(sportName)}</span>${game.is_creator ? '<span class="game-role">Your game</span>' : (game.is_joined ? '<span class="game-role">Joined</span>' : '')}</div>
                    <p class="game-description text-muted mb-3">${escapeHtml(game.description || 'No description provided.')}</p>
                    <div class="game-details mb-3">
                        <div class="game-detail-row"><span class="game-detail-label">Date</span><span>${escapeHtml(game.date)}</span></div>
                        <div class="game-detail-row"><span class="game-detail-label">Time</span><span>${escapeHtml(game.start_time.slice(0, 5))}</span></div>
                        <div class="game-detail-row"><span class="game-detail-label">Location</span><span class="text-break">${escapeHtml(game.location)}</span></div>
                        <div class="game-detail-row"><span class="game-detail-label">Players</span><span>${game.current_players}/${game.players_needed} · ${game.available_slots} slots left</span></div>
                        <div class="game-detail-row"><span class="game-detail-label">Duration</span><span>${game.duration} minutes</span></div>
                    </div>
                    <div class="game-actions d-flex flex-wrap gap-2 mt-auto">
                        ${actionButtons}
                    </div>
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

    const hasFilters = params.toString().length > 0;
    const query = params.toString();
    const games = await apiFetch('/game/' + (query ? '?' + query : ''));

    // The API returns newest games first. With no filters, show the newest
    // games created anywhere in PlayLink. Filters change the result set.
    const recentGames = hasFilters ? games : games.slice(0, 6);

    $('games-list').innerHTML = recentGames.length
        ? recentGames.map(gameCard).join('')
        : '<div class="col-12"><div class="alert alert-light border">No recently added games found for these filters.</div></div>';
}

async function loadJoinedGames() {
    const games = await apiFetch('/game/');
    const joinedGames = games.filter((game) => game.is_joined);

    $('joined-games-list').innerHTML = joinedGames.length
        ? joinedGames.map(gameCard).join('')
        : '<div class="col-12"><div class="dashboard-empty-state">No games joined yet.</div></div>';
}

async function refreshGameViews() {
    await Promise.all([
        loadGames(),
        loadJoinedGames()
    ]);
}

function scrollToCreateGame() {
    document.getElementById('create-game-card')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });

    setTimeout(() => $('game-title')?.focus(), 500);
}

function clearCreateGameError() {
    const box = $('create-game-errors');
    box.classList.add('d-none');
    box.textContent = '';
}

function showCreateGameError(message) {
    const box = $('create-game-errors');
    box.textContent = message;
    box.classList.remove('d-none');
}

async function joinGame(id) {
    try {
        await apiFetch(`/game/${id}/join/`, {
            method: 'POST',
            body: JSON.stringify({})
        });
        showAlert('You joined the game successfully.', 'success');
        await refreshGameViews();
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

async function leaveGame(id) {
    if (!confirm('Leave this game?')) return;

    try {
        await apiFetch(`/game/${id}/leave/`, {
            method: 'POST',
            body: JSON.stringify({})
        });
        showAlert('You left the game successfully.', 'success');
        await refreshGameViews();
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

async function showPlayers(id) {
    try {
        const players = await apiFetch(`/game/${id}/players/`);
        $('players-list').innerHTML = players.length
            ? players.map((player) => `
                <div class="border rounded p-2 mb-2">
                    <strong>${escapeHtml(player.username)}</strong>
                    <div class="text-muted small">
                        ${escapeHtml(
                            [player.first_name, player.last_name].filter(Boolean).join(' ') ||
                            player.email
                        )}
                    </div>
                </div>
            `).join('')
            : '<p class="text-muted mb-0">No players found.</p>';

        $('players-modal-title').textContent = 'Game players';
        bootstrap.Modal.getOrCreateInstance($('players-modal')).show();
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

async function editGame(id) {
    try {
        const game = await apiFetch(`/game/${id}/`);

        $('edit-game-id').value = game.id;
        $('edit-game-title').value = game.title;
        $('edit-game-sport').value = game.sport;
        $('edit-custom-sport').value = game.custom_sport_name || '';
        $('edit-game-date').value = game.date;
        $('edit-game-time').value = game.start_time.slice(0, 5);
        $('edit-game-duration').value = game.duration;
        $('edit-game-players').value = game.players_needed;
        $('edit-game-location').value = game.location;
        $('edit-game-description').value = game.description || '';

        toggleEditCustomSport();

        bootstrap.Modal.getOrCreateInstance($('edit-game-modal')).show();
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

async function saveGameEdit(event) {
    event.preventDefault();

    const id = $('edit-game-id').value;
    const data = {
        sport: Number($('edit-game-sport').value),
        custom_sport_name: $('edit-custom-sport').value,
        title: $('edit-game-title').value,
        description: $('edit-game-description').value,
        date: $('edit-game-date').value,
        start_time: $('edit-game-time').value,
        duration: Number($('edit-game-duration').value),
        location: $('edit-game-location').value,
        players_needed: Number($('edit-game-players').value)
    };

    try {
        await apiFetch(`/game/${id}/edit/`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });

        bootstrap.Modal.getOrCreateInstance($('edit-game-modal')).hide();
        showAlert('Game updated successfully.', 'success');
        await refreshGameViews();
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

async function cancelGame(id) {
    if (!confirm('Cancel this game?')) return;

    try {
        await apiFetch(`/game/${id}/cancel/`, {
            method: 'POST',
            body: JSON.stringify({})
        });
        showAlert('Game cancelled successfully.', 'success');
        await refreshGameViews();
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

async function deleteGame(id) {
    if (!confirm('Delete this game permanently?')) return;

    try {
        await apiFetch(`/game/${id}/delete/`, {
            method: 'DELETE'
        });
        showAlert('Game deleted successfully.', 'success');
        await refreshGameViews();
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

async function createGame(event) {
    event.preventDefault();
    clearCreateGameError();

    const button = $('create-game-btn');
    button.disabled = true;
    button.textContent = 'Creating...';

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
    } catch (error) {
        showCreateGameError(error.message);
        showAlert(error.message, 'danger');
    } finally {
        button.disabled = false;
        button.textContent = 'Create game';
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
    $('dashboard-section').classList.add('d-none');
    $('create-section').classList.add('d-none');
    $('menu-btn').classList.add('d-none');
    $('app-nav-menu').classList.add('d-none');
    $('user-name').textContent = '';
}

function toggleEditCustomSport() {
    const selected = state.sports.find(
        (sport) => String(sport.id) === $('edit-game-sport').value
    );

    $('edit-custom-sport-wrap').classList.toggle(
        'd-none',
        selected?.name !== 'Other'
    );
}

function showRegisterPanel() {
    $('login-panel').classList.add('d-none');
    $('register-panel').classList.remove('d-none');
    $('alert-box').innerHTML = '';
}

function showLoginPanel() {
    $('register-panel').classList.add('d-none');
    $('login-panel').classList.remove('d-none');
    $('alert-box').innerHTML = '';
}



function closePlayLinkMenu() {
    const menu = $('playlink-menu');
    if (menu) {
        bootstrap.Offcanvas.getOrCreateInstance(menu).hide();
    }
}

function showHome() {
    $('app-section').classList.remove('d-none');
    $('dashboard-section').classList.add('d-none');
    $('create-section').classList.add('d-none');
    loadGames().catch((error) => showAlert(error.message, 'danger'));
    closePlayLinkMenu();
}

async function showDashboard() {
    $('app-section').classList.add('d-none');
    $('dashboard-section').classList.remove('d-none');
    $('create-section').classList.add('d-none');

    try {
        await loadJoinedGames();
    } catch (error) {
        showAlert(error.message, 'danger');
    }

    closePlayLinkMenu();
}

function showCreateGamePage() {
    $('app-section').classList.add('d-none');
    $('dashboard-section').classList.add('d-none');
    $('create-section').classList.remove('d-none');
    clearCreateGameError();
    setTimeout(() => $('game-title')?.focus(), 100);
    closePlayLinkMenu();
}

$('navbar-home-link').addEventListener('click', (event) => {
    event.preventDefault();
    showHome();
});

$('nav-home-btn').addEventListener('click', showHome);
$('nav-dashboard-btn').addEventListener('click', showDashboard);
$('nav-create-btn').addEventListener('click', showCreateGamePage);
$('nav-logout-btn').addEventListener('click', logout);

$('show-register-btn').addEventListener('click', showRegisterPanel);
$('show-login-btn').addEventListener('click', showLoginPanel);

$('login-show-password').addEventListener('change', () => {
    $('login-password').type = $('login-show-password').checked ? 'text' : 'password';
});

$('register-show-password').addEventListener('change', () => {
    $('register-password').type = $('register-show-password').checked ? 'text' : 'password';
});

$('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();

    try {
        await login($('login-username').value, $('login-password').value);
        showAlert('Logged in successfully. Welcome back!', 'success');
    } catch (error) {
        showAlert(error.message, 'danger');
    }
});

$('register-form').addEventListener('submit', async (event) => {
    event.preventDefault();

    try {
        await register();
        showAlert('Account created successfully. Welcome to PlayLink!', 'success');
    } catch (error) {
        showAlert(error.message, 'danger');
    }
});

$('game-form').addEventListener('submit', createGame);

const today = new Date().toISOString().split('T')[0];
$('game-date').min = today;
$('edit-game-date').min = today;

$('game-form').addEventListener('input', clearCreateGameError);
$('edit-game-form').addEventListener('submit', saveGameEdit);
$('filter-sport').addEventListener('change', loadGames);
$('filter-date').addEventListener('change', loadGames);
$('filter-status').addEventListener('change', loadGames);


$('google-login-btn')?.addEventListener('click', () => {
    showAlert('Google login is not available yet.', 'info');
});

$('forgot-password-btn')?.addEventListener('click', () => {
    showAlert('Password reset is not available yet. Please contact support.', 'info');
});

$('game-sport').addEventListener('change', () => {
    const selected = state.sports.find(
        (sport) => String(sport.id) === $('game-sport').value
    );

    $('custom-sport-wrap').classList.toggle(
        'd-none',
        selected?.name !== 'Other'
    );
});

$('edit-game-sport').addEventListener('change', toggleEditCustomSport);

if (state.access) {
    loadApp().catch(() => {
        clearTokens();
    });
}