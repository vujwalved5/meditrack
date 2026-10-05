/**
 * UI Components & Helpers
 * Button, ConfirmDialog, Tooltip, Toast
 */

/**
 * Render a standard button string
 */
export function renderButton({
  variant = 'primary', // primary | secondary | ghost | danger-text
  size = 'md',        // md (40px) | sm (32px)
  text = '',
  iconId = null,
  iconRightId = null,
  onClick = '',
  ariaLabel = '',
  id = '',
  extraClass = '',
  disabled = false,
  type = 'button',
}) {
  const iconHtml = iconId
    ? `<svg class="btn-icon" aria-hidden="true" width="16" height="16"><use href="#${iconId}"/></svg>`
    : '';
  const iconRightHtml = iconRightId
    ? `<svg class="btn-icon-right" aria-hidden="true" width="16" height="16"><use href="#${iconRightId}"/></svg>`
    : '';
  const labelAttr = ariaLabel ? ` aria-label="${escapeAttr(ariaLabel)}"` : '';
  const idAttr = id ? ` id="${escapeAttr(id)}"` : '';
  const clickAttr = onClick ? ` onclick="${onClick}"` : '';
  const disabledAttr = disabled ? ' disabled' : '';

  return `<button type="${type}" class="btn btn-${variant} btn-${size} ${extraClass}"${idAttr}${labelAttr}${clickAttr}${disabledAttr}>${iconHtml}<span>${text}</span>${iconRightHtml}</button>`;
}

function escapeAttr(s) {
  return String(s || '').replace(/"/g, '&quot;');
}

/**
 * Confirm Dialog Controller
 */
export class ConfirmDialogController {
  constructor() {
    this.activeTrigger = null;
    this.onConfirmCallback = null;
    this.onCancelCallback = null;
  }

  open({
    title = 'Confirm',
    body = '',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isDestructive = false,
    triggerElement = null,
    onConfirm = null,
    onCancel = null,
  }) {
    this.activeTrigger = triggerElement || document.activeElement;
    this.onConfirmCallback = onConfirm;
    this.onCancelCallback = onCancel;

    let modal = document.getElementById('global-confirm-dialog');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'global-confirm-dialog';
      modal.className = 'confirm-dialog-backdrop';
      modal.setAttribute('role', 'presentation');
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="confirm-dialog-box" role="dialog" aria-modal="true" aria-labelledby="confirm-dlg-title" aria-describedby="confirm-dlg-body">
        <h3 id="confirm-dlg-title" class="confirm-dlg-title">${title}</h3>
        <p id="confirm-dlg-body" class="confirm-dlg-body">${body}</p>
        <div class="confirm-dlg-actions">
          <button type="button" class="btn btn-secondary btn-sm" id="confirm-dlg-cancel">${cancelText}</button>
          <button type="button" class="btn ${isDestructive ? 'btn-danger' : 'btn-primary'} btn-sm" id="confirm-dlg-confirm">${confirmText}</button>
        </div>
      </div>
    `;

    modal.style.display = 'flex';

    const cancelBtn = modal.querySelector('#confirm-dlg-cancel');
    const confirmBtn = modal.querySelector('#confirm-dlg-confirm');

    const closeDialog = () => {
      modal.style.display = 'none';
      document.removeEventListener('keydown', keyHandler);
      if (this.activeTrigger && typeof this.activeTrigger.focus === 'function') {
        this.activeTrigger.focus();
      }
    };

    const handleConfirm = () => {
      closeDialog();
      if (typeof this.onConfirmCallback === 'function') {
        this.onConfirmCallback();
      }
    };

    const handleCancel = () => {
      closeDialog();
      if (typeof this.onCancelCallback === 'function') {
        this.onCancelCallback();
      }
    };

    cancelBtn.onclick = handleCancel;
    confirmBtn.onclick = handleConfirm;

    modal.onclick = (e) => {
      if (e.target === modal) handleCancel();
    };

    const keyHandler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      } else if (e.key === 'Tab') {
        const focusables = [cancelBtn, confirmBtn];
        if (e.shiftKey) {
          if (document.activeElement === focusables[0]) {
            focusables[1].focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === focusables[1]) {
            focusables[0].focus();
            e.preventDefault();
          }
        }
      }
    };

    document.addEventListener('keydown', keyHandler);

    // Initial focus: Cancel for destructive, Confirm for standard
    if (isDestructive) {
      cancelBtn.focus();
    } else {
      confirmBtn.focus();
    }
  }
}

/**
 * Toast notification system with Undo support (P3-03)
 */
export class ToastController {
  constructor() {
    this.container = null;
  }

  ensureContainer() {
    if (!this.container || !document.body.contains(this.container)) {
      this.container = document.getElementById('toast-container');
      if (!this.container) {
        this.container = document.createElement('div');
        this.container.id = 'toast-container';
        this.container.className = 'toast-container';
        this.container.setAttribute('aria-live', 'polite');
        document.body.appendChild(this.container);
      }
    }
    return this.container;
  }

  show({ message, type = 'info', duration = 4000, onUndo = null }) {
    const c = this.ensureContainer();
    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;
    toast.setAttribute('role', 'status');

    let undoBtn = '';
    if (onUndo) {
      undoBtn = `<button type="button" class="toast-undo-btn">Undo</button>`;
    }

    toast.innerHTML = `
      <span class="toast-msg">${message}</span>
      ${undoBtn}
      <button type="button" class="toast-close-btn" aria-label="Dismiss notification">&times;</button>
    `;

    c.appendChild(toast);

    let dismissed = false;
    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      toast.classList.add('toast-fadeout');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 200);
    };

    if (onUndo) {
      const uBtn = toast.querySelector('.toast-undo-btn');
      if (uBtn) {
        uBtn.onclick = () => {
          dismiss();
          onUndo();
        };
      }
    }

    const closeBtn = toast.querySelector('.toast-close-btn');
    if (closeBtn) closeBtn.onclick = dismiss;

    if (type !== 'error' && duration > 0) {
      setTimeout(dismiss, duration);
    }

    return { dismiss };
  }
}

export const confirmDialog = new ConfirmDialogController();
export const toast = new ToastController();

if (typeof window !== 'undefined') {
  window.renderButton = renderButton;
  window.confirmDialog = confirmDialog;
  window.toast = toast;
}
