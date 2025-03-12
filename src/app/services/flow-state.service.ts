import { computed, Injectable, signal } from '@angular/core';
import { Connection, CrmNode } from '../models/crm.models';

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
   */
  addNode(node: CrmNode): void {
    this._state.update(state => ({
      ...state,
      nodes: [...state.nodes, structuredClone(node)]
    }));
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
   */
  addConnection(connection: Connection): void {
    this._state.update(state => ({
      ...state,
      connections: [...state.connections, structuredClone(connection)]
    }));
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
}