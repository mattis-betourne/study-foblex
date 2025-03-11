import { Injectable } from '@angular/core';

/**
 * Service de registre des types de nœuds
 * Fournit des informations sur les différents types de nœuds disponibles
 */
@Injectable({
  providedIn: 'root'
})
export class NodeTypeRegistry {
  /**
   * Obtient le texte par défaut pour un type de nœud
   * @param nodeType Type de nœud
   * @returns Texte par défaut
   */
  getDefaultText(nodeType: string): string {
    switch (nodeType) {
      // Targeting
      case 'Audience':
        return 'Audience';

      // Execution
      case 'BinarySplit':
        return 'Binary Split';
      case 'MultiSplit':
        return 'Multi Split';
      
      // Communication
      case 'Full Screen':
        return 'Full Screen Notification';
      case 'SMS':
        return 'SMS Message';
      case 'Push':
        return 'Push Notification';
      case 'Email':
        return 'Email Message';
      
      // Rewards
      case 'Freebet':
        return 'Freebet Reward';
      
      // Fallback
      default:
        return `New ${nodeType}`;
    }
  }
} 