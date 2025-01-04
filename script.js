console.log("script.js is running");
// Import the fallback meals
import { fallbackMeals } from './fallbackMeals.js';

document.addEventListener('DOMContentLoaded', function() {
    const HF_ACCESS_TOKEN = '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';
    
    let currentMeal = '';
    let currentCategory = '';
    const categorySelect = document.getElementById('categorySelect');
    const decideMealBtn = document.getElementById('decideMealBtn');
    const mealResult = document.getElementById('mealResult');
    const uploadSection = document.getElementById('uploadSection');
    const uploadForm = document.getElementById('uploadForm');
    const imagePreview = document.getElementById('imagePreview');
    const uploadFeedback = document.getElementById('uploadFeedback');

    // Enable/disable button based on category selection
    categorySelect.addEventListener('change', function() {
        decideMealBtn.disabled = !this.value;
        if (this.value) {
            currentCategory = this.value;
        }
    });

    async function getMealSuggestion(category, maxRetries = 3) {
        let retries = 0;
        decideMealBtn.disabled = true;
        mealResult.innerHTML = '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>';
        
        while (retries < maxRetries) {
            try {
                const prompt = `Name a popular ${category} dish. Output format: [dish name]`;
                console.log('Meal Suggestion Prompt:', prompt);

                const response = await fetch(
                    "https://api-inference.huggingface.co/models/facebook/bart-large",
                    {
                        headers: {
                            "Authorization": `Bearer ${HF_ACCESS_TOKEN}`,
                            "Content-Type": "application/json"
                        },
                        method: "POST",
                        body: JSON.stringify({
                            inputs: prompt,
                            parameters: {
                                max_length: 20,
                                min_length: 2,
                                temperature: 0.7,
                                top_p: 0.95,
                                do_sample: true,
                                return_full_text: false
                            }
                        })
                    }
                );

                const result = await response.json();
                console.log('Raw Response:', result);
                
                if (result.error) {
                    if (result.error.includes('loading')) {
                        retries++;
                        console.log(`Model loading, attempt ${retries} of ${maxRetries}...`);
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        continue;
                    }
                    throw new Error(result.error);
                }

                // Clean BART's output
                let suggestion = Array.isArray(result) ? result[0].generated_text : result.generated_text;
                suggestion = suggestion
                    .trim()
                    .split('\n')[0]
                    .replace(/[\[\]]/g, '')  // Remove brackets
                    .replace(/["""]/g, '')
                    .replace(/^[^a-zA-Z]+/, '')
                    .replace(/^(name|a popular|dish|suggest|try|how about|you should try|i recommend|one)\s*/i, '')
                    .trim();

                console.log('Cleaned Suggestion:', suggestion);

                if (!suggestion) {
                    throw new Error('Empty response from model');
                }

                // Add emoji and return result
                const categoryEmojis = {
                    "Healthy": "🥗",
                    "Fast": "🍔",
                    "Asian": "🍜",
                    "Italian": "🍝",
                    "Mexican": "🌮",
                    "Dessert": "🍰",
                    "Breakfast": "🍳",
                    "Vegetarian": "🥬",
                    "Seafood": "🦐",
                    "Comfort": "🍲"
                };

                const emoji = categoryEmojis[category] || "🍽️";
                const finalSuggestion = `${suggestion} ${emoji}`;
                console.log('Final Suggestion with Emoji:', finalSuggestion);
                return finalSuggestion;

            } catch (error) {
                if (retries === maxRetries - 1) {
                    console.error('Error getting meal suggestion:', error);
                    return getFallbackSuggestion(category);
                }
                retries++;
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        return getFallbackSuggestion(category);
    }

    // Use the imported fallback meals
    function getFallbackSuggestion(category) {
        const options = fallbackMeals[category] || [`${category} Special 🍽️`];
        return options[Math.floor(Math.random() * options.length)];
    }

    decideMealBtn.addEventListener('click', async function() {
        if (!categorySelect.value) return;
        decideMealBtn.disabled = true;
        
        try {
            const suggestion = await getMealSuggestion(currentCategory);
            currentMeal = suggestion;
            mealResult.innerHTML = `
                <p class="fs-2 fw-bold text-primary mb-0">${suggestion}</p>
            `;
            uploadSection.classList.remove('d-none');
        } catch (error) {
            console.error('Suggestion error:', error);
            mealResult.innerHTML = '<p class="text-danger">Error getting meal suggestion. Please try again.</p>';
        } finally {
            decideMealBtn.disabled = false;
        }
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

    async function classifyImage(imageFile, maxRetries = 5) {
        const reader = new FileReader();
        return new Promise((resolve, reject) => {
            reader.onload = async function() {
                const base64Data = reader.result.split(',')[1];
                
                let retries = 0;
                while (retries < maxRetries) {
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
                        
                        if (result.error && result.error.includes('loading')) {
                            // Model is loading, wait and retry
                            retries++;
                            console.log(`Model loading, attempt ${retries} of ${maxRetries}...`);
                            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
                            continue;
                        }
                        
                        // Handle different response formats
                        if (Array.isArray(result)) {
                            resolve(result);
                            return;
                        } else if (result.error) {
                            console.error('API Error:', result.error);
                            reject(new Error(result.error));
                            return;
                        } else {
                            resolve([result]); // Wrap single result in array
                            return;
                        }
                    } catch (error) {
                        if (retries === maxRetries - 1) {
                            reject(error);
                            return;
                        }
                        retries++;
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }
                reject(new Error('Max retries reached while waiting for model to load'));
            };
            reader.onerror = reject;
            reader.readAsDataURL(imageFile);
        });
    }

    async function checkMealMatch(suggestedMeal, detectedFood) {
        try {
            const prompt = `Compare: "${suggestedMeal}" and "${detectedFood}". Are they the same dish? Answer: [yes/no]`;
            console.log('Meal Match Prompt:', prompt);

            const response = await fetch(
                "https://api-inference.huggingface.co/models/facebook/bart-large",
                {
                    headers: {
                        "Authorization": `Bearer ${HF_ACCESS_TOKEN}`,
                        "Content-Type": "application/json"
                    },
                    method: "POST",
                    body: JSON.stringify({
                        inputs: prompt,
                        parameters: {
                            max_length: 5,
                            min_length: 2,
                            temperature: 0.2,
                            top_p: 0.9,
                            do_sample: true,
                            return_full_text: false
                        }
                    })
                }
            );

            const result = await response.json();
            console.log('Meal Match Raw Response:', result);
            
            if (result.error) {
                throw new Error(result.error);
            }

            let answer = Array.isArray(result) ? result[0].generated_text : result.generated_text;
            answer = answer.trim().toLowerCase();
            
            console.log('Cleaned Answer:', answer);
            return answer.includes('yes') || answer.includes('true');

        } catch (error) {
            console.error('Error checking meal match:', error);
            
            // Fallback to simple text comparison if API fails
            const simplifiedSuggested = suggestedMeal.toLowerCase();
            const simplifiedDetected = detectedFood.toLowerCase();
            
            // More lenient matching logic
            const suggestedWords = simplifiedSuggested.split(' ');
            const detectedWords = simplifiedDetected.split(' ');
            
            // Check if any word from either phrase matches
            const hasMatch = suggestedWords.some(sword => 
                detectedWords.some(dword => 
                    sword.includes(dword) || dword.includes(sword)
                )
            );

            // Special cases for common variations
            const commonVariations = {
                'burger': ['hamburger', 'cheeseburger'],
                'sushi': ['maki', 'roll', 'nigiri'],
                'pasta': ['spaghetti', 'noodle', 'macaroni'],
                'rice': ['risotto', 'pilaf'],
                'chicken': ['poultry', 'hen'],
                'fish': ['salmon', 'tuna', 'cod']
            };

            // Check common variations
            for (const [base, variations] of Object.entries(commonVariations)) {
                if ((simplifiedSuggested.includes(base) && 
                     variations.some(v => simplifiedDetected.includes(v))) ||
                    (simplifiedDetected.includes(base) && 
                     variations.some(v => simplifiedSuggested.includes(v)))) {
                    return true;
                }
            }

            return hasMatch;
        }
    }

    // Update the form submission handler
    uploadForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const imageFile = document.getElementById('mealImage').files[0];
        if (!imageFile) return;

        try {
            uploadFeedback.classList.remove('d-none', 'alert-success', 'alert-danger');
            uploadFeedback.classList.add('alert-info');
            uploadFeedback.textContent = 'Analyzing your image... This might take a few seconds.';

            // Get food classification
            const predictions = await classifyImage(imageFile);
            console.log('Food detection:', predictions);
            
            // Get the top detected food
            const detectedFood = predictions[0].label;
            console.log('Detected food:', detectedFood);
            
            // Remove emoji from currentMeal
            const suggestedMeal = currentMeal.replace(/[\u{1F300}-\u{1F6FF}]/gu, '').trim();
            console.log('Suggested meal:', suggestedMeal);

            // Check if they match using LLM
            const isMatch = await checkMealMatch(suggestedMeal, detectedFood);
            console.log('Is match?', isMatch);

            // Show appropriate feedback
            uploadFeedback.classList.remove('alert-info');
            if (isMatch) {
                uploadFeedback.classList.add('alert-success');
                uploadFeedback.innerHTML = '🎉 Correct meal! You earned 10 points! 🌟';
            } else {
                uploadFeedback.classList.add('alert-danger');
                uploadFeedback.innerHTML = `❌ This doesn't look like ${suggestedMeal}.<br>
                                          Detected: ${detectedFood}`;
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