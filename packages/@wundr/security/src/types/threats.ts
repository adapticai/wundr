/**
 * Security Threats and Vulnerability Intelligence Types
 * Enterprise-grade threat detection, vulnerability management, and security incident classification
 *
 * @fileoverview Comprehensive threat intelligence types supporting vulnerability scanning,
 * threat detection, incident response, and security risk assessment
 * @author Security Threats Module Creator
 * @version 1.0.0
 */

import {
  SecurityId,
  SecurityTimestamp,
  SecuritySeverity,
  SecurityAttributeValue,
  ComplianceFramework,
  GeographicLocation
} from './base';

/**
 * Threat classification taxonomy
 */
export enum ThreatCategory {
  MALWARE = 'malware',
  PHISHING = 'phishing',
  RANSOMWARE = 'ransomware',
  APT = 'apt', // Advanced Persistent Threat
  BOTNET = 'botnet',
  DDOS = 'ddos',
  INJECTION = 'injection',
  XSS = 'xss',
  CSRF = 'csrf',
  PRIVILEGE_ESCALATION = 'privilege_escalation',
  DATA_EXFILTRATION = 'data_exfiltration',
  INSIDER_THREAT = 'insider_threat',
  SUPPLY_CHAIN = 'supply_chain',
  ZERO_DAY = 'zero_day',
  CRYPTOJACKING = 'cryptojacking',
  SOCIAL_ENGINEERING = 'social_engineering',
  PHYSICAL_SECURITY = 'physical_security',
  MISCONFIGURATION = 'misconfiguration',
  WEAK_AUTHENTICATION = 'weak_authentication',
  DATA_BREACH = 'data_breach',
  UNKNOWN = 'unknown'
}

/**
 * Threat actor types
 */
export enum ThreatActor {
  NATION_STATE = 'nation_state',
  CYBERCRIMINAL = 'cybercriminal',
  HACKTIVIST = 'hacktivist',
  INSIDER = 'insider',
  SCRIPT_KIDDIE = 'script_kiddie',
  TERRORIST = 'terrorist',
  COMPETITOR = 'competitor',
  UNKNOWN = 'unknown'
}

/**
 * Threat sophistication levels
 */
export enum ThreatSophistication {
  BASIC = 'basic',       // Simple, automated attacks
  INTERMEDIATE = 'intermediate', // Moderately skilled attacks
  ADVANCED = 'advanced',  // Highly skilled attacks
  EXPERT = 'expert',     // Nation-state level attacks
  UNKNOWN = 'unknown'
}

/**
 * Attack vectors and techniques (MITRE ATT&CK inspired)
 */
export enum AttackTechnique {
  // Initial Access
  SPEARPHISHING_ATTACHMENT = 'T1566.001',
  SPEARPHISHING_LINK = 'T1566.002',
  DRIVE_BY_COMPROMISE = 'T1189',
  EXPLOIT_PUBLIC_APPLICATION = 'T1190',
  EXTERNAL_REMOTE_SERVICES = 'T1133',

  // Execution
  COMMAND_LINE_INTERFACE = 'T1059',
  POWERSHELL = 'T1059.001',
  WINDOWS_COMMAND_SHELL = 'T1059.003',
  UNIX_SHELL = 'T1059.004',
  SCHEDULED_TASK = 'T1053',

  // Persistence
  REGISTRY_RUN_KEYS = 'T1547.001',
  SCHEDULED_TASK_PERSISTENCE = 'T1053.005',
  CREATE_ACCOUNT = 'T1136',
  WEB_SHELL = 'T1505.003',

  // Privilege Escalation
  BYPASS_UAC = 'T1548.002',
  EXPLOITATION_FOR_PRIVILEGE_ESCALATION = 'T1068',
  PROCESS_INJECTION = 'T1055',

  // Defense Evasion
  OBFUSCATED_FILES_INFO = 'T1027',
  MASQUERADING = 'T1036',
  DISABLE_SECURITY_TOOLS = 'T1562.001',
  ROOTKIT = 'T1014',

  // Credential Access
  BRUTE_FORCE = 'T1110',
  CREDENTIAL_DUMPING = 'T1003',
  KEYLOGGING = 'T1056.001',
  PASSWORD_SPRAYING = 'T1110.003',

  // Discovery
  SYSTEM_INFORMATION_DISCOVERY = 'T1082',
  NETWORK_SERVICE_SCANNING = 'T1046',
  PROCESS_DISCOVERY = 'T1057',
  ACCOUNT_DISCOVERY = 'T1087',

  // Lateral Movement
  REMOTE_DESKTOP_PROTOCOL = 'T1021.001',
  SSH = 'T1021.004',
  PASS_THE_HASH = 'T1550.002',
  EXPLOITATION_OF_REMOTE_SERVICES = 'T1210',

  // Collection
  DATA_FROM_LOCAL_SYSTEM = 'T1005',
  DATA_FROM_NETWORK_SHARED_DRIVE = 'T1039',
  SCREEN_CAPTURE = 'T1113',
  CLIPBOARD_DATA = 'T1115',

  // Command and Control
  APPLICATION_LAYER_PROTOCOL = 'T1071',
  DNS = 'T1071.004',
  WEB_PROTOCOLS = 'T1071.001',
  ENCRYPTED_CHANNEL = 'T1573',

  // Exfiltration
  EXFILTRATION_OVER_C2_CHANNEL = 'T1041',
  EXFILTRATION_OVER_WEB_SERVICE = 'T1567',
  DATA_COMPRESSED = 'T1560',

  // Impact
  DATA_DESTRUCTION = 'T1485',
  DATA_ENCRYPTED_FOR_IMPACT = 'T1486',
  RESOURCE_HIJACKING = 'T1496',
  SERVICE_STOP = 'T1489',

  // Custom/Unknown
  CUSTOM = 'CUSTOM',
  UNKNOWN = 'UNKNOWN'
}

/**
 * Vulnerability types and classifications
 */
export enum VulnerabilityType {
  // OWASP Top 10 based
  INJECTION = 'injection',
  BROKEN_AUTHENTICATION = 'broken_authentication',
  SENSITIVE_DATA_EXPOSURE = 'sensitive_data_exposure',
  XML_EXTERNAL_ENTITIES = 'xml_external_entities',
  BROKEN_ACCESS_CONTROL = 'broken_access_control',
  SECURITY_MISCONFIGURATION = 'security_misconfiguration',
  CROSS_SITE_SCRIPTING = 'cross_site_scripting',
  INSECURE_DESERIALIZATION = 'insecure_deserialization',
  KNOWN_VULNERABILITIES = 'known_vulnerabilities',
  INSUFFICIENT_LOGGING = 'insufficient_logging',

  // CWE based
  BUFFER_OVERFLOW = 'buffer_overflow',
  RACE_CONDITION = 'race_condition',
  CRYPTOGRAPHIC_ISSUES = 'cryptographic_issues',
  PATH_TRAVERSAL = 'path_traversal',
  INFORMATION_DISCLOSURE = 'information_disclosure',
  DENIAL_OF_SERVICE = 'denial_of_service',
  CODE_INJECTION = 'code_injection',
  COMMAND_INJECTION = 'command_injection',

