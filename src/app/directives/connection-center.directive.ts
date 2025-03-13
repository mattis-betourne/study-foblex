import { Directive, ElementRef, OnDestroy, effect, inject } from '@angular/core';
import { FlowStateService } from '../services/flow-state.service';

@Directive({
  selector: '[appConnectionCenter]',
  standalone: true
})
export class ConnectionCenterDirective implements OnDestroy {
  private readonly el = inject(ElementRef);
  private readonly flowStateService = inject(FlowStateService);
  private readonly destroyer = effect(() => {
    const isDragging = this.flowStateService.draggingItemType();
    const element = this.el.nativeElement;
    
    if (isDragging) {
      element.innerHTML = `
        <div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center cursor-pointer hover:bg-green-200 transition-colors">
          <span class="text-green-600 text-xl">+</span>
        </div>
      `;
    } else {
      element.innerHTML = '';
    }
  });

  ngOnDestroy() {
    this.destroyer.destroy();
  }
}
