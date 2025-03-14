import { computed, Injectable, signal } from '@angular/core';
import { generateGuid } from '@foblex/utils';
import { Connection, CrmNode } from '../models/crm.models';

export interface BuilderCategory {
  name: string;
  expanded: boolean;
  items: BuilderItem[];
}

export interface BuilderItem {
  type: string;
  icon: string;
  color: string;
}

export interface BuilderState {
  isOpen: boolean;
  categories: BuilderCategory[];
}

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
  builder: BuilderState;
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
    selectedNodes: [],
    builder: {
      isOpen: true,
      categories: [
        {
          name: 'Execution',
          expanded: true,
          items: [
            { type: 'BinarySplit', icon: '🔀', color: 'bg-indigo-600' },
            { type: 'MultiSplit', icon: '🔱', color: 'bg-teal-600' },
            { type: 'Exit', icon: '🔚', color: 'bg-red-200' }  // Ajout du type Exit
          ]
        },
        {
          name: 'Communication',
          expanded: true,
          items: [
            { type: 'Full Screen', icon: '📱', color: 'bg-blue-500' },
            { type: 'SMS', icon: '💬', color: 'bg-green-500' },
            { type: 'Push', icon: '🔔', color: 'bg-purple-500' },
            { type: 'Email', icon: '✉️', color: 'bg-orange-500' }
          ]
        },
        {
          name: 'Rewards',
          expanded: true,
          items: [
            { type: 'Freebet', icon: '🎁', color: 'bg-red-500' }
          ]
        }
      ]
    }
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
   * Indique si exactement un nœud est sélectionné
   */
  readonly hasExactlyOneNodeSelected = computed(() => this._state().selectedNodes.length === 1);
  
  /**
   * Renvoie l'ID du nœud sélectionné s'il y en a exactement un, sinon null
   */
  readonly getSelectedNodeId = computed(() => 
    this.hasExactlyOneNodeSelected() ? this._state().selectedNodes[0] : null
  );

  /**
   * Indique si le nœud sélectionné peut être supprimé
   */
  readonly canDeleteSelectedNode = computed(() => {
    const selectedNodeId = this.getSelectedNodeId();
    if (!selectedNodeId) return false;
    return this.canDeleteNode(selectedNodeId);
  });

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
      selectedNodes: state.selectedNodes,
      builder: state.builder
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
      case 'Exit':
        return 1;  // Un nœud Exit a exactement 1 entrée
      
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
        return 3;  // Un séparateur multiple a jusqu'à 5 sorties
      case 'Exit':
        return 0;  // Un nœud Exit n'a aucune sortie
      
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

  /**
   * Recalcule les positions de toutes les nodes après une insertion
   * @param insertAfterNodeId ID de la node après laquelle insérer
   * @param newNode La nouvelle node à insérer
   */
  recalculateNodesPositions(insertAfterNodeId: string, newNode: CrmNode): void {
    console.log(`Recalculating node positions after inserting node after ${insertAfterNodeId}`);
    
    // Ajouter d'abord le nouveau nœud à la liste
    const currentNodes = [...this.nodes(), newNode];
    
    // Identifier les branches et recalculer les positions comme dans recalculateAllNodesPositions
    const HORIZONTAL_SPACING = 250;
    const yThreshold = 50;
    const branches: { [key: string]: CrmNode[] } = {};
    
    // Regrouper les nœuds par branches
    currentNodes.forEach(node => {
      const branchKey = Object.keys(branches).find(key => {
        const branchY = parseInt(key);
        return Math.abs(node.position.y - branchY) < yThreshold;
      });
      
      if (branchKey) {
        branches[branchKey].push(node);
      } else {
        branches[node.position.y.toString()] = [node];
      }
    });
    
    // Optimiser l'espacement vertical entre branches
    const optimizedBranches = this.optimizeBranchSpacing(branches);
    
    // Pour chaque branche, trier les nœuds horizontalement et recalculer les positions X
    const updatedNodes: CrmNode[] = [];
    
    Object.entries(optimizedBranches).forEach(([yKey, branchNodes]) => {
      const y = parseFloat(yKey);
      
      // Trier les nœuds de cette branche par position X
      const sortedBranchNodes = [...branchNodes].sort((a, b) => a.position.x - b.position.x);
      
      // Recalculer les positions X tout en maintenant Y
      sortedBranchNodes.forEach((node, index) => {
        updatedNodes.push({
          ...node,
          position: {
            x: index * HORIZONTAL_SPACING,
            y: y
          }
        });
      });
    });
    
    // Mettre à jour les nœuds
    this.updateNodes(updatedNodes);
    
    console.log('Node positions recalculated with spacing:', HORIZONTAL_SPACING);
  }

  /**
   * Obtient la node liée à une connexion
   */
  getNodeFromConnectionId(connectionId: string, isSource: boolean = true): CrmNode | undefined {
    const connection = this.connections().find(c => c.id === connectionId);
    if (!connection) return undefined;
    
    const nodeId = (isSource ? connection.sourceId : connection.targetId).replace(/^(input_|output_)/, '');
    return this.nodes().find(n => n.id === nodeId);
  }

  /**
   * État du builder en lecture seule
   */
  readonly builderState = computed(() => this._state().builder);

  /**
   * Catégories du builder en lecture seule
   */
  readonly builderCategories = computed(() => this._state().builder.categories);

  /**
   * Indique si le builder est ouvert en lecture seule
   */
  readonly isBuilderOpen = computed(() => this._state().builder.isOpen);

  /**
   * Met à jour l'état d'ouverture du builder
   * @param isOpen Nouvel état
   */
  updateBuilderOpen(isOpen: boolean): void {
    this._state.update(state => ({
      ...state,
      builder: {
        ...state.builder,
        isOpen
      }
    }));
  }

  /**
   * Bascule l'état d'expansion d'une catégorie du builder
   * @param categoryName Nom de la catégorie
   */
  toggleBuilderCategory(categoryName: string): void {
    this._state.update(state => ({
      ...state,
      builder: {
        ...state.builder,
        categories: state.builder.categories.map(cat => 
          cat.name === categoryName 
            ? { ...cat, expanded: !cat.expanded }
            : cat
        )
      }
    }));
  }

  /**
   * Vérifie si un nœud peut être supprimé
   * @param nodeId L'ID du nœud à vérifier
   * @returns true si le nœud peut être supprimé
   */
  canDeleteNode(nodeId: string): boolean {
    const node = this.nodes().find(n => n.id === nodeId);
    if (!node) return false;

    // Empêcher la suppression du nœud Audience initial
    if (node.type === 'Audience' || node.type === 'Exit') {
      return false;
    }

    return true;
  }

  /**
   * Recalcule les positions de tous les nœuds après une suppression
   * @param spacing Espacement horizontal entre les nœuds (par défaut 250px)
   */
  recalculateAllNodesPositions(spacing: number = 250): void {
    // Obtenir les nœuds actuels
    const currentNodes = this.nodes();
    
    // Si aucun nœud ou un seul, rien à réorganiser
    if (currentNodes.length <= 1) return;
    
    // Identifier les différentes branches basées sur la position Y
    // Un seuil de 50px est utilisé pour considérer des nœuds comme étant sur la même ligne
    const yThreshold = 50;
    const branches: { [key: string]: CrmNode[] } = {};
    
    // Regrouper les nœuds par branches approximativement basées sur Y
    currentNodes.forEach(node => {
      // Trouver une branche existante proche de la position Y du nœud
      const branchKey = Object.keys(branches).find(key => {
        const branchY = parseInt(key);
        return Math.abs(node.position.y - branchY) < yThreshold;
      });
      
      if (branchKey) {
        // Ajouter à une branche existante
        branches[branchKey].push(node);
      } else {
        // Créer une nouvelle branche
        branches[node.position.y.toString()] = [node];
      }
    });
    
    // Optimiser l'espacement vertical entre branches si nécessaire
    const optimizedBranches = this.optimizeBranchSpacing(branches);
    
    console.log('Identified branches:', Object.keys(optimizedBranches).length);
    
    // Pour chaque branche, trier les nœuds horizontalement et recalculer les positions X
    const updatedNodes: CrmNode[] = [];
    
    Object.entries(optimizedBranches).forEach(([yKey, branchNodes]) => {
      const y = parseFloat(yKey);
      
      // Trier les nœuds de cette branche par position X
      const sortedBranchNodes = [...branchNodes].sort((a, b) => a.position.x - b.position.x);
      
      // Recalculer les positions X tout en maintenant Y
      sortedBranchNodes.forEach((node, index) => {
        updatedNodes.push({
          ...node,
          position: {
            x: index * spacing,
            y: y
          }
        });
      });
    });
    
    // Mettre à jour les nœuds
    this.updateNodes(updatedNodes);
    
    console.log('Node positions recalculated with spacing:', spacing);
  }
  
  /**
   * Optimise l'espacement vertical entre les branches
   * @param branches Branches à optimiser
   * @param minSpacing Espacement vertical minimum entre les branches
   * @returns Branches avec positions Y optimisées
   * @private
   */
  private optimizeBranchSpacing(
    branches: { [key: string]: CrmNode[] }, 
    minSpacing: number = 100
  ): { [key: string]: CrmNode[] } {
    // Si pas assez de branches pour optimiser
    if (Object.keys(branches).length <= 1) return branches;
    
    // Obtenir un tableau des positions Y ordonnées
    const yPositions = Object.keys(branches).map(y => parseFloat(y)).sort((a, b) => a - b);
    
    // Vérifier si des ajustements sont nécessaires
    let needsOptimization = false;
    for (let i = 1; i < yPositions.length; i++) {
      if (yPositions[i] - yPositions[i - 1] < minSpacing) {
        needsOptimization = true;
        break;
      }
    }
    
    // Si aucun ajustement n'est nécessaire, retourner les branches telles quelles
    if (!needsOptimization) return branches;
    
    // Créer de nouvelles positions Y optimisées
    const optimizedBranches: { [key: string]: CrmNode[] } = {};
    
    // Assigner une nouvelle position Y à chaque branche
    yPositions.forEach((originalY, index) => {
      const newY = index * minSpacing;
      optimizedBranches[newY.toString()] = branches[originalY.toString()];
    });
    
    console.log('Branch positions optimized with min spacing:', minSpacing);
    return optimizedBranches;
  }

  /**
   * Vérifie et répare l'intégrité de l'état du flow
   * - Vérifie que tous les nœuds et connexions ont des IDs
   * - Vérifie que les connexions référencent des nœuds valides
   * - Vérifie que les positions des nœuds sont cohérentes
   * @returns true si des réparations ont été effectuées
   */
  validateAndRepairState(): boolean {
    console.log('Validating and repairing flow state');
    let hasChanges = false;
    
    // 1. Vérifier les IDs des nœuds
    const nodesWithoutIds = this._state().nodes.filter(node => !node.id);
    if (nodesWithoutIds.length > 0) {
      console.warn('Found nodes without IDs:', nodesWithoutIds.length);
      this._state.update(state => ({
        ...state,
        nodes: state.nodes.map(node => {
          if (!node.id) {
            hasChanges = true;
            return { ...node, id: generateGuid() };
          }
          return node;
        })
      }));
    }
    
    // 2. Vérifier les IDs des connexions
    const connectionsWithoutIds = this._state().connections.filter(conn => !conn.id);
    if (connectionsWithoutIds.length > 0) {
      console.warn('Found connections without IDs:', connectionsWithoutIds.length);
      this._state.update(state => ({
        ...state,
        connections: state.connections.map(conn => {
          if (!conn.id) {
            hasChanges = true;
            return { ...conn, id: generateGuid() };
          }
          return conn;
        })
      }));
    }
    
    // 3. Vérifier que les connexions référencent des nœuds valides
    const nodeIds = new Set(this._state().nodes.map(node => node.id));
    const invalidConnections = this._state().connections.filter(conn => {
      const sourceNodeId = conn.sourceId.replace('output_', '');
      const targetNodeId = conn.targetId.replace('input_', '');
      return !nodeIds.has(sourceNodeId) || !nodeIds.has(targetNodeId);
    });
    
    if (invalidConnections.length > 0) {
      console.warn('Found invalid connections:', invalidConnections.length);
      this._state.update(state => ({
        ...state,
        connections: state.connections.filter(conn => {
          const sourceNodeId = conn.sourceId.replace('output_', '');
          const targetNodeId = conn.targetId.replace('input_', '');
          const isValid = nodeIds.has(sourceNodeId) && nodeIds.has(targetNodeId);
          if (!isValid) hasChanges = true;
          return isValid;
        })
      }));
    }
    
    // 4. Vérifier la cohérence des positions des nœuds
    const nodesWithInvalidPositions = this._state().nodes.filter(
      node => !node.position || typeof node.position.x !== 'number' || typeof node.position.y !== 'number'
    );
    
    if (nodesWithInvalidPositions.length > 0) {
      console.warn('Found nodes with invalid positions:', nodesWithInvalidPositions.length);
      this._state.update(state => ({
        ...state,
        nodes: state.nodes.map(node => {
          if (!node.position || typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
            hasChanges = true;
            return { 
              ...node, 
              position: { x: 0, y: 0 } 
            };
          }
          return node;
        })
      }));
      
      // Si des positions ont été réparées, recalculer toutes les positions
      this.recalculateAllNodesPositions();
    }
    
    // 5. Vérifier que les nœuds ont des propriétés maxInputs et maxOutputs
    const nodesWithInvalidIO = this._state().nodes.filter(
      node => node.maxInputs === undefined || node.maxOutputs === undefined
    );
    
    if (nodesWithInvalidIO.length > 0) {
      console.warn('Found nodes with invalid IO properties:', nodesWithInvalidIO.length);
      this._state.update(state => ({
        ...state,
        nodes: state.nodes.map(node => {
          if (node.maxInputs === undefined || node.maxOutputs === undefined) {
            hasChanges = true;
            return { 
              ...node, 
              maxInputs: node.maxInputs ?? this.getDefaultMaxInputs(node.type),
              maxOutputs: node.maxOutputs ?? this.getDefaultMaxOutputs(node.type)
            };
          }
          return node;
        })
      }));
    }
    
    if (hasChanges) {
      console.log('State repairs completed successfully');
    } else {
      console.log('No state repairs needed');
    }
    
    return hasChanges;
  }
}