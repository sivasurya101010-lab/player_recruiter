const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {JSDOM} = require('jsdom');

const appSource = fs.readFileSync('static/js/app.js', 'utf8');

const elementIds = [
    'alert-box', 'session-loading', 'auth-section', 'app-section',
    'dashboard-section', 'create-section', 'profile-section', 'menu-btn',
    'app-nav-menu', 'dashboard-user-name', 'login-panel', 'register-panel',
    'navbar-home-link', 'nav-home-btn', 'nav-dashboard-btn', 'nav-create-btn',
    'nav-profile-btn', 'nav-logout-btn', 'profile-picture', 'profile-form',
    'profile-cancel-btn', 'show-register-btn', 'show-login-btn',
    'login-show-password', 'login-password', 'register-show-password',
    'register-password', 'login-form', 'register-form', 'login-show-password', 'login-password', 'register-show-password', 'register-password', 'login-username', 'game-sport', 'edit-game-sport', 'game-form',
    'game-date', 'edit-game-date', 'cancel-create-game-btn',
    'edit-game-form', 'filter-sport', 'see-more-games-btn', 'filter-date',
    'filter-status', 'google-login-btn', 'forgot-password-btn', 'game-sport',
    'edit-game-sport', 'custom-sport-wrap', 'edit-custom-sport-wrap',
    'edit-game-title', 'edit-game-time', 'edit-game-duration',
    'edit-game-players', 'edit-game-location', 'edit-game-description',
    'edit-game-id', 'edit-custom-sport', 'game-title', 'game-description',
    'game-time', 'game-duration', 'game-players', 'game-location',
    'profile-page-avatar', 'profile-upload-avatar', 'profile-page-name',
    'profile-page-username', 'profile-form-message', 'profile-first-name',
    'profile-last-name', 'profile-email', 'profile-location', 'profile-phone',
    'profile-bio', 'profile-save-btn'
];

function createApp() {
    const dom = new JSDOM(
        '<!doctype html><body>' +
        elementIds.map((id) => '<div id="' + id + '"></div>').join('') +
        '</body>',
        {url: 'http://localhost/'}
    );

    for (const id of [
        'profile-picture', 'login-show-password', 'register-show-password',
        'game-date', 'edit-game-date', 'game-title', 'game-description',
        'game-time', 'game-duration', 'game-players', 'game-location',
        'profile-first-name', 'profile-last-name', 'profile-email',
        'profile-location', 'profile-phone', 'profile-bio', 'edit-game-title',
        'edit-game-time', 'edit-game-duration', 'edit-game-players',
        'edit-game-location', 'edit-game-description', 'edit-game-id',
        'edit-custom-sport'
    ]) {
        dom.window.document.getElementById(id).outerHTML =
            id === 'profile-picture'
            ? '<input id="profile-picture" type="file">'
            : '<input id="' + id + '">';
    }

    dom.window.document.getElementById('profile-form').outerHTML =
        '<form id="profile-form"><input id="profile-first-name"><input id="profile-last-name">' +
        '<input id="profile-email"><input id="profile-location"><input id="profile-phone">' +
        '<textarea id="profile-bio"></textarea><input id="profile-picture" type="file">' +
        '<button id="profile-save-btn" type="submit">Save changes</button></form>';

    dom.window.document.getElementById('profile-cancel-btn').outerHTML =
        '<button id="profile-cancel-btn" type="button">Cancel</button>';

    const localStorage = dom.window.localStorage;
    const fetchCalls = [];

    const context = vm.createContext({
        window: dom.window,
        document: dom.window.document,
        localStorage,
        URL: {
            createObjectURL: () => 'blob:test-profile-picture'
        },
        Headers,
        URLSearchParams,
        FormData: dom.window.FormData,
        File: dom.window.File,
        fetch: async (url, options = {}) => {
            fetchCalls.push({url, options});
            return {
                ok: true,
                status: 200,
                text: async () => JSON.stringify({
                    id: 1,
                    username: 'testuser',
                    email: 'updated@example.com',
                    first_name: 'Updated',
                    last_name: 'Player',
                    location: 'Palakkad',
                    phone_number: '+91 9876543210',
                    bio: 'Updated bio',
                    profile_picture: null
                })
            };
        },
        setTimeout,
        clearTimeout,
        console,
        confirm: () => true,
        bootstrap: {
            Offcanvas: {getOrCreateInstance: () => ({hide() {}})},
            Modal: {getOrCreateInstance: () => ({show() {}, hide() {}})}
        }
    });

    vm.runInContext(appSource, context, {filename: 'app.js'});
    return {dom, context, fetchCalls};
}

