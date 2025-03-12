import { computed, Injectable, signal } from '@angular/core';
import { Connection, CrmNode } from '../models/crm.models';
import { generateGuid } from '@foblex/utils';

/**
 * Interface représentant l'état du flow
 */
export interface FlowState {
  nodes: CrmNode[];
  connections: Connection[];
  zoom: {
    level: number;
    position?: { x: number, y: number };
  };
  temporaryElements: {
    nodes: CrmNode[];
    connections: Connection[];
    draggingItemType: string | null;
    isCreatingNode: boolean;
  };
  selectedNodes: string[];
}

/**
 * Service central de gestion de l'état du flow
 * Respecte le principe de responsabilité unique (SRP)
 * Source unique de vérité pour l'état des nodes et connections
 */
@Injectable({
  providedIn: 'root'
})
export class FlowStateService {
  /**
   * État complet du flow
   * @private
   */
  private readonly _state = signal<FlowState>({
    nodes: [],
    connections: [],
    zoom: {
      level: 1
    },
    temporaryElements: {
      nodes: [],
      connections: [],
      draggingItemType: null,
      isCreatingNode: false
    },
    selectedNodes: []
  });

  /**
   * État exposé en lecture seule
   */
  readonly state = computed(() => this._state());

  /**
   * Nodes du flow en lecture seule
   */
  readonly nodes = computed(() => this._state().nodes);

  /**
   * Connections du flow en lecture seule
   */
  readonly connections = computed(() => this._state().connections);

  /**
   * État du zoom en lecture seule
   */
  readonly zoom = computed(() => this._state().zoom);

  /**
   * Niveau de zoom en lecture seule
   */
  readonly zoomLevel = computed(() => this._state().zoom.level);

  /**
   * Nœuds temporaires en lecture seule
   */
  readonly temporaryNodes = computed(() => this._state().temporaryElements.nodes);

  /**
   * Connexions temporaires en lecture seule
   */
  readonly temporaryConnections = computed(() => this._state().temporaryElements.connections);

  /**
   * Type d'élément en cours de glisser-déposer en lecture seule
   */
  readonly draggingItemType = computed(() => this._state().temporaryElements.draggingItemType);

  /**
   * Indique si un nœud est en cours de création en lecture seule
   */
  readonly isCreatingNode = computed(() => this._state().temporaryElements.isCreatingNode);

  /**
   * Nœuds sélectionnés en lecture seule
   */
  readonly selectedNodes = computed(() => this._state().selectedNodes);

  /**
   * Met à jour l'état complet du flow
   * @param state Nouvel état du flow
   */
  updateState(state: FlowState): void {
    this._state.set({
      nodes: structuredClone(state.nodes),
      connections: structuredClone(state.connections),
      zoom: structuredClone(state.zoom),
      temporaryElements: structuredClone(state.temporaryElements),
      selectedNodes: state.selectedNodes
    });
  }

  /**
   * Met à jour uniquement les nodes
   * @param nodes Nouveaux nodes
   */
  updateNodes(nodes: CrmNode[]): void {
    this._state.update(state => ({
      ...state,
      nodes: structuredClone(nodes)
    }));
  }

  /**
   * Ajoute un nœud au flow
   * @param node Le nœud à ajouter
   * @returns Le nœud ajouté
   */
  addNode(node: CrmNode): CrmNode {
    const nodeClone = structuredClone(node);
    
    // Générer un ID s'il n'existe pas
    if (!nodeClone.id) {
      nodeClone.id = generateGuid();
    }
    
    // S'assurer que les valeurs par défaut sont définies
    if (nodeClone.maxInputs === undefined) {
      nodeClone.maxInputs = this.getDefaultMaxInputs(nodeClone.type);
    }
    
    if (nodeClone.maxOutputs === undefined) {
      nodeClone.maxOutputs = this.getDefaultMaxOutputs(nodeClone.type);
    }
    
    this._state.update(state => ({
      ...state,
      nodes: [...state.nodes, nodeClone]
    }));
    
    console.log(`Added node ${nodeClone.id} of type ${nodeClone.type} to state`);
    return nodeClone;
  }

