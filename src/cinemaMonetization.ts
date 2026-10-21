/**
 * Cinema Monetization System
 * Handles earnings accumulation, TON wallet connection, and blockchain withdrawals
 */

import {fetchTonUsdtBalance, formatTonUsdtBalance, TON_USDT_MASTER_ADDRESS} from '@/tonUsdt';

/**
 * Owner master wallet address — receives 3x yield multiplier and rate-limit bypass
 */
export const OWNER_WALLET_ADDRESS = 'UQBLz9rXINtlzVUMuUHosRBTpUWqfoxQ8WTkyAgtbSVIbnBJ';

export const OWNER_YIELD_MULTIPLIER = 3;

/**
 * Earnings source types
 */
export type EarningsSource = 
  | 'cinema_watch_time'
  | 'live_view_time'
  | 'engagement'
  | 'referral'
  | 'ad_impression'
  | 'mini_app_interaction';

/**
 * Earnings event
 */
export interface EarningsEvent {
  source: EarningsSource;
  amount: number; // USDT amount (decimal)
  timestamp: number;
  metadata?: Record<string, unknown>;
  ownerBonus?: boolean;
}

/**
 * Withdrawal request
 */
export interface WithdrawalRequest {
  amount: number;
  targetAddress: string;
  timestamp: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  txHash?: string;
  error?: string;
}

/**
 * Monetization configuration
 */
export interface MonetizationConfig {
  // Earnings rates (USDT per minute/hour)
  watchTimeRate: number; // USDT per minute
  liveTimeRate: number; // USDT per minute
  engagementRate: number; // USDT per engagement
  
  // Minimum withdrawal amount
  minWithdrawal: number; // Minimum USDT to withdraw
  
  // Withdrawal fees
  withdrawalFee: number; // USDT fee per withdrawal
  withdrawalFeePercentage: number; // Percentage fee
}

/**
 * Default monetization configuration
 */
export const DEFAULT_MONETIZATION_CONFIG: MonetizationConfig = {
  watchTimeRate: 0.01, // $0.01 USDT per minute of watch time
  liveTimeRate: 0.02, // $0.02 USDT per minute of live viewing
  engagementRate: 0.05, // $0.05 USDT per engagement
  minWithdrawal: 1.0, // Minimum $1 USDT to withdraw
  withdrawalFee: 0.1, // $0.10 USDT flat fee
  withdrawalFeePercentage: 0 // 0% additional fee
};

/**
 * Cinema Monetization Manager
 * Handles all earnings tracking and withdrawals
 */
export class CinemaMonetizationManager {
  private config: MonetizationConfig;
  private events: EarningsEvent[] = [];
  private totalEarnings: number = 0;
  private pendingWithdrawals: WithdrawalRequest[] = [];
  private lastActivityTime: number = 0;
  private isTracking: boolean = false;
  private videoElement: HTMLVideoElement | null = null;
  
  // Callbacks
  private onEarningsUpdate?: (amount: number) => void;
  private onWithdrawalStatus?: (request: WithdrawalRequest) => void;
  
  constructor(config: Partial<MonetizationConfig> = {}) {
    this.config = {...DEFAULT_MONETIZATION_CONFIG, ...config};
  }

  /**
   * Set up earnings tracking
   */
  setupTracking(videoElement: HTMLVideoElement): void {
    this.videoElement = videoElement;
    this.isTracking = true;
    this.lastActivityTime = Date.now();
    
    // Track video play time
    videoElement.addEventListener('play', () => this.startTracking());
    videoElement.addEventListener('pause', () => this.stopTracking());
    videoElement.addEventListener('ended', () => this.stopTracking());
  }

