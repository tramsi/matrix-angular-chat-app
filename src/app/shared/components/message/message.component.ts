import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Message } from '../../../core/models';
import { ImageMessageComponent } from '../image-message/image-message.component';

@Component({
  selector: 'app-message',
  templateUrl: './message.component.html',
  styleUrls: ['./message.component.scss'],
  standalone: true,
  imports: [CommonModule, ImageMessageComponent],
})
export class MessageComponent {
  @Input() message!: Message;
}