  /**
   * Supprime un nœud du flow
   * @param nodeId L'ID du nœud à supprimer
   * @returns true si le nœud a été trouvé et supprimé, false sinon
   */
  removeNode(nodeId: string): boolean {
    const initialNodeCount = this._state().nodes.length;
    
    // Supprimer également toutes les connexions associées
    const connectionsToRemove = [
      ...this.getConnectionsFrom(`output_${nodeId}`),
      ...this.getConnectionsTo(`input_${nodeId}`)
    ];
    
    for (const connection of connectionsToRemove) {
      this.removeConnection(connection.id);
    }
    
    // Supprimer le nœud
    this._state.update(state => ({
      ...state,
      nodes: state.nodes.filter(n => n.id !== nodeId)
    }));
    
    const nodeRemoved = initialNodeCount > this._state().nodes.length;
    console.log(`Removed node ${nodeId} from state: ${nodeRemoved}`);
    return nodeRemoved;
  }

  /**
   * Met à jour uniquement les connections
   * @param connections Nouvelles connections
   */
  updateConnections(connections: Connection[]): void {
    this._state.update(state => ({
      ...state,
      connections: structuredClone(connections)
    }));
  }

  /**
   * Ajoute une connexion au flow
   * @param connection La connexion à ajouter
   * @returns La connexion ajoutée
   */
  addConnection(connection: Connection): Connection {
    const connectionClone = structuredClone(connection);
    
    // Générer un ID s'il n'existe pas
    if (!connectionClone.id) {
      connectionClone.id = generateGuid();
    }
    
    this._state.update(state => ({
      ...state,
      connections: [...state.connections, connectionClone]
    }));
    
    console.log(`Added connection ${connectionClone.id} from ${connectionClone.sourceId} to ${connectionClone.targetId}`);
    return connectionClone;
  }

  /**
   * Supprime une connexion du flow
   * @param connectionId L'ID de la connexion à supprimer
   * @returns true si la connexion a été trouvée et supprimée, false sinon
   */
  removeConnection(connectionId: string): boolean {
    const initialConnectionCount = this._state().connections.length;
    
    this._state.update(state => ({
      ...state,
      connections: state.connections.filter(c => c.id !== connectionId)
    }));
    
    const connectionRemoved = initialConnectionCount > this._state().connections.length;
    console.log(`Removed connection ${connectionId} from state: ${connectionRemoved}`);
    return connectionRemoved;
  }

  /**
   * Met à jour le niveau de zoom
   * @param level Nouveau niveau de zoom
   * @param position Position du point de zoom (optionnel)
   */
  updateZoom(level: number, position?: { x: number, y: number }): void {
    this._state.update(state => ({
      ...state,
      zoom: {
        level,
        position: position ? structuredClone(position) : undefined
      }
    }));
  }

  /**
   * Met à jour les nœuds temporaires
   * @param nodes Nouveaux nœuds temporaires
   */
  updateTemporaryNodes(nodes: CrmNode[]): void {
    this._state.update(state => ({
      ...state,
      temporaryElements: {
        ...state.temporaryElements,
        nodes: structuredClone(nodes)
      }
    }));
  }

  /**
   * Met à jour les connexions temporaires
   * @param connections Nouvelles connexions temporaires
   */
  updateTemporaryConnections(connections: Connection[]): void {
    this._state.update(state => ({
      ...state,
      temporaryElements: {
        ...state.temporaryElements,
        connections: structuredClone(connections)
      }
    }));
  }

  /**
   * Met à jour le type d'élément en cours de glisser-déposer
   * @param type Nouveau type
   */
  updateDraggingItemType(type: string | null): void {
    this._state.update(state => ({
      ...state,
      temporaryElements: {
        ...state.temporaryElements,
        draggingItemType: type
      }
    }));
  }

  /**
   * Met à jour l'état de création de nœud
   * @param isCreating Nouvel état
   */
  updateIsCreatingNode(isCreating: boolean): void {
    this._state.update(state => ({
      ...state,
      temporaryElements: {
        ...state.temporaryElements,
        isCreatingNode: isCreating
      }
    }));
  }

