const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {JSDOM} = require('jsdom');

const appSource = fs.readFileSync('static/js/app.js', 'utf8');

const ids = [
    'alert-box','session-loading','auth-section','app-section','dashboard-section',
    'create-section','profile-section','menu-btn','app-nav-menu','dashboard-user-name',
    'login-panel','register-panel','navbar-home-link','nav-home-btn','nav-dashboard-btn',
    'nav-create-btn','nav-profile-btn','nav-logout-btn','profile-picture','profile-form',
    'profile-cancel-btn','show-register-btn','show-login-btn','login-show-password',
    'login-password','register-show-password','register-password','login-form','register-form',
    'login-username','game-form','game-date','edit-game-date','cancel-create-game-btn',
    'edit-game-form','filter-sport','see-more-games-btn','filter-date','filter-status',
    'google-login-btn','forgot-password-btn','game-sport','edit-game-sport',
    'custom-sport-wrap','edit-custom-sport-wrap','edit-game-title','edit-game-time',
    'edit-game-duration','edit-game-players','edit-game-location','edit-game-description',
    'edit-game-id','edit-custom-sport','game-title','game-description','game-time',
    'game-duration','game-players','game-location','profile-page-avatar',
    'profile-upload-avatar','profile-page-name','profile-page-username',
    'profile-form-message','profile-first-name','profile-last-name','profile-email',
    'profile-location','profile-phone','profile-bio','profile-save-btn',
    'joined-games-list','dashboard-joined-count','dashboard-upcoming-count',
    'dashboard-hosted-count','create-game-errors','create-game-btn','game-details-modal','game-details-title',
    'game-details-sport','game-details-status','game-details-location','game-details-date',
    'game-details-time','game-details-description','game-details-list',
    'game-details-creator-name','game-details-creator-username','game-details-created-at',
    'game-details-creator-avatar','game-details-action','game-details-players-btn',
    'players-modal','players-modal-title','players-modal-count','players-list'
];

function createApp(fetchImpl) {
    const dom = new JSDOM(
        '<!doctype html><body>' + ids.map((id) => '<div id="' + id + '"></div>').join('') + '</body>',
        {url: 'http://localhost/'}
    );

    const doc = dom.window.document;
    const inputs = [
        'profile-picture','login-show-password','login-password','register-show-password',
        'register-password','login-username','game-date','edit-game-date','filter-date',
        'game-sport','edit-game-sport','edit-game-title','edit-game-time','edit-game-duration',
        'edit-game-players','edit-game-location','edit-game-description','edit-game-id',
        'edit-custom-sport','game-title','game-description','game-time','game-duration',
        'game-players','game-location','profile-first-name','profile-last-name',
        'profile-email','profile-location','profile-phone','profile-bio'
    ];
    for (const id of inputs) {
        const old = doc.getElementById(id);
        const tag = ['game-description','edit-game-description','profile-bio'].includes(id) ? 'textarea' : 'input';
        old.outerHTML = '<' + tag + ' id="' + id + '">';
    }
    doc.getElementById('profile-form').outerHTML =
        '<form id="profile-form"><input id="profile-first-name"><input id="profile-last-name">' +
        '<input id="profile-email"><input id="profile-location"><input id="profile-phone">' +
        '<textarea id="profile-bio"></textarea><input id="profile-picture" type="file">' +
        '<button id="profile-save-btn">Save changes</button></form>';
    doc.getElementById('edit-game-form').outerHTML = '<form id="edit-game-form"></form>';
    doc.getElementById('game-form').outerHTML = '<form id="game-form"></form>';
    doc.getElementById('create-game-btn').outerHTML = '<button id="create-game-btn"></button>';

    const calls = [];
    const context = vm.createContext({
        window: dom.window, document: doc, localStorage: dom.window.localStorage,
        URL: {createObjectURL: () => 'blob:test-picture'},
        Headers, FormData: dom.window.FormData, File: dom.window.File,
        fetch: async (url, options = {}) => {
            calls.push({url, options});
            return fetchImpl(url, options);
        },
        setTimeout, clearTimeout, console, confirm: () => true,
        bootstrap: {
            Offcanvas: {getOrCreateInstance: () => ({hide() {}})},
            Modal: {getOrCreateInstance: () => ({show() {}, hide() {}})}
        }
    });

    vm.runInContext(appSource, context, {filename: 'app.js'});
    return {dom, context, calls};
}

function response(data, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        text: async () => JSON.stringify(data),
        json: async () => data
    };
}

const game = {
    id: 7,
    title: 'Sunday Football',
    sport: 1,
    sport_details: {id: 1, name: 'Football'},
    custom_sport_name: '',
    description: '7-a-side match',
    date: '2026-10-04',
    start_time: '07:00:00',
    duration: 90,
    location: 'Municipal Ground',
    players_needed: 7,
    current_players: 5,
    available_slots: 2,
    status: 'OPEN',
    is_joined: false,
    is_creator: false,
    creator: {id: 3, username: 'rahul', first_name: 'Rahul', last_name: 'Kumar'}
};

