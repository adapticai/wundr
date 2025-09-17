/**
 * Authentication Types and Interfaces
 * Enterprise-grade authentication system with JWT, OAuth, MFA, and SSO support
 *
 * @fileoverview Complete authentication type definitions for secure identity management
 * @author Security Types Specialist
 * @version 1.0.0
 */

import {
  SecurityId,
  SecurityTimestamp,
  SecurityToken,
  SecurityContext,
  SecurityResult,
  SecurityError,
  SecuritySeverity,
  SecurityOperationStatus,
  SecurityAlgorithm,
  DeviceFingerprint,
  NetworkContext
} from './index';

/**
 * Authentication method types
 */
export enum AuthenticationMethod {
  PASSWORD = 'password',
  MFA = 'mfa',
  BIOMETRIC = 'biometric',
  CERTIFICATE = 'certificate',
  TOKEN = 'token',
  SSO = 'sso',
  OAUTH = 'oauth',
  SAML = 'saml',
  LDAP = 'ldap',
  API_KEY = 'api_key'
}

/**
 * Authentication factor types for MFA
 */
export enum AuthenticationFactor {
  KNOWLEDGE = 'knowledge', // Something you know (password, PIN)
  POSSESSION = 'possession', // Something you have (token, phone)
  INHERENCE = 'inherence',  // Something you are (biometric)
  LOCATION = 'location',    // Somewhere you are (geo-location)
  TIME = 'time'            // Somewhen you are (time-based)
}

/**
 * JWT token types
 */
export enum JwtTokenType {
  ACCESS_TOKEN = 'access_token',
  REFRESH_TOKEN = 'refresh_token',
  ID_TOKEN = 'id_token',
  AUTHORIZATION_CODE = 'authorization_code'
}

/**
 * OAuth 2.0 grant types
 */
export enum OAuthGrantType {
  AUTHORIZATION_CODE = 'authorization_code',
  CLIENT_CREDENTIALS = 'client_credentials',
  RESOURCE_OWNER_PASSWORD = 'password',
  IMPLICIT = 'implicit',
  REFRESH_TOKEN = 'refresh_token',
  JWT_BEARER = 'urn:ietf:params:oauth:grant-type:jwt-bearer',
  SAML2_BEARER = 'urn:ietf:params:oauth:grant-type:saml2-bearer'
}

/**
 * OAuth 2.0 scopes
 */
export enum OAuthScope {
  OPENID = 'openid',
  PROFILE = 'profile',
  EMAIL = 'email',
  ADDRESS = 'address',
  PHONE = 'phone',
  OFFLINE_ACCESS = 'offline_access',
  READ = 'read',
  WRITE = 'write',
  ADMIN = 'admin'
}

/**
 * User account status
 */
export enum UserAccountStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  LOCKED = 'locked',
  SUSPENDED = 'suspended',
  PENDING_VERIFICATION = 'pending_verification',
  PASSWORD_EXPIRED = 'password_expired',
  REQUIRES_MFA_SETUP = 'requires_mfa_setup',
  DELETED = 'deleted'
}

/**
 * Base user interface
 */
export interface User {
  readonly id: SecurityId;
  readonly username: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly displayName?: string;
  readonly avatarUrl?: string;
  readonly status: UserAccountStatus;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
  readonly createdAt: SecurityTimestamp;
  readonly updatedAt: SecurityTimestamp;
  readonly lastLoginAt?: SecurityTimestamp;
  readonly passwordLastChanged?: SecurityTimestamp;
  readonly metadata?: UserMetadata;
}

/**
 * Extended user metadata
 */
export interface UserMetadata {
  readonly department?: string;
  readonly organization?: string;
  readonly location?: string;
  readonly timezone?: string;
  readonly locale?: string;
  readonly preferences?: UserPreferences;
  readonly securitySettings?: UserSecuritySettings;
  readonly customAttributes?: Record<string, unknown>;
}

/**
 * User preferences
 */
