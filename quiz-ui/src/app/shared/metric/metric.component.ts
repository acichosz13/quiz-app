import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

interface Metric {
  color: string
  label: string
  value: number | string
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
