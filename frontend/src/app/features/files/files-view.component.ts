import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FileApiService } from '../../core/http/file-api.service';
import { ToastService } from '../../core/services/toast.service';
import { FileItem } from '../../core/models/notification.model';
import { FileSizePipe, TimeAgoPipe } from '../../shared/pipes/time-ago.pipe';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-files-view',
  standalone: true,
  imports: [CommonModule, FileSizePipe, TimeAgoPipe, LoadingStateComponent, EmptyStateComponent],
  template: `
    <div class="flex-1 flex flex-col h-full w-full bg-slate-950 overflow-hidden">
      <!-- HEADER -->
      <header class="h-14 border-b border-slate-800 bg-slate-900/60 backdrop-blur-xs flex items-center justify-between px-6 shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
            <span class="material-icons-round text-lg">folder_shared</span>
          </div>
          <div>
            <h2 class="text-sm font-bold text-slate-100">Archivos & Documentos Compartidos</h2>
            <p class="text-[11px] text-slate-400">Repositorio central de adjuntos, diagramas y recursos del workspace</p>
          </div>
        </div>

        <label class="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer">
          <span class="material-icons-round text-sm">upload_file</span>
          <span>Subir Archivo</span>
          <input type="file" (change)="onFileSelected($event)" class="hidden" />
        </label>
      </header>

      <!-- FILES CONTENT -->
      <div class="flex-1 overflow-y-auto p-6 space-y-4">
        <app-loading-state *ngIf="isLoading()" message="Cargando archivos del workspace..."></app-loading-state>

        <app-empty-state
          *ngIf="!isLoading() && files().length === 0"
          icon="description"
          title="No hay archivos todavía"
          description="Sube o comparte documentos, imágenes o archivos en los canales de discusión."
        ></app-empty-state>

        <!-- Files Table / Grid -->
        <div *ngIf="!isLoading() && files().length > 0" class="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-xs">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-900/80">
                <th class="py-3 px-4">Nombre del Archivo</th>
                <th class="py-3 px-4">Subido por</th>
                <th class="py-3 px-4">Tamaño</th>
                <th class="py-3 px-4">Fecha</th>
                <th class="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800 text-xs text-slate-300">
              <tr *ngFor="let file of files()" class="hover:bg-slate-800/40 transition-colors">
                <td class="py-3 px-4 flex items-center gap-3">
                  <span class="material-icons-round text-lg text-indigo-400">{{ getFileIcon(file.mimeType) }}</span>
                  <span class="font-medium text-slate-200 truncate max-w-xs">{{ file.name }}</span>
                </td>
                <td class="py-3 px-4 text-slate-400">{{ file.uploadedByName }}</td>
                <td class="py-3 px-4 font-mono text-[11px]">{{ file.size | fileSize }}</td>
                <td class="py-3 px-4 font-mono text-[11px] text-slate-400">{{ file.uploadedAt | timeAgo }}</td>
                <td class="py-3 px-4 text-right space-x-2">
                  <a
                    [href]="file.url"
                    target="_blank"
                    download
                    class="p-1 text-slate-400 hover:text-indigo-400 transition-colors"
                    title="Descargar archivo"
                  >
                    <span class="material-icons-round text-sm">download</span>
                  </a>
                  <button
                    (click)="deleteFile(file.id)"
                    class="p-1 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                    title="Eliminar"
                  >
                    <span class="material-icons-round text-sm">delete</span>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class FilesViewComponent implements OnInit {
  public files = signal<FileItem[]>([]);
  public isLoading = signal<boolean>(true);

  constructor(
    private fileApi: FileApiService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadFiles();
  }

  loadFiles(): void {
    this.isLoading.set(true);
    this.fileApi.getFiles().subscribe({
      next: data => {
        this.files.set(data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  onFileSelected(event: any): void {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    this.fileApi.uploadFile(formData).subscribe({
      next: uploaded => {
        this.files.update(list => [uploaded, ...list]);
        this.toastService.success(`Archivo ${file.name} subido con éxito.`);
      },
      error: () => this.toastService.error('Error al subir el archivo.')
    });
  }

  deleteFile(id: string): void {
    this.fileApi.deleteFile(id).subscribe({
      next: () => {
        this.files.update(list => list.filter(f => f.id !== id));
        this.toastService.success('Archivo eliminado.');
      },
      error: () => this.toastService.error('Error al eliminar archivo.')
    });
  }

  getFileIcon(mimeType: string): string {
    if (mimeType.includes('image')) return 'image';
    if (mimeType.includes('pdf')) return 'picture_as_pdf';
    if (mimeType.includes('zip') || mimeType.includes('compressed')) return 'folder_zip';
    if (mimeType.includes('audio')) return 'audio_file';
    if (mimeType.includes('video')) return 'video_file';
    return 'insert_drive_file';
  }
}
