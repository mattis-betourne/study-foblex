import { Directive, ElementRef, HostListener, inject, input, output } from '@angular/core';

@Directive({
  selector: '[appDropZone]',
  standalone: true
})
export class DropZoneDirective {
  connectionId = input.required<string>();
  dropOnConnection = output<string>();
  
  private readonly el = inject(ElementRef);
  dropOnNode = output<string>();

  @HostListener('pointerdown', ['$event'])
  onPointerDown(event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

    @HostListener('pointerup', ['$event'])
    onPointerUp(event: PointerEvent): void {
        event.preventDefault();
        event.stopPropagation();
        
        this.dropOnConnection.emit(this.connectionId());
    }
  
  @HostListener('click', ['$event'])
  onClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dropOnConnection.emit(this.connectionId());
  }
  
  @HostListener('drop', ['$event'])
  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dropOnConnection.emit(this.connectionId());
  }
}
