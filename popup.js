// popup.js
(function () {
    function ensurePopupBase() {
        if (!document.getElementById('custom-popup-overlay')) {
            const overlay = document.createElement('div');
            overlay.id = 'custom-popup-overlay';
            overlay.className = 'custom-popup-overlay';
            overlay.innerHTML = `
                <div class="custom-popup info" id="custom-popup-box">
                    <div class="custom-popup-top">
                        <div class="custom-popup-icon" id="custom-popup-icon">ℹ️</div>
                        <div class="custom-popup-title" id="custom-popup-title">Title</div>
                        <div class="custom-popup-message" id="custom-popup-message">Message</div>
                    </div>
                    <div class="custom-popup-actions" id="custom-popup-actions"></div>
                </div>
            `;
            document.body.appendChild(overlay);

            overlay.addEventListener('click', function (e) {
                if (e.target === overlay) {
                    hidePopup();
                }
            });
        }

        if (!document.getElementById('custom-toast-container')) {
            const toastContainer = document.createElement('div');
            toastContainer.id = 'custom-toast-container';
            toastContainer.className = 'custom-toast-container';
            document.body.appendChild(toastContainer);
        }
    }

    function getPopupIcon(type) {
        switch (type) {
            case 'success': return '✨';
            case 'error': return '⚠️';
            case 'warning': return '⚡';
            default: return '💙';
        }
    }

    function showPopup(options) {
        ensurePopupBase();

        const overlay = document.getElementById('custom-popup-overlay');
        const popupBox = document.getElementById('custom-popup-box');
        const icon = document.getElementById('custom-popup-icon');
        const title = document.getElementById('custom-popup-title');
        const message = document.getElementById('custom-popup-message');
        const actions = document.getElementById('custom-popup-actions');

        const type = options.type || 'info';
        popupBox.className = `custom-popup ${type}`;
        icon.textContent = options.icon || getPopupIcon(type);
        title.textContent = options.title || 'Notice';
        message.textContent = options.message || '';
        actions.innerHTML = '';

        const buttons = options.buttons || [
            {
                text: 'OK',
                className: 'primary',
                onClick: function () {
                    hidePopup();
                }
            }
        ];

        buttons.forEach(btn => {
            const button = document.createElement('button');
            button.className = `custom-popup-btn ${btn.className || 'primary'}`;
            button.textContent = btn.text || 'OK';
            button.onclick = function () {
                if (typeof btn.onClick === 'function') {
                    btn.onClick();
                } else {
                    hidePopup();
                }
            };
            actions.appendChild(button);
        });

        overlay.classList.add('show');
    }

    function hidePopup() {
        const overlay = document.getElementById('custom-popup-overlay');
        if (overlay) {
            overlay.classList.remove('show');
        }
    }

    function showToast(options) {
        ensurePopupBase();

        const container = document.getElementById('custom-toast-container');
        const type = options.type || 'info';
        const icon = options.icon || getPopupIcon(type);

        const toast = document.createElement('div');
        toast.className = `custom-toast ${type}`;
        toast.innerHTML = `
            <div class="custom-toast-icon">${icon}</div>
            <div class="custom-toast-content">
                <h4>${escapeHtml(options.title || 'Notice')}</h4>
                <p>${escapeHtml(options.message || '')}</p>
            </div>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(20px)';
            toast.style.transition = 'all 0.25s ease';
            setTimeout(() => toast.remove(), 250);
        }, options.duration || 3000);
    }

    function showConfirm(options) {
        showPopup({
            type: options.type || 'warning',
            icon: options.icon || '🤔',
            title: options.title || 'Are you sure?',
            message: options.message || 'Please confirm this action.',
            buttons: [
                {
                    text: options.cancelText || 'Cancel',
                    className: 'secondary',
                    onClick: function () {
                        hidePopup();
                        if (typeof options.onCancel === 'function') {
                            options.onCancel();
                        }
                    }
                },
                {
                    text: options.confirmText || 'Yes',
                    className: 'primary',
                    onClick: function () {
                        hidePopup();
                        if (typeof options.onConfirm === 'function') {
                            options.onConfirm();
                        }
                    }
                }
            ]
        });
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    window.showPopup = showPopup;
    window.hidePopup = hidePopup;
    window.showToastPopup = showToast;
    window.showConfirmPopup = showConfirm;
})();