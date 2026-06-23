## Important Note for Assessors

To use the discussion room correctly, the system requires at least:
- **`1 teacher account`**
- **`2 student accounts`**

Example demo accounts:

| Role | Email | Password | Personality |
|---|---|---|---|
| Teacher | `teacher@demo.com` | `123456` | None |
| Student | `cpt208@demo.com` | `cpt208` | Extroverted |
| Student | `bob@demo.com` | `123456` | Introverted |

This is because the **minimum discussion-group size** is **`2 students`**.

To demonstrate the full workflow successfully, please:
- **log in with one teacher account and two student accounts at the same time**
- **make sure the two students in the same session have different personality types**, for example, **one Extroverted and one Introverted**, to support more balanced participation
- use different browser windows, different browsers, or incognito windows if needed
- if an error appears such as **`Request failed with status 401`**, please use incognito windows or clear `localStorage` with `localStorage.clear()` in the browser Developer Tools
- **let both student accounts join the same session before the teacher starts grouping**

For step-by-step operating instructions, please also see [USER_GUIDE.md](USER_GUIDE.md).

# OpenMind Discussion Platform

An interactive web application for classroom group discussion, designed for the CPT208 Human-Centric Computing project.  
The system supports teacher-led discussion sessions, balanced group formation, real-time participation tracking, AI-based discussion guidance, user profiles and avatars, speaking logs, rejoin flows, and session analytics in a high-fidelity responsive interface.

## Live Demo

- Live URL: `http://111.170.157.76:9527/pages/login.html`
- Default entry page: [src/main/resources/static/pages/login.html](src/main/resources/static/pages/login.html)

## Source Repository

- GitHub Repository: `https://github.com/Nancy-Nan1019/CPT208-B1-System`

This project is a real interactive system rather than a static mock-up:
- users can register and log in
- teachers can create, group, start, monitor, and end discussion sessions
- students can join, participate, request AI guidance, review results, and rejoin active rooms
- the UI updates through APIs and real-time WebSocket messages


## Recent Feature Additions

The latest development work added several production-style features on top of the earlier baseline:
- student profile pages with avatar selection and personality updates
- a floating Omi AI assistant available across authenticated pages
- speaking-log history and full-session log views in the discussion room
- waiting-room rejoin support after grouping is ready
- richer teacher analytics with group, individual, and timeline views
- upgraded result pages with balance analysis and coin-style participation rewards

## Project Goals

The platform was designed to address common classroom discussion problems:
- unbalanced participation within small groups
- difficulty encouraging quieter students to speak
- limited teacher visibility across multiple groups at the same time
- lack of timely discussion prompts when conversations stall

Our solution combines:
- AI discussion guidance
- real-time feedback and participation visualisation
- balanced group allocation
- teacher-side monitoring and analytics
- a polished gamified discussion-room experience

## Core Features

The system already implements more than the minimum three required core features.

### 1. AI-Based Discussion Guidance

- Students can click `Ask AI Guide` during discussion to receive AI-generated prompts.
- The system can also trigger guidance for different situations such as silence or discussion wrap-up.
- Teachers can request AI guidance for specific groups during monitoring.

Relevant implementation:
- [AiGuideService.java](src/main/java/com/cpt208/discussionplatform/service/AiGuideService.java)
- [StudentController.java](src/main/java/com/cpt208/discussionplatform/controller/StudentController.java)
- [TeacherController.java](src/main/java/com/cpt208/discussionplatform/controller/TeacherController.java)

### 2. Real-Time Interactive Feedback

- Students use `Hold to Speak` to record speaking turns.
- Speaking time updates rankings, timelines, and participation views.
- Real-time state is synchronised through WebSocket broadcasting.
- Discussion-room UI includes leaderboard, speaking log, timer, AI companion, and race-track feedback.

