'use strict';
/**
 * Tests for DuplicateDetectionEngine
 */
Object.defineProperty(exports, '__esModule', { value: true });
const DuplicateDetectionEngine_1 = require('../../src/engines/DuplicateDetectionEngine');
const utils_1 = require('../../src/utils');
describe('DuplicateDetectionEngine', () => {
  let engine;
  let mockConfig;
  beforeEach(() => {
    engine = new DuplicateDetectionEngine_1.DuplicateDetectionEngine({
      minSimilarity: 0.8,
      enableSemanticAnalysis: true,
      enableStructuralAnalysis: true,
      enableFuzzyMatching: true,
      clusteringAlgorithm: 'hash',
      maxClusterSize: 10,
    });
    mockConfig = {
      targetDir: '/test',
      excludeDirs: [],
      includePatterns: ['**/*.ts'],
      excludePatterns: [],
      includeTests: false,
      enableAIAnalysis: false,
      outputFormats: ['json'],
      performance: {
        maxConcurrency: 10,
        chunkSize: 100,
        enableCaching: true,
      },
      thresholds: {
        complexity: { cyclomatic: 10, cognitive: 15 },
        duplicates: { minSimilarity: 0.8 },
        fileSize: { maxLines: 500 },
      },
    };
  });
  describe('Hash-based duplicate detection', () => {
    it('should detect exact duplicates using normalized hash', async () => {
      const entities = [
        createMockEntity('UserData', 'interface', {
          id: 'number',
          name: 'string',
        }),
        createMockEntity('UserInfo', 'interface', {
          id: 'number',
          name: 'string',
        }),
        createMockEntity('Product', 'interface', {
          id: 'number',
          title: 'string',
        }),
      ];
      // Make first two entities have same normalized hash (exact duplicates)
      const duplicateHash = (0, utils_1.generateNormalizedHash)({
        id: 'number',
        name: 'string',
      });
      entities[0].normalizedHash = duplicateHash;
      entities[1].normalizedHash = duplicateHash;
      const result = await engine.analyze(entities, mockConfig);
      expect(result).toHaveLength(1);
      expect(result[0].entities).toHaveLength(2);
      expect(result[0].entities.map(e => e.name)).toEqual([
        'UserData',
        'UserInfo',
      ]);
      expect(result[0].structuralMatch).toBe(true);
      expect(result[0].similarity).toBe(1.0);
    });
    it('should detect semantic duplicates using semantic hash', async () => {
      const entities = [
        createMockEntity('ServiceA', 'class'),
        createMockEntity('ServiceB', 'class'),
        createMockEntity('UtilityA', 'function'),
      ];
      // Make first two have same semantic hash but different normalized hash
      const semanticHash = (0, utils_1.generateSemanticHash)({
        methods: ['save', 'load'],
      });
      entities[0].semanticHash = semanticHash;
      entities[1].semanticHash = semanticHash;
      entities[0].normalizedHash = 'hash1';
      entities[1].normalizedHash = 'hash2';
      const result = await engine.analyze(entities, mockConfig);
      expect(result).toHaveLength(1);
      expect(result[0].entities).toHaveLength(2);
      expect(result[0].structuralMatch).toBe(false);
      expect(result[0].semanticMatch).toBe(true);
      expect(result[0].similarity).toBe(0.9);
    });
  });
  describe('Severity calculation', () => {
    it('should assign critical severity to large duplicate clusters', async () => {
      const entities = [];
      const duplicateHash = 'test-hash';
      // Create 5 duplicate entities with high complexity
      for (let i = 0; i < 5; i++) {
        entities.push(createMockEntity(`Entity${i}`, 'class'));
        entities[i].normalizedHash = duplicateHash;
        entities[i].complexity = {
          cyclomatic: 25,
          cognitive: 30,
          maintainability: 40,
          depth: 3,
          parameters: 6,
          lines: 150,
        };
        entities[i].dependencies = Array(15)
          .fill('')
          .map((_, j) => `dep${j}.ts`);
      }
      const result = await engine.analyze(entities, mockConfig);
      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe('critical');
      expect(result[0].entities).toHaveLength(5);
    });
    it('should assign low severity to simple duplicate pairs', async () => {
      const entities = [
        createMockEntity('SimpleA', 'function'),
        createMockEntity('SimpleB', 'function'),
      ];
      const duplicateHash = 'simple-hash';
      entities[0].normalizedHash = duplicateHash;
      entities[1].normalizedHash = duplicateHash;
      entities[0].complexity = {
        cyclomatic: 2,
        cognitive: 1,
        maintainability: 80,
        depth: 1,
        parameters: 1,
        lines: 10,
      };
      entities[1].complexity = {
        cyclomatic: 2,
        cognitive: 1,
        maintainability: 80,
        depth: 1,
        parameters: 1,
        lines: 10,
      };
      const result = await engine.analyze(entities, mockConfig);
      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe('low');
    });
  });
  describe('Consolidation suggestions', () => {
    it('should suggest merge strategy for interfaces', async () => {
      const entities = [
        createMockEntity('IUserData', 'interface'),
        createMockEntity('IUserInfo', 'interface'),
      ];
      const duplicateHash = 'interface-hash';
      entities[0].normalizedHash = duplicateHash;
      entities[1].normalizedHash = duplicateHash;
      const result = await engine.analyze(entities, mockConfig);
      expect(result[0].consolidationSuggestion?.strategy).toBe('merge');
      expect(result[0].consolidationSuggestion?.steps).toContain(
        'Merge interface/type definitions into a single declaration'
      );
    });
    it('should suggest extract strategy for classes', async () => {
      const entities = [
        createMockEntity('UserService', 'class'),
        createMockEntity('UserManager', 'class'),
      ];
      const duplicateHash = 'class-hash';
      entities[0].normalizedHash = duplicateHash;
      entities[1].normalizedHash = duplicateHash;
      const result = await engine.analyze(entities, mockConfig);
      expect(result[0].consolidationSuggestion?.strategy).toBe('extract');
      expect(result[0].consolidationSuggestion?.steps).toContain(
        'Extract common functionality into a shared base class or utility'
      );
    });
  });
  describe('Fuzzy matching', () => {
    it('should detect similar entities with different implementations', async () => {
      const entities = [
        createMockEntity('UserService', 'class'),
        createMockEntity('UserService', 'class'), // Same name, different implementation
      ];
      // Different hashes but similar structure
      entities[0].normalizedHash = 'hash1';
      entities[1].normalizedHash = 'hash2';
      entities[0].members = {
        methods: [
          { name: 'create', signature: 'create(user: User): Promise<User>' },
          {
            name: 'update',
            signature: 'update(id: number, data: any): Promise<User>',
          },
        ],
        properties: [{ name: 'users', type: 'User[]', optional: false }],
      };
      entities[1].members = {
        methods: [
          {
            name: 'create',
            signature: 'create(userData: UserData): Promise<UserData>',
          },
          {
            name: 'update',
            signature:
              'update(userId: number, updates: any): Promise<UserData>',
          },
        ],
        properties: [{ name: 'userList', type: 'UserData[]', optional: false }],
      };
      const result = await engine.analyze(entities, mockConfig);
      // Should detect as similar even with different implementations
      expect(result.length).toBeGreaterThan(0);
    });
  });
  describe('Configuration options', () => {
    it('should respect minimum similarity threshold', async () => {
      const lowSimilarityEngine =
        new DuplicateDetectionEngine_1.DuplicateDetectionEngine({
          minSimilarity: 0.9, // High threshold
          enableFuzzyMatching: true,
        });
      const entities = [
        createMockEntity('Service1', 'class'),
        createMockEntity('Service2', 'class'),
      ];
      // Make them somewhat similar but below threshold
      entities[0].members = {
        methods: [{ name: 'method1', signature: 'sig1' }],
      };
      entities[1].members = {
        methods: [{ name: 'method2', signature: 'sig2' }],
      };
      const result = await lowSimilarityEngine.analyze(entities, mockConfig);
      // Should not detect as duplicates due to high threshold
      expect(result).toHaveLength(0);
    });
    it('should limit cluster size according to maxClusterSize', async () => {
      const limitedEngine =
        new DuplicateDetectionEngine_1.DuplicateDetectionEngine({
          maxClusterSize: 3,
        });
      const entities = [];
      const duplicateHash = 'large-cluster-hash';
      // Create 5 identical entities
      for (let i = 0; i < 5; i++) {
        entities.push(createMockEntity(`Entity${i}`, 'function'));
        entities[i].normalizedHash = duplicateHash;
      }
      const result = await limitedEngine.analyze(entities, mockConfig);
      // Should filter out clusters larger than maxClusterSize
      expect(result).toHaveLength(0);
    });
  });
  // Helper function to create mock entities
  function createMockEntity(name, type, members) {
    return {
      id: (0, utils_1.createId)(),
      name,
      type,
      file: `/test/${name.toLowerCase()}.ts`,
      line: 1,
      column: 1,
      exportType: 'named',
      jsDoc: '',
      dependencies: [],
      normalizedHash: (0, utils_1.generateNormalizedHash)(members || name),
      semanticHash: (0, utils_1.generateSemanticHash)(
        members || { name, type }
      ),
      members,
      complexity: {
        cyclomatic: 1,
        cognitive: 0,
        maintainability: 100,
        depth: 0,
        parameters: 0,
        lines: 10,
      },
    };
  }
});
//# sourceMappingURL=DuplicateDetectionEngine.test.js.map