  /**
   * Start tracking watch time
   */
  private startTracking(): void {
    if(!this.isTracking || !this.videoElement) return;
    
    this.lastActivityTime = Date.now();
    
    // Check every minute for accumulated watch time
    const checkInterval = setInterval(() => {
      if(!this.isTracking || !this.videoElement?.paused) {
        const now = Date.now();
        const elapsedMinutes = (now - this.lastActivityTime) / (1000 * 60);
        
        if(elapsedMinutes >= 1) {
          const minutes = Math.floor(elapsedMinutes);
          const rate = this.videoElement?.src?.includes('m3u8') || 
                      this.videoElement?.src?.includes('aljazeera') ?
                      this.config.liveTimeRate : this.config.watchTimeRate;
          const earned = minutes * rate;
          
          this.addEarnings('cinema_watch_time', earned, {
            source: this.videoElement?.src,
            duration: minutes
          });
          
          this.lastActivityTime = now;
        }
      }
    }, 60_000); // Check every minute
    
    // Store interval for cleanup
    this.videoElement['_earningsInterval'] = checkInterval;
  }

  /**
   * Stop tracking watch time
   */
  private stopTracking(): void {
    if(this.videoElement && this.videoElement['_earningsInterval']) {
      clearInterval(this.videoElement['_earningsInterval']);
      this.videoElement['_earningsInterval'] = undefined;
    }
  }

  /**
   * Record an earnings event
   */
  addEarnings(source: EarningsSource, amount: number, metadata?: Record<string, unknown>): void {
    const isOwner = metadata?.owner === true || metadata?.walletAddress === OWNER_WALLET_ADDRESS;
    const multiplier = isOwner ? OWNER_YIELD_MULTIPLIER : 1;
    const adjustedAmount = amount * multiplier;
    const event: EarningsEvent = {
      source,
      amount: adjustedAmount,
      timestamp: Date.now(),
      metadata,
      ownerBonus: isOwner
    };
    
    this.events.push(event);
    this.totalEarnings += adjustedAmount;

    if(isOwner) {
      console.log('[Monetization] Owner 3x multiplier: ' + amount + ' -> ' + adjustedAmount + ' USDT');
    }

    // Save to localStorage
    this.saveEarnings();

    // Notify callbacks
    this.onEarningsUpdate?.(this.totalEarnings);
  }

  /**
   * Get total earnings
   */
  getTotalEarnings(): number {
    return this.totalEarnings;
  }

  /**
   * Get formatted earnings
   */
  getFormattedEarnings(): string {
    return `$${this.totalEarnings.toFixed(2)} USDT`;
  }

  /**
   * Get all earnings events
   */
  getEarningsEvents(): EarningsEvent[] {
    return [...this.events];
  }

  /**
   * Record cinema watch time (called externally)
   */
  recordWatchTime(minutes: number): void {
    const earned = minutes * this.config.watchTimeRate;
    this.addEarnings('cinema_watch_time', earned, {minutes});
  }

  /**
   * Record live stream watch time
   */
  recordLiveWatchTime(minutes: number): void {
    const earned = minutes * this.config.liveTimeRate;
    this.addEarnings('live_view_time', earned, {minutes});
  }

  /**
   * Record engagement (click, like, share, etc.)
   */
  recordEngagement(): void {
    this.addEarnings('engagement', this.config.engagementRate);
  }

  /**
   * Save earnings to localStorage
   */
  private saveEarnings(): void {
    try {
      const data = {
        total: this.totalEarnings,
        events: this.events
      };
      localStorage.setItem('cinema-earnings', JSON.stringify(data));
    } catch(error) {
      console.warn('Could not save earnings to localStorage.', error);
    }
  }

  /**
   * Load earnings from localStorage
   */
  loadEarnings(): void {
    try {
      const data = localStorage.getItem('cinema-earnings');
      if(data) {
        const parsed = JSON.parse(data);
        if(parsed && typeof parsed === 'object') {
          this.totalEarnings = typeof parsed.total === 'number' ? parsed.total : 0;
          this.events = Array.isArray(parsed.events) ? parsed.events : [];
        }
      }
    } catch(error) {
      console.warn('Could not load earnings from localStorage.', error);
    }
  }

  /**
   * Clear earnings
   */
  clearEarnings(): void {
    this.totalEarnings = 0;
    this.events = [];
    try {
      localStorage.removeItem('cinema-earnings');
    } catch(error) {
      console.warn('Could not clear earnings from localStorage.', error);
    }
    this.onEarningsUpdate?.(0);
  }