Relevant implementation:
- [DiscussionSocketHandler.java](src/main/java/com/cpt208/discussionplatform/websocket/DiscussionSocketHandler.java)
- [websocket.js](src/main/resources/static/assets/js/common/websocket.js)
- [discussion-room.js](src/main/resources/static/assets/js/pages/discussion-room.js)

### 3. Balanced Grouping and Session Workflow

- Teachers create a session with topic, duration, and preferred group size.
- Students join the waiting room before the discussion begins.
- Teachers can auto-group students and manually move members if needed.
- Students are then routed into their own discussion groups.

Relevant implementation:
- [SessionController.java](src/main/java/com/cpt208/discussionplatform/controller/SessionController.java)
- [TeacherController.java](src/main/java/com/cpt208/discussionplatform/controller/TeacherController.java)
- [waiting-room.html](src/main/resources/static/pages/waiting-room.html)

### 4. Teacher Monitoring and Session Analytics

- Teachers can monitor live discussion progress across groups.
- The system provides session overview, speaking timeline, silent-group alerts, participation insights, and end-of-session results.
- Results can be exported as CSV.

Relevant implementation:
- [teacher-session.html](src/main/resources/static/pages/teacher-session.html)
- [teacher-session.js](src/main/resources/static/assets/js/pages/teacher-session.js)
- [TeacherController.java](src/main/java/com/cpt208/discussionplatform/controller/TeacherController.java)

### 5. User Profiles, Avatars, and Speaking History

- Students can update their avatar and personality after registration.
- Profile pages show identity, personality, avatar, and session coin summaries.
- The waiting room and discussion room preserve user state so learners can return to the correct session after temporary navigation.
- Speaking logs are visible in the discussion room and the session result page.

Relevant implementation:
- [student-settings.js](src/main/resources/static/assets/js/pages/student-settings.js)
- [waiting-room.js](src/main/resources/static/assets/js/pages/waiting-room.js)
- [discussion-room.js](src/main/resources/static/assets/js/pages/discussion-room.js)
- [session-result.js](src/main/resources/static/assets/js/pages/session-result.js)

### 6. Floating Omi Assistant

- An Omi assistant widget is available on authenticated pages for quick guidance.
- Users can ask where to find features, what to do next, or how a page works.
- The assistant is draggable and remembers its position locally.

Relevant implementation:
- [ai-assistant.js](src/main/resources/static/assets/js/common/ai-assistant.js)
- [AiChatController.java](src/main/java/com/cpt208/discussionplatform/controller/AiChatController.java)

## User Experience and Interface

This project provides a high-fidelity interface rather than low-fidelity wireframes:
- separate teacher and student flows
- polished visual design with reusable design tokens and component styles
- responsive layouts for PC and mobile devices
- animated feedback in discussion room
- gamified participation visuals using avatars, race-track progress, checkpoints, and AI companion UI

Main UI files:
- [tokens.css](src/main/resources/static/assets/css/tokens.css)
- [base.css](src/main/resources/static/assets/css/base.css)
- [components.css](src/main/resources/static/assets/css/components.css)
- [pages.css](src/main/resources/static/assets/css/pages.css)
- [responsive.css](src/main/resources/static/assets/css/responsive.css)

## System Workflow

### Teacher Flow

1. Register or log in as a teacher.
2. Create a discussion session.
3. Wait for students to join the waiting room.
4. Auto-group or manually adjust group members.
5. Start the session.
6. Monitor live participation and group activity.
7. End the session and review/export results.

### Student Flow

1. Register or log in as a student.
2. Choose a personality type on first login and optionally update the avatar in the profile page.
3. Join an available discussion session in the waiting room.
4. Check the allocated group and enter the discussion room.
5. Use `Hold to Speak` to participate.
6. Request AI guidance or use the floating Omi assistant when needed.
7. Review speaking logs, coins, and speaking results after the session ends.

## Responsive Design

The system is designed to run well on both desktop and smaller screens.

