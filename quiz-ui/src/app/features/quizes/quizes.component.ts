import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Firestore, collection, collectionData } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

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
  ],
  templateUrl: './quizes.component.html',
  styleUrl: './quizes.component.scss'
})
export class QuizesComponent {

  questions: QuizQuestion[] = [];
  currentQuestion!: QuizQuestion;
  currentIndex = 0;
  userAnswer = '';
  feedback = '';

  constructor(private firestore: Firestore) {}

  ngOnInit(): void {
    const questionsRef = collection(this.firestore, 'quiz-questions');
    collectionData(questionsRef, { idField: 'id' })

      .subscribe(data => {
        console.log('Quiz questions:', data);
        this.questions = data as QuizQuestion[];
      });
  }

  startQuiz() {
    this.currentIndex = 0;
    this.askQuestion();
  }

  askQuestion() {
    this.currentQuestion = this.questions[this.currentIndex];
    this.userAnswer = '';
    this.feedback = '';
    this.speak(this.currentQuestion.question);
    this.listen();
  }

  speak(text: string) {
    const utterance = new SpeechSynthesisUtterance(text);
    speechSynthesis.speak(utterance);
  }

  listen() {
    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      console.log('Speech recognized:', event.results[0][0].transcript);
      this.userAnswer = event.results[0][0].transcript.toLowerCase();
      const correct = this.userAnswer.includes(this.currentQuestion.answer.toLowerCase());
      this.feedback = correct ? 'Correct!' : `Incorrect. The answer was: ${this.currentQuestion.answer}`;
      this.speak(this.feedback);
      setTimeout(() => this.nextQuestion(), 3000);
    };

    recognition.onerror = (event: any) => {
      this.feedback = 'Error recognizing speech: ' + event.error;
    };

    recognition.start();
  }

  nextQuestion() {
    this.currentIndex++;
    if (this.currentIndex < this.questions.length) {
      this.askQuestion();
    } else {
      this.speak('Quiz complete!');
      this.currentQuestion = undefined as any;
    }
  }
}
