// Global Variables
let currentUser = null;
let userPoints = 0;
let notes = [];
let notifications = [];
let currentQuiz = null;
let currentQuestionIndex = 0;
let quizScore = 0;
let selectedAnswer = null;

// X-O Game Variables
let xoGame = {
    board: ['', '', '', '', '', '', '', '', ''],
    currentPlayer: 'X',
    gameActive: false,
    scorePlayer: 0,
    scoreAI: 0,
    timer: null,
    timeLeft: 30,
    gameInterval: null,
    isGameIntervalActive: false,
    gamePoints: 0
};

// PDF Viewer Variables
let pdfDoc = null;
let pageNum = 1;
let pageRendering = false;
let pageNumPending = null;
let scale = 1.5;

// Audio Recording Variables
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let recordingTimer = null;
let recordingStartTime = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    loadUserData();
    startXOGameInterval();
});

// Initialize the application
function initializeApp() {
    // Set PDF.js worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    
    // Load settings
    loadSettings();
    
    // Initialize quiz data
    initializeQuizzes();
    
    // Show dashboard by default
    showPage('dashboard');
}

// Setup event listeners
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.dataset.page;
            showPage(page);
        });
    });

    // File upload
    const fileInput = document.getElementById('fileInput');
    const uploadArea = document.getElementById('uploadArea');

    fileInput.addEventListener('change', handleFileUpload);
    
    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('drop', handleFileDrop);
    uploadArea.addEventListener('dragenter', handleDragEnter);
    uploadArea.addEventListener('dragleave', handleDragLeave);

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

// Navigation
function showPage(pageName) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Remove active class from all nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected page
    document.getElementById(pageName).classList.add('active');
    
    // Add active class to nav button
    document.querySelector(`[data-page="${pageName}"]`).classList.add('active');
    
    // Load page-specific content
    switch(pageName) {
        case 'notes':
            loadNotes();
            break;
        case 'quiz':
            loadQuizzes();
            break;
    }
}

// File Upload Handling
function handleFileUpload(event) {
    const files = event.target.files;
    if (files.length > 0) {
        processFiles(files);
    }
}

function handleDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('dragover');
}

function handleDragEnter(event) {
    event.preventDefault();
    event.currentTarget.classList.add('dragover');
}

function handleDragLeave(event) {
    event.currentTarget.classList.remove('dragover');
}

function handleFileDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('dragover');
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        processFiles(files);
    }
}

function processFiles(files) {
    Array.from(files).forEach(file => {
        const fileType = getFileType(file.name);
        
        if (fileType === 'pdf') {
            displayPDF(file);
        } else if (fileType === 'powerpoint') {
            displayPowerPoint(file);
        } else if (fileType === 'python' || fileType === 'jupyter') {
            displayCode(file);
        } else {
            showToast('Unsupported file type. Please upload PDF, PowerPoint (.ppt, .pptx), Python (.py), or Jupyter (.ipynb) files.', 'error');
        }
    });
}

function getFileType(filename) {
    const ext = filename.toLowerCase().split('.').pop();
    switch(ext) {
        case 'pdf': return 'pdf';
        case 'ppt':
        case 'pptx': return 'powerpoint';
        case 'py': return 'python';
        case 'ipynb': return 'jupyter';
        default: return 'unknown';
    }
}

// PDF Viewer
async function displayPDF(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        pdfDoc = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
        
        document.getElementById('fileName').textContent = file.name;
        document.getElementById('fileViewer').classList.remove('hidden');
        document.getElementById('pdfViewer').classList.remove('hidden');
        document.getElementById('codeViewer').classList.add('hidden');
        
        pageNum = 1;
        renderPage(pageNum);
        
        showToast('PDF loaded successfully!', 'success');
        
        // Generate file analysis
        generateFileAnalysis(file, 'pdf');
    } catch (error) {
        console.error('Error loading PDF:', error);
        showToast('Error loading PDF file.', 'error');
    }
}

async function renderPage(num) {
    pageRendering = true;
    
    try {
        const page = await pdfDoc.getPage(num);
        const viewport = page.getViewport({scale: scale});
        
        const canvas = document.getElementById('pdfCanvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        
        await page.render(renderContext).promise;
        pageRendering = false;
        
        document.getElementById('pageInfo').textContent = `Page ${num} of ${pdfDoc.numPages}`;
        
        if (pageNumPending !== null) {
            renderPage(pageNumPending);
            pageNumPending = null;
        }
    } catch (error) {
        console.error('Error rendering page:', error);
        pageRendering = false;
    }
}

function previousPage() {
    if (pageNum <= 1) return;
    pageNum--;
    queueRenderPage(pageNum);
}

function nextPage() {
    if (pageNum >= pdfDoc.numPages) return;
    pageNum++;
    queueRenderPage(pageNum);
}

function queueRenderPage(num) {
    if (pageRendering) {
        pageNumPending = num;
    } else {
        renderPage(num);
    }
}

// PowerPoint Viewer
function displayPowerPoint(file) {
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileViewer').classList.remove('hidden');
    document.getElementById('powerpointViewer').classList.remove('hidden');
    document.getElementById('pdfViewer').classList.add('hidden');
    document.getElementById('codeViewer').classList.add('hidden');
    
    // Read PowerPoint file and extract content
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            // For .pptx files, we can extract some basic information
            if (file.name.toLowerCase().endsWith('.pptx')) {
                // This is a simplified approach - in a real implementation you'd use a library
                const slideContent = document.getElementById('slideContent');
                slideContent.innerHTML = `
                    <div class="slide-content-real">
                        <div class="slide-header">
                            <h2>${file.name}</h2>
                            <p>PowerPoint Presentation</p>
                        </div>
                        <div class="slide-body">
                            <div class="slide-info">
                                <h3>Presentation Content</h3>
                                <ul>
                                    <li>File Type: PowerPoint Presentation (.pptx)</li>
                                    <li>File Size: ${(file.size / 1024).toFixed(2)} KB</li>
                                    <li>Last Modified: ${new Date(file.lastModified).toLocaleDateString()}</li>
                                </ul>
                            </div>
                            <div class="slide-preview">
                                <div class="slide-placeholder">
                                    <i class="fas fa-file-powerpoint"></i>
                                    <p>PowerPoint Content</p>
                                    <small>Slide content would be displayed here</small>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                // For .ppt files
                const slideContent = document.getElementById('slideContent');
                slideContent.innerHTML = `
                    <div class="slide-content-real">
                        <div class="slide-header">
                            <h2>${file.name}</h2>
                            <p>PowerPoint Presentation (Legacy Format)</p>
                        </div>
                        <div class="slide-body">
                            <div class="slide-info">
                                <h3>Presentation Content</h3>
                                <ul>
                                    <li>File Type: PowerPoint Presentation (.ppt)</li>
                                    <li>File Size: ${(file.size / 1024).toFixed(2)} KB</li>
                                    <li>Last Modified: ${new Date(file.lastModified).toLocaleDateString()}</li>
                                </ul>
                            </div>
                            <div class="slide-preview">
                                <div class="slide-placeholder">
                                    <i class="fas fa-file-powerpoint"></i>
                                    <p>PowerPoint Content</p>
                                    <small>Slide content would be displayed here</small>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            // Generate file analysis
            generateFileAnalysis(file, 'powerpoint');
            
            showToast('PowerPoint file loaded successfully!', 'success');
        } catch (error) {
            console.error('Error processing PowerPoint file:', error);
            showToast('Error processing PowerPoint file.', 'error');
        }
    };
    
    reader.onerror = function() {
        showToast('Error reading PowerPoint file.', 'error');
    };
    
    reader.readAsArrayBuffer(file);
}

