import { Directive, ElementRef, HostListener, Input, Output, EventEmitter } from '@angular/core';

/**
 * Directive pour gérer les nœuds temporaires dans le flow
 */
@Directive({
  selector: '[appTemporaryNode]',
  standalone: true
})
export class TemporaryNodeDirective {
  /** ID du nœud temporaire */
  @Input() nodeId!: string;
  /** Event émis quand un drop a lieu sur le nœud temporaire */
  @Output() dropOnNode = new EventEmitter<string>();
  
  constructor(private el: ElementRef) {}
  
  /**
   * Gestionnaire d'événement pour le pointerdown sur le nœud
   * @param event L'événement pointerdown
   */
  @HostListener('pointerdown', ['$event'])
  onPointerDown(event: PointerEvent) {
    // Empêcher la propagation pour éviter que le canvas ne gère l'événement
    event.stopPropagation();
  }
  
  /**
   * Gestionnaire d'événement pour le pointerup sur le nœud
   * @param event L'événement pointerup
   */
  @HostListener('pointerup', ['$event'])
  onPointerUp(event: PointerEvent) {
    // Empêcher la propagation pour éviter que le canvas ne gère l'événement
    event.preventDefault();
    event.stopPropagation();
    
    // Émettre l'événement pour notifier qu'un drop a eu lieu sur ce nœud
    this.dropOnNode.emit(this.nodeId);
  }
  
  /**
   * Gestionnaire d'événement pour le click sur le nœud
   * @param event L'événement click
   */
  @HostListener('click', ['$event'])
  onClick(event: MouseEvent) {
    // Empêcher la propagation pour éviter que le canvas ne gère l'événement
    event.preventDefault();
    event.stopPropagation();
    
    // Émettre l'événement pour notifier qu'un drop a eu lieu sur ce nœud
    this.dropOnNode.emit(this.nodeId);
  }
} 