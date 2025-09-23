/**
 * Main Leaderboard Application
 * Orchestrates all leaderboard modules and functionality
 */

import Navigation from './components/navigation.js';
import BattlingLeaderboard from './modules/battlingLeaderboard.js';
import SpeedrunningLeaderboard from './modules/speedrunningLeaderboard.js';

class LeaderboardApp {
  constructor() {
    this.modules = {};
  }

  async init() {
    try {
      // Initialize navigation
      this.modules.navigation = new Navigation();
      
      // Initialize Track 1: Battling Leaderboard
      this.modules.battling = new BattlingLeaderboard();
      await this.modules.battling.init();
      
      // Initialize Track 2: Speedrunning Leaderboard
      this.modules.speedrunning = new SpeedrunningLeaderboard();
      await this.modules.speedrunning.init();
      
      // Expose modules to global scope for legacy onclick handlers
      window.battlingLeaderboard = this.modules.battling;
      window.speedrunningLeaderboard = this.modules.speedrunning;
      
      console.log('Leaderboard application initialized successfully');
    } catch (error) {
      console.error('Error initializing leaderboard:', error);
    }
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const app = new LeaderboardApp();
    app.init();
  });
} else {
  const app = new LeaderboardApp();
  app.init();
}

// Export for global access if needed
window.LeaderboardApp = LeaderboardApp;