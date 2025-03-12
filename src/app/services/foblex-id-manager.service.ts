import { Injectable, NgZone, inject, DestroyRef, effect, signal } from '@angular/core';
import { FlowStateService } from './flow-state.service';
import { CrmNode, Connection } from '../models/crm.models';

/**
 * Service qui gère la synchronisation des identifiants entre notre modèle d'application 
 * et les identifiants générés automatiquement par Foblex Flow
 */
@Injectable({
  providedIn: 'root'
})
export class FoblexIdManagerService {
  private readonly flowStateService = inject(FlowStateService);
  private readonly ngZone = inject(NgZone);
  
  /** Signal indiquant si une synchronisation est en cours */
  private readonly _isSynchronizing = signal(false);
  
  /** Signal pour déclencher une synchronisation */
  private readonly _syncRequested = signal(false);
  
  /** Compteur de requêtes de synchronisation pour éviter les doublons */
  private _syncRequestCounter = 0;
  
  /** Timestamp de la dernière synchronisation */
  private _lastSyncTime = 0;
  
  /** Délai minimum entre deux synchronisations (ms) */
  private readonly _syncDebounceTime = 300;
  
  /** Compteur de nœuds et connexions synchronisés lors de la dernière opération */
  private readonly _syncStats = signal<{
    nodesTotal: number;
    nodesSynced: number;
    connectionsTotal: number;
    connectionsSynced: number;
  }>({
    nodesTotal: 0,
    nodesSynced: 0,
    connectionsTotal: 0,
    connectionsSynced: 0
  });
  
  /** Statistiques de synchronisation publiques en lecture seule */
  readonly syncStats = this._syncStats.asReadonly();
  
  constructor() {
    // Créer un effet qui réagit aux changements de _syncRequested
    effect(() => {
      // Ne déclencher que si _syncRequested est true et qu'une synchronisation n'est pas déjà en cours
      if (this._syncRequested() && !this._isSynchronizing()) {
        const now = Date.now();
        // Vérifier si suffisamment de temps s'est écoulé depuis la dernière synchronisation
        if (now - this._lastSyncTime > this._syncDebounceTime) {
          this._lastSyncTime = now;
          // Réinitialiser le signal pour permettre de futurs déclenchements
          this._syncRequested.set(false);
          // Effectuer la synchronisation
          this.performSync();
        } else {
          // Si pas assez de temps s'est écoulé, réinitialiser quand même le signal
          // mais programmer une synchronisation différée
          this._syncRequested.set(false);
          setTimeout(() => {
            if (!this._isSynchronizing()) {
              this.requestSync();
            }
          }, this._syncDebounceTime);
        }
      }
    });
  }
  
  /**
   * Demande une synchronisation des IDs Foblex
   * Cette méthode peut être appelée depuis n'importe quel service/composant
   */
  requestSync(): void {
    // Incrémenter le compteur et activer le signal
    this._syncRequestCounter++;
    this._syncRequested.set(true);
  }
  
  /**
   * Effectue la synchronisation des IDs entre les modèles internes et Foblex
   * @param container Élément DOM contenant les nœuds et connexions (optionnel)
   */
  performSync(container?: HTMLElement): void {
    // Si une synchronisation est déjà en cours, abandonner
    if (this._isSynchronizing()) {
      return;
    }
    
    const state = this.flowStateService.state();
    
    // Vérifier si une synchronisation est nécessaire
    const unsyncedNodesCount = state.nodes.filter(n => !n.foblexId).length;
    const unsyncedConnectionsCount = state.connections.filter(c => !c.foblexId).length;
    
    if (unsyncedNodesCount === 0 && unsyncedConnectionsCount === 0 && 
        state.nodes.length > 0) {
      return;
    }
    
    // Activer le flag de synchronisation
    this._isSynchronizing.set(true);
    
    try {
      // Si aucun conteneur n'est fourni, utiliser le document entier
      const rootElement = container || document;
      
      // Synchroniser les nœuds
      this.syncNodes(rootElement);
      
      // Synchroniser les connexions
      this.syncConnections(rootElement);
      
      // Mettre à jour les statistiques
      this._syncStats.set({
        nodesTotal: state.nodes.length,
        nodesSynced: state.nodes.filter(n => !!n.foblexId).length,
        connectionsTotal: state.connections.length,
        connectionsSynced: state.connections.filter(c => !!c.foblexId).length
      });
    } catch (error) {
      console.error('Error during ID synchronization:', error);
    } finally {
      // Désactiver le flag de synchronisation après un court délai
      setTimeout(() => {
        this._isSynchronizing.set(false);
      }, 100);
    }
  }
  
