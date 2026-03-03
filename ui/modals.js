let activeModal = null;

export function showModal(title, content, onClose) {
    closeModal();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-header">
            <h2>${title}</h2>
            <button class="modal-close">×</button>
        </div>
        <div class="modal-body">${content}</div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal(onClose);
    });

    modal.querySelector('.modal-close').addEventListener('click', () => closeModal(onClose));

    document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') {
            closeModal(onClose);
            document.removeEventListener('keydown', escHandler);
        }
    });

    activeModal = overlay;
    return modal.querySelector('.modal-body');
}

export function closeModal(onClose) {
    if (activeModal) {
        activeModal.remove();
        activeModal = null;
        if (onClose) onClose();
    }
}

export function showConfirm(title, message, onConfirm, onCancel) {
    const body = showModal(title, `
        <p>${message}</p>
        <div class="modal-actions">
            <button class="btn-accent modal-confirm-btn">Confirm</button>
            <button class="btn-secondary modal-cancel-btn">Cancel</button>
        </div>
    `);

    body.querySelector('.modal-confirm-btn').addEventListener('click', () => {
        closeModal();
        if (onConfirm) onConfirm();
    });

    body.querySelector('.modal-cancel-btn').addEventListener('click', () => {
        closeModal();
        if (onCancel) onCancel();
    });
}