// Code Viewer
function displayCode(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        
        document.getElementById('fileName').textContent = file.name;
        document.getElementById('fileViewer').classList.remove('hidden');
        document.getElementById('codeViewer').classList.remove('hidden');
        document.getElementById('pdfViewer').classList.add('hidden');
        document.getElementById('powerpointViewer').classList.add('hidden');
        
        // For Jupyter notebooks, extract only code cells
        if (file.name.toLowerCase().endsWith('.ipynb')) {
            try {
                const notebook = JSON.parse(content);
                const codeCells = notebook.cells
                    .filter(cell => cell.cell_type === 'code')
                    .map(cell => cell.source.join(''))
                    .join('\n\n');
                document.getElementById('codeContent').textContent = codeCells;
            } catch (error) {
                document.getElementById('codeContent').textContent = content;
            }
        } else {
            document.getElementById('codeContent').textContent = content;
        }
        
        // Generate file analysis
        generateFileAnalysis(file, file.name.toLowerCase().endsWith('.ipynb') ? 'jupyter' : 'python');
        
        showToast('Code file loaded successfully!', 'success');
    };
    reader.readAsText(file);
}

function closeFileViewer() {
    document.getElementById('fileViewer').classList.add('hidden');
    document.getElementById('pdfViewer').classList.add('hidden');
    document.getElementById('codeViewer').classList.add('hidden');
    document.getElementById('powerpointViewer').classList.add('hidden');
    document.getElementById('fileAnalysis').classList.add('hidden');
}

// File Analysis Functions
function generateFileAnalysis(file, fileType) {
    document.getElementById('fileAnalysis').classList.remove('hidden');
    
    let summary = '';
    let keyPoints = [];
    
    switch(fileType) {
        case 'pdf':
            summary = `PDF document "${file.name}" with ${pdfDoc ? pdfDoc.numPages : 'unknown'} pages. This document contains structured information that can be analyzed for key concepts and important details.`;
            keyPoints = [
                'Document contains multiple pages of content',
                'Text-based information suitable for analysis',
                'Professional document format',
                'Can be used for study and reference'
            ];
            break;
        case 'powerpoint':
            summary = `PowerPoint presentation "${file.name}" containing slides with visual and textual content. This presentation is designed to convey information in an engaging format.`;
            keyPoints = [
                'Visual presentation format',
                'Contains slides with text and graphics',
                'Suitable for presentations and learning',
                'Can be used for educational purposes'
            ];
            break;
        case 'python':
            summary = `Python script "${file.name}" containing code that can be executed and analyzed. This file contains programming logic and algorithms.`;
            keyPoints = [
                'Contains executable Python code',
                'Programming logic and algorithms',
                'Can be run and tested',
                'Suitable for learning programming concepts'
            ];
            break;
        case 'jupyter':
            summary = `Jupyter notebook "${file.name}" containing interactive code cells and markdown documentation. This notebook combines code and explanations.`;
            keyPoints = [
                'Interactive code cells',
                'Markdown documentation',
                'Combines code and explanations',
                'Ideal for data analysis and learning'
            ];
            break;
    }
    
    document.getElementById('fileSummary').textContent = summary;
    document.getElementById('fileKeyPoints').innerHTML = keyPoints.map(point => `<li>${point}</li>`).join('');
}

// PowerPoint Navigation Functions
function previousSlide() {
    // Mock slide navigation
    showToast('Previous slide', 'info');
}

function nextSlide() {
    // Mock slide navigation
    showToast('Next slide', 'info');
}

// X-O Game Functions
function startXOGameInterval() {
    const gameDuration = parseInt(document.getElementById('gameDuration').value) || 30;
    const gameInterval = parseInt(document.getElementById('gameInterval').value) || 2;
    
    xoGame.gameInterval = setInterval(() => {
        if (!xoGame.isGameIntervalActive) {
            openXOGame();
        }
    }, gameInterval * 60 * 1000); // Convert minutes to milliseconds
}

function openXOGame() {
    xoGame.isGameIntervalActive = true;
    xoGame.timeLeft = parseInt(document.getElementById('gameDuration').value) || 30;
    xoGame.gameActive = true;
    xoGame.board = ['', '', '', '', '', '', '', '', ''];
    xoGame.currentPlayer = 'X';
    
    document.getElementById('xoGameModal').classList.remove('hidden');
    document.getElementById('xoGameModal').classList.add('show');
    
    updateGameDisplay();
    startGameTimer();
    
    // Clear board
    document.querySelectorAll('.board-cell').forEach(cell => {
        cell.textContent = '';
        cell.classList.remove('x', 'o');
    });
}

function closeXOGame() {
    xoGame.isGameIntervalActive = false;
    xoGame.gameActive = false;
    clearInterval(xoGame.timer);
    
    document.getElementById('xoGameModal').classList.remove('show');
    setTimeout(() => {
        document.getElementById('xoGameModal').classList.add('hidden');
    }, 300);
}

function startGameTimer() {
    clearInterval(xoGame.timer);
    xoGame.timer = setInterval(() => {
        xoGame.timeLeft--;
        document.getElementById('gameTimer').textContent = xoGame.timeLeft;
        
        if (xoGame.timeLeft <= 0) {
            clearInterval(xoGame.timer);
            endGame();
        }
    }, 1000);
}