  /**
   * Met à jour les nœuds sélectionnés
   * @param nodeIds IDs des nœuds sélectionnés
   */
  updateSelectedNodes(nodeIds: string[]): void {
    this._state.update(state => ({
      ...state,
      selectedNodes: nodeIds
    }));
  }

  /**
   * Nettoie tous les éléments temporaires
   */
  clearTemporaryElements(): void {
    this._state.update(state => ({
      ...state,
      temporaryElements: {
        ...state.temporaryElements,
        nodes: [],
        connections: []
      }
    }));
  }

  /**
   * Vérifie si une position est libre (pas de nœuds à proximité)
   * @param position Position à vérifier
   * @returns true si la position est libre
   */
  isPositionFree(position: {x: number, y: number}): boolean {
    // Considérer une marge de 50px autour des nœuds existants
    const margin = 50;
    return !this.nodes().some(node => 
      Math.abs(node.position.x - position.x) < margin && 
      Math.abs(node.position.y - position.y) < margin
    );
  }

  /**
   * Obtient le nombre maximum d'entrées par défaut pour un type de nœud
   * @param type Type de nœud
   * @returns Nombre maximum d'entrées
   */
  getDefaultMaxInputs(type: string): number {
    switch (type) {
      // Targeting
      case 'Audience':
        return 0;  // Une audience n'a pas d'entrée

      // Execution
      case 'BinarySplit':
        return 1;  // Un séparateur binaire a exactement 1 entrée
      case 'MultiSplit':
        return 1;  // Un séparateur multiple a exactement 1 entrée
      
      // Communication
      case 'Full Screen':
        return 1;  // Une notification full screen a 1 entrée
      case 'SMS':
        return 1;  // Un SMS a 1 entrée
      case 'Push':
        return 1;  // Une notification push a 1 entrée
      case 'Email':
        return 1;  // Un email a 1 entrée
      
      // Rewards
      case 'Freebet':
        return 1;  // Un freebet a 1 entrée
      
      // Fallback
      default:
        return 1;  // Par défaut, 1 entrée
    }
  }

  /**
   * Obtient le nombre maximum de sorties par défaut pour un type de nœud
   * @param type Type de nœud
   * @returns Nombre maximum de sorties
   */
  getDefaultMaxOutputs(type: string): number {
    switch (type) {
      // Targeting
      case 'Audience':
        return 1;  // Une audience a 1 sortie maximum
      
      // Execution
      case 'BinarySplit':
        return 2;  // Un séparateur binaire a exactement 2 sorties
      case 'MultiSplit':
        return 5;  // Un séparateur multiple a jusqu'à 5 sorties
      
      // Communication
      case 'Full Screen':
        return 1;  // Une notification full screen a 1 sortie
      case 'SMS':
        return 1;  // Un SMS a 1 sortie
      case 'Push':
        return 1;  // Une notification push a 1 sortie
      case 'Email':
        return 1;  // Un email a 1 sortie
      
      // Rewards
      case 'Freebet':
        return 1;  // Un freebet a 1 sortie
      
      // Fallback
      default:
        return 1;  // Par défaut, 1 sortie
    }
  }

  /**
   * Obtient les connexions sortantes d'un nœud
   * @param nodeId Identifiant du nœud (avec préfixe output_)
   * @returns Connexions sortantes
   */
  getConnectionsFrom(nodeId: string): Connection[] {
    return this.connections().filter(conn => conn.sourceId === nodeId);
  }

  /**
   * Obtient les connexions entrantes d'un nœud
   * @param nodeId Identifiant du nœud (avec préfixe input_)
   * @returns Connexions entrantes
   */
  getConnectionsTo(nodeId: string): Connection[] {
    return this.connections().filter(conn => conn.targetId === nodeId);
  }

