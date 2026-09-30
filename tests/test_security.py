import json
import os
import subprocess
import sys


REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_settings_in_subprocess(extra_env):
    env = os.environ.copy()
    env.pop('DJANGO_SECRET_KEY', None)
    env.pop('DJANGO_DEBUG', None)
    env.update(extra_env)

    code = """
import json
from config import settings

print(json.dumps({
    'debug': settings.DEBUG,
    'secret_key': settings.SECRET_KEY,
    'secure_ssl_redirect': settings.SECURE_SSL_REDIRECT,
    'session_cookie_secure': settings.SESSION_COOKIE_SECURE,
    'csrf_cookie_secure': settings.CSRF_COOKIE_SECURE,
    'hsts_seconds': settings.SECURE_HSTS_SECONDS,
    'hsts_subdomains': settings.SECURE_HSTS_INCLUDE_SUBDOMAINS,
    'hsts_preload': settings.SECURE_HSTS_PRELOAD,
    'content_type_nosniff': settings.SECURE_CONTENT_TYPE_NOSNIFF,
    'x_frame_options': settings.X_FRAME_OPTIONS,
    'referrer_policy': settings.SECURE_REFERRER_POLICY,
}))
"""

    result = subprocess.run(
        [sys.executable, '-c', code],
        cwd=REPO_ROOT,
        env=env,
        capture_output=True,
        text=True,
    )

    return result


def test_production_settings_enable_security_flags():
    result = load_settings_in_subprocess({
        'DJANGO_DEBUG': 'False',
        'DJANGO_SECRET_KEY': 'test-production-secret',
        'DJANGO_SECURE_SSL_REDIRECT': 'True',
        'DJANGO_SECURE_HSTS_SECONDS': '31536000',
    })

    assert result.returncode == 0, result.stderr

    settings = json.loads(result.stdout)

    assert settings['debug'] is False
    assert settings['secret_key'] == 'test-production-secret'
    assert settings['secure_ssl_redirect'] is True
    assert settings['session_cookie_secure'] is True
    assert settings['csrf_cookie_secure'] is True
    assert settings['hsts_seconds'] == 31536000
    assert settings['hsts_subdomains'] is True
    assert settings['hsts_preload'] is True
    assert settings['content_type_nosniff'] is True
    assert settings['x_frame_options'] == 'DENY'
    assert settings['referrer_policy'] == 'strict-origin-when-cross-origin'


def test_production_settings_require_secret_key():
    result = load_settings_in_subprocess({
        'DJANGO_DEBUG': 'False',
    })

    assert result.returncode != 0
    assert 'DJANGO_SECRET_KEY must be set when DJANGO_DEBUG=False.' in result.stderr


def test_development_settings_do_not_force_production_security():
    result = load_settings_in_subprocess({
        'DJANGO_DEBUG': 'True',
    })

    assert result.returncode == 0, result.stderr

    settings = json.loads(result.stdout)

    assert settings['debug'] is True
    assert settings['secret_key'] == 'dev-only-development-secret-key-change-me-please'
    assert settings['secure_ssl_redirect'] is False
    assert settings['session_cookie_secure'] is False
    assert settings['csrf_cookie_secure'] is False
    assert settings['hsts_seconds'] == 0
    assert settings['hsts_subdomains'] is False
    assert settings['hsts_preload'] is False
    assert settings['content_type_nosniff'] is False
    assert settings['x_frame_options'] == 'SAMEORIGIN'
    assert settings['referrer_policy'] == 'same-origin'
