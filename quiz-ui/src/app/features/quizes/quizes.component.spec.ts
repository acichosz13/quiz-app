import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuizesComponent } from './quizes.component';

describe('QuizesComponent', () => {
  let component: QuizesComponent;
  let fixture: ComponentFixture<QuizesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuizesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(QuizesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