  // Infrastructure
  NETWORK_VULNERABILITY = 'network_vulnerability',
  SYSTEM_VULNERABILITY = 'system_vulnerability',
  CONFIGURATION_ERROR = 'configuration_error',
  MISSING_PATCHES = 'missing_patches',

  // Application specific
  BUSINESS_LOGIC_ERROR = 'business_logic_error',
  SESSION_MANAGEMENT = 'session_management',
  INPUT_VALIDATION = 'input_validation',
  OUTPUT_ENCODING = 'output_encoding',

  UNKNOWN = 'unknown'
}

/**
 * Core threat intelligence data structure
 */
export interface ThreatIntelligence {
  readonly id: SecurityId;
  readonly name: string;
  readonly category: ThreatCategory;
  readonly severity: SecuritySeverity;
  readonly confidence: ThreatConfidenceLevel;
  readonly actor: ThreatActor;
  readonly sophistication: ThreatSophistication;
  readonly techniques: readonly AttackTechnique[];
  readonly description: string;
  readonly summary: string;
  readonly indicators: readonly ThreatIndicator[];
  readonly timeline: ThreatTimeline;
  readonly attribution: ThreatAttribution;
  readonly impact: ThreatImpact;
  readonly mitigation: readonly MitigationStrategy[];
  readonly sources: readonly IntelligenceSource[];
  readonly metadata: ThreatIntelligenceMetadata;
  readonly createdAt: SecurityTimestamp;
  readonly updatedAt: SecurityTimestamp;
}

/**
 * Threat confidence levels
 */
export enum ThreatConfidenceLevel {
  CONFIRMED = 'confirmed',     // 90-100% confidence
  PROBABLE = 'probable',       // 70-89% confidence
  POSSIBLE = 'possible',       // 50-69% confidence
  DOUBTFUL = 'doubtful',      // 30-49% confidence
  IMPROBABLE = 'improbable',  // 10-29% confidence
  UNKNOWN = 'unknown'         // 0-9% confidence
}

/**
 * Threat indicators (IoCs - Indicators of Compromise)
 */
export interface ThreatIndicator {
  readonly id: SecurityId;
  readonly type: IndicatorType;
  readonly value: string;
  readonly confidence: ThreatConfidenceLevel;
  readonly firstSeen: SecurityTimestamp;
  readonly lastSeen: SecurityTimestamp;
  readonly context: IndicatorContext;
  readonly tags: readonly string[];
  readonly metadata?: Record<string, SecurityAttributeValue>;
}

/**
 * Types of threat indicators
 */
export enum IndicatorType {
  // Network indicators
  IP_ADDRESS = 'ip_address',
  DOMAIN = 'domain',
  URL = 'url',
  EMAIL_ADDRESS = 'email_address',

  // File indicators
  FILE_HASH_MD5 = 'file_hash_md5',
  FILE_HASH_SHA1 = 'file_hash_sha1',
  FILE_HASH_SHA256 = 'file_hash_sha256',
  FILE_NAME = 'file_name',
  FILE_PATH = 'file_path',

  // Registry indicators
  REGISTRY_KEY = 'registry_key',
  REGISTRY_VALUE = 'registry_value',

  // Process indicators
  PROCESS_NAME = 'process_name',
  PROCESS_CMDLINE = 'process_cmdline',
  SERVICE_NAME = 'service_name',

  // Network behavior
  USER_AGENT = 'user_agent',
  HTTP_HEADER = 'http_header',
  SSL_CERTIFICATE = 'ssl_certificate',
  JA3_FINGERPRINT = 'ja3_fingerprint',

  // Malware specific
  MUTEX = 'mutex',
  YARA_RULE = 'yara_rule',
  SIGMA_RULE = 'sigma_rule',

  // Custom
  CUSTOM = 'custom'
}

/**
 * Indicator context information
 */
export interface IndicatorContext {
  readonly malicious: boolean;
  readonly whitelisted: boolean;
  readonly reputation: ReputationScore;
  readonly geolocation?: GeographicLocation;
  readonly asn?: string;
  readonly categories: readonly string[];
  readonly relationships: readonly IndicatorRelationship[];
}

/**
 * Reputation scoring for indicators
 */
export interface ReputationScore {
  readonly score: number; // -100 to +100 (-100 = definitely malicious, +100 = definitely benign)
  readonly sources: readonly ReputationSource[];
  readonly lastUpdated: SecurityTimestamp;
  readonly confidence: ThreatConfidenceLevel;
}

/**
 * Reputation data sources
 */
export interface ReputationSource {
  readonly name: string;
  readonly score: number;
  readonly category: string;
  readonly timestamp: SecurityTimestamp;
  readonly metadata?: Record<string, SecurityAttributeValue>;
}

/**
 * Relationships between indicators
 */
export interface IndicatorRelationship {
  readonly relatedIndicatorId: SecurityId;
  readonly relationship: RelationshipType;
  readonly confidence: ThreatConfidenceLevel;
  readonly context?: string;
}

/**
 * Types of relationships between indicators
 */
export enum RelationshipType {
  RESOLVES_TO = 'resolves_to',
  COMMUNICATES_WITH = 'communicates_with',
  DOWNLOADS = 'downloads',
  DROPS = 'drops',
  CREATES = 'creates',
  MODIFIES = 'modifies',
  CONTAINS = 'contains',
  VARIANT_OF = 'variant_of',
  SIMILAR_TO = 'similar_to',
  RELATED_TO = 'related_to'
}

/**
 * Threat timeline for tracking evolution
 */
export interface ThreatTimeline {
  readonly firstObserved: SecurityTimestamp;
  readonly lastObserved: SecurityTimestamp;
  readonly peakActivity?: SecurityTimestamp;
  readonly events: readonly ThreatTimelineEvent[];
  readonly campaigns: readonly ThreatCampaign[];
}

/**
 * Individual events in threat timeline
 */
export interface ThreatTimelineEvent {
  readonly id: SecurityId;
  readonly timestamp: SecurityTimestamp;
  readonly type: TimelineEventType;
  readonly description: string;
  readonly source: IntelligenceSource;
  readonly confidence: ThreatConfidenceLevel;
  readonly metadata?: Record<string, SecurityAttributeValue>;
}

/**
 * Types of timeline events
 */
export enum TimelineEventType {
  DISCOVERY = 'discovery',
  ANALYSIS = 'analysis',
  ATTRIBUTION = 'attribution',
  CAMPAIGN_START = 'campaign_start',
  CAMPAIGN_END = 'campaign_end',
  VARIANT_DISCOVERED = 'variant_discovered',
  MITIGATION_RELEASED = 'mitigation_released',
  PATCH_AVAILABLE = 'patch_available',
  EXPLOIT_PUBLISHED = 'exploit_published',
  IOC_PUBLISHED = 'ioc_published'
}

/**
 * Threat campaigns (coordinated attacks)
 */
