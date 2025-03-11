import { Injectable, signal, computed, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CrmNode, Connection } from '../models/crm.models';
import { FlowState, FlowStateService } from './flow-state.service';

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
   * Service d'état du flow
   * @private
   */
  private readonly flowStateService = inject(FlowStateService);

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

  constructor() {}

  /**
   * Sauvegarde l'état actuel du flow dans l'historique
   */
  saveState(): void {
    // Récupérer l'état actuel depuis le service d'état
    const currentState = this.flowStateService.state();
    
    // Créer une copie profonde
    const stateCopy = this.deepCopyState(currentState);

    // Tronquer l'historique si nous sommes au milieu
    if (this._currentIndex() < this._history().length - 1) {
      this._history.update(history => history.slice(0, this._currentIndex() + 1));
    }

    // Ajouter le nouvel état et mettre à jour l'index
    this._history.update(history => [...history, stateCopy]);
    this._currentIndex.update(index => index + 1);

    // Limiter la taille de l'historique
    if (this._history().length > this.maxHistorySize) {
      this._history.update(history => history.slice(1));
      this._currentIndex.update(index => index - 1);
    }
  }

  /**
   * Annule la dernière action
   */
  undo(): void {
    if (!this.canUndo()) {
      console.log('Cannot undo: no previous state available');
      return;
    }

    // Décrémente l'index courant
    this._currentIndex.update(index => index - 1);
    
    // Récupérer l'état précédent
    const previousState = this._history()[this._currentIndex()];
    
    // Mettre à jour l'état dans le service
    this.flowStateService.updateState(previousState);
  }

  /**
   * Rétablit l'action annulée
   */
  redo(): void {
    if (!this.canRedo()) {
      console.log('Cannot redo: no next state available');
      return;
    }

    // Incrémente l'index courant
    this._currentIndex.update(index => index + 1);
    
    // Récupérer l'état suivant
    const nextState = this._history()[this._currentIndex()];
    
    // Mettre à jour l'état dans le service
    this.flowStateService.updateState(nextState);
  }

  /**
   * Réinitialise l'historique
   */
  clear(): void {
    this._history.set([]);
    this._currentIndex.set(-1);
  }

  /**
   * Crée une copie profonde d'un état pour éviter les références partagées
   * @param state État à copier
   * @returns Copie profonde de l'état
   * @private
   */
  private deepCopyState(state: FlowState): FlowState {
    return {
      nodes: structuredClone(state.nodes),
      connections: structuredClone(state.connections),
      zoom: structuredClone(state.zoom),
      temporaryElements: structuredClone(state.temporaryElements)
    };
  }
} 