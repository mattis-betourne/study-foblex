import { computed, Injectable, signal } from '@angular/core';

export interface ConfirmationDialog {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

@Injectable({
  providedIn: 'root'
})
export class ConfirmationService {
  private readonly _currentDialog = signal<ConfirmationDialog | null>(null);
  readonly currentDialog = computed(() => this._currentDialog());

  show(dialog: ConfirmationDialog): void {
    this._currentDialog.set(dialog);
  }

  confirm(): void {
    const dialog = this._currentDialog();
    if (dialog) {
      dialog.onConfirm();
      this._currentDialog.set(null);
    }
  }

  cancel(): void {
    const dialog = this._currentDialog();
    if (dialog && dialog.onCancel) {
      dialog.onCancel();
    }
    this._currentDialog.set(null);
  }
}
