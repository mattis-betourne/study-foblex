import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ConfirmationService } from '../../services/confirmation.service';

@Component({
  selector: 'app-confirmation-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (dialog()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div class="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
          <h2 class="text-xl font-bold mb-4">{{ dialog()?.title }}</h2>
          <p class="mb-6 text-gray-600">{{ dialog()?.message }}</p>
          <div class="flex justify-end gap-4">
            <button
              (click)="onCancel()"
              class="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium rounded-md hover:bg-gray-100">
              {{ dialog()?.cancelLabel || 'Annuler' }}
            </button>
            <button
              (click)="onConfirm()"
              class="px-4 py-2 bg-red-600 text-white font-medium rounded-md hover:bg-red-700">
              {{ dialog()?.confirmLabel || 'Confirmer' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmationDialogComponent {
  private readonly confirmationService = inject(ConfirmationService);
  protected readonly dialog = this.confirmationService.currentDialog;

  onConfirm(): void {
    this.confirmationService.confirm();
  }

  onCancel(): void {
    this.confirmationService.cancel();
  }
}