  /**
   * Synchronise les IDs des nœuds
   * @param container Élément DOM contenant les nœuds
   * @private
   */
  private syncNodes(container: HTMLElement | Document): void {
    const nodeElements = container.querySelectorAll('[fnode]');
    
    for (const element of Array.from(nodeElements)) {
      const nodeElement = element as HTMLElement;
      
      // Ignorer les nœuds temporaires
      if (nodeElement.classList.contains('temporary-node')) {
        continue;
      }
      
      // Récupérer l'ID Foblex et l'ID de nœud interne
      const foblexId = this.getNodeFoblexIdFromElement(nodeElement);
      const dataNodeId = nodeElement.getAttribute('data-node-id');
      
      if (foblexId && dataNodeId) {
        const node = this.flowStateService.nodes().find(n => n.id === dataNodeId);
        if (node && node.foblexId !== foblexId) {
          this.syncNodeIds(node, foblexId);
        }
      }
    }
  }
  
  /**
   * Synchronise les IDs des connexions
   * @param container Élément DOM contenant les connexions
   * @private
   */
  private syncConnections(container: HTMLElement | Document): void {
    const connectionElements = container.querySelectorAll('f-connection');
    
    for (const element of Array.from(connectionElements)) {
      const connectionElement = element as HTMLElement;
      
      // Ignorer les connexions temporaires
      if (connectionElement.classList.contains('temporary-connection')) {
        continue;
      }
      
      // Récupérer l'ID Foblex
      const foblexId = this.getConnectionFoblexIdFromElement(connectionElement);
      
      // Récupérer l'ID de la connexion
      const dataConnectionId = connectionElement.getAttribute('data-connection-id');
      
      if (foblexId && dataConnectionId) {
        const connection = this.flowStateService.connections().find(c => c.id === dataConnectionId);
        if (connection && connection.foblexId !== foblexId) {
          this.syncConnectionIds(connection, foblexId);
        }
      }
    }
  }

  /**
   * Synchronise un nœud avec son équivalent Foblex Flow
   * @param node Le nœud à synchroniser
   * @param foblexId L'ID Foblex (f-node-X)
   */
  syncNodeIds(node: CrmNode, foblexId: string): void {
    // Vérifier si l'ID a changé pour éviter les mises à jour inutiles
    if (node.foblexId === foblexId) {
      return;
    }
    
    // Mettre à jour la propriété du nœud actuel
    node.foblexId = foblexId;

    // Mettre à jour le nœud dans l'état en conservant la référence
    const nodes = this.flowStateService.nodes().map(n => {
      if (n.id === node.id) {
        return { ...n, foblexId };
      }
      return n;
    });

    // Mise à jour dans une zone Angular pour garantir la détection des changements
    this.ngZone.run(() => {
      this.flowStateService.updateNodes(nodes);
    });
  }