export interface ThreatCampaign {
  readonly id: SecurityId;
  readonly name: string;
  readonly startDate: SecurityTimestamp;
  readonly endDate?: SecurityTimestamp;
  readonly status: CampaignStatus;
  readonly targets: readonly CampaignTarget[];
  readonly objectives: readonly string[];
  readonly techniques: readonly AttackTechnique[];
  readonly attribution: ThreatAttribution;
  readonly indicators: readonly SecurityId[]; // References to ThreatIndicator IDs
  readonly metadata?: Record<string, SecurityAttributeValue>;
}

/**
 * Campaign status
 */
export enum CampaignStatus {
  ACTIVE = 'active',
  DORMANT = 'dormant',
  ENDED = 'ended',
  SUSPECTED = 'suspected',
  UNKNOWN = 'unknown'
}

/**
 * Campaign target information
 */
export interface CampaignTarget {
  readonly type: TargetType;
  readonly description: string;
  readonly sectors: readonly string[];
  readonly regions: readonly string[];
  readonly technologies: readonly string[];
}

/**
 * Types of campaign targets
 */
export enum TargetType {
  GOVERNMENT = 'government',
  MILITARY = 'military',
  HEALTHCARE = 'healthcare',
  FINANCIAL = 'financial',
  TECHNOLOGY = 'technology',
  ENERGY = 'energy',
  EDUCATION = 'education',
  RETAIL = 'retail',
  MANUFACTURING = 'manufacturing',
  TELECOMMUNICATIONS = 'telecommunications',
  MEDIA = 'media',
  NGO = 'ngo',
  INDIVIDUALS = 'individuals',
  UNKNOWN = 'unknown'
}

/**
 * Threat attribution information
 */
export interface ThreatAttribution {
  readonly actor: ThreatActor;
  readonly groups: readonly string[];
  readonly aliases: readonly string[];
  readonly country?: string;
  readonly motivation: readonly string[];
  readonly confidence: ThreatConfidenceLevel;
  readonly evidence: readonly AttributionEvidence[];
}

/**
 * Evidence for threat attribution
 */
export interface AttributionEvidence {
  readonly type: EvidenceType;
  readonly description: string;
  readonly confidence: ThreatConfidenceLevel;
  readonly source: IntelligenceSource;
  readonly metadata?: Record<string, SecurityAttributeValue>;
}

/**
 * Types of attribution evidence
 */
export enum EvidenceType {
  TECHNICAL = 'technical',
  BEHAVIORAL = 'behavioral',
  LINGUISTIC = 'linguistic',
  TEMPORAL = 'temporal',
  INFRASTRUCTURE = 'infrastructure',
  TARGETING = 'targeting',
  GEOPOLITICAL = 'geopolitical'
}

/**
 * Threat impact assessment
 */
export interface ThreatImpact {
  readonly scope: ImpactScope;
  readonly severity: SecuritySeverity;
  readonly financial?: FinancialImpact;
  readonly operational?: OperationalImpact;
  readonly reputational?: ReputationalImpact;
  readonly regulatory?: RegulatoryImpact;
  readonly affected: AffectedAssets;
}

/**
 * Scope of threat impact
 */
export enum ImpactScope {
  ORGANIZATION = 'organization',
  DEPARTMENT = 'department',
  SYSTEM = 'system',
  APPLICATION = 'application',
  DATA = 'data',
  INDIVIDUAL = 'individual',
  SECTOR = 'sector',
  GLOBAL = 'global'
}

/**
 * Financial impact details
 */
export interface FinancialImpact {
  readonly estimatedCost: number;
  readonly currency: string;
  readonly costComponents: readonly CostComponent[];
  readonly confidence: ThreatConfidenceLevel;
}

/**
 * Components of financial cost
 */
export interface CostComponent {
  readonly type: CostType;
  readonly amount: number;
  readonly description: string;
}

/**
 * Types of costs
 */
export enum CostType {
  DIRECT_LOSS = 'direct_loss',
  RECOVERY_COST = 'recovery_cost',
  BUSINESS_INTERRUPTION = 'business_interruption',
  LEGAL_FEES = 'legal_fees',
  REGULATORY_FINES = 'regulatory_fines',
  REPUTATION_DAMAGE = 'reputation_damage',
  OPPORTUNITY_COST = 'opportunity_cost'
}

/**
 * Operational impact details
 */
export interface OperationalImpact {
  readonly downtime?: number; // minutes
  readonly affectedSystems: readonly string[];
  readonly serviceImpact: ServiceImpactLevel;
  readonly dataIntegrity: DataIntegrityImpact;
  readonly availability: AvailabilityImpact;
}

/**
 * Service impact levels
 */
export enum ServiceImpactLevel {
  NO_IMPACT = 'no_impact',
  MINIMAL = 'minimal',
  MODERATE = 'moderate',
  SIGNIFICANT = 'significant',
  SEVERE = 'severe',
  COMPLETE = 'complete'
}

/**
 * Data integrity impact
 */
export interface DataIntegrityImpact {
  readonly affected: boolean;
  readonly extent: ImpactExtent;
  readonly dataTypes: readonly string[];
  readonly recoverable: boolean;
}

/**
 * Availability impact
 */
export interface AvailabilityImpact {
  readonly affected: boolean;
  readonly extent: ImpactExtent;
  readonly duration?: number; // minutes
  readonly criticality: CriticalityLevel;
}

/**
 * Impact extent levels
 */
export enum ImpactExtent {
  NONE = 'none',
  LIMITED = 'limited',
  MODERATE = 'moderate',
  EXTENSIVE = 'extensive',
  COMPLETE = 'complete'
}

/**
 * System criticality levels
 */
export enum CriticalityLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
  MISSION_CRITICAL = 'mission_critical'
}

/**
 * Reputational impact
 */
export interface ReputationalImpact {
  readonly severity: SecuritySeverity;
  readonly publicExposure: boolean;
  readonly mediaAttention: MediaAttentionLevel;
  readonly stakeholderConcern: StakeholderConcernLevel;
  readonly brandDamage: BrandDamageLevel;
}

/**
 * Media attention levels
 */
export enum MediaAttentionLevel {
  NONE = 'none',
  LOCAL = 'local',
  NATIONAL = 'national',
  INTERNATIONAL = 'international',
  VIRAL = 'viral'
}

/**
 * Stakeholder concern levels
 */
export enum StakeholderConcernLevel {
  NONE = 'none',
  LOW = 'low',
  MODERATE = 'moderate',
  HIGH = 'high',
  SEVERE = 'severe'
}

/**
 * Brand damage levels
 */
export enum BrandDamageLevel {
  NONE = 'none',
  MINIMAL = 'minimal',
  MODERATE = 'moderate',
  SIGNIFICANT = 'significant',
  SEVERE = 'severe',
  IRREVERSIBLE = 'irreversible'
}

/**
 * Regulatory impact
 */
