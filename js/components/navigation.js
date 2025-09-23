/**
 * Navigation Component
 * Handles mobile menu toggle and navigation interactions
 */

class Navigation {
  constructor() {
    this.mobileToggle = document.querySelector('.mobile-toggle');
    this.navMenu = document.querySelector('.nav-menu');
    this.navLinks = document.querySelectorAll('.nav-menu a');
    
    if (this.mobileToggle && this.navMenu) {
      this.init();
    }
  }

  init() {
    // Mobile menu toggle
    this.mobileToggle.addEventListener('click', () => {
      this.navMenu.classList.toggle('active');
    });

    // Close mobile menu when link is clicked
    this.navLinks.forEach(link => {
      link.addEventListener('click', () => {
        this.navMenu.classList.remove('active');
      });
    });
  }
}

// Initialize navigation when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new Navigation());
} else {
  new Navigation();
}

export default Navigation;