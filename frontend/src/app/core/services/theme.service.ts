import { Injectable, signal, effect } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly THEME_KEY = 'collabpulse_theme_preference';
  
  public currentTheme = signal<ThemeMode>(this.getInitialTheme());

  constructor() {
    // React to theme changes and apply to <html> attribute
    effect(() => {
      const mode = this.currentTheme();
      this.applyTheme(mode);
    });

    // Listen for OS system preference changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (this.currentTheme() === 'system') {
        document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      }
    });
  }

  public setTheme(mode: ThemeMode): void {
    this.currentTheme.set(mode);
    localStorage.setItem(this.THEME_KEY, mode);
  }

  public toggleTheme(): void {
    const next = this.currentTheme() === 'dark' ? 'light' : 'dark';
    this.setTheme(next);
  }

  private applyTheme(mode: ThemeMode): void {
    if (mode === 'system') {
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', systemPrefersDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', mode);
    }
  }

  private getInitialTheme(): ThemeMode {
    const saved = localStorage.getItem(this.THEME_KEY) as ThemeMode;
    return saved || 'dark';
  }
}
