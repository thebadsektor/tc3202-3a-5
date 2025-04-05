# File: backend/ml_services/difficulty_predictor.py
import joblib
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS

# Load trained model
model = joblib.load('knn_quiz_model_refined.pkl')

app = Flask(__name__)
CORS(app)

@app.route('/predict_difficulty', methods=['POST'])
def predict_difficulty():
    """
    Predict next question difficulty based on previous interaction
    
    Expected JSON payload:
    {
        "current_difficulty": int,  # 1, 2, or 3
        "was_correct": bool,
        "time_taken": int
    }
    """
    data = request.json
    
    # Convert input to model-compatible format
    features = np.array([
        data['current_difficulty'], 
        int(data['was_correct']), 
        data['time_taken']
    ]).reshape(1, -1)
    
    # Predict next difficulty
    predicted_difficulty = model.predict(features)[0]
    
    # Map numeric difficulty to categorical
    difficulty_map = {1: 'easy', 2: 'medium', 3: 'hard'}
    
    return jsonify({
        'predicted_difficulty': difficulty_map[predicted_difficulty]
    })

if __name__ == '__main__':
    app.run(port=5000, debug=True)