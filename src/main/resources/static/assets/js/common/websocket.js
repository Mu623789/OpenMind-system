let discussionSocket;

function connectDiscussionSocket(sessionId, onMessage, handlers) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socketHost = window.location.host;
    const token = getAccessToken();
    discussionSocket = new WebSocket(protocol + '//' + socketHost + '/ws/discussion?sessionId=' + encodeURIComponent(sessionId) + '&token=' + encodeURIComponent(token || ''));
    discussionSocket.onopen = function () {
        if (handlers && typeof handlers.onOpen === 'function') {
            handlers.onOpen();
        }
    };
    discussionSocket.onmessage = function (event) {
        const data = JSON.parse(event.data);
        onMessage(data);
    };
    discussionSocket.onerror = function () {
        if (handlers && typeof handlers.onError === 'function') {
            handlers.onError();
        }
    };
    discussionSocket.onclose = function () {
        if (handlers && typeof handlers.onClose === 'function') {
            handlers.onClose();
        }
    };
    return discussionSocket;
}

function disconnectDiscussionSocket() {
    if (discussionSocket && discussionSocket.readyState === WebSocket.OPEN) {
        discussionSocket.close();
    }
}