function endGame() {
    xoGame.gameActive = false;
    clearInterval(xoGame.timer);
    
    // Award points based on performance
    const filledCells = xoGame.board.filter(cell => cell !== '').length;
    const pointsEarned = Math.floor(filledCells * 2);
    userPoints += pointsEarned;
    updatePointsDisplay();
    
    showToast(`Game ended! You earned ${pointsEarned} points!`, 'success');
    
    setTimeout(() => {
        closeXOGame();
    }, 2000);
}

function updateGameDisplay() {
    const playerName = document.getElementById('userName').value || 'You';
    document.getElementById('currentPlayer').textContent = xoGame.currentPlayer === 'X' ? `${playerName} (X)` : 'AI (O)';
    document.getElementById('scorePlayer').textContent = xoGame.scorePlayer;
    document.getElementById('scoreAI').textContent = xoGame.scoreAI;
    document.getElementById('gameTimer').textContent = xoGame.timeLeft;
    document.getElementById('gamePoints').textContent = xoGame.gamePoints;
}

// X-O Game Board Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.board-cell').forEach(cell => {
        cell.addEventListener('click', () => {
            if (!xoGame.gameActive) return;
            
            const cellIndex = parseInt(cell.dataset.cell);
            if (xoGame.board[cellIndex] === '') {
                makeMove(cellIndex);
            }
        });
    });
});

function makeMove(cellIndex) {
    if (xoGame.board[cellIndex] !== '' || !xoGame.gameActive) return;
    
    // Player's move
    if (xoGame.currentPlayer === 'X') {
        xoGame.board[cellIndex] = 'X';
        const cell = document.querySelector(`[data-cell="${cellIndex}"]`);
        cell.textContent = 'X';
        cell.classList.add('x');
        
        xoGame.gamePoints += 2; // Points for making a move
        
        if (checkWinner()) {
            xoGame.scorePlayer++;
            updateGameDisplay();
            showToast('You win!', 'success');
            
            // Award points
            const pointsEarned = 10;
            userPoints += pointsEarned;
            xoGame.gamePoints += pointsEarned;
            updatePointsDisplay();
            
            setTimeout(() => {
                resetGame();
            }, 1500);
            return;
        }
        
        if (checkDraw()) {
            showToast("It's a draw!", 'info');
            xoGame.gamePoints += 5; // Points for draw
            setTimeout(() => {
                resetGame();
            }, 1500);
            return;
        }
        
        xoGame.currentPlayer = 'O';
        updateGameDisplay();
        
        // AI's move
        setTimeout(() => {
            makeAIMove();
        }, 500);
    }
}

function makeAIMove() {
    if (!xoGame.gameActive) return;
    
    // Simple AI: find first empty cell
    const emptyCells = xoGame.board.map((cell, index) => cell === '' ? index : -1).filter(index => index !== -1);
    
    if (emptyCells.length > 0) {
        const randomIndex = Math.floor(Math.random() * emptyCells.length);
        const cellIndex = emptyCells[randomIndex];
        
        xoGame.board[cellIndex] = 'O';
        const cell = document.querySelector(`[data-cell="${cellIndex}"]`);
        cell.textContent = 'O';
        cell.classList.add('o');
        
        if (checkWinner()) {
            xoGame.scoreAI++;
            updateGameDisplay();
            showToast('AI wins!', 'error');
            
            setTimeout(() => {
                resetGame();
            }, 1500);
            return;
        }
        
        if (checkDraw()) {
            showToast("It's a draw!", 'info');
            setTimeout(() => {
                resetGame();
            }, 1500);
            return;
        }
        
        xoGame.currentPlayer = 'X';
        updateGameDisplay();
    }
}

function checkWinner() {
    const winConditions = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
        [0, 4, 8], [2, 4, 6] // Diagonals
    ];
    
    return winConditions.some(condition => {
        return condition.every(index => {
            return xoGame.board[index] === xoGame.currentPlayer;
        });
    });
}

function checkDraw() {
    return xoGame.board.every(cell => cell !== '');
}

function resetGame() {
    xoGame.board = ['', '', '', '', '', '', '', '', ''];
    xoGame.currentPlayer = 'X';
    xoGame.timeLeft = parseInt(document.getElementById('gameDuration').value) || 30;
    xoGame.gamePoints = 0;
    
    document.querySelectorAll('.board-cell').forEach(cell => {
        cell.textContent = '';
        cell.classList.remove('x', 'o');
    });
    
    updateGameDisplay();
    startGameTimer();
}

// Notes Functions
function loadNotes() {
    const savedNotes = localStorage.getItem('teha_notes');
    notes = savedNotes ? JSON.parse(savedNotes) : [];
    displayNotes();
}

function displayNotes() {
    const notesList = document.getElementById('notesList');
    const currentCategory = document.querySelector('.category-btn.active').dataset.category;
    
    let filteredNotes = notes;
    if (currentCategory !== 'all') {
        filteredNotes = notes.filter(note => note.category === currentCategory);
    }
    
    notesList.innerHTML = filteredNotes.map(note => `
        <div class="note-card" onclick="editNote(${note.id})">
            <h4>${note.title}</h4>
            <p>${note.content.substring(0, 150)}${note.content.length > 150 ? '...' : ''}</p>
            <div class="note-meta">
                <span>${note.category}</span>
                <span>${new Date(note.updatedAt).toLocaleDateString()}</span>
            </div>
        </div>
    `).join('');
}

function createNewNote() {
    document.getElementById('noteEditor').classList.remove('hidden');
    document.getElementById('notesList').classList.add('hidden');
    
    document.getElementById('noteTitle').value = '';
    document.getElementById('noteContent').value = '';
    document.getElementById('noteCategory').value = 'General';
}

function saveNote() {
    const title = document.getElementById('noteTitle').value.trim();
    const content = document.getElementById('noteContent').value.trim();
    const category = document.getElementById('noteCategory').value;
    
    if (!title || !content) {
        showToast('Please fill in both title and content.', 'error');
        return;
    }
    
    const note = {
        id: Date.now(),
        title: title,
        content: content,
        category: category,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    notes.unshift(note);
    localStorage.setItem('teha_notes', JSON.stringify(notes));
    
    showToast('Note saved successfully!', 'success');
    cancelNote();
    displayNotes();
}

function editNote(noteId) {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    
    document.getElementById('noteEditor').classList.remove('hidden');
    document.getElementById('notesList').classList.add('hidden');
    
    document.getElementById('noteTitle').value = note.title;
    document.getElementById('noteContent').value = note.content;
    document.getElementById('noteCategory').value = note.category;
    
    // Store the note ID for updating
    document.getElementById('noteEditor').dataset.noteId = noteId;
}

function cancelNote() {
    document.getElementById('noteEditor').classList.add('hidden');
    document.getElementById('notesList').classList.remove('hidden');
    document.getElementById('noteEditor').removeAttribute('data-note-id');
}

// Category filtering
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            displayNotes();
        });
    });
});