export interface UserPreferences {
  readonly theme?: 'light' | 'dark' | 'auto';
  readonly language?: string;
  readonly notifications?: NotificationPreferences;
  readonly accessibility?: AccessibilityPreferences;
}

/**
 * Notification preferences
 */
export interface NotificationPreferences {
  readonly email: boolean;
  readonly sms: boolean;
  readonly push: boolean;
  readonly desktop: boolean;
  readonly security: boolean;
  readonly marketing: boolean;
}

/**
 * Accessibility preferences
 */
export interface AccessibilityPreferences {
  readonly highContrast: boolean;
  readonly largeText: boolean;
  readonly screenReader: boolean;
  readonly keyboardNavigation: boolean;
}

/**
 * User security settings
 */
export interface UserSecuritySettings {
  readonly mfaEnabled: boolean;
  readonly mfaMethods: readonly MfaMethod[];
  readonly trustedDevices: readonly SecurityId[];
  readonly sessionTimeout?: number;
  readonly allowConcurrentSessions: boolean;
  readonly requirePasswordChange: boolean;
  readonly securityQuestions?: readonly SecurityQuestion[];
}

/**
 * MFA method configuration
 */
export interface MfaMethod {
  readonly id: SecurityId;
  readonly type: MfaMethodType;
  readonly name: string;
  readonly enabled: boolean;
  readonly isPrimary: boolean;
  readonly isBackup: boolean;
  readonly createdAt: SecurityTimestamp;
  readonly lastUsed?: SecurityTimestamp;
  readonly metadata?: MfaMethodMetadata;
}

/**
 * MFA method types
 */
export enum MfaMethodType {
  TOTP = 'totp', // Time-based One-Time Password
  SMS = 'sms',
  EMAIL = 'email',
  PUSH = 'push',
  HARDWARE_TOKEN = 'hardware_token',
  BACKUP_CODES = 'backup_codes',
  BIOMETRIC = 'biometric'
}

/**
 * MFA method metadata
 */
export interface MfaMethodMetadata {
  readonly phoneNumber?: string; // For SMS
  readonly email?: string; // For email
  readonly deviceId?: string; // For push/hardware
  readonly secretKey?: string; // For TOTP (encrypted)
  readonly backupCodes?: readonly string[]; // For backup codes (hashed)
  readonly biometricType?: 'fingerprint' | 'face' | 'voice' | 'iris';
}

/**
 * Security question configuration
 */
export interface SecurityQuestion {
  readonly id: SecurityId;
  readonly question: string;
  readonly answerHash: string;
  readonly createdAt: SecurityTimestamp;
}

/**
 * Password policy configuration
 */
export interface PasswordPolicy {
  readonly minLength: number;
  readonly maxLength: number;
  readonly requireUppercase: boolean;
  readonly requireLowercase: boolean;
  readonly requireNumbers: boolean;
  readonly requireSymbols: boolean;
  readonly forbidCommonPasswords: boolean;
  readonly forbidPersonalInfo: boolean;
  readonly historySize: number; // Prevent reuse of last N passwords
  readonly maxAge: number; // milliseconds
  readonly minAge: number; // milliseconds
  readonly complexityScore: number; // minimum entropy score
}

/**
 * JWT token payload interface
 */
export interface JwtPayload {
  // Standard claims (RFC 7519)
  readonly iss?: string; // Issuer
  readonly sub?: string; // Subject (user ID)
  readonly aud?: string | readonly string[]; // Audience
  readonly exp?: number; // Expiration time (Unix timestamp)
  readonly nbf?: number; // Not before (Unix timestamp)
  readonly iat?: number; // Issued at (Unix timestamp)
  readonly jti?: string; // JWT ID

  // Custom claims
  readonly userId?: SecurityId;
  readonly sessionId?: SecurityId;
  readonly email?: string;
  readonly roles?: readonly string[];
  readonly permissions?: readonly string[];
  readonly scope?: readonly string[];
  readonly mfaVerified?: boolean;
  readonly deviceId?: SecurityId;
  readonly riskScore?: number;
  readonly customClaims?: Record<string, unknown>;
}

