/**
 * Duplicate Detection Engine - Advanced algorithms for finding code duplicates
 * Uses hash-based clustering, similarity algorithms, and semantic analysis
 */

import {
  generateNormalizedHash,
  generateSemanticHash,
  createId,
  processConcurrently,
} from '../utils';

import type {
  EntityInfo,
  DuplicateCluster,
  SeverityLevel,
  ConsolidationSuggestion,
  BaseAnalyzer,
  AnalysisConfig,
  EntityMembers,
  ComplexityMetrics,
} from '../types';

interface SimilarityMatrix {
  [key: string]: {
    [key: string]: number;
  };
}

interface DuplicateDetectionConfig {
  minSimilarity: number;
  enableSemanticAnalysis: boolean;
  enableStructuralAnalysis: boolean;
  enableFuzzyMatching: boolean;
  clusteringAlgorithm: 'hash' | 'hierarchical' | 'density';
  maxClusterSize: number;
}

/**
 * High-performance duplicate detection engine with multiple algorithms
 */
export class DuplicateDetectionEngine implements BaseAnalyzer<
  DuplicateCluster[]
> {
  public readonly name = 'DuplicateDetectionEngine';
  public readonly version = '2.0.0';

  private config: DuplicateDetectionConfig;

  constructor(config: Partial<DuplicateDetectionConfig> = {}) {
    this.config = {
      minSimilarity: 0.8,
      enableSemanticAnalysis: true,
      enableStructuralAnalysis: true,
      enableFuzzyMatching: true,
      clusteringAlgorithm: 'hash',
      maxClusterSize: 10,
      ...config,
    };
  }

  /**
   * Analyze entities for duplicates using multiple algorithms
   */
  async analyze(
    entities: EntityInfo[],
    _analysisConfig: AnalysisConfig
  ): Promise<DuplicateCluster[]> {
    const clusters: DuplicateCluster[] = [];

    // Phase 1: Hash-based clustering (fastest)
    if (this.config.enableStructuralAnalysis) {
      const hashClusters = await this.detectHashBasedDuplicates(entities);
      clusters.push(...hashClusters);
    }

    // Phase 2: Semantic analysis (more accurate)
    if (this.config.enableSemanticAnalysis) {
      const semanticClusters = await this.detectSemanticDuplicates(entities);
      clusters.push(...this.mergeClusters(clusters, semanticClusters));
    }

    // Phase 3: Fuzzy matching (catches partial duplicates)
    if (this.config.enableFuzzyMatching) {
      const fuzzyClusters = await this.detectFuzzyDuplicates(entities);
      clusters.push(...this.mergeClusters(clusters, fuzzyClusters));
    }

    // Phase 4: Advanced clustering
    const finalClusters = await this.performAdvancedClustering(
      clusters,
      entities
    );

    // Phase 5: Generate consolidation suggestions
    return this.enhanceClustersWithSuggestions(finalClusters);
  }

  /**
   * Hash-based duplicate detection - fastest method
   */
  private async detectHashBasedDuplicates(
    entities: EntityInfo[]
  ): Promise<DuplicateCluster[]> {
    const normalizedGroups = new Map<string, EntityInfo[]>();
    const semanticGroups = new Map<string, EntityInfo[]>();

    // Group by normalized hashes
    entities.forEach(entity => {
      if (entity.normalizedHash) {
        if (!normalizedGroups.has(entity.normalizedHash)) {
          normalizedGroups.set(entity.normalizedHash, []);
        }
        normalizedGroups.get(entity.normalizedHash)!.push(entity);
      }

      if (entity.semanticHash) {
        if (!semanticGroups.has(entity.semanticHash)) {
          semanticGroups.set(entity.semanticHash, []);
        }
        semanticGroups.get(entity.semanticHash)!.push(entity);
      }
    });

    const clusters: DuplicateCluster[] = [];

    // Process normalized hash groups
    for (const [hash, duplicateEntities] of normalizedGroups.entries()) {
      if (duplicateEntities.length > 1) {
        const firstEntity = duplicateEntities[0];
        if (!firstEntity) {
          continue;
        }

        const cluster: DuplicateCluster = {
          id: createId(),
          hash,
          type: firstEntity.type,
          severity: this.calculateSeverity(duplicateEntities),
          entities: duplicateEntities,
          structuralMatch: true,
          semanticMatch: semanticGroups.has(hash),
          similarity: 1.0,
        };
        clusters.push(cluster);
      }
    }

    // Process semantic groups that aren't already in structural matches
    for (const [hash, duplicateEntities] of semanticGroups.entries()) {
      if (duplicateEntities.length > 1) {
        // Check if already covered by structural match
        const existingCluster = clusters.find(c =>
          c.entities.some(e => duplicateEntities.includes(e))
        );

        if (!existingCluster) {
          const firstEntity = duplicateEntities[0];
          if (!firstEntity) {
            continue;
          }

          const cluster: DuplicateCluster = {
            id: createId(),
            hash,
            type: firstEntity.type,
            severity: this.calculateSeverity(duplicateEntities),
            entities: duplicateEntities,
            structuralMatch: false,
            semanticMatch: true,
            similarity: 0.9,
          };
          clusters.push(cluster);
        }
      }
    }

    return clusters;
  }

  /**
   * Semantic duplicate detection using AST and type analysis
   */
  private async detectSemanticDuplicates(
    entities: EntityInfo[]
  ): Promise<DuplicateCluster[]> {
    const clusters: DuplicateCluster[] = [];

    // Group by type for more efficient comparison
    const entitiesByType = this.groupEntitiesByType(entities);

    for (const [_entityType, typeEntities] of entitiesByType.entries()) {
      const typeClusters = await this.findSemanticClustersForType(typeEntities);
      clusters.push(...typeClusters);
    }

    return clusters;
  }

  /**
   * Find semantic clusters for entities of the same type
   */
  private async findSemanticClustersForType(
    entities: EntityInfo[]
  ): Promise<DuplicateCluster[]> {
    const clusters: DuplicateCluster[] = [];
    const processed = new Set<string>();

    await processConcurrently(
      entities,
      async entity => {
        if (processed.has(entity.id)) {
          return;
        }

        const similarEntities = [entity];
        processed.add(entity.id);

        // Find semantically similar entities
        for (const otherEntity of entities) {
          if (otherEntity.id === entity.id || processed.has(otherEntity.id)) {
            continue;
          }

          const similarity = this.calculateSemanticSimilarity(
            entity,
            otherEntity
          );
          if (similarity >= this.config.minSimilarity) {
            similarEntities.push(otherEntity);
            processed.add(otherEntity.id);
          }
        }

        if (similarEntities.length > 1) {
          clusters.push({
            id: createId(),
            hash: entity.semanticHash || generateSemanticHash(entity),
            type: entity.type,
            severity: this.calculateSeverity(similarEntities),
            entities: similarEntities,
            structuralMatch: false,
            semanticMatch: true,
            similarity: this.calculateAverageSimilarity(similarEntities),
          });
        }
      },
      10 // Reasonable concurrency for complex calculations
    );

    return clusters;
  }

  /**
   * Fuzzy duplicate detection for partial matches
   */
  private async detectFuzzyDuplicates(
    entities: EntityInfo[]
  ): Promise<DuplicateCluster[]> {
    const clusters: DuplicateCluster[] = [];
    const entitiesByType = this.groupEntitiesByType(entities);

    for (const [_entityType, typeEntities] of entitiesByType.entries()) {
      const fuzzyClusters = await this.findFuzzyClustersForType(typeEntities);
      clusters.push(...fuzzyClusters);
    }

    return clusters;
  }

  /**
   * Find fuzzy clusters using edit distance and token similarity
   */
  private async findFuzzyClustersForType(
    entities: EntityInfo[]
  ): Promise<DuplicateCluster[]> {
    const clusters: DuplicateCluster[] = [];
    const similarities = await this.calculateSimilarityMatrix(entities);

    // Use hierarchical clustering based on similarity
    const processed = new Set<string>();

    for (const entity of entities) {
      if (processed.has(entity.id)) {
        continue;
      }

      const cluster = [entity];
      processed.add(entity.id);

      // Find entities with fuzzy similarity
      for (const otherEntity of entities) {
        if (otherEntity.id === entity.id || processed.has(otherEntity.id)) {
          continue;
        }

        const similarity = similarities[entity.id]?.[otherEntity.id] || 0;
        if (similarity >= this.config.minSimilarity * 0.7) {
          // Lower threshold for fuzzy
          cluster.push(otherEntity);
          processed.add(otherEntity.id);
        }
      }

      if (cluster.length > 1) {
        clusters.push({
          id: createId(),
          hash: generateNormalizedHash(cluster.map(e => e.name).sort()),
          type: entity.type,
          severity: this.calculateSeverity(cluster),
          entities: cluster,
          structuralMatch: false,
          semanticMatch: false,
          similarity: this.calculateAverageSimilarity(cluster),
        });
      }
    }

    return clusters;
  }

  /**
   * Calculate similarity matrix for fuzzy matching
   */
  private async calculateSimilarityMatrix(
    entities: EntityInfo[]
  ): Promise<SimilarityMatrix> {
    const matrix: SimilarityMatrix = {};

    await processConcurrently(
      entities,
      async entity => {
        matrix[entity.id] = {};

        for (const otherEntity of entities) {
          if (entity.id === otherEntity.id) {
            matrix[entity.id]![otherEntity.id] = 1.0;
            continue;
          }

          const similarity = this.calculateFuzzySimilarity(entity, otherEntity);
          matrix[entity.id]![otherEntity.id] = similarity;
        }
      },
      8 // Reasonable concurrency for matrix calculation
    );

    return matrix;
  }

  /**
   * Calculate semantic similarity between two entities
   */
  private calculateSemanticSimilarity(
    entity1: EntityInfo,
    entity2: EntityInfo
  ): number {
    if (entity1.type !== entity2.type) {
      return 0;
    }

    let similarity = 0;
    let factors = 0;

    // Hash similarity
    if (entity1.semanticHash && entity2.semanticHash) {
      similarity += entity1.semanticHash === entity2.semanticHash ? 1.0 : 0;
      factors++;
    }

    // Member similarity (for classes/interfaces)
    if (entity1.members && entity2.members) {
      const memberSimilarity = this.calculateMemberSimilarity(
        entity1.members,
        entity2.members
      );
      similarity += memberSimilarity;
      factors++;
    }

    // Complexity similarity
    if (entity1.complexity && entity2.complexity) {
      const complexitySimilarity = this.calculateComplexitySimilarity(
        entity1.complexity,
        entity2.complexity
      );
      similarity += complexitySimilarity;
      factors++;
    }

    // Dependency similarity
    const dependencySimilarity = this.calculateDependencySimilarity(
      entity1.dependencies,
      entity2.dependencies
    );
    similarity += dependencySimilarity;
    factors++;

    return factors > 0 ? similarity / factors : 0;
  }

  /**
   * Calculate fuzzy similarity using various string metrics
   */
  private calculateFuzzySimilarity(
    entity1: EntityInfo,
    entity2: EntityInfo
  ): number {
    if (entity1.type !== entity2.type) {
      return 0;
    }

    let similarity = 0;
    let factors = 0;

    // Name similarity (Levenshtein distance)
    const nameSimilarity = this.calculateStringSimilarity(
      entity1.name,
      entity2.name
    );
    similarity += nameSimilarity;
    factors++;

    // Signature similarity
    if (entity1.signature && entity2.signature) {
      const signatureSimilarity = this.calculateStringSimilarity(
        entity1.signature,
        entity2.signature
      );
      similarity += signatureSimilarity;
      factors++;
    }

    // JSDoc similarity
    if (entity1.jsDoc && entity2.jsDoc) {
      const jsdocSimilarity = this.calculateStringSimilarity(
        entity1.jsDoc,
        entity2.jsDoc
      );
      similarity += jsdocSimilarity * 0.5; // Lower weight for documentation
      factors += 0.5;
    }

    return factors > 0 ? similarity / factors : 0;
  }

  /**
   * Calculate string similarity using Jaro-Winkler distance
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    if (str1 === str2) {
      return 1.0;
    }
    if (str1.length === 0 || str2.length === 0) {
      return 0;
    }

    // Simple Jaccard similarity for tokens
    const tokens1 = new Set(
      str1
        .toLowerCase()
        .split(/\W+/)
        .filter(t => t.length > 2)
    );
    const tokens2 = new Set(
      str2
        .toLowerCase()
        .split(/\W+/)
        .filter(t => t.length > 2)
    );

    const intersection = new Set([...tokens1].filter(t => tokens2.has(t)));
    const union = new Set([...tokens1, ...tokens2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Calculate member similarity for classes and interfaces
   */
  private calculateMemberSimilarity(
    members1: EntityMembers,
    members2: EntityMembers
  ): number {
    let similarity = 0;
    let factors = 0;

    // Method similarity
    if (members1.methods && members2.methods) {
      const methodSimilarity = this.calculateArraySimilarity(
        members1.methods.map(m => m.name),
        members2.methods.map(m => m.name)
      );
      similarity += methodSimilarity;
      factors++;
    }

    // Property similarity
    if (members1.properties && members2.properties) {
      const propertySimilarity = this.calculateArraySimilarity(
        members1.properties.map(p => p.name),
        members2.properties.map(p => p.name)
      );
      similarity += propertySimilarity;
      factors++;
    }

    return factors > 0 ? similarity / factors : 0;
  }

  /**
   * Calculate complexity similarity
   */
  private calculateComplexitySimilarity(
    complexity1: ComplexityMetrics,
    complexity2: ComplexityMetrics
  ): number {
    const factors: Array<keyof ComplexityMetrics> = [
      'cyclomatic',
      'cognitive',
      'depth',
      'parameters',
    ];
    let similarity = 0;
    let validFactors = 0;

    for (const factor of factors) {
      const val1 = (complexity1[factor] as number) || 0;
      const val2 = (complexity2[factor] as number) || 0;

      if (val1 > 0 || val2 > 0) {
        const maxVal = Math.max(val1, val2);
        const minVal = Math.min(val1, val2);
        similarity += maxVal > 0 ? minVal / maxVal : 1;
        validFactors++;
      }
    }

    return validFactors > 0 ? similarity / validFactors : 1;
  }

  /**
   * Calculate dependency similarity
   */
  private calculateDependencySimilarity(
    deps1: string[],
    deps2: string[]
  ): number {
    return this.calculateArraySimilarity(deps1, deps2);
  }

  /**
   * Calculate Jaccard similarity for arrays
   */
  private calculateArraySimilarity(arr1: string[], arr2: string[]): number {
    const set1 = new Set(arr1);
    const set2 = new Set(arr2);

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Perform advanced clustering using selected algorithm
   */
  private async performAdvancedClustering(
    initialClusters: DuplicateCluster[],
    entities: EntityInfo[]
  ): Promise<DuplicateCluster[]> {
    switch (this.config.clusteringAlgorithm) {
      case 'hierarchical':
        return this.hierarchicalClustering(initialClusters);
      case 'density':
        return this.densityBasedClustering(initialClusters, entities);
      case 'hash':
      default:
        return this.optimizeHashClusters(initialClusters);
    }
  }

  /**
   * Hierarchical clustering for better grouping
   */
  private async hierarchicalClustering(
    clusters: DuplicateCluster[]
  ): Promise<DuplicateCluster[]> {
    // Merge similar clusters
    const mergedClusters: DuplicateCluster[] = [];
    const processed = new Set<string>();

    for (const cluster of clusters) {
      if (processed.has(cluster.id)) {
        continue;
      }

      const mergedCluster = { ...cluster };
      processed.add(cluster.id);

      // Find clusters to merge
      for (const otherCluster of clusters) {
        if (otherCluster.id === cluster.id || processed.has(otherCluster.id)) {
          continue;
        }

        if (this.shouldMergeClusters(cluster, otherCluster)) {
          mergedCluster.entities.push(...otherCluster.entities);
          mergedCluster.similarity = Math.min(
            mergedCluster.similarity,
            otherCluster.similarity
          );
          processed.add(otherCluster.id);
        }
      }

      // Recalculate cluster properties
      mergedCluster.severity = this.calculateSeverity(mergedCluster.entities);
      mergedClusters.push(mergedCluster);
    }

    return mergedClusters;
  }

  /**
   * Density-based clustering (DBSCAN-like)
   */
  private async densityBasedClustering(
    clusters: DuplicateCluster[],
    entities: EntityInfo[]
  ): Promise<DuplicateCluster[]> {
    // Implementation of density-based clustering
    const densityClusters: DuplicateCluster[] = [];
    const processed = new Set<string>();

    // For each entity, find dense neighborhoods
    for (const entity of entities) {
      if (processed.has(entity.id)) {
        continue;
      }

      const neighborhood = this.findNeighborhood(
        entity,
        entities,
        this.config.minSimilarity
      );

      if (neighborhood.length >= 2) {
        // Minimum cluster size
        const cluster: DuplicateCluster = {
          id: createId(),
          hash: generateNormalizedHash(neighborhood.map(e => e.id).sort()),
          type: entity.type,
          severity: this.calculateSeverity(neighborhood),
          entities: neighborhood,
          structuralMatch: false,
          semanticMatch: false,
          similarity: this.calculateAverageSimilarity(neighborhood),
        };

        densityClusters.push(cluster);
        neighborhood.forEach(e => processed.add(e.id));
      }
    }

    return densityClusters;
  }

  /**
   * Find neighborhood of similar entities
   */
  private findNeighborhood(
    centerEntity: EntityInfo,
    entities: EntityInfo[],
    threshold: number
  ): EntityInfo[] {
    const neighborhood = [centerEntity];

    for (const entity of entities) {
      if (entity.id === centerEntity.id) {
        continue;
      }

      const similarity = this.calculateSemanticSimilarity(centerEntity, entity);
      if (similarity >= threshold) {
        neighborhood.push(entity);
      }
    }

    return neighborhood;
  }

  /**
   * Optimize hash-based clusters
   */
  private optimizeHashClusters(
    clusters: DuplicateCluster[]
  ): DuplicateCluster[] {
    return clusters
      .filter(cluster => cluster.entities.length <= this.config.maxClusterSize)
      .sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Merge overlapping clusters
   */
  private mergeClusters(
    existingClusters: DuplicateCluster[],
    newClusters: DuplicateCluster[]
  ): DuplicateCluster[] {
    const uniqueClusters: DuplicateCluster[] = [];

    for (const newCluster of newClusters) {
      const overlapping = existingClusters.find(existing =>
        this.clustersOverlap(existing, newCluster)
      );

      if (!overlapping) {
        uniqueClusters.push(newCluster);
      }
    }

    return uniqueClusters;
  }

  /**
   * Check if two clusters overlap
   */
  private clustersOverlap(
    cluster1: DuplicateCluster,
    cluster2: DuplicateCluster
  ): boolean {
    const entities1 = new Set(cluster1.entities.map(e => e.id));
    const entities2 = new Set(cluster2.entities.map(e => e.id));

    // Check for any overlap
    for (const entityId of entities1) {
      if (entities2.has(entityId)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Should merge clusters based on similarity and type
   */
  private shouldMergeClusters(
    cluster1: DuplicateCluster,
    cluster2: DuplicateCluster
  ): boolean {
    return (
      cluster1.type === cluster2.type &&
      cluster1.similarity >= 0.8 &&
      cluster2.similarity >= 0.8 &&
      !this.clustersOverlap(cluster1, cluster2)
    );
  }

  /**
   * Group entities by type for efficient processing
   */
  private groupEntitiesByType(
    entities: EntityInfo[]
  ): Map<string, EntityInfo[]> {
    const groups = new Map<string, EntityInfo[]>();

    entities.forEach(entity => {
      if (!groups.has(entity.type)) {
        groups.set(entity.type, []);
      }
      groups.get(entity.type)!.push(entity);
    });

    return groups;
  }

  /**
   * Calculate average similarity within a cluster
   */
  private calculateAverageSimilarity(entities: EntityInfo[]): number {
    if (entities.length < 2) {
      return 1.0;
    }

    let totalSimilarity = 0;
    let pairs = 0;

    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        totalSimilarity += this.calculateSemanticSimilarity(
          entities[i]!,
          entities[j]!
        );
        pairs++;
      }
    }

    return pairs > 0 ? totalSimilarity / pairs : 0;
  }

  /**
   * Calculate duplicate cluster severity
   */
  private calculateSeverity(entities: EntityInfo[]): SeverityLevel {
    const count = entities.length;
    const totalComplexity = entities.reduce(
      (sum, e) => sum + (e.complexity?.cyclomatic || 0),
      0
    );
    const avgDependencies =
      entities.reduce((sum, e) => sum + e.dependencies.length, 0) / count;

    if (count > 4 || totalComplexity > 100 || avgDependencies > 15) {
      return 'critical';
    } else if (count > 3 || totalComplexity > 50 || avgDependencies > 10) {
      return 'high';
    } else if (count > 2 || totalComplexity > 20 || avgDependencies > 5) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Enhance clusters with consolidation suggestions
   */
  private enhanceClustersWithSuggestions(
    clusters: DuplicateCluster[]
  ): DuplicateCluster[] {
    return clusters.map(cluster => ({
      ...cluster,
      consolidationSuggestion: this.generateConsolidationSuggestion(
        cluster.entities,
        cluster.type
      ),
    }));
  }

  /**
   * Generate consolidation suggestion for a cluster
   */
  private generateConsolidationSuggestion(
    entities: EntityInfo[],
    entityType: string
  ): ConsolidationSuggestion {
    const primaryEntity = entities[0];
    if (!primaryEntity) {
      throw new Error('Primary entity is undefined');
    }

    let strategy: 'merge' | 'extract' | 'refactor';
    if (entityType === 'interface' || entityType === 'type') {
      strategy = 'merge';
    } else if (entityType === 'class' || entityType === 'service') {
      strategy = 'extract';
    } else {
      strategy = 'refactor';
    }

    const estimatedEffort =
      entities.length > 4 ? 'high' : entities.length > 2 ? 'medium' : 'low';

    const steps = this.generateConsolidationSteps(strategy, entities);

    return {
      strategy,
      targetFile: primaryEntity.file,
      estimatedEffort,
      impact: `Consolidating ${entities.length} duplicate ${entityType}s will reduce maintenance burden and improve consistency`,
      steps,
    };
  }

  /**
   * Generate consolidation steps based on strategy
   */
  private generateConsolidationSteps(
    strategy: 'merge' | 'extract' | 'refactor',
    _entities: EntityInfo[]
  ): string[] {
    const baseSteps = [
      'Review all duplicate implementations for functional differences',
      'Identify the most complete and well-tested implementation',
      'Create comprehensive test coverage for the consolidated version',
    ];

    switch (strategy) {
      case 'merge':
        return [
          ...baseSteps,
          'Merge interface/type definitions into a single declaration',
          'Update all import statements to reference the consolidated version',
          'Remove duplicate definitions',
          'Verify type compatibility across all usage sites',
        ];

      case 'extract':
        return [
          ...baseSteps,
          'Extract common functionality into a shared base class or utility',
          'Update duplicate classes to inherit from or use the extracted code',
          'Refactor specific implementations to extend base functionality',
          'Update dependency injection and service registration',
        ];

      case 'refactor':
        return [
          ...baseSteps,
          'Choose the best implementation as the canonical version',
          'Refactor duplicate functions to call the canonical implementation',
          'Update all call sites to use the consolidated function',
          'Remove duplicate implementations and update exports',
        ];

      default:
        return baseSteps;
    }
  }
}