// Quiz Functions
function initializeQuizzes() {
    const sampleQuizzes = [
        {
            id: 1,
            title: 'General Knowledge',
            description: 'Test your general knowledge with these questions',
            questions: [
                {
                    id: 1,
                    question: 'What is the capital of France?',
                    options: ['London', 'Berlin', 'Paris', 'Madrid'],
                    correctAnswer: 2,
                    explanation: 'Paris is the capital and largest city of France.'
                },
                {
                    id: 2,
                    question: 'Which planet is known as the Red Planet?',
                    options: ['Venus', 'Mars', 'Jupiter', 'Saturn'],
                    correctAnswer: 1,
                    explanation: 'Mars is called the Red Planet due to its reddish appearance.'
                },
                {
                    id: 3,
                    question: 'What is the largest ocean on Earth?',
                    options: ['Atlantic Ocean', 'Indian Ocean', 'Arctic Ocean', 'Pacific Ocean'],
                    correctAnswer: 3,
                    explanation: 'The Pacific Ocean is the largest and deepest ocean on Earth.'
                }
            ]
        },
        {
            id: 2,
            title: 'Programming Basics',
            description: 'Test your programming knowledge',
            questions: [
                {
                    id: 1,
                    question: 'Which programming language is known for its simplicity?',
                    options: ['Java', 'Python', 'C++', 'Assembly'],
                    correctAnswer: 1,
                    explanation: 'Python is known for its simple and readable syntax.'
                },
                {
                    id: 2,
                    question: 'What does HTML stand for?',
                    options: ['Hyper Text Markup Language', 'High Tech Modern Language', 'Home Tool Markup Language', 'Hyperlink and Text Markup Language'],
                    correctAnswer: 0,
                    explanation: 'HTML stands for Hyper Text Markup Language.'
                }
            ]
        }
    ];
    
    localStorage.setItem('teha_quizzes', JSON.stringify(sampleQuizzes));
}

function loadQuizzes() {
    const quizzes = JSON.parse(localStorage.getItem('teha_quizzes') || '[]');
    const quizList = document.getElementById('quizList');
    
    quizList.innerHTML = quizzes.map(quiz => `
        <div class="quiz-item" onclick="startQuiz(${quiz.id})">
            <h3>${quiz.title}</h3>
            <p>${quiz.description}</p>
            <small>${quiz.questions.length} questions</small>
        </div>
    `).join('');
}

function startQuiz(quizId) {
    const quizzes = JSON.parse(localStorage.getItem('teha_quizzes') || '[]');
    currentQuiz = quizzes.find(q => q.id === quizId);
    
    if (!currentQuiz) return;
    
    currentQuestionIndex = 0;
    quizScore = 0;
    selectedAnswer = null;
    
    document.getElementById('quizList').classList.add('hidden');
    document.getElementById('quizQuestion').classList.remove('hidden');
    document.getElementById('quizResults').classList.add('hidden');
    
    displayQuestion();
}

function displayQuestion() {
    if (!currentQuiz || currentQuestionIndex >= currentQuiz.questions.length) {
        showQuizResults();
        return;
    }
    
    const question = currentQuiz.questions[currentQuestionIndex];
    
    document.getElementById('questionText').textContent = question.question;
    document.getElementById('quizProgress').textContent = `${currentQuestionIndex + 1}/${currentQuiz.questions.length}`;
    document.getElementById('quizScore').textContent = quizScore;
    
    const optionsContainer = document.getElementById('questionOptions');
    optionsContainer.innerHTML = question.options.map((option, index) => `
        <button class="option-btn" onclick="selectAnswer(${index})">
            ${option}
        </button>
    `).join('');
}

function selectAnswer(answerIndex) {
    selectedAnswer = answerIndex;
    
    document.querySelectorAll('.option-btn').forEach((btn, index) => {
        btn.classList.remove('selected');
        if (index === answerIndex) {
            btn.classList.add('selected');
        }
    });
}

function submitAnswer() {
    if (selectedAnswer === null) {
        showToast('Please select an answer.', 'error');
        return;
    }
    
    const question = currentQuiz.questions[currentQuestionIndex];
    const isCorrect = selectedAnswer === question.correctAnswer;
    
    if (isCorrect) {
        quizScore += 10;
        showToast('Correct! +10 points', 'success');
    } else {
        showToast('Incorrect. The correct answer was: ' + question.options[question.correctAnswer], 'error');
    }
    
    // Show explanation
    setTimeout(() => {
        showToast(question.explanation, 'info');
        
        setTimeout(() => {
            currentQuestionIndex++;
            selectedAnswer = null;
            displayQuestion();
        }, 2000);
    }, 1000);
}

function showQuizResults() {
    document.getElementById('quizQuestion').classList.add('hidden');
    document.getElementById('quizResults').classList.remove('hidden');
    
    const totalQuestions = currentQuiz.questions.length;
    const correctAnswers = Math.floor(quizScore / 10);
    const pointsEarned = quizScore;
    
    document.getElementById('finalScore').textContent = quizScore;
    document.getElementById('correctAnswers').textContent = correctAnswers;
    document.getElementById('pointsEarned').textContent = pointsEarned;
    
    // Award points
    userPoints += pointsEarned;
    updatePointsDisplay();
    
    showToast(`Quiz completed! You earned ${pointsEarned} points!`, 'success');
}

function retakeQuiz() {
    document.getElementById('quizResults').classList.add('hidden');
    document.getElementById('quizList').classList.remove('hidden');
}

