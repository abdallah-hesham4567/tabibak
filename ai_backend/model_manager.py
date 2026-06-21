import os
from huggingface_hub import InferenceClient

HF_TOKEN = os.environ.get("HF_TOKEN")

def query_model(messages: list) -> str:
    """
    Queries the HuggingFace Inference API using the medicalai/ClinicalGPT-R1-Qwen-7B-EN-preview model.
    If HF_TOKEN is not set or the API call fails, falls back to a temporary/placeholder response.
    """
    model_id = "medicalai/ClinicalGPT-R1-Qwen-7B-EN-preview"
    
    if not HF_TOKEN:
        # Placeholder response when HF_TOKEN is not set
        return "Temporary response"
        
    try:
        client = InferenceClient(token=HF_TOKEN)
        response = client.chat_completion(
            model=model_id,
            messages=messages,
            max_tokens=500,
            temperature=0.7
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"Error calling HuggingFace API: {e}")
        return f"Temporary response (API Error: {str(e)})"
