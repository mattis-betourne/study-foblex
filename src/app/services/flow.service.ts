import { ChangeDetectorRef, inject, Injectable } from '@angular/core';
import { generateGuid } from '@foblex/utils';
import { Connection, CrmNode } from '../models/crm.models';
import { ConfirmationService } from './confirmation.service';
import { FlowStateService } from './flow-state.service';
import { FoblexIdManagerService } from './foblex-id-manager.service';
import { HistoryService } from './history.service';
import { TemporaryNodeService } from './temporary-node.service';
import { ZoomService } from './zoom.service';

/**
 * Service responsable de l'orchestration des opérations métier du flow diagram
 * Se concentre sur les opérations qui impliquent plusieurs services
 * ou qui nécessitent une logique métier complexe
 * 
 * Les opérations simples d'état doivent utiliser directement FlowStateService
 */
@Injectable({
  providedIn: 'root'
})
export class FlowService {
  // Constante pour l'espacement standard entre les nœuds
  private readonly STANDARD_NODE_OFFSET = 250;

  // Services injectés
  private readonly historyService = inject(HistoryService);
  private readonly zoomService = inject(ZoomService);
  private readonly temporaryNodeService = inject(TemporaryNodeService);
  private readonly flowStateService = inject(FlowStateService);
  private readonly foblexIdManager = inject(FoblexIdManagerService);
  private readonly confirmationService = inject(ConfirmationService);

  constructor() {
    console.log('FlowService initialized');
  }

  /**
   * Commence le processus de glisser-déposer d'un type d'élément
   * @param itemType Type d'élément à glisser-déposer
   */
  startDragging(itemType: string): void {
    console.log(`Starting drag for item type: ${itemType}`);
    this.flowStateService.updateDraggingItemType(itemType);
    //this.temporaryNodeService.createTemporaryNodes(itemType);
  }

  /**
   * Termine le processus de glisser-déposer
   */
  endDragging(): void {
    console.log('Ending drag operation');
    this.flowStateService.updateDraggingItemType(null);
  }

  /**
   * Définit la référence à la directive de zoom
   * @param zoomDirective Référence à la directive de zoom
   */
  setZoomDirective(zoomDirective: any): void {
    this.zoomService.setZoomDirective(zoomDirective);
  }

  /**
   * Augmente le niveau de zoom
   * @param point Point central du zoom (optionnel)
   */
  zoomIn(point?: any): void {
    this.zoomService.zoomIn(point);
    // Sauvegarder l'état du zoom dans l'historique
    this.historyService.saveState();
  }

  /**
   * Diminue le niveau de zoom
   * @param point Point central du zoom (optionnel)
   */
  zoomOut(point?: any): void {
    this.zoomService.zoomOut(point);
    // Sauvegarder l'état du zoom dans l'historique
    this.historyService.saveState();
  }

  /**
   * Réinitialise le zoom et centre le canvas
   */
  resetZoom(): void {
    this.zoomService.resetZoom();
    // Sauvegarder l'état du zoom dans l'historique
    this.historyService.saveState();
  }

  /**
   * Ajoute un nœud et sauvegarde l'état pour l'historique
   * @param node Le nœud à ajouter
   */
  addNodeAndSave(node: CrmNode): void {
    console.log('Adding node:', node);
    
    // Déléguer l'ajout du nœud au FlowStateService
    const addedNode = this.flowStateService.addNode(node);
    
    // Enregistrer l'état pour l'historique
    if (addedNode) {
      this.saveState('Ajout d\'un nœud');
    }
  }
  
  /**
   * Ajoute une connexion et sauvegarde l'état pour l'historique
   * @param connection La connexion à ajouter
   */
  addConnectionAndSave(connection: Connection): void {
    console.log('Adding connection:', connection);
    
    // Vérifier si la connexion est autorisée
    if (!this.canConnect(connection.sourceId, connection.targetId)) {
      console.warn('Connection not allowed between', connection.sourceId, 'and', connection.targetId);
      return;
    }
    
    // Déléguer l'ajout de la connexion au FlowStateService
    const addedConnection = this.flowStateService.addConnection(connection);
    
    // Enregistrer l'état pour l'historique
    if (addedConnection) {
      this.saveState('Ajout d\'une connexion');
    }
  }
  
  /**
   * Supprime un nœud et sauvegarde l'état pour l'historique
   * @param nodeId L'ID du nœud à supprimer
   */
  removeNodeAndSave(nodeId: string): void {
    console.log('Removing node:', nodeId);
    
    // Déléguer la suppression du nœud au FlowStateService
    const nodeRemoved = this.flowStateService.removeNode(nodeId);
    
    // Enregistrer l'état pour l'historique
    if (nodeRemoved) {
      this.saveState('Suppression d\'un nœud');
    }
  }
  