// Settings Functions
function loadSettings() {
    const settings = JSON.parse(localStorage.getItem('teha_settings') || '{}');
    
    if (settings.theme) {
        document.getElementById('themeSelect').value = settings.theme;
        changeTheme();
    }
    
    if (settings.primaryColor) {
        document.getElementById('primaryColor').value = settings.primaryColor;
        changePrimaryColor();
    }
    
    if (settings.fontSize) {
        document.getElementById('fontSize').value = settings.fontSize;
        changeFontSize();
    }
    
    if (settings.gameDuration) {
        document.getElementById('gameDuration').value = settings.gameDuration;
    }
    
    if (settings.gameInterval) {
        document.getElementById('gameInterval').value = settings.gameInterval;
    }
    
    if (settings.userName) {
        document.getElementById('userName').value = settings.userName;
        updateUserGreeting();
    }
    
    if (settings.chatbotName) {
        document.getElementById('chatbotName').value = settings.chatbotName;
    }
    
    if (settings.backgroundImage) {
        document.body.style.backgroundImage = `url(${settings.backgroundImage})`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundAttachment = 'fixed';
    }
    
    if (settings.borderRadius) {
        document.getElementById('borderRadius').value = settings.borderRadius;
        document.getElementById('borderRadiusValue').textContent = settings.borderRadius + 'px';
        document.documentElement.style.setProperty('--border-radius', settings.borderRadius + 'px');
    }
    
    if (settings.shadowIntensity) {
        document.getElementById('shadowIntensity').value = settings.shadowIntensity;
        document.getElementById('shadowIntensityValue').textContent = settings.shadowIntensity + 'px';
    }
    
    if (settings.animationSpeed) {
        document.getElementById('animationSpeed').value = settings.animationSpeed;
        changeAnimationSpeed();
    }
    
    if (settings.fontFamily) {
        document.getElementById('fontFamily').value = settings.fontFamily;
        changeFontFamily();
    }
    
    if (settings.glassOpacity) {
        document.getElementById('glassOpacity').value = settings.glassOpacity;
        document.getElementById('glassOpacityValue').textContent = settings.glassOpacity + '%';
        changeGlassOpacity();
    }
    
    // Load color settings
    if (settings.primaryColor) {
        document.getElementById('primaryColor').value = settings.primaryColor;
        changePrimaryColor();
    }
    
    if (settings.secondaryColor) {
        document.getElementById('secondaryColor').value = settings.secondaryColor;
        changeSecondaryColor();
    }
    
    if (settings.accentColor) {
        document.getElementById('accentColor').value = settings.accentColor;
        changeAccentColor();
    }
    
    if (settings.successColor) {
        document.getElementById('successColor').value = settings.successColor;
        changeSuccessColor();
    }
    
    if (settings.warningColor) {
        document.getElementById('warningColor').value = settings.warningColor;
        changeWarningColor();
    }
    
    if (settings.errorColor) {
        document.getElementById('errorColor').value = settings.errorColor;
        changeErrorColor();
    }
    
    if (settings.textPrimaryColor) {
        document.getElementById('textPrimaryColor').value = settings.textPrimaryColor;
        changeTextPrimaryColor();
    }
    
    if (settings.textSecondaryColor) {
        document.getElementById('textSecondaryColor').value = settings.textSecondaryColor;
        changeTextSecondaryColor();
    }
    
    if (settings.bgPrimaryColor) {
        document.getElementById('bgPrimaryColor').value = settings.bgPrimaryColor;
        changeBgPrimaryColor();
    }
    
    if (settings.bgSecondaryColor) {
        document.getElementById('bgSecondaryColor').value = settings.bgSecondaryColor;
        changeBgSecondaryColor();
    }
    
    if (settings.xoXColor) {
        document.getElementById('xoXColor').value = settings.xoXColor;
        changeXOXColor();
    }
    
    if (settings.xoOColor) {
        document.getElementById('xoOColor').value = settings.xoOColor;
        changeXOOColor();
    }
    
    if (settings.fabColor) {
        document.getElementById('fabColor').value = settings.fabColor;
        changeFABColor();
    }
    
    if (settings.chatbotColor) {
        document.getElementById('chatbotColor').value = settings.chatbotColor;
        changeChatbotColor();
    }
    
    // Load background image
    if (settings.backgroundImage) {
        document.body.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.3)), url(${settings.backgroundImage})`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundRepeat = 'no-repeat';
    }
}

function updateUserGreeting() {
    const userName = document.getElementById('userName').value || 'there';
    document.getElementById('welcomeUserName').textContent = userName;
    document.getElementById('userGreeting').textContent = userName;
    
    const settings = JSON.parse(localStorage.getItem('teha_settings') || '{}');
    settings.userName = userName;
    localStorage.setItem('teha_settings', JSON.stringify(settings));
}

function changeTheme() {
    const theme = document.getElementById('themeSelect').value;
    document.documentElement.setAttribute('data-theme', theme === 'auto' ? '' : theme);
    
    const settings = JSON.parse(localStorage.getItem('teha_settings') || '{}');
    settings.theme = theme;
    localStorage.setItem('teha_settings', JSON.stringify(settings));
}

function changePrimaryColor() {
    const color = document.getElementById('primaryColor').value;
    document.documentElement.style.setProperty('--primary-color', color);
    
    const settings = JSON.parse(localStorage.getItem('teha_settings') || '{}');
    settings.primaryColor = color;
    localStorage.setItem('teha_settings', JSON.stringify(settings));
}

// Comprehensive Color Control Functions
function changeSecondaryColor() {
    const color = document.getElementById('secondaryColor').value;
    document.documentElement.style.setProperty('--secondary-color', color);
    
    const settings = JSON.parse(localStorage.getItem('teha_settings') || '{}');
    settings.secondaryColor = color;
    localStorage.setItem('teha_settings', JSON.stringify(settings));
}

function changeAccentColor() {
    const color = document.getElementById('accentColor').value;
    document.documentElement.style.setProperty('--accent-color', color);
    
    const settings = JSON.parse(localStorage.getItem('teha_settings') || '{}');
    settings.accentColor = color;
    localStorage.setItem('teha_settings', JSON.stringify(settings));
}

function changeSuccessColor() {
    const color = document.getElementById('successColor').value;
    document.documentElement.style.setProperty('--success-color', color);
    
    const settings = JSON.parse(localStorage.getItem('teha_settings') || '{}');
    settings.successColor = color;
    localStorage.setItem('teha_settings', JSON.stringify(settings));
}

function changeWarningColor() {
    const color = document.getElementById('warningColor').value;
    document.documentElement.style.setProperty('--warning-color', color);
    
    const settings = JSON.parse(localStorage.getItem('teha_settings') || '{}');
    settings.warningColor = color;
    localStorage.setItem('teha_settings', JSON.stringify(settings));
}

function changeErrorColor() {
    const color = document.getElementById('errorColor').value;
    document.documentElement.style.setProperty('--error-color', color);
    
    const settings = JSON.parse(localStorage.getItem('teha_settings') || '{}');
    settings.errorColor = color;
    localStorage.setItem('teha_settings', JSON.stringify(settings));
}

function changeTextPrimaryColor() {
    const color = document.getElementById('textPrimaryColor').value;
    document.documentElement.style.setProperty('--text-primary', color);
    
    const settings = JSON.parse(localStorage.getItem('teha_settings') || '{}');
    settings.textPrimaryColor = color;
    localStorage.setItem('teha_settings', JSON.stringify(settings));
}

function changeTextSecondaryColor() {
    const color = document.getElementById('textSecondaryColor').value;
    document.documentElement.style.setProperty('--text-secondary', color);
    
    const settings = JSON.parse(localStorage.getItem('teha_settings') || '{}');
    settings.textSecondaryColor = color;
    localStorage.setItem('teha_settings', JSON.stringify(settings));
}

function changeBgPrimaryColor() {
    const color = document.getElementById('bgPrimaryColor').value;
    document.documentElement.style.setProperty('--bg-primary', color);
    
    const settings = JSON.parse(localStorage.getItem('teha_settings') || '{}');
    settings.bgPrimaryColor = color;
    localStorage.setItem('teha_settings', JSON.stringify(settings));
}

function changeBgSecondaryColor() {
    const color = document.getElementById('bgSecondaryColor').value;
    document.documentElement.style.setProperty('--bg-secondary', color);
    
    const settings = JSON.parse(localStorage.getItem('teha_settings') || '{}');
    settings.bgSecondaryColor = color;
    localStorage.setItem('teha_settings', JSON.stringify(settings));
}

function changeXOXColor() {
    const color = document.getElementById('xoXColor').value;
    document.documentElement.style.setProperty('--xo-x-color', color);
    
    const settings = JSON.parse(localStorage.getItem('teha_settings') || '{}');
    settings.xoXColor = color;
    localStorage.setItem('teha_settings', JSON.stringify(settings));
}

function changeXOOColor() {
    const color = document.getElementById('xoOColor').value;
    document.documentElement.style.setProperty('--xo-o-color', color);
    
    const settings = JSON.parse(localStorage.getItem('teha_settings') || '{}');
    settings.xoOColor = color;
    localStorage.setItem('teha_settings', JSON.stringify(settings));
}

function changeFABColor() {
    const color = document.getElementById('fabColor').value;
    document.documentElement.style.setProperty('--fab-color', color);
    
    const settings = JSON.parse(localStorage.getItem('teha_settings') || '{}');
    settings.fabColor = color;
    localStorage.setItem('teha_settings', JSON.stringify(settings));
}

function changeChatbotColor() {
    const color = document.getElementById('chatbotColor').value;
    document.documentElement.style.setProperty('--chatbot-color', color);
    
    const settings = JSON.parse(localStorage.getItem('teha_settings') || '{}');
    settings.chatbotColor = color;
    localStorage.setItem('teha_settings', JSON.stringify(settings));
}

// Add event listeners for user name changes
document.addEventListener('DOMContentLoaded', function() {
    const userNameInput = document.getElementById('userName');
    if (userNameInput) {
        userNameInput.addEventListener('input', updateUserGreeting);
    }
    
    const chatbotNameInput = document.getElementById('chatbotName');
    if (chatbotNameInput) {
        chatbotNameInput.addEventListener('input', function() {
            const settings = JSON.parse(localStorage.getItem('teha_settings') || '{}');
            settings.chatbotName = this.value;
            localStorage.setItem('teha_settings', JSON.stringify(settings));
        });
    }
});

function changeFontSize() {
    const fontSize = document.getElementById('fontSize').value;
    document.body.className = `font-size-${fontSize}`;
    
    const settings = JSON.parse(localStorage.getItem('teha_settings') || '{}');
    settings.fontSize = fontSize;
    localStorage.setItem('teha_settings', JSON.stringify(settings));
}

// Enhanced Settings Functions
function changeBackgroundImage() {
    const file = document.getElementById('backgroundImage').files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            // Set background image with proper overlay to maintain readability
            document.body.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.3)), url(${e.target.result})`;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundPosition = 'center';
            document.body.style.backgroundRepeat = 'no-repeat';
            
            const settings = JSON.parse(localStorage.getItem('teha_settings') || '{}');
            settings.backgroundImage = e.target.result;
            localStorage.setItem('teha_settings', JSON.stringify(settings));
        };
        reader.readAsDataURL(file);
    }
}

