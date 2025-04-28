import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

export interface Metric {
  label: string
  value: number | string
  color?: string
}

@Component({
  selector: 'app-metric',
  standalone: true,
  imports: [CommonModule, MatCardModule],
  templateUrl: './metric.component.html',
  styleUrl: './metric.component.scss'
})
export class MetricComponent {
  @Input() public metrics: Metric[] = []

}
