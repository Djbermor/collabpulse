import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MeetingApiService } from '../../core/http/meeting-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { Meeting } from '../../core/models/task.model';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';

@Component({
  selector: 'app-meeting-room',
  standalone: true,
  imports: [CommonModule, FormsModule, AvatarComponent],
  template: `
    <div class="flex-1 flex flex-col h-full w-full bg-slate-950 overflow-hidden">
      <!-- HEADER -->
      <header class="h-14 border-b border-slate-800 bg-slate-900/60 backdrop-blur-xs flex items-center justify-between px-6 shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
            <span class="material-icons-round text-lg">videocam</span>
          </div>
          <div>
            <h2 class="text-sm font-bold text-slate-100">Sala de Videollamadas & Reuniones</h2>
            <p class="text-[11px] text-slate-400">Salas virtuales WebRTC de baja latencia integradas al workspace</p>
          </div>
        </div>

        <button
          *ngIf="!activeRoom()"
          type="button"
          (click)="startInstantMeeting()"
          class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
        >
          <span class="material-icons-round text-sm">video_call</span>
          <span>Iniciar Reunión Rápida</span>
        </button>
      </header>

      <!-- ACTIVE MEETING STAGE -->
      <div *ngIf="activeRoom()" class="flex-1 flex flex-col p-4 space-y-4">
        <!-- Video Grid Area -->
        <div class="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-900/40 border border-slate-800 rounded-2xl p-4 overflow-hidden">
          <!-- Main User Tile -->
          <div class="relative bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex items-center justify-center">
            <div *ngIf="!isCameraOn" class="text-center space-y-2">
              <app-avatar [name]="currentUser()?.fullName || 'User'" [size]="64"></app-avatar>
              <p class="text-xs text-slate-400">{{ currentUser()?.fullName }} (Tú)</p>
            </div>
            <div *ngIf="isCameraOn" class="w-full h-full bg-slate-800 flex items-center justify-center">
              <span class="material-icons-round text-6xl text-slate-600">videocam</span>
            </div>
            <div class="absolute bottom-3 left-3 bg-slate-950/80 px-2 py-0.5 rounded text-[11px] text-slate-300 flex items-center gap-1">
              <span>{{ currentUser()?.fullName }} (Tú)</span>
              <span *ngIf="isMuted" class="material-icons-round text-xs text-red-400">mic_off</span>
            </div>
          </div>

          <!-- Peer Mock Tile -->
          <div class="relative bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex items-center justify-center">
            <div class="text-center space-y-2">
              <app-avatar name="Maria Lopez" [size]="64"></app-avatar>
              <p class="text-xs text-slate-400">María López (Product Lead)</p>
            </div>
            <div class="absolute bottom-3 left-3 bg-slate-950/80 px-2 py-0.5 rounded text-[11px] text-slate-300">
              <span>María López</span>
            </div>
          </div>
        </div>

        <!-- Meeting Control Toolbar -->
        <div class="h-16 bg-slate-900 border border-slate-800 rounded-xl px-6 flex items-center justify-between shrink-0 shadow-lg">
          <div class="text-xs font-mono text-slate-400 flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>00:14:22</span>
          </div>

          <!-- Mid Controls -->
          <div class="flex items-center gap-3">
            <button
              type="button"
              (click)="isMuted = !isMuted"
              class="w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer"
              [ngClass]="isMuted ? 'bg-red-600/80 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'"
            >
              <span class="material-icons-round text-lg">{{ isMuted ? 'mic_off' : 'mic' }}</span>
            </button>

            <button
              type="button"
              (click)="isCameraOn = !isCameraOn"
              class="w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer"
              [ngClass]="!isCameraOn ? 'bg-red-600/80 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'"
            >
              <span class="material-icons-round text-lg">{{ !isCameraOn ? 'videocam_off' : 'videocam' }}</span>
            </button>

            <button
              type="button"
              (click)="copyLink()"
              class="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center cursor-pointer"
              title="Copiar enlace de invitación"
            >
              <span class="material-icons-round text-lg">share</span>
            </button>

            <button
              type="button"
              (click)="leaveMeeting()"
              class="px-4 h-10 rounded-full bg-red-600 hover:bg-red-500 text-white font-medium text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <span class="material-icons-round text-base">call_end</span>
              <span>Finalizar</span>
            </button>
          </div>

          <div class="text-xs text-slate-400 font-mono">
            2 participantes
          </div>
        </div>
      </div>

      <!-- EMPTY STATE / SCHEDULED LIST -->
      <div *ngIf="!activeRoom()" class="flex-1 overflow-y-auto p-6 space-y-4">
        <div class="p-8 text-center max-w-sm mx-auto space-y-4 mt-8">
          <div class="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mx-auto">
            <span class="material-icons-round text-3xl text-emerald-400">video_camera_front</span>
          </div>
          <div class="space-y-1">
            <h3 class="text-sm font-bold text-slate-100">No hay reunión en curso</h3>
            <p class="text-xs text-slate-400 leading-relaxed">Inicia una llamada instantánea para comunicarte cara a cara con tu equipo con un solo clic.</p>
          </div>
          <button
            type="button"
            (click)="startInstantMeeting()"
            class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-lg transition-colors inline-flex items-center gap-2 cursor-pointer shadow-md"
          >
            <span class="material-icons-round text-sm">add_call</span>
            <span>Iniciar Sala Ahora</span>
          </button>
        </div>
      </div>
    </div>
  `
})
export class MeetingRoomComponent implements OnInit {
  public currentUser = this.authService.currentUser;
  public activeRoom = signal<Meeting | null>(null);

  public isMuted = false;
  public isCameraOn = true;

  constructor(
    private meetingApi: MeetingApiService,
    private authService: AuthService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {}

  startInstantMeeting(): void {
    this.meetingApi.createMeeting({
      title: 'Reunión Instantánea de Equipo'
    }).subscribe({
      next: m => {
        this.activeRoom.set(m);
        this.toastService.success('Sala virtual iniciada.');
      },
      error: () => this.toastService.error('Error al iniciar reunión.')
    });
  }

  leaveMeeting(): void {
    if (this.activeRoom()) {
      this.meetingApi.endMeeting(this.activeRoom()!.id).subscribe({
        next: () => {
          this.activeRoom.set(null);
          this.toastService.info('Has salido de la reunión.');
        },
        error: () => {
          this.activeRoom.set(null);
        }
      });
    }
  }

  copyLink(): void {
    navigator.clipboard.writeText(window.location.href);
    this.toastService.success('Enlace de la reunión copiado al portapapeles.');
  }
}
