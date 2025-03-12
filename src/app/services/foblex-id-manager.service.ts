import { Injectable, NgZone } from '@angular/core';
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
  constructor(
    private flowStateService: FlowStateService,
    private ngZone: NgZone
  ) {}

  /**
   * Synchronise un nœud avec son équivalent Foblex Flow
   * @param node Le nœud à synchroniser
   * @param foblexId L'ID Foblex (f-node-X)
   * @param fInputId L'ID du point d'entrée (input_X)
   * @param fOutputId L'ID du point de sortie (output_X)
   */
  syncNodeIds(
    node: CrmNode,
    foblexId: string,
    fInputId?: string,
    fOutputId?: string
  ): void {
    // Vérifier si l'ID a changé pour éviter les mises à jour inutiles
    if (node.foblexId === foblexId && 
        node.fInputId === (fInputId || node.fInputId) && 
        node.fOutputId === (fOutputId || node.fOutputId)) {
      console.log(`Node ${node.id} already synchronized with Foblex ID ${foblexId}, skipping update`);
      return;
    }
    
    // Mettre à jour les propriétés du nœud actuel
    node.foblexId = foblexId;
    
    if (fInputId) {
      node.fInputId = fInputId;
    }
    
    if (fOutputId) {
      node.fOutputId = fOutputId;
    }

    // Mettre à jour le nœud dans l'état en conservant la référence
    const nodes = this.flowStateService.nodes().map(n => {
      if (n.id === node.id) {
        return { ...n, foblexId, fInputId: fInputId || n.fInputId, fOutputId: fOutputId || n.fOutputId };
      }
      return n;
    });

    // Mise à jour dans une zone Angular pour garantir la détection des changements
    this.ngZone.run(() => {
      this.flowStateService.updateNodes(nodes);
    });

    console.log(`Node ${node.id} synchronized with Foblex ID ${foblexId}`);
  }

  /**
   * Synchronise une connexion avec son équivalent Foblex Flow
   * @param connection La connexion à synchroniser
   * @param foblexId L'ID Foblex (f-connection-X)
   */
  syncConnectionIds(connection: Connection, foblexId: string): void {
    // Vérifier si l'ID a changé pour éviter les mises à jour inutiles
    if (connection.foblexId === foblexId) {
      console.log(`Connection ${connection.id} already synchronized with Foblex ID ${foblexId}, skipping update`);
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

    console.log(`Connection ${connection.id} synchronized with Foblex ID ${foblexId}`);
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
   * Récupère l'ID d'entrée Foblex Flow d'un nœud à partir de son élément DOM
   * @param element L'élément DOM du nœud
   * @returns L'ID d'entrée Foblex Flow ou null si non trouvé
   */
  getNodeInputIdFromElement(element: HTMLElement): string | null {
    return element.getAttribute('data-f-input-id');
  }

  /**
   * Récupère l'ID de sortie Foblex Flow d'un nœud à partir de son élément DOM
   * @param element L'élément DOM du nœud
   * @returns L'ID de sortie Foblex Flow ou null si non trouvé
   */
  getNodeOutputIdFromElement(element: HTMLElement): string | null {
    return element.getAttribute('data-f-output-id');
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