  /**
   * Synchronise une connexion avec son équivalent Foblex Flow
   * @param connection La connexion à synchroniser
   * @param foblexId L'ID Foblex (f-connection-X)
   */
  syncConnectionIds(connection: Connection, foblexId: string): void {
    // Vérifier si l'ID a changé pour éviter les mises à jour inutiles
    if (connection.foblexId === foblexId) {
      return;
    }
    
    // Mettre à jour les propriétés de la connexion actuelle
    connection.foblexId = foblexId;

    // Mettre à jour la connexion dans l'état
    const connections = this.flowStateService.connections().map(c => {
      if (c.id === connection.id) {
        return { ...c, foblexId };
      }
      return c;
    });

    // Mise à jour dans une zone Angular pour garantir la détection des changements
    this.ngZone.run(() => {
      this.flowStateService.updateConnections(connections);
    });
  }

  /**
   * Trouve un nœud par son ID Foblex Flow
   * @param foblexId L'ID Foblex Flow à rechercher
   * @returns Le nœud trouvé ou undefined
   */
  findNodeByFoblexId(foblexId: string): CrmNode | undefined {
    return this.flowStateService.nodes().find(node => node.foblexId === foblexId);
  }

  /**
   * Trouve une connexion par son ID Foblex Flow
   * @param foblexId L'ID Foblex Flow à rechercher
   * @returns La connexion trouvée ou undefined
   */
  findConnectionByFoblexId(foblexId: string): Connection | undefined {
    return this.flowStateService.connections().find(conn => conn.foblexId === foblexId);
  }

  /**
   * Récupère l'ID Foblex Flow d'un nœud à partir de son élément DOM
   * @param element L'élément DOM du nœud
   * @returns L'ID Foblex Flow ou null si non trouvé
   */
  getNodeFoblexIdFromElement(element: HTMLElement): string | null {
    return element.getAttribute('data-f-node-id');
  }

  /**
   * Récupère l'ID Foblex Flow d'une connexion à partir de son élément DOM
   * @param element L'élément DOM de la connexion
   * @returns L'ID Foblex Flow ou null si non trouvé
   */
  getConnectionFoblexIdFromElement(element: HTMLElement): string | null {
    // 1. Récupérer directement l'ID de l'élément f-connection
    if (element.id && element.id.startsWith('f-connection-')) {
      return element.id;
    }
    
    // 2. Pour les connexions, l'ID peut aussi être dans un attribut data-f-path-id
    const pathElement = element.querySelector('[data-f-path-id]');
    if (pathElement) {
      const pathId = pathElement.getAttribute('data-f-path-id');
      if (pathId) {
        return pathId;
      }
    }
    
    // 3. En dernier recours, analyser l'ID du path de connexion
    const connectionPaths = element.querySelectorAll('path[id^="connection_"]');
    for (let i = 0; i < connectionPaths.length; i++) {
      const pathId = connectionPaths[i].id;
      if (pathId) {
        const match = pathId.match(/connection_(f-connection-\d+)/);
        if (match && match.length > 1) {
          return match[1];
        }
      }
    }
    
    return null;
  }

  /**
   * Convertit un ID Foblex Flow (f-node-X) en notre format d'ID interne
   * @param foblexId L'ID Foblex Flow à convertir
   * @returns L'ID interne correspondant ou undefined si non trouvé
   */
  getInternalIdFromFoblexId(foblexId: string): string | undefined {
    const node = this.findNodeByFoblexId(foblexId);
    if (node) {
      return node.id;
    }
    
    const connection = this.findConnectionByFoblexId(foblexId);
    if (connection) {
      return connection.id;
    }
    
    return undefined;
  }

  /**
   * Convertit notre ID interne en ID Foblex Flow
   * @param internalId Notre ID interne
   * @returns L'ID Foblex Flow correspondant ou undefined si non trouvé
   */
  getFoblexIdFromInternalId(internalId: string): string | undefined {
    // Chercher dans les nœuds
    const node = this.flowStateService.nodes().find(n => n.id === internalId);
    if (node && node.foblexId) {
      return node.foblexId;
    }
    
    // Chercher dans les connexions
    const connection = this.flowStateService.connections().find(c => c.id === internalId);
    if (connection && connection.foblexId) {
      return connection.foblexId;
    }
    
    return undefined;
  }
} 