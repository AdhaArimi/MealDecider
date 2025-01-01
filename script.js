document.addEventListener('DOMContentLoaded', function() {
    const HF_ACCESS_TOKEN = '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';
    
    const meals = [
        "Pizza 🍕",
        "Burger 🍔",
        "Sushi 🍱",
        "Pasta 🍝",
        "Salad 🥗",
        "Tacos 🌮",
        "Sandwich 🥪",
        "Curry 🍛",
        "Steak 🥩",
        "Soup 🥣"
    ];

    // Mapping of our meal names to model's classification labels
    const mealMappings = {
        "Pizza": ["pizza", "pizzas"],
        "Burger": ["burger", "hamburger", "cheeseburger", "burgers"],
        "Sushi": ["sushi", "sashimi", "maki"],
        "Pasta": ["pasta", "spaghetti", "noodles", "carbonara", "fettuccine", "penne", "macaroni"],
        "Salad": ["salad", "caesar salad", "garden salad", "greek salad"],
        "Tacos": ["taco", "tacos", "burrito", "mexican"],
        "Sandwich": ["sandwich", "sandwiches", "sub", "hoagie"],
        "Curry": ["curry", "indian curry", "thai curry", "masala"],
        "Steak": ["steak", "beef steak", "ribeye", "sirloin"],
        "Soup": ["soup", "broth", "chowder", "stew"]
    };

    let currentMeal = '';
    const decideMealBtn = document.getElementById('decideMealBtn');
    const mealResult = document.getElementById('mealResult');
    const uploadSection = document.getElementById('uploadSection');
    const uploadForm = document.getElementById('uploadForm');
    const imagePreview = document.getElementById('imagePreview');
    const uploadFeedback = document.getElementById('uploadFeedback');

    decideMealBtn.addEventListener('click', function() {
        decideMealBtn.disabled = true;
        mealResult.innerHTML = '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>';
        
        setTimeout(() => {
            currentMeal = meals[Math.floor(Math.random() * meals.length)];
            mealResult.innerHTML = `<p class="fs-2 fw-bold text-primary mb-0">${currentMeal}</p>`;
            decideMealBtn.disabled = false;
            uploadSection.classList.remove('d-none');
        }, 1000);
    });

    // Handle image preview
    document.getElementById('mealImage').addEventListener('change', function(e) {
        if (this.files && this.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                imagePreview.src = e.target.result;
                imagePreview.classList.remove('d-none');
            }
            reader.readAsDataURL(this.files[0]);
        }
    });

    async function classifyImage(imageFile) {
        const reader = new FileReader();
        return new Promise((resolve, reject) => {
            reader.onload = async function() {
                const base64Data = reader.result.split(',')[1];
                
                try {
                    const response = await fetch(
                        "https://api-inference.huggingface.co/models/nateraw/food",
                        {
                            headers: { 
                                'Authorization': `Bearer ${HF_ACCESS_TOKEN}`,
                                'Content-Type': 'application/json'
                            },
                            method: "POST",
                            body: JSON.stringify({ inputs: base64Data })
                        }
                    );
                    const result = await response.json();
                    console.log('Raw API response:', result); // Debug log
                    
                    // Handle different response formats
                    if (Array.isArray(result)) {
                        resolve(result);
                    } else if (result.error) {
                        console.error('API Error:', result.error);
                        reject(new Error(result.error));
                    } else {
                        resolve([result]); // Wrap single result in array
                    }
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsDataURL(imageFile);
        });
    }

    // Handle form submission with image classification
    uploadForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const imageFile = document.getElementById('mealImage').files[0];
        if (!imageFile) return;

        try {
            uploadFeedback.classList.remove('d-none', 'alert-success', 'alert-danger');
            uploadFeedback.classList.add('alert-info');
            uploadFeedback.textContent = 'Analyzing your image...';

            // Use the new classification function
            const predictions = await classifyImage(imageFile);
            console.log('Predictions:', predictions); // Debug log
            
            // Get the expected food categories for the current meal
            const expectedCategories = mealMappings[currentMeal.split(' ')[0]];
            console.log('Expected categories:', expectedCategories); // Debug log
            
            // Extract labels from predictions
            const predictedLabels = predictions.flatMap(pred => 
                Array.isArray(pred) ? pred.map(p => p.label.toLowerCase()) : [pred.label.toLowerCase()]
            );
            console.log('Predicted labels:', predictedLabels); // Debug log

            // Check if any of the predictions match our expected categories
            const isCorrectMeal = expectedCategories.some(category => 
                predictedLabels.some(label => label.includes(category.toLowerCase()))
            );
            
            console.log('Is correct meal?', isCorrectMeal); // Debug log

            // Show appropriate feedback
            uploadFeedback.classList.remove('alert-info');
            if (isCorrectMeal) {
                uploadFeedback.classList.add('alert-success');
                uploadFeedback.innerHTML = '🎉 Correct meal! You earned 10 points! 🌟';
            } else {
                uploadFeedback.classList.add('alert-danger');
                uploadFeedback.innerHTML = `❌ This doesn't look like ${currentMeal}. No points awarded.<br>
                                          Detected: ${predictedLabels.join(', ')}`;
            }

            // Reset form after 5 seconds
            setTimeout(() => {
                uploadForm.reset();
                imagePreview.classList.add('d-none');
                uploadFeedback.classList.add('d-none');
            }, 5000);

        } catch (error) {
            console.error('Classification error:', error);
            uploadFeedback.classList.remove('alert-info');
            uploadFeedback.classList.add('alert-danger');
            uploadFeedback.textContent = 'Error analyzing image. Please try again.';
        }
    });
}); 