test('create game sends the expected payload', async () => {
    const {dom, calls} = createApp(async () => response({...game, is_creator: true, is_joined: true}));

    const doc = dom.window.document;
    doc.getElementById('game-title').value = game.title;
    doc.getElementById('game-sport').value = '1';
    doc.getElementById('game-description').value = game.description;
    doc.getElementById('game-date').value = game.date;
    doc.getElementById('game-time').value = '07:00';
    doc.getElementById('game-duration').value = '90';
    doc.getElementById('game-location').value = game.location;
    doc.getElementById('game-players').value = '7';

    const event = new dom.window.Event('submit', {bubbles: true, cancelable: true});
    doc.getElementById('game-form').dispatchEvent(event);
    await new Promise(resolve => setImmediate(resolve));

    const request = calls.find(call => call.url.endsWith('/api/game/create/'));
    assert.ok(request);
    assert.equal(request.options.method, 'POST');
    const body = JSON.parse(request.options.body);
    assert.equal(body.sport, 1);
    assert.equal(body.title, 'Sunday Football');
    assert.equal(body.date, '2026-10-04');
    assert.equal(body.start_time, '07:00');
    assert.equal(body.duration, 90);
    assert.equal(body.location, 'Municipal Ground');
    assert.equal(body.players_needed, 7);
});

test('join game calls the join endpoint', async () => {
    const {context, calls} = createApp(async (url) => {
        if (url.endsWith('/api/game/7/join/')) return response({...game, is_joined: true});
        if (url.endsWith('/api/game/')) return response([]);
        return response({});
    });

    await context.joinGame(7);

    const request = calls.find(call => call.url.endsWith('/api/game/7/join/'));
    assert.ok(request);
    assert.equal(request.options.method, 'POST');
});

test('leave game asks for confirmation and calls the leave endpoint', async () => {
    const {context, calls} = createApp(async (url) => {
        if (url.endsWith('/api/game/7/leave/')) return response({...game, is_joined: false});
        if (url.endsWith('/api/game/')) return response([]);
        return response({});
    });

    await context.leaveGame(7);

    const request = calls.find(call => call.url.endsWith('/api/game/7/leave/'));
    assert.ok(request);
    assert.equal(request.options.method, 'POST');
});

test('game details loads and renders the creator and game information', async () => {
    const {dom, context} = createApp(async (url) => {
        if (url.endsWith('/api/game/7/')) return response(game);
        return response({});
    });

    await context.showGameDetails(7);

    const doc = dom.window.document;
    assert.equal(doc.getElementById('game-details-title').textContent, 'Sunday Football');
    assert.equal(doc.getElementById('game-details-sport').textContent, 'Football');
    assert.equal(doc.getElementById('game-details-location').textContent, 'Municipal Ground');
    assert.equal(doc.getElementById('game-details-date').textContent, '04-10-2026');
    assert.equal(doc.getElementById('game-details-time').textContent, '07:00');
    assert.equal(doc.getElementById('game-details-creator-name').textContent, 'Rahul Kumar');
    assert.equal(doc.getElementById('game-details-creator-username').textContent, '@rahul');
});

test('players modal loads players for the selected game', async () => {
    const players = [
        {
            id: 3, username: 'rahul', first_name: 'Rahul', last_name: 'Kumar',
            location: 'Kochi', bio: 'Football player', profile_picture: null
        },
        {
            id: 9, username: 'surya', first_name: 'Surya', last_name: 'Prakash',
            location: 'Palakkad', bio: 'Looking for games', profile_picture: null
        }
    ];

    const {dom, context} = createApp(async (url) => {
        if (url.endsWith('/api/game/7/players/')) return response(players);
        if (url.endsWith('/api/game/7/')) return response(game);
        return response({});
    });

    await context.showPlayers(7);

    const doc = dom.window.document;
    assert.equal(doc.getElementById('players-modal-title').textContent, 'Sunday Football');
    assert.equal(doc.getElementById('players-modal-count').textContent, '2 players joined');
    assert.match(doc.getElementById('players-list').textContent, /Rahul Kumar/);
    assert.match(doc.getElementById('players-list').textContent, /Surya Prakash/);
    assert.match(doc.getElementById('players-list').textContent, /Palakkad/);
});

test('game filters build the expected query string', async () => {
    const {dom, context, calls} = createApp(async () => response([]));

    const doc = dom.window.document;
    doc.getElementById('filter-sport').value = '1';
    doc.getElementById('filter-date').value = '2026-10-04';
    doc.getElementById('filter-status').value = 'OPEN';

    await context.loadGames();

    const request = calls.find(call => call.url.includes('/api/game/?'));
    assert.ok(request);
    assert.match(request.url, /sport=1/);
    assert.match(request.url, /date=2026-10-04/);
    assert.match(request.url, /status=OPEN/);
});

test('game card join action is available when the game has open slots', () => {
    const {context} = createApp(async () => response({}));
    const html = context.exploreGameCard(game);

    assert.match(html, /Join game/);
    assert.match(html, /Municipal Ground/);
    assert.match(html, /04-10-2026/);
    assert.match(html, /07:00/);
});
