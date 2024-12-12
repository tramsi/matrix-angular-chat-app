import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { MatrixService } from '../core/matrix.service';
import { Room } from '../core/models';

@Component({
  selector: 'app-rooms',
  templateUrl: './rooms.component.html',
  styleUrls: ['./rooms.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoomsComponent implements OnInit, OnDestroy {
  rooms$: Observable<Room[]>;
  private joinRoomSub: Subscription | null = null;

  constructor(private matrixService: MatrixService) {
    this.rooms$ = this.matrixService.rooms$;
  }

  ngOnInit(): void {
    this.matrixService.loadRooms();
  }

  onJoinRoom(roomId: string): void {
    this.joinRoomSub = this.matrixService.joinRoom(roomId).subscribe();
  }

  onSelectRoom(room: Room): void {
    this.matrixService.selectRoom(room);
  }

  ngOnDestroy(): void {
    this.joinRoomSub?.unsubscribe();
  }
  loadRooms(): void {
    this.matrixService.loadRooms();
  }
}
