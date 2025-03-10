import { Component, ViewChild, AfterViewInit, ChangeDetectorRef, HostListener, ElementRef } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { 
  FFlowModule, 
  FCreateNodeEvent, 
  FExternalItemDirective, 
  FExternalItemPlaceholderDirective, 
  FExternalItemPreviewDirective,
  FCanvasComponent
} from '@foblex/flow';
import { generateGuid } from '@foblex/utils';
import { BuilderComponent } from './components/builder/builder.component';

interface CrmNode {
  id: string;
  type: string;
  text: string;
  position: { x: number; y: number };
}

interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    FFlowModule, 
    CommonModule, 
    BuilderComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements AfterViewInit {
  title = 'study-foblex';
  
  @ViewChild(FCanvasComponent) canvas!: FCanvasComponent;
  
  // Tableau des nœuds du CRM
  nodes: CrmNode[] = [];
  
  // Tableau des connexions entre les nœuds
  connections: Connection[] = [];
  
  // Nœuds temporaires pour les emplacements potentiels
  temporaryNodes: CrmNode[] = [];
  
  // Connexions temporaires
  temporaryConnections: Connection[] = [];
  
  // Type de composant en cours de drag
  draggingItemType: string | null = null;
  
  // Un flag pour empêcher la création multiple de nœuds lors d'un drop
  isCreatingNode = false;
  
  // État de la sidebar (ouvert par défaut)
  isSidebarOpen = true;
  
  constructor(private changeDetectorRef: ChangeDetectorRef, private elementRef: ElementRef) {}
  
  // Détection globale de fin de drag
  @HostListener('document:pointerup', ['$event'])
  onDocumentPointerUp(event: PointerEvent): void {
    if (this.draggingItemType && !this.isCreatingNode) {
      // Vérifier si l'élément sous le pointeur est un nœud temporaire
      const elementsAtPoint = document.elementsFromPoint(event.clientX, event.clientY);
      
      // Chercher un élément qui est un nœud temporaire
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
      
      // Si on n'est pas sur un nœud temporaire, terminer le drag sans créer de nœud
      console.log('Not over a temporary node, ending drag without creating node');
      this.onDragEnd();
    }
  }
  
  @HostListener('window:fCreateNode', ['$event'])
  onGlobalCreateNode(event: CustomEvent): void {
    if (this.draggingItemType && !this.isCreatingNode) {
      console.log('Intercepted global fCreateNode event during drag, preventing default');
      
      // Empêcher la création du nœud
      event.preventDefault();
      event.stopPropagation();
      
      // Supprimer immédiatement tout élément créé
      setTimeout(() => {
        const newElements = document.querySelectorAll('.f-external-item-placeholder');
        newElements.forEach(el => el.remove());
        
        // Forcer la fin du drag si le drop n'est pas sur un nœud temporaire
        this.onDragEnd();
      }, 0);
    }
  }
  
  ngAfterViewInit() {
    console.log('Canvas component:', this.canvas);
    
    // Add a default node on initialization
    this.addDefaultNode();
    
    // Réinitialiser l'échelle et centrer le canvas
    setTimeout(() => {
      if (this.canvas) {
        this.canvas.resetScaleAndCenter(false);
      }
    }, 100);
  }
  
  // Method to add a default node
  private addDefaultNode(): void {
    // Create first node (Client)
    const clientNode: CrmNode = {
      id: generateGuid(),
      type: 'Client',
      text: 'Client 1',
      position: { x: 100, y: 100 }
    };
    
    // Create second node (Task)
    const taskNode: CrmNode = {
      id: generateGuid(),
      type: 'Task',
      text: 'Task 1',
      position: { x: 350, y: 100 }
    };
    
    // Add nodes to the nodes array
    this.nodes.push(clientNode, taskNode);
    
    // Create a connection between the nodes
    const connection: Connection = {
      id: generateGuid(),
      sourceId: `output_${clientNode.id}`,
      targetId: `input_${taskNode.id}`
    };
    
    // Add connection to the connections array
    this.connections.push(connection);
    
    console.log('Default nodes created:', clientNode, taskNode);
    console.log('Default connection created:', connection);
    
    // Force UI update
    this.changeDetectorRef.markForCheck();
  }
  
  // Méthode pour créer un nouveau nœud
  onCreateNode(event: any): void {
    console.log('Create node event received:', event);
    
    // Ne rien faire si nous sommes en train de faire un drag
    if (this.draggingItemType || this.isCreatingNode) {
      console.log('Blocking node creation because we are dragging an item or already creating a node');
      // Empêcher la création du nœud et tout traitement ultérieur
      event.preventDefault?.();
      event.stopPropagation?.();
      
      // Supprimer immédiatement tout élément qui pourrait avoir été créé
      setTimeout(() => {
        const newElements = document.querySelectorAll('.f-external-item-placeholder');
        newElements.forEach(el => {
          el.remove();
        });
      }, 0);
      
      return;
    }
    
    // Procéder avec la création de nœud normale seulement si nous ne sommes pas en drag
    if (!event) {
      console.error('Invalid event object:', event);
      return;
    }
    
    try {
      const nodeType = event.data as string || 'Default';
      
      console.log('Node type:', nodeType);
      console.log('Node position:', event.rect);
      
      const newNode: CrmNode = {
        id: generateGuid(),
        type: nodeType,
        text: `${nodeType} ${this.nodes.length + 1}`,
        position: event.rect
      };
      
      this.nodes.push(newNode);
      console.log('Node created:', newNode);
      console.log('Current nodes:', this.nodes);
      
      // Force la mise à jour de la vue
      this.changeDetectorRef.markForCheck();
    } catch (error) {
      console.error('Error creating node:', error);
    }
  }
  
  // Méthode pour obtenir l'icône correspondant au type de nœud
  getNodeIcon(type: string): string {
    const icons: { [key: string]: string } = {
      'Client': '👤',
      'Contact': '📞',
      'Deal': '💰',
      'Task': '✅',
      'Email': '✉️',
      'Default': '📄'
    };
    
    return icons[type] || icons['Default'];
  }
  
  // Méthode pour obtenir les classes CSS en fonction du type de nœud
  getNodeClass(type: string): string {
    const baseClasses = 'min-w-[180px] rounded-md shadow-md overflow-hidden';
    
    const typeClasses: { [key: string]: string } = {
      'Client': 'bg-blue-500',
      'Contact': 'bg-green-500',
      'Deal': 'bg-yellow-500',
      'Task': 'bg-red-500',
      'Email': 'bg-purple-500',
      'Default': 'bg-gray-500'
    };
    
    return `${baseClasses} ${typeClasses[type] || typeClasses['Default']}`;
  }
  
  // Méthode pour gérer l'état de la sidebar
  toggleSidebar(isOpen: boolean): void {
    this.isSidebarOpen = isOpen;
  }
  
  // Méthode appelée quand un élément commence à être draggé depuis le builder
  onDragStart(itemType: string): void {
    console.log('Drag started with item type:', itemType);
    this.draggingItemType = itemType;
    
    // Créer des nœuds temporaires pour montrer les emplacements potentiels
    this.createTemporaryNodes(itemType);
    
    // Force la mise à jour de la vue avec setTimeout pour s'assurer que le changement est pris en compte
    setTimeout(() => {
      this.changeDetectorRef.detectChanges();
      console.log('Force UI update with temporary nodes:', this.temporaryNodes.length);
    }, 50);
  }
  
  // Méthode appelée quand un drag se termine (abandon ou drop ailleurs)
  onDragEnd(): void {
    console.log('Drag ended without valid drop');
    
    // Nettoyer les nœuds et connexions temporaires
    this.clearTemporaryElements();
    
    // Réinitialiser l'état
    this.draggingItemType = null;
    
    // Supprimer tout élément qui aurait pu être créé par le système de drag standard
    // (s'assurer qu'aucun nœud n'a été créé par erreur)
    setTimeout(() => {
      // Supprimer les éléments avec la classe 'f-external-item-placeholder' qui ont été créés par le système de drag
      const placeholders = document.querySelectorAll('.f-external-item-placeholder');
      placeholders.forEach(el => {
        el.remove();
      });
      
      // Réinitialiser le flag de création de nœud
      this.isCreatingNode = false;
      
      // Force la mise à jour de la vue
      this.changeDetectorRef.detectChanges();
      console.log('Drag end UI updated');
    }, 50);
  }
  
  // Méthode appelée quand un élément est déposé sur un nœud temporaire
  onDropOnTemporaryNode(temporaryNodeId: string): void {
    console.log('Dropped on temporary node:', temporaryNodeId);
    
    // Si nous sommes déjà en train de créer un nœud, ne rien faire
    if (this.isCreatingNode) {
      console.log('Node creation already in progress, ignoring duplicate drop');
      return;
    }
    
    // Marquer que nous commençons la création d'un nœud
    this.isCreatingNode = true;
    
    if (!this.draggingItemType) {
      this.clearTemporaryElements();
      this.isCreatingNode = false;
      return;
    }
    
    // Trouver le nœud temporaire concerné
    const temporaryNode = this.temporaryNodes.find(node => node.id === temporaryNodeId);
    if (!temporaryNode) {
      this.clearTemporaryElements();
      this.isCreatingNode = false;
      return;
    }
    
    // Trouver les connexions temporaires associées à ce nœud
    const relatedTemporaryConnections = this.temporaryConnections.filter(
      conn => conn.sourceId === `output_${temporaryNodeId}` || conn.targetId === `input_${temporaryNodeId}`
    );
    
    // Créer un nœud permanent à la place du nœud temporaire
    const permanentNode: CrmNode = {
      id: generateGuid(),
      type: this.draggingItemType,
      text: `${this.draggingItemType} ${this.nodes.length + 1}`,
      position: { ...temporaryNode.position }
    };
    
    // Ajouter le nœud permanent
    this.nodes.push(permanentNode);
    
    // Créer des connexions permanentes pour remplacer les temporaires
    for (const tempConn of relatedTemporaryConnections) {
      const permanentConnection: Connection = {
        id: generateGuid(),
        sourceId: tempConn.sourceId.includes(temporaryNodeId) 
          ? `output_${permanentNode.id}` 
          : tempConn.sourceId,
        targetId: tempConn.targetId.includes(temporaryNodeId) 
          ? `input_${permanentNode.id}` 
          : tempConn.targetId
      };
      
      this.connections.push(permanentConnection);
    }
    
    // Nettoyer les éléments temporaires
    this.clearTemporaryElements();
    
    // Réinitialiser l'état
    this.draggingItemType = null;
    
    // Supprimer tout élément de placeholder qui aurait pu être créé par le système de drag-and-drop de Foblex
    setTimeout(() => {
      const placeholders = document.querySelectorAll('.f-external-item-placeholder');
      placeholders.forEach(el => el.remove());
      
      // Force la mise à jour de la vue
      this.changeDetectorRef.detectChanges();
      
      // Réinitialiser le flag de création de nœud
      this.isCreatingNode = false;
    }, 50);
  }
  
  // Créer des nœuds temporaires pour les emplacements potentiels de connexion
  private createTemporaryNodes(itemType: string): void {
    console.log('Creating temporary nodes for item type:', itemType);
    
    // D'abord, nettoyer les anciens nœuds temporaires
    this.clearTemporaryElements();
    
    // Pour chaque nœud existant, créer un nœud temporaire qui pourrait s'y connecter
    if (this.nodes.length === 0) {
      console.log('No existing nodes to create temporary connections to');
      
      // Créer un nœud temporaire au centre si aucun nœud n'existe
      const centralTempNode: CrmNode = {
        id: `temp_central_${generateGuid()}`,
        type: itemType,
        text: `${itemType} (Drop here)`,
        position: { x: 400, y: 300 }
      };
      
      this.temporaryNodes.push(centralTempNode);
      return;
    }
    
    for (const existingNode of this.nodes) {
      console.log('Creating temporary nodes around existing node:', existingNode.id);
      
      // Créer un nœud temporaire à droite du nœud existant
      const rightTempNode: CrmNode = {
        id: `temp_right_${generateGuid()}`,
        type: itemType,
        text: `${itemType} (Drop here to connect)`,
        position: { 
          x: existingNode.position.x + 250, 
          y: existingNode.position.y 
        }
      };
      
      // Créer un nœud temporaire à gauche du nœud existant
      const leftTempNode: CrmNode = {
        id: `temp_left_${generateGuid()}`,
        type: itemType,
        text: `${itemType} (Drop here to connect)`,
        position: { 
          x: existingNode.position.x - 250, 
          y: existingNode.position.y 
        }
      };
      
      // Vérifier que les positions ne se superposent pas avec des nœuds existants
      // (ne pas ajouter si un nœud existe déjà à cette position ou très proche)
      const isPositionFree = (position: {x: number, y: number}): boolean => {
        return !this.nodes.some(n => 
          Math.abs(n.position.x - position.x) < 100 && 
          Math.abs(n.position.y - position.y) < 100
        );
      };
      
      // N'ajouter que les nœuds temporaires qui ne se superposent pas
      if (isPositionFree(rightTempNode.position)) {
        this.temporaryNodes.push(rightTempNode);
        
        // Créer une connexion temporaire pour le nœud à droite
        const rightConnection: Connection = {
          id: `temp_conn_${generateGuid()}`,
          sourceId: `output_${existingNode.id}`,
          targetId: `input_${rightTempNode.id}`
        };
        this.temporaryConnections.push(rightConnection);
      }
      
      if (isPositionFree(leftTempNode.position)) {
        this.temporaryNodes.push(leftTempNode);
        
        // Créer une connexion temporaire pour le nœud à gauche
        const leftConnection: Connection = {
          id: `temp_conn_${generateGuid()}`,
          sourceId: `output_${leftTempNode.id}`,
          targetId: `input_${existingNode.id}`
        };
        this.temporaryConnections.push(leftConnection);
      }
    }
    
    console.log('Created temporary nodes:', this.temporaryNodes.length);
    console.log('Created temporary connections:', this.temporaryConnections.length);
  }
  
  // Nettoyer les nœuds et connexions temporaires
  private clearTemporaryElements(): void {
    console.log('Clearing temporary elements');
    this.temporaryNodes = [];
    this.temporaryConnections = [];
    
    // Force la mise à jour de la vue
    setTimeout(() => {
      this.changeDetectorRef.detectChanges();
      console.log('Temporary nodes cleared');
    }, 50);
  }
  
  // Méthode appelée lorsqu'un événement pointerup se produit sur le canvas
  onCanvasPointerUp(event: PointerEvent): void {
    if (this.draggingItemType && !this.isCreatingNode) {
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
      
      // Supprimer immédiatement tout élément créé et terminer le drag
      setTimeout(() => {
        // Supprimer les éléments avec la classe 'f-external-item-placeholder'
        const placeholders = document.querySelectorAll('.f-external-item-placeholder');
        placeholders.forEach(el => el.remove());
        
        this.onDragEnd();
      }, 0);
    }
  }
  
  // Méthode pour manipuler les événements de Flow
  @HostListener('window:mouseup', ['$event'])
  handleFlowEvent(event: MouseEvent): void {
    if (this.draggingItemType && !this.isCreatingNode) {
      console.log('Global mouse up event during drag');
      
      // Bloquer complètement les événements de création lors du drag
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
      
      // Supprimer immédiatement tout élément créé
      setTimeout(() => {
        // Supprimer les éléments créés par le système de drag externe
        const newElements = document.querySelectorAll('.f-external-item-placeholder');
        newElements.forEach(el => el.remove());
        
        this.onDragEnd();
      }, 0);
    }
  }
}
