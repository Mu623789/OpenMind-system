document.addEventListener('DOMContentLoaded', function () {
    const openingGif = qs('#loginOpeningGif');
    const openingFreeze = qs('#loginOpeningFreeze');
    const form = qs('#loginForm');
    const toggle = qs('#modeToggle');
    const title = qs('#pageTitle');
    const submit = qs('#submitButton');
    const submitText = qs('#submitButtonText');
    const toggleText = qs('#modeToggleText');
    const subtitle = qs('#loginCardSubtitle');
    const message = qs('#message');
    const ideaIcon = qs('#omiIdeaIcon');
    const dropZone = qs('#omiDropZone');
    const audienceTabs = qsa('.login-audience-tab');
    let mode = 'login';
    let audience = 'STUDENT';

    function revealOmiIntro() {
        if (document.body.classList.contains('omi-intro-ready')) {
            return;
        }
        document.body.classList.add('omi-intro-ready');
        setTimeout(function () {
            document.body.classList.add('omi-idea-ready');
        }, 1900);
    }

    function freezeOpeningFrame() {
        if (!openingGif || !openingFreeze) {
            revealOmiIntro();
            return;
        }

        try {
            const canvas = openingFreeze;
            const width = openingGif.naturalWidth || window.innerWidth;
            const height = openingGif.naturalHeight || window.innerHeight;
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext('2d');
            context.drawImage(openingGif, 0, 0, width, height);
            document.body.classList.add('omi-opening-complete');
        } catch (error) {
            document.body.classList.add('omi-opening-complete');
        }

        setTimeout(revealOmiIntro, 40);
    }

    const gifDurationMs = 3880;

    function startOpeningSequence() {
        setTimeout(function () {
            freezeOpeningFrame();
        }, gifDurationMs);
    }

    if (!openingGif) {
        revealOmiIntro();
    } else if (openingGif.complete && openingGif.naturalWidth > 0) {
        startOpeningSequence();
    } else if (openingGif.complete) {
        revealOmiIntro();
    } else {
        openingGif.addEventListener('load', startOpeningSequence, { once: true });
        openingGif.addEventListener('error', revealOmiIntro, { once: true });
        setTimeout(revealOmiIntro, 1200);
    }

    function startExperience() {
        if (!document.body.classList.contains('login-started')) {
            document.body.classList.add('login-started');
        }
        if (dropZone) {
            dropZone.classList.add('activated');
        }
        setTimeout(function () {
            qs('#email').focus();
        }, 260);
    }

    if (ideaIcon && dropZone) {
        ideaIcon.addEventListener('dragstart', function (event) {
            event.dataTransfer.setData('text/plain', 'omi-idea');
            ideaIcon.classList.add('dragging');
        });

        ideaIcon.addEventListener('dragend', function () {
            ideaIcon.classList.remove('dragging');
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('dragover', function (event) {
            event.preventDefault();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', function () {
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', function (event) {
            event.preventDefault();
            dropZone.classList.remove('drag-over');
            startExperience();
        });

        ideaIcon.addEventListener('click', function () {
            dropZone.classList.add('drag-over');
            setTimeout(function () {
                startExperience();
            }, 180);
        });
    }

    audienceTabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
            audience = tab.getAttribute('data-audience') || 'STUDENT';
            updateAudienceTabs();
            updateAuthView();
        });
    });

    toggle.addEventListener('click', function () {
        mode = mode === 'login' ? 'register' : 'login';
        updateAuthView();
    });

    updateAuthView();

    form.addEventListener('submit', async function (event) {
        event.preventDefault();
        try {
            const payload = {
                email: qs('#email').value.trim(),
                password: qs('#password').value.trim()
            };
            let data;
            if (mode === 'register') {
                payload.name = qs('#name').value.trim();
                payload.role = audience;
                if (audience === 'STUDENT') {
                    var selectedAvatar = qs('input[name="avatar"]:checked');
                    payload.avatar = selectedAvatar ? selectedAvatar.value : 'kitty.png';
                }
                data = await apiRequest('/auth/register', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
            } else {
                data = await apiRequest('/auth/login', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
            }
            saveAccessToken(data.accessToken);
            if (mode === 'register' && audience === 'STUDENT' && data.user && !data.user.avatar) {
                data.user.avatar = payload.avatar;
            }
            saveCurrentUser(data.user);
            showMessage(message, mode === 'login' ? 'Login successful' : 'Registration successful');
            if (data.user.role === 'STUDENT') {
                if (data.user.personality) {
                    window.location.href = './waiting-room.html';
                } else {
                    window.location.href = './onboarding.html';
                }
            } else {
                window.location.href = './teacher-dashboard.html';
            }
        } catch (error) {
            showMessage(message, error.message, true);
        }
    });

    function updateAudienceTabs() {
        audienceTabs.forEach(function (tab) {
            var isActive = tab.getAttribute('data-audience') === audience;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
    }

    function updateAuthView() {
        var isStudent = audience === 'STUDENT';
        var isRegister = mode === 'register';
        title.textContent = (isStudent ? 'Student' : 'Teacher') + ' ' + (isRegister ? 'Register' : 'Login');
        subtitle.textContent = isRegister
            ? (isStudent ? 'Create your student profile and choose an avatar for discussion.' : 'Create your teacher account to manage live discussion sessions.')
            : (isStudent ? 'Sign in to join your live discussion session.' : 'Sign in to manage sessions, groups, and results.');
        submitText.textContent = isRegister ? 'Register' : 'Login';
        submit.querySelector('.btn-icon').textContent = isRegister ? '\u2728' : '\uD83D\uDE80';
        qs('#nameRow').style.display = isRegister ? 'block' : 'none';
        qs('#name').required = isRegister;
        qs('#avatarRow').style.display = isRegister && isStudent ? 'block' : 'none';
        toggleText.textContent = isRegister ? 'Already have an account? Login' : 'No account? Register';
        toggle.querySelector('.btn-icon').textContent = isRegister ? '\uD83D\uDD11' : '\u270F\uFE0F';
    }
});
