import { 
  Component, 
  ViewChild, 
  AfterViewInit, 
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  HostListener, 
  OnInit, 
  OnDestroy, 
  inject,
  DestroyRef
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FFlowModule, FCanvasComponent, FZoomDirective } from '@foblex/flow';
import { FlowService } from '../../services/flow.service';
import { TemporaryNodeDirective } from '../../directives/temporary-node.directive';
import { FlowToolbarComponent } from '../flow-toolbar/flow-toolbar.component';
import { Connection, CrmNode } from '../../models/crm.models';

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
    console.log('FlowContainer ngOnInit - Starting initialization');
    
    // Vérifier que les nœuds ont été créés
    console.log('Nodes after initialization:', this.flowService.nodes);
    
    // S'abonner aux changements de draggingItemType
    this.flowService.draggingItemType$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(itemType => {
        console.log('FlowContainer detected draggingItemType change:', itemType);
        if (itemType) {
          // Quand le type change (début de drag), créer les nœuds temporaires
          this.flowService.createTemporaryNodes(itemType);
          setTimeout(() => {
            this.changeDetectorRef.detectChanges();
            console.log('Created temporary nodes after drag start:', this.flowService.temporaryNodes.length);
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
  }
  
  /**
   * Initialisation après l'affichage du composant
   */
  ngAfterViewInit(): void {
    console.log('Canvas component:', this.canvas);
    console.log('Flow component:', this.flow);
    console.log('Zoom directive:', this.zoomDirective);
    
    // Utiliser queueMicrotask au lieu de setTimeout pour respecter le cycle de détection Angular
    queueMicrotask(() => {
      if (this.canvas) {
        // Passer la référence au canvas au service
        this.flowService.setCanvasRef(this.canvas);
        
        // Passer la référence à la directive de zoom au service
        if (this.zoomDirective) {
          this.flowService.setZoomDirective(this.zoomDirective);
          
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
    console.log('Create node event received:', event);
    
    // Blocage strict si nous sommes en cours de drag ou de création
    if (this.flowService.draggingItemType || this.flowService.isCreatingNode) {
      console.log('STRICT BLOCKING: Node creation blocked during drag or creation');
      
      // Empêcher la création du nœud et tout traitement ultérieur
      if (event.preventDefault) event.preventDefault();
      if (event.stopPropagation) event.stopPropagation();
      
      // Supprimer immédiatement tout élément qui pourrait avoir été créé
      this.blockAndCleanUnauthorizedDrop();
      
      return; // Sortir de la fonction sans créer de nœud
    }
    
    // Procéder avec la création de nœud normale
    if (!event) {
      console.error('Invalid event object:', event);
      return;
    }
    
    try {
      const nodeType = event.data as string || 'Default';
      
      console.log('Node type:', nodeType);
      console.log('Node position:', event.rect);
      
      // Créer et ajouter un nouveau nœud via le service
      this.flowService.addNode({
        id: crypto.randomUUID(),
        type: nodeType,
        text: `${nodeType} ${this.flowService.nodes.length + 1}`,
        position: event.rect
      });
      
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
    this.flowService.handleDropOnTemporaryNode(temporaryNodeId, this.changeDetectorRef);
  }
  
  /**
   * Gestionnaire pour le pointerup sur le canvas (hors nœuds)
   * @param event L'événement pointerup
   */
  onCanvasPointerUp(event: PointerEvent): void {
    if (this.flowService.draggingItemType && !this.flowService.isCreatingNode) {
      console.log('Canvas pointerup event detected during drag');
      
      // Bloquer l'événement pour empêcher toute propagation
      event.preventDefault();
      event.stopPropagation();
      
      // Vérifier si l'élément sous le pointeur est un nœud temporaire
      const elementsAtPoint = document.elementsFromPoint(event.clientX, event.clientY);
      
      // Chercher un nœud temporaire
      const temporaryNodeElement = elementsAtPoint.find(el => 
        el.classList.contains('temporary-node') || el.closest('.temporary-node') !== null
      );
      
      if (temporaryNodeElement) {
        // Trouver l'ID du nœud temporaire
        const temporaryNode = temporaryNodeElement.classList.contains('temporary-node') 
          ? temporaryNodeElement 
          : temporaryNodeElement.closest('.temporary-node');
        
        if (temporaryNode) {
          // Extraire l'ID du nœud temporaire
          const nodeId = temporaryNode.getAttribute('data-node-id');
          if (nodeId) {
            console.log('Drop detected over temporary node:', nodeId);
            
            // Créer immédiatement le nœud
            this.onDropOnTemporaryNode(nodeId);
            return;
          }
        }
      }
      
      console.log('Canvas pointer up occurred outside a temporary node, cleaning up');
      
      // Empêcher la création de nœud en dehors des zones recommandées
      // Supprimer immédiatement tout élément créé par erreur
      this.blockAndCleanUnauthorizedDrop();
    }
  }
  
  /**
   * Bloque le drop non autorisé et nettoie les éléments créés par erreur
   */
  private blockAndCleanUnauthorizedDrop(): void {
    // Empêcher toute opération sur le flux pendant le nettoyage
    this.flowService.isCreatingNode = false;
    
    // Utiliser setTimeout pour s'assurer que ce code s'exécute après les événements de la bibliothèque
    setTimeout(() => {
      // Nettoyer les classes visuelles
      document.body.classList.remove('no-drop-allowed');
      
      // Supprimer les placeholders externes
      const placeholders = document.querySelectorAll('.f-external-item-placeholder');
      placeholders.forEach(el => {
        try {
          el.remove();
        } catch (e) {
          console.log('Error removing placeholder:', e);
        }
      });
      
      // Supprimer les éléments de prévisualisation du drag
      const previews = document.querySelectorAll('.f-external-item-preview');
      previews.forEach(el => {
        try {
          el.remove();
        } catch (e) {
          console.log('Error removing preview:', e);
        }
      });
      
      // Supprimer tout nœud visible qui n'est pas enregistré
      const visibleNodes = document.querySelectorAll('[data-fnode]');
      visibleNodes.forEach(nodeEl => {
        // Vérifier que ce n'est pas un nœud déjà dans notre liste
        const nodeId = nodeEl.getAttribute('data-fnode');
        // Si ce nœud n'est pas dans notre liste et n'est pas un nœud temporaire, le supprimer
        if (nodeId && !this.flowService.nodes.some(n => n.id === nodeId) && 
            !nodeEl.classList.contains('temporary-node')) {
          try {
            nodeEl.remove();
          } catch (e) {
            console.log('Error removing node:', e);
          }
        }
      });
      
      // Nettoyer les nœuds temporaires pour éviter les problèmes d'état
      this.flowService.clearTemporaryElements();
      
      // Forcer la détection de changements pour mettre à jour l'UI
      this.changeDetectorRef.detectChanges();
      
      // Terminer le drag sans créer de nœud
      this.flowService.endDrag(this.changeDetectorRef);
    }, 0);
  }
  
  /**
   * Gestionnaire d'événement global pour les mouseup
   * @param event L'événement mouseup
   */
  @HostListener('window:mouseup', ['$event'])
  handleFlowEvent(event: MouseEvent): void {
    if (this.flowService.draggingItemType && !this.flowService.isCreatingNode) {
      console.log('Global mouse up event during drag');
      
      // Bloquer les événements au niveau document
      event.stopPropagation();
      
      // Obtenir tous les éléments à la position du clic
      const elementsAtPoint = document.elementsFromPoint(event.clientX, event.clientY);
      
      // Vérifier si un nœud temporaire se trouve à cet endroit
      const temporaryNodeElement = elementsAtPoint.find(el => 
        el.classList.contains('temporary-node') || el.closest('.temporary-node') !== null
      );
      
      if (temporaryNodeElement) {
        // Trouver l'ID du nœud temporaire
        const temporaryNode = temporaryNodeElement.classList.contains('temporary-node') 
          ? temporaryNodeElement 
          : temporaryNodeElement.closest('.temporary-node');
        
        if (temporaryNode) {
          // Extraire l'ID du nœud temporaire de l'attribut data-node-id
          const nodeId = temporaryNode.getAttribute('data-node-id');
          if (nodeId) {
            console.log('Drop detected over temporary node:', nodeId);
            this.onDropOnTemporaryNode(nodeId);
            return;
          }
        }
      }
      
      // Si nous ne sommes pas sur un nœud temporaire, annuler le drag et supprimer tout node placé
      console.log('Mouse up occurred outside a temporary node, cleaning up');
      
      // Bloquer et nettoyer tout drop non autorisé
      this.blockAndCleanUnauthorizedDrop();
    }
  }
  
  /**
   * Gestionnaire d'événement global pour les événements fCreateNode
   * @param event L'événement fCreateNode
   */
  @HostListener('window:fCreateNode', ['$event'])
  onGlobalCreateNode(event: CustomEvent): void {
    if (this.flowService.draggingItemType && !this.flowService.isCreatingNode) {
      console.log('Intercepted global fCreateNode event during drag, preventing default');
      
      // Empêcher la création du nœud
      event.preventDefault();
      event.stopPropagation();
      
      // Bloquer et nettoyer tout drop non autorisé
      this.blockAndCleanUnauthorizedDrop();
    }
  }
  
  /**
   * Gestionnaire pour les événements dragover
   * @param event L'événement dragover
   */
  onDragOver(event: DragEvent): void {
    // Ne rien faire si aucun élément n'est en cours de drag
    if (!this.flowService.draggingItemType) {
      return;
    }

    // Vérifier si le drag est au-dessus d'un nœud temporaire
    const elementsAtPoint = document.elementsFromPoint(event.clientX, event.clientY);
    const isOverTemporaryNode = elementsAtPoint.some(el => 
      el.classList.contains('temporary-node') || el.closest('.temporary-node') !== null
    );

    // Autoriser le drop uniquement sur les nœuds temporaires
    if (isOverTemporaryNode) {
      event.preventDefault(); // Permet le drop
    } else {
      // Ne pas appeler preventDefault() pour ne pas autoriser le drop
      // Mais ajouter une classe visuelle pour indiquer la zone interdite
      document.body.classList.add('no-drop-allowed');
    }
  }
  
  /**
   * Gestionnaire pour les événements drop
   * @param event L'événement drop
   */
  onDrop(event: DragEvent): void {
    // Nettoyer la classe visuelle d'interdiction
    document.body.classList.remove('no-drop-allowed');

    // Vérifier si le drop est sur un nœud temporaire
    const elementsAtPoint = document.elementsFromPoint(event.clientX, event.clientY);
    const isOverTemporaryNode = elementsAtPoint.some(el => 
      el.classList.contains('temporary-node') || el.closest('.temporary-node') !== null
    );

    if (this.flowService.draggingItemType && !isOverTemporaryNode) {
      // Si le drop est en dehors d'un nœud temporaire, bloquer et nettoyer
      event.preventDefault();
      event.stopPropagation();
      console.log('Drop canceled - not on a temporary node');
      this.blockAndCleanUnauthorizedDrop();
      return;
    }

    // Continuer le traitement normal du drop si c'est sur un nœud temporaire
    if (this.flowService.draggingItemType && isOverTemporaryNode) {
      event.preventDefault();
      
      // Ne pas ajouter de logique supplémentaire ici car le drop sera géré 
      // par le gestionnaire spécifique du nœud temporaire (onDropOnTemporaryNode)
    }
  }
  
  /**
   * Gestionnaire pour démarrer le drag d'un élément
   * @param itemType Le type d'élément en cours de drag
   */
  onDragStart(itemType: string): void {
    console.log('Flow container direct drag start with item type:', itemType);
    // Mise à jour du type d'élément en cours de drag dans le service
    // Note: La création des nœuds temporaires est maintenant gérée par la souscription à draggingItemType$
    this.flowService.draggingItemType = itemType;
  }
  
  /**
   * Gestionnaire pour terminer le drag
   */
  onDragEnd(): void {
    this.flowService.endDrag(this.changeDetectorRef);
  }
  
  /**
   * Gestionnaire d'événement global pour les dragend
   * @param event L'événement dragend
   */
  @HostListener('window:dragend', ['$event'])
  onGlobalDragEnd(event: DragEvent): void {
    // Nettoyer la classe visuelle d'interdiction dans tous les cas
    document.body.classList.remove('no-drop-allowed');
    
    if (this.flowService.draggingItemType) {
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
   * Gère la création d'une connexion entre deux nœuds
   * @param event L'événement de création de connexion
   */
  onCreateConnection(event: any): void {
    console.log('Connection creation event:', event);
    
    // Extraire les IDs des nœuds à partir des IDs des points de connexion
    const outputNodeId = event.outputId.replace('output_', '');
    const inputNodeId = event.inputId.replace('input_', '');
    
    // Trouver les nœuds concernés
    const sourceNode = this.flowService.nodes.find(node => node.id === outputNodeId);
    const targetNode = this.flowService.nodes.find(node => node.id === inputNodeId);
    
    if (!sourceNode || !targetNode) {
      console.warn('Source or target node not found');
      event.prevent();
      return;
    }
    
    // Compter les connexions existantes pour ces nœuds
    const existingOutputConnections = this.flowService.connections.filter(
      conn => conn.sourceId === event.outputId
    );
    
    const existingInputConnections = this.flowService.connections.filter(
      conn => conn.targetId === event.inputId
    );
    
    // Validation spéciale pour le BinarySplit
    if (sourceNode.type === 'BinarySplit') {
      // Vérifier si nous avons déjà atteint exactement 2 sorties
      if (existingOutputConnections.length >= 2) {
        console.warn(`BinarySplit ne peut avoir que 2 sorties exactement`);
        
        this.showConnectionLimitMessage(
          `Le nœud "BinarySplit" ne peut avoir que 2 sorties exactement`
        );
        
        event.prevent();
        return;
      }
    }
    
    // Validation spéciale pour la cible d'un BinarySplit
    if (targetNode.type === 'BinarySplit' && existingInputConnections.length >= 1) {
      console.warn(`BinarySplit ne peut avoir qu'une seule entrée`);
      
      this.showConnectionLimitMessage(
        `Le nœud "BinarySplit" ne peut avoir qu'une seule entrée`
      );
      
      event.prevent();
      return;
    }
    
    // Validation générale pour les limites maxOutputs
    if (sourceNode.maxOutputs !== undefined && 
        existingOutputConnections.length >= sourceNode.maxOutputs) {
      console.warn(`Max outputs (${sourceNode.maxOutputs}) reached for node ${outputNodeId}`);
      
      // Afficher un message à l'utilisateur
      this.showConnectionLimitMessage(
        `Le nœud "${sourceNode.type}" a atteint sa limite de ${sourceNode.maxOutputs} connexion(s) sortante(s)`
      );
      
      event.prevent();
      return;
    }
    
    // Validation générale pour les limites maxInputs
    if (targetNode.maxInputs !== undefined && 
        existingInputConnections.length >= targetNode.maxInputs) {
      console.warn(`Max inputs (${targetNode.maxInputs}) reached for node ${inputNodeId}`);
      
      // Afficher un message à l'utilisateur
      this.showConnectionLimitMessage(
        `Le nœud "${targetNode.type}" a atteint sa limite de ${targetNode.maxInputs} connexion(s) entrante(s)`
      );
      
      event.prevent();
      return;
    }
    
    // Si tout est valide, créer la connexion
    const newConnection: Connection = {
      id: `conn_${Date.now()}`,
      sourceId: event.outputId,
      targetId: event.inputId
    };
    
    // Ajouter la connexion
    this.flowService.addConnection(newConnection);
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
   * Détermine si une connexion depuis un BinarySplit est une branche supérieure ou inférieure
   * @param connection La connexion à vérifier
   * @returns 'top' pour la branche supérieure, 'bottom' pour la branche inférieure, ou undefined
   */
  getBinarySplitBranchType(connection: Connection): 'top' | 'bottom' | undefined {
    // Vérifier d'abord si la connexion provient d'un BinarySplit
    const sourceId = connection.sourceId.replace('output_', '');
    const sourceNode = this.flowService.nodes.find(node => node.id === sourceId);
    if (!sourceNode || sourceNode.type !== 'BinarySplit') {
      return undefined;
    }
    
    // Trouver toutes les connexions sortantes du même BinarySplit
    const binarySplitConnections = this.flowService.connections.filter(
      conn => conn.sourceId === connection.sourceId
    );
    
    // Si moins de 2 connexions, nous ne pouvons pas déterminer
    if (binarySplitConnections.length < 2) {
      // Pour 1 connexion, retourner 'top' par défaut
      return 'top';
    }
    
    // Trouver les nœuds cibles pour chaque connexion
    const targetNodes = binarySplitConnections.map(conn => {
      const targetId = conn.targetId.replace('input_', '');
      return this.flowService.nodes.find(node => node.id === targetId);
    }).filter(Boolean) as CrmNode[];
    
    // Trier les nœuds cibles par position Y
    targetNodes.sort((a, b) => a.position.y - b.position.y);
    
    // Déterminer le nœud cible actuel
    const currentTargetId = connection.targetId.replace('input_', '');
    const currentTarget = this.flowService.nodes.find(node => node.id === currentTargetId);
    
    // Si le nœud cible actuel est le premier dans la liste triée (le plus haut), c'est 'top'
    if (currentTarget && targetNodes[0] && currentTarget.id === targetNodes[0].id) {
      return 'top';
    }
    
    // Sinon, c'est 'bottom'
    return 'bottom';
  }
} 