import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { collection, collectionData, Firestore } from '@angular/fire/firestore';
import { MetricComponent, Metric } from '../../shared/metric/metric.component';
import * as levenshtein from 'fast-levenshtein';

interface QuizQuestion {
  question: string;
  answer: string;
}

declare var webkitSpeechRecognition: any;
type SpeechRecognition = typeof webkitSpeechRecognition;

const SILENCE_TIMEOUT_MS = 3000;
const SIMILARITY_THRESHOLD = 0.95;
const SPEECH_RATE = 0.5;
const MAX_RETRIES = 10;

@Component({
  selector: 'app-quizes',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MetricComponent
  ],
  templateUrl: './quizes.component.html',
  styleUrl: './quizes.component.scss'
})
export class QuizesComponent {
  // Public state
  public questions: QuizQuestion[] = [];
  public incorrectQuestions: QuizQuestion[] = [];
  public currentQuestion!: QuizQuestion;
  public userAnswer = '';
  public feedback = '';
  public listening = false;
  public isQuizActive = false;
  public quizCompleted = false;
  public score = 0;
  public metrics: Metric[] = [];
  public correctAnswers = 0;
  public incorrectAnswers = 0;

  // Private state
  private _questions: QuizQuestion[] = [];
  private retryCount = 0;
  private currentIndex = 0;
  private recognition: SpeechRecognition | null = null;
  private silenceTimeout: any;
  private partialTranscript = '';
  private firestore = inject(Firestore);
  private cdr = inject(ChangeDetectorRef);

  private numberMap: { [key: number]: string } = {
    0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four',
    5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine'
  };

  public ngOnInit(): void {
    const questionsRef = collection(this.firestore, 'quiz-questions')
    collectionData(questionsRef, { idField: 'id' })
      .subscribe(data => {
        // TODO fix database structure
        this._questions = (data as QuizQuestion[]).sort((a, b) => {
          const aId = (a as any).id.replace('question', '');
          const bId = (b as any).id.replace('question', '');
          return aId - bId;
        });
      });
  }

  public startQuiz(type: 'full' | 'retake' = 'full'): void {
    this.questions = type === 'retake' ? [...this.incorrectQuestions] : [...this._questions];
    this.currentIndex = 0;
    this.resetQuizResults();
    this.isQuizActive = true;
    this.askQuestion();
  }

  public cancelQuiz(): void {
    this.stopListening();
    speechSynthesis.cancel();
    this.isQuizActive = false;
    this.quizCompleted = false;
    this.currentQuestion = undefined as any;
    this.userAnswer = '';
    this.feedback = '';
    this.listening = false;
    this.resetQuizResults();
  }

  private askQuestion(): void {
    this.currentQuestion = this.questions[this.currentIndex];
    this.cdr.detectChanges();
    this.userAnswer = '';
    this.feedback = '';

    const formatted = this.formatQuestion(this.currentQuestion.question);
    const utterance = new SpeechSynthesisUtterance(formatted);
    utterance.rate = SPEECH_RATE;
    utterance.onend = () => this.startListening();

    speechSynthesis.speak(utterance);
  }