function changeBorderRadius() {
    const radius = document.getElementById('borderRadius').value;
    document.getElementById('borderRadiusValue').textContent = radius + 'px';
    document.documentElement.style.setProperty('--border-radius', radius + 'px');
    
    const settings = JSON.parse(localStorage.getItem('teha_settings') || '{}');
    settings.borderRadius = radius;
    localStorage.setItem('teha_settings', JSON.stringify(settings));
}

function changeShadowIntensity() {
    const intensity = document.getElementById('shadowIntensity').value;
    document.getElementById('shadowIntensityValue').textContent = intensity + 'px';
    document.documentElement.style.setProperty('--shadow-lg', `0 ${intensity}px ${intensity * 1.5}px -3px rgb(0 0 0 / 0.1), 0 ${intensity * 0.8}px ${intensity}px -4px rgb(0 0 0 / 0.1)`);
    
    const settings = JSON.parse(localStorage.getItem('teha_settings') || '{}');
    settings.shadowIntensity = intensity;
    localStorage.setItem('teha_settings', JSON.stringify(settings));
}

function changeAnimationSpeed() {
    const speed = document.getElementById('animationSpeed').value;
    let duration = '0.3s';
    switch(speed) {
        case 'slow': duration = '0.6s'; break;
        case 'fast': duration = '0.15s'; break;
        default: duration = '0.3s';
    }
    document.documentElement.style.setProperty('--transition', `all ${duration} cubic-bezier(0.4, 0, 0.2, 1)`);
    
    const settings = JSON.parse(localStorage.getItem('teha_settings') || '{}');
    settings.animationSpeed = speed;
    localStorage.setItem('teha_settings', JSON.stringify(settings));
}

