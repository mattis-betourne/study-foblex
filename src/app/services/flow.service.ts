import { Injectable, ChangeDetectorRef, inject } from '@angular/core';
import { generateGuid } from '@foblex/utils';
import { CrmNode, Connection } from '../models/crm.models';
import { HistoryService } from './history.service';
import { ZoomService } from './zoom.service';
import { TemporaryNodeService } from './temporary-node.service';
import { FlowStateService } from './flow-state.service';
import { FoblexIdManagerService } from './foblex-id-manager.service';

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
  // Services injectés
  private readonly historyService = inject(HistoryService);
  private readonly zoomService = inject(ZoomService);
  private readonly temporaryNodeService = inject(TemporaryNodeService);
  private readonly flowStateService = inject(FlowStateService);
  private readonly foblexIdManager = inject(FoblexIdManagerService);

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
    this.temporaryNodeService.createTemporaryNodes(itemType);
  }

  /**
   * Termine le processus de glisser-déposer
   */
  endDragging(): void {
    console.log('Ending drag operation');
    this.flowStateService.updateDraggingItemType(null);
    this.temporaryNodeService.clearTemporaryElements();
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
   * Traite la fin d'un glisser-déposer sur un nœud temporaire
   * @param temporaryNodeId Identifiant du nœud temporaire
   * @param changeDetectorRef Référence au détecteur de changements
   */
  handleDropOnTemporaryNode(temporaryNodeId: string, changeDetectorRef: ChangeDetectorRef): void {
    console.log('Handling drop on temporary node:', temporaryNodeId);
    
    // Déléguer la conversion du nœud temporaire au FlowStateService
    const newNode = this.flowStateService.convertTemporaryNodeToPermanent(temporaryNodeId);
    
    if (newNode) {
      // Sauvegarder l'historique après la création du nœud permanent
      this.saveState(`Ajout d'un nœud ${newNode.type}`);
      
      // Forcer la mise à jour du composant
      if (changeDetectorRef) {
        changeDetectorRef.detectChanges();
      }
      
      // Demander une synchronisation des IDs
      this.foblexIdManager.requestSync();
    }
  }

  /**
   * Crée un nœud par défaut
   */
  addDefaultNode(): void {
    // Vérifier si des nœuds existent déjà pour éviter la duplication
    if (this.flowStateService.nodes().length > 0) {
      console.log('Default nodes already exist, skipping creation');
      return;
    }
    
    console.log('Creating default nodes...');
    
    try {
      // Crée un nœud Audience par défaut avec une position définie
      const audienceNode: CrmNode = {
        id: generateGuid(),
        type: 'Audience',
        text: 'Audience cible',
        position: { x: 100, y: 100 },
        maxInputs: 0,  // Pas d'entrée
        maxOutputs: 1  // 1 sortie maximum
      };
      
      // Mise à jour des nœuds
      this.flowStateService.updateNodes([audienceNode]);
      
      console.log('Default node created successfully');
      
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
    this.temporaryNodeService.clearTemporaryElements();
    this.historyService.undo();
  }

  /**
   * Rétablit l'action annulée
   */
  redo(): void {
    this.temporaryNodeService.clearTemporaryElements();
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
      return false;
    }

    // Vérifier les règles métier pour les connexions
    const sourceNodeId = source.replace('output_', '');
    const targetNodeId = target.replace('input_', '');
    
    const sourceNode = this.flowStateService.nodes().find((node: CrmNode) => node.id === sourceNodeId);
    const targetNode = this.flowStateService.nodes().find((node: CrmNode) => node.id === targetNodeId);

    if (!sourceNode || !targetNode) {
      return false;
    }

    // Vérifier si le nœud source est un output
    const isSourceOutput = source.startsWith('output_');
    // Vérifier si le nœud cible est un input
    const isTargetInput = target.startsWith('input_');

    // Les connexions ne sont possibles que d'un output vers un input
    if (!isSourceOutput || !isTargetInput) {
      return false;
    }

    // Vérifier les limites de connexions pour le nœud source
    const existingOutputs = this.flowStateService.getConnectionsFrom(source);
    const existingInputs = this.flowStateService.getConnectionsTo(target);

    // Vérifier les limites pour les sorties
    if (sourceNode.maxOutputs !== undefined && sourceNode.maxOutputs !== -1 && 
        existingOutputs.length >= sourceNode.maxOutputs) {
      return false;
    }

    // Vérifier les limites pour les entrées
    if (targetNode.maxInputs !== undefined && targetNode.maxInputs !== -1 && 
        existingInputs.length >= targetNode.maxInputs) {
      return false;
    }

    // Vérifier si une connexion existe déjà entre ces deux ports
    const connectionExists = this.flowStateService.connections().some(
      (conn: Connection) => conn.sourceId === source && conn.targetId === target
    );

    if (connectionExists) {
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
} 