/**
 * JWT token configuration
 */
export interface JwtConfig {
  readonly algorithm: SecurityAlgorithm;
  readonly issuer: string;
  readonly audience: string | readonly string[];
  readonly accessTokenExpiry: number; // milliseconds
  readonly refreshTokenExpiry: number; // milliseconds
  readonly secretKey: string; // For HMAC algorithms
  readonly privateKey?: string; // For RSA/ECDSA algorithms
  readonly publicKey?: string; // For verification
  readonly keyId?: string; // Key identifier for key rotation
}

/**
 * Authentication request interface
 */
export interface AuthenticationRequest {
  readonly method: AuthenticationMethod;
  readonly credentials: AuthenticationCredentials;
  readonly context: SecurityContext;
  readonly options?: AuthenticationOptions;
}

/**
 * Authentication credentials union type
 */
export type AuthenticationCredentials =
  | PasswordCredentials
  | TokenCredentials
  | BiometricCredentials
  | CertificateCredentials
  | OAuthCredentials
  | SamlCredentials;

/**
 * Password-based credentials
 */
export interface PasswordCredentials {
  readonly type: 'password';
  readonly username: string;
  readonly password: string;
  readonly mfaCode?: string;
  readonly rememberDevice?: boolean;
}

/**
 * Token-based credentials
 */
export interface TokenCredentials {
  readonly type: 'token';
  readonly token: SecurityToken;
  readonly tokenType: 'bearer' | 'api_key' | 'jwt';
}

/**
 * Biometric credentials
 */
export interface BiometricCredentials {
  readonly type: 'biometric';
  readonly biometricType: 'fingerprint' | 'face' | 'voice' | 'iris';
  readonly biometricData: string; // Base64-encoded biometric template
  readonly challengeResponse?: string;
}

/**
 * Certificate-based credentials
 */
export interface CertificateCredentials {
  readonly type: 'certificate';
  readonly certificate: string; // PEM-encoded certificate
  readonly privateKey?: string; // PEM-encoded private key
  readonly passphrase?: string;
}

/**
 * OAuth credentials
 */
export interface OAuthCredentials {
  readonly type: 'oauth';
  readonly grantType: OAuthGrantType;
  readonly code?: string; // For authorization code grant
  readonly refreshToken?: string; // For refresh token grant
  readonly clientId: string;
  readonly clientSecret?: string;
  readonly redirectUri?: string;
  readonly scope?: readonly OAuthScope[];
  readonly state?: string;
  readonly codeVerifier?: string; // For PKCE
}

/**
 * SAML credentials
 */
export interface SamlCredentials {
  readonly type: 'saml';
  readonly assertion: string; // Base64-encoded SAML assertion
  readonly relayState?: string;
  readonly sigAlg?: string;
  readonly signature?: string;
}

/**
 * Authentication options
 */
export interface AuthenticationOptions {
  readonly sessionDuration?: number;
  readonly extendSession?: boolean;
  readonly requireMfa?: boolean;
  readonly allowedMfaMethods?: readonly MfaMethodType[];
  readonly riskAssessment?: boolean;
  readonly deviceTrustCheck?: boolean;
  readonly locationCheck?: boolean;
  readonly rememberDevice?: boolean;
  readonly singleSignOn?: boolean;
}

/**
 * Authentication result
 */
export interface AuthenticationResult extends SecurityResult<AuthenticationData> {
  readonly authenticated: boolean;
  readonly requiresMfa?: boolean;
  readonly availableMfaMethods?: readonly MfaMethod[];
  readonly riskAssessment?: RiskAssessment;
  readonly deviceTrust?: DeviceTrustResult;
}

/**
 * Authentication data
 */