function changeFontFamily() {
    const fontFamily = document.getElementById('fontFamily').value;
    document.body.style.fontFamily = `'${fontFamily}', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
    
    const settings = JSON.parse(localStorage.getItem('teha_settings') || '{}');
    settings.fontFamily = fontFamily;
    localStorage.setItem('teha_settings', JSON.stringify(settings));
}

function changeGlassOpacity() {
    const opacity = document.getElementById('glassOpacity').value;
    document.getElementById('glassOpacityValue').textContent = opacity + '%';
    document.documentElement.style.setProperty('--glass-bg', `rgba(255, 255, 255, ${opacity / 100})`);
    
    const settings = JSON.parse(localStorage.getItem('teha_settings') || '{}');
    settings.glassOpacity = opacity;
    localStorage.setItem('teha_settings', JSON.stringify(settings));
}

// Chatbot Functions
function handleChatbotKeyPress(event) {
    if (event.key === 'Enter') {
        sendChatbotMessage();
    }
}

function sendChatbotMessage() {
    const input = document.getElementById('chatbotInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Add user message
    addChatbotMessage(message, 'user');
    input.value = '';
    
    // Simulate AI response
    setTimeout(() => {
        const response = generateChatbotResponse(message);
        addChatbotMessage(response, 'bot');
    }, 1000);
}

function addChatbotMessage(message, sender) {
    const messagesContainer = document.getElementById('chatbotMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    const icon = sender === 'user' ? 'fas fa-user' : 'fas fa-robot';
    const content = sender === 'user' ? message : message;
    
    messageDiv.innerHTML = `
        <div class="message-content">
            <i class="${icon}"></i>
            <span>${content}</span>
        </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function generateChatbotResponse(message) {
    const lowerMessage = message.toLowerCase();
    const chatbotName = document.getElementById('chatbotName').value || 'AI Assistant';
    
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
        return `Hello! I'm ${chatbotName}. How can I help you with your learning today?`;
    } else if (lowerMessage.includes('help')) {
        return `I can help you with:\n• File analysis and summaries\n• Quiz questions\n• Study tips\n• General questions about your uploaded content\n• And much more!`;
    } else if (lowerMessage.includes('quiz') || lowerMessage.includes('test')) {
        return `Great! You can take quizzes in the Quiz section. I can help you prepare by asking practice questions about your uploaded materials.`;
    } else if (lowerMessage.includes('file') || lowerMessage.includes('upload')) {
        return `Upload your files in the main area. I can help analyze PDFs, PowerPoint presentations, Python code, and Jupyter notebooks.`;
    } else if (lowerMessage.includes('points') || lowerMessage.includes('score')) {
        return `You earn points by playing the X-O game, taking quizzes, and completing various activities. Check your points in the top-right corner!`;
    } else {
        return `That's an interesting question! I'm ${chatbotName}, your AI learning assistant. I'm here to help you with your educational journey. Feel free to ask me anything about your studies!`;
    }
}

// Translation Functions
function openTranslate() {
    document.getElementById('translateModal').classList.remove('hidden');
    document.getElementById('translateModal').classList.add('show');
}

function closeTranslate() {
    document.getElementById('translateModal').classList.remove('show');
    setTimeout(() => {
        document.getElementById('translateModal').classList.add('hidden');
    }, 300);
}

function translateText() {
    const text = document.getElementById('translateInput').value.trim();
    const targetLang = document.getElementById('targetLanguage').value;
    
    if (!text) {
        showToast('Please enter text to translate.', 'error');
        return;
    }
    
    // Mock translation (in a real app, you'd use a translation API)
    const translations = {
        'es': 'Hola, esto es una traducción de ejemplo.',
        'fr': 'Bonjour, ceci est une traduction d\'exemple.',
        'de': 'Hallo, das ist eine Beispielübersetzung.',
        'it': 'Ciao, questa è una traduzione di esempio.',
        'pt': 'Olá, esta é uma tradução de exemplo.',
        'ru': 'Привет, это пример перевода.',
        'ja': 'こんにちは、これは翻訳の例です。',
        'ko': '안녕하세요, 이것은 번역 예시입니다.',
        'zh': '你好，这是一个翻译示例。',
        'ar': 'مرحبا، هذا مثال على الترجمة.'
    };
    
    const translation = translations[targetLang] || 'Translation not available';
    document.getElementById('translateOutput').textContent = translation;
    
    showToast('Translation completed!', 'success');
}

// Notification Functions
function openNotifications() {
    document.getElementById('notificationsModal').classList.remove('hidden');
    document.getElementById('notificationsModal').classList.add('show');
    
    // Set default time to 1 hour from now
    const defaultTime = new Date(Date.now() + 60 * 60 * 1000);
    document.getElementById('notificationTime').value = defaultTime.toISOString().slice(0, 16);
}

function closeNotifications() {
    document.getElementById('notificationsModal').classList.remove('show');
    setTimeout(() => {
        document.getElementById('notificationsModal').classList.add('hidden');
    }, 300);
}

function setNotification() {
    const title = document.getElementById('notificationTitle').value.trim();
    const message = document.getElementById('notificationMessage').value.trim();
    const time = document.getElementById('notificationTime').value;
    const repeat = document.getElementById('notificationRepeat').value;
    
    if (!title || !message || !time) {
        showToast('Please fill in all fields.', 'error');
        return;
    }
    
    const notification = {
        id: Date.now(),
        title: title,
        message: message,
        scheduledTime: new Date(time).getTime(),
        repeatType: repeat,
        isActive: true
    };
    
    notifications.push(notification);
    localStorage.setItem('teha_notifications', JSON.stringify(notifications));
    
    // Schedule notification
    scheduleNotification(notification);
    
    showToast('Reminder set successfully!', 'success');
    closeNotifications();
}

function scheduleNotification(notification) {
    const timeUntilNotification = notification.scheduledTime - Date.now();
    
    if (timeUntilNotification > 0) {
        setTimeout(() => {
            showNotification(notification);
        }, timeUntilNotification);
    }
}

function showNotification(notification) {
    showToast(`${notification.title}: ${notification.message}`, 'info');
    
    // Repeat notification if needed
    if (notification.repeatType !== 'none') {
        const repeatIntervals = {
            'daily': 24 * 60 * 60 * 1000,
            'weekly': 7 * 24 * 60 * 60 * 1000,
            'monthly': 30 * 24 * 60 * 60 * 1000
        };
        
        const interval = repeatIntervals[notification.repeatType];
        if (interval) {
            notification.scheduledTime += interval;
            scheduleNotification(notification);
        }
    }
}

// Audio Generation Functions
function openAudioGeneration() {
    const currentFile = document.getElementById('fileName').textContent;
    document.getElementById('currentFileName').textContent = currentFile !== 'Document' ? currentFile : 'No file selected';
    
    document.getElementById('audioModal').classList.remove('hidden');
    document.getElementById('audioModal').classList.add('show');
}

function closeAudioGeneration() {
    document.getElementById('audioModal').classList.remove('show');
    setTimeout(() => {
        document.getElementById('audioModal').classList.add('hidden');
    }, 300);
}