export interface RegulatoryImpact {
  readonly frameworks: readonly ComplianceFramework[];
  readonly violations: readonly RegulatoryViolation[];
  readonly reportingRequired: boolean;
  readonly penalties: readonly RegulatoryPenalty[];
}

/**
 * Regulatory violations
 */
export interface RegulatoryViolation {
  readonly framework: ComplianceFramework;
  readonly requirement: string;
  readonly description: string;
  readonly severity: SecuritySeverity;
}

/**
 * Regulatory penalties
 */
export interface RegulatoryPenalty {
  readonly type: PenaltyType;
  readonly amount?: number;
  readonly currency?: string;
  readonly description: string;
  readonly likelihood: ThreatConfidenceLevel;
}

/**
 * Types of regulatory penalties
 */
export enum PenaltyType {
  FINE = 'fine',
  SANCTION = 'sanction',
  LICENSE_REVOCATION = 'license_revocation',
  OPERATIONAL_RESTRICTION = 'operational_restriction',
  CRIMINAL_CHARGES = 'criminal_charges'
}

/**
 * Affected assets information
 */
export interface AffectedAssets {
  readonly systems: readonly string[];
  readonly applications: readonly string[];
  readonly data: readonly DataAsset[];
  readonly infrastructure: readonly string[];
  readonly personnel: readonly string[];
  readonly thirdParties: readonly string[];
}

/**
 * Data asset information
 */
export interface DataAsset {
  readonly name: string;
  readonly type: DataType;
  readonly classification: DataClassification;
  readonly volume?: number;
  readonly sensitivity: DataSensitivity;
}

/**
 * Data types
 */
export enum DataType {
  PERSONAL_DATA = 'personal_data',
  FINANCIAL_DATA = 'financial_data',
  HEALTH_DATA = 'health_data',
  INTELLECTUAL_PROPERTY = 'intellectual_property',
  TRADE_SECRETS = 'trade_secrets',
  CUSTOMER_DATA = 'customer_data',
  EMPLOYEE_DATA = 'employee_data',
  OPERATIONAL_DATA = 'operational_data',
  SYSTEM_DATA = 'system_data'
}

/**
 * Data classification levels
 */
export enum DataClassification {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  CONFIDENTIAL = 'confidential',
  RESTRICTED = 'restricted',
  TOP_SECRET = 'top_secret'
}

/**
 * Data sensitivity levels
 */
export enum DataSensitivity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Mitigation strategies
 */
export interface MitigationStrategy {
  readonly id: SecurityId;
  readonly name: string;
  readonly type: MitigationType;
  readonly description: string;
  readonly effectiveness: EffectivenessLevel;
  readonly cost: CostLevel;
  readonly implementation: ImplementationDetails;
  readonly dependencies: readonly string[];
  readonly timeline: MitigationTimeline;
}

/**
 * Types of mitigation strategies
 */
export enum MitigationType {
  PREVENTIVE = 'preventive',
  DETECTIVE = 'detective',
  CORRECTIVE = 'corrective',
  COMPENSATING = 'compensating',
  DIRECTIVE = 'directive'
}

/**
 * Effectiveness levels
 */
export enum EffectivenessLevel {
  LOW = 'low',           // 0-25% threat reduction
  MODERATE = 'moderate', // 26-50% threat reduction
  HIGH = 'high',         // 51-75% threat reduction
  VERY_HIGH = 'very_high', // 76-90% threat reduction
  COMPLETE = 'complete'  // 91-100% threat reduction
}

/**
 * Cost levels for mitigation
 */
export enum CostLevel {
  MINIMAL = 'minimal',   // < $1K
  LOW = 'low',          // $1K-$10K
  MODERATE = 'moderate', // $10K-$100K
  HIGH = 'high',        // $100K-$1M
  VERY_HIGH = 'very_high' // > $1M
}

/**
 * Implementation details for mitigation
 */
export interface ImplementationDetails {
  readonly complexity: ComplexityLevel;
  readonly skillsRequired: readonly string[];
  readonly toolsRequired: readonly string[];
  readonly prerequisites: readonly string[];
  readonly riskFactors: readonly string[];
}

/**
 * Complexity levels
 */
export enum ComplexityLevel {
  TRIVIAL = 'trivial',
  SIMPLE = 'simple',
  MODERATE = 'moderate',
  COMPLEX = 'complex',
  VERY_COMPLEX = 'very_complex'
}

/**
 * Mitigation timeline
 */
export interface MitigationTimeline {
  readonly planningPhase: number; // days
  readonly implementationPhase: number; // days
  readonly validationPhase: number; // days
  readonly totalDuration: number; // days
  readonly milestones: readonly MitigationMilestone[];
}

/**
 * Mitigation milestones
 */
export interface MitigationMilestone {
  readonly name: string;
  readonly description: string;
  readonly daysFromStart: number;
  readonly deliverables: readonly string[];
  readonly dependencies: readonly string[];
}

/**
 * Intelligence sources
 */
export interface IntelligenceSource {
  readonly id: SecurityId;
  readonly name: string;
  readonly type: SourceType;
  readonly reliability: ReliabilityLevel;
  readonly access: AccessLevel;
  readonly cost: SourceCost;
  readonly coverage: SourceCoverage;
  readonly updateFrequency: UpdateFrequency;
  readonly metadata?: SourceMetadata;
}

/**
 * Types of intelligence sources
 */
export enum SourceType {
  COMMERCIAL = 'commercial',
  OPEN_SOURCE = 'open_source',
  GOVERNMENT = 'government',
  INDUSTRY_SHARING = 'industry_sharing',
  INTERNAL = 'internal',
  RESEARCH = 'research',
  HONEYPOT = 'honeypot',
  DARK_WEB = 'dark_web'
}

/**
 * Source reliability levels
 */
export enum ReliabilityLevel {
  VERY_HIGH = 'very_high',    // A - Completely reliable
  HIGH = 'high',              // B - Usually reliable
  MODERATE = 'moderate',      // C - Fairly reliable
  LOW = 'low',               // D - Not usually reliable
  VERY_LOW = 'very_low',     // E - Unreliable
  UNKNOWN = 'unknown'        // F - Reliability cannot be judged
}

/**
 * Access levels for sources
 */
export enum AccessLevel {
  PUBLIC = 'public',
  REGISTERED = 'registered',
  SUBSCRIPTION = 'subscription',
  PARTNERSHIP = 'partnership',
  CLASSIFIED = 'classified'
}

/**
 * Source cost information
 */
export interface SourceCost {
  readonly model: CostModel;
  readonly amount?: number;
  readonly currency?: string;
  readonly billingCycle?: BillingCycle;
}

/**
 * Cost models for sources
 */
export enum CostModel {
  FREE = 'free',
  ONE_TIME = 'one_time',
  SUBSCRIPTION = 'subscription',
  PAY_PER_USE = 'pay_per_use',
  VOLUME_BASED = 'volume_based'
}

/**
 * Billing cycles
 */
export enum BillingCycle {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ANNUALLY = 'annually',
  ON_DEMAND = 'on_demand'
}

/**
 * Source coverage information
 */
