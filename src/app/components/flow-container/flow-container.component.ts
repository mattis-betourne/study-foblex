import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnInit,
  ViewChild,
  effect,
  inject
} from '@angular/core';
import { FCanvasComponent, FFlowComponent, FFlowModule, FSelectionChangeEvent, FZoomDirective } from '@foblex/flow';
import { ConnectionCenterDirective } from '../../directives/connection-center.directive';
import { DropZoneDirective } from '../../directives/drop-zone.directive';
import { FlowStateService } from '../../services/flow-state.service';
import { FlowService } from '../../services/flow.service';
import { FoblexIdManagerService } from '../../services/foblex-id-manager.service';
import { TemporaryNodeService } from '../../services/temporary-node.service';
import { ZoomService } from '../../services/zoom.service';
import { ConfirmationDialogComponent } from '../confirmation-dialog/confirmation-dialog.component';
import { FlowToolbarComponent } from '../flow-toolbar/flow-toolbar.component';

/**
 * Composant qui encapsule le flow diagram
 */
@Component({
  selector: 'app-flow-container',
  standalone: true,
  imports: [
    CommonModule,
    FFlowModule,
    FlowToolbarComponent,
    ConfirmationDialogComponent,
    DropZoneDirective,
    ConnectionCenterDirective
  ],
  templateUrl: './flow-container.component.html',
  styleUrls: ['./flow-container.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FlowContainerComponent implements OnInit, AfterViewInit {
  /** Référence au composant canvas de Foblex Flow */
  @ViewChild('canvas') canvas!: FCanvasComponent;

  /** Référence à la directive de zoom */
  @ViewChild(FZoomDirective) zoomDirective!: FZoomDirective;
  
  /** Référence à l'élément conteneur DOM */
  @ViewChild('flowContainer', { static: true }) flowContainerRef!: ElementRef;
  
  /** Services injectés */
  readonly flowService = inject(FlowService);
  readonly zoomService = inject(ZoomService);
  readonly temporaryNodeService = inject(TemporaryNodeService);
  readonly flowStateService = inject(FlowStateService);
  readonly foblexIdManager = inject(FoblexIdManagerService);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly elementRef = inject(ElementRef);

  constructor() {
    console.log('FlowContainer constructor - Initializing default nodes');
    // Initialiser les nœuds par défaut dans le constructeur
    this.flowService.addDefaultNode();
    
    // Effet pour réagir aux changements de draggingItemType
    effect(() => {
      const itemType = this.flowStateService.draggingItemType();
      console.log('Drag item type changed to:', itemType);
      
      this.changeDetectorRef.detectChanges();
      
    });
    
    // Effets pour surveiller les changements de nœuds et de connexions
    effect(() => {
      // Lire les nœuds pour surveiller les changements
      const nodes = this.flowStateService.nodes();
      console.log('Nodes updated:', nodes);
      
      // Forcer la détection de changements après chaque mise à jour des nœuds
      this.changeDetectorRef.detectChanges();
    });
    
    effect(() => {
      // Lire les connexions pour surveiller les changements
      const connections = this.flowStateService.connections();
      console.log('Connections updated:', connections);
      
      // Forcer la détection de changements après chaque mise à jour des connexions
      this.changeDetectorRef.detectChanges();
    });
  }
  
  /**
   * Initialisation des souscriptions et des données
   */
  ngOnInit(): void {
    // Nettoyer toute trace d'états temporaires précédents
    this.flowStateService.clearTemporaryElements();
  }
  
  /**
   * Initialisation après l'affichage du composant
   */
  ngAfterViewInit(): void {
    queueMicrotask(() => {
      if (this.canvas) {
        // Passer la référence à la directive de zoom au service dédié
        if (this.zoomDirective) {
          this.zoomService.setZoomDirective(this.zoomDirective);
        }
        
        this.canvas.resetScaleAndCenter(false);
      }
      
      // Effectuer une première synchronisation des ID après le rendu initial
      setTimeout(() => this.foblexIdManager.performSync(this.elementRef.nativeElement), 300);
    });
  }
  
  /**
   * Gestionnaire d'événement global pour les touches (pour capturer Escape)
   * @param event L'événement clavier
   */
  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    // Si la touche Delete/Suppr ou Backspace est pressée
    if ((event.key === 'Delete' || event.key === 'Del' || event.key === 'Backspace' || event.keyCode === 46) && 
        !this.flowStateService.draggingItemType()) {
      
      const selectedNodeId = this.flowStateService.getSelectedNodeId();
      if (selectedNodeId) {
        // Empêcher d'autres actions de l'événement
        event.preventDefault();
        event.stopPropagation();
        
        // Utiliser la suppression intelligente
        this.flowService.smartDelete(selectedNodeId);
        
        // Effacer la sélection après la suppression
        this.flowStateService.updateSelectedNodes([]);
        
        // Forcer la mise à jour du composant
        this.changeDetectorRef.markForCheck();
      }
    }
  }
  
  /**
   * Gestionnaire d'événement global pour les mouseup (pour capturer les fins de drag potentielles)
   * @param event L'événement mouseup
   */
  @HostListener('window:mouseup', ['$event'])
  onGlobalMouseUp(event: MouseEvent): void {
    // Si un drag est en cours, vérifier si le mouseup n'est pas sur un nœud temporaire
    if (this.flowStateService.draggingItemType()) {
      const elementsAtPoint = document.elementsFromPoint(event.clientX, event.clientY);
      const isOverTemporaryNode = elementsAtPoint.some(el => 
        el.classList.contains('temporary-node') || el.closest('.temporary-node') !== null
      );
      
      if (!isOverTemporaryNode) {
        console.log('Mouse up detected outside a temporary node during drag, cleaning up');
        this.blockAndCleanUnauthorizedDrop();
      }
    }
  }
  
  /**
   * Nettoie les éléments temporaires et bloque un drop non autorisé
   */
  blockAndCleanUnauthorizedDrop(): void {
    // Nettoyer les éléments temporaires via le service centralisé
    this.flowStateService.clearTemporaryElements();
    
    // Réinitialiser le type d'élément en cours de drag
    this.flowStateService.updateDraggingItemType(null);
    
    // Nettoyer la classe visuelle d'interdiction
    document.body.classList.remove('no-drop-allowed');
  }
  
  /**
   * Gestionnaire pour commencer le drag
   * @param itemType Le type d'élément en cours de drag
   */
  onDragStart(itemType: string): void {
    console.log('Flow container direct drag start with item type:', itemType);
    // Utilisation de la nouvelle méthode startDragging
    this.flowService.startDragging(itemType);
  }
  
  /**
   * Gestionnaire pour terminer le drag
   */
  onDragEnd(): void {
    this.resetDragState();
  }
  
  /**
   * Réinitialise l'état de drag
   * @private
   */
  private resetDragState(): void {
    // Utilisation de la nouvelle méthode endDragging
    this.flowService.endDragging();
    // Réinitialiser l'état de création
    this.flowStateService.updateIsCreatingNode(false);
    
    // Forcer la détection de changements
    this.changeDetectorRef.detectChanges();
  }
  
  /**
   * Gestionnaire de changement de sélection
   */
  onSelectionChange(event: FSelectionChangeEvent): void {
    console.log(this.flowStateService.nodes());
    console.log(this.flowStateService.connections());
    // Ne traiter que si des nœuds sont effectivement sélectionnés
    if (event.fNodeIds.length > 0) {
      // Convertir les IDs Foblex en IDs internes
      const internalIds = event.fNodeIds
        .map(foblexId => this.foblexIdManager.getInternalIdFromFoblexId(foblexId))
        .filter((id): id is string => id !== undefined);
      
      // Mettre à jour les nœuds sélectionnés via le service d'état
      this.flowStateService.updateSelectedNodes(internalIds);
      
      // Demander une synchronisation si certains IDs n'ont pas été trouvés
      if (internalIds.length < event.fNodeIds.length) {
        setTimeout(() => this.foblexIdManager.requestSync(), 0);
      }
    } else {
      // Si aucun nœud n'est sélectionné, effacer la sélection actuelle
      this.flowStateService.updateSelectedNodes([]);
    }
  }

  onDropOnConnection(connectionId: string): void {
    const itemType = this.flowStateService.draggingItemType();
    if (!itemType) return;
    
    this.temporaryNodeService.handleDropOnConnection(connectionId, itemType);
    this.changeDetectorRef.detectChanges();
  }
}