  /**
   * Crée et ajoute un nœud temporaire
   * @param nodeData Les données du nœud temporaire
   * @returns Le nœud temporaire créé
   */
  createTemporaryNode(nodeData: Partial<CrmNode>): CrmNode {
    const tempNode: CrmNode = {
      id: nodeData.id || generateGuid(),
      type: nodeData.type || 'Unknown',
      text: nodeData.text || `${nodeData.type || 'Node'} (Temporary)`,
      position: nodeData.position || { x: 0, y: 0 },
      maxInputs: nodeData.maxInputs !== undefined 
        ? nodeData.maxInputs 
        : this.getDefaultMaxInputs(nodeData.type || 'Unknown'),
      maxOutputs: nodeData.maxOutputs !== undefined 
        ? nodeData.maxOutputs 
        : this.getDefaultMaxOutputs(nodeData.type || 'Unknown')
    };
    
    // Ajouter le nœud temporaire à l'état
    this._state.update(state => ({
      ...state,
      temporaryElements: {
        ...state.temporaryElements,
        nodes: [...state.temporaryElements.nodes, tempNode]
      }
    }));
    
    console.log(`Created temporary node ${tempNode.id} of type ${tempNode.type}`);
    return tempNode;
  }

  /**
   * Crée et ajoute une connexion temporaire
   * @param connectionData Les données de la connexion temporaire
   * @returns La connexion temporaire créée
   */
  createTemporaryConnection(connectionData: Partial<Connection>): Connection {
    const tempConnection: Connection = {
      id: connectionData.id || generateGuid(),
      sourceId: connectionData.sourceId || '',
      targetId: connectionData.targetId || ''
    };
    
    // Ajouter la connexion temporaire à l'état
    this._state.update(state => ({
      ...state,
      temporaryElements: {
        ...state.temporaryElements,
        connections: [...state.temporaryElements.connections, tempConnection]
      }
    }));
    
    console.log(`Created temporary connection ${tempConnection.id} from ${tempConnection.sourceId} to ${tempConnection.targetId}`);
    return tempConnection;
  }

  /**
   * Convertit un nœud temporaire en nœud permanent
   * @param temporaryNodeId L'ID du nœud temporaire à convertir
   * @returns Le nouveau nœud permanent ou null si le nœud temporaire n'a pas été trouvé
   */
  convertTemporaryNodeToPermanent(temporaryNodeId: string): CrmNode | null {
    // Trouver le nœud temporaire
    const tempNode = this._state().temporaryElements.nodes.find(n => n.id === temporaryNodeId);
    if (!tempNode) {
      console.warn(`Temporary node with id ${temporaryNodeId} not found for conversion`);
      return null;
    }
    
    // Créer un nouveau nœud permanent à partir du nœud temporaire
    const newNode: CrmNode = {
      id: generateGuid(),
      type: tempNode.type,
      text: tempNode.text.replace(' (Temporary)', '').replace(' (Drop here)', ''),
      position: { ...tempNode.position },
      maxInputs: tempNode.maxInputs,
      maxOutputs: tempNode.maxOutputs
    };
    
    // Ajouter le nouveau nœud permanent
    this.addNode(newNode);
    
    // Trouver les connexions temporaires associées
    const relatedTempConnections = this._state().temporaryElements.connections.filter(
      conn => conn.sourceId.includes(temporaryNodeId) || conn.targetId.includes(temporaryNodeId)
    );
    
    // Créer des connexions permanentes en remplacement
    for (const tempConn of relatedTempConnections) {
      const isSource = tempConn.sourceId.includes(temporaryNodeId);
      
      // Créer une nouvelle connexion permanente
      const newConnection: Connection = {
        id: generateGuid(),
        sourceId: isSource ? `output_${newNode.id}` : tempConn.sourceId,
        targetId: !isSource ? `input_${newNode.id}` : tempConn.targetId
      };
      
      // Ajouter la nouvelle connexion permanente
      this.addConnection(newConnection);
    }
    
    // Nettoyer tous les éléments temporaires
    this.clearTemporaryElements();
    
    console.log(`Converted temporary node ${temporaryNodeId} to permanent node ${newNode.id}`);
    return newNode;
  }
}