from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from prompt_builder import build_prompt
from model_manager import query_model
import patient_profile

app = FastAPI(title="Tabibak AI Chat Backend")

# Enable CORS for the Express frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: str

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    # Proactively update patient profile if common symptoms are mentioned
    lower_msg = request.message.lower()
    detected_symptoms = []
    for symptom in ["headache", "fever", "cough", "fatigue", "nausea", "dizziness", "pain"]:
        if symptom in lower_msg:
            detected_symptoms.append(symptom)
            
    if detected_symptoms:
        patient_profile.update_profile({"symptoms": detected_symptoms})
        
    # Build prompt using the updated profile context
    messages = build_prompt(request.message)
    
    # Query LLM
    response_text = query_model(messages)
    
    return ChatResponse(response=response_text)

@app.get("/profile")
async def get_profile():
    """Endpoint to retrieve current patient profile (convenient for testing)."""
    return patient_profile.load_profile()

@app.post("/profile")
async def update_profile_endpoint(updates: dict):
    """Endpoint to update patient profile manually."""
    return patient_profile.update_profile(updates)

@app.post("/profile/reset")
async def reset_profile():
    """Resets patient profile to defaults."""
    default_prof = patient_profile.get_default_profile()
    patient_profile.save_profile(default_prof)
    return default_prof
