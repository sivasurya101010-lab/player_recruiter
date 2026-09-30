const API = `${window.location.origin}/api`;

var state = {
    access: localStorage.getItem('playerRecruiterAccess'),
    refresh: localStorage.getItem('playerRecruiterRefresh'),
    user: null,
    profile: null,
    sports: [],
    exploreSport: '',
    exploreGames: [],
    showAllExploreGames: false
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

function getProfilePictureUrl(value) {
    if (!value) return '';

    const raw = String(value).trim();
    if (!raw) return '';

    // Django can return either an absolute media URL or the stored ImageField path.
    if (/^https?:\\/\\//i.test(raw)) {
        return raw;
    }

    if (raw.startsWith('/media/')) {
        return raw;
    }

    if (raw.startsWith('media/')) {
        return '/' + raw;
    }

    if (raw.startsWith('/profile_picture/')) {
        return '/media' + raw;
    }

    if (raw.startsWith('profile_picture/')) {
        return '/media/' + raw;
    }

    return raw;
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
    if (!options.isFormData) {
        headers.set('Content-Type', 'application/json');
    }

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

            // Keep the newest refresh token if the server rotates refresh
            // tokens in the future.
            if (data.refresh) {
                state.refresh = data.refresh;
                localStorage.setItem('playerRecruiterRefresh', data.refresh);
            }

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
    state.profile = null;
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

    // Load the Home data before displaying the Home page. Previously the
    // page became visible while games were still loading, which could leave
    // the game area blank until the user clicked Home from the menu.
    const results = await Promise.allSettled([
        loadSports(),
        loadGames()
    ]);

    $('session-loading').classList.add('d-none');
    $('auth-section').classList.add('d-none');
    $('app-section').classList.remove('d-none');
    $('dashboard-section').classList.add('d-none');
    $('create-section').classList.add('d-none');
    $('profile-section').classList.add('d-none');
    $('menu-btn').classList.remove('d-none');
    $('app-nav-menu').classList.remove('d-none');
    $('dashboard-user-name').textContent = state.user.first_name || state.user.username;
    renderNavProfile(state.user);
    updateFilterButton();

    if (results[0].status === 'rejected') {
        showAlert(results[0].reason?.message || 'Could not load sports.', 'danger');
    }

    if (results[1].status === 'rejected') {
        showAlert(results[1].reason?.message || 'Could not load recently added games.', 'danger');
    }
}

async function restoreSession() {
    if (!state.access && !state.refresh) {
        showLoginPanel();
        return;
    }

    $('session-loading').classList.remove('d-none');
    $('auth-section').classList.add('d-none');

    if (!state.refresh) {
        try {
            await loadApp();
            return;
        } catch (error) {
            console.error('PlayLink session restore failed:', error);
            clearTokens();
            showLoginPanel();
            showAlert('Your saved login session has expired. Please log in again.', 'danger');
            return;
        }
    }

    try {
        const refreshResponse = await fetch(API + '/auth/refresh/', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({refresh: state.refresh}),
            cache: 'no-store'
        });

        if (!refreshResponse.ok) {
            console.error('PlayLink refresh request failed:', refreshResponse.status);
            clearTokens();
            showLoginPanel();
            showAlert('Your saved login session has expired. Please log in again.', 'danger');
            return;
        }

        const data = await refreshResponse.json();

        if (!data.access) {
            throw new Error('Refresh response did not contain an access token.');
        }

        state.access = data.access;
        localStorage.setItem('playerRecruiterAccess', data.access);

        if (data.refresh) {
            state.refresh = data.refresh;
            localStorage.setItem('playerRecruiterRefresh', data.refresh);
        }

        await loadApp();
    } catch (error) {
        console.error('PlayLink session restore error:', error);
        $('session-loading').classList.add('d-none');
        showLoginPanel();

        if (error instanceof TypeError) {
            showAlert(
                'PlayLink could not reach the server. Check the browser address and make sure Django is running on the same address.',
                'danger'
            );
            return;
        }

        showAlert('PlayLink could not restore your session. Please try again.', 'danger');
    }
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

function renderExploreSportTabs() {
    const tabs = $('explore-sport-tabs');
    if (!tabs) return;

    const allTabs = [
        {id: '', name: 'All games'},
        ...state.sports.map((sport) => ({id: String(sport.id), name: sport.name}))
    ];

    tabs.innerHTML = allTabs.map((sport) => `
        <button
            type="button"
            class="explore-sport-tab ${state.exploreSport === sport.id ? 'active' : ''}"
            data-sport-id="${escapeHtml(sport.id)}"
            role="tab"
            aria-selected="${state.exploreSport === sport.id}"
        >
            ${escapeHtml(sport.name)}
        </button>
    `).join('');

    tabs.querySelectorAll('.explore-sport-tab').forEach((tab) => {
        tab.addEventListener('click', () => {
            state.exploreSport = tab.dataset.sportId || '';
            state.showAllExploreGames = false;
            const filterSport = $('filter-sport');
            if (filterSport) filterSport.value = state.exploreSport;
            updateFilterButton();
            loadGames().catch((error) => showAlert(error.message, 'danger'));
        });
    });
}

function formatGameDate(date) {
    if (!date) return 'Date not set';

    const parts = date.split('-');
    if (parts.length !== 3) return date;

    return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function formatCreatedAt(value) {
    if (!value) return 'Not available';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString([], {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getCreatorName(creator) {
    return [creator?.first_name, creator?.last_name]
        .filter(Boolean)
        .join(' ') || creator?.username || 'Unknown player';
}

function getGameSportName(game) {
    return game.sport_details?.name === 'Other' && game.custom_sport_name
        ? game.custom_sport_name
        : (game.sport_details?.name || 'Sport');
}

function getGameStatusClass(status) {
    return {
        OPEN: 'badge-open',
        FULL: 'badge-full',
        CANCELLED: 'badge-cancelled',
        COMPLETED: 'badge-completed'
    }[status] || 'badge-full';
}

function exploreGameCard(game) {
    const sportName = getGameSportName(game);
    const statusClass = getGameStatusClass(game.status);
    const date = formatGameDate(game.date);
    const time = game.start_time ? game.start_time.slice(0, 5) : 'Time not set';

    let primaryAction = '';
    if (game.is_creator) {
        primaryAction = `
            <button class="btn btn-outline-primary btn-sm game-card-action" onclick="event.stopPropagation(); editGame(${game.id})">
                Manage
            </button>
        `;
    } else if (game.is_joined) {
        primaryAction = `
            <button class="btn btn-outline-danger btn-sm game-card-action" onclick="event.stopPropagation(); leaveGame(${game.id})">
                Leave
            </button>
        `;
    } else {
        const canJoin = game.status === 'OPEN' && game.available_slots > 0;
        primaryAction = `
            <button class="btn btn-primary btn-sm game-card-action" onclick="event.stopPropagation(); joinGame(${game.id})" ${canJoin ? '' : 'disabled'}>
                ${canJoin ? 'Join game' : 'Not available'}
            </button>
        `;
    }

    return `
        <article class="explore-game-card" onclick="showGameDetails(${game.id})" onkeydown="handleGameCardKeydown(event, ${game.id})" tabindex="0" role="button" aria-label="View details for ${escapeHtml(game.title)}">
            <div class="explore-game-visual">
                <span class="explore-game-sport-label">${escapeHtml(sportName)}</span>
                <span class="explore-game-status ${statusClass}">${escapeHtml(game.status)}</span>
            </div>
            <div class="explore-game-body">
                <h3 class="explore-game-title" title="${escapeHtml(game.title)}">
                    ${escapeHtml(game.title)}
                </h3>

                <div class="explore-game-meta explore-game-card-details">
                    <span title="Ground">📍 ${escapeHtml(game.location || 'Ground not set')}</span>
                    <span title="Date">📅 ${escapeHtml(date)}</span>
                    <span title="Time">🕒 ${escapeHtml(time)}</span>
                </div>

                <div class="explore-game-actions">
                    ${primaryAction}
                    <button
                        class="explore-game-arrow game-card-action"
                        type="button"
                        onclick="event.stopPropagation(); showGameDetails(${game.id})"
                        aria-label="View game details"
                        title="View game details"
                    >
                        →
                    </button>
                </div>
            </div>
        </article>
    `;
}

function handleGameCardKeydown(event, id) {
    if (event.target !== event.currentTarget) return;

    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        showGameDetails(id);
    }
}

function getGameDetailsAction(game) {
    if (game.is_creator) {
        return `
            <button type="button" class="btn btn-primary" onclick="editGame(${game.id})">
                Manage game
            </button>
        `;
    }

    if (game.is_joined) {
        return `
            <button type="button" class="btn btn-outline-danger" onclick="leaveGame(${game.id})">
                Leave game
            </button>
        `;
    }

    const canJoin = game.status === 'OPEN' && game.available_slots > 0;
    return `
        <button type="button" class="btn btn-primary" onclick="joinGame(${game.id})" ${canJoin ? '' : 'disabled'}>
            ${canJoin ? 'Join game' : 'Game unavailable'}
        </button>
    `;
}

async function showGameDetails(id) {
    try {
        const game = await apiFetch(`/game/${id}/`);
        const creator = game.creator || {};
        const creatorName = getCreatorName(creator);
        const creatorUsername = creator.username ? `@${creator.username}` : 'Game creator';
        const sportName = getGameSportName(game);
        const date = formatGameDate(game.date);
        const time = game.start_time ? game.start_time.slice(0, 5) : 'Not set';
        const currentPlayers = game.current_players || 0;
        const playersNeeded = game.players_needed || 0;
        const availableSlots = game.available_slots ?? Math.max(0, playersNeeded - currentPlayers);
        const creatorInitial = creatorName.charAt(0).toUpperCase() || '?';

        $('game-details-title').textContent = game.title || 'Game details';
        $('game-details-sport').textContent = sportName;
        $('game-details-status').textContent = game.status || 'UNKNOWN';
        $('game-details-status').className = `game-details-modal-status ${getGameStatusClass(game.status)}`;

        $('game-details-location').textContent = game.location || 'Ground / place not set';
        $('game-details-date').textContent = date;
        $('game-details-time').textContent = time;

        $('game-details-description').textContent =
            game.description || 'No description was added for this game.';

        const details = [
            ['Duration', game.duration ? `${game.duration} minutes` : 'Not set'],
            ['Players', `${currentPlayers} / ${playersNeeded}`],
            ['Available slots', String(availableSlots)],
            ['Status', game.status || 'Not set']
        ];

        $('game-details-list').innerHTML = details.map(([label, value]) => `
            <div class="game-detail-modal-row">
                <span class="game-detail-modal-label">${escapeHtml(label)}</span>
                <span>${escapeHtml(value)}</span>
            </div>
        `).join('');

        $('game-details-creator-avatar').textContent = creatorInitial;
        $('game-details-creator-name').textContent = creatorName;
        $('game-details-creator-username').textContent = creatorUsername;
        $('game-details-created-at').textContent = formatCreatedAt(game.created_at);

        $('game-details-action').innerHTML = getGameDetailsAction(game);

        $('game-details-players-btn').onclick = () => showPlayers(game.id);

        bootstrap.Modal.getOrCreateInstance($('game-details-modal')).show();
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

function renderExploreGames(games) {
    const list = $('games-list');
    const moreButton = $('see-more-games-btn');
    if (!list) return;

    const filteredGames = state.exploreSport
        ? games.filter((game) => String(game.sport) === String(state.exploreSport))
        : games;
    const visibleGames = state.showAllExploreGames
        ? filteredGames
        : filteredGames.slice(0, 6);

    list.innerHTML = visibleGames.length
        ? visibleGames.map(exploreGameCard).join('')
        : '<div class="explore-games-empty">No games found for this sport and filter.</div>';

    if (moreButton) {
        const canShowMore = filteredGames.length > 6;
        moreButton.classList.toggle('d-none', !canShowMore);
        moreButton.innerHTML = state.showAllExploreGames
            ? 'Show fewer games <span aria-hidden="true">↑</span>'
            : 'See more games <span aria-hidden="true">→</span>';
    }
}

function updateFilterButton() {
    const button = $('filter-toggle-btn');
    const count = $('filter-count');
    if (!button || !count) return;

    const activeFilters = [
        $('filter-sport')?.value,
        $('filter-date')?.value,
        $('filter-status')?.value
    ].filter(Boolean).length;

    count.textContent = String(activeFilters);
    count.classList.toggle('d-none', activeFilters === 0);
}

function closeFilterDropdown() {
    const menu = $('filter-toggle-btn');
    if (!menu || !window.bootstrap) return;
    bootstrap.Dropdown.getOrCreateInstance(menu).hide();
}

async function applyFilters() {
    try {
        await loadGames();
        closeFilterDropdown();
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

async function clearFilters() {
    $('filter-sport').value = '';
    $('filter-date').value = '';
    $('filter-status').value = '';
    state.exploreSport = '';
    state.showAllExploreGames = false;
    updateFilterButton();

    try {
        await loadGames();
        closeFilterDropdown();
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

async function loadGames() {
    const params = new URLSearchParams();

    if ($('filter-sport').value) params.set('sport', $('filter-sport').value);
    if ($('filter-date').value) params.set('date', $('filter-date').value);
    if ($('filter-status').value) params.set('status', $('filter-status').value);

    const query = params.toString();
    const gamesResponse = await apiFetch('/game/' + (query ? '?' + query : ''));
    const games = Array.isArray(gamesResponse) ? gamesResponse : (gamesResponse.results || []);

    state.exploreGames = games;
    state.showAllExploreGames = false;
    state.exploreSport = $('filter-sport').value || '';

    renderExploreSportTabs();
    renderExploreGames(games);
}

async function loadJoinedGames() {
    const gamesResponse = await apiFetch('/game/');
    const games = Array.isArray(gamesResponse) ? gamesResponse : (gamesResponse.results || []);
    const joinedGames = games.filter((game) => game.is_joined);
    const hostedGames = games.filter((game) => game.is_creator);
    const today = new Date().toISOString().split('T')[0];
    const upcomingGames = joinedGames.filter((game) =>
        game.date >= today &&
        game.status !== 'CANCELLED' &&
        game.status !== 'COMPLETED'
    );

    $('dashboard-joined-count').textContent = joinedGames.length;
    $('dashboard-upcoming-count').textContent = upcomingGames.length;
    $('dashboard-hosted-count').textContent = hostedGames.length;

    $('joined-games-list').innerHTML = joinedGames.length
        ? joinedGames.map((game) => `
            <div class="dashboard-game-card">
                ${exploreGameCard(game)}
            </div>
        `).join('')
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
        const [players, game] = await Promise.all([
            apiFetch(`/game/${id}/players/`),
            apiFetch(`/game/${id}/`)
        ]);

        $('players-modal-title').textContent = game.title || 'Game players';
        $('players-modal-count').textContent =
            `${players.length} player${players.length === 1 ? '' : 's'} joined`;

        $('players-list').innerHTML = players.length
            ? players.map((player) => {
                const name = getCreatorName(player);
                const initials = name
                    .split(/\\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part.charAt(0).toUpperCase())
                    .join('') || '?';

                const isCreator = player.id === game.creator?.id;
                const location = player.location || 'Location not added';
                const bio = player.bio || 'No bio added yet.';
                const profilePicture = player.profile_picture
                    ? `<img src="${escapeHtml(getProfilePictureUrl(player.profile_picture))}" alt="" class="players-modal-avatar-image">`
                    : `<span>${escapeHtml(initials)}</span>`;

                return `
                    <article class="players-modal-card">
                        <div class="players-modal-avatar">
                            ${profilePicture}
                        </div>

                        <div class="players-modal-player-info">
                            <div class="players-modal-name-row">
                                <strong>${escapeHtml(name)}</strong>
                                ${isCreator ? '<span class="players-modal-creator-badge">Creator</span>' : ''}
                            </div>

                            <span class="players-modal-username">
                                @${escapeHtml(player.username || 'player')}
                            </span>

                            <div class="players-modal-location">
                                <span>📍</span>
                                <span>${escapeHtml(location)}</span>
                            </div>

                            <p class="players-modal-bio">${escapeHtml(bio)}</p>
                        </div>
                    </article>
                `;
            }).join('')
            : `
                <div class="players-modal-empty">
                    <div class="players-modal-empty-icon">👥</div>
                    <strong>No players have joined yet</strong>
                    <span>Be the first player to join this game.</span>
                </div>
            `;

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
    button.innerHTML = 'Creating...';

    const data = {
        sport: Number($('game-sport').value),
        title: $('game-title').value.trim(),
        description: $('game-description').value.trim(),
        date: $('game-date').value,
        start_time: $('game-time').value,
        duration: Number($('game-duration').value),
        location: $('game-location').value.trim(),
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
        await showDashboard();
    } catch (error) {
        showCreateGameError(error.message);
        showAlert(error.message, 'danger');
    } finally {
        button.disabled = false;
        button.innerHTML = 'Create game <span aria-hidden="true">→</span>';
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
    $('profile-section').classList.add('d-none');
    $('menu-btn').classList.add('d-none');
    $('app-nav-menu').classList.add('d-none');
    hideNavProfile();
    $('dashboard-user-name').textContent = '';
}

function toggleEditCustomSport() {
    // Sports are developer-managed. Users can only select an existing sport.
    $('edit-custom-sport-wrap').classList.add('d-none');
}

function showRegisterPanel() {
    $('login-panel').classList.add('d-none');
    $('register-panel').classList.remove('d-none');
    $('alert-box').innerHTML = '';
}

function showLoginPanel() {
    $('session-loading').classList.add('d-none');
    $('auth-section').classList.remove('d-none');
    $('app-section').classList.add('d-none');
    $('dashboard-section').classList.add('d-none');
    $('create-section').classList.add('d-none');
    $('profile-section').classList.add('d-none');
    $('menu-btn').classList.add('d-none');
    $('app-nav-menu').classList.add('d-none');
    hideNavProfile();
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


function getProfileDisplayName(profile) {
    const fullName = [profile?.first_name, profile?.last_name]
        .filter(Boolean)
        .join(' ')
        .trim();
    return fullName || profile?.username || 'Player';
}

function renderNavProfile(profile) {
    const button = $('nav-profile-btn-top');
    const avatar = $('nav-profile-avatar');
    const label = $('nav-profile-label');
    if (!button || !avatar || !label) return;

    const name = getProfileDisplayName(profile);
    const initials = name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join('') || '?';

    avatar.innerHTML = profile?.profile_picture
        ? `<img src="${escapeHtml(getProfilePictureUrl(profile.profile_picture))}" alt="" class="nav-profile-avatar-image">`
        : `<span>${escapeHtml(initials)}</span>`;

    label.textContent = name;
    button.classList.remove('d-none');
}

function hideNavProfile() {
    $('nav-profile-btn-top')?.classList.add('d-none');
}

function showWelcomeModal() {
    const modal = $('playlink-welcome-modal');
    if (!modal || !window.bootstrap) return;
    bootstrap.Modal.getOrCreateInstance(modal).show();
}

function renderProfile(profile) {
    state.profile = profile;
    const name = getProfileDisplayName(profile);
    const initials = name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join('') || '?';

    $('profile-page-name').textContent = name;
    $('profile-page-username').textContent = '@' + (profile.username || 'player');

    const avatar = profile.profile_picture
        ? `<img src="${escapeHtml(getProfilePictureUrl(profile.profile_picture))}" alt="" class="profile-page-avatar-image">`
        : `<span>${escapeHtml(initials)}</span>`;

    $('profile-page-avatar').innerHTML = avatar;
    $('profile-upload-avatar').innerHTML = avatar;
    $('profile-first-name').value = profile.first_name || '';
    $('profile-last-name').value = profile.last_name || '';
    $('profile-email').value = profile.email || '';
    $('profile-location').value = profile.location || '';
    $('profile-phone').value = profile.phone_number || '';
    $('profile-bio').value = profile.bio || '';
}

function showProfileMessage(message, type = 'danger') {
    const box = $('profile-form-message');
    box.className = `alert alert-${type}`;
    box.textContent = message;
}

function clearProfileMessage() {
    const box = $('profile-form-message');
    box.className = 'alert d-none';
    box.textContent = '';
}

async function showProfile() {
    $('app-section').classList.add('d-none');
    $('dashboard-section').classList.add('d-none');
    $('create-section').classList.add('d-none');
    $('profile-section').classList.remove('d-none');
    clearProfileMessage();

    try {
        const profile = await apiFetch('/auth/me/');
        renderProfile(profile);
    } catch (error) {
        showProfileMessage(error.message);
    }

    closePlayLinkMenu();
}

async function saveProfile(event) {
    event.preventDefault();
    clearProfileMessage();

    const button = $('profile-save-btn');
    const data = new FormData();
    const file = $('profile-picture').files[0];

    data.append('first_name', $('profile-first-name').value.trim());
    data.append('last_name', $('profile-last-name').value.trim());
    data.append('email', $('profile-email').value.trim());
    data.append('location', $('profile-location').value.trim());
    data.append('phone_number', $('profile-phone').value.trim());
    data.append('bio', $('profile-bio').value.trim());

    if (file) {
        data.append('profile_picture', file);
    }

    button.disabled = true;
    button.textContent = 'Saving...';

    try {
        const updatedProfile = await apiFetch('/auth/me/', {
            method: 'PATCH',
            body: data,
            isFormData: true
        });

        state.user = updatedProfile;
        renderProfile(updatedProfile);
        $('profile-picture').value = '';
        $('dashboard-user-name').textContent =
            updatedProfile.first_name || updatedProfile.username;
        renderNavProfile(updatedProfile);
        showProfileMessage('Profile updated successfully.', 'success');
        showAlert('Profile updated successfully.', 'success');
    } catch (error) {
        showProfileMessage(error.message);
    } finally {
        button.disabled = false;
        button.textContent = 'Save changes';
    }
}

function showHome() {
    $('app-section').classList.remove('d-none');
    $('profile-section').classList.add('d-none');
    $('dashboard-section').classList.add('d-none');
    $('create-section').classList.add('d-none');
    loadGames().catch((error) => showAlert(error.message, 'danger'));
    closePlayLinkMenu();
}

async function showDashboard() {
    $('app-section').classList.add('d-none');
    $('profile-section').classList.add('d-none');
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
    $('profile-section').classList.add('d-none');
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
$('nav-profile-btn').addEventListener('click', showProfile);
$('nav-profile-btn-top')?.addEventListener('click', showProfile);
$('nav-logout-btn').addEventListener('click', logout);
$('profile-picture').addEventListener('change', () => {
    const file = $('profile-picture').files[0];

    if (!file) {
        renderProfile(state.profile || state.user || {});
        return;
    }

    if (!file.type.startsWith('image/')) {
        showProfileMessage('Please choose an image file.');
        $('profile-picture').value = '';
        return;
    }

    const previewUrl = URL.createObjectURL(file);
    const preview = `<img src="${previewUrl}" alt="Profile picture preview" class="profile-page-avatar-image">`;

    $('profile-page-avatar').innerHTML = preview;
    $('profile-upload-avatar').innerHTML = preview;
    clearProfileMessage();
});

$('profile-form').addEventListener('submit', saveProfile);
$('profile-cancel-btn').addEventListener('click', () => {
    renderProfile(state.profile || state.user || {});
    clearProfileMessage();
});

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
        showWelcomeModal();
    } catch (error) {
        showAlert(error.message, 'danger');
    }
});

$('game-form').addEventListener('submit', createGame);

const today = new Date().toISOString().split('T')[0];
$('game-date').min = today;
$('edit-game-date').min = today;

$('game-form').addEventListener('input', clearCreateGameError);
$('cancel-create-game-btn').addEventListener('click', showHome);
$('edit-game-form').addEventListener('submit', saveGameEdit);
$('filter-sport')?.addEventListener('change', updateFilterButton);
$('filter-date')?.addEventListener('change', updateFilterButton);
$('filter-status')?.addEventListener('change', updateFilterButton);

$('filter-apply-btn')?.addEventListener('click', applyFilters);
$('filter-clear-btn')?.addEventListener('click', clearFilters);

$('see-more-games-btn')?.addEventListener('click', () => {
    state.showAllExploreGames = !state.showAllExploreGames;
    renderExploreGames(state.exploreGames || []);
});


$('google-login-btn')?.addEventListener('click', () => {
    showAlert('Google login is not available yet.', 'info');
});

$('forgot-password-btn')?.addEventListener('click', () => {
    showAlert('Password reset is not available yet. Please contact support.', 'info');
});

$('game-sport').addEventListener('change', () => {
    // The selected sport must always come from the developer-managed list.
    $('custom-sport-wrap').classList.add('d-none');
});

$('edit-game-sport').addEventListener('change', toggleEditCustomSport);

restoreSession();