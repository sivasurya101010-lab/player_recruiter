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
    'login-password','register-show-password','register-password','login-form',
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
    'dashboard-hosted-count'
];

function createApp(fetchImpl) {
    const dom = new JSDOM(
        '<!doctype html><body>' + ids.map((id) => '<div id="' + id + '"></div>').join('') + '</body>',
        {url: 'http://localhost/'}
    );
    const doc = dom.window.document;

    for (const id of [
        'profile-picture','login-show-password','login-password','register-show-password',
        'register-password','login-username','game-date','edit-game-date','filter-date',
        'game-sport','edit-game-sport','edit-game-title','edit-game-time','edit-game-duration',
        'edit-game-players','edit-game-location','edit-game-description','edit-game-id',
        'edit-custom-sport','game-title','game-description','game-time','game-duration',
        'game-players','game-location','profile-first-name','profile-last-name',
        'profile-email','profile-location','profile-phone','profile-bio'
    ]) {
        const old = doc.getElementById(id);
        old.outerHTML = '<input id="' + id + '">';
    }

    doc.getElementById('profile-form').outerHTML = '<form id="profile-form"></form>';
    doc.getElementById('edit-game-form').outerHTML = '<form id="edit-game-form"></form>';
    doc.getElementById('game-form').outerHTML = '<form id="game-form"></form>';

    const calls = [];
    const context = vm.createContext({
        window: dom.window,
        document: doc,
        localStorage: dom.window.localStorage,
        URL: {createObjectURL: () => 'blob:test-picture'},
        Headers,
        FormData: dom.window.FormData,
        File: dom.window.File,
        fetch: async (url, options = {}) => {
            calls.push({url, options});
            return fetchImpl(url, options);
        },
        setTimeout, clearTimeout, console,
        confirm: () => true,
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
        text: async () => JSON.stringify(data)
    };
}

test('login sends credentials and stores returned tokens', async () => {
    const {context, calls, dom} = createApp(async (url) => {
        if (url.endsWith('/api/auth/login/')) {
            return response({access: 'access-token', refresh: 'refresh-token'});
        }
        if (url.endsWith('/api/auth/me/')) {
            return response({id: 1, username: 'surya', first_name: 'Surya'});
        }
        if (url.endsWith('/api/sports/')) return response([]);
        if (url.endsWith('/api/game/')) return response([]);
        return response({});
    });

    await context.login('surya', 'password123');

    const request = calls.find((call) => call.url.endsWith('/api/auth/login/'));
    assert.ok(request);
    assert.equal(JSON.parse(request.options.body).username, 'surya');
    assert.equal(JSON.parse(request.options.body).password, 'password123');
    assert.equal(dom.window.localStorage.getItem('playerRecruiterAccess'), 'access-token');
    assert.equal(dom.window.localStorage.getItem('playerRecruiterRefresh'), 'refresh-token');
});

test('invalid login surfaces the API error', async () => {
    const {context, dom} = createApp(async (url) => {
        if (url.endsWith('/api/auth/login/')) {
            return response({detail: 'Invalid username or password.'}, 401);
        }
        return response({});
    });

    await assert.rejects(
        () => context.login('wrong', 'wrong'),
        /Invalid username or password/
    );
    assert.equal(dom.window.localStorage.getItem('playerRecruiterAccess'), null);
});

test('logout blacklists the refresh token and clears local session data', async () => {
    const {context, calls, dom} = createApp(async (url) => {
        if (url.endsWith('/api/auth/logout/')) return response({detail: 'Logged out'});
        return response({});
    });

    dom.window.localStorage.setItem('playerRecruiterAccess', 'access-token');
    dom.window.localStorage.setItem('playerRecruiterRefresh', 'refresh-token');
    context.state.access = 'access-token';
    context.state.refresh = 'refresh-token';

    await context.logout();

    const request = calls.find((call) => call.url.endsWith('/api/auth/logout/'));
    assert.ok(request);
    assert.equal(request.options.method, 'POST');
    assert.deepEqual(JSON.parse(request.options.body), {refresh: 'refresh-token'});
    assert.equal(dom.window.localStorage.getItem('playerRecruiterAccess'), null);
    assert.equal(dom.window.localStorage.getItem('playerRecruiterRefresh'), null);
    assert.equal(context.state.access, null);
    assert.equal(context.state.refresh, null);
});

test('apiFetch refreshes an expired access token and retries the request', async () => {
    let requestCount = 0;
    const {context, calls, dom} = createApp(async (url) => {
        if (url.endsWith('/api/test/')) {
            requestCount += 1;
            if (requestCount === 1) return response({detail: 'Token expired'}, 401);
            return response({ok: true});
        }
        if (url.endsWith('/api/auth/refresh/')) {
            return response({access: 'new-access-token', refresh: 'new-refresh-token'});
        }
        return response({});
    });

    context.state.access = 'old-access-token';
    context.state.refresh = 'old-refresh-token';

    const data = await context.apiFetch('/test/');

    assert.deepEqual(data, {ok: true});
    assert.equal(requestCount, 2);
    assert.equal(dom.window.localStorage.getItem('playerRecruiterAccess'), 'new-access-token');
    assert.equal(dom.window.localStorage.getItem('playerRecruiterRefresh'), 'new-refresh-token');

    const refreshRequest = calls.find((call) => call.url.endsWith('/api/auth/refresh/'));
    assert.ok(refreshRequest);
    assert.deepEqual(JSON.parse(refreshRequest.options.body), {refresh: 'old-refresh-token'});
});

test('restoreSession uses the saved refresh token to obtain a new access token', async () => {
    const {context, calls, dom} = createApp(async (url) => {
        if (url.endsWith('/api/auth/refresh/')) {
            return response({access: 'restored-access', refresh: 'restored-refresh'});
        }
        if (url.endsWith('/api/auth/me/')) {
            return response({id: 1, username: 'surya', first_name: 'Surya'});
        }
        if (url.endsWith('/api/sports/')) return response([]);
        if (url.endsWith('/api/game/')) return response([]);
        return response({});
    });

    dom.window.localStorage.setItem('playerRecruiterRefresh', 'saved-refresh');
    context.state.refresh = 'saved-refresh';
    context.state.access = null;

    await context.restoreSession();

    const refreshRequest = calls.find((call) => call.url.endsWith('/api/auth/refresh/'));
    assert.ok(refreshRequest);
    assert.deepEqual(JSON.parse(refreshRequest.options.body), {refresh: 'saved-refresh'});
    assert.equal(dom.window.localStorage.getItem('playerRecruiterAccess'), 'restored-access');
    assert.equal(dom.window.localStorage.getItem('playerRecruiterRefresh'), 'restored-refresh');
});

test('restoreSession clears tokens when the saved refresh token is invalid', async () => {
    const {context, dom} = createApp(async (url) => {
        if (url.endsWith('/api/auth/refresh/')) {
            return response({detail: 'Token is invalid'}, 401);
        }
        return response({});
    });

    dom.window.localStorage.setItem('playerRecruiterAccess', 'old-access');
    dom.window.localStorage.setItem('playerRecruiterRefresh', 'bad-refresh');
    context.state.access = 'old-access';
    context.state.refresh = 'bad-refresh';

    await context.restoreSession();

    assert.equal(context.state.access, null);
    assert.equal(context.state.refresh, null);
    assert.equal(dom.window.localStorage.getItem('playerRecruiterAccess'), null);
    assert.equal(dom.window.localStorage.getItem('playerRecruiterRefresh'), null);
    assert.equal(dom.window.document.getElementById('auth-section').classList.contains('d-none'), false);
});