export interface AuthenticationData {
  readonly user: User;
  readonly session: AuthenticationSession;
  readonly tokens: AuthenticationTokens;
  readonly mfaVerified: boolean;
  readonly deviceTrusted: boolean;
  readonly riskScore: number;
}

/**
 * Authentication session
 */
export interface AuthenticationSession {
  readonly id: SecurityId;
  readonly userId: SecurityId;
  readonly createdAt: SecurityTimestamp;
  readonly expiresAt: SecurityTimestamp;
  readonly lastActivity: SecurityTimestamp;
  readonly device: DeviceFingerprint;
  readonly network: NetworkContext;
  readonly mfaVerified: boolean;
  readonly riskScore: number;
  readonly metadata?: SessionMetadata;
}

/**
 * Session metadata
 */
export interface SessionMetadata {
  readonly authMethod: AuthenticationMethod;
  readonly mfaMethods?: readonly MfaMethodType[];
  readonly grantedPermissions: readonly string[];
  readonly customAttributes?: Record<string, unknown>;
}

/**
 * Authentication tokens
 */
export interface AuthenticationTokens {
  readonly accessToken: SecurityToken;
  readonly refreshToken?: SecurityToken;
  readonly idToken?: SecurityToken;
  readonly tokenType: 'Bearer';
  readonly expiresIn: number;
  readonly scope?: readonly string[];
}

/**
 * Risk assessment result
 */
export interface RiskAssessment {
  readonly score: number; // 0-1 risk score
  readonly level: RiskLevel;
  readonly factors: readonly RiskFactor[];
  readonly recommendations: readonly string[];
  readonly requiresAdditionalAuth: boolean;
}

/**
 * Risk level classification
 */
export enum RiskLevel {
  VERY_LOW = 'very_low',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high'
}

/**
 * Risk factors for authentication
 */
