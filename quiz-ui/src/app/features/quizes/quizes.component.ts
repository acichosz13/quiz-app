import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Firestore, collection, collectionData } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { MatCardModule } from '@angular/material/card';

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

  // Quiz results
  public correctAnswers: number = 0;
  public incorrectAnswers: number = 0;

  private retryCount = 0;
  private maxRetries = 2;
  private currentIndex = 0;

  private firestore = inject(Firestore);
  
  public ngOnInit(): void {
    const questionsRef = collection(this.firestore, 'quiz-questions');
    collectionData(questionsRef, { idField: 'id' })
      .subscribe(data => {
        console.log('Quiz questions:', data);
        this._questions = data as QuizQuestion[];
      });
  }

  public startQuiz(type: string = 'full') {
    this.questions = type === 'retake' ? this.incorrectQuestions : this._questions;
    this.currentIndex = 0;
    this.resetQuizResults();
    this.isQuizActive = true;
    this.askQuestion();
  }


  private askQuestion() {
    this.currentQuestion = this.questions[this.currentIndex];
    this.userAnswer = '';
    this.feedback = '';
  
    const utterance = new SpeechSynthesisUtterance(this.currentQuestion.question);
  
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
    const recognition = new (window as any).webkitSpeechRecognition();
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
      this.userAnswer = transcript.toLowerCase();
      const correct = this.userAnswer.includes(this.currentQuestion.answer.toLowerCase());
      this.feedback = correct ? 'Correct!' : `Incorrect. The answer was: ${this.currentQuestion.answer}`;
      if (correct) this.correctAnswers++;
      else {
        this.incorrectAnswers++;
        this.incorrectQuestions.push(this.currentQuestion);
      }

      await this.speak(this.feedback);
      setTimeout(() => this.nextQuestion(), 3000);
    };

    recognition.onerror = (event: any) => {
      this.listening = false;
      this.handleEmptySpeech();
    };

    recognition.onend = () => {
      this.listening = false;
    };

    recognition.start();
  }

  private async handleEmptySpeech() {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      this.feedback = "I didn't catch that. Let's try again.";
      await this.speak(this.feedback);
      setTimeout(() => this.listen(), 2000);
    } else {
      this.retryCount = 0;
      this.feedback = `Let's move on. The correct answer was: ${this.currentQuestion.answer}`;
      await this.speak(this.feedback);
      setTimeout(() => this.nextQuestion(), 3000);
    }
  }


  private async nextQuestion() {
    this.currentIndex++;
    if (this.currentIndex < this.questions.length) {
      this.askQuestion();
    } else {
      this.isQuizActive = false;
      this.quizCompleted = true;
      await this.speak('Quiz complete!');
      this.currentQuestion = undefined as any;
    }
  }

  private resetQuizResults() {
    this.correctAnswers = 0;
    this.incorrectAnswers = 0;
    this.incorrectQuestions = [];
  }
}
