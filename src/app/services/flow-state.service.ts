import { Injectable, signal, computed } from '@angular/core';
import { CrmNode, Connection } from '../models/crm.models';

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
   * Met à jour l'état complet du flow
   * @param state Nouvel état du flow
   */
  updateState(state: FlowState): void {
    this._state.set({
      nodes: structuredClone(state.nodes),
      connections: structuredClone(state.connections),
      zoom: structuredClone(state.zoom),
      temporaryElements: structuredClone(state.temporaryElements)
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
} 