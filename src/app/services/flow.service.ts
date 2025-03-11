import { Injectable, ChangeDetectorRef } from '@angular/core';
import { generateGuid } from '@foblex/utils';
import { CrmNode, Connection } from '../models/crm.models';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * Service responsable de la gestion du flow diagram (nœuds, connexions, etc.)
 */
@Injectable({
  providedIn: 'root'
})
export class FlowService {
  private _nodes = new BehaviorSubject<CrmNode[]>([]);
  private _connections = new BehaviorSubject<Connection[]>([]);
  private _temporaryNodes = new BehaviorSubject<CrmNode[]>([]);
  private _temporaryConnections = new BehaviorSubject<Connection[]>([]);
  private _draggingItemType = new BehaviorSubject<string | null>(null);
  private _isCreatingNode = new BehaviorSubject<boolean>(false);

  /**
   * Référence au composant canvas pour les opérations de zoom
   */
  private _canvasRef: any = null;

  /**
   * Référence à la directive de zoom pour les opérations de zoom
   */
  private _zoomDirective: any = null;

  /** Observable des nœuds du diagramme */
  readonly nodes$: Observable<CrmNode[]> = this._nodes.asObservable();
  /** Observable des connexions du diagramme */
  readonly connections$: Observable<Connection[]> = this._connections.asObservable();
  /** Observable des nœuds temporaires */
  readonly temporaryNodes$: Observable<CrmNode[]> = this._temporaryNodes.asObservable();
  /** Observable des connexions temporaires */
  readonly temporaryConnections$: Observable<Connection[]> = this._temporaryConnections.asObservable();
  /** Observable du type d'élément en cours de drag */
  readonly draggingItemType$: Observable<string | null> = this._draggingItemType.asObservable();
  /** Observable indiquant si un nœud est en cours de création */
  readonly isCreatingNode$: Observable<boolean> = this._isCreatingNode.asObservable();

  constructor() {}

  /**
   * @returns Les nœuds actuels du diagramme
   */
  get nodes(): CrmNode[] {
    return this._nodes.value;
  }

  /**
   * @returns Les connexions actuelles du diagramme
   */
  get connections(): Connection[] {
    return this._connections.value;
  }

  /**
   * @returns Les nœuds temporaires actuels
   */
  get temporaryNodes(): CrmNode[] {
    return this._temporaryNodes.value;
  }

  /**
   * @returns Les connexions temporaires actuelles
   */
  get temporaryConnections(): Connection[] {
    return this._temporaryConnections.value;
  }

  /**
   * @returns Le type d'élément en cours de drag
   */
  get draggingItemType(): string | null {
    return this._draggingItemType.value;
  }

  /**
   * @returns Si un nœud est en cours de création
   */
  get isCreatingNode(): boolean {
    return this._isCreatingNode.value;
  }

  /**
   * Définit le type d'élément en cours de drag
   */
  set draggingItemType(value: string | null) {
    this._draggingItemType.next(value);
  }

  /**
   * Définit si un nœud est en cours de création
   */
  set isCreatingNode(value: boolean) {
    this._isCreatingNode.next(value);
  }

  /**
   * Définit la référence au composant canvas
   * @param canvas La référence au composant canvas
   */
  setCanvasRef(canvas: any): void {
    this._canvasRef = canvas;
    console.log('Canvas reference set in service:', this._canvasRef);
  }

  /**
   * Définit la référence à la directive de zoom
   * @param zoomDirective La référence à la directive de zoom
   */
  setZoomDirective(zoomDirective: any): void {
    this._zoomDirective = zoomDirective;
    console.log('Zoom directive reference set in service:', this._zoomDirective);
  }

  /**
   * Augmente le niveau de zoom
   * @param point Point central du zoom (optionnel)
   */
  zoomIn(point?: any): void {
    if (this._zoomDirective) {
      try {
        console.log('Zooming in using directive');
        this._zoomDirective.zoomIn(point);
      } catch (error) {
        console.error('Error during zoom in:', error);
      }
    } else {
      console.warn('Zoom directive reference is not available for zoom in');
    }
  }
  