export interface RiskFactor {
  readonly type: RiskFactorType;
  readonly weight: number; // 0-1
  readonly description: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Risk factor types
 */
export enum RiskFactorType {
  UNKNOWN_DEVICE = 'unknown_device',
  UNUSUAL_LOCATION = 'unusual_location',
  UNUSUAL_TIME = 'unusual_time',
  MULTIPLE_FAILED_ATTEMPTS = 'multiple_failed_attempts',
  CONCURRENT_SESSIONS = 'concurrent_sessions',
  TOR_EXIT_NODE = 'tor_exit_node',
  KNOWN_MALICIOUS_IP = 'known_malicious_ip',
  VELOCITY_CHECK_FAILED = 'velocity_check_failed',
  PASSWORD_COMPROMISE = 'password_compromise',
  ACCOUNT_SHARING = 'account_sharing'
}

/**
 * Device trust result
 */
export interface DeviceTrustResult {
  readonly trusted: boolean;
  readonly score: number; // 0-1 trust score
  readonly factors: readonly TrustFactor[];
  readonly requiresVerification: boolean;
}

/**
 * Trust factors for device assessment
 */
export interface TrustFactor {
  readonly type: TrustFactorType;
  readonly weight: number; // 0-1
  readonly description: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Trust factor types
 */
export enum TrustFactorType {
  DEVICE_REGISTERED = 'device_registered',
  RECENT_USAGE = 'recent_usage',
  CONSISTENT_FINGERPRINT = 'consistent_fingerprint',
  CERTIFICATE_PRESENT = 'certificate_present',
  SECURITY_SOFTWARE = 'security_software',
  JAILBREAK_DETECTED = 'jailbreak_detected',
  MALWARE_DETECTED = 'malware_detected',
  SUSPICIOUS_BEHAVIOR = 'suspicious_behavior'
}

/**
 * MFA challenge request
 */
export interface MfaChallengeRequest {
  readonly sessionId: SecurityId;
  readonly method: MfaMethodType;
  readonly context: SecurityContext;
}

/**
 * MFA challenge response
 */
export interface MfaChallengeResponse extends SecurityResult<MfaChallengeData> {
  readonly challengeId: SecurityId;
  readonly expiresAt: SecurityTimestamp;
  readonly attemptsRemaining: number;
}

/**
 * MFA challenge data
 */
export interface MfaChallengeData {
  readonly challenge: string; // QR code, SMS content, etc.
  readonly deliveryMethod?: 'sms' | 'email' | 'push' | 'display';
  readonly maskedTarget?: string; // Masked phone/email for user reference
}

/**
 * MFA verification request
 */
export interface MfaVerificationRequest {
  readonly challengeId: SecurityId;
  readonly code: string;
  readonly context: SecurityContext;
}

/**
 * MFA verification result
 */
export interface MfaVerificationResult extends SecurityResult<MfaVerificationData> {
  readonly verified: boolean;
  readonly attemptsRemaining: number;
}

/**
 * MFA verification data
 */
export interface MfaVerificationData {
  readonly method: MfaMethodType;
  readonly timestamp: SecurityTimestamp;
  readonly backupCodeUsed?: boolean;
}

/**
 * Password strength assessment
 */
export interface PasswordStrengthResult {
  readonly score: number; // 0-100
  readonly strength: PasswordStrength;
  readonly entropy: number;
  readonly estimatedCrackTime: string;
  readonly feedback: readonly string[];
  readonly policyCompliant: boolean;
  readonly violations: readonly string[];
}

/**
 * Password strength levels
 */
export enum PasswordStrength {
  VERY_WEAK = 'very_weak',
  WEAK = 'weak',
  MODERATE = 'moderate',
  STRONG = 'strong',
  VERY_STRONG = 'very_strong'
}

/**
 * Single Sign-On (SSO) configuration
 */
export interface SsoConfig {
  readonly enabled: boolean;
  readonly provider: SsoProvider;
  readonly clientId: string;
  readonly clientSecret?: string;
  readonly redirectUri: string;
  readonly scope: readonly string[];
  readonly endpoints: SsoEndpoints;
  readonly metadata?: Record<string, unknown>;
}

/**
 * SSO providers
 */
export enum SsoProvider {
  GOOGLE = 'google',
  MICROSOFT = 'microsoft',
  OKTA = 'okta',
  AUTH0 = 'auth0',
  SALESFORCE = 'salesforce',
  GITHUB = 'github',
  GITLAB = 'gitlab',
  LINKEDIN = 'linkedin',
  FACEBOOK = 'facebook',
  TWITTER = 'twitter',
  CUSTOM_OAUTH = 'custom_oauth',
  CUSTOM_SAML = 'custom_saml'
}

/**
 * SSO endpoints configuration
 */
export interface SsoEndpoints {
  readonly authorization: string;
  readonly token: string;
  readonly userInfo?: string;
  readonly jwks?: string;
  readonly logout?: string;
}

/**
 * Account lockout policy
 */
export interface AccountLockoutPolicy {
  readonly enabled: boolean;
  readonly maxFailedAttempts: number;
  readonly lockoutDuration: number; // milliseconds
  readonly resetInterval: number; // milliseconds
  readonly progressiveLockout: boolean;
  readonly notifyUser: boolean;
  readonly notifyAdmins: boolean;
}

/**
 * Session management configuration
 */
export interface SessionConfig {
  readonly timeout: number; // milliseconds
  readonly extendOnActivity: boolean;
  readonly maxConcurrentSessions: number;
  readonly requireReauthForSensitive: boolean;
  readonly cookieName: string;
  readonly cookieSecure: boolean;
  readonly cookieHttpOnly: boolean;
  readonly cookieSameSite: 'strict' | 'lax' | 'none';
}

/**
 * Authentication event types
 */
export enum AuthenticationEventType {
  LOGIN_ATTEMPT = 'login_attempt',
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILURE = 'login_failure',
  LOGOUT = 'logout',
  MFA_CHALLENGE_SENT = 'mfa_challenge_sent',
  MFA_VERIFICATION_SUCCESS = 'mfa_verification_success',
  MFA_VERIFICATION_FAILURE = 'mfa_verification_failure',
  PASSWORD_CHANGED = 'password_changed',
  ACCOUNT_LOCKED = 'account_locked',
  ACCOUNT_UNLOCKED = 'account_unlocked',
  SESSION_CREATED = 'session_created',
  SESSION_EXTENDED = 'session_extended',
  SESSION_EXPIRED = 'session_expired',
  DEVICE_REGISTERED = 'device_registered',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity'
}

/**
 * Type guards for authentication types
 */
export const isUser = (value: unknown): value is User => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'username' in value &&
    'email' in value &&
    'status' in value &&
    typeof (value as User).id === 'string' &&
    typeof (value as User).username === 'string' &&
    typeof (value as User).email === 'string'
  );
};