  /**
   * Supprime une connexion et sauvegarde l'état pour l'historique
   * @param connectionId L'ID de la connexion à supprimer
   */
  removeConnectionAndSave(connectionId: string): void {
    console.log('Removing connection:', connectionId);
    
    // Déléguer la suppression de la connexion au FlowStateService
    const connectionRemoved = this.flowStateService.removeConnection(connectionId);
    
    // Enregistrer l'état pour l'historique
    if (connectionRemoved) {
      this.saveState('Suppression d\'une connexion');
    }
  }

  /**
   * Crée les nœuds par défaut (Audience et Exit connectés)
   */
  addDefaultNode(): void {
    // Vérifier si des nœuds existent déjà pour éviter la duplication
    if (this.flowStateService.nodes().length > 0) {
      console.log('Default nodes already exist, skipping creation');
      return;
    }
    
    console.log('Creating default nodes...');
    
    try {
      // Crée un nœud Audience par défaut
      const audienceNode: CrmNode = {
        id: generateGuid(),
        type: 'Audience',
        text: 'Audience cible',
        position: { x: 0, y: 0 },
        maxInputs: 0,  // Pas d'entrée
        maxOutputs: 1  // 1 sortie maximum
      };
      
      // Crée un nœud Exit par défaut avec l'espacement standard de 350px
      const exitNode: CrmNode = {
        id: generateGuid(),
        type: 'Exit',
        text: 'Fin du parcours',
        position: { x: audienceNode.position.x + this.STANDARD_NODE_OFFSET, y: audienceNode.position.y },  // Utilise l'espacement standard
        maxInputs: 1,   // 1 entrée maximum
        maxOutputs: 0   // Pas de sortie
      };
      
      // Crée une connexion entre Audience et Exit
      const defaultConnection: Connection = {
        id: generateGuid(),
        sourceId: `output_${audienceNode.id}`,
        targetId: `input_${exitNode.id}`
      };
      
      // Mise à jour des nœuds et de la connexion
      this.flowStateService.updateNodes([audienceNode, exitNode]);
      this.flowStateService.updateConnections([defaultConnection]);
      
      console.log('Default nodes and connection created successfully');
      
      // Sauvegarder l'état APRÈS création des nœuds par défaut
      // et s'assurer que c'est le premier état dans l'historique
      if (this.flowStateService.nodes().length > 0) {
        setTimeout(() => {
          // Vider l'historique avant de sauvegarder l'état initial
          this.historyService.clear();
          // Puis sauvegarder l'état initial
          this.historyService.saveState();
          
          // Demander une synchronisation des IDs
          this.foblexIdManager.requestSync();
        }, 0);
      }
    } catch (error) {
      console.error('Error creating default nodes:', error);
    }
  }
  
  /**
   * Annule la dernière action
   */
  undo(): void {
    //this.temporaryNodeService.clearTemporaryElements();
    this.historyService.undo();
  }

  /**
   * Rétablit l'action annulée
   */
  redo(): void {
    //this.temporaryNodeService.clearTemporaryElements();
    this.historyService.redo();
  }

  /**
   * Vérifie si deux nœuds peuvent être connectés
   * @param source Identifiant de la source
   * @param target Identifiant de la cible
   * @returns true si la connexion est possible
   */
  canConnect(source: string, target: string): boolean {
    // Vérifier que les arguments sont valides
    if (!source || !target) {
      console.log('Source or target is invalid');
      return false;
    }

    // Vérifier les règles métier pour les connexions
    const sourceNodeId = source.replace('output_', '');
    const targetNodeId = target.replace('input_', '');
    
    const sourceNode = this.flowStateService.nodes().find((node: CrmNode) => node.id === sourceNodeId);
    const targetNode = this.flowStateService.nodes().find((node: CrmNode) => node.id === targetNodeId);

    if (!sourceNode || !targetNode) {
      console.log('Source or target node not found');
      return false;
    }

    // Vérifier si le nœud source est un output
    const isSourceOutput = source.startsWith('output_');
    // Vérifier si le nœud cible est un input
    const isTargetInput = target.startsWith('input_');

    // Les connexions ne sont possibles que d'un output vers un input
    if (!isSourceOutput || !isTargetInput) {
      console.log('Source must be an output and target must be an input');
      return false;
    }

    // Vérifier si une connexion existe déjà entre ces deux ports
    const connectionExists = this.flowStateService.connections().some(
      (conn: Connection) => conn.sourceId === source && conn.targetId === target
    );

    if (connectionExists) {
      console.log('Connection already exists');
      return false;
    }

    // Vérifier les limites de connexions pour le nœud source
    const existingOutputs = this.flowStateService.getConnectionsFrom(source);
    const existingInputs = this.flowStateService.getConnectionsTo(target);

    // Vérifier les limites pour les sorties
    if (sourceNode.maxOutputs !== undefined && sourceNode.maxOutputs !== -1 && 
        existingOutputs.length >= sourceNode.maxOutputs) {
      console.log(`Source node has reached its maximum outputs: ${existingOutputs.length}/${sourceNode.maxOutputs}`);
      return false;
    }

    // Vérifier les limites pour les entrées
    if (targetNode.maxInputs !== undefined && targetNode.maxInputs !== -1 && 
        existingInputs.length >= targetNode.maxInputs) {
      console.log(`Target node has reached its maximum inputs: ${existingInputs.length}/${targetNode.maxInputs}`);
      return false;
    }

    return true;
  }