Evidence in the codebase:
- shared responsive stylesheet: [responsive.css](src/main/resources/static/assets/css/responsive.css)
- page-level media queries in [pages.css](src/main/resources/static/assets/css/pages.css)
- mobile-friendly interaction handling in discussion room, including touch events for speaking input

## Tech Stack

### Frontend

- HTML5
- CSS3
- Vanilla JavaScript
- ECharts for analytics visualisation

### Backend

- Spring Boot 2.7
- Spring Security
- Spring WebSocket
- Spring Data JPA

### Data and Services

- MySQL
- Redis
- JWT authentication
- DeepSeek API for AI prompt generation

### Build Tool

- Maven

See:
- [pom.xml](pom.xml)
- [application.yml](src/main/resources/application.yml)

## Local Configuration

The current `application.yml` supports environment-variable overrides for local development and deployment:
- `DB_URL`
- `DB_USERNAME`
- `DB_PASSWORD`
- `REDIS_HOST`
- `REDIS_PORT`
- `REDIS_PASSWORD`
- `JWT_SECRET`
- `JWT_ACCESS_TOKEN_DAYS`
- `CORS_ALLOWED_ORIGIN`
- `DEEPSEEK_API_KEY`

If these are not set, the app falls back to localhost-oriented defaults.

## AI Coding Logs

This repository includes an [`ai-logs/`](ai-logs) folder that records the primary English prompts used during AI-assisted development and documentation work.

The current AI log categories include:
- UI redesign and visual-system prompts
- gamification and playful interaction prompts
- avatar, rejoin, and session-flow prompts
- documentation, portfolio, and video-demo prompts
- backend architecture and system-integration prompts
- debugging, deployment, and collaboration prompts
- testing and validation prompts

## Accessibility Evidence

The interface follows several basic accessibility-oriented practices visible in the current implementation:

- keyboard focus states are styled for interactive controls, helping users track navigation through buttons, inputs, and action elements
- responsive layouts are provided through shared responsive stylesheets and page-level media queries, supporting desktop and smaller-screen use
- reduced-motion handling is considered through `prefers-reduced-motion` rules for users who may be sensitive to animation
- standard HTML forms and buttons are used throughout the login, session, and discussion workflows to preserve familiar browser interaction patterns
- manual accessibility-oriented QA was used during review, including checks for focus visibility, readable layout structure, touch interaction, and general usability during multi-page flows

This project does not claim full formal accessibility certification, but it aims to follow basic web-standards practice and maintain usable interaction patterns across its main flows.

## Testing and Validation

The project has been evaluated mainly through iterative functional testing and scenario-based walkthroughs rather than a full automated test suite.

Typical validation scenarios include:
- teacher registration, login, and session creation
- student join flow through waiting room and discussion room
- auto-grouping and manual group adjustment
- `Hold to Speak` interaction and real-time ranking updates
- AI guide requests during discussion
- teacher-side monitoring and end-of-session result review
- multi-client checks for avatar consistency, WebSocket synchronisation, and rejoin behaviour

Supporting AI-assisted testing prompts are recorded in [`ai-logs/`](ai-logs).

## How the System Handles User Input and Interaction State

This system processes both normal form input and real-time interaction state.

### User Input

The system receives user input through:
- registration and login forms
- teacher session creation form
- waiting-room join actions
- speaking start and stop actions
- AI guide requests
- teacher group-management actions

### Backend Processing

After input is submitted:
- the frontend sends requests to REST endpoints
- Spring Boot controllers validate and route the requests
- services apply business logic
- JPA repositories persist entities to MySQL
- session and auth-related state is handled through JWT and Redis-backed blacklist logic

### Real-Time State Synchronisation

During live discussion:
- speaking state is broadcast through WebSocket
- ranking and participation changes are pushed to connected clients
- the frontend updates member cards, timeline, leaderboard, and race-track visuals in near real time

