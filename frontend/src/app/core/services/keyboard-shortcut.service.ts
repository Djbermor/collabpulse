import { Injectable, NgZone } from '@angular/core';
import { Subject } from 'rxjs';

export type ShortcutAction =
  | 'open_search'
  | 'open_messages'
  | 'open_tasks'
  | 'close_modal'
  | 'toggle_sidebar';

@Injectable({
  providedIn: 'root'
})
export class KeyboardShortcutService {
  private shortcutSubject = new Subject<ShortcutAction>();
  public shortcut$ = this.shortcutSubject.asObservable();

  constructor(private ngZone: NgZone) {
    this.initGlobalListener();
  }

  private initGlobalListener(): void {
    window.addEventListener('keydown', (event: KeyboardEvent) => {
      const isMetaOrCtrl = event.metaKey || event.ctrlKey;

      // Ctrl / Cmd + K -> Search
      if (isMetaOrCtrl && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        this.trigger('open_search');
      }

      // Ctrl / Cmd + Shift + M -> Messages
      if (isMetaOrCtrl && event.shiftKey && event.key.toLowerCase() === 'm') {
        event.preventDefault();
        this.trigger('open_messages');
      }

      // Ctrl / Cmd + Shift + T -> Tasks
      if (isMetaOrCtrl && event.shiftKey && event.key.toLowerCase() === 't') {
        event.preventDefault();
        this.trigger('open_tasks');
      }

      // Esc -> Close active modal / overlay
      if (event.key === 'Escape') {
        this.trigger('close_modal');
      }
    });
  }

  private trigger(action: ShortcutAction): void {
    this.ngZone.run(() => {
      this.shortcutSubject.next(action);
    });
  }
}
