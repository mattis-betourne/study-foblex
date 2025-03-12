import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnInit,
  QueryList,
  ViewChild,
  ViewChildren,
  inject
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FCanvasComponent, FFlowModule, FFlowComponent, FSelectionChangeEvent, FZoomDirective } from '@foblex/flow';
import { TemporaryNodeDirective } from '../../directives/temporary-node.directive';
import { Connection, CrmNode } from '../../models/crm.models';
import { FlowStateService } from '../../services/flow-state.service';
import { FlowService } from '../../services/flow.service';
import { TemporaryNodeService } from '../../services/temporary-node.service';
import { ZoomService } from '../../services/zoom.service';
import { FlowToolbarComponent } from '../flow-toolbar/flow-toolbar.component';
import { FoblexIdManagerService } from '../../services/foblex-id-manager.service';

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
  private readonly destroyRef = inject(DestroyRef);
  private readonly elementRef = inject(ElementRef);
  
  /** Observer pour détecter les modifications DOM */
  private mutationObserver: MutationObserver | null = null;
  
  /** Flag pour éviter les synchronisations en cascade */
  private isSynchronizing = false;
  
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
    
    // Écouter les événements de synchronisation ID
    document.addEventListener('foblex-id-sync-required', this.handleSyncRequest);
    
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
        
        // Synchroniser les IDs avec Foblex Flow uniquement si nécessaire
        // (si des nœuds n'ont pas d'ID Foblex et qu'aucune synchronisation n'est en cours)
        if (!this.isSynchronizing && nodes.some(n => !n.foblexId)) {
          console.log('Some nodes need to be synchronized with Foblex');
          setTimeout(() => this.syncFoblexIds(), 100);
        }
      });
    
    // S'abonner également aux changements de connexions pour la même raison
    this.flowService.connections$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(connections => {
        console.log('Connections updated:', connections);
        // Forcer la détection de changements après chaque mise à jour des connexions
        this.changeDetectorRef.detectChanges();
        
        // Synchroniser les IDs avec Foblex Flow uniquement si nécessaire
        // (si des connexions n'ont pas d'ID Foblex et qu'aucune synchronisation n'est en cours)
        if (!this.isSynchronizing && connections.length > 0 && connections.some(c => !c.foblexId)) {
          console.log('Some connections need to be synchronized with Foblex');
          setTimeout(() => this.syncFoblexIds(), 100);
        }
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
      
      // Mettre en place l'observateur de mutations DOM pour détecter
      // les ajouts/suppressions de nœuds et connexions
      this.setupMutationObserver();
      
      // Effectuer une première synchronisation des ID après le rendu initial
      setTimeout(() => this.syncFoblexIds(), 300);
    });
  }
  
  /**
   * Configure l'observateur de mutations pour surveiller les changements DOM
   */
  private setupMutationObserver(): void {
    if (!this.elementRef || !this.elementRef.nativeElement) {
      console.error('ElementRef not available for mutation observer');
      return;
    }
    
    // Créer l'observateur de mutations
    this.mutationObserver = new MutationObserver((mutations) => {
      let shouldSync = false;
      
      // Vérifier si des nœuds ou connexions ont été ajoutés/supprimés
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const node of Array.from(mutation.addedNodes)) {
            if (node instanceof HTMLElement) {
              if (node.hasAttribute('fnode') || node.tagName.toLowerCase() === 'f-connection') {
                shouldSync = true;
                break;
              }
            }
          }
          
          if (shouldSync) break;
          
          for (const node of Array.from(mutation.removedNodes)) {
            if (node instanceof HTMLElement) {
              if (node.hasAttribute('fnode') || node.tagName.toLowerCase() === 'f-connection') {
                shouldSync = true;
                break;
              }
            }
          }
        }
      }
      
      // Si des nœuds/connexions ont été modifiés, synchroniser les IDs
      if (shouldSync) {
        console.log('DOM mutation detected, synchronizing Foblex IDs');
        this.syncFoblexIds();
      }
    });
    
    // Démarrer l'observation du DOM en surveillant les enfants
    this.mutationObserver.observe(this.elementRef.nativeElement, {
      childList: true,
      subtree: true
    });
    
    console.log('Mutation observer setup complete');
  }
  
  /**
   * Nettoie les ressources lors de la destruction du composant
   */
  ngOnDestroy(): void {
    // Arrêter l'observateur de mutations
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
    
    // Retirer l'écouteur d'événement de synchronisation ID
    document.removeEventListener('foblex-id-sync-required', this.handleSyncRequest);
  }
  
  /**
   * Gestionnaire pour l'événement de synchronisation ID
   * Défini comme méthode distincte pour pouvoir le supprimer proprement
   */
  private handleSyncRequest = (): void => {
    console.log('Received foblex-id-sync-required event');
    
    // Ne pas déclencher de synchronisation si une est déjà en cours
    if (this.isSynchronizing) {
      console.log('Synchronization already in progress, ignoring request');
      return;
    }
    
    setTimeout(() => this.syncFoblexIds(), 100);
  };
  
  /**
   * Synchronise les IDs entre notre modèle et Foblex Flow
   */
  private syncFoblexIds(): void {
    // Si une synchronisation est déjà en cours, annuler
    if (this.isSynchronizing) {
      console.log('Synchronization already in progress, skipping');
      return;
    }
    
    if (!this.elementRef || !this.elementRef.nativeElement) {
      console.warn('ElementRef not available for ID synchronization');
      return;
    }
    
    // Vérifier d'abord si une synchronisation est nécessaire
    const unsyncedNodesCount = this.flowStateService.nodes().filter(n => !n.foblexId).length;
    const unsyncedConnectionsCount = this.flowStateService.connections().filter(c => !c.foblexId).length;
    
    if (unsyncedNodesCount === 0 && unsyncedConnectionsCount === 0 && 
        this.flowStateService.nodes().length > 0) {
      console.log('All nodes and connections are already synchronized, skipping');
      return;
    }
    
    // Activer le flag de synchronisation
    this.isSynchronizing = true;
    
    console.log('Starting Foblex ID synchronization');
    
    // Synchroniser les nœuds
    const nodeElements = this.elementRef.nativeElement.querySelectorAll('[fnode]');
    console.log(`Found ${nodeElements.length} node elements in DOM`);
    
    nodeElements.forEach((nodeElement: HTMLElement, index: number) => {
      // Ignorer les nœuds temporaires
      if (nodeElement.classList.contains('temporary-node')) {
        return;
      }
      
      // Récupérer les IDs Foblex
      const foblexId = this.foblexIdManager.getNodeFoblexIdFromElement(nodeElement);
      const dataNodeId = nodeElement.getAttribute('data-node-id');
      
      console.log(`Node Element ${index}: foblexId=${foblexId}, dataNodeId=${dataNodeId}`);
      
      if (foblexId) {
        // Trouver notre ID interne à partir de la correspondance avec les attributs data-node-id
        if (dataNodeId) {
          const node = this.flowStateService.nodes().find(n => n.id === dataNodeId);
          if (node) {
            console.log(`Synchronizing node ${node.id} with Foblex ID ${foblexId}`);
            this.foblexIdManager.syncNodeIds(node, foblexId);
          } else {
            console.warn(`Could not find node with id ${dataNodeId} in our state`);
          }
        } else {
          // Si nous n'avons pas de data-node-id, essayer de trouver le nœud par position
          console.log(`No data-node-id for element with foblexId ${foblexId}, trying to match by position`);
          
          // Extraire la position du style transform
          const transform = nodeElement.style.transform;
          const match = transform.match(/translate\((\d+)px,\s*(\d+)px\)/);
          
          if (match && match.length >= 3) {
            const x = parseInt(match[1], 10);
            const y = parseInt(match[2], 10);
            
            // Chercher un nœud avec une position proche
            const matchingNode = this.flowStateService.nodes().find(n => 
              Math.abs(n.position.x - x) < 10 && Math.abs(n.position.y - y) < 10
            );
            
            if (matchingNode) {
              console.log(`Found node by position match: ${matchingNode.id} at (${x}, ${y})`);
              this.foblexIdManager.syncNodeIds(matchingNode, foblexId);
            }
          }
        }
      }
    });
    
    // Synchroniser les connexions
    const connectionElements = this.elementRef.nativeElement.querySelectorAll('f-connection');
    console.log(`Found ${connectionElements.length} connection elements in DOM`);
    
    connectionElements.forEach((connectionElement: HTMLElement, index: number) => {
      // Ignorer les connexions temporaires
      if (connectionElement.classList.contains('temporary-connection')) {
        return;
      }
      
      // Récupérer l'ID Foblex
      const foblexId = this.foblexIdManager.getConnectionFoblexIdFromElement(connectionElement);
      
      // Récupérer l'ID de la connexion à partir de l'attribut data-connection-id
      const dataConnectionId = connectionElement.getAttribute('data-connection-id');
      
      console.log(`Connection Element ${index}: foblexId=${foblexId}, dataConnectionId=${dataConnectionId}`);
      
      if (foblexId) {
        // D'abord, essayer de trouver la connexion par son attribut data-connection-id
        if (dataConnectionId) {
          const connection = this.flowStateService.connections().find(c => c.id === dataConnectionId);
          if (connection) {
            console.log(`Synchronizing connection ${connection.id} with Foblex ID ${foblexId}`);
            this.foblexIdManager.syncConnectionIds(connection, foblexId);
            // Connexion trouvée et synchronisée, on passe à la suivante
            return;
          } else {
            console.warn(`Could not find connection with id ${dataConnectionId} in our state`);
          }
        }
        
        // Méthode alternative : analyser les source/target IDs dans le path
        const pathId = connectionElement.querySelector('[data-f-path-id]');
        if (pathId) {
          const pathIdValue = pathId.getAttribute('data-f-path-id');
          if (pathIdValue) {
            // Extraire les IDs de source et cible à partir de l'ID du path
            // Format typique: connection_f-connection-1output_XXXinput_YYY
            const match = pathIdValue.match(/connection_(f-connection-\d+)(output_[^i]+)(input_[^"]+)/);
            if (match && match.length >= 4) {
              const sourceId = match[2];
              const targetId = match[3];
              
              console.log(`Connection path parsed: sourceId=${sourceId}, targetId=${targetId}`);
              
              // Trouver la connexion correspondante dans notre état
              const connection = this.flowStateService.connections().find(
                c => c.sourceId === sourceId && c.targetId === targetId
              );
              
              if (connection) {
                console.log(`Synchronizing connection ${connection.id} with Foblex ID ${foblexId}`);
                this.foblexIdManager.syncConnectionIds(connection, foblexId);
              } else {
                console.warn(`Could not find connection with sourceId=${sourceId} and targetId=${targetId} in our state`);
              }
            } else {
              console.warn(`Could not parse connection path ID: ${pathIdValue}`);
            }
          }
        }
      }
    });
    
    // Vérification finale
    const syncedNodesCount = this.flowStateService.nodes().filter(n => !!n.foblexId).length;
    const syncedConnectionsCount = this.flowStateService.connections().filter(c => !!c.foblexId).length;
    
    console.log(`Foblex ID synchronization completed. Synced: ${syncedNodesCount}/${this.flowStateService.nodes().length} nodes, ${syncedConnectionsCount}/${this.flowStateService.connections().length} connections`);
    
    // Désactiver le flag de synchronisation après un petit délai pour éviter 
    // les déclenchements immédiats après la mise à jour du state
    setTimeout(() => {
      this.isSynchronizing = false;
    }, 200);
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
    
    // Si tout est valide, créer la connexion en utilisant le service centralisé
    this.flowService.addConnectionAndSave({
      id: `conn_${Date.now()}`,
      sourceId: event.outputId,
      targetId: event.inputId
    });
    
    // Planifier une synchronisation des IDs après la création de la connexion
    setTimeout(() => this.syncFoblexIds(), 100);
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
    
    // Tentative additionnelle de synchronisation si nécessaire
    if (event.fNodeIds.length > 0) {
      // On s'assure d'abord que tous les IDs Foblex sont correctement synchronisés
      let allNodesSynced = true;
      
      for (const foblexId of event.fNodeIds) {
        // Vérifier si ce foblexId est déjà mappé à un ID interne
        const internalId = this.foblexIdManager.getInternalIdFromFoblexId(foblexId);
        if (!internalId) {
          console.log(`Foblex ID ${foblexId} not yet mapped to an internal ID, will try to sync`);
          allNodesSynced = false;
          
          // Essayer de trouver l'élément DOM correspondant à ce foblexId
          const nodeElement = this.elementRef.nativeElement.querySelector(`[data-f-node-id="${foblexId}"]`);
          if (nodeElement) {
            // Tenter un mapping par position
            const transform = nodeElement.style.transform;
            const match = transform.match(/translate\((\d+)px,\s*(\d+)px\)/);
            
            if (match && match.length >= 3) {
              const x = parseInt(match[1], 10);
              const y = parseInt(match[2], 10);
              
              // Chercher un nœud avec une position proche
              const matchingNode = this.flowStateService.nodes().find(n => 
                Math.abs(n.position.x - x) < 10 && Math.abs(n.position.y - y) < 10
              );
              
              if (matchingNode) {
                console.log(`Found node by position match: ${matchingNode.id} at (${x}, ${y}), will sync with Foblex ID ${foblexId}`);
                this.foblexIdManager.syncNodeIds(
                  matchingNode, 
                  foblexId
                );
              }
            }
          }
        }
      }
      
      // Si tous les nœuds ne sont pas synchronisés, on force une synchronisation complète
      if (!allNodesSynced) {
        console.log('Some nodes not synced, forcing complete synchronization');
        this.syncFoblexIds();
      }
    }
    
    // Conversion des IDs Foblex en IDs internes avec plus de logs
    const internalIds = event.fNodeIds
      .map(foblexId => {
        const internalId = this.foblexIdManager.getInternalIdFromFoblexId(foblexId);
        if (!internalId) {
          console.warn(`No internal ID mapping found for Foblex ID: ${foblexId}`);
        }
        return internalId;
      })
      .filter((id): id is string => id !== undefined);
    
    console.log('Selection changed (internal IDs):', internalIds);
    
    this.selectionHistory.push(event.fNodeIds);
    this.flowStateService.updateSelectedNodes(internalIds);
  }

  /**
   * Méthode pour obtenir l'ID Foblex Flow d'un node à partir de notre ID interne
   * @param nodeId Notre ID interne de nœud
   * @returns L'ID Foblex Flow correspondant ou undefined
   */
  getFoblexNodeId(nodeId: string): string | undefined {
    const node = this.flowStateService.nodes().find(n => n.id === nodeId);
    return node?.foblexId;
  }
  
  /**
   * Convertit un ID Foblex Flow en notre ID interne
   * @param foblexId L'ID Foblex Flow
   * @returns Notre ID interne correspondant ou undefined
   */
  getInternalIdFromFoblex(foblexId: string): string | undefined {
    return this.foblexIdManager.getInternalIdFromFoblexId(foblexId);
  }
}