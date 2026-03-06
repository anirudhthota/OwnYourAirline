import { showModal as legacyShowModal, closeModal as legacyCloseModal, showConfirm as legacyShowConfirm } from '../modals.js';

// We wrap the existing modals logic here for structural consistency
// In V2, we would construct DOM elements explicitly here instead of depending on ../modals.js

export function Modal() {
    return `<!-- Modals are attached dynamically to document.body, not inline -->`;
}

export const showModal = legacyShowModal;
export const closeModal = legacyCloseModal;
export const showConfirm = legacyShowConfirm;