  /**
   * Diminue le niveau de zoom
   * @param point Point central du zoom (optionnel)
   */
  zoomOut(point?: any): void {
    if (this._zoomDirective) {
      try {
        console.log('Zooming out using directive');
        this._zoomDirective.zoomOut(point);
      } catch (error) {
        console.error('Error during zoom out:', error);
      }
    } else {
      console.warn('Zoom directive reference is not available for zoom out');
    }
  }
  
  /**
   * Réinitialise le zoom
   */
  resetZoom(): void {
    if (this._zoomDirective) {
      try {
        console.log('Resetting zoom using directive');
        this._zoomDirective.reset();
      } catch (error) {
        console.error('Error during reset zoom:', error);
      }
    } else {
      console.warn('Zoom directive reference is not available for reset zoom');
    }
  }

  /**
   * Ajoute un nouveau nœud au diagramme
   * @param node Le nœud à ajouter
   */
  addNode(node: CrmNode): void {
    const currentNodes = this._nodes.value;
    this._nodes.next([...currentNodes, node]);
  }

  /**
   * Ajoute une nouvelle connexion au diagramme
   * @param connection La connexion à ajouter
   */
  addConnection(connection: Connection): void {
    const currentConnections = this._connections.value;
    this._connections.next([...currentConnections, connection]);
  }

  /**
   * Crée un nœud par défaut
   */
  addDefaultNode(): void {
    // Vérifier si des nœuds existent déjà pour éviter la duplication
    if (this._nodes.value.length > 0) {
      console.log('Default nodes already exist, skipping creation');
      return;
    }
    
    console.log('Creating default nodes...');
    
    try {
      // Crée un nœud Client par défaut avec une position définie
      const clientNode: CrmNode = {
        id: generateGuid(),
        type: 'Client',
        text: 'Client 1',
        position: { x: 100, y: 100 }
      };
      
      // Crée un nœud Task par défaut avec une position définie
      const taskNode: CrmNode = {
        id: generateGuid(),
        type: 'Task',
        text: 'Task 1',
        position: { x: 350, y: 100 }
      };
      
      // Ajoute les nœuds en une seule opération pour éviter les mises à jour partielles
      const newNodes = [clientNode, taskNode];
      
      // Log pour déboguer
      console.log('Nodes to be added:', JSON.stringify(newNodes));
      
      // Mise à jour des nœuds
      this._nodes.next(newNodes);
      
      // Vérification après mise à jour
      console.log('Nodes after update:', JSON.stringify(this._nodes.value));
      
      // Crée une connexion entre les nœuds
      const connection: Connection = {
        id: generateGuid(),
        sourceId: `output_${clientNode.id}`,
        targetId: `input_${taskNode.id}`
      };
      
      // Ajoute la connexion
      this._connections.next([connection]);
      
      console.log('Default nodes created successfully:', newNodes);
    } catch (error) {
      console.error('Error creating default nodes:', error);
    }
  }

  /**
   * Crée des nœuds temporaires pour les emplacements potentiels de connexion
   * @param itemType Le type d'élément en cours de drag
   */
  createTemporaryNodes(itemType: string): void {
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
      
      this._temporaryNodes.next([centralTempNode]);
      return;
    }
    
    const tempNodes: CrmNode[] = [];
    const tempConnections: Connection[] = [];
    
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
      
      // Vérifier que les positions ne se superposent pas avec des nœuds existants
      if (this.isPositionFree(rightTempNode.position)) {
        tempNodes.push(rightTempNode);
        
        // Créer une connexion temporaire pour le nœud à droite
        const rightConnection: Connection = {
          id: `temp_conn_${generateGuid()}`,
          sourceId: `output_${existingNode.id}`,
          targetId: `input_${rightTempNode.id}`
        };
        tempConnections.push(rightConnection);
      }
      
      // Créer un nœud temporaire en dessous du nœud existant
      const bottomTempNode: CrmNode = {
        id: `temp_bottom_${generateGuid()}`,
        type: itemType,
        text: `${itemType} (Drop here to connect)`,
        position: { 
          x: existingNode.position.x, 
          y: existingNode.position.y + 200
        }
      };
      
