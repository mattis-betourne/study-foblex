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