import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  ViewChild,
  inject
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FCanvasComponent, FFlowModule, FSelectionChangeEvent, FZoomDirective } from '@foblex/flow';
import { TemporaryNodeDirective } from '../../directives/temporary-node.directive';
import { Connection, CrmNode } from '../../models/crm.models';
import { FlowStateService } from '../../services/flow-state.service';
import { FlowService } from '../../services/flow.service';
import { TemporaryNodeService } from '../../services/temporary-node.service';
import { ZoomService } from '../../services/zoom.service';
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
    TemporaryNodeDirective,
    FlowToolbarComponent
  ],
  templateUrl: './flow-container.component.html',
  styleUrls: ['./flow-container.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FlowContainerComponent implements OnInit, AfterViewInit {
  /** Référence au composant canvas de Foblex Flow */
  @ViewChild('canvas') canvas!: FCanvasComponent;
  
  /** Référence au composant flow de Foblex Flow */
  @ViewChild('flow') flow!: FCanvasComponent;
  
  /** Référence à la directive de zoom */
  @ViewChild(FZoomDirective) zoomDirective!: FZoomDirective;
  
  /** Services injectés */
  readonly flowService = inject(FlowService);
  readonly zoomService = inject(ZoomService);
  readonly temporaryNodeService = inject(TemporaryNodeService);
  readonly flowStateService = inject(FlowStateService);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  
  constructor() {
    console.log('FlowContainer constructor - Initializing default nodes');
    // Initialiser les nœuds par défaut dans le constructeur
    this.flowService.addDefaultNode();
  }
  
  /**
   * Initialisation des souscriptions et des données
   */
  ngOnInit(): void {
    // Nettoyer toute trace d'états temporaires précédents
    this.flowStateService.clearTemporaryElements();
    
    // Vérifier que les nœuds ont été créés
    console.log('Nodes after initialization:', this.flowStateService.nodes());
    
    // S'abonner aux changements de draggingItemType
    this.temporaryNodeService.draggingItemType$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(itemType => {
        console.log('Drag item type changed to:', itemType);
        
        if (itemType) {
          // Quand le type change (début de drag), créer les nœuds temporaires
          this.temporaryNodeService.createTemporaryNodes(itemType);
          setTimeout(() => {
            this.changeDetectorRef.detectChanges();
            console.log('Created temporary nodes after drag start:', this.flowStateService.temporaryNodes().length);
          }, 50);
        }
      });
    
    // S'abonner aux changements de nœuds pour le débogage
    this.flowService.nodes$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(nodes => {
        console.log('Nodes updated:', nodes);
        // Forcer la détection de changements après chaque mise à jour des nœuds
        this.changeDetectorRef.detectChanges();
      });
    
    // S'abonner également aux changements de connexions pour la même raison
    this.flowService.connections$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(connections => {
        console.log('Connections updated:', connections);
        // Forcer la détection de changements après chaque mise à jour des connexions
        this.changeDetectorRef.detectChanges();
      });
  }
  
  /**
   * Initialisation après l'affichage du composant
   */
  ngAfterViewInit(): void {
    console.log('Canvas component:', this.canvas);
    console.log('Flow component:', this.flow);
    console.log('Zoom directive:', this.zoomDirective);
    
    queueMicrotask(() => {
      if (this.canvas) {
        // Passer la référence à la directive de zoom au service dédié
        if (this.zoomDirective) {
          console.log('Zoom directive:', this.zoomDirective);
          this.zoomService.setZoomDirective(this.zoomDirective);
          
          // Vérifier que la directive de zoom est bien initialisée
          try {
            const zoomValue = this.zoomDirective.getZoomValue();
            console.log('Initial zoom value:', zoomValue);
          } catch (error) {
            console.error('Error getting initial zoom value:', error);
          }
        } else {
          console.warn('Zoom directive not found');
        }
        
        this.canvas.resetScaleAndCenter(false);
        
        // Vérifier que le canvas est bien initialisé
        try {
          const scale = this.canvas.getScale();
          console.log('Initial canvas scale:', scale);
        } catch (error) {
          console.error('Error getting initial canvas scale:', error);
        }
      }
    });
  }
  
  /**
   * Gestionnaire pour l'événement de création d'un nœud de Foblex Flow
   * @param event L'événement de création de nœud
   */
  onCreateNode(event: any): void {
    try {
      console.log('Create node event received:', event);
      
      // Vérifier si nous sommes actuellement en cours de drag ou si des nœuds temporaires sont affichés
      // Dans ce cas, ne pas traiter l'événement fCreateNode pour éviter les duplications
      if (this.flowStateService.draggingItemType() || this.flowStateService.temporaryNodes().length > 0) {
        console.log('Ignoring fCreateNode event during drag or when temporary nodes exist');
        return;
      }

      // Extraire les propriétés de l'événement
      const { nodeType } = event;

      // Générer un identifiant unique pour le nouveau nœud
      const nodeId = `node-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      // Créer le nœud
      const newNode: CrmNode = {
        id: nodeId,
        type: nodeType,
        text: `${nodeType} ${this.flowStateService.nodes().length + 1}`,
        position: event.rect
      };

      // Ajouter le nœud et sauvegarder l'état
      this.flowService.addNodeAndSave(newNode);
      
      // Force la mise à jour de la vue
      this.changeDetectorRef.markForCheck();
    } catch (error) {
      console.error('Error creating node:', error);
    }
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
    // Si la touche Escape est pressée pendant un drag, nettoyer les nœuds temporaires
    if (event.key === 'Escape' && this.flowStateService.draggingItemType()) {
      console.log('Escape key pressed during drag, cleaning up');
      this.blockAndCleanUnauthorizedDrop();
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
   * Améliore la méthode blockAndCleanUnauthorizedDrop pour garantir le nettoyage complet
   * @private
   */
  private blockAndCleanUnauthorizedDrop(): void {
    // Nettoyer les indicateurs de classe visuels
    document.body.classList.remove('no-drop-allowed');
    
    // Vérifier s'il y a des nœuds "fantômes" créés par accident
    const nodeElements = document.querySelectorAll('[data-fnode]');
    nodeElements.forEach(nodeEl => {
      const nodeId = nodeEl.getAttribute('data-fnode');
      // Si ce nœud n'est pas dans notre liste et n'est pas un nœud temporaire, le supprimer
      if (nodeId && !this.flowStateService.nodes().some((n: CrmNode) => n.id === nodeId) && 
          !nodeEl.classList.contains('temporary-node')) {
        try {
          nodeEl.remove();
        } catch (e) {
          console.error('Error removing ghost node:', e);
        }
      }
    });
    
    // Nettoyer les nœuds temporaires pour éviter les problèmes d'état
    this.flowStateService.clearTemporaryElements();
    this.flowStateService.updateDraggingItemType(null);
    
    // Réinitialiser l'état de création
    this.flowStateService.updateIsCreatingNode(false);
    
    // Forcer la détection de changements pour mettre à jour l'UI
    this.changeDetectorRef.detectChanges();
    console.log('Drag state reset completed, temporary nodes cleared');
  }
  
  /**
   * Gestionnaire pour le survol pendant le drag
   * @param event L'événement dragover
   */
  onDragOver(event: DragEvent): void {
    // Ne rien faire si aucun élément n'est en cours de drag
    if (!this.flowStateService.draggingItemType()) {
      return;
    }
    
    // Permet le drop en annulant le comportement par défaut
    event.preventDefault();
    
    // Vérifier si nous sommes en train de survoler un nœud temporaire
    const elementsAtPoint = document.elementsFromPoint(event.clientX, event.clientY);
    const isOverTemporaryNode = elementsAtPoint.some(el => 
      el.classList.contains('temporary-node') || el.closest('.temporary-node') !== null
    );
    
    // Mise à jour du style du curseur et des classes visuelles
    if (isOverTemporaryNode) {
      document.body.classList.remove('no-drop-allowed');
      event.dataTransfer!.dropEffect = 'copy';
    } else {
      document.body.classList.add('no-drop-allowed');
      event.dataTransfer!.dropEffect = 'none';
    }
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
      
      // Ne pas ajouter de logique supplémentaire ici car le drop sera géré 
      // par l'événement dropOnNode émis par la directive appTemporaryNode
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
    
    // Si tout est valide, créer la connexion
    const newConnection: Connection = {
      id: `conn_${Date.now()}`,
      sourceId: event.outputId,
      targetId: event.inputId
    };
    
    // Ajouter la connexion
    this.flowService.addConnectionAndSave(newConnection);
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
   * Liste des sélections successives pour le débogage
   */
  selectionHistory: string[][] = [];
  
  /**
   * Gestionnaire de changement de sélection
   */
  onSelectionChange(event: FSelectionChangeEvent): void {
    console.log('Selection changed:', event.fNodeIds);
    this.selectionHistory.push(event.fNodeIds);
    this.flowStateService.updateSelectedNodes(event.fNodeIds);
  }
}