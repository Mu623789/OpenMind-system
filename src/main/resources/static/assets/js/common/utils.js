function qs(selector) {
    return document.querySelector(selector);
}

function qsa(selector) {
    return Array.from(document.querySelectorAll(selector));
}

function escapeText(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function showMessage(element, message, isError = false, persistent = false) {
    element.textContent = message;
    element.style.color = isError ? '#ef4444' : '#10b981';
    if (element._msgTimer) clearTimeout(element._msgTimer);
    if (!persistent) {
        element._msgTimer = setTimeout(function () {
            element.textContent = '';
        }, isError ? 5000 : 3000);
    }
}
