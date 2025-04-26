import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Firestore, collection, collectionData } from '@angular/fire/firestore';
import { MatCardModule } from '@angular/material/card';
import { MetricComponent } from '../../shared/metric/metric.component';
import * as levenshtein from 'fast-levenshtein';

interface QuizQuestion {
  question: string;
  answer: string;
}

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

  private _questions: QuizQuestion[] = [];
  public questions: QuizQuestion[] = [];

  public incorrectQuestions: QuizQuestion[] = [];
  public currentQuestion!: QuizQuestion;

  public userAnswer = '';
  public feedback = '';
  public listening = false;
  public isQuizActive = false;
  public quizCompleted = false;
  public score: number = 0;
  public metrics: any[] = []
  // Quiz results
  public correctAnswers: number = 0;
  public incorrectAnswers: number = 0;

  private retryCount = 0;
  private maxRetries = 10;
  private currentIndex = 0;
  private recognition: any;

  private firestore = inject(Firestore);
  private cdr = inject(ChangeDetectorRef);
  private numberMap: { [key: number]: string } = {
    0: 'zero',
    1: 'one',
    2: 'two',
    3: 'three',
    4: 'four',
    5: 'five',
    6: 'six',
    7: 'seven',
    8: 'eight',
    9: 'nine'
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

  public startQuiz(type: string = 'full') {
    this.questions = type === 'retake' ? this.incorrectQuestions : this._questions;
    this.currentIndex = 0;
    this.resetQuizResults();
    this.isQuizActive = true;
    this.askQuestion();
  }

  public cancelQuiz() {
    if (this.recognition) {
      this.recognition.abort();
      this.recognition = null;
    }
  
    speechSynthesis.cancel();
  
    this.isQuizActive = false;
    this.quizCompleted = false;
    this.currentQuestion = undefined as any;
    this.userAnswer = '';
    this.feedback = '';
    this.listening = false;
    this.resetQuizResults();
  }


  private askQuestion() {
    this.currentQuestion = this.questions[this.currentIndex];
    this.userAnswer = '';
    this.feedback = '';
  
    const utterance = new SpeechSynthesisUtterance(this.currentQuestion.question);
    utterance.rate = 0.5;
    utterance.onend = () => this.listen();
  
    speechSynthesis.speak(utterance);
  }

  private speak(text: string): Promise<void> {
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => resolve();
      speechSynthesis.speak(utterance);
    });
  }

  private listen() {
    this.recognition = new (window as any).webkitSpeechRecognition();
    const recognition = this.recognition;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    this.listening = true;

    recognition.onresult = async (event: any) => {
      this.listening = false;
      const transcript = event.results[0][0].transcript.trim();

      if (!transcript) {
        this.handleEmptySpeech();
        return;
      }

      this.retryCount = 0;

      this.userAnswer = this.convertDigitsToWords(transcript.toLowerCase());
      const correctAnswer = this.currentQuestion.answer.toLowerCase().replace(/[:,().']/g, ''); // remove punctuation
      
      // Get the similarity percentage between the user answer and the correct answer
      const similarityPercent = this.similarity(this.userAnswer, correctAnswer) * 100;
      console.log('similarityPercent', similarityPercent)
      console.log('userAnswer', this.userAnswer, correctAnswer)
      if (similarityPercent >= 95) {
        const additionalFeedback = similarityPercent < 100 ?  ` slightly difference based on what I heard. Answer: ${this.currentQuestion.answer}` : '';
        this.feedback = 'Correct! ' + additionalFeedback;
        this.correctAnswers++;
      } else {
        this.feedback = `Incorrect. The correct answer was: ${this.currentQuestion.answer}`;
        this.incorrectAnswers++;
        this.incorrectQuestions.push(this.currentQuestion);
      }
    
      // Proceed to the next question
      await this.speak(this.feedback);
      setTimeout(() => this.nextQuestion(), 3000);
    };

    recognition.onerror = (event: any) => {
      console.log('on error', event)
    };

    recognition.onend = () => {
      this.listening = false;
      if (this.isQuizActive && !this.userAnswer) {
        setTimeout(() => this.listen(), 500); // small delay to prevent infinite loops
      }
    };

    recognition.start();
  }


  
  private convertDigitsToWords(text: string): string {
    return text.split('').map(char => {
      const num = parseInt(char);
      return !isNaN(num) ? this.numberMap[num] : char;  // Convert digits to words
    }).join('');
  }

  private async handleEmptySpeech() {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      this.feedback = "I didn't catch that. Let's try again.";
      await this.speak(this.feedback);
      setTimeout(() => this.listen(), 500);
    } else {
      this.retryCount = 0;
      this.feedback = `Let's move on. The correct answer was: ${this.currentQuestion.answer}`;
      await this.speak(this.feedback);
      setTimeout(() => this.nextQuestion(), 2000);
    }
  }


  private async nextQuestion() {
    console.log('next question')
    this.currentIndex++;
    if (this.currentIndex < this.questions.length) {
      this.askQuestion();
    } else {
      this.isQuizActive = false;
      this.quizCompleted = true;
      this.score = this.calculateScore();
      this.metrics = this.calculateMetrics();
      this.cdr.detectChanges();
      await this.speak('Quiz completed! Your score is ' + this.score + ' percent.');
      if (this.recognition) {
        this.recognition.abort();
        this.recognition = null;
      }
      this.currentQuestion = undefined as any;
    }
  }

  private calculateScore(): number {
    const totalQuestions = this.correctAnswers + this.incorrectAnswers;
    if (totalQuestions === 0) return 0;
    return Math.round((this.correctAnswers / totalQuestions) * 100);
  }

  private calculateMetrics(): any[] {
    const totalAnswer = this.correctAnswers + this.incorrectAnswers
    return [
      { label: 'Total', value: totalAnswer },
      { label: 'Correct', value: this.correctAnswers },
      { color: 'var(--mat-sys-on-error-container', label: 'Wrong', value: this.incorrectAnswers}
    ]
  }

  private resetQuizResults() {
    this.correctAnswers = 0;
    this.incorrectAnswers = 0;
    this.incorrectQuestions = [];
  }


  private similarity(userAnswer: string, correctAnswer: string): number {
    const distance = levenshtein.get(userAnswer, correctAnswer);
    const maxLength = Math.max(userAnswer.length, correctAnswer.length);
    return 1 - distance / maxLength; // returns a percentage of similarity
  }
 
  
}
