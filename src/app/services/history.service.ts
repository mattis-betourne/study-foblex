import { Injectable, signal, computed } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CrmNode, Connection } from '../models/crm.models';

export interface FlowState {
  nodes: CrmNode[];
  connections: Connection[];
}

@Injectable({
  providedIn: 'root'
})
export class HistoryService {
  private _history = signal<FlowState[]>([]);
  private _currentIndex = signal<number>(-1);
  private readonly maxHistorySize = 50; // Limiter la taille pour des questions de performance

  // Signaux calculés pour l'état des actions
  readonly canUndo = computed(() => {
    // On ne peut pas faire undo si on est au premier état ou s'il n'y a pas d'état
    return this._currentIndex() > 0 && this._history().length > 0;
  });
  
  readonly canRedo = computed(() => {
    // On ne peut pas faire redo si on est au dernier état ou s'il n'y a pas d'état
    return this._currentIndex() < this._history().length - 1 && this._history().length > 0;
  });

  // Pour la compatibilité avec les composants existants qui utilisent l'API Observable
  readonly canUndo$ = toObservable(this.canUndo);
  readonly canRedo$ = toObservable(this.canRedo);

  constructor() {}

  /**
   * Ajoute un nouvel état à l'historique
   */
  pushState(state: FlowState): void {
    // Si nous sommes au milieu de l'historique, supprimer tout ce qui est après
    if (this._currentIndex() < this._history().length - 1) {
      this._history.update(history => history.slice(0, this._currentIndex() + 1));
    }

    // Créer une copie profonde de l'état pour éviter les références partagées
    const stateCopy: FlowState = {
      nodes: JSON.parse(JSON.stringify(state.nodes)),
      connections: JSON.parse(JSON.stringify(state.connections))
    };

    // Ajouter le nouvel état
    this._history.update(history => [...history, stateCopy]);
    this._currentIndex.update(index => index + 1);

    // Limiter la taille de l'historique
    if (this._history().length > this.maxHistorySize) {
      this._history.update(history => history.slice(1));
      this._currentIndex.update(index => index - 1);
    }
  }

  /**
   * Annule la dernière action et retourne l'état précédent
   */
  undo(): FlowState | null {
    if (!this.canUndo()) {
      return null;
    }

    this._currentIndex.update(index => index - 1);
    
    // Retourner une copie profonde pour éviter les modifications accidentelles
    return JSON.parse(JSON.stringify(this._history()[this._currentIndex()]));
  }

  /**
   * Rétablit l'action annulée et retourne l'état suivant
   */
  redo(): FlowState | null {
    if (!this.canRedo()) {
      return null;
    }

    this._currentIndex.update(index => index + 1);
    
    // Retourner une copie profonde pour éviter les modifications accidentelles
    return JSON.parse(JSON.stringify(this._history()[this._currentIndex()]));
  }

  /**
   * Réinitialise l'historique
   */
  clear(): void {
    this._history.set([]);
    this._currentIndex.set(-1);
  }
} 