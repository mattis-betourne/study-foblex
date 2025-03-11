# Documentation: Pattern Strategy pour la Gestion des Nœuds Temporaires

## Introduction

Cette documentation explique l'implémentation du pattern Strategy dans notre application CRM pour gérer la création des nœuds temporaires lors du drag & drop d'éléments. 

### Problématique

Dans notre application de CRM visuel, les utilisateurs peuvent faire glisser des éléments (Client, Task, BinarySplit, etc.) pour créer un diagramme de flux. Lorsqu'un élément est en cours de glissement, l'application doit afficher des "nœuds temporaires" qui représentent les emplacements possibles où l'élément peut être déposé.

La logique de création de ces nœuds temporaires varie considérablement selon:
- Le type du nœud existant (par exemple, un BinarySplit a besoin d'exactement 2 connexions sortantes)
- Le nombre de connexions déjà établies
- Le type d'élément en cours de glissement

Sans une architecture propre, cette logique peut rapidement devenir complexe, difficile à maintenir et à étendre, comme nous l'avons constaté avec notre implémentation initiale.

### Solution: Pattern Strategy

Nous avons adopté le pattern Strategy pour résoudre ce problème. Ce pattern permet de:
1. Encapsuler les différentes logiques de création de nœuds temporaires dans des classes séparées
2. Sélectionner dynamiquement la stratégie appropriée à l'exécution
3. Faciliter l'ajout de nouvelles stratégies pour de nouveaux types de nœuds

## Architecture

```
┌──────────────┐           ┌───────────────────────┐
│              │           │                       │
│  FlowService │ utilise   │ TemporaryNodeStrategy │ interface
│              ├──────────►│                       │
└──────┬───────┘           └───────────┬───────────┘
       │                                │
       │ crée                           │
       ▼                                │
┌──────────────────┐                    │
│                  │                    │
│ StrategyFactory  │                    │
│                  │                    │
└────────┬─────────┘                    │
         │                              │
         │ retourne                     │ implémentée par
         ▼                              ▼
┌───────────────────┐   ┌──────────────────────┐   ┌──────────────────┐
│                   │   │                      │   │                  │
│ Stratégie         │   │ Stratégie            │   │ Autres           │
│ StandardNode      │◄──┤ BinarySplit          │◄──┤ stratégies...    │
│                   │   │                      │   │                  │
└───────────────────┘   └──────────────────────┘   └──────────────────┘
```

## Interfaces et Classes Principales

### 1. Interface `TemporaryNodeStrategy`

Cette interface définit le contrat que toutes les stratégies de création de nœuds temporaires doivent respecter.

```typescript
export interface TemporaryNodeStrategy {
  canApply(
    node: CrmNode, 
    existingOutputConnections: Connection[], 
    existingInputConnections: Connection[],
    itemType: string
  ): boolean;
  
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
```

#### Méthode `canApply`
- **Objectif**: Déterminer si cette stratégie peut être appliquée au nœud actuel
- **Paramètres**:
  - `node`: Le nœud existant autour duquel créer des nœuds temporaires
  - `existingOutputConnections`: Les connexions sortantes existantes du nœud
  - `existingInputConnections`: Les connexions entrantes existantes du nœud
  - `itemType`: Le type d'élément en cours de glissement
- **Retourne**: `boolean` - True si la stratégie est applicable, sinon False

#### Méthode `createTemporaryNodes`
- **Objectif**: Créer des nœuds temporaires autour d'un nœud existant
- **Paramètres**:
  - `node`: Le nœud existant autour duquel créer des nœuds temporaires
  - `existingOutputConnections`: Les connexions sortantes existantes du nœud
  - `existingInputConnections`: Les connexions entrantes existantes du nœud
  - `itemType`: Le type d'élément en cours de glissement
  - `isPositionFree`: Fonction pour vérifier si une position est libre
  - `getDefaultMaxInputs`: Fonction pour obtenir le nombre maximum d'entrées par défaut
  - `getDefaultMaxOutputs`: Fonction pour obtenir le nombre maximum de sorties par défaut
- **Retourne**: `TemporaryNodesResult` - Les nœuds et connexions temporaires créés

### 2. Interface `TemporaryNodesResult`

Cette interface standardise le format des résultats retournés par les stratégies.

```typescript
export interface TemporaryNodesResult {
  nodes: CrmNode[];        // Nœuds temporaires créés
  connections: Connection[]; // Connexions temporaires créées
}
```

### 3. Classe `StandardNodeStrategy`

Stratégie par défaut pour les nœuds standards (tous sauf les nœuds spéciaux comme BinarySplit).

```typescript
export class StandardNodeStrategy implements TemporaryNodeStrategy {
  canApply(node: CrmNode, ...): boolean {
    // Cette stratégie s'applique à tous les nœuds standard
    return node.type !== 'BinarySplit';
  }
  
  createTemporaryNodes(node: CrmNode, ...): TemporaryNodesResult {
    // Crée des nœuds temporaires à droite et en dessous du nœud
    // en fonction des limites de connexion
    // ...
  }
}
```

### 4. Classe `BinarySplitStrategy`

Stratégie spécifique pour les nœuds de type BinarySplit qui ont des règles particulières.

```typescript
export class BinarySplitStrategy implements TemporaryNodeStrategy {
  constructor(private getAllNodes: () => CrmNode[]) {}

  canApply(node: CrmNode, ...): boolean {
    return node.type === 'BinarySplit';
  }
  
  createTemporaryNodes(node: CrmNode, ...): TemporaryNodesResult {
    // Crée des emplacements temporaires spécifiques pour:
    // - Les deux branches du BinarySplit (haut et bas)
    // - L'entrée du BinarySplit
    // ...
  }
}
```

### 5. Classe `TemporaryNodeStrategyFactory`

Factory qui sélectionne et retourne la stratégie appropriée en fonction du nœud.

```typescript
export class TemporaryNodeStrategyFactory {
  constructor(private getAllNodes: () => CrmNode[]) {
    this.strategies = [
      new BinarySplitStrategy(getAllNodes),
      new StandardNodeStrategy() // Stratégie par défaut, doit être en dernier
    ];
  }

  private strategies: TemporaryNodeStrategy[];
  
  getStrategy(node: CrmNode, ...): TemporaryNodeStrategy {
    // Trouve et retourne la première stratégie applicable
    // ...
  }
}
```

### 6. Service `FlowService`

Le service principal qui utilise le pattern Strategy.

```typescript
@Injectable({
  providedIn: 'root'
})
export class FlowService {
  private readonly strategyFactory = new TemporaryNodeStrategyFactory(() => this._nodes());

  createTemporaryNodes(itemType: string): void {
    // Pour chaque nœud existant, applique la stratégie appropriée
    for (const existingNode of this._nodes()) {
      const strategy = this.strategyFactory.getStrategy(...);
      const result = strategy.createTemporaryNodes(...);
      // Ajoute les nœuds et connexions temporaires
    }
  }
}
```

## Comment Ajouter une Nouvelle Stratégie

Pour ajouter une stratégie pour un nouveau type de nœud (par exemple, un `TripleSplit`), suivez ces étapes:

### 1. Créer une nouvelle classe de stratégie

```typescript
export class TripleSplitStrategy implements TemporaryNodeStrategy {
  constructor(private getAllNodes: () => CrmNode[]) {}

  canApply(node: CrmNode, ...): boolean {
    return node.type === 'TripleSplit';
  }
  
  createTemporaryNodes(node: CrmNode, ...): TemporaryNodesResult {
    // Implémentation spécifique pour TripleSplit
    // ...
  }
}
```

### 2. Ajouter la stratégie à la factory

```typescript
constructor(private getAllNodes: () => CrmNode[]) {
  this.strategies = [
    new BinarySplitStrategy(getAllNodes),
    new TripleSplitStrategy(getAllNodes), // Nouvelle stratégie
    new StandardNodeStrategy() // Toujours en dernier
  ];
}
```

### 3. Définir les limites par défaut

Dans le `FlowService`, mettez à jour les méthodes `getDefaultMaxInputs` et `getDefaultMaxOutputs`:

```typescript
private getDefaultMaxInputs(type: string): number {
  switch (type) {
    // ...
    case 'TripleSplit':
      return 1;  // Un TripleSplit a une seule entrée
    // ...
  }
}

private getDefaultMaxOutputs(type: string): number {
  switch (type) {
    // ...
    case 'TripleSplit':
      return 3;  // Un TripleSplit a exactement 3 sorties
    // ...
  }
}
```

## Exemple Concret: BinarySplit

Le nœud `BinarySplit` illustre parfaitement l'utilité du pattern Strategy:

1. **Règles spéciales**:
   - Doit avoir exactement 1 entrée
   - Doit avoir exactement 2 sorties (pas plus, pas moins)
   - Les sorties doivent être positionnées de manière spécifique (branche supérieure et inférieure)

2. **Logique de création des nœuds temporaires**:
   - Si 0 sorties: afficher 2 emplacements temporaires (haut et bas)
   - Si 1 sortie: afficher 1 emplacement temporaire (selon la position disponible)
   - Si 2 sorties: ne pas afficher d'emplacements temporaires pour les sorties

3. **Implémentation dans `BinarySplitStrategy`**:
   - Détermine quelles branches sont déjà occupées
   - Calcule les positions spécifiques pour les branches
   - Crée des connexions visuellement distinctes pour chaque branche

## Bonnes Pratiques et Conseils de Maintenance

### Organisation du Code
- **Gardez les stratégies dans un dossier dédié** (`src/app/strategies/`)
- **Nommez clairement les stratégies** avec un suffixe `Strategy` (ex: `BinarySplitStrategy`)

### Extension du Système
- **Ajoutez de nouvelles stratégies, ne modifiez pas les existantes**
- **Respectez le principe Open/Closed**: ouvert à l'extension, fermé à la modification
- **Maintenez une stratégie par défaut** (StandardNodeStrategy) qui gère les cas généraux

### Tests
- **Testez chaque stratégie indépendamment**
- **Testez la factory** pour s'assurer qu'elle sélectionne la bonne stratégie
- **Utilisez des mocks** pour simuler les dépendances

### Documentation
- **Documentez chaque nouvelle stratégie** en expliquant son objectif
- **Mettez à jour cette documentation** lorsque vous ajoutez de nouveaux types de nœuds
- **Incluez des exemples visuels** si possible

## Conclusion

Le pattern Strategy a considérablement amélioré la maintenabilité et l'extensibilité de notre gestion des nœuds temporaires. En encapsulant les différentes logiques dans des classes séparées, nous avons:

1. **Simplifié le code** principal de notre service
2. **Facilité l'ajout** de nouveaux types de nœuds
3. **Amélioré la lisibilité** pour les développeurs futurs
4. **Isolé les modifications** pour éviter les régressions

Cette approche vous permettra d'ajouter facilement de nouveaux types de nœuds avec des comportements complexes sans avoir à modifier le code existant. 