import { Directive, ElementRef, HostListener, input, output, inject } from '@angular/core';

/**
 * Directive pour gérer les nœuds temporaires dans le flow
 */
@Directive({
  selector: '[appTemporaryNode]',
  standalone: true
})
export class TemporaryNodeDirective {
  /** ID du nœud temporaire */
  nodeId = input.required<string>();
  
  /** Event émis quand un drop a lieu sur le nœud temporaire */
  dropOnNode = output<string>();
  
  private readonly el = inject(ElementRef);
  
  /**
   * Gestionnaire d'événement pour le pointerdown sur le nœud
   * @param event L'événement pointerdown
   */
  @HostListener('pointerdown', ['$event'])
  onPointerDown(event: PointerEvent): void {
    // Empêcher la propagation pour éviter que le canvas ne gère l'événement
    event.preventDefault();
    event.stopPropagation();
  }
  
  /**
   * Gestionnaire d'événement pour le pointerup sur le nœud
   * @param event L'événement pointerup
   */
  @HostListener('pointerup', ['$event'])
  onPointerUp(event: PointerEvent): void {
    // Empêcher la propagation pour éviter que le canvas ne gère l'événement
    event.preventDefault();
    event.stopPropagation();
    
    // Émettre l'événement pour notifier qu'un drop a eu lieu sur ce nœud
    this.dropOnNode.emit(this.nodeId());
  }
  
  /**
   * Gestionnaire d'événement pour le click sur le nœud
   * @param event L'événement click
   */
  @HostListener('click', ['$event'])
  onClick(event: MouseEvent): void {
    // Empêcher la propagation pour éviter que le canvas ne gère l'événement
    event.preventDefault();
    event.stopPropagation();
    
    // Émettre l'événement pour notifier qu'un drop a eu lieu sur ce nœud
    this.dropOnNode.emit(this.nodeId());
  }
  
  /**
   * Empêche l'événement de création de nœud lorsqu'un drop est détecté sur un nœud temporaire
   * @param event L'événement drop
   */
  @HostListener('drop', ['$event'])
  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    
    // Émettre l'événement pour notifier qu'un drop a eu lieu sur ce nœud
    this.dropOnNode.emit(this.nodeId());
  }
} 