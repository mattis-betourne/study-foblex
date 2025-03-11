/**
 * Représente un nœud dans le diagramme CRM
 */
export interface CrmNode {
  /** Identifiant unique du nœud */
  id: string;
  /** Type du nœud (Client, Contact, etc.) */
  type: string;
  /** Texte descriptif du nœud */
  text: string;
  /** Position du nœud dans le canvas */
  position: { x: number; y: number };
  /** Nombre maximum de connexions entrantes autorisées */
  maxInputs?: number;
  /** Nombre maximum de connexions sortantes autorisées */
  maxOutputs?: number;
}

/**
 * Représente une connexion entre deux nœuds
 */
export interface Connection {
  /** Identifiant unique de la connexion */
  id: string;
  /** Identifiant de la sortie du nœud source */
  sourceId: string;
  /** Identifiant de l'entrée du nœud cible */
  targetId: string;
}

/**
 * Interface pour les résultats de création de nœuds temporaires
 */
export interface TemporaryNodesResult {
  /** Nœuds temporaires créés */
  nodes: CrmNode[];
  /** Connexions temporaires créées */
  connections: Connection[];
}

/**
 * Interface pour une stratégie de création de nœuds temporaires
 */
export interface TemporaryNodeStrategy {
  /**
   * Vérifie si cette stratégie peut être appliquée pour ce nœud
   * @param node Le nœud existant
   * @param existingOutputConnections Les connexions de sortie existantes
   * @param existingInputConnections Les connexions d'entrée existantes
   * @param itemType Le type d'élément en cours de drag
   */
  canApply(
    node: CrmNode, 
    existingOutputConnections: Connection[], 
    existingInputConnections: Connection[],
    itemType: string
  ): boolean;
  
  /**
   * Crée des nœuds temporaires autour d'un nœud existant
   * @param node Le nœud existant
   * @param existingOutputConnections Les connexions de sortie existantes
   * @param existingInputConnections Les connexions d'entrée existantes
   * @param itemType Le type d'élément en cours de drag
   * @param isPositionFree Fonction pour vérifier si une position est libre
   * @param getDefaultMaxInputs Fonction pour obtenir le max d'entrées par défaut
   * @param getDefaultMaxOutputs Fonction pour obtenir le max de sorties par défaut
   */
  createTemporaryNodes(
    node: CrmNode,
    existingOutputConnections: Connection[],
    existingInputConnections: Connection[],
    itemType: string,
    isPositionFree: (position: {x: number, y: number}) => boolean,
    getDefaultMaxInputs: (type: string) => number,
    getDefaultMaxOutputs: (type: string) => number
  ): TemporaryNodesResult;
} 