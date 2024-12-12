import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { Message } from '../../../core/models';

@Component({
  selector: 'app-message',
  templateUrl: './message.component.html',
  styleUrls: ['./message.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessageComponent {
  @Input() message!: Message;
}
