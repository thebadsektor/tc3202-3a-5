// File: src/services/difficultyService.js
import axios from 'axios';

const ML_SERVICE_URL = 'http://localhost:5000/predict_difficulty';

export const predictNextDifficulty = async (currentDifficulty, wasCorrect, timeTaken) => {
  try {
    const response = await axios.post(ML_SERVICE_URL, {
      current_difficulty: getDifficultyNumeric(currentDifficulty),
      was_correct: wasCorrect,
      time_taken: timeTaken
    });
    
    return response.data.predicted_difficulty;
  } catch (error) {
    console.error('Difficulty Prediction Error:', error);
    // Fallback to default difficulty progression
    return getDefaultDifficulty(currentDifficulty, wasCorrect);
  }
};

// Helper to convert difficulty to numeric
const getDifficultyNumeric = (difficulty) => {
  switch(difficulty) {
    case 'easy': return 1;
    case 'medium': return 2;
    case 'hard': return 3;
    default: return 2;
  }
};

// Fallback difficulty progression
const getDefaultDifficulty = (currentDifficulty, wasCorrect) => {
  if (wasCorrect) {
    switch (currentDifficulty) {
      case 'easy': return 'medium';
      case 'medium': return 'hard';
      case 'hard': return 'hard';
      default: return 'medium';
    }
  } else {
    switch (currentDifficulty) {
      case 'hard': return 'medium';
      case 'medium': return 'easy';
      case 'easy': return 'easy';
      default: return 'medium';
    }
  }
};