  /**
   * Retourne l'icône pour un type de nœud
   * @param type Type du nœud
   * @returns Icône à afficher
   */
  getNodeIcon(type: string): string {
    switch (type) {
      // Targeting
      case 'Audience':
        return '👥';
        
      // Execution
      case 'BinarySplit':
        return '🔀';
      case 'MultiSplit':
        return '🔱';
      case 'Exit':
        return '🔚';
      
      // Communication
      case 'Full Screen':
        return '📱';
      case 'SMS':
        return '💬';
      case 'Push':
        return '🔔';
      case 'Email':
        return '✉️';
      
      // Rewards
      case 'Freebet':
        return '🎁';
        
      // Fallback
      default:
        return '📄';
    }
  }

  /**
   * Sauvegarder l'état pour l'historique
   * @param actionDescription Description de l'action effectuée
   */
  private saveState(actionDescription: string): void {
    this.historyService.saveState();
    console.log(`État sauvegardé - ${actionDescription}`);
  }

  /**
   * Supprime intelligemment un nœud après confirmation
   * @param nodeId L'ID du nœud à supprimer
   */
  smartDelete(nodeId: string): void {
    // Vérifier d'abord si le nœud peut être supprimé
    if (!this.flowStateService.canDeleteNode(nodeId)) {
      console.warn('Node cannot be deleted:', nodeId);
      return;
    }

    // Récupérer le nœud pour afficher son type dans la confirmation
    const nodeToDelete = this.flowStateService.nodes().find(node => node.id === nodeId);
    if (!nodeToDelete) return;

    // Afficher le dialogue de confirmation
    this.confirmationService.show({
      title: 'Confirmer la suppression',
      message: `Êtes-vous sûr de vouloir supprimer ce nœud "${nodeToDelete.type}" et toutes ses connexions ?`,
      confirmLabel: 'Supprimer',
      cancelLabel: 'Annuler',
      onConfirm: () => {
        // Exécuter la suppression une fois confirmée
        this.executeSmartDelete(nodeId);

        this.foblexIdManager.requestSync();
      }
    });
  }

