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
import { Connection, CrmNode } from '../../models/crm.models';
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
  
  /** Référence au composant flow de Foblex Flow */
  @ViewChild('flow') flow!: FFlowComponent;
  
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
   * Gestionnaire pour le drop sur un nœud temporaire
   * @param temporaryNodeId L'ID du nœud temporaire
   */
  onDropOnTemporaryNode(temporaryNodeId: string): void {
    console.log('Drop detected on temporary node:', temporaryNodeId);
    this.flowService.handleDropOnTemporaryNode(temporaryNodeId, this.changeDetectorRef);
  }
  
  /**
   * Gestionnaire d'événement global pour les dragend
   * @param event L'événement dragend
   */
  @HostListener('window:dragend', ['$event'])
  onGlobalDragEnd(event: DragEvent): void {
    // Nettoyer la classe visuelle d'interdiction dans tous les cas
    document.body.classList.remove('no-drop-allowed');
    
    if (this.flowStateService.draggingItemType()) {
      console.log('Global dragend event captured');
      
      // Vérifier si le drop est sur un nœud temporaire
      const elementsAtPoint = document.elementsFromPoint(event.clientX, event.clientY);
      const isOverTemporaryNode = elementsAtPoint.some(el => 
        el.classList.contains('temporary-node') || el.closest('.temporary-node') !== null
      );
      
      if (!isOverTemporaryNode) {
        console.log('Dragend occurred outside a temporary node, cleaning up');
        this.blockAndCleanUnauthorizedDrop();
      }
    }
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
   * Gestionnaire pour le survol pendant le drag
   * @param event L'événement dragover
   */
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    console.log('DragOver - draggingItemType:', this.flowStateService.draggingItemType());
    // Forcer la détection de changements
    this.changeDetectorRef.detectChanges();
  }
  
  /**
   * Gestionnaire pour le drop sur le canvas
   * @param event L'événement drop
   */
  onDrop(event: DragEvent): void {
    // Vérifier si nous sommes sur un nœud temporaire
    const elementsAtPoint = document.elementsFromPoint(event.clientX, event.clientY);
    const isOverTemporaryNode = elementsAtPoint.some(el => 
      el.classList.contains('temporary-node') || el.closest('.temporary-node') !== null
    );

    if (this.flowStateService.draggingItemType() && !isOverTemporaryNode) {
      // Si le drop est en dehors d'un nœud temporaire, bloquer et nettoyer
      event.preventDefault();
      event.stopPropagation();
      
      this.blockAndCleanUnauthorizedDrop();
      return;
    }
    
    // Continuer le traitement normal du drop si c'est sur un nœud temporaire
    if (this.flowStateService.draggingItemType() && isOverTemporaryNode) {
      event.preventDefault();
      
    }
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
   * Gestionnaire pour la création de connexion entre nœuds
   */
  onCreateConnection(event: any): void {
    console.log('Connection creation event:', event);
    
    // Vérifier si les deux extrémités de la connexion sont valides
    if (!event.outputId || !event.inputId) {
      console.error('Invalid connection endpoints:', event);
      return;
    }
    
    // Vérifier si la connexion est autorisée selon nos règles métier
    if (!this.flowService.canConnect(event.outputId, event.inputId)) {
      console.warn('Connection not allowed between', event.outputId, 'and', event.inputId);
      
      // Afficher un message d'erreur avec les noms des types de nœuds
      const sourceId = event.outputId.replace('output_', '');
      const targetId = event.inputId.replace('input_', '');
      const sourceNode = this.flowStateService.nodes().find((node: CrmNode) => node.id === sourceId);
      const targetNode = this.flowStateService.nodes().find((node: CrmNode) => node.id === targetId);
      
      if (sourceNode && targetNode) {
        this.showConnectionLimitMessage(
          `Connexion impossible entre "${sourceNode.type}" et "${targetNode.type}"`
        );
      }
      
      return;
    }
    
    // Si tout est valide, créer la connexion en utilisant le service centralisé
    this.flowService.addConnectionAndSave({
      id: `conn_${Date.now()}`,
      sourceId: event.outputId,
      targetId: event.inputId
    });
    
    // Demander une synchronisation des IDs après la création de la connexion
    setTimeout(() => this.foblexIdManager.requestSync(), 100);
  }
  
  /**
   * Affiche un message temporaire à l'utilisateur
   * @param message Le message à afficher
   */
  private showConnectionLimitMessage(message: string): void {
    // Créer un élément de message
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    messageElement.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-50';
    
    // Ajouter l'élément au DOM
    document.body.appendChild(messageElement);
    
    // Supprimer l'élément après 3 secondes
    setTimeout(() => {
      if (messageElement.parentNode) {
        messageElement.parentNode.removeChild(messageElement);
      }
    }, 3000);
  }

  /**
   * Détermine si une connexion est la branche supérieure ou inférieure d'un BinarySplit
   * @param connection La connexion à vérifier
   * @returns 'top' si c'est la branche supérieure, 'bottom' si c'est la branche inférieure, undefined sinon
   */
  getBinarySplitBranchType(connection: Connection): 'top' | 'bottom' | undefined {
    // Vérifier d'abord si la connexion provient d'un BinarySplit
    const sourceId = connection.sourceId.replace('output_', '');
    const sourceNode = this.flowStateService.nodes().find((node: CrmNode) => node.id === sourceId);
    if (!sourceNode || sourceNode.type !== 'BinarySplit') {
      return undefined;
    }
    
    // Trouver toutes les connexions sortantes du même BinarySplit
    const binarySplitConnections = this.flowStateService.connections().filter(
      (conn: Connection) => conn.sourceId === connection.sourceId
    );
    
    // S'il n'y a qu'une seule connexion, c'est par défaut 'top'
    if (binarySplitConnections.length === 1) {
      return 'top';
    }
    
    // S'il y a plusieurs connexions, déterminer laquelle est 'top' en fonction de la position verticale
    const targetNodes = binarySplitConnections.map((conn: Connection) => {
      const targetId = conn.targetId.replace('input_', '');
      return this.flowStateService.nodes().find((node: CrmNode) => node.id === targetId);
    }).filter(Boolean) as CrmNode[];
    
    // Trier les nœuds cibles par position Y (verticalement du haut vers le bas)
    targetNodes.sort((a, b) => a.position.y - b.position.y);
    
    // Déterminer le nœud cible actuel
    const currentTargetId = connection.targetId.replace('input_', '');
    const currentTarget = this.flowStateService.nodes().find((node: CrmNode) => node.id === currentTargetId);
    
    // Si le nœud cible actuel est le premier dans la liste triée (le plus haut), c'est 'top'
    if (currentTarget && targetNodes[0] && currentTarget.id === targetNodes[0].id) {
      return 'top';
    }
    
    // Sinon c'est 'bottom'
    return 'bottom';
  }
  
  /**
   * Détermine le numéro de branche d'un MultiSplit
   * @param connection La connexion à vérifier
   * @returns Le numéro de la branche (1-5), undefined si ce n'est pas un MultiSplit
   */
  getMultiSplitBranchNumber(connection: Connection): number | undefined {
    // Vérifier d'abord si la connexion provient d'un MultiSplit
    const sourceId = connection.sourceId.replace('output_', '');
    const sourceNode = this.flowStateService.nodes().find((node: CrmNode) => node.id === sourceId);
    if (!sourceNode || sourceNode.type !== 'MultiSplit') {
      return undefined;
    }
    
    // Trouver toutes les connexions sortantes du même MultiSplit
    const multiSplitConnections = this.flowStateService.connections().filter(
      (conn: Connection) => conn.sourceId === connection.sourceId
    );
    
    // S'il n'y a qu'une seule connexion, c'est la branche 1
    if (multiSplitConnections.length === 1) {
      return 1;
    }
    
    const targetNodes = multiSplitConnections.map((conn: Connection) => {
      const targetId = conn.targetId.replace('input_', '');
      return this.flowStateService.nodes().find((node: CrmNode) => node.id === targetId);
    }).filter(Boolean) as CrmNode[];
    
    // Trier les nœuds cibles par position Y (verticalement du haut vers le bas)
    targetNodes.sort((a, b) => a.position.y - b.position.y);
    
    // Déterminer le nœud cible actuel
    const currentTargetId = connection.targetId.replace('input_', '');
    const currentTarget = this.flowStateService.nodes().find((node: CrmNode) => node.id === currentTargetId);
    
    if (!currentTarget) return undefined;
    
    // Trouver l'index du nœud cible dans la liste triée et retourner ce numéro + 1
    const index = targetNodes.findIndex(node => node.id === currentTarget.id);
    return index >= 0 ? index + 1 : undefined;
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