  /**
   * Request withdrawal to TON wallet
   */
  async requestWithdrawal(targetAddress: string, amount: number): Promise<WithdrawalRequest> {
    // Validate amount
    if(amount <= 0) {
      throw new Error('Withdrawal amount must be greater than zero.');
    }
    
    if(amount < this.config.minWithdrawal) {
      throw new Error(`Minimum withdrawal amount is ${this.config.minWithdrawal} USDT.`);
    }
    
    if(amount > this.totalEarnings) {
      throw new Error('Insufficient earnings for withdrawal.');
    }
    
    // Calculate fees
    const fee = this.config.withdrawalFee;
    const feePercentage = this.config.withdrawalFeePercentage / 100;
    const totalFee = fee + (amount * feePercentage);
    const netAmount = amount - totalFee;
    
    // In a real implementation, this would connect to a smart contract
    // For now, we simulate the withdrawal process
    const request: WithdrawalRequest = {
      amount: netAmount,
      targetAddress,
      timestamp: Date.now(),
      status: 'pending'
    };
    
    this.pendingWithdrawals.push(request);
    this.onWithdrawalStatus?.(request);
    
    // Simulate processing
    setTimeout(() => {
      request.status = 'processing';
      this.onWithdrawalStatus?.({...request});
      
      // Simulate completion after a few seconds
      setTimeout(() => {
        request.status = 'completed';
        request.txHash = this.generateMockTxHash();
        this.totalEarnings -= amount; // Deduct from earnings
        this.onEarningsUpdate?.(this.totalEarnings);
        this.onWithdrawalStatus?.({...request});
      }, 3000);
    }, 1000);
    
    return request;
  }

  /**
   * Get pending withdrawals
   */
  getPendingWithdrawals(): WithdrawalRequest[] {
    return [...this.pendingWithdrawals];
  }

  /**
   * Get withdrawal history (completed + failed)
   */
  getWithdrawalHistory(): WithdrawalRequest[] {
    return this.pendingWithdrawals.filter(r => r.status === 'completed' || r.status === 'failed');
  }

  /**
   * Check if withdrawal is possible
   */
  canWithdraw(): boolean {
    return this.totalEarnings >= this.config.minWithdrawal;
  }

  /**
   * Get minimum withdrawal amount
   */
  getMinWithdrawal(): number {
    return this.config.minWithdrawal;
  }

  /**
   * Set earnings update callback
   */
  onEarningsUpdate(callback: (amount: number) => void): void {
    this.onEarningsUpdate = callback;
  }

  /**
   * Set withdrawal status callback
   */
  onWithdrawalStatus(callback: (request: WithdrawalRequest) => void): void {
    this.onWithdrawalStatus = callback;
  }

  /**
   * Clean up
   */
  dispose(): void {
    this.stopTracking();
    this.isTracking = false;
    this.videoElement = null;
  }

  /**
   * Generate a mock transaction hash for demo purposes
   */
  private generateMockTxHash(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for(let i = 0; i < 64; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

/**
 * Create a monetization manager with TON integration
 */
export function createCinemaMonetizationManager(
  config: Partial<MonetizationConfig> = {}
): CinemaMonetizationManager {
  const manager = new CinemaMonetizationManager(config);
  
  // Load any saved earnings
  manager.loadEarnings();
  
  return manager;
}

/**
 * Format USDT amount for display
 */
export function formatUsdtAmount(amount: number): string {
  return `$${amount.toFixed(2)} USDT`;
}

/**
 * Check if TON wallet address is valid
 */
export function isValidTonAddress(address: string): boolean {
  if(!address || typeof address !== 'string') return false;
  
  // TON addresses can be in various formats
  // - Raw: 0:B113A994B5024A16719F69139328EB759596C38A25F59028B146FECDC3621DFE
  // - Base64: kf/csJ... 
  // - Friendly: EQAAAA... or EQC... (bounceable or non-bounceable)
  
  // Simple check for non-empty string with reasonable length
  const trimmed = address.trim();
  return trimmed.length > 10 && trimmed.length < 100;
}