      // Vérifier que les positions ne se superposent pas
      if (this.isPositionFree(bottomTempNode.position)) {
        tempNodes.push(bottomTempNode);
        
        // Créer une connexion temporaire pour le nœud en dessous
        const bottomConnection: Connection = {
          id: `temp_conn_${generateGuid()}`,
          sourceId: `output_${existingNode.id}`,
          targetId: `input_${bottomTempNode.id}`
        };
        tempConnections.push(bottomConnection);
      }
    }
    
    console.log('Created temporary nodes:', tempNodes.length);
    console.log('Created temporary connections:', tempConnections.length);
    
    this._temporaryNodes.next(tempNodes);
    this._temporaryConnections.next(tempConnections);
  }

  /**
   * Détermine si une position est libre (aucun nœud existant à proximité)
   * @param position La position à vérifier
   * @returns true si la position est libre, false sinon
   */
  private isPositionFree(position: {x: number, y: number}): boolean {
    return !this.nodes.some(n => 
      Math.abs(n.position.x - position.x) < 100 && 
      Math.abs(n.position.y - position.y) < 100
    );
  }

  /**
   * Nettoie les nœuds et connexions temporaires
   */
  clearTemporaryElements(): void {
    console.log('Clearing temporary elements');
    this._temporaryNodes.next([]);
    this._temporaryConnections.next([]);
  }

  /**
   * Gère le drop sur un nœud temporaire
   * @param temporaryNodeId ID du nœud temporaire
   * @param changeDetectorRef Référence au détecteur de changements
   */
  handleDropOnTemporaryNode(temporaryNodeId: string, changeDetectorRef: ChangeDetectorRef): void {
    console.log('Dropped on temporary node:', temporaryNodeId);
    
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
      type: this.draggingItemType!,
      text: `${this.draggingItemType} ${this.nodes.length + 1}`,
      position: { ...temporaryNode.position }
    };
    
    // Ajouter le nœud permanent
    this.addNode(permanentNode);
    
    // Créer des connexions permanentes pour remplacer les temporaires
    for (const tempConn of relatedTemporaryConnections) {
      // Déterminer si le nœud temporaire est la source ou la cible
      const isSource = tempConn.sourceId.includes(temporaryNodeId);
      
      // Créer une connexion permanente en fonction de la position du nœud temporaire
      const permanentConnection: Connection = {
        id: generateGuid(),
        sourceId: isSource 
          ? `output_${permanentNode.id}` 
          : tempConn.sourceId,
        targetId: !isSource 
          ? `input_${permanentNode.id}` 
          : tempConn.targetId
      };
      
      this.addConnection(permanentConnection);
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
      changeDetectorRef.detectChanges();
      
      // Réinitialiser le flag de création de nœud
      this.isCreatingNode = false;
    }, 50);
  }

  /**
   * Termine le drag sans créer de nœud
   * @param changeDetectorRef Le ChangeDetectorRef pour forcer la mise à jour de la vue
   */
  endDrag(changeDetectorRef: ChangeDetectorRef): void {
    console.log('Ending drag without creating node');
    
    // Nettoie les nœuds et connexions temporaires
    this.clearTemporaryElements();
    
    // Réinitialise l'état du drag
    this.draggingItemType = null;
    
    // Supprime tout élément qui aurait pu être créé
    setTimeout(() => {
      const placeholders = document.querySelectorAll('.f-external-item-placeholder');
      placeholders.forEach(el => el.remove());
      
      // Réinitialise le flag de création de nœud
      this.isCreatingNode = false;
      
      // Force la mise à jour de la vue
      changeDetectorRef.detectChanges();
      console.log('Drag end UI updated');
    }, 50);
  }

  /**
   * Renvoie l'icône correspondant au type de nœud
   * @param type Le type de nœud
   * @returns L'icône correspondante
   */
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

  /**
   * Renvoie les classes CSS en fonction du type de nœud
   * @param type Le type de nœud
   * @returns Les classes CSS correspondantes
   */
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
    
    const bgClass = typeClasses[type] || typeClasses['Default'];
    return `${baseClasses} ${bgClass}`;
  }
} 