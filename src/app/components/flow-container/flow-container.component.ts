import { Component, ViewChild, AfterViewInit, ChangeDetectorRef, HostListener, ElementRef, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FFlowModule, FCanvasComponent, FZoomDirective } from '@foblex/flow';
import { FlowService } from '../../services/flow.service';
import { TemporaryNodeDirective } from '../../directives/temporary-node.directive';
import { FlowToolbarComponent } from '../flow-toolbar/flow-toolbar.component';
import { Subscription } from 'rxjs';

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
  styleUrls: ['./flow-container.component.css']
})
export class FlowContainerComponent implements OnInit, AfterViewInit, OnDestroy {
  /** Référence au composant canvas de Foblex Flow */
  @ViewChild('canvas') canvas!: FCanvasComponent;
  
  /** Référence au composant flow de Foblex Flow */
  @ViewChild('flow') flow!: FCanvasComponent;
  
  /** Référence à la directive de zoom */
  @ViewChild(FZoomDirective) zoomDirective!: FZoomDirective;
  
  /** Souscription aux changements de draggingItemType */
  private draggingTypeSubscription!: Subscription;
  private nodesSubscription!: Subscription;
  
  /** Services injectés */
  public flowService = inject(FlowService);
  private changeDetectorRef = inject(ChangeDetectorRef);
  
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
    this.draggingTypeSubscription = this.flowService.draggingItemType$.subscribe(itemType => {
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
    this.nodesSubscription = this.flowService.nodes$.subscribe(nodes => {
      console.log('Nodes updated:', nodes);
      // Forcer la détection de changements après chaque mise à jour des nœuds
      this.changeDetectorRef.detectChanges();
    });
  }
  
  /**
   * Nettoyage des souscriptions
   */
  ngOnDestroy(): void {
    // Désabonnement pour éviter les fuites de mémoire
    if (this.draggingTypeSubscription) {
      this.draggingTypeSubscription.unsubscribe();
    }
    if (this.nodesSubscription) {
      this.nodesSubscription.unsubscribe();
    }
  }
  
  /**
   * Initialisation après l'affichage du composant
   */
  ngAfterViewInit(): void {
    console.log('Canvas component:', this.canvas);
    console.log('Flow component:', this.flow);
    console.log('Zoom directive:', this.zoomDirective);
    
    // Utiliser setTimeout pour s'assurer que les modifications sont effectuées après le cycle de détection de changement
    setTimeout(() => {
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
    }, 0);
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
    // Suppression immédiate des placeholders
    setTimeout(() => {
      // Supprimer immédiatement les placeholders et tout nœud qui aurait été créé
      const placeholders = document.querySelectorAll('.f-external-item-placeholder');
      placeholders.forEach(el => el.remove());
      
      // Supprimer tout nœud visible qui n'est pas enregistré
      const visibleNodes = document.querySelectorAll('[data-fnode]');
      visibleNodes.forEach(nodeEl => {
        // Vérifier que ce n'est pas un nœud déjà dans notre liste
        const nodeId = nodeEl.getAttribute('data-fnode');
        // Si ce nœud n'est pas dans notre liste et n'est pas un nœud temporaire, le supprimer
        if (nodeId && !this.flowService.nodes.some(n => n.id === nodeId) && 
            !nodeEl.classList.contains('temporary-node')) {
          nodeEl.remove();
        }
      });
      
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
   * Événement pour empêcher le drop direct dans le canvas pendant un drag
   */
  @HostListener('dragover', ['$event'])
  onDragOver(event: DragEvent): void {
    if (this.flowService.draggingItemType) {
      // Empêcher le comportement par défaut qui permettrait le drop
      event.preventDefault();
    }
  }
  
  /**
   * Événement pour contrôler le drop dans le canvas
   */
  @HostListener('drop', ['$event'])
  onDrop(event: DragEvent): void {
    if (this.flowService.draggingItemType) {
      // Empêcher le comportement par défaut
      event.preventDefault();
      event.stopPropagation();
      
      // Vérifier si le drop est sur un nœud temporaire
      const elementsAtPoint = document.elementsFromPoint(event.clientX, event.clientY);
      const isOverTemporaryNode = elementsAtPoint.some(el => 
        el.classList.contains('temporary-node') || el.closest('.temporary-node') !== null
      );
      
      if (!isOverTemporaryNode) {
        console.log('Drop event occurred outside temporary node, blocking it');
        // Nettoyer et annuler le drop
        this.blockAndCleanUnauthorizedDrop();
      }
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
   * Gestionnaire d'événement pour les keydown (Escape pour annuler un drag)
   * @param event L'événement keydown
   */
  @HostListener('window:keydown.escape', ['$event'])
  onEscapeKey(event: KeyboardEvent): void {
    if (this.flowService.draggingItemType) {
      console.log('Escape key pressed during drag, cancelling');
      this.blockAndCleanUnauthorizedDrop();
    }
  }
  
  /**
   * Gestionnaire d'événement global pour les dragend
   * @param event L'événement dragend
   */
  @HostListener('window:dragend', ['$event'])
  onGlobalDragEnd(event: DragEvent): void {
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
} 