  /**
   * Exécute la suppression intelligente après confirmation
   * @private
   */
  private executeSmartDelete(nodeId: string): void {
    // Déplacer ici toute la logique existante de smartDelete
    console.log('Executing smart delete for node:', nodeId);
    
    const nodeToDelete = this.flowStateService.nodes().find(node => node.id === nodeId);
    if (!nodeToDelete) return;

    console.log('Node type to delete:', nodeToDelete.type);
    
    // CAS SPÉCIAL: Si c'est un BinarySplit ou MultiSplit, supprimer tous les nœuds successifs
    if (nodeToDelete.type === 'BinarySplit' || nodeToDelete.type === 'MultiSplit') {
      this.deleteNodeAndAllSuccessors(nodeId);
      return;
    }
    
    // CAS NORMAL: Traitement standard pour les autres types de nœuds
    
    // Trouver les connexions entrantes et sortantes du nœud avec préfixes
    const inputId = `input_${nodeId}`;
    const outputId = `output_${nodeId}`;
    
    // Obtenir toutes les connexions actuelles
    const allConnections = this.flowStateService.connections();
    console.log('All connections before deletion:', allConnections);
    
    // Trouver les connexions entrantes et sortantes
    const incomingConnections = allConnections.filter(conn => conn.targetId === inputId);
    const outgoingConnections = allConnections.filter(conn => conn.sourceId === outputId);
    
    console.log(`Found ${incomingConnections.length} incoming and ${outgoingConnections.length} outgoing connections`);
    console.log('Incoming connections:', incomingConnections);
    console.log('Outgoing connections:', outgoingConnections);
    
    // Mémoriser les IDs des connexions à supprimer
    const connectionsToDelete = [
      ...incomingConnections.map(conn => conn.id),
      ...outgoingConnections.map(conn => conn.id)
    ];
    
    // ÉTAPE CRUCIALE: Créer d'abord les nouvelles connexions
    // Si le nœud est au milieu (a des connexions entrantes ET sortantes)
    if (incomingConnections.length > 0 && outgoingConnections.length > 0) {
      console.log('Node is in the middle of a flow, creating bridging connections');
      
      // Pour chaque source (connexion entrante)
      for (const incomingConn of incomingConnections) {
        // Pour chaque cible (connexion sortante)
        for (const outgoingConn of outgoingConnections) {
          console.log(`Trying to bridge: ${incomingConn.sourceId} -> ${outgoingConn.targetId}`);
          
          // Créer une nouvelle connexion directe
          const newConnection: Connection = {
            id: `conn_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            sourceId: incomingConn.sourceId,
            targetId: outgoingConn.targetId
          };
          
          // Ajouter la connexion directement sans passer par addConnectionAndSave
          // pour éviter de déclencher une vérification qui pourrait échouer
          this.flowStateService.addConnection(newConnection);
          console.log('Created bridging connection:', newConnection);
        }
      }
    }
    
    // PUIS supprimer les connexions originales
    for (const connId of connectionsToDelete) {
      this.flowStateService.removeConnection(connId);
      console.log('Removed connection:', connId);
    }
    
    // ENFIN, supprimer le nœud lui-même
    this.flowStateService.removeNode(nodeId);
    console.log('Removed node:', nodeId);
    
    // AMÉLIORATION: Utiliser le recalcul intelligent au lieu du recalcul standard
    // Recalculer intelligemment les positions des nœuds en préservant notre grille
    this.flowStateService.smartRecalculatePositionsAfterDeletion(nodeId);
    
    // Réinitialiser la sélection
    this.flowStateService.updateSelectedNodes([]);
    
    // Sauvegarder l'état pour l'historique
    this.saveState('Suppression intelligente d\'un nœud');
    
    // Demander une synchronisation des IDs après la suppression
    this.foblexIdManager.requestSync();
  }

  /**
   * Supprime récursivement un nœud et tous ses successeurs dans l'arbre
   * Utilisé principalement pour les BinarySplit et MultiSplit
   * @param nodeId L'ID du nœud racine à supprimer
   */
  private deleteNodeAndAllSuccessors(nodeId: string): void {
    console.log('Deleting node and all successors:', nodeId);
    
    // Identifier tous les nœuds à supprimer en commençant par le nœud racine
    const nodesToDelete = new Set<string>();
    
    // Fonction récursive pour trouver tous les successeurs
    const findSuccessors = (currentNodeId: string) => {
      nodesToDelete.add(currentNodeId);
      
      // Trouver les connexions sortantes du nœud courant
      const outputId = `output_${currentNodeId}`;
      const outgoingConnections = this.flowStateService.connections().filter(
        conn => conn.sourceId === outputId
      );
      
      // Pour chaque connexion sortante, ajouter le nœud cible à la liste et continuer récursivement
      for (const conn of outgoingConnections) {
        const targetNodeId = conn.targetId.replace('input_', '');
        // Éviter les boucles infinies
        if (!nodesToDelete.has(targetNodeId)) {
          findSuccessors(targetNodeId);
        }
      }
    };
    
    // Démarrer la recherche récursive
    findSuccessors(nodeId);
    
    console.log('Nodes to delete:', Array.from(nodesToDelete));
    
    // RÈGLE MÉTIER: Préserver au moins un Exit et le reconnecter au parent du Split
    
    // 1. Trouver le nœud parent (source) du Split
    const inputId = `input_${nodeId}`;
    const parentConnections = this.flowStateService.connections().filter(conn => conn.targetId === inputId);
    let parentNodeId: string | undefined;
    let parentOutputId: string | undefined;
    
    if (parentConnections.length > 0) {
      // Prendre la première connexion entrante comme source du parent
      parentOutputId = parentConnections[0].sourceId;
      parentNodeId = parentOutputId.replace('output_', '');
      console.log(`Parent node identified: ${parentNodeId}`);
    } else {
      console.warn('No parent node found for the Split node');
    }
    
    // 2. Trouver tous les nœuds Exit qui seront supprimés
    const exitNodesToDelete = Array.from(nodesToDelete)
      .map(id => this.flowStateService.nodes().find(n => n.id === id))
      .filter(node => node && node.type === 'Exit')
      .map(node => node!);
    
    console.log(`Found ${exitNodesToDelete.length} Exit nodes to be deleted`);
    
    // 3. Si nous avons des Exit à supprimer et un parent identifié, en préserver un
    let preservedExit: CrmNode | undefined;
    
    if (exitNodesToDelete.length > 0 && parentNodeId) {
      // Choisir le premier Exit (nous pourrions avoir une stratégie plus sophistiquée si nécessaire)
      preservedExit = exitNodesToDelete[0];
      
      // Le retirer de la liste des nœuds à supprimer
      nodesToDelete.delete(preservedExit.id);
      
      console.log(`Preserving Exit node: ${preservedExit.id}`);
    }
    
    // Première étape: collecter toutes les connexions à supprimer
    const connectionsToDelete = new Set<string>();
    
    for (const nodeIdToDelete of nodesToDelete) {
      // Trouver les connexions entrantes et sortantes
      const inputId = `input_${nodeIdToDelete}`;
      const outputId = `output_${nodeIdToDelete}`;
      
      // Ajouter les connexions entrantes et sortantes à la liste
      this.flowStateService.connections().forEach(conn => {
        if (conn.sourceId === outputId || conn.targetId === inputId) {
          connectionsToDelete.add(conn.id);
        }
      });
    }
    
    console.log('Connections to delete:', Array.from(connectionsToDelete));
    
    // 4. Si nous avons un Exit préservé et un parent, créer une connexion directe entre eux
    if (preservedExit && parentOutputId) {
      // Créer une nouvelle connexion directe entre le parent et l'Exit préservé
      const newConnection: Connection = {
        id: generateGuid(),
        sourceId: parentOutputId,
        targetId: `input_${preservedExit.id}`
      };
      
      // Ajouter la nouvelle connexion
      this.flowStateService.addConnection(newConnection);
      console.log(`Created new connection from parent to preserved Exit: ${newConnection.id}`);
    }
    
    // Supprimer d'abord toutes les connexions
    for (const connId of connectionsToDelete) {
      this.flowStateService.removeConnection(connId);
    }
    
    // Puis supprimer tous les nœuds (sauf l'Exit préservé)
    for (const nodeIdToDelete of nodesToDelete) {
      // Utiliser removeNode sans les vérifications de connexions puisqu'elles ont déjà été supprimées
      this._removeNodeWithoutConnectionChecks(nodeIdToDelete);
    }
    
    // 5. Si nous avons un Exit préservé, le repositionner pour remplacer le Split supprimé
    if (preservedExit) {
      // Obtenir le nœud Split qui est supprimé
      const splitNode = this.flowStateService.nodes().find(n => n.id === nodeId);
      
      if (splitNode) {
        // Mettre à jour la position de l'Exit préservé
        const updatedNodes = this.flowStateService.nodes().map(node => {
          if (node.id === preservedExit.id) {
            return {
              ...node,
              position: { 
                x: splitNode.position.x, // Même position X que le Split
                y: splitNode.position.y  // Même position Y que le Split
              }
            };
          }
          return node;
        });
        
        this.flowStateService.updateNodes(updatedNodes);
        console.log(`Repositioned preserved Exit to Split's position`);
      }
    }
    
    // AMÉLIORATION: Utiliser le recalcul intelligent au lieu du recalcul standard
    // Recalculer intelligemment les positions des nœuds en préservant notre grille
    this.flowStateService.smartRecalculatePositionsAfterDeletion(nodeId);
    
    // Réinitialiser la sélection
    this.flowStateService.updateSelectedNodes([]);
    
    // Sauvegarder l'état pour l'historique
    this.saveState('Suppression d\'un nœud de type Split et tous ses successeurs');
    
    // Demander une synchronisation des IDs après la suppression
    this.foblexIdManager.requestSync();
  }
  
  /**
   * Supprime un nœud sans vérifier ou supprimer ses connexions
   * Utilisé en interne par deleteNodeAndAllSuccessors
   * @param nodeId L'ID du nœud à supprimer
   * @private
   */
  private _removeNodeWithoutConnectionChecks(nodeId: string): void {
    // Récupérer tous les nœuds actuels
    const currentNodes = this.flowStateService.nodes();
    
    // Filtrer pour garder tous les nœuds sauf celui à supprimer
    const updatedNodes = currentNodes.filter(node => node.id !== nodeId);
    
    // Mettre à jour la liste des nœuds
    this.flowStateService.updateNodes(updatedNodes);
    
    console.log(`Removed node ${nodeId} without connection checks`);
  }
}