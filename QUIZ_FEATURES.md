# Quiz Master Features

## Overview
Quiz Master is an intelligent quiz generation extension that uses AI to create personalized quizzes based on user preferences.

## Core Features

### 🎯 **Smart Quiz Generation**
- Customizable quiz topics
- Adjustable difficulty levels (easy, medium, hard)
- Multiple question types (multiple-choice, true-false, short-answer)
- Configurable tone (professional, casual, educational, fun)
- Dynamic question count

### 🔗 **Multiple Connection Options**
1. **Puter Sign-In** - Web-based authentication for easy setup
2. **API Key Entry** - Use existing API keys from OpenRouter, OpenAI
3. **Local Models** - Run AI locally with Ollama (privacy-focused)
4. **WebGPU** - Browser-based AI execution

### 📚 **Model Caching & Pre-loading**
- Recommended models pre-configured (Qwen2.5 Coder, Llama 3.2)
- One-click download instructions
- Auto-connect on startup
- Connection persistence

### 🛡️ **Privacy & Security**
- Local-first options available
- User-managed API keys
- No data collection by extension
- Explicit user consent required

### ⚡ **Performance**
- Fast generation times (2-5 seconds per quiz)
- Connection status indicators
- Real-time generation feedback
- Efficient model usage

## User Experience

### **Setup Process**
1. Choose connection method
2. Complete authentication
3. Download preferred models (if needed)
4. Start generating quizzes

### **Quiz Generation Workflow**
1. Enter quiz topic
2. Select difficulty and question types
3. Choose AI tone preference
4. Generate quiz
5. Practice with generated questions

### **Connection Management**
- Clear status indicators (connected/disconnected/error)
- Easy reconnection
- Model management
- Auto-connect toggle

## Technical Details

### **AI Models**
- **Primary**: Qwen2.5 Coder (5GB) - Best for code and reasoning
- **Alternative**: Llama 3.2 1B (1GB) - Fast and lightweight
- **Browser**: Phi-3 Mini (1.5GB) - Balanced performance

### **API Endpoints**
- Gateway: `http://localhost:3001/rewrite`
- Health check: `/health`
- Models: Auto-detected from local Ollama

### **Storage**
- Local model download status
- Connection settings
- Quiz preferences
- User settings

## Extension Integration

### **Popup Interface**
- Connection setup panel
- Model management
- Quiz settings
- Connection status

### **Content Script**
- Quiz question presentation
- Answer validation
- Score tracking
- Explanation display

### **Background Worker**
- Connection monitoring
- Model health checks
- Background tasks
- Data persistence

## Getting Started

### **First-Time Setup**
1. Install extension
2. Open popup settings
3. Choose connection method
4. Follow setup instructions
5. Download recommended models
6. Start generating quizzes!

### **Example Usage**
```javascript
// Generate a coding quiz
const quizRequest = {
  topic: 'Python basic syntax',
  difficulty: 'easy',
  questionCount: 5,
  questionTypes: ['multiple-choice', 'true-false'],
  tone: 'professional',
  useLocalAI: true
};

const quiz = await quizAPIClient.generateQuiz(quizRequest);
console.log(quiz.quiz);
```

## Troubleshooting

### **Connection Issues**
- Check connection status indicator
- Verify API key format
- Ensure Ollama is running for local models
- Check browser console for errors

### **Model Download Problems**
- Ensure Ollama is installed
- Check internet connection
- Verify available disk space
- Use Docker alternative if needed

## Future Enhancements

- [ ] Quiz sharing capabilities
- [ ] Multi-user support
- [ ] Cloud sync options
- [ ] Advanced analytics
- [ ] Mobile app integration
- [ ] AI model marketplace
- [ ] Custom model training