export interface SourceCoverage {
  readonly threatTypes: readonly ThreatCategory[];
  readonly regions: readonly string[];
  readonly languages: readonly string[];
  readonly sectors: readonly string[];
  readonly timeRange: TimeRange;
}

/**
 * Time range for source coverage
 */
export interface TimeRange {
  readonly from: SecurityTimestamp;
  readonly to?: SecurityTimestamp;
  readonly historical: boolean;
  readonly realTime: boolean;
}

/**
 * Update frequencies
 */
export enum UpdateFrequency {
  REAL_TIME = 'real_time',
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  ON_DEMAND = 'on_demand'
}

/**
 * Source metadata
 */
export interface SourceMetadata {
  readonly apiEndpoint?: string;
  readonly format: readonly DataFormat[];
  readonly authentication?: AuthenticationType;
  readonly rateLimit?: RateLimit;
  readonly customFields?: Record<string, SecurityAttributeValue>;
}

/**
 * Data formats
 */
export enum DataFormat {
  JSON = 'json',
  XML = 'xml',
  CSV = 'csv',
  STIX = 'stix',
  TAXII = 'taxii',
  RSS = 'rss',
  CUSTOM = 'custom'
}

/**
 * Authentication types
 */
export enum AuthenticationType {
  API_KEY = 'api_key',
  OAUTH2 = 'oauth2',
  BASIC_AUTH = 'basic_auth',
  CERTIFICATE = 'certificate',
  BEARER_TOKEN = 'bearer_token',
  CUSTOM = 'custom'
}

/**
 * Rate limiting information
 */
export interface RateLimit {
  readonly requestsPerSecond?: number;
  readonly requestsPerMinute?: number;
  readonly requestsPerHour?: number;
  readonly requestsPerDay?: number;
  readonly burstLimit?: number;
}

/**
 * Threat intelligence metadata
 */
export interface ThreatIntelligenceMetadata {
  readonly version: string;
  readonly format: DataFormat;
  readonly language: string;
  readonly tags: readonly string[];
  readonly tlp: TrafficLightProtocol; // Traffic Light Protocol
  readonly classification: InformationClassification;
  readonly handling: HandlingInstructions;
  readonly customFields?: Record<string, SecurityAttributeValue>;
}

/**
 * Traffic Light Protocol levels
 */
export enum TrafficLightProtocol {
  RED = 'red',       // Not for disclosure
  AMBER = 'amber',   // Limited disclosure
  GREEN = 'green',   // Community wide disclosure
  WHITE = 'white'    // Unlimited disclosure
}

/**
 * Information classification
 */
export enum InformationClassification {
  UNCLASSIFIED = 'unclassified',
  CONFIDENTIAL = 'confidential',
  SECRET = 'secret',
  TOP_SECRET = 'top_secret'
}

/**
 * Handling instructions
 */
export interface HandlingInstructions {
  readonly sharing: SharingLevel;
  readonly retention: RetentionPolicy;
  readonly encryption: EncryptionRequirement;
  readonly audit: AuditRequirement;
}

/**
 * Sharing levels
 */
export enum SharingLevel {
  INTERNAL_ONLY = 'internal_only',
  PARTNER_SHARING = 'partner_sharing',
  INDUSTRY_SHARING = 'industry_sharing',
  PUBLIC_SHARING = 'public_sharing',
  NO_SHARING = 'no_sharing'
}

/**
 * Retention policies
 */
export interface RetentionPolicy {
  readonly duration: number; // days
  readonly autoDelete: boolean;
  readonly archiveAfter?: number; // days
  readonly reviewCycle?: number; // days
}

/**
 * Encryption requirements
 */
export interface EncryptionRequirement {
  readonly required: boolean;
  readonly algorithm?: string;
  readonly keyLength?: number;
  readonly atRest: boolean;
  readonly inTransit: boolean;
}

/**
 * Audit requirements
 */
export interface AuditRequirement {
  readonly required: boolean;
  readonly events: readonly AuditEvent[];
  readonly retention: number; // days
  readonly realTime: boolean;
}

/**
 * Auditable events
 */
export enum AuditEvent {
  ACCESS = 'access',
  MODIFICATION = 'modification',
  SHARING = 'sharing',
  DELETION = 'deletion',
  EXPORT = 'export',
  PRINT = 'print'
}

/**
 * Vulnerability details (extended from VulnerabilityScanner)
 */
export interface ExtendedVulnerability {
  readonly id: SecurityId;
  readonly cveId?: string;
  readonly title: string;
  readonly description: string;
  readonly type: VulnerabilityType;
  readonly severity: SecuritySeverity;
  readonly cvssScore?: CVSSScore;
  readonly cweIds: readonly string[];
  readonly categories: readonly VulnerabilityCategory[];
  readonly affected: AffectedSoftware;
  readonly discovery: VulnerabilityDiscovery;
  readonly exploitation: ExploitationDetails;
  readonly remediation: RemediationDetails;
  readonly references: readonly VulnerabilityReference[];
  readonly timeline: VulnerabilityTimeline;
  readonly metadata: VulnerabilityMetadata;
}

/**
 * CVSS (Common Vulnerability Scoring System) score
 */
export interface CVSSScore {
  readonly version: CVSSVersion;
  readonly baseScore: number;
  readonly temporalScore?: number;
  readonly environmentalScore?: number;
  readonly vector: string;
  readonly metrics: CVSSMetrics;
}

/**
 * CVSS versions
 */
export enum CVSSVersion {
  V2 = '2.0',
  V3_0 = '3.0',
  V3_1 = '3.1',
  V4_0 = '4.0'
}

/**
 * CVSS metrics
 */
export interface CVSSMetrics {
  readonly attackVector?: AttackVector;
  readonly attackComplexity?: AttackComplexity;
  readonly privilegesRequired?: PrivilegesRequired;
  readonly userInteraction?: UserInteraction;
  readonly scope?: Scope;
  readonly confidentialityImpact?: Impact;
  readonly integrityImpact?: Impact;
  readonly availabilityImpact?: Impact;
}

/**
 * CVSS Attack Vector
 */
export enum AttackVector {
  NETWORK = 'network',
  ADJACENT = 'adjacent',
  LOCAL = 'local',
  PHYSICAL = 'physical'
}

/**
 * CVSS Attack Complexity
 */
export enum AttackComplexity {
  LOW = 'low',
  HIGH = 'high'
}

/**
 * CVSS Privileges Required
 */
export enum PrivilegesRequired {
  NONE = 'none',
  LOW = 'low',
  HIGH = 'high'
}

/**
 * CVSS User Interaction
 */
export enum UserInteraction {
  NONE = 'none',
  REQUIRED = 'required'
}

/**
 * CVSS Scope
 */
export enum Scope {
  UNCHANGED = 'unchanged',
  CHANGED = 'changed'
}

/**
 * CVSS Impact levels
 */
export enum Impact {
  NONE = 'none',
  LOW = 'low',
  HIGH = 'high'
}

/**
 * Vulnerability categories
 */
