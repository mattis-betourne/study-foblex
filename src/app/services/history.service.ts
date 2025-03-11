import { Injectable, signal, computed, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CrmNode, Connection } from '../models/crm.models';

/**
 * Interface représentant l'état du flow pour l'historique
 */
export interface FlowState {
  nodes: CrmNode[];
  connections: Connection[];
}

/**
 * Interface pour le service capable de mettre à jour le flow
 */
export interface FlowStateUpdater {
  setNodes(nodes: CrmNode[]): void;
  setConnections(connections: Connection[]): void;
  clearTemporaryElements(): void;
}

/**
 * Service de gestion de l'historique des actions du flow
 * Respecte le principe de responsabilité unique (SRP)
 */
@Injectable({
  providedIn: 'root'
})
export class HistoryService {
  /**
   * Historique des états du flow
   * @private
   */
  private readonly _history = signal<FlowState[]>([]);
  
  /**
   * Index courant dans l'historique
   * @private
   */
  private readonly _currentIndex = signal<number>(-1);
  
  /**
   * Taille maximale de l'historique
   * @private
   */
  private readonly maxHistorySize = 50;

  /**
   * État actuel du flow
   * @private
   */
  private readonly _currentState = signal<FlowState | null>(null);

  /**
   * Signal calculé indiquant si l'annulation est possible
   */
  readonly canUndo = computed(() => 
    this._currentIndex() > 0 && this._history().length > 0
  );
  
  /**
   * Signal calculé indiquant si le rétablissement est possible
   */
  readonly canRedo = computed(() => 
    this._currentIndex() < this._history().length - 1 && this._history().length > 0
  );

  /**
   * Observable indiquant si l'annulation est possible
   */
  readonly canUndo$ = toObservable(this.canUndo);
  
  /**
   * Observable indiquant si le rétablissement est possible
   */
  readonly canRedo$ = toObservable(this.canRedo);

  /**
   * Observable de l'état actuel du flow
   */
  readonly currentState$ = toObservable(this._currentState);

  /**
   * Référence au service qui met à jour l'état du flow
   * @private
   */
  private flowUpdater: FlowStateUpdater | null = null;

  constructor() {}

  /**
   * Définit l'état actuel et met à jour les abonnés
   * @param state Nouvel état du flow
   */
  setCurrentState(state: FlowState): void {
    const stateCopy = this.deepCopyState(state);
    this._currentState.set(stateCopy);
  }

  /**
   * Obtient l'état actuel du flow
   */
  getCurrentState(): FlowState | null {
    return this._currentState();
  }

  /**
   * Ajoute un nouvel état à l'historique
   * @param state État à sauvegarder
   * @returns État sauvegardé (copie profonde)
   */
  pushState(state: FlowState): FlowState {
    // Tronquer l'historique si nous sommes au milieu
    if (this._currentIndex() < this._history().length - 1) {
      this._history.update(history => history.slice(0, this._currentIndex() + 1));
    }

    // Créer une copie profonde de l'état
    const stateCopy = this.deepCopyState(state);

    // Ajouter le nouvel état et mettre à jour l'index
    this._history.update(history => [...history, stateCopy]);
    this._currentIndex.update(index => index + 1);

    // Mettre à jour l'état courant
    this._currentState.set(stateCopy);

    // Limiter la taille de l'historique
    if (this._history().length > this.maxHistorySize) {
      this._history.update(history => history.slice(1));
      this._currentIndex.update(index => index - 1);
    }

    return stateCopy;
  }

  /**
   * Annule la dernière action et retourne l'état précédent
   * @returns État précédent ou null si impossible
   */
  undo(): FlowState | null {
    if (!this.canUndo()) {
      console.log('Cannot undo: no previous state available');
      return null;
    }

    // Décrémente l'index courant
    this._currentIndex.update(index => index - 1);
    
    // Récupérer l'état précédent
    const previousState = this.deepCopyState(this._history()[this._currentIndex()]);
    
    // Mettre à jour l'état courant
    this._currentState.set(previousState);
    
    return previousState;
  }

  /**
   * Rétablit l'action annulée et retourne l'état suivant
   * @returns État suivant ou null si impossible
   */
  redo(): FlowState | null {
    if (!this.canRedo()) {
      console.log('Cannot redo: no next state available');
      return null;
    }

    // Incrémente l'index courant
    this._currentIndex.update(index => index + 1);
    
    // Récupérer l'état suivant
    const nextState = this.deepCopyState(this._history()[this._currentIndex()]);
    
    // Mettre à jour l'état courant
    this._currentState.set(nextState);
    
    return nextState;
  }

  /**
   * Réinitialise l'historique
   */
  clear(): void {
    this._history.set([]);
    this._currentIndex.set(-1);
    this._currentState.set(null);
  }

  /**
   * Crée une copie profonde d'un état pour éviter les références partagées
   * @param state État à copier
   * @returns Copie profonde de l'état
   * @private
   */
  private deepCopyState(state: FlowState): FlowState {
    return {
      nodes: JSON.parse(JSON.stringify(state.nodes)),
      connections: JSON.parse(JSON.stringify(state.connections))
    };
  }

  /**
   * Enregistre un service capable de mettre à jour l'état du flow
   * @param updater Service implémentant l'interface FlowStateUpdater
   */
  registerFlowUpdater(updater: FlowStateUpdater): void {
    this.flowUpdater = updater;
  }

  /**
   * Sauvegarde directement l'état du flow
   * @param nodes Nœuds du flow
   * @param connections Connexions du flow
   */
  saveFlowState(nodes: CrmNode[], connections: Connection[]): void {
    const state: FlowState = {
      nodes,
      connections
    };
    this.pushState(state);
  }

  /**
   * Annule la dernière action et met à jour le flow
   * @returns État précédent ou null si impossible
   */
  undoAndUpdateFlow(): FlowState | null {
    const previousState = this.undo();
    
    if (previousState && this.flowUpdater) {
      this.flowUpdater.setNodes(previousState.nodes);
      this.flowUpdater.setConnections(previousState.connections);
      this.flowUpdater.clearTemporaryElements();
    }
    
    return previousState;
  }

  /**
   * Rétablit l'action annulée et met à jour le flow
   * @returns État suivant ou null si impossible
   */
  redoAndUpdateFlow(): FlowState | null {
    const nextState = this.redo();
    
    if (nextState && this.flowUpdater) {
      this.flowUpdater.setNodes(nextState.nodes);
      this.flowUpdater.setConnections(nextState.connections);
      this.flowUpdater.clearTemporaryElements();
    }
    
    return nextState;
  }
} 