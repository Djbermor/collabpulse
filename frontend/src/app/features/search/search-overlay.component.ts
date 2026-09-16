import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { SearchApiService, GlobalSearchResult } from '../../core/http/search-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';

@Component({
  selector: 'app-search-overlay',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AvatarComponent],
  template: `
    <div class="flex-1 flex flex-col h-full w-full bg-slate-950 overflow-hidden">
      <!-- SEARCH HEADER INPUT -->
      <div class="p-6 border-b border-slate-800 bg-slate-900/60 backdrop-blur-xs">
        <div class="max-w-3xl mx-auto space-y-4">
          <div class="relative">
            <span class="material-icons-round absolute left-3 top-3 text-slate-400 text-lg">search</span>
            <input
              type="text"
              [(ngModel)]="searchQuery"
              (input)="onSearchInput()"
              placeholder="Buscar por palabra clave, remitente, canal o tarea..."
              autofocus
              class="w-full h-11 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-10 pr-4 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden transition-colors shadow-inner"
            />
            <button
              *ngIf="searchQuery"
              (click)="clearSearch()"
              class="absolute right-3 top-3 text-slate-500 hover:text-slate-300"
            >
              <span class="material-icons-round text-base">close</span>
            </button>
          </div>

          <!-- Type filter tabs -->
          <div class="flex items-center gap-2">
            <button
              *ngFor="let tab of filterTabs"
              (click)="activeTab = tab.id; onSearchInput()"
              class="px-3 py-1 text-xs rounded-lg transition-colors cursor-pointer"
              [ngClass]="activeTab === tab.id ? 'bg-indigo-600 text-white font-medium' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'"
            >
              {{ tab.label }}
            </button>
          </div>
        </div>
      </div>

      <!-- RESULTS AREA -->
      <div class="flex-1 overflow-y-auto p-6">
        <div class="max-w-3xl mx-auto space-y-6">
          <div *ngIf="isSearching()" class="text-center py-12 text-slate-400 text-xs">
            Buscando en todos los canales y recursos...
          </div>

          <div *ngIf="!isSearching() && !hasResults() && searchQuery" class="text-center py-12 space-y-2">
            <span class="material-icons-round text-3xl text-slate-600">search_off</span>
            <p class="text-xs text-slate-400">No se encontraron resultados para "{{ searchQuery }}".</p>
          </div>

          <!-- Channels Matches -->
          <div *ngIf="results().channels?.length > 0" class="space-y-2">
            <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider">Canales ({{ results().channels.length }})</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <a
                *ngFor="let ch of results().channels"
                [routerLink]="['/workspace', currentTenantId(), 'channels', ch.id]"
                class="p-3 bg-slate-900 border border-slate-800 hover:border-indigo-500/60 rounded-xl flex items-center gap-3 transition-colors"
              >
                <span class="text-indigo-400 font-mono text-sm">#</span>
                <div class="truncate">
                  <p class="text-xs font-semibold text-slate-200 truncate">{{ ch.name }}</p>
                  <p class="text-[10px] text-slate-500 truncate">{{ ch.topic || ch.description || 'Sin tema' }}</p>
                </div>
              </a>
            </div>
          </div>

          <!-- Messages Matches -->
          <div *ngIf="results().messages?.length > 0" class="space-y-2">
            <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider">Mensajes ({{ results().messages.length }})</h3>
            <div class="space-y-2">
              <div
                *ngFor="let msg of results().messages"
                class="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1.5"
              >
                <div class="flex items-center justify-between text-[11px]">
                  <span class="font-semibold text-slate-200">{{ msg.senderName }}</span>
                  <span class="text-slate-500 font-mono">{{ msg.createdAt | date:'short' }}</span>
                </div>
                <p class="text-xs text-slate-300">{{ msg.content }}</p>
              </div>
            </div>
          </div>

          <!-- Tasks Matches -->
          <div *ngIf="results().tasks?.length > 0" class="space-y-2">
            <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider">Tareas ({{ results().tasks.length }})</h3>
            <div class="space-y-2">
              <div
                *ngFor="let task of results().tasks"
                class="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between"
              >
                <span class="text-xs font-medium text-slate-200">{{ task.title }}</span>
                <span class="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-400">{{ task.status }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class SearchOverlayComponent implements OnInit {
  public currentTenantId = this.authService.activeTenantId;
  public searchQuery = '';
  public activeTab = 'all';
  public isSearching = signal(false);
  public results = signal<GlobalSearchResult>({
    messages: [],
    channels: [],
    people: [],
    files: [],
    tasks: []
  });

  public filterTabs = [
    { id: 'all', label: 'Todo' },
    { id: 'messages', label: 'Mensajes' },
    { id: 'channels', label: 'Canales' },
    { id: 'tasks', label: 'Tareas' }
  ];

  private debounceTimer: any;

  constructor(
    private searchApi: SearchApiService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {}

  onSearchInput(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    if (!this.searchQuery.trim()) {
      this.results.set({ messages: [], channels: [], people: [], files: [], tasks: [] });
      return;
    }

    this.debounceTimer = setTimeout(() => {
      this.executeSearch();
    }, 250);
  }

  executeSearch(): void {
    this.isSearching.set(true);
    const filterType = this.activeTab === 'all' ? undefined : this.activeTab;

    this.searchApi.search(this.searchQuery, { type: filterType }).subscribe({
      next: data => {
        this.results.set(data);
        this.isSearching.set(false);
      },
      error: () => this.isSearching.set(false)
    });
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.results.set({ messages: [], channels: [], people: [], files: [], tasks: [] });
  }

  hasResults(): boolean {
    const r = this.results();
    return (
      (r.messages?.length || 0) +
      (r.channels?.length || 0) +
      (r.people?.length || 0) +
      (r.files?.length || 0) +
      (r.tasks?.length || 0) > 0
    );
  }
}