export enum VulnerabilityCategory {
  INPUT_VALIDATION = 'input_validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  SESSION_MANAGEMENT = 'session_management',
  CRYPTOGRAPHY = 'cryptography',
  ERROR_HANDLING = 'error_handling',
  LOGGING = 'logging',
  CONFIGURATION = 'configuration',
  BUSINESS_LOGIC = 'business_logic',
  RACE_CONDITIONS = 'race_conditions',
  MEMORY_MANAGEMENT = 'memory_management',
  FILE_HANDLING = 'file_handling',
  NETWORK_SECURITY = 'network_security'
}

/**
 * Affected software information
 */
export interface AffectedSoftware {
  readonly products: readonly SoftwareProduct[];
  readonly platforms: readonly string[];
  readonly versions: readonly VersionRange[];
  readonly configurations: readonly string[];
}

/**
 * Software product information
 */
export interface SoftwareProduct {
  readonly vendor: string;
  readonly name: string;
  readonly type: ProductType;
  readonly cpe?: string; // Common Platform Enumeration
  readonly purl?: string; // Package URL
}

/**
 * Product types
 */
export enum ProductType {
  APPLICATION = 'application',
  OPERATING_SYSTEM = 'operating_system',
  FIRMWARE = 'firmware',
  HARDWARE = 'hardware',
  LIBRARY = 'library',
  FRAMEWORK = 'framework',
  SERVICE = 'service'
}

/**
 * Version ranges
 */
export interface VersionRange {
  readonly introduced?: string;
  readonly fixed?: string;
  readonly lastAffected?: string;
  readonly limit?: VersionLimit;
}

/**
 * Version limits
 */
export enum VersionLimit {
  INCLUSIVE = 'inclusive',
  EXCLUSIVE = 'exclusive'
}

/**
 * Vulnerability discovery information
 */
export interface VulnerabilityDiscovery {
  readonly discoverer: string;
  readonly method: DiscoveryMethod;
  readonly date: SecurityTimestamp;
  readonly disclosure: DisclosureProcess;
  readonly credit: CreditInformation[];
}

/**
 * Discovery methods
 */
export enum DiscoveryMethod {
  SECURITY_RESEARCH = 'security_research',
  BUG_BOUNTY = 'bug_bounty',
  PENETRATION_TEST = 'penetration_test',
  CODE_AUDIT = 'code_audit',
  AUTOMATED_SCANNING = 'automated_scanning',
  INCIDENT_RESPONSE = 'incident_response',
  USER_REPORT = 'user_report',
  VENDOR_TESTING = 'vendor_testing'
}

/**
 * Disclosure process information
 */
export interface DisclosureProcess {
  readonly type: DisclosureType;
  readonly timeline: DisclosureTimeline;
  readonly coordinated: boolean;
  readonly embargo?: SecurityTimestamp;
}

/**
 * Types of vulnerability disclosure
 */
export enum DisclosureType {
  RESPONSIBLE = 'responsible',
  COORDINATED = 'coordinated',
  FULL = 'full',
  LIMITED = 'limited',
  ZERO_DAY = 'zero_day'
}

/**
 * Disclosure timeline
 */
export interface DisclosureTimeline {
  readonly reported: SecurityTimestamp;
  readonly acknowledged?: SecurityTimestamp;
  readonly patched?: SecurityTimestamp;
  readonly published: SecurityTimestamp;
}

/**
 * Credit information
 */
export interface CreditInformation {
  readonly name: string;
  readonly organization?: string;
  readonly role: CreditRole;
  readonly contact?: string;
}

/**
 * Credit roles
 */
export enum CreditRole {
  DISCOVERER = 'discoverer',
  RESEARCHER = 'researcher',
  REPORTER = 'reporter',
  COORDINATOR = 'coordinator',
  ANALYST = 'analyst'
}

/**
 * Exploitation details
 */
export interface ExploitationDetails {
  readonly exploitExists: boolean;
  readonly exploitPublic: boolean;
  readonly exploitability: ExploitabilityLevel;
  readonly weaponization: WeaponizationLevel;
  readonly exploitKits: readonly string[];
  readonly attackScenarios: readonly AttackScenario[];
}

/**
 * Exploitability levels
 */
export enum ExploitabilityLevel {
  THEORETICAL = 'theoretical',
  PROOF_OF_CONCEPT = 'proof_of_concept',
  FUNCTIONAL = 'functional',
  WEAPONIZED = 'weaponized',
  WIDESPREAD = 'widespread'
}

/**
 * Weaponization levels
 */
export enum WeaponizationLevel {
  NONE = 'none',
  MANUAL = 'manual',
  SEMI_AUTOMATED = 'semi_automated',
  AUTOMATED = 'automated',
  MASS_EXPLOITATION = 'mass_exploitation'
}

/**
 * Attack scenarios
 */
export interface AttackScenario {
  readonly name: string;
  readonly description: string;
  readonly prerequisites: readonly string[];
  readonly steps: readonly AttackStep[];
  readonly impact: ThreatImpact;
  readonly likelihood: ThreatConfidenceLevel;
}

/**
 * Individual attack steps
 */
export interface AttackStep {
  readonly sequence: number;
  readonly technique: AttackTechnique;
  readonly description: string;
  readonly tools: readonly string[];
  readonly detectability: DetectabilityLevel;
}

/**
 * Detectability levels
 */
export enum DetectabilityLevel {
  UNDETECTABLE = 'undetectable',
  DIFFICULT = 'difficult',
  MODERATE = 'moderate',
  EASY = 'easy',
  OBVIOUS = 'obvious'
}

/**
 * Remediation details
 */
export interface RemediationDetails {
  readonly available: boolean;
  readonly type: RemediationType;
  readonly solutions: readonly RemediationSolution[];
  readonly workarounds: readonly Workaround[];
  readonly timeline: RemediationTimeline;
}

/**
 * Remediation types
 */
export enum RemediationType {
  PATCH = 'patch',
  UPDATE = 'update',
  CONFIGURATION_CHANGE = 'configuration_change',
  WORKAROUND = 'workaround',
  MITIGATION = 'mitigation',
  REPLACEMENT = 'replacement'
}

/**
 * Remediation solutions
 */
export interface RemediationSolution {
  readonly type: RemediationType;
  readonly description: string;
  readonly effectiveness: EffectivenessLevel;
  readonly effort: string;
  readonly downtime: boolean;
  readonly sideEffects: readonly string[];
  readonly instructions: readonly string[];
}

/**
 * Workaround information
 */
export interface Workaround {
  readonly name: string;
  readonly description: string;
  readonly effectiveness: EffectivenessLevel;
  readonly limitations: readonly string[];
  readonly steps: readonly string[];
  readonly temporary: boolean;
}

/**
 * Remediation timeline
 */
export interface RemediationTimeline {
  readonly vendor: VendorTimeline;
  readonly recommendation: RecommendationTimeline;
  readonly emergency: EmergencyTimeline;
}

/**
 * Vendor timeline information
 */
