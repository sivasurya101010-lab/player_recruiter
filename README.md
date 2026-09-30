# PlayLink — Sports Player Recruitment Platform

PlayLink is a Django/DRF platform for finding players for casual football, cricket, and other sports games when a group does not have enough players.

## What it demonstrates

- JWT access/refresh authentication with refresh-token blacklist logout
- Custom user profiles with profile media and validation
- Sports management with support for custom "Other" sports
- Game creation, discovery, detail, join, leave, edit, cancel, delete, and player-list workflows
- Creator-only authorization and authenticated API access
- Duplicate-join prevention at both application and database levels
- Atomic last-slot handling with `transaction.atomic()` and `select_for_update()`
- Filtering by sport, status, date/date range, and location
- PostgreSQL database integration and reusable Django FilterSets
- Swagger/OpenAPI documentation through drf-spectacular
- Automated backend and frontend tests
- GitHub Actions CI running against PostgreSQL
- Docker Compose development environment

## Stack

**Backend:** Python, Django, Django REST Framework, SimpleJWT  
**Database:** PostgreSQL  
**Filtering/API docs:** django-filter, drf-spectacular / Swagger  
**Testing:** pytest, pytest-django, Django TestCase, Node.js test runner, jsdom  
**Frontend:** HTML, CSS, Bootstrap, Vanilla JavaScript  
**CI:** GitHub Actions  
**Containerization:** Docker, Docker Compose

## API documentation

After starting the project:

- Swagger UI: `/api/docs/`
- OpenAPI schema: `/api/schema/`

## Run locally

Create a virtual environment, install `requirements.txt`, configure PostgreSQL through `.env`, run migrations, and start Django:

```bash
python manage.py migrate
python manage.py runserver
```

## Run with Docker

```bash
docker compose up --build
```

The application is then available at `http://localhost:8000/`.

## Test suite

The repository contains backend tests for authentication, permissions, validation, game workflows, security/edge cases, schema behavior, and concurrency, plus frontend tests for authentication, games, navigation, and profiles.

GitHub Actions runs the frontend tests, pytest suite, and Django tests against PostgreSQL on pushes and pull requests.

## Concurrency case

The most important business rule is preventing overbooking when multiple users request the final slot simultaneously.

The join workflow locks the game row inside a database transaction:

```python
with transaction.atomic():
    game = Game.objects.select_for_update().get(pk=pk)
```

A dedicated concurrent test verifies that two simultaneous requests cannot consume the same final slot.

## Development workflow

Requirements → database design → API design → implementation → validation → tests → documentation → containerized development/deployment preparation.