Relevant files:
- [AuthController.java](src/main/java/com/cpt208/discussionplatform/controller/AuthController.java)
- [StudentController.java](src/main/java/com/cpt208/discussionplatform/controller/StudentController.java)
- [TeacherController.java](src/main/java/com/cpt208/discussionplatform/controller/TeacherController.java)
- [DiscussionSocketHandler.java](src/main/java/com/cpt208/discussionplatform/websocket/DiscussionSocketHandler.java)

## Project Structure

```text
open-mind-system
|- src/main/java/com/cpt208/discussionplatform
|  |- config
|  |- controller
|  |- dto
|  |- entity
|  |- repository
|  |- service
|  `- websocket
|- src/main/resources
|  |- application.yml
|  |- db/init.sql
|  `- static
|     |- assets
|     |  |- css
|     |  |- images
|     |  `- js
|     `- pages
|- ai-logs
|- pom.xml
|- USER_GUIDE.md
`- README.md
```

## Local Setup

### Prerequisites

- JDK 8 or above
- Maven 3.6 or above

### Run Locally

```bash
mvn clean package -DskipTests
java -jar target/discussion-platform-1.0.0.jar
```

Then open:

```text
http://localhost:9527
```

If you need to override the default local database or Redis settings, set the environment variables before starting the app.

### Alternative Run Method

You can also run:
- `DiscussionPlatformApplication.java` directly in IntelliJ IDEA

Main entry:
- [DiscussionPlatformApplication.java](src/main/java/com/cpt208/discussionplatform/DiscussionPlatformApplication.java)

## Deployment

### Current Deployment Approach

This repository is currently structured as an integrated Spring Boot web application:
- backend APIs and WebSocket services run in Spring Boot
- static frontend pages are served from the same application
- the system reads MySQL, Redis, JWT, CORS, and AI settings from environment variables with local defaults in `application.yml`

In the current project setup, local development can use the default localhost values, while deployment can point to remote services by exporting the matching environment variables.

This makes the current deployment model suitable for:
- cloud virtual machines
- Java application hosting
- platforms such as Render, Railway, or similar Java-capable services

### About GitHub Pages / Vercel

GitHub Pages is suitable only for static frontend hosting.  
Because this project requires:
- Java backend services
- WebSocket support
- MySQL
- Redis

the complete system cannot be deployed as a full working product on GitHub Pages alone.

If needed, the frontend could be separated and hosted independently on a platform such as Vercel, while the Spring Boot backend remains deployed on a Java-capable cloud service.

## Example Accounts for Demonstration

Example demo accounts referenced in the project documentation:

| Role | Email | Password |
|---|---|---|
| Teacher | `teacher@demo.com` | `123456` |
| Student | `alice@demo.com` | `123456` |
| Student | `bob@demo.com` | `123456` |
| Student | `carol@demo.com` | `123456` |

## Suggested Demo Script

1. Log in as teacher.
2. Create a session with a short duration.
3. Open two or more student accounts in separate browser windows.
4. Join the waiting room from the student side.
5. Form groups and start the discussion from the teacher side.
6. Use `Hold to Speak` on the student side.
7. Observe real-time updates in the teacher monitor.
8. Trigger AI guide in the discussion room.
9. End the session and open the result page.


## Course Requirement Mapping

This project addresses the coursework requirements as follows:

- `Functional interactive prototype`: implemented through login, session creation, grouping, live discussion, AI guidance, monitoring, and result pages
- `High-fidelity user experience`: polished multi-page UI with reusable styling system and responsive layouts
- `Modern deployment`: deployable as a Spring Boot cloud web application with public URL access
- `Responsive design`: desktop and mobile-aware layouts
- `At least 3 core features`: AI guidance, real-time participation feedback, teacher analytics, and grouping workflow
- `Source repository with setup guidance`: this README documents setup, architecture, and technical stack
- `Data processing`: user input, participation state, scores, logs, and AI prompts are processed through backend services and persisted data models

## Notes

- For assessment or presentation, the most important evidence is:
  - live URL
  - a functioning teacher flow
  - a functioning student flow
  - real-time discussion updates
  - AI guide interaction