export interface VendorTimeline {
  readonly acknowledged?: SecurityTimestamp;
  readonly patched?: SecurityTimestamp;
  readonly released?: SecurityTimestamp;
  readonly supported?: boolean;
}

/**
 * Recommendation timeline
 */
export interface RecommendationTimeline {
  readonly immediate: readonly string[];
  readonly shortTerm: readonly string[]; // within 24-48 hours
  readonly mediumTerm: readonly string[]; // within 1 week
  readonly longTerm: readonly string[]; // within 1 month
}

/**
 * Emergency response timeline
 */
export interface EmergencyTimeline {
  readonly severity: SecuritySeverity;
  readonly maxResponseTime: number; // hours
  readonly escalationCriteria: readonly string[];
  readonly emergencyContacts: readonly string[];
}

/**
 * Vulnerability references
 */
export interface VulnerabilityReference {
  readonly type: ReferenceType;
  readonly url: string;
  readonly title?: string;
  readonly description?: string;
  readonly tags: readonly string[];
}

/**
 * Reference types
 */
export enum ReferenceType {
  ADVISORY = 'advisory',
  PATCH = 'patch',
  VENDOR = 'vendor',
  EXPLOIT = 'exploit',
  ANALYSIS = 'analysis',
  MITIGATION = 'mitigation',
  PRESS = 'press',
  RESEARCH = 'research',
  TOOL = 'tool'
}

/**
 * Vulnerability timeline
 */
export interface VulnerabilityTimeline {
  readonly discovered: SecurityTimestamp;
  readonly reported?: SecurityTimestamp;
  readonly disclosed: SecurityTimestamp;
  readonly patched?: SecurityTimestamp;
  readonly exploited?: SecurityTimestamp;
  readonly events: readonly VulnerabilityTimelineEvent[];
}

/**
 * Vulnerability timeline events
 */
export interface VulnerabilityTimelineEvent {
  readonly timestamp: SecurityTimestamp;
  readonly type: VulnerabilityEventType;
  readonly description: string;
  readonly source?: string;
  readonly metadata?: Record<string, SecurityAttributeValue>;
}

/**
 * Vulnerability event types
 */
export enum VulnerabilityEventType {
  DISCOVERED = 'discovered',
  REPORTED = 'reported',
  ACKNOWLEDGED = 'acknowledged',
  ANALYZED = 'analyzed',
  PATCHED = 'patched',
  DISCLOSED = 'disclosed',
  EXPLOITED = 'exploited',
  MITIGATED = 'mitigated',
  VERIFIED = 'verified',
  ARCHIVED = 'archived'
}

/**
 * Vulnerability metadata
 */
export interface VulnerabilityMetadata {
  readonly source: IntelligenceSource;
  readonly confidence: ThreatConfidenceLevel;
  readonly completeness: CompletenessLevel;
  readonly verification: VerificationStatus;
  readonly customFields?: Record<string, SecurityAttributeValue>;
}

/**
 * Completeness levels
 */
export enum CompletenessLevel {
  MINIMAL = 'minimal',
  BASIC = 'basic',
  DETAILED = 'detailed',
  COMPREHENSIVE = 'comprehensive',
  COMPLETE = 'complete'
}

/**
 * Verification status
 */
export enum VerificationStatus {
  UNVERIFIED = 'unverified',
  PENDING = 'pending',
  VERIFIED = 'verified',
  DISPUTED = 'disputed',
  RETRACTED = 'retracted'
}

/**
 * Threat hunting query interface
 */
export interface ThreatHuntingQuery {
  readonly id: SecurityId;
  readonly name: string;
  readonly description: string;
  readonly category: ThreatCategory;
  readonly query: string;
  readonly platform: QueryPlatform;
  readonly dataSource: readonly string[];
  readonly indicators: readonly SecurityId[];
  readonly confidence: ThreatConfidenceLevel;
  readonly author: string;
  readonly createdAt: SecurityTimestamp;
  readonly updatedAt: SecurityTimestamp;
  readonly tags: readonly string[];
  readonly metadata?: QueryMetadata;
}

/**
 * Query platforms
 */
export enum QueryPlatform {
  SPLUNK = 'splunk',
  ELASTIC = 'elastic',
  SIGMA = 'sigma',
  YARA = 'yara',
  KQL = 'kql', // Kusto Query Language
  SQL = 'sql',
  SURICATA = 'suricata',
  SNORT = 'snort',
  CUSTOM = 'custom'
}

/**
 * Query metadata
 */
export interface QueryMetadata {
  readonly falsePositiveRate?: number;
  readonly performance?: QueryPerformance;
  readonly dependencies?: readonly string[];
  readonly limitations?: readonly string[];
  readonly examples?: readonly QueryExample[];
}

/**
 * Query performance information
 */
export interface QueryPerformance {
  readonly complexity: ComplexityLevel;
  readonly resourceUsage: ResourceUsage;
  readonly timeRange: RecommendedTimeRange;
}

/**
 * Resource usage information
 */
export interface ResourceUsage {
  readonly cpu: ResourceLevel;
  readonly memory: ResourceLevel;
  readonly storage: ResourceLevel;
  readonly network: ResourceLevel;
}

/**
 * Resource levels
 */
export enum ResourceLevel {
  MINIMAL = 'minimal',
  LOW = 'low',
  MODERATE = 'moderate',
  HIGH = 'high',
  INTENSIVE = 'intensive'
}

/**
 * Recommended time range for queries
 */
export interface RecommendedTimeRange {
  readonly minimum: number; // minutes
  readonly maximum: number; // minutes
  readonly optimal: number; // minutes
}

/**
 * Query examples
 */
export interface QueryExample {
  readonly description: string;
  readonly query: string;
  readonly expectedResults: string;
  readonly timeRange: string;
}

/**
 * Threat intelligence collection requirements
 */
export interface CollectionRequirement {
  readonly id: SecurityId;
  readonly name: string;
  readonly priority: RequirementPriority;
  readonly category: ThreatCategory;
  readonly targets: readonly IntelligenceTarget[];
  readonly timeframe: TimeFrame;
  readonly sources: readonly SourceType[];
  readonly deliverables: readonly Deliverable[];
  readonly requestor: RequirementRequestor;
  readonly status: RequirementStatus;
  readonly createdAt: SecurityTimestamp;
  readonly dueDate?: SecurityTimestamp;
}

/**
 * Requirement priorities
 */
export enum RequirementPriority {
  IMMEDIATE = 'immediate',   // Within hours
  URGENT = 'urgent',         // Within 1-2 days
  HIGH = 'high',            // Within 1 week
  MEDIUM = 'medium',        // Within 2-4 weeks
  LOW = 'low'              // When resources allow
}

/**
 * Intelligence targets
 */
export interface IntelligenceTarget {
  readonly type: TargetType;
  readonly name: string;
  readonly description: string;
  readonly scope: TargetScope;
  readonly indicators: readonly string[];
}

/**
 * Target scope
 */
export interface TargetScope {
  readonly geographic?: readonly string[];
  readonly temporal?: TimeRange;
  readonly technical?: readonly string[];
  readonly organizational?: readonly string[];
}

