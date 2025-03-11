import { Injectable, ChangeDetectorRef, inject, DestroyRef } from '@angular/core';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { generateGuid } from '@foblex/utils';
import { CrmNode, Connection } from '../models/crm.models';
import { HistoryService } from './history.service';
import { ZoomService } from './zoom.service';
import { TemporaryNodeService } from './temporary-node.service';
import { FlowStateService } from './flow-state.service';

/**
 * Service responsable de la gestion du flow diagram (nœuds, connexions, etc.)
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
  private readonly destroyRef = inject(DestroyRef);

  // Exposer les computed signals du service d'état
  readonly nodes = this.flowStateService.nodes;
  readonly connections = this.flowStateService.connections;
  readonly temporaryNodes = this.flowStateService.temporaryNodes;
  readonly temporaryConnections = this.flowStateService.temporaryConnections;

  // Observables pour les composants (compatibilité)
  readonly nodes$ = toObservable(this.flowStateService.nodes);
  readonly connections$ = toObservable(this.flowStateService.connections);
  readonly temporaryNodes$ = toObservable(this.flowStateService.temporaryNodes);
  readonly temporaryConnections$ = toObservable(this.flowStateService.temporaryConnections);
  readonly draggingItemType$ = this.temporaryNodeService.draggingItemType$;
  readonly isCreatingNode$ = this.temporaryNodeService.isCreatingNode$;

  constructor() {
    // Initialiser les fonctions de support pour le service de nœuds temporaires
    this.temporaryNodeService.setSupport(
      this.isPositionFree.bind(this),
      this.getDefaultMaxInputs.bind(this),
      this.getDefaultMaxOutputs.bind(this),
      () => this.nodes(),
      () => this.connections()
    );

    // Capturer l'état initial après l'initialisation des données,
    // mais seulement si nous avons déjà des données
    setTimeout(() => {
      // Ne sauvegarder l'état initial que s'il y a effectivement des données
      if (this.nodes().length > 0 || this.connections().length > 0) {
        this.historyService.saveState();
      }
    }, 0);
  }

  /**
   * @returns Le type d'élément en cours de drag
   */
  get draggingItemType(): string | null {
    return this.temporaryNodeService.draggingItemType;
  }

  /**
   * @param value Le type d'élément en cours de drag
   */
  set draggingItemType(value: string | null) {
    this.temporaryNodeService.draggingItemType = value;
  }

  /**
   * @returns Si un nœud est en cours de création
   */
  get isCreatingNode(): boolean {
    return this.temporaryNodeService.isCreatingNode;
  }

  /**
   * @param value Si un nœud est en cours de création
   */
  set isCreatingNode(value: boolean) {
    this.temporaryNodeService.isCreatingNode = value;
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
   * Ajoute un nouveau nœud au diagramme
   * @param node Le nœud à ajouter
   */
  addNode(node: CrmNode): void {
    const updatedNodes = [...this.flowStateService.nodes(), node];
    this.flowStateService.updateNodes(updatedNodes);
    
    // Sauvegarder l'état après modification
    this.historyService.saveState();
  }

  /**
   * Ajoute une nouvelle connexion au diagramme
   * @param connection La connexion à ajouter
   */
  addConnection(connection: Connection): void {
    const updatedConnections = [...this.flowStateService.connections(), connection];
    this.flowStateService.updateConnections(updatedConnections);
    
    // Sauvegarder l'état après modification
    this.historyService.saveState();
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
      
      // Log pour déboguer
      console.log('Node to be added:', JSON.stringify([audienceNode]));
      
      // Mise à jour des nœuds
      this.flowStateService.updateNodes([audienceNode]);
      
      // Vérification après mise à jour
      console.log('Nodes after update:', JSON.stringify(this.flowStateService.nodes()));
      
      console.log('Default node created successfully:', [audienceNode]);
      
      // Sauvegarder l'état APRÈS création des nœuds par défaut
      // et s'assurer que c'est le premier état dans l'historique
      if (this.flowStateService.nodes().length > 0) {
        setTimeout(() => {
          // Vider l'historique avant de sauvegarder l'état initial
          this.historyService.clear();
          // Puis sauvegarder l'état initial
          this.historyService.saveState();
        }, 0);
      }
    } catch (error) {
      console.error('Error creating default nodes:', error);
    }
  }

  /**
   * Vérifie si une position est libre (pas de nœuds à proximité)
   * @param position Position à vérifier
   * @returns true si la position est libre
   * @private
   */
  private isPositionFree(position: {x: number, y: number}): boolean {
    // Considérer une marge de 50px autour des nœuds existants
    const margin = 50;
    return !this.flowStateService.nodes().some(node => 
      Math.abs(node.position.x - position.x) < margin && 
      Math.abs(node.position.y - position.y) < margin
    );
  }

  /**
   * Nettoie les éléments temporaires
   */
  clearTemporaryElements(): void {
    this.temporaryNodeService.clearTemporaryElements();
  }

  /**
   * Crée des nœuds temporaires pour les emplacements potentiels de connexion
   * @param itemType Le type d'élément en cours de drag
   */
  createTemporaryNodes(itemType: string): void {
    this.temporaryNodeService.createTemporaryNodes(itemType);
  }

  /**
   * Traite la fin d'un glisser-déposer sur un nœud temporaire
   * @param temporaryNodeId Identifiant du nœud temporaire
   * @param changeDetectorRef Référence au détecteur de changements
   */
  handleDropOnTemporaryNode(temporaryNodeId: string, changeDetectorRef: ChangeDetectorRef): void {
    const dropResult = this.temporaryNodeService.handleDropOnTemporaryNode(temporaryNodeId);
    
    if (!dropResult) {
      return;
    }
    
    const { nodeType, position, connections } = dropResult;
    
    // Générer un identifiant unique pour le nouveau nœud
    const newNodeId = `node-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Créer le nouveau nœud
    const newNode: CrmNode = {
      id: newNodeId,
      type: nodeType,
      text: `New ${nodeType}`,
      position: position,
      maxInputs: this.getDefaultMaxInputs(nodeType),
      maxOutputs: this.getDefaultMaxOutputs(nodeType)
    };
    
    // Ajouter le nœud
    this.addNode(newNode);
    
    // Créer les connexions
    connections.forEach(conn => {
      // Déterminer si le nœud créé sera la source ou la cible
      const isNewNodeSource = conn.sourceId === '';
      const isNewNodeTarget = conn.targetId === '';
      
      // Préparer les identifiants en conservant le format input_/output_
      let source = isNewNodeSource ? `output_${newNodeId}` : conn.sourceId;
      let target = isNewNodeTarget ? `input_${newNodeId}` : conn.targetId;
      
      console.log(`Creating connection: ${source} -> ${target}`);
      
      // Générer un identifiant unique pour la connexion
      const connId = `conn-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      // Créer et ajouter la connexion
      const newConnection: Connection = {
        id: connId,
        sourceId: source,
        targetId: target
      };
      
      this.addConnection(newConnection);
    });
    
    // Forcer la mise à jour du composant
    if (changeDetectorRef) {
      changeDetectorRef.detectChanges();
    }
  }

  /**
   * Annule la dernière action
   */
  undo(): void {
    this.clearTemporaryElements();
    this.historyService.undo();
  }

  /**
   * Rétablit l'action annulée
   */
  redo(): void {
    this.clearTemporaryElements();
    this.historyService.redo();
  }

  /**
   * Sauvegarde l'état actuel dans l'historique
   * @private
   */
  private saveState(): void {
    this.historyService.saveState();
  }

  /**
   * Retourne le nombre maximum d'entrées autorisées par défaut pour un type de nœud
   * @param type Le type de nœud
   * @returns Le nombre maximum d'entrées
   */
  private getDefaultMaxInputs(type: string): number {
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
   * Retourne le nombre maximum de sorties autorisées par défaut pour un type de nœud
   * @param type Le type de nœud
   * @returns Le nombre maximum de sorties
   */
  private getDefaultMaxOutputs(type: string): number {
    switch (type) {
      // Targeting
      case 'Audience':
        return 1;  // Une audience a 1 sortie maximum
      
      // Execution
      case 'BinarySplit':
        return 2;  // Un séparateur binaire a exactement 2 sorties
      case 'MultiSplit':
        return 5;  // Un séparateur multiple peut avoir jusqu'à 5 sorties
      
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
    const existingOutputs = this.flowStateService.connections().filter(
      (conn: Connection) => conn.sourceId === source
    );
    
    const existingInputs = this.flowStateService.connections().filter(
      (conn: Connection) => conn.targetId === target
    );

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
} 