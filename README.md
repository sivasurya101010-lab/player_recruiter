# Player Recruitment Platform

A backend platform for finding and joining casual sports games when players are needed.

## Problem

Sometimes a group of people wants to play a casual game of football, cricket, badminton, or another sport but doesn't have enough players.

For example:

> 5 players are ready for a football game, but they need 2 more players.

The platform allows users to create a game and recruit nearby players who are interested in joining.

## Core Idea

The platform works like a **live recruitment board for casual sports games**.

Users can:

* Create a game
* Specify the sport, date, time, location, and required players
* Discover available games
* View game details
* Join a game
* Leave a game
* Manage games they created

Once the required number of players is reached, the game becomes full and new players cannot join.

## Planned MVP

### Authentication

* User registration
* JWT login
* JWT token refresh
* User profile
* Secure password handling

### Sports

* Sports management
* Supported sports
* Sport-specific information

### Games

* Create a game
* View game details
* List available games
* Filter games
* Join a game
* Leave a game
* Cancel a game
* Automatically mark games as full

### Location

* Game location
* Location-based game discovery

## Technology Stack

### Backend

* Python
* Django
* Django REST Framework

### Database

* PostgreSQL

### Authentication

* JWT
* Django authentication system

### Development Tools

* Git
* GitHub
* Postman

## Project Structure

```text
PlayerRecruitment/
│
├── config/
│   ├── __init__.py
│   ├── settings.py
│   ├── urls.py
│   ├── asgi.py
│   └── wsgi.py
│
├── users/
│   ├── migrations/
│   ├── admin.py
│   ├── apps.py
│   ├── models.py
│   ├── serializers.py
│   ├── urls.py
│   ├── views.py
│   └── tests.py
│
├── manage.py
├── .env
├── .gitignore
└── requirements.txt
```

## Current Development Status

### Phase 1 — Project Setup

* [x] Django project setup
* [x] Django REST Framework setup
* [x] PostgreSQL setup
* [x] Environment variables
* [x] Database configuration
* [x] Git setup

### Phase 2 — User & Authentication

* [x] Custom User model
* [x] Django admin integration
* [x] JWT authentication setup
* [x] Registration serializer
* [x] Registration API
* [x] JWT login API
* [x] JWT refresh API

### Upcoming

* [ ] Sports system
* [ ] Game creation
* [ ] Game discovery
* [ ] Player joining
* [ ] Authorization
* [ ] Game management
* [ ] Location-based discovery
* [ ] Concurrency handling
* [ ] Notifications
* [ ] Automated tests
* [ ] API documentation
* [ ] Deployment

## API Structure

The planned API will follow a structure similar to:

```text
/api/auth/
    ├── register/
    ├── login/
    └── refresh/

/api/sports/
    └── ...

/api/games/
    ├── create/
    ├── ...
    └── ...
```

## Important Backend Considerations

A major requirement of the platform is preventing overbooking when multiple users try to join the last available slot simultaneously.

For example:

```text
Game capacity: 7

Current players: 6

User A ──┐
         ├── Join request
User B ──┘
```

Only one user should successfully receive the final slot.

The backend will therefore need proper transaction handling and database-level concurrency control.

## Development Philosophy

The project is being developed incrementally following a real-world backend development workflow:

```text
Requirements
     ↓
Database Design
     ↓
API Design
     ↓
Implementation
     ↓
Validation
     ↓
Testing
     ↓
Documentation
     ↓
Deployment
```

The goal is not only to build a working application, but also to demonstrate practical backend engineering concepts such as:

* REST API design
* Authentication and authorization
* Database relationships
* Validation
* Transactions
* Concurrency control
* Query optimization
* Testing
* API documentation
* Deployment

## Future Features

After the MVP, the platform may support:

* Player ratings
* Player reliability scores
* Waitlists
* Recurring games
* Notifications
* Real-time chat
* WebSockets
* Maps
* Ground booking
* Payments
* Game history
* Advanced recommendations

## Status

🚧 **Under active development**