function generateAudioForFile() {
    const currentFile = document.getElementById('fileName').textContent;
    if (currentFile === 'Document') {
        showToast('Please upload a file first!', 'error');
        return;
    }
    
    document.getElementById('generationStatus').classList.remove('hidden');
    document.getElementById('generateAudioBtn').disabled = true;
    
    // Simulate audio generation progress
    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress >= 100) {
            progress = 100;
            clearInterval(progressInterval);
            
            // Complete generation
            setTimeout(() => {
                document.getElementById('generationStatus').classList.add('hidden');
                document.getElementById('generateAudioBtn').disabled = false;
                document.getElementById('generatedAudioPlayer').classList.remove('hidden');
                
                // Mock generated audio
                const mockAudioUrl = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT';
                document.getElementById('generatedAudio').src = mockAudioUrl;
                
                showToast('Audio generated successfully!', 'success');
            }, 500);
        }
        document.getElementById('generationProgress').style.width = progress + '%';
    }, 200);
}

function downloadGeneratedAudio() {
    const audio = document.getElementById('generatedAudio');
    const link = document.createElement('a');
    link.href = audio.src;
    link.download = `generated-audio-${new Date().toISOString().slice(0, 19)}.wav`;
    link.click();
}

function playGeneratedAudio() {
    const audio = document.getElementById('generatedAudio');
    audio.play();
}

// User Management Functions
function login() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    
    if (!username || !password) {
        showToast('Please enter both username and password.', 'error');
        return;
    }
    
    // Mock login (in a real app, you'd validate against a backend)
    currentUser = { username: username, id: Date.now() };
    userPoints = parseInt(localStorage.getItem(`teha_points_${currentUser.id}`) || '0');
    
    document.getElementById('username').textContent = username;
    document.getElementById('loginBtn').textContent = 'Logout';
    document.getElementById('loginBtn').onclick = logout;
    
    updatePointsDisplay();
    
    closeLogin();
    showToast(`Welcome back, ${username}!`, 'success');
}

function logout() {
    if (currentUser) {
        localStorage.setItem(`teha_points_${currentUser.id}`, userPoints.toString());
    }
    
    currentUser = null;
    userPoints = 0;
    
    document.getElementById('username').textContent = 'Guest';
    document.getElementById('loginBtn').textContent = 'Login';
    document.getElementById('loginBtn').onclick = openLogin;
    
    updatePointsDisplay();
    
    showToast('Logged out successfully!', 'success');
}

function register() {
    const username = document.getElementById('registerUsername').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value.trim();
    
    if (!username || !email || !password) {
        showToast('Please fill in all fields.', 'error');
        return;
    }
    
    // Mock registration (in a real app, you'd save to a backend)
    currentUser = { username: username, email: email, id: Date.now() };
    userPoints = 0;
    
    document.getElementById('username').textContent = username;
    document.getElementById('loginBtn').textContent = 'Logout';
    document.getElementById('loginBtn').onclick = logout;
    
    updatePointsDisplay();
    
    closeRegister();
    showToast(`Welcome to TEHA, ${username}!`, 'success');
}

function openLogin() {
    document.getElementById('loginModal').classList.remove('hidden');
    document.getElementById('loginModal').classList.add('show');
}

function closeLogin() {
    document.getElementById('loginModal').classList.remove('show');
    setTimeout(() => {
        document.getElementById('loginModal').classList.add('hidden');
    }, 300);
}

function openRegister() {
    document.getElementById('registerModal').classList.remove('hidden');
    document.getElementById('registerModal').classList.add('show');
}

function closeRegister() {
    document.getElementById('registerModal').classList.remove('show');
    setTimeout(() => {
        document.getElementById('registerModal').classList.add('hidden');
    }, 300);
}

function switchToRegister() {
    closeLogin();
    setTimeout(() => {
        openRegister();
    }, 300);
}

function switchToLogin() {
    closeRegister();
    setTimeout(() => {
        openLogin();
    }, 300);
}

// Utility Functions
function updatePointsDisplay() {
    document.getElementById('userPoints').textContent = userPoints;
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('notificationToast');
    const toastMessage = document.getElementById('toastMessage');
    
    toastMessage.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.remove('hidden');
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 300);
    }, 3000);
}

function loadUserData() {
    // Load saved user data
    const savedUser = localStorage.getItem('teha_current_user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        userPoints = parseInt(localStorage.getItem(`teha_points_${currentUser.id}`) || '0');
        
        document.getElementById('username').textContent = currentUser.username;
        document.getElementById('loginBtn').textContent = 'Logout';
        document.getElementById('loginBtn').onclick = logout;
    }
    
    updatePointsDisplay();
}

function handleKeyboardShortcuts(event) {
    // Ctrl+S to save note
    if (event.ctrlKey && event.key === 's') {
        event.preventDefault();
        if (document.getElementById('noteEditor').classList.contains('hidden')) return;
        saveNote();
    }
    
    // Escape to close modals
    if (event.key === 'Escape') {
        const openModals = document.querySelectorAll('.modal.show');
        openModals.forEach(modal => {
            const closeBtn = modal.querySelector('.btn-close');
            if (closeBtn) closeBtn.click();
        });
    }
}

// Auto-save notes every 30 seconds
setInterval(() => {
    const noteEditor = document.getElementById('noteEditor');
    if (!noteEditor.classList.contains('hidden')) {
        const title = document.getElementById('noteTitle').value.trim();
        const content = document.getElementById('noteContent').value.trim();
        
        if (title && content) {
            // Auto-save to temporary storage
            localStorage.setItem('teha_auto_save', JSON.stringify({
                title: title,
                content: content,
                category: document.getElementById('noteCategory').value,
                timestamp: Date.now()
            }));
        }
    }
}, 30000);

// Check for auto-saved content on page load
window.addEventListener('load', () => {
    const autoSave = localStorage.getItem('teha_auto_save');
    if (autoSave) {
        const saved = JSON.parse(autoSave);
        const timeSinceSave = Date.now() - saved.timestamp;
        
        // If auto-save is less than 5 minutes old, offer to restore
        if (timeSinceSave < 5 * 60 * 1000) {
            if (confirm('We found an auto-saved note. Would you like to restore it?')) {
                document.getElementById('noteTitle').value = saved.title;
                document.getElementById('noteContent').value = saved.content;
                document.getElementById('noteCategory').value = saved.category;
                
                createNewNote();
            }
        }
        
        localStorage.removeItem('teha_auto_save');
    }
});

// Initialize login button
document.getElementById('loginBtn').onclick = openLogin;