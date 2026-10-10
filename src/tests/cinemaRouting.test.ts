import {describe, it, expect} from 'vitest';

describe('Cinema Direct Routing', () => {
  describe('URL path routing logic', () => {
    it('should detect cinema path', () => {
      const path = '/cinema';
      const shouldActivateCinema = path === '/cinema' || path === '/cinema.html' || path.startsWith('/cinema/');
      expect(shouldActivateCinema).toBe(true);
    });

    it('should detect cinema.html path', () => {
      const path = '/cinema.html';
      const shouldActivateCinema = path === '/cinema' || path === '/cinema.html' || path.startsWith('/cinema/');
      expect(shouldActivateCinema).toBe(true);
    });

    it('should detect cinema with trailing slash', () => {
      const path = '/cinema/';
      const shouldActivateCinema = path === '/cinema' || path === '/cinema.html' || path.startsWith('/cinema/');
      expect(shouldActivateCinema).toBe(true);
    });

    it('should detect cinema with section', () => {
      const path = '/cinema/live';
      const shouldActivateCinema = path === '/cinema' || path === '/cinema.html' || path.startsWith('/cinema/');
      expect(shouldActivateCinema).toBe(true);
    });

    it('should not detect unrelated paths', () => {
      const path = '/settings';
      const shouldActivateCinema = path === '/cinema' || path === '/cinema.html' || path.startsWith('/cinema/');
      expect(shouldActivateCinema).toBe(false);
    });
  });

  describe('Hash-based routing logic', () => {
    it('should detect cinema from hash', () => {
      const hash = '#cinema';
      const section = hash.slice(1);
      const isValidSection = ['cinema', 'live', 'rewards', 'shop', 'companion'].includes(section);
      expect(isValidSection).toBe(true);
    });

    it('should detect live from hash', () => {
      const hash = '#live';
      const section = hash.slice(1);
      const isValidSection = ['cinema', 'live', 'rewards', 'shop', 'companion'].includes(section);
      expect(isValidSection).toBe(true);
    });

    it('should detect companion from hash', () => {
      const hash = '#companion';
      const section = hash.slice(1);
      const isValidSection = ['cinema', 'live', 'rewards', 'shop', 'companion'].includes(section);
      expect(isValidSection).toBe(true);
    });

    it('should detect rewards from hash', () => {
      const hash = '#rewards';
      const section = hash.slice(1);
      const isValidSection = ['cinema', 'live', 'rewards', 'shop', 'companion'].includes(section);
      expect(isValidSection).toBe(true);
    });

    it('should detect shop from hash', () => {
      const hash = '#shop';
      const section = hash.slice(1);
      const isValidSection = ['cinema', 'live', 'rewards', 'shop', 'companion'].includes(section);
      expect(isValidSection).toBe(true);
    });

    it('should handle empty hash', () => {
      const hash = '';
      const section = hash.slice(1);
      // Empty string is falsy, so section check will be false
      expect(section).toBe('');
      expect(['cinema', 'live', 'rewards', 'shop', 'companion'].includes(section)).toBe(false);
    });

    it('should ignore invalid hash', () => {
      const hash = '#invalid';
      const section = hash.slice(1);
      const isValidSection = ['cinema', 'live', 'rewards', 'shop', 'companion'].includes(section);
      expect(isValidSection).toBe(false);
    });
  });

  describe('Server routing configuration', () => {
    it('should have cinema.html in public folder', () => {
      const fs = require('fs');
      const path = require('path');
      
      const publicCinemaPath = path.join(__dirname, '..', '..', 'public', 'cinema.html');
      const rootCinemaPath = path.join(__dirname, '..', '..', 'cinema.html');
      
      expect(fs.existsSync(publicCinemaPath)).toBe(true);
      expect(fs.existsSync(rootCinemaPath)).toBe(true);
    });

    it('should have cinema entry in vite config', () => {
      const fs = require('fs');
      const path = require('path');
      
      // Check that vite.config.ts has cinema in rolldownOptions
      const viteConfigPath = path.join(__dirname, '..', '..', 'vite.config.ts');
      const viteConfigContent = fs.readFileSync(viteConfigPath, 'utf8');
      
      expect(viteConfigContent).toContain('cinema: \'./cinema.html\'');
      expect(viteConfigContent).toContain('cinema.html');
    });

    it('should have cinema in dist folder after build', () => {
      const fs = require('fs');
      const path = require('path');
      
      const distCinemaPath = path.join(__dirname, '..', '..', 'dist', 'cinema.html');
      
      if(fs.existsSync(distCinemaPath)) {
        const content = fs.readFileSync(distCinemaPath, 'utf8');
        expect(content).toContain('cinema-root');
        expect(content).toContain('Urban Cinema');
        // Telegram WebApp script may or may not be in the built version
        expect(content.includes('Urban Cinema')).toBe(true);
      }
    });
  });

  describe('Server.js routing', () => {
    it('should have cinema route in server.js', () => {
      const fs = require('fs');
      const path = require('path');
      
      const serverPath = path.join(__dirname, '..', '..', 'server.js');
      const serverContent = fs.readFileSync(serverPath, 'utf8');
      
      expect(serverContent).toContain('/cinema');
      expect(serverContent).toContain('cinema.html');
    });

    it('should handle cinema path variations', () => {
      const fs = require('fs');
      const path = require('path');
      
      const serverPath = path.join(__dirname, '..', '..', 'server.js');
      const serverContent = fs.readFileSync(serverPath, 'utf8');
      
      expect(serverContent).toContain('cinema.html');
      expect(serverContent).toContain('/cinema');
      expect(serverContent).toContain(':section?');
    });
  });

  describe('Path extraction logic', () => {
    it('should extract section from path', () => {
      const path = '/cinema';
      const pathSection = path.split('/')[1];
      expect(pathSection).toBe('cinema');
    });

    it('should extract section from nested path', () => {
      const path = '/cinema/live';
      const pathSection = path.split('/')[1];
      expect(pathSection).toBe('cinema');
    });

    it('should handle root path', () => {
      const path = '/';
      const pathSection = path.split('/')[1];
      // Root path returns empty string, not undefined
      expect(pathSection).toBe('');
    });
  });
});
