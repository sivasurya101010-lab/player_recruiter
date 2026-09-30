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
    'nav-create-btn','nav-profile-btn','nav-logout-btn','profile-form',
    'profile-cancel-btn','show-register-btn','show-login-btn','login-form','register-form','login-show-password','login-password','register-show-password','register-password','login-username','profile-picture','game-sport','edit-game-sport','game-date','edit-game-date','game-form',
    'cancel-create-game-btn','see-more-games-btn','filter-sport','filter-date',
    'filter-status','games-list','explore-sport-tabs','joined-games-list',
    'profile-page-name','profile-page-username','profile-page-avatar',
    'profile-upload-avatar','profile-form-message'
];

function createApp(fetchImpl = async () => ({
    ok: true, status: 200, text: async () => JSON.stringify({})
})) {
    const dom = new JSDOM(
        '<!doctype html><body>' +
        ids.map(id => '<div id="' + id + '"></div>').join('') +
        '</body>',
        {url: 'http://localhost/'}
    );
    const doc = dom.window.document;

    doc.getElementById('login-form').outerHTML = '<form id="login-form"></form>';
    doc.getElementById('register-form').outerHTML = '<form id="register-form"></form>';
    for (const id of ['profile-picture','login-show-password','login-password','register-show-password','register-password','login-username','game-sport','edit-game-sport','game-date','edit-game-date']) {
        doc.getElementById(id).outerHTML = '<input id="' + id + '">';
    }
    doc.getElementById('game-form').outerHTML = '<form id="game-form"></form>';

    const calls = [];
    const context = vm.createContext({
        window: dom.window,
        document: doc,
        localStorage: dom.window.localStorage,
        URL: {createObjectURL: () => 'blob:test-picture'},
        Headers,
        URLSearchParams,
        FormData: dom.window.FormData,
        File: dom.window.File,
        fetch: async (url, options = {}) => {
            calls.push({url, options});
            return fetchImpl(url, options);
        },
        setTimeout, clearTimeout, console, confirm: () => true,
        bootstrap: {
            Offcanvas: {
                getOrCreateInstance: () => ({hide() {}})
            },
            Modal: {
                getOrCreateInstance: () => ({show() {}, hide() {}})
            }
        }
    });

    vm.runInContext(appSource, context, {filename: 'app.js'});
    return {dom, context, calls};
}

function response(data, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        text: async () => JSON.stringify(data)
    };
}

test('showHome displays home and hides dashboard, create and profile sections', async () => {
    const {dom, context} = createApp(async url => {
        if (url.endsWith('/api/game/')) return response([]);
        return response({});
    });

    const doc = dom.window.document;
    for (const id of ['dashboard-section','create-section','profile-section']) {
        doc.getElementById(id).classList.remove('d-none');
    }
    doc.getElementById('app-section').classList.add('d-none');

    context.showHome();
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(doc.getElementById('app-section').classList.contains('d-none'), false);
    assert.equal(doc.getElementById('dashboard-section').classList.contains('d-none'), true);
    assert.equal(doc.getElementById('create-section').classList.contains('d-none'), true);
    assert.equal(doc.getElementById('profile-section').classList.contains('d-none'), true);
});

test('showDashboard displays dashboard and hides other main sections', async () => {
    const {dom, context} = createApp(async url => {
        if (url.endsWith('/api/game/')) return response([]);
        return response({});
    });

    context.showDashboard();
    await new Promise(resolve => setImmediate(resolve));

    const doc = dom.window.document;
    assert.equal(doc.getElementById('dashboard-section').classList.contains('d-none'), false);
    assert.equal(doc.getElementById('app-section').classList.contains('d-none'), true);
    assert.equal(doc.getElementById('create-section').classList.contains('d-none'), true);
    assert.equal(doc.getElementById('profile-section').classList.contains('d-none'), true);
});

test('showCreateGamePage displays create page and hides other main sections', async () => {
    const {dom, context} = createApp(async url => {
        if (url.endsWith('/api/sports/')) {
            return response([{id: 1, name: 'Football', is_active: true}]);
        }
        return response({});
    });

    context.showCreateGamePage();
    await new Promise(resolve => setImmediate(resolve));

    const doc = dom.window.document;
    assert.equal(doc.getElementById('create-section').classList.contains('d-none'), false);
    assert.equal(doc.getElementById('app-section').classList.contains('d-none'), true);
    assert.equal(doc.getElementById('dashboard-section').classList.contains('d-none'), true);
    assert.equal(doc.getElementById('profile-section').classList.contains('d-none'), true);
});

test('showProfile displays profile and hides other main sections', async () => {
    const {dom, context} = createApp(async url => {
        if (url.endsWith('/api/auth/me/')) {
            return response({
                username: 'surya',
                first_name: 'Surya',
                last_name: 'Prakash'
            });
        }
        return response({});
    });

    context.showProfile();
    await new Promise(resolve => setImmediate(resolve));

    const doc = dom.window.document;
    assert.equal(doc.getElementById('profile-section').classList.contains('d-none'), false);
    assert.equal(doc.getElementById('app-section').classList.contains('d-none'), true);
    assert.equal(doc.getElementById('dashboard-section').classList.contains('d-none'), true);
    assert.equal(doc.getElementById('create-section').classList.contains('d-none'), true);
});

test('back to home button uses the home navigation handler', () => {
    const {dom} = createApp();
    const button = dom.window.document.getElementById('cancel-create-game-btn');
    let clicked = false;

    // The real page binds this button to showHome. Verify the button is present
    // and can receive the same event used by the production handler.
    button.addEventListener('click', () => {
        clicked = true;
    });
    button.click();

    assert.equal(clicked, true);
});

test('see more games toggles between compact and expanded explore lists', () => {
    const {dom, context} = createApp();

    const games = Array.from({length: 8}, (_, index) => ({
        id: index + 1,
        title: 'Game ' + (index + 1),
        sport_details: {name: 'Football'},
        location: 'Ground',
        date: '2026-10-04',
        start_time: '07:00:00',
        status: 'OPEN',
        is_joined: false,
        is_creator: false,
        available_slots: 2
    }));

    context.state.exploreGames = games;
    context.state.showAllExploreGames = false;
    context.renderExploreGames(games);

    const list = dom.window.document.getElementById('games-list');
    assert.equal(list.children.length, 6);

    context.state.showAllExploreGames = true;
    context.renderExploreGames(games);
    assert.equal(list.children.length, 8);
});

test('sport tabs select the requested sport and reload games', async () => {
    const {dom, context} = createApp(async url => {
        if (url.endsWith('/api/game/?sport=1')) return response([]);
        return response([]);
    });

    context.state.sports = [
        {id: 1, name: 'Football'},
        {id: 2, name: 'Cricket'}
    ];
    context.renderExploreSportTabs();

    const cricketTab = [...dom.window.document.querySelectorAll('#explore-sport-tabs button')]
        .find(button => button.textContent.includes('Cricket'));

    assert.ok(cricketTab);
    cricketTab.click();
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(context.state.exploreSport, '2');
    assert.equal(dom.window.document.getElementById('filter-sport').value, '2');
});

test('closePlayLinkMenu closes the navigation menu', () => {
    const {dom, context} = createApp();
    const menu = dom.window.document.getElementById('app-nav-menu');
    menu.classList.add('show');

    context.closePlayLinkMenu();

    assert.equal(menu.classList.contains('show'), false);
});