/**
 * Time frames
 */
export interface TimeFrame {
  readonly start: SecurityTimestamp;
  readonly end?: SecurityTimestamp;
  readonly ongoing: boolean;
  readonly frequency?: UpdateFrequency;
}

/**
 * Deliverable information
 */
export interface Deliverable {
  readonly type: DeliverableType;
  readonly format: DataFormat;
  readonly detail: DetailLevel;
  readonly audience: readonly string[];
  readonly distribution: SharingLevel;
}

/**
 * Deliverable types
 */
export enum DeliverableType {
  REPORT = 'report',
  BRIEFING = 'briefing',
  INDICATORS = 'indicators',
  ANALYSIS = 'analysis',
  ASSESSMENT = 'assessment',
  RECOMMENDATION = 'recommendation'
}

/**
 * Detail levels
 */
export enum DetailLevel {
  EXECUTIVE = 'executive',
  TECHNICAL = 'technical',
  OPERATIONAL = 'operational',
  STRATEGIC = 'strategic',
  TACTICAL = 'tactical'
}

/**
 * Requirement requestor
 */
export interface RequirementRequestor {
  readonly name: string;
  readonly organization: string;
  readonly role: string;
  readonly contact: string;
  readonly clearance?: string;
}

/**
 * Requirement status
 */
export enum RequirementStatus {
  SUBMITTED = 'submitted',
  APPROVED = 'approved',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled'
}

/**
 * Type guards for threat intelligence types
 */
export const isThreatIntelligence = (value: unknown): value is ThreatIntelligence => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value &&
    'category' in value &&
    'severity' in value &&
    'confidence' in value &&
    typeof (value as ThreatIntelligence).id === 'string' &&
    typeof (value as ThreatIntelligence).name === 'string'
  );
};

export const isThreatIndicator = (value: unknown): value is ThreatIndicator => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'type' in value &&
    'value' in value &&
    'confidence' in value &&
    typeof (value as ThreatIndicator).id === 'string' &&
    typeof (value as ThreatIndicator).value === 'string'
  );
};

export const isExtendedVulnerability = (value: unknown): value is ExtendedVulnerability => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'title' in value &&
    'description' in value &&
    'type' in value &&
    'severity' in value &&
    typeof (value as ExtendedVulnerability).id === 'string' &&
    typeof (value as ExtendedVulnerability).title === 'string'
  );
};

/**
 * Utility functions for threat intelligence
 */
export const createThreatId = (): SecurityId => {
  return `threat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const createIndicatorId = (): SecurityId => {
  return `indicator_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const createVulnerabilityId = (): SecurityId => {
  return `vuln_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const calculateRiskScore = (
  severity: SecuritySeverity,
  confidence: ThreatConfidenceLevel,
  exploitability?: ExploitabilityLevel
): number => {
  const severityWeights = {
    [SecuritySeverity.CRITICAL]: 10,
    [SecuritySeverity.HIGH]: 8,
    [SecuritySeverity.MEDIUM]: 6,
    [SecuritySeverity.LOW]: 4,
    [SecuritySeverity.INFO]: 2
  };

  const confidenceWeights = {
    [ThreatConfidenceLevel.CONFIRMED]: 1.0,
    [ThreatConfidenceLevel.PROBABLE]: 0.8,
    [ThreatConfidenceLevel.POSSIBLE]: 0.6,
    [ThreatConfidenceLevel.DOUBTFUL]: 0.4,
    [ThreatConfidenceLevel.IMPROBABLE]: 0.2,
    [ThreatConfidenceLevel.UNKNOWN]: 0.1
  };

  const exploitabilityWeights = {
    [ExploitabilityLevel.WIDESPREAD]: 1.2,
    [ExploitabilityLevel.WEAPONIZED]: 1.1,
    [ExploitabilityLevel.FUNCTIONAL]: 1.0,
    [ExploitabilityLevel.PROOF_OF_CONCEPT]: 0.8,
    [ExploitabilityLevel.THEORETICAL]: 0.6
  };

  const baseSeverity = severityWeights[severity] || 1;
  const confidenceMultiplier = confidenceWeights[confidence] || 0.1;
  const exploitabilityMultiplier = exploitability ? exploitabilityWeights[exploitability] || 1.0 : 1.0;

  return Math.min(100, baseSeverity * confidenceMultiplier * exploitabilityMultiplier * 10);
};

export const categorizeIndicator = (value: string): IndicatorType => {
  // Basic heuristics for indicator categorization
  if (/^[a-f0-9]{32}$/i.test(value)) return IndicatorType.FILE_HASH_MD5;
  if (/^[a-f0-9]{40}$/i.test(value)) return IndicatorType.FILE_HASH_SHA1;
  if (/^[a-f0-9]{64}$/i.test(value)) return IndicatorType.FILE_HASH_SHA256;
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(value)) return IndicatorType.IP_ADDRESS;
  if (/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/.test(value)) return IndicatorType.DOMAIN;
  if (/^https?:\/\//.test(value)) return IndicatorType.URL;
  if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)) return IndicatorType.EMAIL_ADDRESS;

  return IndicatorType.CUSTOM;
};

/**
 * Threat intelligence constants
 */
export const THREAT_CONSTANTS = {
  MAX_INDICATORS_PER_THREAT: 10000,
  DEFAULT_CONFIDENCE_THRESHOLD: 0.6,
  DEFAULT_RETENTION_DAYS: 365,
  MAX_MITIGATION_STRATEGIES: 20,
  DEFAULT_UPDATE_INTERVAL: 24 * 60 * 60 * 1000, // 24 hours
  RISK_SCORE_THRESHOLDS: {
    CRITICAL: 90,
    HIGH: 70,
    MEDIUM: 50,
    LOW: 30
  }
} as const;

/**
 * Integration with existing VulnerabilityScanner types
 */
export interface VulnerabilityScannerIntegration {
  readonly extendedVulnerabilities: readonly ExtendedVulnerability[];
  readonly threatContext: readonly ThreatIntelligence[];
  readonly indicators: readonly ThreatIndicator[];
  readonly mitigations: readonly MitigationStrategy[];
  readonly intelligence: IntelligenceEnrichment;
}

/**
 * Intelligence enrichment for scan results
 */
export interface IntelligenceEnrichment {
  readonly threatsFound: number;
  readonly indicatorsMatched: number;
  readonly riskScore: number;
  readonly recommendations: readonly string[];
  readonly prioritizedVulnerabilities: readonly PrioritizedVulnerability[];
}

/**
 * Prioritized vulnerability with threat context
 */
export interface PrioritizedVulnerability {
  readonly vulnerability: ExtendedVulnerability;
  readonly threatContext: readonly ThreatIntelligence[];
  readonly riskScore: number;
  readonly priority: VulnerabilityPriority;
  readonly reasoning: string;
}

/**
 * Vulnerability priority levels
 */
export enum VulnerabilityPriority {
  IMMEDIATE = 'immediate',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFORMATIONAL = 'informational'
}