  private speak(text: string): Promise<void> {
    return new Promise(resolve => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => resolve();
      speechSynthesis.speak(utterance);
    });
  }

  private startListening(): void {
    const SpeechRecognition = (window as any).webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    const recognition = this.recognition;
    
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;
    
    this.listening = true;
    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        event.results[i].isFinal ? this.partialTranscript += transcript : interimTranscript += transcript;
      }
      this.onSpeechRecognized();
    };

    recognition.onerror = () => this.stopListening();
    recognition.onend = () => {
      if (this.listening) this.startListening();
    };

    recognition.start();
  }

  private stopListening(): void {
    if (this.recognition) {
      this.listening = false;
      this.recognition.abort();
      this.recognition.stop();
      this.recognition = null;
    }
  }

  private async finalizeAnswer(): Promise<void> {
    const finalTranscript = this.partialTranscript.trim().toLowerCase();
    this.stopListening();

    if (!finalTranscript) {
      await this.handleEmptySpeech();
      return;
    }

    this.retryCount = 0;
    this.userAnswer = this.convertDigitsToWords(finalTranscript);
    const similarityPercent = this.checkAnswer(this.currentQuestion.answer);

    if (similarityPercent >= SIMILARITY_THRESHOLD * 100) {
      const extra = similarityPercent < 100 ? ` Slightly different. Answer: ${this.currentQuestion.answer}` : '';
      this.feedback = 'Correct!' + extra;
      this.correctAnswers++;
    } else {
      this.feedback = `Incorrect. Correct answer: ${this.currentQuestion.answer}`;
      this.incorrectAnswers++;
      this.incorrectQuestions.push(this.currentQuestion);
    }
    this.cdr.detectChanges();
    await this.speak(this.feedback);
    setTimeout(() => this.nextQuestion(), 2000);
  }

  private onSpeechRecognized(): void {
    clearTimeout(this.silenceTimeout);
    this.silenceTimeout = setTimeout(() => this.finalizeAnswer(), SILENCE_TIMEOUT_MS);
  }

  private async handleEmptySpeech(): Promise<void> {
    if (this.retryCount < MAX_RETRIES) {
      this.retryCount++;
      this.feedback = "I didn't catch that. Let's try again.";
      await this.speak(this.feedback);
      setTimeout(() => this.startListening(), 500);
    } else {
      this.retryCount = 0;
      this.feedback = `Moving on. Correct: ${this.currentQuestion.answer}`;
      await this.speak(this.feedback);
      setTimeout(() => this.nextQuestion(), 2000);
    }
  }

  private async nextQuestion(): Promise<void> {
    this.currentIndex++;
    this.partialTranscript = '';
    if (this.currentIndex < this.questions.length) this.askQuestion();
    else this.completeQuiz();
  }

  private async completeQuiz(): Promise<void> {
    this.isQuizActive = false;
    this.quizCompleted = true;
    this.score = this.calculateScore();
    this.metrics = this.calculateMetrics();
    this.cdr.detectChanges();
    await this.speak(`Quiz complete! Score: ${this.score} percent.`);
  }

  private calculateScore(): number {
    const total = this.correctAnswers + this.incorrectAnswers;
    return total ? Math.round((this.correctAnswers / total) * 100) : 0;
  }

  private calculateMetrics(): Metric[] {
    return [
      { label: 'Total', value: this.correctAnswers + this.incorrectAnswers },
      { label: 'Correct', value: this.correctAnswers },
      { label: 'Wrong', value: this.incorrectAnswers, color: 'var(--mat-sys-on-error-container)' }
    ];
  }

  private resetQuizResults(): void {
    this.correctAnswers = 0;
    this.incorrectAnswers = 0;
    this.incorrectQuestions = [];
  }

  private similarity(a: string, b: string): number {
    const distance = levenshtein.get(a, b);
    return 1 - distance / Math.max(a.length, b.length);
  }

  private formatQuestion(q: string): string {
    return (q ?? this.currentQuestion?.question ?? '').split(' ').map(section => {
      const trimmed = section.trim();
      if (!isNaN(Number(trimmed))) {
        if (trimmed.includes('.')) {
          const [before, after] = trimmed.split('.');
          const spacedBefore = before.length > 2 ? before.split('').join(' ') : before;
          return `${spacedBefore} .${after}`;
        }
        return trimmed.length === 3 ? `${trimmed[0]} ${trimmed.slice(1)}` : trimmed.split('').join(' ');
      }
      return trimmed;
    }).join(' ');
  }

  private checkAnswer(answer: string): number {
    const removedPunc = answer.toLowerCase().replace(/[:,().']/g, '');

    const removedPuncSim = this.similarity(this.userAnswer, removedPunc) * 100;
    if (removedPuncSim === 100) return removedPuncSim;

    const removedSlash = removedPunc.replace(/[/]/g, '').replace('  ', ' ');
    const removedSlashSim = this.similarity(this.userAnswer, removedSlash) * 100;
    if (removedSlashSim === 100) return removedSlashSim;

    return Math.max(removedPuncSim, removedSlashSim);
  } 

  private convertDigitsToWords(text: string): string {
    return text.split('').map(char => {
      const num = parseInt(char);
      return !isNaN(num) ? this.numberMap[num] : char;
    }).join('');
  }
}