export const isJwtPayload = (value: unknown): value is JwtPayload => {
  return (
    typeof value === 'object' &&
    value !== null &&
    ('sub' in value || 'userId' in value)
  );
};

export const isAuthenticationResult = (value: unknown): value is AuthenticationResult => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'authenticated' in value &&
    'success' in value &&
    typeof (value as AuthenticationResult).authenticated === 'boolean' &&
    typeof (value as AuthenticationResult).success === 'boolean'
  );
};

export const isMfaMethod = (value: unknown): value is MfaMethod => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'type' in value &&
    'enabled' in value &&
    typeof (value as MfaMethod).id === 'string' &&
    Object.values(MfaMethodType).includes((value as MfaMethod).type)
  );
};

/**
 * Utility functions for authentication
 */
export const createAuthenticationContext = (
  baseContext: SecurityContext,
  method: AuthenticationMethod,
  device?: DeviceFingerprint
): SecurityContext => ({
  ...baseContext,
  metadata: {
    ...baseContext.metadata,
    authMethod: method,
    device
  }
});

export const calculatePasswordStrength = (password: string): PasswordStrengthResult => {
  // Implementation would calculate actual password strength
  // This is a simplified example
  let score = 0;
  const feedback: string[] = [];
  const violations: string[] = [];

  if (password.length >= 12) score += 25;
  else violations.push('Password must be at least 12 characters long');

  if (/[A-Z]/.test(password)) score += 15;
  else violations.push('Password must contain uppercase letters');

  if (/[a-z]/.test(password)) score += 15;
  else violations.push('Password must contain lowercase letters');

  if (/\d/.test(password)) score += 15;
  else violations.push('Password must contain numbers');

  if (/[^A-Za-z0-9]/.test(password)) score += 15;
  else violations.push('Password must contain special characters');

  if (password.length > 20) score += 15;

  let strength: PasswordStrength;
  if (score >= 90) strength = PasswordStrength.VERY_STRONG;
  else if (score >= 70) strength = PasswordStrength.STRONG;
  else if (score >= 50) strength = PasswordStrength.MODERATE;
  else if (score >= 30) strength = PasswordStrength.WEAK;
  else strength = PasswordStrength.VERY_WEAK;

  return {
    score,
    strength,
    entropy: Math.log2(Math.pow(95, password.length)), // Simplified entropy calculation
    estimatedCrackTime: score > 70 ? 'centuries' : score > 50 ? 'years' : 'days',
    feedback,
    policyCompliant: violations.length === 0,
    violations
  };
};

export const generateSecureSessionId = (): SecurityId => {
  return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
};

export const createJwtPayload = (
  user: User,
  sessionId: SecurityId,
  config: JwtConfig,
  mfaVerified: boolean = false
): JwtPayload => {
  const now = Math.floor(Date.now() / 1000);

  return {
    iss: config.issuer,
    sub: user.id,
    aud: config.audience,
    iat: now,
    exp: now + Math.floor(config.accessTokenExpiry / 1000),
    jti: `jwt_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
    userId: user.id,
    sessionId,
    email: user.email,
    roles: user.roles,
    permissions: user.permissions,
    mfaVerified
  };
};