test('profile rendering populates all editable fields', () => {
    const {dom, context} = createApp();

    context.renderProfile({
        username: 'testuser',
        first_name: 'Surya',
        last_name: 'Prakash',
        email: 'surya@example.com',
        location: 'Palakkad',
        phone_number: '+91 9876543210',
        bio: 'Football player',
        profile_picture: null
    });

    const doc = dom.window.document;
    assert.equal(doc.getElementById('profile-page-name').textContent, 'Surya Prakash');
    assert.equal(doc.getElementById('profile-page-username').textContent, '@testuser');
    assert.equal(doc.getElementById('profile-first-name').value, 'Surya');
    assert.equal(doc.getElementById('profile-last-name').value, 'Prakash');
    assert.equal(doc.getElementById('profile-email').value, 'surya@example.com');
    assert.equal(doc.getElementById('profile-location').value, 'Palakkad');
    assert.equal(doc.getElementById('profile-phone').value, '+91 9876543210');
    assert.equal(doc.getElementById('profile-bio').value, 'Football player');
    assert.match(doc.getElementById('profile-page-avatar').textContent, /SP/);
});

test('profile cancel restores the last loaded profile', () => {
    const {dom, context} = createApp();

    context.renderProfile({
        username: 'testuser',
        first_name: 'Surya',
        last_name: 'Prakash',
        email: 'surya@example.com',
        location: 'Palakkad',
        phone_number: '+91 9876543210',
        bio: 'Football player',
        profile_picture: null
    });

    const doc = dom.window.document;
    doc.getElementById('profile-first-name').value = 'Changed';
    doc.getElementById('profile-phone').value = '0000000000';

    doc.getElementById('profile-cancel-btn').click();

    assert.equal(doc.getElementById('profile-first-name').value, 'Surya');
    assert.equal(doc.getElementById('profile-phone').value, '+91 9876543210');
});

test('profile save sends the editable profile data to the API', async () => {
    const {dom, fetchCalls, context} = createApp();

    context.renderProfile({
        username: 'testuser',
        first_name: 'Surya',
        last_name: 'Prakash',
        email: 'surya@example.com',
        location: 'Palakkad',
        phone_number: '',
        bio: 'Football player',
        profile_picture: null
    });

    const doc = dom.window.document;
    doc.getElementById('profile-first-name').value = 'Updated';
    doc.getElementById('profile-last-name').value = 'Player';
    doc.getElementById('profile-email').value = 'updated@example.com';
    doc.getElementById('profile-location').value = 'Kochi';
    doc.getElementById('profile-phone').value = '+91 9876543210';
    doc.getElementById('profile-bio').value = 'Updated bio';

    doc.getElementById('profile-form').dispatchEvent(
        new dom.window.Event('submit', {bubbles: true, cancelable: true})
    );

    await new Promise((resolve) => setImmediate(resolve));

    const profileRequest = fetchCalls.find((call) => call.url.endsWith('/api/auth/me/'));
    assert.ok(profileRequest);
    assert.equal(profileRequest.options.method, 'PATCH');
    assert.ok(profileRequest.options.body instanceof dom.window.FormData);

    const body = profileRequest.options.body;
    assert.equal(body.get('first_name'), 'Updated');
    assert.equal(body.get('last_name'), 'Player');
    assert.equal(body.get('email'), 'updated@example.com');
    assert.equal(body.get('location'), 'Kochi');
    assert.equal(body.get('phone_number'), '+91 9876543210');
    assert.equal(body.get('bio'), 'Updated bio');
});

test('profile picture preview uses the selected image without uploading it yet', () => {
    const {dom} = createApp();
    const doc = dom.window.document;

    const file = new dom.window.File(['image-data'], 'profile.png', {
        type: 'image/png'
    });

    const input = doc.getElementById('profile-picture');
    Object.defineProperty(input, 'files', {
        configurable: true,
        value: [file]
    });
    input.dispatchEvent(new dom.window.Event('change', {bubbles: true}));

    assert.match(
        doc.getElementById('profile-page-avatar').innerHTML,
        /blob:test-profile-picture/
    );
    assert.match(
        doc.getElementById('profile-upload-avatar').innerHTML,
        /blob:test-profile-picture/
    );
});
