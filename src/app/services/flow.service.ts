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
    // Crée un nœud Client par défaut
    const clientNode: CrmNode = {
      id: generateGuid(),
      type: 'Client',
      text: 'Client 1',
      position: { x: 100, y: 100 }
    };
    
    // Crée un nœud Task par défaut
    const taskNode: CrmNode = {
      id: generateGuid(),
      type: 'Task',
      text: 'Task 1',
      position: { x: 350, y: 100 }
    };
    
    // Ajoute les nœuds
    this._nodes.next([clientNode, taskNode]);
    
    // Crée une connexion entre les nœuds
    const connection: Connection = {
      id: generateGuid(),
      sourceId: `output_${clientNode.id}`,
      targetId: `input_${taskNode.id}`
    };
    
    // Ajoute la connexion
    this._connections.next([connection]);
  }

  /**
   * Crée des nœuds temporaires pour les emplacements potentiels de connexion
   * @param itemType Le type de l'élément en cours de drag
   */
  createTemporaryNodes(itemType: string): void {
    console.log('Creating temporary nodes for item type:', itemType);
    
    // Nettoie les nœuds temporaires précédents
    this.clearTemporaryElements();
    
    // S'il n'y a pas de nœuds, crée un nœud temporaire au centre
    if (this.nodes.length === 0) {
      console.log('No existing nodes to create temporary connections to');
      
      const centralTempNode: CrmNode = {
        id: `temp_central_${generateGuid()}`,
        type: itemType,
        text: `${itemType} (Drop here)`,
        position: { x: 400, y: 300 }
      };
      
      this._temporaryNodes.next([centralTempNode]);
      return;
    }
    
    // Crée des nœuds temporaires autour des nœuds existants
    const tempNodes: CrmNode[] = [];
    const tempConnections: Connection[] = [];
    
    for (const existingNode of this.nodes) {
      console.log('Creating temporary nodes around existing node:', existingNode.id);
      
      // Nœud temporaire à droite
      const rightTempNode: CrmNode = {
        id: `temp_right_${generateGuid()}`,
        type: itemType,
        text: `${itemType} (Drop here to connect)`,
        position: { 
          x: existingNode.position.x + 250, 
          y: existingNode.position.y 
        }
      };
      
      // Nœud temporaire à gauche
      const leftTempNode: CrmNode = {
        id: `temp_left_${generateGuid()}`,
        type: itemType,
        text: `${itemType} (Drop here to connect)`,
        position: { 
          x: existingNode.position.x - 250, 
          y: existingNode.position.y 
        }
      };
      
      // Vérifie que les positions ne se superposent pas avec des nœuds existants
      if (this.isPositionFree(rightTempNode.position)) {
        tempNodes.push(rightTempNode);
        
        // Connexion temporaire pour le nœud à droite
        const rightConnection: Connection = {
          id: `temp_conn_${generateGuid()}`,
          sourceId: `output_${existingNode.id}`,
          targetId: `input_${rightTempNode.id}`
        };
        tempConnections.push(rightConnection);
      }
      
      if (this.isPositionFree(leftTempNode.position)) {
        tempNodes.push(leftTempNode);
        
        // Connexion temporaire pour le nœud à gauche
        const leftConnection: Connection = {
          id: `temp_conn_${generateGuid()}`,
          sourceId: `output_${leftTempNode.id}`,
          targetId: `input_${existingNode.id}`
        };
        tempConnections.push(leftConnection);
      }
    }
    
    this._temporaryNodes.next(tempNodes);
    this._temporaryConnections.next(tempConnections);
    
    console.log('Created temporary nodes:', tempNodes.length);
    console.log('Created temporary connections:', tempConnections.length);
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
   * Gère la création d'un nœud suite au drop sur un nœud temporaire
   * @param temporaryNodeId L'ID du nœud temporaire
   * @param changeDetectorRef Le ChangeDetectorRef pour forcer la mise à jour de la vue
   */
  handleDropOnTemporaryNode(temporaryNodeId: string, changeDetectorRef: ChangeDetectorRef): void {
    console.log('Dropped on temporary node:', temporaryNodeId);
    
    // Si un nœud est déjà en cours de création, ne rien faire
    if (this.isCreatingNode) {
      console.log('Node creation already in progress, ignoring duplicate drop');
      return;
    }
    
    // Marque le début de la création d'un nœud
    this.isCreatingNode = true;
    
    if (!this.draggingItemType) {
      this.clearTemporaryElements();
      this.isCreatingNode = false;
      return;
    }
    
    // Trouve le nœud temporaire concerné
    const temporaryNode = this.temporaryNodes.find(node => node.id === temporaryNodeId);
    if (!temporaryNode) {
      this.clearTemporaryElements();
      this.isCreatingNode = false;
      return;
    }
    
    // Trouve les connexions temporaires associées à ce nœud
    const relatedTemporaryConnections = this.temporaryConnections.filter(
      conn => conn.sourceId === `output_${temporaryNodeId}` || conn.targetId === `input_${temporaryNodeId}`
    );
    
    // Crée un nœud permanent à la place du nœud temporaire
    const permanentNode: CrmNode = {
      id: generateGuid(),
      type: this.draggingItemType,
      text: `${this.draggingItemType} ${this.nodes.length + 1}`,
      position: { ...temporaryNode.position }
    };
    
    // Ajoute le nœud permanent
    this.addNode(permanentNode);
    
    // Crée des connexions permanentes pour remplacer les temporaires
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
      
      this.addConnection(permanentConnection);
    }
    
    // Nettoie les éléments temporaires
    this.clearTemporaryElements();
    
    // Réinitialise l'état du drag
    this.draggingItemType = null;
    
    // Supprime tout élément de placeholder qui aurait pu être créé
    setTimeout(() => {
      const placeholders = document.querySelectorAll('.f-external-item-placeholder');
      placeholders.forEach(el => el.remove());
      
      // Force la mise à jour de la vue
      changeDetectorRef.detectChanges();
      
      // Réinitialise le flag de création de nœud
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
    
    return `${baseClasses} ${typeClasses[type] || typeClasses['Default']}`;
  }
} 